"""Modelos Pydantic para reservas."""

from typing import Optional

from pydantic import BaseModel, Field

from models.resource import ResourceResponse


class ReservationCreate(BaseModel):
    """Dados para criação de reserva."""

    room_id: int
    date: str  # formato YYYY-MM-DD
    start_time: str  # formato HH:MM
    end_time: str  # formato HH:MM
    participants: list[str] = Field(min_length=1, max_length=50)


class ReservationUpdate(BaseModel):
    """Dados para atualização de reserva."""

    room_id: Optional[int] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    participants: Optional[list[str]] = Field(None, min_length=1, max_length=50)


class ReservationResponse(BaseModel):
    """Resposta com dados da reserva."""

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
    room_resources: list[ResourceResponse]
