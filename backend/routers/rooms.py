"""
Router de salas de reunião.
Endpoints para CRUD de salas (criação, listagem, atualização e desativação),
consulta de disponibilidade e agenda.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user, require_admin
from models.room import RoomCreate, RoomResponse, RoomUpdate
from services.availability_service import get_available_rooms, get_room_schedule
from services.room_service import (
    create_room,
    deactivate_room,
    get_room_by_id,
    list_rooms,
    reactivate_room,
    update_room,
)

router = APIRouter(prefix="/api/rooms", tags=["Salas"])


@router.post(
    "",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"description": "Nome de sala já em uso"},
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
    },
)
async def create_room_endpoint(
    room_data: RoomCreate,
    current_user: dict = Depends(require_admin),
):
    """
    Cria uma nova sala de reunião.

    - Apenas administradores podem criar salas.
    - O nome deve ser único (comparação case-insensitive, ignorando espaços nas extremidades).
    - Capacidade deve estar entre 1 e 200.
    - Localização deve ter entre 1 e 200 caracteres.
    """
    result = create_room(
        name=room_data.name,
        capacity=room_data.capacity,
        location=room_data.location,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    room = result["room"]
    return RoomResponse(
        id=room["id"],
        name=room["name"],
        capacity=room["capacity"],
        location=room["location"],
        is_active=bool(room["is_active"]),
        resources=[],
    )


@router.get(
    "",
    response_model=list[RoomResponse],
    responses={
        401: {"description": "Não autenticado"},
    },
)
async def list_rooms_endpoint(
    include_inactive: bool = Query(False, description="Incluir salas inativas (admin)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Lista todas as salas com seus recursos.

    - Qualquer usuário autenticado pode listar salas.
    - Parâmetro include_inactive=true retorna também salas inativas (útil para gestão admin).
    - Retorna salas ordenadas por nome com recursos associados.
    """
    rooms = list_rooms(include_inactive=include_inactive)

    return [
        RoomResponse(
            id=room["id"],
            name=room["name"],
            capacity=room["capacity"],
            location=room["location"],
            is_active=bool(room["is_active"]),
            resources=room.get("resources", []),
        )
        for room in rooms
    ]


@router.get(
    "/available",
    response_model=list[RoomResponse],
    responses={
        400: {"description": "Período inválido"},
        401: {"description": "Não autenticado"},
    },
)
async def get_available_rooms_endpoint(
    date: str = Query(..., description="Data no formato YYYY-MM-DD"),
    start_time: str = Query(..., description="Hora de início no formato HH:MM"),
    end_time: str = Query(..., description="Hora de fim no formato HH:MM"),
    resources: Optional[list[str]] = Query(
        None, description="Nomes de recursos desejados"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Consulta salas disponíveis para um período específico.

    - Qualquer usuário autenticado pode consultar disponibilidade.
    - Retorna salas sem conflito no período E com todos os recursos solicitados.
    - Ordenadas por nome em ordem alfabética.
    """
    from services.reservation_service import _parse_date, _parse_time

    # Valida formato de data
    parsed_date = _parse_date(date)
    if parsed_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use YYYY-MM-DD.",
        )

    # Valida formato de hora
    parsed_start = _parse_time(start_time)
    parsed_end = _parse_time(end_time)

    if parsed_start is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de hora de início inválido. Use HH:MM.",
        )

    if parsed_end is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de hora de fim inválido. Use HH:MM.",
        )

    # Valida hora_fim > hora_início
    if parsed_end <= parsed_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hora de fim deve ser posterior à hora de início.",
        )

    rooms = get_available_rooms(
        date=date,
        start_time=start_time,
        end_time=end_time,
        resources=resources,
    )

    return [
        RoomResponse(
            id=room["id"],
            name=room["name"],
            capacity=room["capacity"],
            location=room["location"],
            is_active=bool(room["is_active"]),
            resources=room.get("resources", []),
        )
        for room in rooms
    ]


@router.get(
    "/{room_id}/schedule",
    responses={
        401: {"description": "Não autenticado"},
        404: {"description": "Sala não encontrada"},
    },
)
async def get_room_schedule_endpoint(
    room_id: int,
    date: str = Query(..., description="Data no formato YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    """
    Retorna a agenda de uma sala para uma data específica.

    - Qualquer usuário autenticado pode consultar a agenda.
    - Retorna intervalos ocupados e disponíveis dentro do horário comercial (08:00-18:00).
    """
    from services.reservation_service import _parse_date

    # Valida formato de data
    parsed_date = _parse_date(date)
    if parsed_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use YYYY-MM-DD.",
        )

    schedule = get_room_schedule(room_id=room_id, date=date)

    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sala não encontrada.",
        )

    return schedule


@router.get(
    "/{room_id}",
    response_model=RoomResponse,
    responses={
        401: {"description": "Não autenticado"},
        404: {"description": "Sala não encontrada"},
    },
)
async def get_room_endpoint(
    room_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Obtém os dados de uma sala pelo ID.

    - Qualquer usuário autenticado pode consultar uma sala.
    - Retorna 404 se a sala não existir ou estiver inativa.
    """
    room = get_room_by_id(room_id)

    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sala não encontrada.",
        )

    return RoomResponse(
        id=room["id"],
        name=room["name"],
        capacity=room["capacity"],
        location=room["location"],
        is_active=bool(room["is_active"]),
        resources=room.get("resources", []),
    )


@router.put(
    "/{room_id}",
    response_model=RoomResponse,
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        404: {"description": "Sala não encontrada"},
        409: {"description": "Nome de sala já em uso"},
    },
)
async def update_room_endpoint(
    room_id: int,
    room_data: RoomUpdate,
    current_user: dict = Depends(require_admin),
):
    """
    Atualiza os dados de uma sala existente.

    - Apenas administradores podem atualizar salas.
    - Mesmas regras de validação do cadastro se aplicam.
    - Retorna 404 se a sala não existir ou estiver inativa.
    - Retorna 409 se o novo nome já estiver em uso.
    """
    result = update_room(
        room_id=room_id,
        name=room_data.name,
        capacity=room_data.capacity,
        location=room_data.location,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    room = result["room"]
    return RoomResponse(
        id=room["id"],
        name=room["name"],
        capacity=room["capacity"],
        location=room["location"],
        is_active=bool(room["is_active"]),
        resources=room.get("resources", []),
    )


@router.delete(
    "/{room_id}",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        404: {"description": "Sala não encontrada"},
    },
)
async def delete_room_endpoint(
    room_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Desativa uma sala (soft delete).

    - Apenas administradores podem desativar salas.
    - A sala é marcada como inativa (is_active=0).
    - Todas as reservas futuras ativas da sala são canceladas.
    - Retorna 404 se a sala não existir ou já estiver inativa.
    """
    result = deactivate_room(room_id)

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return {
        "detail": "Sala desativada com sucesso.",
        "cancelled_reservations": result["cancelled_reservations"],
    }


@router.patch(
    "/{room_id}/reactivate",
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Sala já está ativa"},
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        404: {"description": "Sala não encontrada"},
    },
)
async def reactivate_room_endpoint(
    room_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Reativa uma sala previamente desativada.

    - Apenas administradores podem reativar salas.
    - A sala volta a ficar disponível para novas reservas.
    """
    result = reactivate_room(room_id)

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return RoomResponse(
        id=result["room"]["id"],
        name=result["room"]["name"],
        capacity=result["room"]["capacity"],
        location=result["room"]["location"],
        is_active=bool(result["room"]["is_active"]),
        resources=result["room"].get("resources", []),
    )
