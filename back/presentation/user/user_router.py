import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse

from application.user.user_command_model import (
    UserCreateModel, UserLoginResponse, UserLoginModel, UserDeleteResponse,
    UserUpdateResponse, UserUpdateModel, RefreshTokenResponse, RefreshTokenModel,
    InvalidPasswordError
)
from application.user.user_command_usecase import UserCommandUseCase
from application.user.user_query_model import UserReadModel, UserSearchQuery, UserSearchResponse
from application.user.user_query_usecase import UserQueryUseCase
from application.user.password_reset_models import (
    PasswordForgotRequest,
    PasswordForgotResponse,
    PasswordResetVerifyRequest,
    PasswordResetVerifyResponse,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
)
from application.user.password_reset_usecase import PasswordResetUseCase
from domain.user.exception.user_exception import (
    UserEmailAlreadyExistsError, UsersNotFoundError, UserNotFoundError,
    FARequiredError, Invalid2FACodeError, UserPseudoAlreadyExistsError, UserNotOwnerError,
    UserLoginNotFoundError
)
from domain.user.exception.password_reset_exception import (
    PasswordResetRateLimitedError,
    PasswordResetInvalidCodeError,
    PasswordResetInvalidTokenError,
)
from presentation.user.user_error_message import (
    ErrorMessageUserEmailAlreadyExists, ErrorMessageUsersNotFound, ErrorMessageUserNotFound
)
from dependency_injections import (
    current_user, user_command_usecase, user_query_usecase, password_reset_usecase
)

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
        print(e)
        raise

    return user


@router.post(
    "/logout",
    summary="Logout current device",
    status_code=status.HTTP_200_OK,
)
async def logout_current_device(
        current_user: dict = Depends(current_user),
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase)
):
    try:
        user_id = current_user.get("id") or current_user.get("uuid", "")
        token = current_user.get("token", "")  # We'll need to pass the token in the dependency

        result = await user_command_usecase.logout(user_id, token)
        return result

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Logout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la déconnexion"
        )


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
    except (UserLoginNotFoundError, InvalidPasswordError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Email ou mot de passe incorrect.",
                "code": "INVALID_CREDENTIALS"
            }
        )
    except FARequiredError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "2FA code required.",
                "code": "TWO_FACTOR_REQUIRED",
                "two_factor_required": True
            }
        )
    except Invalid2FACodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid 2FA code.",
                "code": "INVALID_2FA_CODE",
                "two_factor_required": True
            }
        )
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


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    summary="Refresh JWT token",
    status_code=status.HTTP_200_OK,
)
async def refresh_token(
        refresh_data: RefreshTokenModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase)
):
    try:
        print(f"🔄 Refresh token request: {refresh_data.refresh_token[:20]}...")

        # Call use case to refresh token
        result = await user_command_usecase.refresh_token(refresh_data.refresh_token)

        print(f"✅ Token refreshed successfully")
        return result

    except HTTPException as e:
        print(f"❌ Token refresh failed: {e.detail}")
        raise e
    except Exception as e:
        print(f"❌ Unexpected error during token refresh: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
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
        return await user_query_usecase.get_all_rank_users()

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
    "/users/search",
    response_model=UserSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search users by pseudo or email",
    description="Search users with secure validation. Requires authentication."
)
async def search_users(
        q: str,
        limit: Optional[int] = 10,
        user_query_usecase: UserQueryUseCase = Depends(user_query_usecase),
        current_user: dict = Depends(current_user),
) -> UserSearchResponse:
    try:
        search_query = UserSearchQuery(
            query=q,
            limit=min(limit or 10, 20)  # Cap limit for security
        )

        result = await user_query_usecase.search_users(search_query)

        return result

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        print(f"❌ User search router error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la recherche d'utilisateurs"
        )


@router.get(
    "/me",
    response_model=UserReadModel,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
async def get_me(
        user_query_usecase: UserQueryUseCase = Depends(user_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        user_id = current_user.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Utilisateur non authentifié"
            )

        return await user_query_usecase.fetch_user_by_id(user_id, current_user.get('email'))

    except HTTPException as e:
        raise e
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UserNotOwnerError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération du profil"
        )


@router.post(
    "/forgot-password",
    response_model=PasswordForgotResponse,
    summary="Request password reset (sends code)",
    status_code=status.HTTP_200_OK,
)
async def forgot_password(
    request: Request,
    data: PasswordForgotRequest,
    password_reset_uc: PasswordResetUseCase = Depends(password_reset_usecase),
):
    client_ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown"))
    client_key = f"ip:{client_ip}"
    # réponse neutre anti-enumération
    try:
        await password_reset_uc.request_reset(email=str(data.email), client_key=client_key)
        return PasswordForgotResponse()
    except PasswordResetRateLimitedError as e:
        raise HTTPException(status_code=429, detail={"message": e.message, "code": "RATE_LIMITED"})


@router.post(
    "/forgot-password/verify",
    response_model=PasswordResetVerifyResponse,
    summary="Verify reset code (2FA) and return reset token",
    status_code=status.HTTP_200_OK,
)
async def forgot_password_verify(
    request: Request,
    data: PasswordResetVerifyRequest,
    password_reset_uc: PasswordResetUseCase = Depends(password_reset_usecase),
):
    client_ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown"))
    client_key = f"ip:{client_ip}"
    try:
        token, ttl = await password_reset_uc.verify_code(
            email=str(data.email),
            challenge_id=data.challenge_id,
            code=data.code,
            client_key=client_key,
        )
        return PasswordResetVerifyResponse(reset_token=token, expires_in_seconds=ttl)
    except PasswordResetRateLimitedError as e:
        raise HTTPException(status_code=429, detail={"message": e.message, "code": "RATE_LIMITED"})
    except (PasswordResetInvalidCodeError, Invalid2FACodeError):
        raise HTTPException(status_code=400, detail={"message": "Invalid code", "code": "INVALID_CODE"})


@router.post(
    "/forgot-password/confirm",
    response_model=PasswordResetConfirmResponse,
    summary="Reset password using verified reset token",
    status_code=status.HTTP_200_OK,
)
async def forgot_password_confirm(
    data: PasswordResetConfirmRequest,
    password_reset_uc: PasswordResetUseCase = Depends(password_reset_usecase),
):
    try:
        await password_reset_uc.confirm_reset(
            email=str(data.email),
            challenge_id=data.challenge_id,
            reset_token=data.reset_token,
            new_password=data.new_password,
        )
        return PasswordResetConfirmResponse()
    except PasswordResetInvalidTokenError as e:
        raise HTTPException(status_code=400, detail={"message": e.message, "code": "INVALID_TOKEN"})
