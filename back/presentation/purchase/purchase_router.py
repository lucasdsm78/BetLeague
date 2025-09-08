from fastapi import APIRouter, Depends, HTTPException, status, Request, Header

from application.purchase.purchase_command_model import PurchaseCreateResponse, PurchaseCreateModel
from application.purchase.purchase_command_usecase import PurchaseCommandUseCase
from dependency_injections import purchase_command_usecase, current_user
from domain.purchase.exception.pack_exception import PackNotFoundError
from domain.purchase.exception.purchase_exception import PurchaseNotFoundError
from domain.user.exception.user_exception import UserNotFoundError

router = APIRouter(
    tags=['purchase']
)

@router.post(
    "/purchase/create-intent",
    response_model=PurchaseCreateResponse,
    summary="Create a purchase intent",
    status_code=status.HTTP_200_OK,
)
async def verify_purchase_google(
        data: PurchaseCreateModel,
        purchase_command_usecase: PurchaseCommandUseCase = Depends(purchase_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        session_id = await purchase_command_usecase.create_intent(current_user.get('email', ''), data)

    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except PackNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    return session_id

@router.post(
    "/purchase/webhook",
    summary="Handle Stripe webhook",
    status_code=status.HTTP_200_OK,
)
async def handle_purchase_webhook(
        request: Request,
        stripe_signature: str = Header(..., alias="Stripe-Signature"),        purchase_command_usecase: PurchaseCommandUseCase = Depends(purchase_command_usecase),
):
    try:
        payload = await request.body()
        await purchase_command_usecase.handle_webhook(payload, stripe_signature)

    except PurchaseNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return True
