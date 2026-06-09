"""
Serviço de disponibilidade de salas.
Responsável pela consulta de salas disponíveis por período e recursos,
e pelo cálculo de intervalos livres dentro do horário comercial.
"""

from typing import Optional

from database import fetch_all, fetch_one


# Horário comercial padrão
BUSINESS_START = "08:00"
BUSINESS_END = "18:00"


def get_available_rooms(
    date: str,
    start_time: str,
    end_time: str,
    resources: Optional[list[str]] = None,
) -> list[dict]:
    """
    Retorna salas que possuem pelo menos algum intervalo disponível
    dentro do período especificado, opcionalmente filtradas por recursos.

    Lógica:
    1. Busca todas as salas ativas
    2. Para cada sala, verifica se existe pelo menos um intervalo livre
       de no mínimo 15 minutos dentro do período solicitado
    3. Se recursos fornecidos, filtra apenas salas que possuem TODOS os recursos
    4. Ordena por nome alfabeticamente

    Args:
        date: Data no formato YYYY-MM-DD.
        start_time: Hora de início no formato HH:MM.
        end_time: Hora de fim no formato HH:MM.
        resources: Lista opcional de nomes de recursos desejados.

    Returns:
        Lista de salas com disponibilidade parcial ou total no período.
    """
    # Busca todas as salas ativas
    all_rooms = fetch_all(
        """
        SELECT s.id, s.name, s.capacity, s.location, s.is_active
        FROM salas s
        WHERE s.is_active = 1
        ORDER BY s.name
        """,
    )

    # Filtra salas que tenham pelo menos algum intervalo livre no período
    available_rooms = []
    for room in all_rooms:
        # Busca reservas ativas da sala na data que sobrepõem com o período
        reservations = fetch_all(
            """
            SELECT start_time, end_time
            FROM reservas
            WHERE room_id = ? AND date = ? AND status = 'active'
              AND start_time < ? AND end_time > ?
            ORDER BY start_time
            """,
            (room["id"], date, end_time, start_time),
        )

        # Se não há reservas no período, a sala está totalmente livre
        if not reservations:
            available_rooms.append(room)
            continue

        # Calcula se há pelo menos um gap de 15 min dentro do período solicitado
        has_free_slot = _has_free_slot_in_period(
            reservations, start_time, end_time, min_duration_minutes=15
        )
        if has_free_slot:
            available_rooms.append(room)

    # Filtra por recursos se fornecidos
    if resources and len(resources) > 0:
        available_rooms = _filter_by_resources(available_rooms, resources)

    # Adiciona recursos a cada sala
    for room in available_rooms:
        room["resources"] = _get_room_resources(room["id"])

    return available_rooms


def _has_free_slot_in_period(
    reservations: list[dict],
    period_start: str,
    period_end: str,
    min_duration_minutes: int = 15,
) -> bool:
    """
    Verifica se existe pelo menos um intervalo livre de min_duration_minutes
    dentro do período [period_start, period_end], considerando as reservas existentes.
    """
    current_start = period_start

    for reservation in reservations:
        res_start = reservation["start_time"]
        res_end = reservation["end_time"]

        # Ajusta para os limites do período
        effective_start = max(res_start, period_start)
        effective_end = min(res_end, period_end)

        if effective_start > period_end or effective_end < period_start:
            continue

        # Verifica gap antes desta reserva
        if current_start < effective_start:
            gap_minutes = _time_diff_minutes(current_start, effective_start)
            if gap_minutes >= min_duration_minutes:
                return True

        current_start = max(current_start, effective_end)

    # Verifica gap após a última reserva
    if current_start < period_end:
        gap_minutes = _time_diff_minutes(current_start, period_end)
        if gap_minutes >= min_duration_minutes:
            return True

    return False


def _time_diff_minutes(time1: str, time2: str) -> int:
    """Calcula a diferença em minutos entre duas horas no formato HH:MM."""
    h1, m1 = map(int, time1.split(":"))
    h2, m2 = map(int, time2.split(":"))
    return (h2 * 60 + m2) - (h1 * 60 + m1)


