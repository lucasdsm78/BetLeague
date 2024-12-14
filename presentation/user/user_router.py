from fastapi import APIRouter, Depends, HTTPException, status

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
    response_model=UserLoginResponse
)
async def login(
        user_login_model: UserLoginModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
):
    return user_command_usecase.login(user_login_model).for_login()


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
