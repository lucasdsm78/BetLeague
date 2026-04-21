from __future__ import annotations

from fastapi import Request

from infrastructure.config import Settings


def get_request_client_ip(request: Request, settings: Settings) -> str:
    direct_ip = request.client.host if request.client else "unknown"
    trusted_proxy_ips = set(getattr(settings, "trusted_proxy_ips_list", []))
    if direct_ip in trusted_proxy_ips:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return direct_ip
