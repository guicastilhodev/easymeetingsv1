"""Testes unitários para o módulo de autenticação (backend/auth.py)."""

import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
import pytest

from auth import (
    JWT_ALGORITHM,
    JWT_EXPIRATION_MINUTES,
    JWT_SECRET_KEY,
    create_access_token,
    decode_access_token,
    get_current_user,
    require_admin,
)


class TestCreateAccessToken:
    """Testes para criação de tokens JWT."""

    def test_creates_valid_token(self):
        """Token criado pode ser decodificado com sucesso."""
        token = create_access_token(user_id=1, login="admin", role="admin")
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        assert payload["sub"] == "1"
        assert payload["login"] == "admin"
        assert payload["role"] == "admin"

    def test_token_contains_expiration(self):
        """Token contém campo de expiração."""
        token = create_access_token(user_id=1, login="admin", role="admin")
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        assert "exp" in payload
        assert "iat" in payload

    def test_token_expires_in_60_minutes(self):
        """Token expira em 60 minutos."""
        token = create_access_token(user_id=1, login="admin", role="admin")
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        iat = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        delta = exp - iat

        assert delta == timedelta(minutes=JWT_EXPIRATION_MINUTES)
        assert JWT_EXPIRATION_MINUTES == 60

    def test_different_users_get_different_tokens(self):
        """Usuários diferentes recebem tokens diferentes."""
        token1 = create_access_token(user_id=1, login="user1", role="admin")
        token2 = create_access_token(user_id=2, login="user2", role="scheduler")

        assert token1 != token2

    def test_scheduler_role_in_token(self):
        """Token para scheduler contém role correto."""
        token = create_access_token(user_id=5, login="scheduler1", role="scheduler")
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        assert payload["role"] == "scheduler"


class TestDecodeAccessToken:
    """Testes para decodificação de tokens JWT."""

    def test_decodes_valid_token(self):
        """Token válido é decodificado corretamente."""
        token = create_access_token(user_id=1, login="admin", role="admin")
        payload = decode_access_token(token)

        assert payload["sub"] == "1"
        assert payload["login"] == "admin"
        assert payload["role"] == "admin"

    def test_raises_on_expired_token(self):
        """Token expirado gera HTTPException 401."""
        # Cria token já expirado
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "1",
            "login": "admin",
            "role": "admin",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        }
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(token)

        assert exc_info.value.status_code == 401
        assert "expirado" in exc_info.value.detail.lower()

    def test_raises_on_invalid_token(self):
        """Token inválido gera HTTPException 401."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token("invalid.token.here")

        assert exc_info.value.status_code == 401
        assert "inválido" in exc_info.value.detail.lower()

    def test_raises_on_wrong_secret(self):
        """Token assinado com chave diferente gera HTTPException 401."""
        payload = {
            "sub": "1",
            "login": "admin",
            "role": "admin",
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        }
        token = jwt.encode(payload, "wrong-secret", algorithm=JWT_ALGORITHM)

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(token)

        assert exc_info.value.status_code == 401


class TestGetCurrentUser:
    """Testes para a dependency get_current_user."""

    def test_returns_user_for_valid_token(self):
        """Retorna dados do usuário para token válido com usuário ativo."""
        token = create_access_token(user_id=1, login="admin", role="admin")

        mock_user = {
            "id": 1,
            "name": "Admin",
            "login": "admin",
            "role": "admin",
            "is_active": 1,
        }

        # Simula credenciais do HTTPBearer
        class MockCredentials:
            credentials = token

        with patch("auth.fetch_one", return_value=mock_user):
            user = get_current_user(MockCredentials())

        assert user["id"] == 1
        assert user["login"] == "admin"
        assert user["role"] == "admin"

    def test_raises_for_inactive_user(self):
        """Rejeita usuário desativado."""
        token = create_access_token(user_id=1, login="admin", role="admin")

        mock_user = {
            "id": 1,
            "name": "Admin",
            "login": "admin",
            "role": "admin",
            "is_active": 0,
        }

        class MockCredentials:
            credentials = token

        from fastapi import HTTPException

        with patch("auth.fetch_one", return_value=mock_user):
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(MockCredentials())

        assert exc_info.value.status_code == 401
        assert "desativado" in exc_info.value.detail.lower()

    def test_raises_for_nonexistent_user(self):
        """Rejeita token de usuário que não existe mais no banco."""
        token = create_access_token(user_id=999, login="ghost", role="admin")

        class MockCredentials:
            credentials = token

        from fastapi import HTTPException

        with patch("auth.fetch_one", return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(MockCredentials())

        assert exc_info.value.status_code == 401


class TestRequireAdmin:
    """Testes para a dependency require_admin."""

    def test_allows_admin_user(self):
        """Permite acesso para usuário admin."""
        admin_user = {
            "id": 1,
            "name": "Admin",
            "login": "admin",
            "role": "admin",
            "is_active": 1,
        }

        result = require_admin(admin_user)
        assert result == admin_user

    def test_rejects_scheduler_user(self):
        """Rejeita acesso para usuário scheduler."""
        scheduler_user = {
            "id": 2,
            "name": "Scheduler",
            "login": "scheduler",
            "role": "scheduler",
            "is_active": 1,
        }

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            require_admin(scheduler_user)

        assert exc_info.value.status_code == 403
        assert "administrador" in exc_info.value.detail.lower()
