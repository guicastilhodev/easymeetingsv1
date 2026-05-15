"""
Serviço de salas de reunião.
Responsável pelo CRUD de salas, validação de nome único (case-insensitive, trim)
e soft delete com cancelamento de reservas futuras.
"""

from typing import Optional

from database import execute, fetch_all, fetch_one


def check_name_uniqueness(name: str, exclude_id: Optional[int] = None) -> bool:
    """
    Verifica se já existe uma sala com o mesmo nome (case-insensitive, trim).
    Retorna True se o nome já está em uso por outra sala ativa.
    """
    trimmed_name = name.strip()
    if exclude_id:
        existing = fetch_one(
            "SELECT id FROM salas WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ? AND is_active = 1",
            (trimmed_name, exclude_id),
        )
    else:
        existing = fetch_one(
            "SELECT id FROM salas WHERE LOWER(TRIM(name)) = LOWER(?) AND is_active = 1",
            (trimmed_name,),
        )
    return existing is not None


def create_room(name: str, capacity: int, location: str) -> dict:
    """
    Cria uma nova sala de reunião.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - room: Dados da sala criada (se sucesso)
        - error: Mensagem de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    trimmed_name = name.strip()

    # Verifica unicidade do nome
    if check_name_uniqueness(trimmed_name):
        return {
            "success": False,
            "error": "Já existe uma sala com este nome.",
            "error_code": "ROOM_NAME_DUPLICATE",
            "status_code": 409,
        }

    # Insere a sala no banco
    room_id = execute(
        "INSERT INTO salas (name, capacity, location) VALUES (?, ?, ?)",
        (trimmed_name, capacity, location),
    )

    # Busca a sala criada
    room = fetch_one(
        "SELECT id, name, capacity, location, is_active FROM salas WHERE id = ?",
        (room_id,),
    )

    return {
        "success": True,
        "room": room,
        "status_code": 201,
    }


def list_rooms(include_inactive: bool = False) -> list[dict]:
    """
    Retorna salas com seus recursos associados.
    Se include_inactive=True, retorna todas as salas (ativas e inativas).
    """
    if include_inactive:
        rooms = fetch_all(
            "SELECT id, name, capacity, location, is_active FROM salas ORDER BY name"
        )
    else:
        rooms = fetch_all(
            "SELECT id, name, capacity, location, is_active FROM salas WHERE is_active = 1 ORDER BY name"
        )

    # Para cada sala, busca os recursos associados
    for room in rooms:
        resources = fetch_all(
            "SELECT id, room_id, type, name, quantity FROM recursos WHERE room_id = ? ORDER BY type, name",
            (room["id"],),
        )
        room["resources"] = resources

    return rooms


def get_room_by_id(room_id: int) -> Optional[dict]:
    """
    Retorna uma sala pelo ID, incluindo seus recursos.
    Retorna None se a sala não existir ou estiver inativa.
    """
    room = fetch_one(
        "SELECT id, name, capacity, location, is_active FROM salas WHERE id = ? AND is_active = 1",
        (room_id,),
    )

    if room is None:
        return None

    # Busca recursos da sala
    resources = fetch_all(
        "SELECT id, room_id, type, name, quantity FROM recursos WHERE room_id = ? ORDER BY type, name",
        (room["id"],),
    )
    room["resources"] = resources

    return room


def update_room(
    room_id: int,
    name: Optional[str] = None,
    capacity: Optional[int] = None,
    location: Optional[str] = None,
) -> dict:
    """
    Atualiza os dados de uma sala existente.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - room: Dados da sala atualizada (se sucesso)
        - error: Mensagem de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    # Verifica se a sala existe e está ativa
    existing = fetch_one(
        "SELECT id, name, capacity, location, is_active FROM salas WHERE id = ? AND is_active = 1",
        (room_id,),
    )

    if existing is None:
        return {
            "success": False,
            "error": "Sala não encontrada.",
            "error_code": "ROOM_NOT_FOUND",
            "status_code": 404,
        }

    # Verifica unicidade do nome se estiver sendo atualizado
    if name is not None:
        trimmed_name = name.strip()
        if check_name_uniqueness(trimmed_name, exclude_id=room_id):
            return {
                "success": False,
                "error": "Já existe uma sala com este nome.",
                "error_code": "ROOM_NAME_DUPLICATE",
                "status_code": 409,
            }

    # Monta a query de atualização dinamicamente
    updates = []
    params = []

    if name is not None:
        updates.append("name = ?")
        params.append(name.strip())
    if capacity is not None:
        updates.append("capacity = ?")
        params.append(capacity)
    if location is not None:
        updates.append("location = ?")
        params.append(location)

    if not updates:
        # Nenhum campo para atualizar, retorna a sala atual
        room = get_room_by_id(room_id)
        return {
            "success": True,
            "room": room,
            "status_code": 200,
        }

    updates.append("updated_at = datetime('now')")
    params.append(room_id)

    query = f"UPDATE salas SET {', '.join(updates)} WHERE id = ?"
    execute(query, tuple(params))

    # Retorna a sala atualizada
    room = get_room_by_id(room_id)

    return {
        "success": True,
        "room": room,
        "status_code": 200,
    }


def deactivate_room(room_id: int) -> dict:
    """
    Desativa uma sala (soft delete) e cancela todas as reservas futuras ativas.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - error: Mensagem de erro (se falha)
        - status_code: Código HTTP sugerido
        - cancelled_reservations: Número de reservas canceladas
    """
    # Verifica se a sala existe e está ativa
    existing = fetch_one(
        "SELECT id, name, capacity, location, is_active FROM salas WHERE id = ? AND is_active = 1",
        (room_id,),
    )

    if existing is None:
        return {
            "success": False,
            "error": "Sala não encontrada.",
            "error_code": "ROOM_NOT_FOUND",
            "status_code": 404,
        }

    # Cancela todas as reservas futuras ativas da sala
    cancelled_count = execute(
        "UPDATE reservas SET status = 'cancelled', updated_at = datetime('now') WHERE room_id = ? AND date >= date('now') AND status = 'active'",
        (room_id,),
    )

    # Desativa a sala
    execute(
        "UPDATE salas SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
        (room_id,),
    )

    return {
        "success": True,
        "status_code": 200,
        "cancelled_reservations": cancelled_count,
    }


def reactivate_room(room_id: int) -> dict:
    """
    Reativa uma sala previamente desativada.

    Returns:
        Dicionário com resultado da operação.
    """
    existing = fetch_one(
        "SELECT id, name, is_active FROM salas WHERE id = ?",
        (room_id,),
    )

    if existing is None:
        return {
            "success": False,
            "error": "Sala não encontrada.",
            "error_code": "ROOM_NOT_FOUND",
            "status_code": 404,
        }

    if existing["is_active"]:
        return {
            "success": False,
            "error": "Sala já está ativa.",
            "error_code": "ROOM_ALREADY_ACTIVE",
            "status_code": 400,
        }

    execute(
        "UPDATE salas SET is_active = 1, updated_at = datetime('now') WHERE id = ?",
        (room_id,),
    )

    room = get_room_by_id(room_id)

    return {
        "success": True,
        "room": room,
        "status_code": 200,
    }
