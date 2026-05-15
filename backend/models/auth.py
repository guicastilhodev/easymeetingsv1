"""Modelos Pydantic para autenticação."""

from typing import Optional

from pydantic import BaseModel, Field

from models.user import UserResponse


class LoginRequest(BaseModel):
    """Requisição de login."""

    login: str = Field(max_length=50)
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    """Resposta com token de autenticação."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ErrorResponse(BaseModel):
    """Resposta padronizada de erro."""

    detail: str
    error_code: str
    fields: Optional[list[str]] = None
