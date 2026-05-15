"""
Serviço de reservas de salas.
Responsável pela criação, edição e cancelamento de reservas,
detecção de conflitos de horário e validações de negócio.
"""

from datetime import datetime, timedelta
from typing import Optional

from database import execute, fetch_all, fetch_one


def _parse_time(time_str: str) -> Optional[datetime]:
    """Converte string HH:MM para objeto datetime (apenas hora)."""
    try:
        return datetime.strptime(time_str, "%H:%M")
    except (ValueError, TypeError):
        return None


def _parse_date(date_str: str) -> Optional[datetime]:
    """Converte string YYYY-MM-DD para objeto datetime."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def validate_reservation_period(
    date: str, start_time: str, end_time: str
) -> Optional[dict]:
    """
    Valida o período da reserva.
    Retorna None se válido, ou dict com erro se inválido.

    Validações:
    - Formato de data (YYYY-MM-DD) e hora (HH:MM)
    - hora_fim > hora_início
    - Duração mínima de 15 minutos
    - Data/hora não no passado
    """
    # Valida formato de data
    parsed_date = _parse_date(date)
    if parsed_date is None:
        return {
            "error": "Formato de data inválido. Use YYYY-MM-DD.",
            "error_code": "INVALID_DATE_FORMAT",
            "status_code": 400,
        }

    # Valida formato de hora
    parsed_start = _parse_time(start_time)
    parsed_end = _parse_time(end_time)

    if parsed_start is None:
        return {
            "error": "Formato de hora de início inválido. Use HH:MM.",
            "error_code": "INVALID_TIME_FORMAT",
            "status_code": 400,
        }

    if parsed_end is None:
        return {
            "error": "Formato de hora de fim inválido. Use HH:MM.",
            "error_code": "INVALID_TIME_FORMAT",
            "status_code": 400,
        }

    # Valida hora_fim > hora_início
    if parsed_end <= parsed_start:
        return {
            "error": "Hora de fim deve ser posterior à hora de início.",
            "error_code": "INVALID_TIME_RANGE",
            "status_code": 400,
        }

    # Valida duração mínima de 15 minutos
    duration = parsed_end - parsed_start
    if duration < timedelta(minutes=15):
        return {
            "error": "Duração mínima da reserva é de 15 minutos.",
            "error_code": "DURATION_TOO_SHORT",
            "status_code": 400,
        }

    # Valida data/hora não no passado
    now = datetime.now()
    reservation_start = parsed_date.replace(
        hour=parsed_start.hour, minute=parsed_start.minute
    )
    if reservation_start < now:
        return {
            "error": "Não é permitido agendar em períodos passados.",
            "error_code": "PAST_DATE",
            "status_code": 400,
        }

    return None


def check_conflict(
    room_id: int,
    date: str,
    start_time: str,
    end_time: str,
    exclude_reservation_id: Optional[int] = None,
) -> Optional[dict]:
    """
    Verifica se existe conflito de horário para a sala na data especificada.
    Retorna a reserva conflitante ou None se não houver conflito.

    Sobreposição ocorre quando:
      existing.start_time < new.end_time AND existing.end_time > new.start_time
    """
    query = """
        SELECT id, start_time, end_time, organizer_id
        FROM reservas
        WHERE room_id = ? AND date = ? AND status = 'active'
          AND start_time < ? AND end_time > ?
    """
    params: list = [room_id, date, end_time, start_time]

    if exclude_reservation_id:
        query += " AND id != ?"
        params.append(exclude_reservation_id)

    return fetch_one(query, params)


def create_reservation(
    room_id: int,
    date: str,
    start_time: str,
    end_time: str,
    participants: list[str],
    organizer_id: int,
) -> dict:
    """
    Cria uma nova reserva.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - reservation: Dados da reserva criada (se sucesso)
        - error: Mensagem de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    # Valida período
    period_error = validate_reservation_period(date, start_time, end_time)
    if period_error:
        return {"success": False, **period_error}

    # Valida participantes (1-50)
    if not participants or len(participants) < 1:
        return {
            "success": False,
            "error": "É necessário informar pelo menos 1 participante.",
            "error_code": "INVALID_PARTICIPANTS",
            "status_code": 400,
        }

    if len(participants) > 50:
        return {
            "success": False,
            "error": "Máximo de 50 participantes por reserva.",
            "error_code": "TOO_MANY_PARTICIPANTS",
            "status_code": 400,
        }

    # Valida nomes dos participantes
    for p in participants:
        if not p or not p.strip():
            return {
                "success": False,
                "error": "Nome de participante não pode ser vazio.",
                "error_code": "INVALID_PARTICIPANT_NAME",
                "status_code": 400,
            }

    # Verifica se a sala existe e está ativa
    room = fetch_one(
        "SELECT id, name, capacity FROM salas WHERE id = ? AND is_active = 1",
        (room_id,),
    )
    if room is None:
        return {
            "success": False,
            "error": "Sala não encontrada.",
            "error_code": "ROOM_NOT_FOUND",
            "status_code": 404,
        }

    # Valida capacidade da sala
    if len(participants) > room["capacity"]:
        return {
            "success": False,
            "error": f"Número de participantes ({len(participants)}) excede a capacidade da sala ({room['capacity']}).",
            "error_code": "EXCEEDS_ROOM_CAPACITY",
            "status_code": 400,
        }

    # Verifica conflito de horário
    conflict = check_conflict(room_id, date, start_time, end_time)
    if conflict:
        return {
            "success": False,
            "error": "Conflito de horário. Já existe uma reserva ativa neste período.",
            "error_code": "RESERVATION_CONFLICT",
            "conflict": conflict,
            "status_code": 409,
        }

    # Cria a reserva
    reservation_id = execute(
        """INSERT INTO reservas (room_id, organizer_id, date, start_time, end_time, status)
           VALUES (?, ?, ?, ?, ?, 'active')""",
        (room_id, organizer_id, date, start_time, end_time),
    )

    # Insere participantes
    for participant_name in participants:
        execute(
            "INSERT INTO participantes (reservation_id, participant_name) VALUES (?, ?)",
            (reservation_id, participant_name.strip()),
        )

    # Retorna a reserva criada com dados completos
    reservation = _get_reservation_detail(reservation_id)

    return {
        "success": True,
        "reservation": reservation,
        "status_code": 201,
    }


