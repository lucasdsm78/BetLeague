from fastapi import APIRouter, Depends, HTTPException, status

from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse,
)
from application.tournament.tournament_command_usecase import TournamentCommandUseCase
from application.tournament.tournament_query_model import TournamentReadModel
from application.tournament.tournament_query_usecase import TournamentQueryUseCase
from dependency_injections import current_user, tournament_command_usecase, tournament_query_usecase
from domain.user.exception.user_exception import UserNotFoundError

router = APIRouter(tags=["tournament"])


@router.post(
    "/tournament/create",
    response_model=TournamentCreateResponse,
    status_code=status.HTTP_200_OK,
)
async def create_tournament(
    tournament_model: TournamentCreateModel,
    tournament_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
    user: dict = Depends(current_user),
):
    try:
        return await tournament_usecase.create_tournament(tournament_model, user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)


@router.post(
    "/tournament/{id}/join",
    response_model=TournamentJoinResponse,
    status_code=status.HTTP_200_OK,
)
async def join_tournament(
    id: int,
    tournament_usecase: TournamentCommandUseCase = Depends(tournament_command_usecase),
    user: dict = Depends(current_user),
):
    try:
        return await tournament_usecase.join_tournament(id, user.get("email", ""))
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/tournament/{id}",
    response_model=TournamentReadModel,
    status_code=status.HTTP_200_OK,
)
async def get_tournament(
    id: int,
    tournament_usecase: TournamentQueryUseCase = Depends(tournament_query_usecase),
    user: dict = Depends(current_user),
):
    result = await tournament_usecase.get_tournament(id, user.get("email", ""))
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    return result
