from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

import application.user.user_command_usecase as user_command_usecase_module
from application.user.user_command_model import UserCreateModel, UserUpdateModel
from application.user.user_command_usecase import UserCommandUseCaseImpl
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User


class FakeHash:
    async def verify(self, plain: str, hashed: str) -> bool:
        return hashed == f"hashed::{plain}"

    async def bcrypt(self, plain: str) -> str:
        return f"hashed::{plain}"


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSession:
    def __init__(self, user: User):
        self.user = user
        self.updated_user = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return FakeTransaction()


class FakeScopedRepo:
    def __init__(self, session: FakeSession):
        self.session = session

    async def find_by_email(self, email: str):
        user = self.session.user
        if user and user.email.value == email:
            return user
        return None

    async def find_by_pseudo_or_email(self, **kwargs):
        user = self.session.user
        if not user:
            return None
        pseudo = kwargs.get("pseudo")
        email = kwargs.get("email")
        if pseudo and user.pseudo == pseudo:
            return user
        if email and user.email.value == email:
            return user
        return None

    async def update(self, user: User):
        self.session.updated_user = user
        self.session.user = user
        return user


class FakeManagerToken:
    def __init__(self, refresh_payload: dict | None = None):
        self.refresh_payload = refresh_payload
        self.invalidations: list[tuple[str, str]] = []
        self.global_invalidations: list[str] = []
        self.generated_access_tokens: list[str] = []
        self.generated_refresh_tokens: list[str] = []

    async def generate_token_login(self, domain_user: User) -> str:
        token = f"access-for-{domain_user.id}-{len(self.generated_access_tokens) + 1}"
        self.generated_access_tokens.append(token)
        return token

    async def generate_expiration_token_login(self, domain_user: User) -> str:
        token = f"refresh-for-{domain_user.id}-{len(self.generated_refresh_tokens) + 1}"
        self.generated_refresh_tokens.append(token)
        return token

    async def verify_token(self, token: str):
        return self.refresh_payload

    async def invalidate_token(self, token: str, user_id: str) -> bool:
        self.invalidations.append((token, user_id))
        return True

    async def invalidate_all_user_tokens(self, user_id: str) -> bool:
        self.global_invalidations.append(user_id)
        return True

    async def decode_token_login(self, token: str):
        raise NotImplementedError

    async def decode_expiration_token_login(self, token: str, password: Password):
        raise NotImplementedError


class FakeTOTPService:
    async def decrypt_secret(self, encrypted_secret: str, cipher_suite):
        return "plain-secret"

    async def verify_code(self, secret: str, code: str) -> bool:
        return True


def make_usecase(user: User, monkeypatch: pytest.MonkeyPatch, refresh_payload: dict | None = None):
    session = FakeSession(user)
    manager = FakeManagerToken(refresh_payload=refresh_payload)
    monkeypatch.setattr(user_command_usecase_module, "UserRepositoryImpl", FakeScopedRepo)
    settings = SimpleNamespace(
        encryption_key=Fernet.generate_key().decode(),
        access_token_expire_minutes=15,
    )
    usecase = UserCommandUseCaseImpl(
        user_repository=FakeScopedRepo(session),
        hasher=FakeHash(),
        session_factory=lambda: session,
        manager_token=manager,
        totp_service=FakeTOTPService(),
        settings=settings,
    )
    return usecase, session, manager


def test_refresh_token_rejects_access_tokens(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=1,
        email=Email("player@example.com"),
        pseudo="player",
        uuid="uuid-1",
        password=Password("hashed::password123"),
    )
    usecase, _, manager = make_usecase(
        user,
        monkeypatch,
        refresh_payload={"email": "player@example.com", "id": 1, "type": "access"},
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(usecase.refresh_token("access-token"))

    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid refresh token type"
    assert manager.invalidations == []


def test_create_user_returns_neutral_response_when_email_already_exists(monkeypatch: pytest.MonkeyPatch):
    existing_user = User(
        id=10,
        email=Email("existing@example.com"),
        pseudo="existing",
        uuid="uuid-10",
        password=Password("hashed::password123"),
    )
    usecase, session, manager = make_usecase(existing_user, monkeypatch)

    response = asyncio.run(
        usecase.create(
            UserCreateModel(
                pseudo="another-user",
                email="existing@example.com",
                password="VeryStrong123!",
            )
        )
    )

    assert response.message == "Si l'inscription est possible, vous pouvez maintenant vous connecter."
    assert session.updated_user is None
    assert manager.generated_access_tokens == []
    assert manager.generated_refresh_tokens == []


def test_refresh_token_rotates_refresh_token_and_invalidates_previous_one(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=2,
        email=Email("refresh@example.com"),
        pseudo="refresh-user",
        uuid="uuid-2",
        password=Password("hashed::password123"),
    )
    usecase, _, manager = make_usecase(
        user,
        monkeypatch,
        refresh_payload={"email": "refresh@example.com", "id": 2, "type": "refresh"},
    )

    response = asyncio.run(usecase.refresh_token("refresh-token-old"))

    assert response.token_auth == "access-for-2-1"
    assert response.refresh_token == "refresh-for-2-1"
    assert response.message == "Token refreshed successfully"
    assert manager.invalidations == [("refresh-token-old", "2")]


def test_update_user_profile_requires_current_password_for_email_change_and_revokes_sessions(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=3,
        email=Email("before@example.com"),
        pseudo="before",
        uuid="uuid-3",
        password=Password("hashed::current-password"),
        is_two_factor_enabled=False,
    )
    usecase, session, manager = make_usecase(user, monkeypatch)

    response = asyncio.run(
        usecase.update_user_profile(
            "before@example.com",
            UserUpdateModel(email="after@example.com", current_password="current-password"),
        )
    )

    assert session.updated_user is user
    assert user.email.value == "after@example.com"
    assert manager.global_invalidations == ["3"]
    assert response.token_auth == "access-for-3-1"
    assert response.refresh_token == "refresh-for-3-1"
    assert datetime.fromisoformat(response.token_expiration.replace("Z", "+00:00")).tzinfo == UTC


def test_update_user_profile_allows_pseudo_change_without_current_password(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=4,
        email=Email("pseudo@example.com"),
        pseudo="before",
        uuid="uuid-4",
        password=Password("hashed::current-password"),
        is_two_factor_enabled=False,
    )
    usecase, session, manager = make_usecase(user, monkeypatch)

    response = asyncio.run(
        usecase.update_user_profile(
            "pseudo@example.com",
            UserUpdateModel(pseudo="after"),
        )
    )

    assert session.updated_user is user
    assert user.pseudo == "after"
    assert manager.global_invalidations == []
    assert response.token_auth == "access-for-4-1"
    assert response.refresh_token == "refresh-for-4-1"


