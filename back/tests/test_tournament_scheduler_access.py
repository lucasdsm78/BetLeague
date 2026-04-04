from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from dependency_injections import require_scheduler_access


class FakeManagerToken:
    def __init__(self, decoded=None):
        self.decoded = decoded

    async def verify_token(self, token: str):
        return self.decoded


class FakeUserRepository:
    def __init__(self, user=None):
        self.user = user

    async def find_by_email(self, email: str):
        return self.user


def make_request(*, internal_token: str | None = None):
    headers = []
    if internal_token is not None:
        headers.append((b"x-internal-token", internal_token.encode()))
    return Request({"type": "http", "headers": headers})


@pytest.mark.asyncio
async def test_require_scheduler_access_accepts_valid_internal_token():
    settings = SimpleNamespace(
        scheduler_internal_token="super-secret-token",
        scheduler_admin_emails="",
    )

    allowed = await require_scheduler_access(
        request=make_request(internal_token="super-secret-token"),
        settings=settings,
        manager_token=FakeManagerToken(),
        user_repository=FakeUserRepository(),
        token=None,
    )

    assert allowed is True


@pytest.mark.asyncio
async def test_require_scheduler_access_accepts_admin_email_from_valid_jwt():
    settings = SimpleNamespace(
        scheduler_internal_token="",
        scheduler_admin_emails="admin@test.local, other@test.local",
    )

    allowed = await require_scheduler_access(
        request=make_request(),
        settings=settings,
        manager_token=FakeManagerToken(decoded={"email": "admin@test.local"}),
        user_repository=FakeUserRepository(user=object()),
        token="jwt-token",
    )

    assert allowed is True


@pytest.mark.asyncio
async def test_require_scheduler_access_rejects_missing_credentials():
    settings = SimpleNamespace(
        scheduler_internal_token="expected-token",
        scheduler_admin_emails="admin@test.local",
    )

    with pytest.raises(HTTPException) as exc:
        await require_scheduler_access(
            request=make_request(),
            settings=settings,
            manager_token=FakeManagerToken(decoded=None),
            user_repository=FakeUserRepository(user=None),
            token=None,
        )

    assert exc.value.status_code == 403

