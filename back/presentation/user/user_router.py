import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response

from application.user.user_command_model import (
    UserCreateModel, UserCreateResponse, UserLoginResponse, UserLoginModel, UserDeleteResponse,
    UserUpdateResponse, UserUpdateModel, RefreshTokenResponse,
    InvalidPasswordError, DeleteMyAccountModel,
    ChangeMyPasswordModel, ChangeMyPasswordResponse,
    TwoFactorSetupResponse, TwoFactorStatusResponse,
    VerifyTwoFactorModel, DisableTwoFactorModel, DisableTwoFactorResponse,
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
    get_settings,
    current_user, user_command_usecase, user_query_usecase, password_reset_usecase,
    rate_limit_delete_my_account,
    rate_limit_change_my_password,
    rate_limit_verify_2fa_activation,
    rate_limit_disable_2fa,
    rate_limit_login_with_2fa_code,
    get_request_client_ip,
    Verify2FARateLimitContext,
)
from infrastructure.config import Settings

router = APIRouter(
    prefix="/api/auth",
    tags=['auth']
)

logger = logging.getLogger(__name__)


def _safe_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    user_agent = (request.headers.get("User-Agent") or "").strip()
    if not user_agent:
        return None
    return user_agent[:255]


def _auth_log_extra(*, request: Request | None = None, settings: Settings | None = None, **extra) -> dict:
    payload = {key: value for key, value in extra.items() if value is not None}
    if request is not None:
        payload["method"] = request.method
        payload["path"] = request.url.path
        payload["user_agent"] = _safe_user_agent(request)
        if settings is not None:
            payload["client_ip"] = get_request_client_ip(request, settings)
    return payload


def _log_auth_event(level: int, event: str, *, request: Request | None = None, settings: Settings | None = None, **extra) -> None:
    logger.log(level, event, extra=_auth_log_extra(request=request, settings=settings, **extra))


def _set_refresh_token_cookie(response: Response, refresh_token: str, settings: Settings) -> None:
    response.set_cookie(
        key=settings.auth_refresh_cookie_name,
        value=refresh_token,
        max_age=int(settings.refresh_token_expire_minutes * 60),
        httponly=True,
        secure=settings.auth_refresh_cookie_secure_value,
        samesite=settings.auth_refresh_cookie_samesite_value,
        path=settings.auth_refresh_cookie_path or "/api/auth",
        domain=(settings.auth_refresh_cookie_domain or None),
    )


def _clear_refresh_token_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.auth_refresh_cookie_name,
        path=settings.auth_refresh_cookie_path or "/api/auth",
        domain=(settings.auth_refresh_cookie_domain or None),
        secure=settings.auth_refresh_cookie_secure_value,
        samesite=settings.auth_refresh_cookie_samesite_value,
        httponly=True,
    )


def _extract_refresh_token(request: Request, settings: Settings) -> str | None:
    cookie_token = (request.cookies.get(settings.auth_refresh_cookie_name) or "").strip()
    return cookie_token or None


@router.post(
    "/register",
    response_model=UserCreateResponse,
    response_model_exclude_none=True,
    summary="Register a new user",
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_user(
        request: Request,
        data: UserCreateModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        settings: Settings = Depends(get_settings),
):
    try:
        user = await user_command_usecase.create(data)
        _log_auth_event(
            logging.INFO,
            "auth.register.accepted",
            request=request,
            settings=settings,
        )

    except Exception:
        logger.exception("Échec inattendu lors de l'inscription")
        raise

    return user


@router.post(
    "/logout",
    summary="Logout current device",
    status_code=status.HTTP_200_OK,
)
async def logout_current_device(
        request: Request,
        response: Response,
        current_user: dict = Depends(current_user),
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        settings: Settings = Depends(get_settings),
):
    try:
        user_id = current_user.get("id") or current_user.get("uuid", "")
        token = current_user.get("token", "")  # We'll need to pass the token in the dependency

        result = await user_command_usecase.logout(user_id, token)
        _clear_refresh_token_cookie(response, settings)
        _log_auth_event(
            logging.INFO,
            "auth.logout.succeeded",
            request=request,
            settings=settings,
            user_id=user_id or None,
        )
        return result

    except HTTPException as e:
        raise e
    except Exception:
        logger.exception("Erreur inattendue lors de la déconnexion")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la déconnexion"
        )


