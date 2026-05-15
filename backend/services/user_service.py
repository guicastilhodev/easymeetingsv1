"""
Serviço de gestão de usuários.
Responsável pelo CRUD de usuários, validação de unicidade de login,
hash de senha com bcrypt e proteção do último administrador ativo.
"""

import bcrypt

from database import execute, fetch_all, fetch_one


def hash_password(plain_password: str) -> str:
    """Gera o hash bcrypt de uma senha em texto plano."""
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def get_active_admin_count() -> int:
    """Retorna a quantidade de administradores ativos no sistema."""
    result = fetch_one(
        "SELECT COUNT(*) as count FROM usuarios WHERE role = 'admin' AND is_active = 1"
    )
    return result["count"] if result else 0


def is_last_active_admin(user_id: int) -> bool:
    """
    Verifica se o usuário é o último administrador ativo.
    Retorna True se o usuário for admin ativo e for o único.
    """
    user = fetch_one("SELECT role, is_active FROM usuarios WHERE id = ?", (user_id,))
    if not user or user["role"] != "admin" or not user["is_active"]:
        return False

    return get_active_admin_count() <= 1


def create_user(name: str, login: str, password: str, role: str) -> dict:
    """
    Cria um novo usuário no sistema.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - user: Dados do usuário criado (se sucesso)
        - error: Mensagem de erro (se falha)
        - error_code: Código de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    # Verifica unicidade do login
    existing = fetch_one("SELECT id FROM usuarios WHERE login = ?", (login,))
    if existing:
        return {
            "success": False,
            "error": "Login já está em uso.",
            "error_code": "USER_LOGIN_DUPLICATE",
            "status_code": 409,
        }

    # Gera hash da senha
    password_hash = hash_password(password)

    # Insere o usuário no banco
    user_id = execute(
        """
        INSERT INTO usuarios (name, login, password_hash, role)
        VALUES (?, ?, ?, ?)
        """,
        (name, login, password_hash, role),
    )

    # Retorna os dados do usuário criado
    user = fetch_one(
        "SELECT id, name, login, role, is_active FROM usuarios WHERE id = ?",
        (user_id,),
    )

    return {
        "success": True,
        "user": user,
        "status_code": 201,
    }


def list_users() -> list[dict]:
    """
    Retorna todos os usuários cadastrados com seus dados públicos.
    """
    return fetch_all(
        "SELECT id, name, login, role, is_active FROM usuarios ORDER BY id"
    )


def get_user_by_id(user_id: int) -> dict | None:
    """
    Retorna um usuário pelo ID.
    Retorna None se não encontrado.
    """
    return fetch_one(
        "SELECT id, name, login, role, is_active FROM usuarios WHERE id = ?",
        (user_id,),
    )


def update_user(
    user_id: int,
    name: str | None = None,
    password: str | None = None,
    role: str | None = None,
) -> dict:
    """
    Atualiza os dados de um usuário existente.

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - user: Dados do usuário atualizado (se sucesso)
        - error: Mensagem de erro (se falha)
        - error_code: Código de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    # Verifica se o usuário existe e está ativo
    user = fetch_one(
        "SELECT id, role, is_active FROM usuarios WHERE id = ?", (user_id,)
    )

    if not user:
        return {
            "success": False,
            "error": "Usuário não encontrado.",
            "error_code": "USER_NOT_FOUND",
            "status_code": 404,
        }

    if not user["is_active"]:
        return {
            "success": False,
            "error": "Usuário está inativo.",
            "error_code": "USER_INACTIVE",
            "status_code": 404,
        }

    # Proteção do último admin: não pode alterar role de admin para scheduler
    if role and role != user["role"] and user["role"] == "admin":
        if is_last_active_admin(user_id):
            return {
                "success": False,
                "error": "Não é possível alterar o perfil do único administrador ativo.",
                "error_code": "USER_LAST_ADMIN",
                "status_code": 409,
            }

    # Monta a query de atualização dinamicamente
    updates = []
    params = []

    if name is not None:
        updates.append("name = ?")
        params.append(name)

    if password is not None:
        updates.append("password_hash = ?")
        params.append(hash_password(password))

    if role is not None:
        updates.append("role = ?")
        params.append(role)

    if not updates:
        # Nenhum campo para atualizar — retorna o usuário atual
        updated_user = get_user_by_id(user_id)
        return {
            "success": True,
            "user": updated_user,
            "status_code": 200,
        }

    updates.append("updated_at = datetime('now')")
    params.append(user_id)

    query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id = ?"
    execute(query, tuple(params))

    # Retorna os dados atualizados
    updated_user = get_user_by_id(user_id)

    return {
        "success": True,
        "user": updated_user,
        "status_code": 200,
    }


def deactivate_user(user_id: int) -> dict:
    """
    Desativa um usuário (soft delete).

    Returns:
        Dicionário com resultado da operação:
        - success: True/False
        - user: Dados do usuário desativado (se sucesso)
        - error: Mensagem de erro (se falha)
        - error_code: Código de erro (se falha)
        - status_code: Código HTTP sugerido
    """
    # Verifica se o usuário existe
    user = fetch_one(
        "SELECT id, role, is_active FROM usuarios WHERE id = ?", (user_id,)
    )

    if not user:
        return {
            "success": False,
            "error": "Usuário não encontrado.",
            "error_code": "USER_NOT_FOUND",
            "status_code": 404,
        }

    if not user["is_active"]:
        return {
            "success": False,
            "error": "Usuário já está inativo.",
            "error_code": "USER_ALREADY_INACTIVE",
            "status_code": 409,
        }

    # Proteção do último admin
    if user["role"] == "admin" and is_last_active_admin(user_id):
        return {
            "success": False,
            "error": "Não é possível desativar o único administrador ativo.",
            "error_code": "USER_LAST_ADMIN",
            "status_code": 409,
        }

    # Desativa o usuário
    execute(
        "UPDATE usuarios SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
        (user_id,),
    )

    # Retorna os dados atualizados
    updated_user = get_user_by_id(user_id)

    return {
        "success": True,
        "user": updated_user,
        "status_code": 200,
    }


def reactivate_user(user_id: int) -> dict:
    """
    Reativa um usuário previamente desativado.

    Returns:
        Dicionário com resultado da operação.
    """
    user = fetch_one(
        "SELECT id, role, is_active FROM usuarios WHERE id = ?", (user_id,)
    )

    if not user:
        return {
            "success": False,
            "error": "Usuário não encontrado.",
            "error_code": "USER_NOT_FOUND",
            "status_code": 404,
        }

    if user["is_active"]:
        return {
            "success": False,
            "error": "Usuário já está ativo.",
            "error_code": "USER_ALREADY_ACTIVE",
            "status_code": 400,
        }

    execute(
        "UPDATE usuarios SET is_active = 1, updated_at = datetime('now') WHERE id = ?",
        (user_id,),
    )

    updated_user = get_user_by_id(user_id)

    return {
        "success": True,
        "user": updated_user,
        "status_code": 200,
    }
