from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from application.user.user_command_model import UserLoginModel
from dependency_injections import (
    get_request_client_ip,
    rate_limit_disable_2fa,
    rate_limit_login_with_2fa_code,
    rate_limit_tournament_mutation,
    rate_limit_verify_2fa_activation,
)
from infrastructure.security.sse_rate_limiter import SlidingWindowRateLimiter


def _make_request(ip: str = "1.2.3.4", method: str = "POST", path: str = "/api/tournament/create", headers: dict | None = None):
    return SimpleNamespace(
        headers=headers or {},
        client=SimpleNamespace(host=ip),
        method=method,
        url=SimpleNamespace(path=path),
        scope={"method": method, "route": SimpleNamespace(path=path)},
    )


@pytest.mark.asyncio
async def test_login_rate_limit_dependency_blocks_even_when_code_missing():
    request = _make_request()
    limiter = SlidingWindowRateLimiter(limit=1, window_s=60)
    payload = UserLoginModel(email="player@example.com", password="supersafepassword", code=None)

    assert await rate_limit_login_with_2fa_code(request, payload, limiter) is True

    with pytest.raises(HTTPException) as exc:
        await rate_limit_login_with_2fa_code(request, payload, limiter)

    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "RATE_LIMITED"
    assert int(exc.value.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_login_2fa_rate_limit_dependency_blocks_when_code_present():
    request = _make_request()
    limiter = SlidingWindowRateLimiter(limit=1, window_s=60)
    payload = UserLoginModel(email="player@example.com", password="supersafepassword", code="123456")

    assert await rate_limit_login_with_2fa_code(request, payload, limiter) is True

    with pytest.raises(HTTPException) as exc:
        await rate_limit_login_with_2fa_code(request, payload, limiter)

    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "RATE_LIMITED"
    assert int(exc.value.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_disable_2fa_rate_limit_dependency_blocks_after_limit():
    request = _make_request()
    limiter = SlidingWindowRateLimiter(limit=1, window_s=60)
    current_user = {"id": 42}

    assert await rate_limit_disable_2fa(request, current_user, limiter) is True

    with pytest.raises(HTTPException) as exc:
        await rate_limit_disable_2fa(request, current_user, limiter)

    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "RATE_LIMITED"
    assert int(exc.value.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_verify_2fa_rate_limit_dependency_returns_attempts_remaining_then_blocks():
    request = _make_request()
    limiter = SlidingWindowRateLimiter(limit=2, window_s=60)
    current_user = {"id": 42}

    first = await rate_limit_verify_2fa_activation(request, current_user, limiter)
    assert first.attempts_remaining == 1

    second = await rate_limit_verify_2fa_activation(request, current_user, limiter)
    assert second.attempts_remaining == 0

    with pytest.raises(HTTPException) as exc:
        await rate_limit_verify_2fa_activation(request, current_user, limiter)

    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "RATE_LIMITED"
    assert exc.value.detail["attempts_remaining"] == 0
    assert int(exc.value.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_tournament_mutation_rate_limit_dependency_blocks_after_limit():
    request = _make_request(path="/api/tournament/12/join")
    limiter = SlidingWindowRateLimiter(limit=1, window_s=60)
    current_user = {"id": 42}

    assert await rate_limit_tournament_mutation(request, current_user, limiter) is True

    with pytest.raises(HTTPException) as exc:
        await rate_limit_tournament_mutation(request, current_user, limiter)

    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "RATE_LIMITED"
    assert int(exc.value.headers["Retry-After"]) >= 1


def test_get_request_client_ip_ignores_forwarded_header_for_untrusted_proxy():
    request = _make_request(
        ip="10.0.0.10",
        headers={"x-forwarded-for": "203.0.113.25, 10.0.0.10"},
    )
    settings = SimpleNamespace(trusted_proxy_ips_list=["127.0.0.1"])

    assert get_request_client_ip(request, settings) == "10.0.0.10"


def test_get_request_client_ip_uses_forwarded_header_for_trusted_proxy():
    request = _make_request(
        ip="10.0.0.10",
        headers={"x-forwarded-for": "203.0.113.25, 10.0.0.10"},
    )
    settings = SimpleNamespace(trusted_proxy_ips_list=["10.0.0.10"])

    assert get_request_client_ip(request, settings) == "203.0.113.25"


