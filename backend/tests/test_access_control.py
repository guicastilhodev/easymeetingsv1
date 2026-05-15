"""
Testes de controle de acesso em todas as rotas da API.

Valida:
- Rotas admin retornam 403 para Responsavel_Agendamento
- Rotas públicas (login) não exigem token
- Rotas autenticadas retornam 401/403 sem token ou com token expirado
- Rate limiting no endpoint de login (5 tentativas / 15 min bloqueio)

Validates: Requirements 10.1, 10.2, 10.3, 10.4
"""

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bcrypt
import jwt
import pytest
from fastapi.testclient import TestClient

from auth import JWT_ALGORITHM, JWT_SECRET_KEY
from database import execute, fetch_one, initialize_database
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database(tmp_path, monkeypatch):
    """Configura banco de dados temporário para cada teste."""
    db_path = str(tmp_path / "test.db")
    monkeypatch.setattr("database.DATABASE_PATH", db_path)
    initialize_database()
    yield


def get_admin_token() -> str:
    """Obtém token do admin seed."""
    response = client.post(
        "/api/auth/login",
        json={"login": "admin", "password": "admin123"},
    )
    return response.json()["access_token"]


def get_scheduler_token() -> str:
    """Cria um scheduler e obtém seu token."""
    password_hash = bcrypt.hashpw("senha123".encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )
    execute(
        "INSERT INTO usuarios (name, login, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)",
        ("Scheduler Test", "scheduler_ac", password_hash, "scheduler", 1),
    )
    response = client.post(
        "/api/auth/login",
        json={"login": "scheduler_ac", "password": "senha123"},
    )
    return response.json()["access_token"]


def create_expired_token() -> str:
    """Cria um token JWT já expirado."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "1",
        "login": "admin",
        "role": "admin",
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_invalid_token() -> str:
    """Cria um token com assinatura inválida."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "1",
        "login": "admin",
        "role": "admin",
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    return jwt.encode(payload, "wrong-secret-key", algorithm=JWT_ALGORITHM)


