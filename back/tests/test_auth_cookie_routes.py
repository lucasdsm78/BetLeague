from __future__ import annotations

from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.user.user_command_model import (
    RefreshTokenResponse,
    UserCreateResponse,
    UserLoginResponse,
    UserUpdateResponse,
)
import presentation.user.user_router as user_router_module


class FakeUserCommandUseCase:
    def __init__(self):
        self.refresh_token_input: str | None = None
        self.updated_email: str | None = None
        self.updated_payload = None

    async def create(self, data):
        return UserCreateResponse()

    async def login(self, data):
        return UserLoginResponse(
            token_auth="access-token-1",
            uuid="user-1",
            refresh_token="refresh-token-1",
            token_expiration="2030-01-01T00:00:00Z",
            two_factor_enabled=False,
        )

    async def refresh_token(self, refresh_token: str):
        self.refresh_token_input = refresh_token
        return RefreshTokenResponse(
            token_auth="access-token-2",
            refresh_token="refresh-token-2",
            token_expiration="2030-01-01T00:05:00Z",
            message="Session renouvelée avec succès.",
        )

    async def logout(self, user_id: str, token: str):
        return {
            "message": "Déconnexion réussie",
            "user_id": user_id,
            "timestamp": "2030-01-01T00:00:00Z",
        }

    async def update_user_profile(self, email: str, data):
        self.updated_email = email
        self.updated_payload = data
        return UserUpdateResponse(
            token_auth="access-token-3",
            refresh_token="refresh-token-3",
            token_expiration="2030-01-01T00:10:00Z",
        )


async def _noop_rate_limit(*args, **kwargs):
    return None


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        refresh_token_expire_minutes=60,
        auth_refresh_cookie_name="betleague_refresh_token",
        auth_refresh_cookie_domain="",
        auth_refresh_cookie_path="/api/auth",
        auth_refresh_cookie_secure_value=False,
        auth_refresh_cookie_samesite_value="lax",
    )


def _make_client(fake_uc: FakeUserCommandUseCase, monkeypatch) -> TestClient:
    monkeypatch.setattr(user_router_module, "rate_limit_login_with_2fa_code", _noop_rate_limit)

    app = FastAPI()
    app.include_router(user_router_module.router)
    app.dependency_overrides[user_router_module.user_command_usecase] = lambda: fake_uc
    app.dependency_overrides[user_router_module.get_settings] = _settings
    app.dependency_overrides[user_router_module.current_user] = lambda: {
        "id": "user-1",
        "email": "player@example.com",
        "token": "access-token-current",
        "username": "player",
    }
    return TestClient(app)


def test_register_returns_neutral_accepted_response_without_auth_cookie(monkeypatch):
    fake_uc = FakeUserCommandUseCase()
    client = _make_client(fake_uc, monkeypatch)

    response = client.post(
        "/api/auth/register",
        json={
            "pseudo": "playerone",
            "email": "player@example.com",
            "password": "VeryStrong123!",
        },
    )

    assert response.status_code == 202
    assert response.json() == {
        "message": "Si l'inscription est possible, vous pouvez maintenant vous connecter."
    }
    assert "set-cookie" not in response.headers


def test_login_sets_refresh_cookie_and_omits_refresh_token_from_body(monkeypatch):
    fake_uc = FakeUserCommandUseCase()
    client = _make_client(fake_uc, monkeypatch)

    response = client.post(
        "/api/auth/login",
        json={"email": "player@example.com", "password": "VeryStrong123!"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "token_auth": "access-token-1",
        "uuid": "user-1",
        "token_expiration": "2030-01-01T00:00:00Z",
        "two_factor_enabled": False,
    }
    set_cookie = response.headers["set-cookie"]
    assert "betleague_refresh_token=refresh-token-1" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/api/auth" in set_cookie
    assert "SameSite=lax" in set_cookie


def test_refresh_uses_cookie_rotates_cookie_and_omits_refresh_token_from_body(monkeypatch):
    fake_uc = FakeUserCommandUseCase()
    client = _make_client(fake_uc, monkeypatch)
    client.cookies.set("betleague_refresh_token", "cookie-refresh-token")

    response = client.post("/api/auth/refresh")

    assert response.status_code == 200
    assert fake_uc.refresh_token_input == "cookie-refresh-token"
    assert response.json() == {
        "token_auth": "access-token-2",
        "token_expiration": "2030-01-01T00:05:00Z",
        "message": "Session renouvelée avec succès.",
    }
    set_cookie = response.headers["set-cookie"]
    assert "betleague_refresh_token=refresh-token-2" in set_cookie
    assert "HttpOnly" in set_cookie


def test_refresh_requires_cookie_when_no_refresh_cookie_is_present(monkeypatch):
    fake_uc = FakeUserCommandUseCase()
    client = _make_client(fake_uc, monkeypatch)

    response = client.post("/api/auth/refresh")

    assert response.status_code == 401
    assert response.json() == {"detail": "Jeton de rafraîchissement manquant."}
    assert fake_uc.refresh_token_input is None


def test_logout_clears_refresh_cookie(monkeypatch):
    fake_uc = FakeUserCommandUseCase()
    client = _make_client(fake_uc, monkeypatch)
    client.cookies.set("betleague_refresh_token", "cookie-refresh-token")

    response = client.post(
        "/api/auth/logout",
        headers={"Authorization": "Bearer access-token-current"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Déconnexion réussie"
    set_cookie = response.headers["set-cookie"]
    assert "betleague_refresh_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()


def test_update_user_rotates_cookie_and_omits_refresh_token_from_body(monkeypatch):
    fake_uc = FakeUserCommandUseCase()
    client = _make_client(fake_uc, monkeypatch)

    response = client.put(
        "/api/auth/user",
        json={"pseudo": "updated-player"},
        headers={"Authorization": "Bearer access-token-current"},
    )

    assert response.status_code == 202
    assert fake_uc.updated_email == "player@example.com"
    assert response.json() == {
        "token_auth": "access-token-3",
        "token_expiration": "2030-01-01T00:10:00Z",
    }
    set_cookie = response.headers["set-cookie"]
    assert "betleague_refresh_token=refresh-token-3" in set_cookie
    assert "HttpOnly" in set_cookie




