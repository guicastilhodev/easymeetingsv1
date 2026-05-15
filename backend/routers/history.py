"""
Router de histórico de reservas.
Endpoint para consulta de reservas passadas ou canceladas com filtros.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import get_current_user
from services.history_service import get_history


router = APIRouter(prefix="/api/history", tags=["Histórico"])


class HistoryItemResponse(BaseModel):
    """Resposta com dados de uma reserva no histórico."""

    id: int
    room_id: int
    room_name: str
    organizer_id: int
    organizer_name: str
    date: str
    start_time: str
    end_time: str
    status: str
    participants: list[str]


class HistoryResponse(BaseModel):
    """Resposta paginada do histórico."""

    data: list[HistoryItemResponse]
    page: int
    page_size: int


@router.get(
    "",
    response_model=HistoryResponse,
    responses={
        400: {"description": "Parâmetros inválidos (período inválido)"},
        401: {"description": "Não autenticado"},
    },
)
async def get_history_endpoint(
    page: int = Query(1, ge=1, description="Número da página"),
    start_date: Optional[str] = Query(
        None, description="Data início do filtro (YYYY-MM-DD)"
    ),
    end_date: Optional[str] = Query(
        None, description="Data fim do filtro (YYYY-MM-DD)"
    ),
    room_id: Optional[int] = Query(None, description="ID da sala para filtrar"),
    organizer_id: Optional[int] = Query(
        None, description="ID do organizador para filtrar (apenas admin)"
    ),
    current_user: dict = Depends(get_current_user),
):
    """
    Consulta o histórico de reservas (passadas ou canceladas).

    - Reservas cuja data/hora de fim seja anterior ao momento da consulta OU com status cancelada.
    - Ordenadas por data de início decrescente.
    - Paginação de 50 registros por página.
    - Filtros opcionais: período (max 365 dias), sala, organizador.
    - Responsável pelo Agendamento: vê apenas próprio histórico.
    - Administrador: vê todos, pode filtrar por organizador.
    """
    result = get_history(
        user_id=current_user["id"],
        user_role=current_user["role"],
        page=page,
        page_size=50,
        start_date=start_date,
        end_date=end_date,
        room_id=room_id,
        organizer_id=organizer_id,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return HistoryResponse(
        data=[
            HistoryItemResponse(
                id=r["id"],
                room_id=r["room_id"],
                room_name=r["room_name"],
                organizer_id=r["organizer_id"],
                organizer_name=r["organizer_name"],
                date=r["date"],
                start_time=r["start_time"],
                end_time=r["end_time"],
                status=r["status"],
                participants=r["participants"],
            )
            for r in result["data"]
        ],
        page=result["page"],
        page_size=result["page_size"],
    )
