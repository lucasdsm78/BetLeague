from fastapi import APIRouter, Depends, status, HTTPException

from application.match.match_query_usecase import MatchQueryUseCase
from domain.match.exception.match_exception import MatchesNotFoundError
from presentation.match.match_error_message import ErrorMessageMatchesNotFound
from dependency_injections import current_user, match_query_usecase

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
        matches = match_query_usecase.get_matches(current_user.get('email', ''))

    except Exception as e:
        raise

    if not len(matches.get("matches")):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=MatchesNotFoundError.message,
        )

    return matches
