"""
Router de gestão de usuários.
Endpoints para CRUD de usuários (acesso restrito a administradores).
"""

from fastapi import APIRouter, Depends, HTTPException, status

from auth import require_admin
from models.user import UserCreate, UserResponse, UserUpdate
from services.user_service import (
    create_user,
    deactivate_user,
    get_user_by_id,
    list_users,
    reactivate_user,
    update_user,
)

router = APIRouter(prefix="/api/users", tags=["Usuários"])


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        409: {"description": "Login já em uso"},
        422: {"description": "Dados de entrada inválidos"},
    },
)
async def create_user_endpoint(
    request: UserCreate,
    current_user: dict = Depends(require_admin),
):
    """
    Cria um novo usuário no sistema.

    - Apenas administradores podem criar usuários
    - Login deve ser único
    - Senha é armazenada com hash bcrypt
    """
    result = create_user(
        name=request.name,
        login=request.login,
        password=request.password,
        role=request.role,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return UserResponse(**result["user"])


@router.get(
    "",
    response_model=list[UserResponse],
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
    },
)
async def list_users_endpoint(
    current_user: dict = Depends(require_admin),
):
    """
    Lista todos os usuários cadastrados.

    - Apenas administradores podem listar usuários
    - Retorna id, nome, login, perfil e status de cada usuário
    """
    users = list_users()
    return [UserResponse(**user) for user in users]


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        404: {"description": "Usuário não encontrado"},
    },
)
async def get_user_endpoint(
    user_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Obtém os dados de um usuário pelo ID.

    - Apenas administradores podem consultar usuários
    """
    user = get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )

    return UserResponse(**user)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        404: {"description": "Usuário não encontrado ou inativo"},
        409: {"description": "Último administrador não pode ser rebaixado"},
        422: {"description": "Dados de entrada inválidos"},
    },
)
async def update_user_endpoint(
    user_id: int,
    request: UserUpdate,
    current_user: dict = Depends(require_admin),
):
    """
    Atualiza os dados de um usuário existente.

    - Apenas administradores podem atualizar usuários
    - Pode atualizar nome, senha e/ou perfil
    - Não é possível rebaixar o último administrador ativo
    """
    result = update_user(
        user_id=user_id,
        name=request.name,
        password=request.password,
        role=request.role,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return UserResponse(**result["user"])


@router.patch(
    "/{user_id}/deactivate",
    response_model=UserResponse,
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        404: {"description": "Usuário não encontrado"},
        409: {"description": "Último administrador não pode ser desativado"},
    },
)
async def deactivate_user_endpoint(
    user_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Desativa um usuário (soft delete).

    - Apenas administradores podem desativar usuários
    - Usuário desativado não pode mais autenticar
    - Não é possível desativar o último administrador ativo
    """
    result = deactivate_user(user_id)

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return UserResponse(**result["user"])


@router.patch(
    "/{user_id}/reactivate",
    response_model=UserResponse,
    responses={
        400: {"description": "Usuário já está ativo"},
        401: {"description": "Não autenticado"},
        403: {"description": "Permissão insuficiente"},
        404: {"description": "Usuário não encontrado"},
    },
)
async def reactivate_user_endpoint(
    user_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Reativa um usuário previamente desativado.

    - Apenas administradores podem reativar usuários.
    - O usuário volta a poder autenticar no sistema.
    """
    result = reactivate_user(user_id)

    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"],
            detail=result["error"],
        )

    return UserResponse(**result["user"])
