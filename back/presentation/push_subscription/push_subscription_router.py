from __future__ import annotations

from fastapi import APIRouter, Depends, Header, status, Request, HTTPException

from dependency_injections import current_user, push_subscription_usecase
from application.push_subscription.push_subscription_usecase import PushSubscriptionUseCase
from application.push_subscription.push_subscription_models import (
    PushSubscribeRequest,
    PushUnsubscribeRequest,
    VapidPublicKeyResponse,
    PushSubscriptionStatusResponse,
)


router = APIRouter(prefix="/api/push", tags=["push-notifications"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse, status_code=status.HTTP_200_OK)
async def get_vapid_public_key(
    uc: PushSubscriptionUseCase = Depends(push_subscription_usecase),
):
    public_key = await uc.get_vapid_public_key()
    return VapidPublicKeyResponse(public_key=public_key)


_SUBSCRIBE_BUCKET: dict[tuple[str, int], list[int]] = {}


def _rate_limit_subscribe(*, ip: str, user_id: int, limit: int = 10, window_s: int = 60) -> None:
    import time

    now = int(time.time())
    key = (ip, user_id)
    arr = _SUBSCRIBE_BUCKET.get(key, [])
    arr = [t for t in arr if (now - t) <= window_s]
    if len(arr) >= limit:
        raise HTTPException(status_code=429, detail="Trop de tentatives, réessaie plus tard")
    arr.append(now)
    _SUBSCRIBE_BUCKET[key] = arr


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    request: Request,
    body: PushSubscribeRequest,
    user: dict = Depends(current_user),
    user_agent: str | None = Header(default=None, alias="User-Agent"),
    uc: PushSubscriptionUseCase = Depends(push_subscription_usecase),
):
    user_id = int(user["id"])
    ip = request.client.host if request.client else "unknown"
    _rate_limit_subscribe(ip=ip, user_id=user_id)
    await uc.subscribe(
        user_id=user_id,
        endpoint=body.endpoint,
        p256dh_key=body.keys.p256dh,
        auth_key=body.keys.auth,
        user_agent=user_agent,
    )


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    body: PushUnsubscribeRequest,
    user: dict = Depends(current_user),
    uc: PushSubscriptionUseCase = Depends(push_subscription_usecase),
):
    user_id = int(user["id"])
    await uc.unsubscribe(user_id=user_id, endpoint=body.endpoint)


@router.delete("/unsubscribe-all", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_all(
    user: dict = Depends(current_user),
    uc: PushSubscriptionUseCase = Depends(push_subscription_usecase),
):
    user_id = int(user["id"])
    await uc.unsubscribe_all(user_id=user_id)


@router.get("/status", response_model=PushSubscriptionStatusResponse, status_code=status.HTTP_200_OK)
async def get_status(
    user: dict = Depends(current_user),
    uc: PushSubscriptionUseCase = Depends(push_subscription_usecase),
):
    user_id = int(user["id"])
    subscribed, count = await uc.get_status(user_id=user_id)
    return PushSubscriptionStatusResponse(subscribed=subscribed, subscription_count=count)
