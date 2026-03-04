from __future__ import annotations

import json
from typing import Any

try:
    import orjson  # type: ignore
except Exception:  # pragma: no cover
    orjson = None


def nats_dumps(obj: dict[str, Any]) -> str:
    if orjson is not None:
        return orjson.dumps(obj).decode("utf-8")
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def nats_encode(payload: dict[str, Any]) -> bytes:
    if orjson is not None:
        return orjson.dumps(payload)
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def nats_loads(data: bytes) -> dict[str, Any]:
    if orjson is not None:
        return orjson.loads(data)
    return json.loads(data.decode("utf-8"))
