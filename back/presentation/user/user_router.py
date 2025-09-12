import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from application.user.user_command_model import UserCreateModel, UserLoginResponse, \
    UserLoginModel, UserDeleteResponse, UserUpdateResponse, UserUpdateModel
from application.user.user_command_usecase import UserCommandUseCase
from application.user.user_query_model import UserReadModel
from application.user.user_query_usecase import UserQueryUseCase
from domain.user.exception.user_exception import UserEmailAlreadyExistsError, UsersNotFoundError, UserNotFoundError, \
    FARequiredError, Invalid2FACodeError, UserPseudoAlreadyExistsError, UserNotOwnerError
from presentation.user.user_error_message import ErrorMessageUserEmailAlreadyExists, ErrorMessageUsersNotFound, \
    ErrorMessageUserNotFound
from dependency_injections import current_user, user_command_usecase, user_query_usecase

router = APIRouter(
    prefix="/api/auth",
    tags=['auth']
)


@router.post(
    "/register",
    response_model=UserLoginResponse,
    summary="Register a new user",
    status_code=status.HTTP_201_CREATED,
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
        user = await user_command_usecase.create(data)

    except UserEmailAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except Exception as e:
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
        users = await user_query_usecase.fetch_users()

    except Exception as e:
        raise

    if not len(users.get("users")):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=UsersNotFoundError.message,
        )

    return users


@router.post(
    "/login",
    response_model=UserLoginResponse,
    summary="User Login",
)
async def login(
        user_login_model: UserLoginModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
):
    try:
        user = await user_command_usecase.login(user_login_model)
        return user.for_login()
    except HTTPException as e:
        raise e
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed."
        )


@router.get(
    "/validate",
    summary="Validate JWT token",
    status_code=status.HTTP_200_OK,
)
async def validate_token(
        current_user: dict = Depends(current_user)
):
    try:
        return {
            "user": {
                "id": current_user.get("id"),
                "email": current_user.get("email"),
                "username": current_user.get("username", current_user.get("pseudo")),
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
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
        delete_user = await user_command_usecase.delete_user(id)
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
        qr_code_bytes = await user_command_usecase.enable_2fa(current_user.get('email', ''))
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
        is_valid = await user_command_usecase.verify_2fa(current_user.get('email', ''), code)
        if is_valid:
            return {"message": "2FA verified successfully."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify 2FA."
        )

@router.get(
    "/users/rank",
    summary="Get the general ranking",
    status_code=status.HTTP_200_OK,
)
async def get_general_ranking(
        user_query_usecase: UserQueryUseCase = Depends(user_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        return user_query_usecase.get_all_rank_users()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred."
        )

@router.put(
    "/user",
    response_model=UserUpdateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Update user",
)
async def update_user(
        update_user_model: UserUpdateModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        update_user_result = await user_command_usecase.update_user_profile(current_user.get('email'), update_user_model)
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except FARequiredError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Invalid2FACodeError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except UserPseudoAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
    except UserEmailAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du user"
        )

    return update_user_result


@router.get(
    "/user/{user_id}",
    response_model=UserReadModel,
    status_code=status.HTTP_200_OK,
    summary="Get détails user connected"
)
async def get_user_by_id(
        user_id: int,
        user_query_usecase: UserQueryUseCase = Depends(user_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        user = await user_query_usecase.fetch_user_by_id(user_id, current_user.get('email'))
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except UserNotOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération du user."
        )

    return user
