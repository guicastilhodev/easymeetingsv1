"""Modelos Pydantic para salas de reunião."""

from typing import Optional

from pydantic import BaseModel, Field

from models.resource import ResourceResponse


class RoomCreate(BaseModel):
    """Dados para criação de sala."""

    name: str = Field(min_length=1, max_length=100)
    capacity: int = Field(ge=1, le=200)
    location: str = Field(min_length=1, max_length=200)


class RoomUpdate(BaseModel):
    """Dados para atualização de sala."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    capacity: Optional[int] = Field(None, ge=1, le=200)
    location: Optional[str] = Field(None, min_length=1, max_length=200)


class RoomResponse(BaseModel):
    """Resposta com dados da sala."""

    id: int
    name: str
    capacity: int
    location: str
    is_active: bool
    resources: list[ResourceResponse] = []
