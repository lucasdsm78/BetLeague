import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header

from application.purchase.purchase_command_model import PurchaseCreateResponse, PurchaseCreateModel
from application.purchase.purchase_command_usecase import PurchaseCommandUseCase
from application.purchase.purchase_query_model import PacksListResponse, PackResponse, PurchasesListResponse, \
    PurchaseItemResponse
from application.purchase.purchase_query_usecase import PurchaseQueryUseCase
from dependency_injections import purchase_command_usecase, purchase_query_usecase, current_user
from domain.purchase.exception.pack_exception import PackNotFoundError
from domain.purchase.exception.purchase_exception import PurchaseNotFoundError, InvalidWebhookError
from domain.shop.exception.shop_exception import ShopFeatureDisabledError
from domain.user.exception.user_exception import UserNotFoundError

router = APIRouter(
    prefix="/api",
    tags=['purchase']
)

logger = logging.getLogger(__name__)


def _raise_shop_feature_disabled(error: ShopFeatureDisabledError) -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "message": error.message,
            "code": error.code,
        },
    )

@router.get(
    "/packs",
    response_model=PacksListResponse,
    summary="Get all available BTL packs",
    status_code=status.HTTP_200_OK,
)
async def get_all_packs(
        purchase_query_usecase: PurchaseQueryUseCase = Depends(purchase_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        packs = await purchase_query_usecase.get_all_packs(current_user.get('email', ''))

        return PacksListResponse(
            packs=[
                PackResponse(
                    id=pack.id,
                    name=pack.name,
                    price_cents=pack.price_cents,
                    nb_btl=pack.nb_btl,
                    bonus=pack.bonus,
                    total_btl=pack.total_btl,
                    price_per_100=pack.price_per_100,
                    note=pack.note,
                    created_at=pack.created_at
                )
                for pack in packs
            ]
        )
    except ShopFeatureDisabledError as e:
        _raise_shop_feature_disabled(e)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get(
    "/purchases",
    response_model=PurchasesListResponse,
    summary="Get BTL purchases of the connected user",
    status_code=status.HTTP_200_OK,
)
async def get_my_purchases(
        purchase_query_usecase: PurchaseQueryUseCase = Depends(purchase_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        purchases = await purchase_query_usecase.get_user_purchases(current_user.get('email', ''))

        return PurchasesListResponse(
            purchases=[
                PurchaseItemResponse(
                    id=purchase.id,
                    uuid=purchase.uuid,
                    status=purchase.status.value,
                    created_at=purchase.created_at,
                    pack_id=purchase.pack.id,
                    pack_name=purchase.pack.name,
                    pack_price_cents=purchase.pack.price_cents,
                    pack_total_btl=purchase.pack.total_btl,
                )
                for purchase in purchases
            ]
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/purchase/create-intent",
    response_model=PurchaseCreateResponse,
    summary="Create a purchase intent",
    status_code=status.HTTP_200_OK,
)
async def verify_purchase_google(
        request: Request,
        data: PurchaseCreateModel,
        purchase_command_usecase: PurchaseCommandUseCase = Depends(purchase_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        session_id = await purchase_command_usecase.create_intent(current_user.get('email', ''), data)
        logger.info(
            "purchase.intent.requested",
            extra={
                "user_id": current_user.get("id"),
                "pack_id": data.pack_id,
                "method": request.method,
                "path": request.url.path,
            },
        )

    except UserNotFoundError as e:
        logger.warning("purchase.intent.rejected", extra={"reason": "user_not_found", "pack_id": data.pack_id})
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except PackNotFoundError as e:
        logger.warning("purchase.intent.rejected", extra={"reason": "pack_not_found", "pack_id": data.pack_id, "user_id": current_user.get("id")})
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except ShopFeatureDisabledError as e:
        logger.warning("purchase.intent.rejected", extra={"reason": "shop_disabled", "user_id": current_user.get("id"), "pack_id": data.pack_id})
        _raise_shop_feature_disabled(e)

    return session_id

@router.post(
    "/purchase/webhook",
    summary="Handle Stripe webhook",
    status_code=status.HTTP_200_OK,
)
async def handle_purchase_webhook(
        request: Request,
        stripe_signature: str = Header(None, alias="Stripe-Signature"),
        purchase_command_usecase: PurchaseCommandUseCase = Depends(purchase_command_usecase),
):
    try:
        if not stripe_signature:
            logger.warning(
                "purchase.webhook.rejected",
                extra={
                    "reason": "missing_signature",
                    "method": request.method,
                    "path": request.url.path,
                },
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signature Stripe manquante")
        payload = await request.body()
        logger.info(
            "purchase.webhook.received",
            extra={
                "payload_size": len(payload),
                "method": request.method,
                "path": request.url.path,
            },
        )
        await purchase_command_usecase.handle_webhook(payload, stripe_signature)

    except PurchaseNotFoundError as e:
        logger.warning("purchase.webhook.rejected", extra={"reason": "purchase_not_found"})
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except InvalidWebhookError as e:
        logger.warning("purchase.webhook.rejected", extra={"reason": "invalid_signature"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )

    except Exception as e:
        logger.exception("purchase.webhook.failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return True
