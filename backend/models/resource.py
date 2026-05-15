"""Modelos Pydantic para recursos de salas."""

from pydantic import BaseModel, Field


class ResourceCreate(BaseModel):
    """Dados para criação de recurso."""

    type: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1, le=9999)


class ResourceResponse(BaseModel):
    """Resposta com dados do recurso."""

    id: int
    room_id: int
    type: str
    name: str
    quantity: int
