"""
Módulo de autenticação e autorização.
Fornece funções para criação/validação de tokens JWT e dependencies do FastAPI
para controle de acesso por perfil.
"""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import fetch_one

# Configuração JWT — chave secreta fixa para POC
JWT_SECRET_KEY = "easymeetings"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60

# Esquema de segurança Bearer para extração do token do header Authorization
security_scheme = HTTPBearer()


def create_access_token(user_id: int, login: str, role: str) -> str:
    """
    Cria um token JWT com os dados do usuário.

    Args:
        user_id: ID do usuário no banco de dados.
        login: Login do usuário.
        role: Perfil do usuário ('admin' ou 'scheduler').

    Returns:
        Token JWT codificado como string.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "login": login,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRATION_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decodifica e valida um token JWT.

    Args:
        token: Token JWT como string.

    Returns:
        Dicionário com os dados do payload (sub, login, role, iat, exp).

    Raises:
        HTTPException 401: Se o token for inválido ou estiver expirado.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Faça login novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    """
    Dependency do FastAPI que extrai e valida o JWT do header Authorization.
    Retorna os dados do usuário autenticado consultando o banco de dados.

    Raises:
        HTTPException 401: Se o token for inválido, expirado, ou o usuário não existir/estiver inativo.
    """
    payload = decode_access_token(credentials.credentials)

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Consulta o usuário no banco para garantir que ainda existe e está ativo
    user = fetch_one(
        "SELECT id, name, login, role, is_active FROM usuarios WHERE id = ?",
        (int(user_id),),
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário desativado. Contate o administrador.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency do FastAPI que verifica se o usuário autenticado possui perfil Administrador.
    Deve ser usado em rotas restritas a administradores.

    Returns:
        Dados do usuário autenticado (se for admin).

    Raises:
        HTTPException 403: Se o usuário não for Administrador.
    """
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Permissão de administrador necessária.",
        )
    return current_user
