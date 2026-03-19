import asyncio
from types import SimpleNamespace

from cryptography.fernet import Fernet
import pytest

import application.user.user_command_usecase as user_command_usecase_module
from application.user.user_command_model import VerifyTwoFactorModel, DisableTwoFactorModel
from application.user.user_command_usecase import UserCommandUseCaseImpl
from domain.user.exception.user_exception import Invalid2FACodeError
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.security.sse_rate_limiter import SlidingWindowRateLimiter


class FakeHash:
    async def verify(self, plain: str, hashed: str) -> bool:
        return hashed == f"hashed::{plain}"

    async def bcrypt(self, plain: str) -> str:
        return f"hashed::{plain}"


class FakeManagerToken:
    def __init__(self):
        self.invalidations: list[tuple[str, str]] = []
        self.global_invalidations: list[str] = []

    async def invalidate_token(self, token: str, user_id: str) -> bool:
        self.invalidations.append((token, user_id))
        return True

    async def invalidate_all_user_tokens(self, user_id: str) -> bool:
        self.global_invalidations.append(user_id)
        return True

    async def generate_token_login(self, domain_user: User) -> str:
        raise NotImplementedError

    async def generate_expiration_token_login(self, domain_user: User) -> str:
        raise NotImplementedError

    async def decode_token_login(self, token: str):
        raise NotImplementedError

    async def decode_expiration_token_login(self, token: str, password: Password):
        raise NotImplementedError

    async def verify_token(self, token: str):
        raise NotImplementedError


class FakeTOTPService:
    def __init__(self, expected_code: str = "123456"):
        self.expected_code = expected_code
        self.generated_secret = "BASE32SECRET"
        self.encrypted_secret = "encrypted-secret"
        self.decrypt_calls = 0

    async def generate_secret(self) -> str:
        return self.generated_secret

    async def encrypt_secret(self, secret: str, cipher_suite):
        assert secret == self.generated_secret
        return self.encrypted_secret

    async def decrypt_secret(self, encrypted_secret: str, cipher_suite):
        self.decrypt_calls += 1
        assert encrypted_secret == self.encrypted_secret
        return self.generated_secret

    async def verify_code(self, secret: str, code: str) -> bool:
        return secret == self.generated_secret and code == self.expected_code

    async def get_totp_uri(self, secret: str, email: str, issuer_name: str) -> str:
        return f"otpauth://totp/{issuer_name}:{email}?secret={secret}&issuer={issuer_name}"

    async def generate_qr_code(self, uri: str) -> bytes:
        return f"QR::{uri}".encode()


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

    async def update(self, user: User):
        self.session.updated_user = user
        self.session.user = user
        return user


def make_usecase(user: User, monkeypatch: pytest.MonkeyPatch, totp_service: FakeTOTPService | None = None):
    session = FakeSession(user)
    manager = FakeManagerToken()
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
        totp_service=totp_service or FakeTOTPService(),
        settings=settings,
    )
    return usecase, session, manager


def test_enable_2fa_returns_setup_and_keeps_user_pending(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=11,
        email=Email("player@example.com"),
        pseudo="player",
        uuid="uuid-11",
        password=Password("hashed::supersafepassword"),
        is_two_factor_enabled=False,
        is_two_factor_verified=False,
    )
    usecase, session, _ = make_usecase(user, monkeypatch)

    response = asyncio.run(usecase.enable_2fa("player@example.com"))

    assert response.secret == "BASE32SECRET"
    assert response.otpauth_url.startswith("otpauth://totp/BetLeague:player@example.com")
    assert response.qr_code.startswith("data:image/png;base64,")
    assert session.updated_user is user
    assert user.two_factor_secret == "encrypted-secret"
    assert user.is_two_factor_enabled is False
    assert user.is_two_factor_verified is False


def test_verify_2fa_confirms_pending_setup(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=12,
        email=Email("secure@example.com"),
        pseudo="secure",
        uuid="uuid-12",
        password=Password("hashed::supersafepassword"),
        two_factor_secret="encrypted-secret",
        is_two_factor_enabled=False,
        is_two_factor_verified=False,
    )
    usecase, session, _ = make_usecase(user, monkeypatch)

    response = asyncio.run(usecase.verify_2fa("secure@example.com", VerifyTwoFactorModel(code="123456"), attempts_remaining=4))

    assert response.enabled is True
    assert response.attempts_remaining == 4
    assert user.is_two_factor_enabled is True
    assert user.is_two_factor_verified is True
    assert session.updated_user is user


def test_verify_2fa_rejects_invalid_code(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=13,
        email=Email("secure2@example.com"),
        pseudo="secure2",
        uuid="uuid-13",
        password=Password("hashed::supersafepassword"),
        two_factor_secret="encrypted-secret",
        is_two_factor_enabled=False,
        is_two_factor_verified=False,
    )
    usecase, session, _ = make_usecase(user, monkeypatch)

    with pytest.raises(Invalid2FACodeError):
        asyncio.run(usecase.verify_2fa("secure2@example.com", VerifyTwoFactorModel(code="000000")))

    assert session.updated_user is None
    assert user.is_two_factor_enabled is False
    assert user.is_two_factor_verified is False


def test_disable_2fa_clears_secret_and_flags(monkeypatch: pytest.MonkeyPatch):
    user = User(
        id=14,
        email=Email("disable@example.com"),
        pseudo="disable",
        uuid="uuid-14",
        password=Password("hashed::supersafepassword"),
        two_factor_secret="encrypted-secret",
        is_two_factor_enabled=True,
        is_two_factor_verified=True,
    )
    usecase, session, manager = make_usecase(user, monkeypatch)

    response = asyncio.run(
        usecase.disable_2fa(
            "disable@example.com",
            "access-token",
            DisableTwoFactorModel(current_password="supersafepassword", code="123456"),
        )
    )

    assert response.enabled is False
    assert response.sessions_revoked is True
    assert response.reauth_required is True
    assert session.updated_user is user
    assert user.two_factor_secret is None
    assert user.is_two_factor_enabled is False
    assert user.is_two_factor_verified is False
    assert manager.invalidations == [("access-token", "14")]
    assert manager.global_invalidations == ["14"]


def test_two_factor_verify_rate_limiter_blocks_after_limit():
    limiter = SlidingWindowRateLimiter(limit=2, window_s=60)
    key = "verify_2fa_activation:ip:1.2.3.4:user:123"

    first = limiter.allow(key)
    assert first.allowed is True
    assert first.remaining_attempts == 1

    second = limiter.allow(key)
    assert second.allowed is True
    assert second.remaining_attempts == 0

    blocked = limiter.allow(key)
    assert blocked.allowed is False
    assert blocked.retry_after_s >= 1
    assert blocked.remaining_attempts == 0
