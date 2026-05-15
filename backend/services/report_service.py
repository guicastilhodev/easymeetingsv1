"""
Serviço de relatórios de reservas.
Responsável pela geração de relatórios, cálculo de taxa de ocupação e exportação CSV.
"""

import csv
import io
from datetime import date, datetime, timedelta
from typing import Optional

from database import fetch_all, fetch_one


def count_business_days(start_date: str, end_date: str) -> int:
    """
    Conta os dias úteis (segunda a sexta) no período informado, inclusive.

    Args:
        start_date: Data de início no formato YYYY-MM-DD.
        end_date: Data de fim no formato YYYY-MM-DD.

    Returns:
        Número de dias úteis no período.
    """
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()

    count = 0
    current = start
    while current <= end:
        # weekday(): 0=segunda, 4=sexta, 5=sábado, 6=domingo
        if current.weekday() < 5:
            count += 1
        current += timedelta(days=1)

    return count


def get_active_rooms_count() -> int:
    """Retorna o número de salas ativas no sistema."""
    result = fetch_one("SELECT COUNT(*) as count FROM salas WHERE is_active = 1")
    return result["count"] if result else 0


def sum_reserved_hours(
    start_date: str, end_date: str, room_id: Optional[int] = None
) -> float:
    """
    Soma as horas reservadas (reservas ativas) no período.

    Calcula a duração de cada reserva em horas e soma todas.
    """
    query = """
        SELECT start_time, end_time
        FROM reservas
        WHERE status = 'active'
          AND date >= ? AND date <= ?
    """
    params: list = [start_date, end_date]

    if room_id is not None:
        query += " AND room_id = ?"
        params.append(room_id)

    reservations = fetch_all(query, params)

    total_hours = 0.0
    for reservation in reservations:
        start = datetime.strptime(reservation["start_time"], "%H:%M")
        end = datetime.strptime(reservation["end_time"], "%H:%M")
        duration = (end - start).total_seconds() / 3600.0
        total_hours += duration

    return total_hours


def calculate_occupancy_rate(
    start_date: str, end_date: str, room_id: Optional[int] = None
) -> float:
    """
    Calcula a taxa de ocupação como:
      (horas reservadas / horas disponíveis) × 100

    Horas disponíveis = dias úteis no período × 10h (08:00-18:00) × nº de salas ativas.
    Se filtrado por sala, considera apenas 1 sala.
    """
    business_days = count_business_days(start_date, end_date)
    hours_per_day = 10  # 08:00 às 18:00

    if room_id is not None:
        total_available_hours = business_days * hours_per_day
    else:
        active_rooms_count = get_active_rooms_count()
        total_available_hours = business_days * hours_per_day * active_rooms_count

    reserved_hours = sum_reserved_hours(start_date, end_date, room_id)

    if total_available_hours == 0:
        return 0.0

    return (reserved_hours / total_available_hours) * 100


