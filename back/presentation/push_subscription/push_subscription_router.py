from __future__ import annotations

from fastapi import APIRouter, Depends, Header, status

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


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(
    body: PushSubscribeRequest,
    user: dict = Depends(current_user),
    user_agent: str | None = Header(default=None, alias="User-Agent"),
    uc: PushSubscriptionUseCase = Depends(push_subscription_usecase),
):
    user_id = int(user["id"])
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
    from infrastructure.postgresql.push_subscription.push_subscription_repository import PushSubscriptionRepositoryImpl
    from dependency_injections import get_session_factory

    user_id = int(user["id"])
    session_factory = get_session_factory()

    async with session_factory() as session:
        repo = PushSubscriptionRepositoryImpl(session)
        subscriptions = await repo.find_by_user_id(user_id)

    return PushSubscriptionStatusResponse(
        subscribed=len(subscriptions) > 0,
        subscription_count=len(subscriptions),
    )