def update_reservation(
    reservation_id: int,
    organizer_id: int,
    room_id: Optional[int] = None,
    date: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    participants: Optional[list[str]] = None,
) -> dict:
    """
    Edita uma reserva existente. Apenas o organizador pode editar.

    Returns:
        Dicionário com resultado da operação.
    """
    # Busca a reserva existente
    existing = fetch_one(
        "SELECT id, room_id, organizer_id, date, start_time, end_time, status FROM reservas WHERE id = ?",
        (reservation_id,),
    )

    if existing is None:
        return {
            "success": False,
            "error": "Reserva não encontrada.",
            "error_code": "RESERVATION_NOT_FOUND",
            "status_code": 404,
        }

    # Verifica se a reserva está ativa
    if existing["status"] != "active":
        return {
            "success": False,
            "error": "Não é possível editar uma reserva cancelada.",
            "error_code": "RESERVATION_CANCELLED",
            "status_code": 400,
        }

    # Verifica se o usuário é o organizador
    if existing["organizer_id"] != organizer_id:
        return {
            "success": False,
            "error": "Apenas o organizador pode modificar a reserva.",
            "error_code": "NOT_ORGANIZER",
            "status_code": 403,
        }

    # Determina os valores finais (usa existente se não fornecido)
    final_room_id = room_id if room_id is not None else existing["room_id"]
    final_date = date if date is not None else existing["date"]
    final_start_time = start_time if start_time is not None else existing["start_time"]
    final_end_time = end_time if end_time is not None else existing["end_time"]

    # Valida período com os valores finais
    period_error = validate_reservation_period(
        final_date, final_start_time, final_end_time
    )
    if period_error:
        return {"success": False, **period_error}

    # Valida participantes se fornecidos
    if participants is not None:
        if len(participants) < 1:
            return {
                "success": False,
                "error": "É necessário informar pelo menos 1 participante.",
                "error_code": "INVALID_PARTICIPANTS",
                "status_code": 400,
            }
        if len(participants) > 50:
            return {
                "success": False,
                "error": "Máximo de 50 participantes por reserva.",
                "error_code": "TOO_MANY_PARTICIPANTS",
                "status_code": 400,
            }
        for p in participants:
            if not p or not p.strip():
                return {
                    "success": False,
                    "error": "Nome de participante não pode ser vazio.",
                    "error_code": "INVALID_PARTICIPANT_NAME",
                    "status_code": 400,
                }

    # Verifica se a sala existe e está ativa (se mudou)
    if room_id is not None and room_id != existing["room_id"]:
        room = fetch_one(
            "SELECT id, name, capacity FROM salas WHERE id = ? AND is_active = 1",
            (final_room_id,),
        )
        if room is None:
            return {
                "success": False,
                "error": "Sala não encontrada.",
                "error_code": "ROOM_NOT_FOUND",
                "status_code": 404,
            }

    # Valida capacidade da sala com os participantes finais
    final_participants = participants if participants is not None else None
    if final_participants is not None:
        room_data = fetch_one(
            "SELECT capacity FROM salas WHERE id = ?",
            (final_room_id,),
        )
        if room_data and len(final_participants) > room_data["capacity"]:
            return {
                "success": False,
                "error": f"Número de participantes ({len(final_participants)}) excede a capacidade da sala ({room_data['capacity']}).",
                "error_code": "EXCEEDS_ROOM_CAPACITY",
                "status_code": 400,
            }

    # Verifica conflito de horário (excluindo a própria reserva)
    conflict = check_conflict(
        final_room_id,
        final_date,
        final_start_time,
        final_end_time,
        exclude_reservation_id=reservation_id,
    )
    if conflict:
        return {
            "success": False,
            "error": "Conflito de horário. Já existe uma reserva ativa neste período.",
            "error_code": "RESERVATION_CONFLICT",
            "conflict": conflict,
            "status_code": 409,
        }

    # Atualiza a reserva
    execute(
        """UPDATE reservas
           SET room_id = ?, date = ?, start_time = ?, end_time = ?, updated_at = datetime('now')
           WHERE id = ?""",
        (final_room_id, final_date, final_start_time, final_end_time, reservation_id),
    )

    # Atualiza participantes se fornecidos
    if participants is not None:
        # Remove participantes antigos
        execute(
            "DELETE FROM participantes WHERE reservation_id = ?",
            (reservation_id,),
        )
        # Insere novos participantes
        for participant_name in participants:
            execute(
                "INSERT INTO participantes (reservation_id, participant_name) VALUES (?, ?)",
                (reservation_id, participant_name.strip()),
            )

    # Retorna a reserva atualizada
    reservation = _get_reservation_detail(reservation_id)

    return {
        "success": True,
        "reservation": reservation,
        "status_code": 200,
    }


