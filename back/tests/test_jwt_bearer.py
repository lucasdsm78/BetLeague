from __future__ import annotations

import asyncio

from starlette.requests import Request

from infrastructure.services.authentication.jwt_bearer import JwtBearer


def _make_request(headers: list[tuple[bytes, bytes]]) -> Request:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/secure",
        "raw_path": b"/secure",
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    return Request(scope)


def test_jwt_bearer_accepts_standard_authorization_header():
    bearer = JwtBearer()
    request = _make_request([
        (b"authorization", b"Bearer auth-token-123"),
    ])

    token = asyncio.run(bearer(request))

    assert token == "auth-token-123"


def test_jwt_bearer_falls_back_to_legacy_x_authentication_header():
    bearer = JwtBearer()
    request = _make_request([
        (b"x-authentication", b"Bearer legacy-token-456"),
    ])

    token = asyncio.run(bearer(request))

    assert token == "legacy-token-456"


def test_jwt_bearer_prefers_authorization_when_both_headers_are_present():
    bearer = JwtBearer()
    request = _make_request([
        (b"authorization", b"Bearer preferred-token"),
        (b"x-authentication", b"Bearer legacy-token"),
    ])

    token = asyncio.run(bearer(request))

    assert token == "preferred-token"


