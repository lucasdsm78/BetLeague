import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from application.user.user_command_model import UserCreateModel, UserLoginResponse, \
    UserLoginModel, UserDeleteResponse
from application.user.user_command_usecase import UserCommandUseCase
from application.user.user_query_usecase import UserQueryUseCase
from domain.user.exception.user_exception import UserEmailAlreadyExistsError, UsersNotFoundError, UserNotFoundError
from presentation.user.user_error_message import ErrorMessageUserEmailAlreadyExists, ErrorMessageUsersNotFound, \
    ErrorMessageUserNotFound
from dependency_injections import current_user, user_command_usecase, user_query_usecase

router = APIRouter(
    tags=['user']
)


@router.post(
    "/user/create",
    response_model=UserLoginResponse,
    summary="Create a user",
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_409_CONFLICT: {
            "model": ErrorMessageUserEmailAlreadyExists,
        },
    },
)
async def create_user(
        data: UserCreateModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
):
    try:
        user = user_command_usecase.create(data)

    except UserEmailAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except Exception as e:
        print(e)
        raise

    return user


@router.get(
    "/users",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorMessageUsersNotFound,
        }
    }
)
async def get_users(
        user_query_usecase: UserQueryUseCase = Depends(user_query_usecase),
):
    try:
        users = user_query_usecase.fetch_users()

    except Exception as e:
        print(e)
        raise

    if not len(users.get("users")):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=UsersNotFoundError.message,
        )

    return users


@router.post(
    "/user/login",
    response_model=UserLoginResponse,
    summary="User Login with 2FA",
)
async def login(
        user_login_model: UserLoginModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
):
    try:
        user = user_command_usecase.login(user_login_model)
        return user.for_login()
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed."
        )


@router.delete(
    "/user/{id}/delete",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete a user",
    response_model=UserDeleteResponse,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorMessageUserNotFound,
        },
    },
)
async def delete_user(
        id: int,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        delete_user = user_command_usecase.delete_user(id)
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return delete_user


@router.post(
    "/user/enable-2fa",
    summary="Enable Two-Factor Authentication",
    status_code=status.HTTP_200_OK,
)
async def enable_2fa(
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        qr_code_bytes = user_command_usecase.enable_2fa(current_user.get('email', ''))
        return StreamingResponse(io.BytesIO(qr_code_bytes), media_type="image/png")
    except HTTPException as e:
        print(e)
        raise e
    except Exception as e:
        print(e)
        raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to enable 2FA."
            )


@router.post(
    "/user/verify-2fa",
    summary="Verify Two-Factor Authentication",
    status_code=status.HTTP_200_OK,
)
async def verify_2fa(
        code: str,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        is_valid = user_command_usecase.verify_2fa(current_user.get('email', ''), code)
        if is_valid:
            return {"message": "2FA verified successfully."}
    except HTTPException as e:
        raise e
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify 2FA."
        )