def cancel_reservation(reservation_id: int, user_id: int) -> dict:
    """
    Cancela uma reserva. Apenas o organizador pode cancelar.

    Returns:
        Dicionário com resultado da operação.
    """
    # Busca a reserva existente
    existing = fetch_one(
        "SELECT id, organizer_id, status FROM reservas WHERE id = ?",
        (reservation_id,),
    )

    if existing is None:
        return {
            "success": False,
            "error": "Reserva não encontrada.",
            "error_code": "RESERVATION_NOT_FOUND",
            "status_code": 404,
        }

    # Verifica se a reserva já está cancelada
    if existing["status"] == "cancelled":
        return {
            "success": False,
            "error": "Reserva já está cancelada.",
            "error_code": "RESERVATION_ALREADY_CANCELLED",
            "status_code": 400,
        }

    # Verifica se o usuário é o organizador
    if existing["organizer_id"] != user_id:
        return {
            "success": False,
            "error": "Apenas o organizador pode modificar a reserva.",
            "error_code": "NOT_ORGANIZER",
            "status_code": 403,
        }

    # Cancela a reserva
    execute(
        "UPDATE reservas SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?",
        (reservation_id,),
    )

    return {
        "success": True,
        "detail": "Reserva cancelada com sucesso.",
        "status_code": 200,
    }


