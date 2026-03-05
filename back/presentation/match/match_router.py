import hmac

from fastapi import APIRouter, Depends, status, HTTPException, Query
from datetime import date, datetime, timedelta
from typing import Optional, List

from application.match.match_command_model import MatchScoreUpdatedResponse
from application.match.match_command_usecase import MatchCommandUseCase
from application.match.match_fetch_usecase import MatchFetchUseCase
from application.match.match_query_usecase import MatchQueryUseCase
from application.match.match_query_model import MatchesListResponse
from application.match.match_odds_query_model import MatchOddsByMatchIdsResponse
from application.match.match_query_model import MatchOddReadModel
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
        return await match_query_usecase.get_matches(current_user.get('email', ''), page=page, page_size=page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
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
            raise TokenInvalidError()
        return await match_command_usecase.check_scores_v2()
    except TokenInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )
    except Exception as e:
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token invalide")

    try:
        sport_enum = Sport.from_str(sport)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Sport invalide: {sport}")

    count = await match_fetch_usecase.fetch_and_store_matches(
        sport=sport_enum,
        date_from=date.today(),
        date_to=date.today() + timedelta(days=days_ahead),
    )
    return {"fetched": count, "sport": sport, "days_ahead": days_ahead}


@router.get(
    "/match-odds",
    response_model=MatchOddsByMatchIdsResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer les cotes (match_odds) pour une liste de matchs",
)
async def get_match_odds_by_match_ids(
        match_ids: str = Query("", description="Liste d'ids de matchs séparés par des virgules (ex: 1,2,3)"),
        bet_type: Optional[str] = Query(None, description="Optionnel: filtrer par bet_type"),
        match_query_usecase: MatchQueryUseCase = Depends(match_query_usecase),
        current_user: dict = Depends(current_user),
):
    raw = (match_ids or "").strip()
    if not raw:
        return MatchOddsByMatchIdsResponse(odds_by_match_id={})

    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if len(parts) > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trop de match_ids (max 500)")

    mids: List[int] = []
    seen: set[int] = set()
    for p in parts:
        if not p.isdigit():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"match_id invalide: {p}")
        mid = int(p)
        if mid <= 0 or mid in seen:
            continue
        mids.append(mid)
        seen.add(mid)

    try:
        odds_by_mid = await match_query_usecase.get_match_odds_by_match_ids(current_user.get('email', ''), mids)
        out = {}
        for mid, odds in odds_by_mid.items():
            if bet_type:
                filtered = [o for o in odds if (o.bet_type.value if hasattr(o.bet_type, 'value') else str(o.bet_type)) == bet_type]
            else:
                filtered = odds
            out[int(mid)] = [MatchOddReadModel.from_entity(o) for o in filtered]
        return MatchOddsByMatchIdsResponse(odds_by_match_id=out)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur interne lors de la récupération des cotes")
