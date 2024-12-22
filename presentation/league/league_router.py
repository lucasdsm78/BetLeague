from typing import Union, Annotated

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File

from application.league.league_command_model import LeagueFreeCreateModel, LeagueFreeCreateResponse
from application.league.league_command_usecase import LeagueCommandUseCase
from dependency_injections import current_user, league_command_usecase

router = APIRouter(
    tags=['league']
)


@router.post(
    "/league/create",
    response_model=LeagueFreeCreateResponse,
    summary="Create a league",
    status_code=status.HTTP_200_OK,
)
async def create_free_league(
        free_league_model: LeagueFreeCreateModel,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        league = league_command_usecase.create_free_league(free_league_model, current_user.get('email', ''))

    except Exception as e:
        raise

    return league