@router.post(
    "/login",
    response_model=UserLoginResponse,
    response_model_exclude_none=True,
    summary="User Login",
)
async def login(
        response: Response,
        request: Request,
        user_login_model: UserLoginModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        settings: Settings = Depends(get_settings),
):
    try:
        await rate_limit_login_with_2fa_code(request, user_login_model)
        user = await user_command_usecase.login(user_login_model)
        if user.refresh_token:
            _set_refresh_token_cookie(response, user.refresh_token, settings)
        _log_auth_event(
            logging.INFO,
            "auth.login.succeeded",
            request=request,
            settings=settings,
            user_id=getattr(user, "uuid", None),
            two_factor_enabled=bool(getattr(user, "two_factor_enabled", False)),
        )
        return user.for_login(include_refresh_token=False)
    except (UserLoginNotFoundError, InvalidPasswordError):
        _log_auth_event(
            logging.WARNING,
            "auth.login.failed",
            request=request,
            settings=settings,
            reason="invalid_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Email ou mot de passe incorrect.",
                "code": "INVALID_CREDENTIALS"
            }
        )
    except FARequiredError:
        _log_auth_event(
            logging.INFO,
            "auth.login.challenge_required",
            request=request,
            settings=settings,
            reason="two_factor_required",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "2FA code required.",
                "code": "TWO_FACTOR_REQUIRED",
                "two_factor_required": True
            }
        )
    except Invalid2FACodeError:
        _log_auth_event(
            logging.WARNING,
            "auth.login.failed",
            request=request,
            settings=settings,
            reason="invalid_2fa_code",
        )
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
    except Exception:
        logger.exception("Échec inattendu du login")
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
    except Exception:
        logger.exception("Validation de token invalide")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    response_model_exclude_none=True,
    summary="Refresh JWT token",
    status_code=status.HTTP_200_OK,
)
async def refresh_token(
        request: Request,
        response: Response,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        settings: Settings = Depends(get_settings),
):
    try:
        refresh_token_value = _extract_refresh_token(request, settings)
        if not refresh_token_value:
            _log_auth_event(
                logging.WARNING,
                "auth.refresh.rejected",
                request=request,
                settings=settings,
                reason="missing_cookie",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token missing",
            )

        result = await user_command_usecase.refresh_token(refresh_token_value)
        if result.refresh_token:
            _set_refresh_token_cookie(response, result.refresh_token, settings)
        _log_auth_event(
            logging.INFO,
            "auth.refresh.succeeded",
            request=request,
            settings=settings,
        )
        return RefreshTokenResponse(
            token_auth=result.token_auth,
            token_expiration=result.token_expiration,
            message=result.message,
        )

    except HTTPException as e:
        raise e
    except Exception:
        logger.exception("Erreur inattendue pendant le refresh token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )


@router.delete(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Delete current authenticated user account",
    response_model=UserDeleteResponse,
    dependencies=[Depends(rate_limit_delete_my_account)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "description": "Mot de passe invalide ou utilisateur non authentifié",
        },
        status.HTTP_403_FORBIDDEN: {
            "description": "Code 2FA invalide",
        },
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorMessageUserNotFound,
        },
    },
)
async def delete_my_account(
        request: Request,
        data: DeleteMyAccountModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user),
        settings: Settings = Depends(get_settings),
):
    try:
        user_email = current_user.get("email")
        token = current_user.get("token")
        user_id = current_user.get("id") or current_user.get("uuid")
        if not user_email or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Utilisateur non authentifié"
            )
        result = await user_command_usecase.delete_current_user(user_email, token, data)
        _log_auth_event(
            logging.INFO,
            "auth.account.deleted",
            request=request,
            settings=settings,
            user_id=user_id,
        )
        return result
    except InvalidPasswordError:
        _log_auth_event(
            logging.WARNING,
            "auth.account.delete_rejected",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
            reason="invalid_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Email ou mot de passe incorrect.",
                "code": "INVALID_CREDENTIALS"
            }
        )
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
        _log_auth_event(
            logging.WARNING,
            "auth.account.delete_rejected",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
            reason="invalid_2fa_code",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la suppression du compte"
        )


