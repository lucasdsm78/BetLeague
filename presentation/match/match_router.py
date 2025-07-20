from fastapi import APIRouter, Depends, status, HTTPException
from datetime import datetime
from application.match.match_command_model import MatchScoreUpdatedResponse
from application.match.match_command_usecase import MatchCommandUseCase
from application.match.match_query_usecase import MatchQueryUseCase
from domain.match.exception.match_exception import MatchesNotFoundError
from domain.token.token_exception import TokenInvalidError
from presentation.match.match_error_message import ErrorMessageMatchesNotFound
from dependency_injections import current_user, match_query_usecase, match_command_usecase

router = APIRouter(
    tags=['match']
)


@router.get(
    "/matches",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorMessageMatchesNotFound,
        }
    }
)
async def get_matches(
        match_query_usecase: MatchQueryUseCase = Depends(match_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        matches = await match_query_usecase.get_matches(current_user.get('email', ''))

    except Exception as e:
        raise

    if not len(matches.get("matches")):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=MatchesNotFoundError.message,
        )

    return matches


@router.post(
    "/match/check_score",
    response_model=MatchScoreUpdatedResponse,
    summary="Check scores from API",
    status_code=status.HTTP_200_OK,
)
async def check_scores(
        token: str,
        match_command_usecase: MatchCommandUseCase = Depends(match_command_usecase),
):
    try:
        now = datetime.now()
        from_date_str = "2025-01-06"
        to_date_str = "2025-01-07"

        # from_date = now
        # to_date = now

        from_date = datetime.strptime(from_date_str, "%Y-%m-%d")
        to_date = datetime.strptime(to_date_str, "%Y-%m-%d")

        return await match_command_usecase.check_scores(token=token, from_date=from_date, to_date=to_date)

    except TokenInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except Exception as e:
        print(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
