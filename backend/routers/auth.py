"""
Router de autenticação.
Endpoints para login e logout de usuários.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from models.auth import ErrorResponse, LoginRequest, TokenResponse
from services.auth_service import authenticate

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Credenciais inválidas"},
        422: {"description": "Dados de entrada inválidos"},
        429: {"model": ErrorResponse, "description": "Conta bloqueada"},
    },
)
async def login(request: LoginRequest):
    """
    Autentica um usuário com login e senha.

    - Retorna token JWT em caso de sucesso
    - Retorna erro genérico para credenciais inválidas (sem revelar qual campo está incorreto)
    - Bloqueia a conta após 5 tentativas consecutivas por 15 minutos
    """
    # Validação de campos obrigatórios (login não pode ser vazio)
    if not request.login or not request.login.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Campo 'login' é obrigatório",
        )

    if not request.password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Campo 'senha' é obrigatório",
        )

    result = authenticate(login=request.login, password=request.password)

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return TokenResponse(
        access_token=result["token"],
        token_type="bearer",
        user=result["user"],
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Não autenticado"},
    },
)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Invalida a sessão do usuário.

    Para este POC com JWT stateless, apenas retorna sucesso.
    O frontend deve remover o token do localStorage.
    """
    return {"detail": "Logout realizado com sucesso"}
