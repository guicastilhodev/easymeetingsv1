"""
Router de reservas de salas.
Endpoints para criação, listagem, edição e cancelamento de reservas.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import get_current_user
from models.reservation import (
    ReservationCreate,
    ReservationResponse,
    ReservationUpdate,
)
from models.resource import ResourceResponse
from services.reservation_service import (
    cancel_reservation,
    create_reservation,
    get_reservation_by_id,
    list_reservations,
    update_reservation,
)

router = APIRouter(prefix="/api/reservations", tags=["Reservas"])


@router.post(
    "",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "Dados inválidos"},
        401: {"description": "Não autenticado"},
        404: {"description": "Sala não encontrada"},
        409: {"description": "Conflito de horário"},
    },
)
async def create_reservation_endpoint(
    reservation_data: ReservationCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Cria uma nova reserva de sala.

    - Qualquer usuário autenticado pode criar reservas.
    - Verifica disponibilidade da sala no período solicitado.
    - Duração mínima de 15 minutos.
    - De 1 a 50 participantes.
    - O usuário autenticado é registrado como organizador.
    """
    result = create_reservation(
        room_id=reservation_data.room_id,
        date=reservation_data.date,
        start_time=reservation_data.start_time,
        end_time=reservation_data.end_time,
        participants=reservation_data.participants,
        organizer_id=current_user["id"],
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return _build_reservation_response(result["reservation"])


@router.get(
    "",
    response_model=list[ReservationResponse],
    responses={
        401: {"description": "Não autenticado"},
    },
)
async def list_reservations_endpoint(
    page: int = Query(1, ge=1, description="Número da página"),
    current_user: dict = Depends(get_current_user),
):
    """
    Lista reservas com visibilidade por perfil.

    - Administrador: vê todas as reservas do sistema.
    - Responsável pelo Agendamento: vê apenas suas próprias reservas.
    - Paginação de 50 reservas por página, ordenadas por data e hora de início.
    """
    reservations = list_reservations(
        user_id=current_user["id"],
        user_role=current_user["role"],
        page=page,
        page_size=50,
    )

    return [_build_reservation_response(r) for r in reservations]


@router.get(
    "/{reservation_id}",
    response_model=ReservationResponse,
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Sem permissão para visualizar esta reserva"},
        404: {"description": "Reserva não encontrada"},
    },
)
async def get_reservation_endpoint(
    reservation_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Obtém os detalhes de uma reserva específica.

    - Administrador: pode visualizar qualquer reserva.
    - Responsável pelo Agendamento: pode visualizar apenas suas próprias reservas.
    """
    reservation = get_reservation_by_id(reservation_id)

    if reservation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva não encontrada.",
        )

    # Controle de acesso: scheduler só vê suas próprias reservas
    if (
        current_user["role"] != "admin"
        and reservation["organizer_id"] != current_user["id"]
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para visualizar esta reserva.",
        )

    return _build_reservation_response(reservation)


@router.put(
    "/{reservation_id}",
    response_model=ReservationResponse,
    responses={
        400: {"description": "Dados inválidos"},
        401: {"description": "Não autenticado"},
        403: {"description": "Apenas o organizador pode modificar a reserva"},
        404: {"description": "Reserva não encontrada"},
        409: {"description": "Conflito de horário"},
    },
)
async def update_reservation_endpoint(
    reservation_id: int,
    reservation_data: ReservationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Edita uma reserva existente.

    - Apenas o organizador pode editar a reserva.
    - Verifica disponibilidade do novo período (excluindo a própria reserva).
    - Mesmas regras de validação da criação se aplicam.
    """
    result = update_reservation(
        reservation_id=reservation_id,
        organizer_id=current_user["id"],
        room_id=reservation_data.room_id,
        date=reservation_data.date,
        start_time=reservation_data.start_time,
        end_time=reservation_data.end_time,
        participants=reservation_data.participants,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return _build_reservation_response(result["reservation"])


@router.patch(
    "/{reservation_id}/cancel",
    responses={
        200: {"description": "Reserva cancelada com sucesso"},
        400: {"description": "Reserva já cancelada"},
        401: {"description": "Não autenticado"},
        403: {"description": "Apenas o organizador pode cancelar a reserva"},
        404: {"description": "Reserva não encontrada"},
    },
)
async def cancel_reservation_endpoint(
    reservation_id: int,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancela uma reserva existente.

    - Apenas o organizador pode cancelar a reserva.
    - A reserva é marcada como cancelada e o horário é liberado.
    """
    result = cancel_reservation(
        reservation_id=reservation_id,
        user_id=current_user["id"],
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return {"detail": result["detail"]}


def _build_reservation_response(reservation: dict) -> ReservationResponse:
    """Constrói o modelo de resposta a partir do dicionário da reserva."""
    return ReservationResponse(
        id=reservation["id"],
        room_id=reservation["room_id"],
        room_name=reservation["room_name"],
        organizer_id=reservation["organizer_id"],
        organizer_name=reservation["organizer_name"],
        date=reservation["date"],
        start_time=reservation["start_time"],
        end_time=reservation["end_time"],
        status=reservation["status"],
        participants=reservation["participants"],
        room_resources=[
            ResourceResponse(
                id=r["id"],
                room_id=r["room_id"],
                type=r["type"],
                name=r["name"],
                quantity=r["quantity"],
            )
            for r in reservation["room_resources"]
        ],
    )
