"""
Serviço de histórico de reservas.
Responsável pela consulta de reservas passadas ou canceladas,
com filtros combinados por período, sala e organizador.
"""

from datetime import datetime
from typing import Optional

from database import fetch_all


def get_history(
    user_id: int,
    user_role: str,
    page: int = 1,
    page_size: int = 50,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    room_id: Optional[int] = None,
    organizer_id: Optional[int] = None,
) -> dict:
    """
    Consulta o histórico de reservas (passadas ou canceladas).

    Regras de acesso:
    - Scheduler: vê apenas próprio histórico (ignora organizer_id)
    - Admin: vê todos, pode filtrar por organizador

    Filtros combinados com lógica AND:
    - start_date / end_date: período (max 365 dias)
    - room_id: sala específica
    - organizer_id: organizador (apenas admin)

    Returns:
        Dicionário com:
        - success: True/False
        - data: lista de reservas (se sucesso)
        - page: página atual
        - page_size: tamanho da página
        - error: mensagem de erro (se falha)
        - status_code: código HTTP sugerido
    """
    # Validação de período
    if start_date and end_date:
        parsed_start = _parse_date(start_date)
        parsed_end = _parse_date(end_date)

        if parsed_start is None:
            return {
                "success": False,
                "error": "Formato de data início inválido. Use YYYY-MM-DD.",
                "error_code": "INVALID_DATE_FORMAT",
                "status_code": 400,
            }

        if parsed_end is None:
            return {
                "success": False,
                "error": "Formato de data fim inválido. Use YYYY-MM-DD.",
                "error_code": "INVALID_DATE_FORMAT",
                "status_code": 400,
            }

        if parsed_end < parsed_start:
            return {
                "success": False,
                "error": "Período inválido. A data fim deve ser igual ou posterior à data início.",
                "error_code": "INVALID_DATE_RANGE",
                "status_code": 400,
            }

        # Verifica intervalo máximo de 365 dias
        delta = (parsed_end - parsed_start).days
        if delta > 365:
            return {
                "success": False,
                "error": "O intervalo máximo permitido é de 365 dias.",
                "error_code": "DATE_RANGE_TOO_LARGE",
                "status_code": 400,
            }

    elif start_date:
        if _parse_date(start_date) is None:
            return {
                "success": False,
                "error": "Formato de data início inválido. Use YYYY-MM-DD.",
                "error_code": "INVALID_DATE_FORMAT",
                "status_code": 400,
            }

    elif end_date:
        if _parse_date(end_date) is None:
            return {
                "success": False,
                "error": "Formato de data fim inválido. Use YYYY-MM-DD.",
                "error_code": "INVALID_DATE_FORMAT",
                "status_code": 400,
            }

    # Monta a query base: reservas passadas (data/hora fim < agora) OU canceladas
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    query = """
        SELECT r.id, r.room_id, r.organizer_id, r.date, r.start_time, r.end_time, r.status,
               s.name as room_name, u.name as organizer_name
        FROM reservas r
        JOIN salas s ON r.room_id = s.id
        JOIN usuarios u ON r.organizer_id = u.id
        WHERE (r.status = 'cancelled' OR (r.date || ' ' || r.end_time) < ?)
    """
    params: list = [now]

    # Restrição de acesso: scheduler vê apenas próprio histórico
    if user_role != "admin":
        query += " AND r.organizer_id = ?"
        params.append(user_id)
    else:
        # Admin pode filtrar por organizador
        if organizer_id is not None:
            query += " AND r.organizer_id = ?"
            params.append(organizer_id)

    # Filtro por período (data da reserva dentro do intervalo)
    if start_date:
        query += " AND r.date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND r.date <= ?"
        params.append(end_date)

    # Filtro por sala
    if room_id is not None:
        query += " AND r.room_id = ?"
        params.append(room_id)

    # Ordenação por data decrescente
    query += " ORDER BY r.date DESC, r.start_time DESC"

    # Paginação
    offset = (page - 1) * page_size
    query += " LIMIT ? OFFSET ?"
    params.extend([page_size, offset])

    reservations = fetch_all(query, params)

    # Para cada reserva, busca participantes
    for reservation in reservations:
        reservation["participants"] = _get_participants(reservation["id"])

    return {
        "success": True,
        "data": reservations,
        "page": page,
        "page_size": page_size,
    }


def _parse_date(date_str: str) -> Optional[datetime]:
    """Converte string YYYY-MM-DD para objeto datetime."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _get_participants(reservation_id: int) -> list[str]:
    """Retorna lista de nomes dos participantes de uma reserva."""
    rows = fetch_all(
        "SELECT participant_name FROM participantes WHERE reservation_id = ?",
        (reservation_id,),
    )
    return [row["participant_name"] for row in rows]