def get_reservation_by_id(reservation_id: int) -> Optional[dict]:
    """
    Retorna os detalhes completos de uma reserva pelo ID.
    Retorna None se não encontrada.
    """
    return _get_reservation_detail(reservation_id)


def list_reservations(
    user_id: int, user_role: str, page: int = 1, page_size: int = 50
) -> list[dict]:
    """
    Lista reservas com visibilidade por perfil.
    - Admin: vê todas as reservas
    - Scheduler: vê apenas suas próprias reservas

    Retorna até page_size reservas, ordenadas por data e hora de início.
    """
    offset = (page - 1) * page_size

    if user_role == "admin":
        reservations = fetch_all(
            """SELECT r.id, r.room_id, r.organizer_id, r.date, r.start_time, r.end_time, r.status,
                      s.name as room_name, u.name as organizer_name
               FROM reservas r
               JOIN salas s ON r.room_id = s.id
               JOIN usuarios u ON r.organizer_id = u.id
               ORDER BY r.date, r.start_time
               LIMIT ? OFFSET ?""",
            (page_size, offset),
        )
    else:
        reservations = fetch_all(
            """SELECT r.id, r.room_id, r.organizer_id, r.date, r.start_time, r.end_time, r.status,
                      s.name as room_name, u.name as organizer_name
               FROM reservas r
               JOIN salas s ON r.room_id = s.id
               JOIN usuarios u ON r.organizer_id = u.id
               WHERE r.organizer_id = ?
               ORDER BY r.date, r.start_time
               LIMIT ? OFFSET ?""",
            (user_id, page_size, offset),
        )

    # Para cada reserva, busca participantes e recursos da sala
    for reservation in reservations:
        reservation["participants"] = _get_participants(reservation["id"])
        reservation["room_resources"] = _get_room_resources(reservation["room_id"])

    return reservations


def _get_reservation_detail(reservation_id: int) -> Optional[dict]:
    """Busca detalhes completos de uma reserva (com joins)."""
    reservation = fetch_one(
        """SELECT r.id, r.room_id, r.organizer_id, r.date, r.start_time, r.end_time, r.status,
                  s.name as room_name, u.name as organizer_name
           FROM reservas r
           JOIN salas s ON r.room_id = s.id
           JOIN usuarios u ON r.organizer_id = u.id
           WHERE r.id = ?""",
        (reservation_id,),
    )

    if reservation is None:
        return None

    reservation["participants"] = _get_participants(reservation_id)
    reservation["room_resources"] = _get_room_resources(reservation["room_id"])

    return reservation


def _get_participants(reservation_id: int) -> list[str]:
    """Retorna lista de nomes dos participantes de uma reserva."""
    rows = fetch_all(
        "SELECT participant_name FROM participantes WHERE reservation_id = ?",
        (reservation_id,),
    )
    return [row["participant_name"] for row in rows]


def _get_room_resources(room_id: int) -> list[dict]:
    """Retorna recursos da sala."""
    return fetch_all(
        "SELECT id, room_id, type, name, quantity FROM recursos WHERE room_id = ? ORDER BY type, name",
        (room_id,),
    )
