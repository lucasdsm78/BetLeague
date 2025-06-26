from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File

from application.purchase.purchase_command_model import PurchaseCreateResponse, PurchaseCreateModel
from application.purchase.purchase_command_usecase import PurchaseCommandUseCase
from dependency_injections import purchase_command_usecase, current_user
from domain.purchase.exception.purchase_exception import PurchaseTokenAlreadyExists

router = APIRouter(
    tags=['purchase']
)

@router.post(
    "/purchase/google/verify",
    response_model=PurchaseCreateResponse,
    summary="Verify google purchase",
    status_code=status.HTTP_200_OK,
)
async def verify_purchase_google(
        data: PurchaseCreateModel,
        purchase_command_usecase: PurchaseCommandUseCase = Depends(purchase_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        purchase = purchase_command_usecase.verify_purchase_and_grant_points(current_user.get('email', ''), data)

    except PurchaseTokenAlreadyExists as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return purchase
