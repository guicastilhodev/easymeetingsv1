"""Modelos Pydantic para usuários."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """Dados para criação de usuário."""

    name: str = Field(min_length=1, max_length=100)
    login: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["admin", "scheduler"]


class UserUpdate(BaseModel):
    """Dados para atualização de usuário."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    role: Optional[Literal["admin", "scheduler"]] = None


class UserResponse(BaseModel):
    """Resposta com dados do usuário."""

    id: int
    name: str
    login: str
    role: str
    is_active: bool
