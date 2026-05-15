"""
Serviço de autenticação.
Responsável pela validação de credenciais, controle de tentativas falhas
e geração de tokens JWT.
"""

from datetime import datetime, timezone

import bcrypt

from auth import create_access_token
from database import execute, fetch_one


# Constantes de controle de tentativas
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica se a senha em texto plano corresponde ao hash bcrypt."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def is_account_locked(user: dict) -> bool:
    """
    Verifica se a conta do usuário está bloqueada.
    Retorna True se locked_until estiver definido e ainda não expirou.
    """
    locked_until = user.get("locked_until")
    if not locked_until:
        return False

    lock_time = datetime.fromisoformat(locked_until).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return now < lock_time


def increment_failed_attempts(user_id: int, current_attempts: int) -> None:
    """
    Incrementa o contador de tentativas falhas.
    Se atingir o limite, define locked_until para 15 minutos no futuro.
    """
    new_attempts = current_attempts + 1

    if new_attempts >= MAX_FAILED_ATTEMPTS:
        lock_until = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
        # Calcula o horário de desbloqueio
        from datetime import timedelta

        lock_until_dt = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        lock_until = lock_until_dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")

        execute(
            "UPDATE usuarios SET failed_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?",
            (new_attempts, lock_until, user_id),
        )
    else:
        execute(
            "UPDATE usuarios SET failed_attempts = ?, updated_at = datetime('now') WHERE id = ?",
            (new_attempts, user_id),
        )


def reset_failed_attempts(user_id: int) -> None:
    """Reseta o contador de tentativas falhas e remove o bloqueio."""
    execute(
        "UPDATE usuarios SET failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?",
        (user_id,),
    )


def authenticate(login: str, password: str) -> dict:
    """
    Autentica um usuário com login e senha.

    Returns:
        Dicionário com resultado da autenticação:
        - success: True/False
        - token: Token JWT (se sucesso)
        - user: Dados do usuário (se sucesso)
        - error: Mensagem de erro (se falha)
        - error_code: Código de erro (se falha)
        - status_code: Código HTTP sugerido

    Regras:
    - Mensagem genérica para credenciais inválidas (não revela qual campo está errado)
    - Bloqueio após 5 tentativas consecutivas por 15 minutos
    - Reset de tentativas após login bem-sucedido
    """
    # Busca usuário pelo login
    user = fetch_one(
        "SELECT id, name, login, password_hash, role, is_active, failed_attempts, locked_until FROM usuarios WHERE login = ?",
        (login,),
    )

    # Usuário não encontrado — retorna erro genérico
    if not user:
        return {
            "success": False,
            "error": "Credenciais inválidas",
            "error_code": "AUTH_INVALID_CREDENTIALS",
            "status_code": 401,
        }

    # Verifica se a conta está bloqueada
    if is_account_locked(user):
        return {
            "success": False,
            "error": "Conta temporariamente bloqueada. Tente novamente em 15 minutos.",
            "error_code": "AUTH_ACCOUNT_LOCKED",
            "status_code": 429,
        }

    # Verifica se o usuário está ativo
    if not user["is_active"]:
        return {
            "success": False,
            "error": "Credenciais inválidas",
            "error_code": "AUTH_INVALID_CREDENTIALS",
            "status_code": 401,
        }

    # Verifica a senha
    if not verify_password(password, user["password_hash"]):
        increment_failed_attempts(user["id"], user["failed_attempts"])
        return {
            "success": False,
            "error": "Credenciais inválidas",
            "error_code": "AUTH_INVALID_CREDENTIALS",
            "status_code": 401,
        }

    # Login bem-sucedido — reseta tentativas e gera token
    reset_failed_attempts(user["id"])

    token = create_access_token(
        user_id=user["id"],
        login=user["login"],
        role=user["role"],
    )

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "login": user["login"],
            "role": user["role"],
            "is_active": bool(user["is_active"]),
        },
        "status_code": 200,
    }
