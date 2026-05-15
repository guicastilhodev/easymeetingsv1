"""
Router de recursos de salas.
Endpoints para CRUD de recursos vinculados a salas de reunião.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user, require_admin
from models.resource import ResourceCreate, ResourceResponse
from services.resource_service import (
    create_resource,
    delete_resource,
    get_active_room,
    get_resource_for_room,
    list_resources,
    update_resource,
)

router = APIRouter(prefix="/api/rooms/{room_id}/resources", tags=["Recursos"])


def _validate_room_exists(room_id: int) -> None:
    """Valida que a sala existe e está ativa. Levanta 404 se não encontrada."""
    room = get_active_room(room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sala não encontrada.",
        )


def _validate_resource_exists(resource_id: int, room_id: int) -> dict:
    """Valida que o recurso existe para a sala. Levanta 404 se não encontrado."""
    resource = get_resource_for_room(resource_id, room_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurso não encontrado.",
        )
    return resource


@router.post(
    "",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"description": "Sala não encontrada"},
        409: {"description": "Recurso duplicado (tipo+nome)"},
    },
)
async def add_resource(
    room_id: int,
    request: ResourceCreate,
    current_user: dict = Depends(require_admin),
):
    """
    Adiciona um recurso a uma sala (somente Administrador).

    Validações:
    - Sala deve existir e estar ativa
    - Tipo: 1 a 100 caracteres
    - Nome: 1 a 100 caracteres
    - Quantidade: 1 a 9999
    - Tipo+nome deve ser único na sala
    """
    _validate_room_exists(room_id)

    result = create_resource(
        room_id=room_id,
        resource_type=request.type,
        name=request.name,
        quantity=request.quantity,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return ResourceResponse(**result["resource"])


@router.get(
    "",
    response_model=list[ResourceResponse],
    responses={
        404: {"description": "Sala não encontrada"},
    },
)
async def get_resources(
    room_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Lista todos os recursos de uma sala (qualquer usuário autenticado).

    Retorna recursos ordenados por tipo e nome.
    """
    _validate_room_exists(room_id)

    resources = list_resources(room_id)
    return [ResourceResponse(**r) for r in resources]


@router.put(
    "/{resource_id}",
    response_model=ResourceResponse,
    responses={
        404: {"description": "Sala ou recurso não encontrado"},
        409: {"description": "Recurso duplicado (tipo+nome)"},
    },
)
async def update_resource_endpoint(
    room_id: int,
    resource_id: int,
    request: ResourceCreate,
    current_user: dict = Depends(require_admin),
):
    """
    Atualiza um recurso de uma sala (somente Administrador).

    Validações:
    - Sala deve existir e estar ativa
    - Recurso deve existir e pertencer à sala
    - Tipo+nome deve ser único na sala (exceto o próprio recurso)
    """
    _validate_room_exists(room_id)
    _validate_resource_exists(resource_id, room_id)

    result = update_resource(
        resource_id=resource_id,
        room_id=room_id,
        resource_type=request.type,
        name=request.name,
        quantity=request.quantity,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return ResourceResponse(**result["resource"])


@router.delete(
    "/{resource_id}",
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Sala ou recurso não encontrado"},
    },
)
async def remove_resource(
    room_id: int,
    resource_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Remove um recurso de uma sala (somente Administrador).

    Validações:
    - Sala deve existir e estar ativa
    - Recurso deve existir e pertencer à sala
    """
    _validate_room_exists(room_id)
    _validate_resource_exists(resource_id, room_id)

    delete_resource(resource_id=resource_id, room_id=room_id)

    return {"detail": "Recurso removido com sucesso."}