def _filter_by_resources(rooms: list[dict], resources: list[str]) -> list[dict]:
    """
    Filtra salas que possuem TODOS os recursos solicitados.
    A comparação é case-insensitive pelo nome do recurso.
    """
    filtered = []
    for room in rooms:
        room_resources = fetch_all(
            "SELECT LOWER(name) as name FROM recursos WHERE room_id = ?",
            (room["id"],),
        )
        room_resource_names = {r["name"] for r in room_resources}

        # Verifica se a sala possui todos os recursos solicitados
        requested = {r.lower() for r in resources}
        if requested.issubset(room_resource_names):
            filtered.append(room)

    return filtered


def get_room_schedule(room_id: int, date: str) -> Optional[dict]:
    """
    Retorna a agenda de uma sala para uma data específica:
    intervalos ocupados e intervalos disponíveis ao longo do dia todo (00:00–23:59).

    Args:
        room_id: ID da sala.
        date: Data no formato YYYY-MM-DD.

    Returns:
        Dicionário com 'occupied' e 'available', ou None se a sala não existir.
    """
    DAY_START = "00:00"
    DAY_END = "23:59"

    # Verifica se a sala existe e está ativa
    room = fetch_one(
        "SELECT id, name FROM salas WHERE id = ? AND is_active = 1",
        (room_id,),
    )
    if room is None:
        return None

    # Busca reservas ativas da sala na data
    reservations = fetch_all(
        """
        SELECT start_time, end_time
        FROM reservas
        WHERE room_id = ? AND date = ? AND status IN ('active', 'completed')
        ORDER BY start_time
        """,
        (room_id, date),
    )

    # Monta lista de ocupados (dia todo)
    occupied = [
        {"start_time": r["start_time"], "end_time": r["end_time"]}
        for r in reservations
    ]

    # Calcula intervalos disponíveis ao longo do dia todo
    available = _calculate_available_slots_for_range(reservations, DAY_START, DAY_END)

    return {
        "room_id": room_id,
        "room_name": room["name"],
        "date": date,
        "business_hours": {"start": BUSINESS_START, "end": BUSINESS_END},
        "occupied": occupied,
        "available": available,
    }


def _calculate_available_slots(reservations: list[dict]) -> list[dict]:
    """
    Calcula intervalos livres dentro do horário comercial (08:00-18:00).
    Mantida para uso interno de get_available_rooms.
    """
    return _calculate_available_slots_for_range(
        reservations, BUSINESS_START, BUSINESS_END
    )


def _calculate_available_slots_for_range(
    reservations: list[dict], range_start: str, range_end: str
) -> list[dict]:
    """
    Calcula intervalos livres dentro de um intervalo arbitrário [range_start, range_end].

    Algoritmo:
    1. Ordena reservas por hora de início
    2. Percorre as reservas calculando gaps entre elas
    3. Considera apenas o intervalo dentro do range especificado
    """
    available = []
    current_start = range_start

    for reservation in reservations:
        res_start = reservation["start_time"]
        res_end = reservation["end_time"]

        # Ignora reservas totalmente fora do range
        if res_end <= range_start or res_start >= range_end:
            continue

        # Ajusta para limites do range
        effective_start = max(res_start, range_start)
        effective_end = min(res_end, range_end)

        if current_start < effective_start:
            available.append(
                {
                    "start_time": current_start,
                    "end_time": effective_start,
                }
            )

        current_start = max(current_start, effective_end)

    if current_start < range_end:
        available.append(
            {
                "start_time": current_start,
                "end_time": range_end,
            }
        )

    return available


def _get_room_resources(room_id: int) -> list[dict]:
    """Retorna recursos da sala."""
    return fetch_all(
        "SELECT id, room_id, type, name, quantity FROM recursos WHERE room_id = ? ORDER BY type, name",
        (room_id,),
    )