def setup_room() -> int:
    """Cria uma sala para uso nos testes e retorna o ID."""
    token = get_admin_token()
    response = client.post(
        "/api/rooms",
        json={"name": "Sala Teste AC", "capacity": 10, "location": "Andar 1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return response.json()["id"]


def setup_resource(room_id: int) -> int:
    """Cria um recurso para uso nos testes e retorna o ID."""
    token = get_admin_token()
    response = client.post(
        f"/api/rooms/{room_id}/resources",
        json={"type": "Equipamento", "name": "Projetor", "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    return response.json()["id"]


# =============================================================================
# TESTES: Rotas admin retornam 403 para Responsavel_Agendamento
# Validates: Requirement 10.2, 10.3
# =============================================================================


class TestAdminRoutesReturn403ForScheduler:
    """Verifica que todas as rotas admin retornam 403 para scheduler."""

    def test_post_users_forbidden_for_scheduler(self):
        """POST /api/users retorna 403 para scheduler."""
        token = get_scheduler_token()
        response = client.post(
            "/api/users",
            json={
                "name": "Test",
                "login": "testuser",
                "password": "senha12345",
                "role": "scheduler",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_get_users_forbidden_for_scheduler(self):
        """GET /api/users retorna 403 para scheduler."""
        token = get_scheduler_token()
        response = client.get(
            "/api/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_put_users_forbidden_for_scheduler(self):
        """PUT /api/users/{id} retorna 403 para scheduler."""
        token = get_scheduler_token()
        response = client.put(
            "/api/users/1",
            json={"name": "Hacked"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_deactivate_user_forbidden_for_scheduler(self):
        """PATCH /api/users/{id}/deactivate retorna 403 para scheduler."""
        token = get_scheduler_token()
        response = client.patch(
            "/api/users/1/deactivate",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_post_rooms_forbidden_for_scheduler(self):
        """POST /api/rooms retorna 403 para scheduler."""
        token = get_scheduler_token()
        response = client.post(
            "/api/rooms",
            json={"name": "Sala Hack", "capacity": 10, "location": "Andar 1"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_put_rooms_forbidden_for_scheduler(self):
        """PUT /api/rooms/{id} retorna 403 para scheduler."""
        room_id = setup_room()
        token = get_scheduler_token()
        response = client.put(
            f"/api/rooms/{room_id}",
            json={"name": "Sala Renomeada"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_delete_rooms_forbidden_for_scheduler(self):
        """DELETE /api/rooms/{id} retorna 403 para scheduler."""
        room_id = setup_room()
        token = get_scheduler_token()
        response = client.delete(
            f"/api/rooms/{room_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_post_resources_forbidden_for_scheduler(self):
        """POST /api/rooms/{room_id}/resources retorna 403 para scheduler."""
        room_id = setup_room()
        token = get_scheduler_token()
        response = client.post(
            f"/api/rooms/{room_id}/resources",
            json={"type": "Equipamento", "name": "TV", "quantity": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_put_resources_forbidden_for_scheduler(self):
        """PUT /api/rooms/{room_id}/resources/{id} retorna 403 para scheduler."""
        room_id = setup_room()
        resource_id = setup_resource(room_id)
        token = get_scheduler_token()
        response = client.put(
            f"/api/rooms/{room_id}/resources/{resource_id}",
            json={"type": "Equipamento", "name": "TV 4K", "quantity": 2},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_delete_resources_forbidden_for_scheduler(self):
        """DELETE /api/rooms/{room_id}/resources/{id} retorna 403 para scheduler."""
        room_id = setup_room()
        resource_id = setup_resource(room_id)
        token = get_scheduler_token()
        response = client.delete(
            f"/api/rooms/{room_id}/resources/{resource_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


# =============================================================================
# TESTES: Rotas admin são acessíveis para Administrador
# Validates: Requirement 10.1
# =============================================================================


class TestAdminRoutesAccessibleForAdmin:
    """Verifica que admin pode acessar todas as rotas admin."""

    def test_post_users_allowed_for_admin(self):
        """POST /api/users retorna 201 para admin."""
        token = get_admin_token()
        response = client.post(
            "/api/users",
            json={
                "name": "Admin Created",
                "login": "admincreated",
                "password": "senha12345",
                "role": "scheduler",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    def test_get_users_allowed_for_admin(self):
        """GET /api/users retorna 200 para admin."""
        token = get_admin_token()
        response = client.get(
            "/api/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_post_rooms_allowed_for_admin(self):
        """POST /api/rooms retorna 201 para admin."""
        token = get_admin_token()
        response = client.post(
            "/api/rooms",
            json={"name": "Sala Admin", "capacity": 10, "location": "Andar 2"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    def test_put_rooms_allowed_for_admin(self):
        """PUT /api/rooms/{id} retorna 200 para admin."""
        room_id = setup_room()
        token = get_admin_token()
        response = client.put(
            f"/api/rooms/{room_id}",
            json={"name": "Sala Atualizada Admin"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_delete_rooms_allowed_for_admin(self):
        """DELETE /api/rooms/{id} retorna 200 para admin."""
        room_id = setup_room()
        token = get_admin_token()
        response = client.delete(
            f"/api/rooms/{room_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_post_resources_allowed_for_admin(self):
        """POST /api/rooms/{room_id}/resources retorna 201 para admin."""
        room_id = setup_room()
        token = get_admin_token()
        response = client.post(
            f"/api/rooms/{room_id}/resources",
            json={"type": "Mobiliário", "name": "Mesa", "quantity": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201


# =============================================================================
# TESTES: Rota pública (login) não exige token
# Validates: Requirement 10.4 (parcial — rota pública)
# =============================================================================


class TestPublicRoutes:
    """Verifica que rotas públicas funcionam sem token."""

    def test_login_works_without_token(self):
        """POST /api/auth/login funciona sem token de autenticação."""
        response = client.post(
            "/api/auth/login",
            json={"login": "admin", "password": "admin123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_credentials_without_token(self):
        """POST /api/auth/login retorna 401 para credenciais inválidas (sem token)."""
        response = client.post(
            "/api/auth/login",
            json={"login": "admin", "password": "wrongpassword"},
        )
        assert response.status_code == 401

    def test_health_check_works_without_token(self):
        """GET /api/health funciona sem token."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# =============================================================================
# TESTES: Rotas autenticadas retornam 401/403 sem token
# Validates: Requirement 10.4
# =============================================================================


class TestAuthenticatedRoutesWithoutToken:
    """Verifica que rotas autenticadas rejeitam requisições sem token."""

    def test_get_rooms_without_token(self):
        """GET /api/rooms retorna 403 sem token (HTTPBearer retorna 403)."""
        response = client.get("/api/rooms")
        assert response.status_code == 403

    def test_get_room_by_id_without_token(self):
        """GET /api/rooms/{id} retorna 403 sem token."""
        response = client.get("/api/rooms/1")
        assert response.status_code == 403

    def test_get_available_rooms_without_token(self):
        """GET /api/rooms/available retorna 403 sem token."""
        response = client.get(
            "/api/rooms/available",
            params={"date": "2025-01-15", "start_time": "09:00", "end_time": "10:00"},
        )
        assert response.status_code == 403

    def test_get_room_schedule_without_token(self):
        """GET /api/rooms/{id}/schedule retorna 403 sem token."""
        response = client.get("/api/rooms/1/schedule", params={"date": "2025-01-15"})
        assert response.status_code == 403

    def test_post_reservations_without_token(self):
        """POST /api/reservations retorna 403 sem token."""
        response = client.post(
            "/api/reservations",
            json={
                "room_id": 1,
                "date": "2025-01-15",
                "start_time": "09:00",
                "end_time": "10:00",
                "participants": ["João"],
            },
        )
        assert response.status_code == 403

    def test_get_reservations_without_token(self):
        """GET /api/reservations retorna 403 sem token."""
        response = client.get("/api/reservations")
        assert response.status_code == 403

    def test_get_reservation_by_id_without_token(self):
        """GET /api/reservations/{id} retorna 403 sem token."""
        response = client.get("/api/reservations/1")
        assert response.status_code == 403

    def test_put_reservation_without_token(self):
        """PUT /api/reservations/{id} retorna 403 sem token."""
        response = client.put(
            "/api/reservations/1",
            json={"start_time": "10:00", "end_time": "11:00"},
        )
        assert response.status_code == 403

    def test_cancel_reservation_without_token(self):
        """PATCH /api/reservations/{id}/cancel retorna 403 sem token."""
        response = client.patch("/api/reservations/1/cancel")
        assert response.status_code == 403

    def test_post_users_without_token(self):
        """POST /api/users retorna 403 sem token."""
        response = client.post(
            "/api/users",
            json={
                "name": "Hack",
                "login": "hack",
                "password": "senha12345",
                "role": "admin",
            },
        )
        assert response.status_code == 403

    def test_get_users_without_token(self):
        """GET /api/users retorna 403 sem token."""
        response = client.get("/api/users")
        assert response.status_code == 403

    def test_post_resources_without_token(self):
        """POST /api/rooms/{room_id}/resources retorna 403 sem token."""
        response = client.post(
            "/api/rooms/1/resources",
            json={"type": "Equipamento", "name": "TV", "quantity": 1},
        )
        assert response.status_code == 403

    def test_logout_without_token(self):
        """POST /api/auth/logout retorna 403 sem token."""
        response = client.post("/api/auth/logout")
        assert response.status_code == 403


# =============================================================================
# TESTES: Rotas autenticadas rejeitam token expirado
# Validates: Requirement 10.4, 1.4
# =============================================================================


class TestAuthenticatedRoutesWithExpiredToken:
    """Verifica que rotas autenticadas rejeitam token expirado."""

    def test_get_rooms_with_expired_token(self):
        """GET /api/rooms retorna 401 com token expirado."""
        token = create_expired_token()
        response = client.get(
            "/api/rooms",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_post_users_with_expired_token(self):
        """POST /api/users retorna 401 com token expirado."""
        token = create_expired_token()
        response = client.post(
            "/api/users",
            json={
                "name": "Expired",
                "login": "expired",
                "password": "senha12345",
                "role": "scheduler",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_get_reservations_with_expired_token(self):
        """GET /api/reservations retorna 401 com token expirado."""
        token = create_expired_token()
        response = client.get(
            "/api/reservations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_post_rooms_with_expired_token(self):
        """POST /api/rooms retorna 401 com token expirado."""
        token = create_expired_token()
        response = client.post(
            "/api/rooms",
            json={"name": "Expired Room", "capacity": 5, "location": "Andar 3"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_post_resources_with_expired_token(self):
        """POST /api/rooms/{room_id}/resources retorna 401 com token expirado."""
        token = create_expired_token()
        response = client.post(
            "/api/rooms/1/resources",
            json={"type": "Equipamento", "name": "TV", "quantity": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401


# =============================================================================
# TESTES: Rotas autenticadas rejeitam token inválido
# Validates: Requirement 10.4
# =============================================================================


class TestAuthenticatedRoutesWithInvalidToken:
    """Verifica que rotas autenticadas rejeitam token com assinatura inválida."""

    def test_get_rooms_with_invalid_token(self):
        """GET /api/rooms retorna 401 com token de assinatura inválida."""
        token = create_invalid_token()
        response = client.get(
            "/api/rooms",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_post_users_with_invalid_token(self):
        """POST /api/users retorna 401 com token de assinatura inválida."""
        token = create_invalid_token()
        response = client.post(
            "/api/users",
            json={
                "name": "Invalid",
                "login": "invalid",
                "password": "senha12345",
                "role": "scheduler",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_get_reservations_with_invalid_token(self):
        """GET /api/reservations retorna 401 com token inválido."""
        token = create_invalid_token()
        response = client.get(
            "/api/reservations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_post_reservations_with_malformed_token(self):
        """POST /api/reservations retorna 401 com token malformado."""
        response = client.post(
            "/api/reservations",
            json={
                "room_id": 1,
                "date": "2025-01-15",
                "start_time": "09:00",
                "end_time": "10:00",
                "participants": ["João"],
            },
            headers={"Authorization": "Bearer not.a.valid.jwt.token"},
        )
        assert response.status_code == 401


# =============================================================================
# TESTES: Rotas autenticadas acessíveis para scheduler (não-admin)
# Validates: Requirement 10.2
# =============================================================================


class TestAuthenticatedRoutesAccessibleForScheduler:
    """Verifica que scheduler pode acessar rotas autenticadas (não-admin)."""

    def test_get_rooms_allowed_for_scheduler(self):
        """GET /api/rooms retorna 200 para scheduler."""
        token = get_scheduler_token()
        response = client.get(
            "/api/rooms",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_get_available_rooms_allowed_for_scheduler(self):
        """GET /api/rooms/available retorna 200 para scheduler."""
        setup_room()
        token = get_scheduler_token()
        response = client.get(
            "/api/rooms/available",
            params={"date": "2025-06-15", "start_time": "09:00", "end_time": "10:00"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_get_reservations_allowed_for_scheduler(self):
        """GET /api/reservations retorna 200 para scheduler."""
        token = get_scheduler_token()
        response = client.get(
            "/api/reservations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_post_reservations_allowed_for_scheduler(self):
        """POST /api/reservations é acessível para scheduler (pode retornar 404 se sala não existe, mas não 403)."""
        room_id = setup_room()
        token = get_scheduler_token()
        response = client.post(
            "/api/reservations",
            json={
                "room_id": room_id,
                "date": "2025-06-15",
                "start_time": "09:00",
                "end_time": "10:00",
                "participants": ["Maria"],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        # Pode ser 201 (sucesso) ou 400 (data passada), mas não 403
        assert response.status_code != 403

    def test_get_resources_allowed_for_scheduler(self):
        """GET /api/rooms/{room_id}/resources retorna 200 para scheduler."""
        room_id = setup_room()
        token = get_scheduler_token()
        response = client.get(
            f"/api/rooms/{room_id}/resources",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200


# =============================================================================
# TESTES: Rate limiting no endpoint de login
# Validates: Requirement 1.6
# =============================================================================


class TestLoginRateLimiting:
    """Verifica rate limiting no endpoint de login (5 tentativas / 15 min bloqueio)."""

    def test_account_locked_after_5_failed_attempts(self):
        """Conta é bloqueada após 5 tentativas consecutivas com falha."""
        # Faz 5 tentativas com senha errada
        for i in range(5):
            response = client.post(
                "/api/auth/login",
                json={"login": "admin", "password": "wrongpassword"},
            )
            assert response.status_code == 401

        # Sexta tentativa deve retornar 429 (conta bloqueada)
        response = client.post(
            "/api/auth/login",
            json={"login": "admin", "password": "wrongpassword"},
        )
        assert response.status_code == 429
        assert "bloqueada" in response.json()["detail"].lower()

    def test_correct_password_rejected_during_lockout(self):
        """Senha correta é rejeitada durante período de bloqueio."""
        # Bloqueia a conta
        for i in range(5):
            client.post(
                "/api/auth/login",
                json={"login": "admin", "password": "wrongpassword"},
            )

        # Tenta com senha correta — deve estar bloqueado
        response = client.post(
            "/api/auth/login",
            json={"login": "admin", "password": "admin123"},
        )
        assert response.status_code == 429
        assert "bloqueada" in response.json()["detail"].lower()

    def test_successful_login_resets_failed_attempts(self):
        """Login bem-sucedido reseta o contador de tentativas falhas."""
        # Faz 3 tentativas com senha errada
        for i in range(3):
            client.post(
                "/api/auth/login",
                json={"login": "admin", "password": "wrongpassword"},
            )

        # Login com senha correta
        response = client.post(
            "/api/auth/login",
            json={"login": "admin", "password": "admin123"},
        )
        assert response.status_code == 200

        # Verifica que o contador foi resetado (pode fazer mais 5 tentativas)
        for i in range(4):
            client.post(
                "/api/auth/login",
                json={"login": "admin", "password": "wrongpassword"},
            )

        # Quinta tentativa — ainda não bloqueado (pois resetou)
        response = client.post(
            "/api/auth/login",
            json={"login": "admin", "password": "admin123"},
        )
        assert response.status_code == 200

    def test_nonexistent_user_returns_generic_error(self):
        """Usuário inexistente retorna mesma mensagem genérica (não revela existência)."""
        response = client.post(
            "/api/auth/login",
            json={"login": "naoexiste", "password": "qualquersenha"},
        )
        assert response.status_code == 401
        # Mensagem deve ser genérica
        assert "inválidas" in response.json()["detail"].lower()