@router.post(
    "/user/enable-2fa",
    summary="Enable Two-Factor Authentication",
    status_code=status.HTTP_200_OK,
    response_model=TwoFactorSetupResponse,
)
async def enable_2fa(
        request: Request,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user),
        settings: Settings = Depends(get_settings),
):
    try:
        result = await user_command_usecase.enable_2fa(current_user.get('email', ''))
        _log_auth_event(
            logging.INFO,
            "auth.2fa.setup_started",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
        )
        return result
    except HTTPException as e:
        raise e
    except Exception:
        logger.exception("Échec inattendu lors de l'activation de la 2FA")
        raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to enable 2FA."
            )


@router.post(
    "/user/verify-2fa",
    summary="Verify Two-Factor Authentication",
    status_code=status.HTTP_200_OK,
    response_model=TwoFactorStatusResponse,
)
async def verify_2fa(
        request: Request,
        data: VerifyTwoFactorModel,
        rate_limit_ctx: Verify2FARateLimitContext = Depends(rate_limit_verify_2fa_activation),
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user),
        settings: Settings = Depends(get_settings),
):
    try:
        result = await user_command_usecase.verify_2fa(
            current_user.get('email', ''),
            data,
            attempts_remaining=rate_limit_ctx.attempts_remaining,
        )
        _log_auth_event(
            logging.INFO,
            "auth.2fa.verified",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
        )
        return result
    except Invalid2FACodeError as e:
        _log_auth_event(
            logging.WARNING,
            "auth.2fa.verify_rejected",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
            reason="invalid_2fa_code",
            attempts_remaining=rate_limit_ctx.attempts_remaining,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": e.message,
                "code": "INVALID_2FA_CODE",
                "attempts_remaining": rate_limit_ctx.attempts_remaining,
            }
        )
    except HTTPException as e:
        raise e
    except Exception:
        logger.exception("Échec inattendu lors de la vérification 2FA")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify 2FA."
        )