def generate_report(
    start_date: str, end_date: str, room_id: Optional[int] = None
) -> dict:
    """
    Gera o relatório de reservas para o período informado.

    Args:
        start_date: Data de início no formato YYYY-MM-DD.
        end_date: Data de fim no formato YYYY-MM-DD.
        room_id: ID da sala para filtrar (opcional).

    Returns:
        Dicionário com:
        - success: True/False
        - report: Dados do relatório (se sucesso)
        - error: Mensagem de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    # Valida formato das datas
    try:
        parsed_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        parsed_end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return {
            "success": False,
            "error": "Formato de data inválido. Use YYYY-MM-DD.",
            "error_code": "INVALID_DATE_FORMAT",
            "status_code": 400,
        }

    # Valida período (data início ≤ data fim)
    if parsed_start > parsed_end:
        return {
            "success": False,
            "error": "Período inválido. A data de início deve ser anterior ou igual à data de fim.",
            "error_code": "INVALID_PERIOD",
            "status_code": 400,
        }

    # Valida sala se informada
    if room_id is not None:
        room = fetch_one("SELECT id, name FROM salas WHERE id = ?", (room_id,))
        if room is None:
            return {
                "success": False,
                "error": "Sala não encontrada.",
                "error_code": "ROOM_NOT_FOUND",
                "status_code": 404,
            }

    # Total de reservas ativas no período
    total_query = """
        SELECT COUNT(*) as count
        FROM reservas
        WHERE status = 'active'
          AND date >= ? AND date <= ?
    """
    total_params: list = [start_date, end_date]

    if room_id is not None:
        total_query += " AND room_id = ?"
        total_params.append(room_id)

    total_result = fetch_one(total_query, total_params)
    total_reservations = total_result["count"] if total_result else 0

    # Reservas por sala (ordenadas por count desc)
    by_room_query = """
        SELECT s.name as room_name, COUNT(*) as count
        FROM reservas r
        JOIN salas s ON r.room_id = s.id
        WHERE r.status = 'active'
          AND r.date >= ? AND r.date <= ?
    """
    by_room_params: list = [start_date, end_date]

    if room_id is not None:
        by_room_query += " AND r.room_id = ?"
        by_room_params.append(room_id)

    by_room_query += " GROUP BY s.id, s.name ORDER BY count DESC"
    by_room = fetch_all(by_room_query, by_room_params)

    # Reservas por usuário (ordenadas por count desc)
    by_user_query = """
        SELECT u.name as user_name, COUNT(*) as count
        FROM reservas r
        JOIN usuarios u ON r.organizer_id = u.id
        WHERE r.status = 'active'
          AND r.date >= ? AND r.date <= ?
    """
    by_user_params: list = [start_date, end_date]

    if room_id is not None:
        by_user_query += " AND r.room_id = ?"
        by_user_params.append(room_id)

    by_user_query += " GROUP BY u.id, u.name ORDER BY count DESC"
    by_user = fetch_all(by_user_query, by_user_params)

    # Taxa de ocupação
    occupancy_rate = calculate_occupancy_rate(start_date, end_date, room_id)

    report = {
        "total_reservations": total_reservations,
        "by_room": by_room,
        "by_user": by_user,
        "occupancy_rate": round(occupancy_rate, 2),
        "period": {
            "start_date": start_date,
            "end_date": end_date,
        },
    }

    if room_id is not None:
        report["room_id"] = room_id

    return {
        "success": True,
        "report": report,
        "status_code": 200,
    }


def export_report_csv(
    start_date: str, end_date: str, room_id: Optional[int] = None
) -> dict:
    """
    Gera o relatório em formato CSV.

    Returns:
        Dicionário com:
        - success: True/False
        - csv_content: String com conteúdo CSV (se sucesso)
        - error: Mensagem de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    # Gera o relatório primeiro
    result = generate_report(start_date, end_date, room_id)

    if not result["success"]:
        return result

    report = result["report"]

    # Gera CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Cabeçalho do relatório
    writer.writerow(["Relatório de Reservas"])
    writer.writerow(["Período", f"{start_date} a {end_date}"])
    writer.writerow(["Total de Reservas", report["total_reservations"]])
    writer.writerow(["Taxa de Ocupação (%)", report["occupancy_rate"]])
    writer.writerow([])

    # Reservas por sala
    writer.writerow(["Reservas por Sala"])
    writer.writerow(["Sala", "Quantidade"])
    for item in report["by_room"]:
        writer.writerow([item["room_name"], item["count"]])
    writer.writerow([])

    # Reservas por usuário
    writer.writerow(["Reservas por Usuário"])
    writer.writerow(["Usuário", "Quantidade"])
    for item in report["by_user"]:
        writer.writerow([item["user_name"], item["count"]])

    csv_content = output.getvalue()
    output.close()

    return {
        "success": True,
        "csv_content": csv_content,
        "status_code": 200,
    }
