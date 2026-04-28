import asyncio
import logging
from types import SimpleNamespace

from cryptography.fernet import Fernet
import pytest

from application.user.user_command_model import ChangeMyPasswordModel
from application.user.user_command_usecase import UserCommandUseCaseImpl
from application.user.user_command_model import InvalidPasswordError
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


def test_change_password_success_revokes_tokens_and_updates_hash(caplog: pytest.LogCaptureFixture):
    user = User(
        id=1,
        email=Email("player@example.com"),
        pseudo="player",
        uuid="uuid",
        password=Password("hashed::oldpassword123"),
        is_two_factor_enabled=True,
        two_factor_secret="encrypted-secret",
    )
    usecase, repo, manager, _ = make_usecase(user)

    with caplog.at_level(logging.INFO, logger="application.user.user_command_usecase"):
        res = asyncio.run(
            usecase.change_my_password(
                "player@example.com",
                "access-token",
                ChangeMyPasswordModel(
                    current_password="oldpassword123",
                    new_password="newpassword456",
                    two_fa_code="123456",
                ),
            )
        )

    assert res.message == "Mot de passe mis à jour."
    assert res.reauth_required is True
    assert repo.commit_called is True
    assert repo.rollback_called is False
    assert repo.updated_user is not None
    assert repo.updated_user.password.password == "hashed::newpassword456"
    assert manager.invalidations == [("access-token", "1")]
    assert manager.global_invalidations == ["1"]
    password_logs = [record for record in caplog.records if record.getMessage() == "auth.password_changed"]
    assert password_logs
    assert password_logs[-1].layer == "use_case"
    assert password_logs[-1].user_id == 1
    assert password_logs[-1].reauth_required is True


def test_change_password_rejects_invalid_current_password(caplog: pytest.LogCaptureFixture):
    user = User(
        id=2,
        email=Email("player2@example.com"),
        pseudo="player2",
        uuid="uuid2",
        password=Password("hashed::correctpass"),
        is_two_factor_enabled=False,
    )
    usecase, repo, manager, _ = make_usecase(user)

    with caplog.at_level(logging.WARNING, logger="application.user.user_command_usecase"):
        with pytest.raises(InvalidPasswordError):
            asyncio.run(
                usecase.change_my_password(
                    "player2@example.com",
                    "access-token",
                    ChangeMyPasswordModel(
                        current_password="wrongpass",
                        new_password="newstrongpass",
                    ),
                )
            )

    assert repo.commit_called is False
    assert repo.updated_user is None
    assert manager.invalidations == []
    rejection_logs = [record for record in caplog.records if record.getMessage() == "auth.password_change_rejected"]
    assert rejection_logs
    assert rejection_logs[-1].layer == "use_case"
    assert rejection_logs[-1].reason == "invalid_password"


def test_change_password_requires_two_factor_code_when_enabled():
    user = User(
        id=3,
        email=Email("secure@example.com"),
        pseudo="secure",
        uuid="uuid3",
        password=Password("hashed::currentpass"),
        is_two_factor_enabled=True,
        two_factor_secret="encrypted-secret",
    )
    usecase, repo, manager, totp = make_usecase(user)

    with pytest.raises(FARequiredError):
        asyncio.run(
            usecase.change_my_password(
                "secure@example.com",
                "access-token",
                ChangeMyPasswordModel(
                    current_password="currentpass",
                    new_password="newpass999",
                ),
            )
        )

    assert repo.commit_called is False
    assert manager.invalidations == []
    assert totp.decrypt_calls == 0


def test_change_password_rejects_invalid_two_factor_code():
    user = User(
        id=4,
        email=Email("doublecheck@example.com"),
        pseudo="doublecheck",
        uuid="uuid4",
        password=Password("hashed::currentpass"),
        is_two_factor_enabled=True,
        two_factor_secret="encrypted-secret",
    )
    usecase, repo, manager, totp = make_usecase(user)

    with pytest.raises(Invalid2FACodeError):
        asyncio.run(
            usecase.change_my_password(
                "doublecheck@example.com",
                "access-token",
                ChangeMyPasswordModel(
                    current_password="currentpass",
                    new_password="newpass999",
                    two_fa_code="000000",
                ),
            )
        )

    assert repo.commit_called is False
    assert manager.invalidations == []
    assert totp.decrypt_calls == 1

