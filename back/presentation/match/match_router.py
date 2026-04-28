import hmac
import logging

from fastapi import APIRouter, Depends, status, HTTPException, Query
from datetime import date, datetime, timedelta
from typing import Optional

from application.match.match_command_model import MatchScoreUpdatedResponse
from application.match.match_command_usecase import MatchCommandUseCase
from application.match.match_fetch_usecase import MatchFetchUseCase
from application.match.match_query_usecase import MatchQueryUseCase
from application.match.match_query_model import MatchesListResponse
from domain.match.model.sport import Sport
from domain.user.exception.user_exception import UserNotFoundError
from domain.match.exception.match_exception import MatchesNotFoundError
from domain.token.token_exception import TokenInvalidError
from infrastructure.config import Settings
from presentation.match.match_error_message import ErrorMessageMatchesNotFound
from dependency_injections import (
    current_user,
    match_query_usecase,
    match_command_usecase,
    match_fetch_usecase_dep,
    get_settings,
)

router = APIRouter(
    prefix="/api",
    tags=['match']
)

logger = logging.getLogger(__name__)


@router.get(
    "/matches",
    response_model=MatchesListResponse,
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorMessageMatchesNotFound,
        }
    }
)
async def get_matches(
        sport: Optional[str] = Query(None, description="Filter by sport"),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        match_query_usecase: MatchQueryUseCase = Depends(match_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        matches = await match_query_usecase.get_matches(current_user.get('email', ''), page=page, page_size=page_size)
        logger.info("match.http.list_succeeded", extra={"user_id": current_user.get('id'), "page": page, "page_size": page_size, "results_count": len(matches.matches)})
        return matches
    except UserNotFoundError as e:
        logger.warning("match.http.list_rejected", extra={"user_id": current_user.get('id'), "reason": "user_missing"})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        logger.exception("match.http.list_failed", extra={"user_id": current_user.get('id')})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur interne lors de la récupération des matchs")


@router.post(
    "/match/check_score",
    response_model=MatchScoreUpdatedResponse,
    summary="Check scores from API-Sports",
    status_code=status.HTTP_200_OK,
)
async def check_scores(
        token: str,
        match_command_usecase: MatchCommandUseCase = Depends(match_command_usecase),
        settings: Settings = Depends(get_settings),
):
    try:
        if not hmac.compare_digest(token, settings.secret_key_token):
            logger.warning("match.http.score_check_rejected", extra={"reason": "invalid_token"})
            raise TokenInvalidError()
        result = await match_command_usecase.check_scores_v2()
        logger.info("match.http.score_check_succeeded")
        return result
    except TokenInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )
    except Exception as e:
        logger.exception("match.http.score_check_failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la vérification des scores",
        )


@router.post(
    "/match/fetch",
    summary="Fetch matches from API-Sports (admin)",
    status_code=status.HTTP_200_OK,
)
async def fetch_matches(
        token: str,
        sport: str = Query("football"),
        days_ahead: int = Query(7, ge=1, le=30),
        match_fetch_usecase: MatchFetchUseCase = Depends(match_fetch_usecase_dep),
        settings: Settings = Depends(get_settings),
):
    if not hmac.compare_digest(token, settings.secret_key_token):
        logger.warning("match.http.fetch_rejected", extra={"reason": "invalid_token", "sport": sport, "days_ahead": days_ahead})
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token invalide")

    try:
        sport_enum = Sport.from_str(sport)
    except Exception:
        logger.warning("match.http.fetch_rejected", extra={"reason": "invalid_sport", "sport": sport, "days_ahead": days_ahead})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Sport invalide: {sport}")

    count = await match_fetch_usecase.fetch_and_store_matches(
        sport=sport_enum,
        date_from=date.today(),
        date_to=date.today() + timedelta(days=days_ahead),
    )
    logger.info("match.http.fetch_succeeded", extra={"sport": sport, "days_ahead": days_ahead, "fetched_count": count})
    return {"fetched": count, "sport": sport, "days_ahead": days_ahead}
