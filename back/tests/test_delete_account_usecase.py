import asyncio
import logging
from types import SimpleNamespace

from cryptography.fernet import Fernet
import pytest

from application.user.user_command_model import DeleteMyAccountModel
from application.user.user_command_usecase import UserCommandUseCaseImpl
from domain.user.exception.user_exception import FARequiredError, Invalid2FACodeError
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User


class FakeUserRepository:
    def __init__(self, user: User | None):
        self.user = user
        self.updated_user = None
        self.commit_called = False
        self.rollback_called = False

    async def find_by_email(self, email: str):
        if self.user and self.user.email.value == email:
            return self.user
        return None

    async def update(self, user: User):
        self.updated_user = user
        self.user = user
        return user

    async def commit(self):
        self.commit_called = True

    async def rollback(self):
        self.rollback_called = True


class FakeHash:
    async def verify(self, plain: str, hashed: str) -> bool:
        return hashed == f"hashed::{plain}"

    async def bcrypt(self, plain: str) -> str:
        return f"hashed::{plain}"


class FakeManagerToken:
    def __init__(self):
        self.invalidations = []
        self.global_invalidations = []

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
        self.decrypt_calls = 0

    async def decrypt_secret(self, encrypted_secret: str, cipher_suite):
        self.decrypt_calls += 1
        return "plain-secret"

    async def verify_code(self, secret: str, code: str) -> bool:
        return secret == "plain-secret" and code == self.expected_code


def make_usecase(user: User, totp_service: FakeTOTPService | None = None):
    repo = FakeUserRepository(user)
    manager = FakeManagerToken()
    totp = totp_service or FakeTOTPService()
    settings = SimpleNamespace(
        encryption_key=Fernet.generate_key().decode(),
        access_token_expire_minutes=15,
    )
    usecase = UserCommandUseCaseImpl(
        user_repository=repo,
        hasher=FakeHash(),
        session_factory=lambda: None,
        manager_token=manager,
        totp_service=totp,
        settings=settings,
    )
    return usecase, repo, manager, totp


def test_delete_current_user_marks_account_deleted_and_revokes_token(caplog: pytest.LogCaptureFixture):
    user = User(
        id=42,
        email=Email("player@example.com"),
        pseudo="player42",
        uuid="uuid-42",
        password=Password("hashed::supersafepassword"),
        is_tournament_subscriber=True,
        is_two_factor_enabled=True,
        two_factor_secret="encrypted-secret",
    )
    usecase, repo, manager, _ = make_usecase(user)

    with caplog.at_level(logging.INFO, logger="application.user.user_command_usecase"):
        response = asyncio.run(
            usecase.delete_current_user(
                "player@example.com",
                "access-token",
                DeleteMyAccountModel(current_password="supersafepassword", two_fa_code="123456"),
            )
        )

    assert response.message == "Compte supprimé avec succès."
    assert repo.commit_called is True
    assert repo.rollback_called is False
    assert repo.updated_user is not None
    assert repo.updated_user.deleted_at is not None
    assert repo.updated_user.email.value.endswith("@deletedlocal.com")
    assert repo.updated_user.pseudo.startswith("deleted-user-42-")
    assert repo.updated_user.uuid != "uuid-42"
    assert repo.updated_user.password.password.startswith("hashed::")
    assert repo.updated_user.two_factor_secret is None
    assert repo.updated_user.is_two_factor_enabled is False
    assert repo.updated_user.is_two_factor_verified is False
    assert repo.updated_user.is_tournament_subscriber is False
    assert manager.invalidations == [("access-token", "42")]
    assert manager.global_invalidations == ["42"]
    delete_logs = [record for record in caplog.records if record.getMessage() == "auth.account.deleted"]
    assert delete_logs
    assert delete_logs[-1].layer == "use_case"
    assert delete_logs[-1].user_id == 42


def test_delete_current_user_requires_two_factor_code_when_enabled():
    user = User(
        id=7,
        email=Email("secure@example.com"),
        pseudo="secure-user",
        uuid="uuid-7",
        password=Password("hashed::verysecurepassword"),
        is_two_factor_enabled=True,
        two_factor_secret="encrypted-secret",
    )
    usecase, repo, manager, totp = make_usecase(user)

    with pytest.raises(FARequiredError):
        asyncio.run(
            usecase.delete_current_user(
                "secure@example.com",
                "access-token",
                DeleteMyAccountModel(current_password="verysecurepassword"),
            )
        )

    assert repo.commit_called is False
    assert repo.updated_user is None
    assert manager.invalidations == []
    assert totp.decrypt_calls == 0


def test_delete_current_user_rejects_invalid_two_factor_code():
    user = User(
        id=9,
        email=Email("doublecheck@example.com"),
        pseudo="doublecheck",
        uuid="uuid-9",
        password=Password("hashed::anothersecurepassword"),
        is_two_factor_enabled=True,
        two_factor_secret="encrypted-secret",
    )
    usecase, repo, manager, totp = make_usecase(user)

    with pytest.raises(Invalid2FACodeError):
        asyncio.run(
            usecase.delete_current_user(
                "doublecheck@example.com",
                "access-token",
                DeleteMyAccountModel(current_password="anothersecurepassword", two_fa_code="000000"),
            )
        )

    assert repo.commit_called is False
    assert repo.updated_user is None
    assert manager.invalidations == []
    assert totp.decrypt_calls == 1

