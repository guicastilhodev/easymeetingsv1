"""
Serviço de gestão de recursos de salas.
Responsável pelo CRUD de recursos, validação de duplicidade tipo+nome por sala
e verificação de existência da sala.
"""

import sqlite3
from typing import Optional

from database import execute, fetch_all, fetch_one


def get_active_room(room_id: int) -> Optional[dict]:
    """
    Busca uma sala ativa pelo ID.
    Retorna None se a sala não existir ou estiver inativa.
    """
    return fetch_one(
        "SELECT id, name, capacity, location, is_active FROM salas WHERE id = ? AND is_active = 1",
        (room_id,),
    )


def get_resource_for_room(resource_id: int, room_id: int) -> Optional[dict]:
    """
    Busca um recurso pelo ID, garantindo que pertence à sala especificada.
    Retorna None se o recurso não existir ou não pertencer à sala.
    """
    return fetch_one(
        "SELECT id, room_id, type, name, quantity FROM recursos WHERE id = ? AND room_id = ?",
        (resource_id, room_id),
    )


def list_resources(room_id: int) -> list[dict]:
    """
    Lista todos os recursos de uma sala, ordenados por tipo e nome.
    """
    return fetch_all(
        "SELECT id, room_id, type, name, quantity FROM recursos WHERE room_id = ? ORDER BY type, name",
        (room_id,),
    )


def create_resource(room_id: int, resource_type: str, name: str, quantity: int) -> dict:
    """
    Cria um novo recurso vinculado a uma sala.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - resource: Dados do recurso criado (se sucesso)
        - error: Mensagem de erro (se falha)
        - error_code: Código de erro (se falha)
        - status_code: Código HTTP sugerido

    Raises:
        Conflito 409 se já existir recurso com mesmo tipo+nome na sala.
    """
    try:
        resource_id = execute(
            "INSERT INTO recursos (room_id, type, name, quantity) VALUES (?, ?, ?, ?)",
            (room_id, resource_type, name, quantity),
        )
    except sqlite3.IntegrityError:
        return {
            "success": False,
            "error": "Já existe um recurso com este tipo e nome nesta sala.",
            "error_code": "RESOURCE_DUPLICATE",
            "status_code": 409,
        }

    resource = fetch_one(
        "SELECT id, room_id, type, name, quantity FROM recursos WHERE id = ?",
        (resource_id,),
    )

    return {
        "success": True,
        "resource": resource,
        "status_code": 201,
    }


def update_resource(
    resource_id: int, room_id: int, resource_type: str, name: str, quantity: int
) -> dict:
    """
    Atualiza um recurso existente.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - resource: Dados do recurso atualizado (se sucesso)
        - error: Mensagem de erro (se falha)
        - error_code: Código de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    try:
        execute(
            "UPDATE recursos SET type = ?, name = ?, quantity = ? WHERE id = ? AND room_id = ?",
            (resource_type, name, quantity, resource_id, room_id),
        )
    except sqlite3.IntegrityError:
        return {
            "success": False,
            "error": "Já existe um recurso com este tipo e nome nesta sala.",
            "error_code": "RESOURCE_DUPLICATE",
            "status_code": 409,
        }

    resource = fetch_one(
        "SELECT id, room_id, type, name, quantity FROM recursos WHERE id = ?",
        (resource_id,),
    )

    return {
        "success": True,
        "resource": resource,
        "status_code": 200,
    }


def delete_resource(resource_id: int, room_id: int) -> dict:
    """
    Remove um recurso de uma sala.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - status_code: Código HTTP sugerido
    """
    execute(
        "DELETE FROM recursos WHERE id = ? AND room_id = ?",
        (resource_id, room_id),
    )

    return {
        "success": True,
        "status_code": 200,
    }