@router.post(
    "/user/disable-2fa",
    summary="Disable Two-Factor Authentication",
    status_code=status.HTTP_200_OK,
    response_model=DisableTwoFactorResponse,
    dependencies=[Depends(rate_limit_disable_2fa)],
)
async def disable_2fa(
        request: Request,
        data: DisableTwoFactorModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user),
        settings: Settings = Depends(get_settings),
):
    try:
        result = await user_command_usecase.disable_2fa(
            current_user.get('email', ''),
            current_user.get('token', ''),
            data,
        )
        _log_auth_event(
            logging.INFO,
            "auth.2fa.disabled",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
        )
        return result
    except InvalidPasswordError:
        _log_auth_event(
            logging.WARNING,
            "auth.2fa.disable_rejected",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
            reason="invalid_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Email ou mot de passe incorrect.", "code": "INVALID_CREDENTIALS"}
        )
    except Invalid2FACodeError as e:
        _log_auth_event(
            logging.WARNING,
            "auth.2fa.disable_rejected",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
            reason="invalid_2fa_code",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": e.message, "code": "INVALID_2FA_CODE"}
        )
    except HTTPException as e:
        raise e
    except Exception:
        logger.exception("Échec inattendu lors de la désactivation de la 2FA")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disable 2FA."
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
    response_model_exclude_none=True,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Update user",
)
async def update_user(
        request: Request,
        response: Response,
        update_user_model: UserUpdateModel,
        user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
        current_user: dict = Depends(current_user),
        settings: Settings = Depends(get_settings),
):
    try:
        update_user_result = await user_command_usecase.update_user_profile(current_user.get('email'), update_user_model)
        if update_user_result.refresh_token:
            _set_refresh_token_cookie(response, update_user_result.refresh_token, settings)
        user_id = current_user.get("id") or current_user.get("uuid")
        _log_auth_event(
            logging.INFO,
            "auth.profile.updated",
            request=request,
            settings=settings,
            user_id=user_id,
            email_changed=bool(update_user_model.email and update_user_model.email != current_user.get("email")),
            pseudo_changed=bool(update_user_model.pseudo),
        )
        if update_user_model.email and update_user_model.email != current_user.get("email"):
            _log_auth_event(
                logging.INFO,
                "auth.email.changed",
                request=request,
                settings=settings,
                user_id=user_id,
            )
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
    except Exception:
        logger.exception("Échec inattendu lors de la mise à jour du profil")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du user"
        )

    return UserUpdateResponse(
        token_auth=update_user_result.token_auth,
        token_expiration=update_user_result.token_expiration,
    )


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
    except Exception:
        logger.exception("Échec inattendu lors de la recherche d'utilisateurs")
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
    settings: Settings = Depends(get_settings),
):
    client_ip = get_request_client_ip(request)
    client_key = f"ip:{client_ip}"
    # réponse neutre anti-enumération
    try:
        challenge_id, ttl = await password_reset_uc.request_reset(email=str(data.email), client_key=client_key)
        _log_auth_event(
            logging.INFO,
            "auth.password_reset.requested",
            request=request,
            settings=settings,
        )
        return PasswordForgotResponse(challenge_id=challenge_id, expires_in_seconds=ttl)
    except PasswordResetRateLimitedError as e:
        _log_auth_event(
            logging.WARNING,
            "auth.password_reset.request_rejected",
            request=request,
            settings=settings,
            reason="rate_limited",
        )
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
    settings: Settings = Depends(get_settings),
):
    client_ip = get_request_client_ip(request)
    client_key = f"ip:{client_ip}"
    try:
        token, ttl = await password_reset_uc.verify_code(
            email=str(data.email),
            challenge_id=data.challenge_id,
            code=data.code,
            client_key=client_key,
        )
        _log_auth_event(
            logging.INFO,
            "auth.password_reset.challenge_verified",
            request=request,
            settings=settings,
        )
        return PasswordResetVerifyResponse(reset_token=token, expires_in_seconds=ttl)
    except PasswordResetRateLimitedError as e:
        _log_auth_event(
            logging.WARNING,
            "auth.password_reset.verify_rejected",
            request=request,
            settings=settings,
            reason="rate_limited",
        )
        raise HTTPException(status_code=429, detail={"message": e.message, "code": "RATE_LIMITED"})
    except (PasswordResetInvalidCodeError, Invalid2FACodeError):
        _log_auth_event(
            logging.WARNING,
            "auth.password_reset.verify_rejected",
            request=request,
            settings=settings,
            reason="invalid_code",
        )
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
        logger.info("auth.password_reset.completed")
        return PasswordResetConfirmResponse()
    except PasswordResetInvalidTokenError as e:
        logger.warning("auth.password_reset.confirm_rejected", extra={"reason": "invalid_token"})
        raise HTTPException(status_code=400, detail={"message": e.message, "code": "INVALID_TOKEN"})


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change current authenticated user password",
    response_model=ChangeMyPasswordResponse,
    dependencies=[Depends(rate_limit_change_my_password)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Mot de passe invalide ou utilisateur non authentifié"},
        status.HTTP_403_FORBIDDEN: {"description": "Code 2FA invalide"},
    },
)
async def change_my_password(
    request: Request,
    data: ChangeMyPasswordModel,
    user_command_usecase: UserCommandUseCase = Depends(user_command_usecase),
    current_user: dict = Depends(current_user),
    settings: Settings = Depends(get_settings),
):
    try:
        user_email = current_user.get("email")
        token = current_user.get("token")
        user_id = current_user.get("id") or current_user.get("uuid")
        if not user_email or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Utilisateur non authentifié",
            )

        result = await user_command_usecase.change_my_password(user_email, token, data)
        _log_auth_event(
            logging.INFO,
            "auth.password_changed",
            request=request,
            settings=settings,
            user_id=user_id,
        )
        return result

    except InvalidPasswordError:
        _log_auth_event(
            logging.WARNING,
            "auth.password_change_rejected",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
            reason="invalid_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Mot de passe incorrect.",
                "code": "INVALID_CREDENTIALS",
            },
        )
    except FARequiredError:
        _log_auth_event(
            logging.INFO,
            "auth.password_change_challenge_required",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "2FA code required.",
                "code": "TWO_FACTOR_REQUIRED",
                "two_factor_required": True,
            },
        )
    except Invalid2FACodeError:
        _log_auth_event(
            logging.WARNING,
            "auth.password_change_rejected",
            request=request,
            settings=settings,
            user_id=current_user.get("id") or current_user.get("uuid"),
            reason="invalid_2fa_code",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Invalid 2FA code.",
                "code": "INVALID_2FA_CODE",
                "two_factor_required": True,
            },
        )
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors du changement de mot de passe",
        )
