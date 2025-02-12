from typing import Union, Annotated, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File

from application.league.league_command_model import LeagueFreeCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse, \
    LeaguePlayerDeletedResponse
from application.league.league_command_usecase import LeagueCommandUseCase
from application.league.league_query_usecase import LeagueQueryUseCase
from dependency_injections import current_user, league_command_usecase, league_query_usecase
from domain.league.exception.league_exception import LeagueNotFoundError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError, LeagueAlreadyStartedError
from domain.user.exception.user_exception import UserNotFoundError

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


@router.post(
    "/league/{id}/join",
    response_model=LeagueJoinResponse,
    summary="Join a league",
    status_code=status.HTTP_200_OK
)
async def join_league(
        league_id: int,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        league_players = league_command_usecase.join_league(league_id, current_user.get('email', ''))

    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.message,
        )

    except LeagueMaxPlayersError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=e.message,
        )

    except LeagueParticipantFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return league_players


@router.get(
    "/league/{league_id}/rank",
    summary="Get the league ranking",
    status_code=status.HTTP_200_OK,
)
async def get_league_ranking(
        league_id: int,
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        return league_query_usecase.get_rank_by_league_id(league_id)

    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred."
        )


@router.delete(
    "/league/{id}/player/delete",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete player to a league",
    response_model=LeaguePlayerDeletedResponse
)
async def delete_league_player(
        league_id: int,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        delete_league_player = league_command_usecase.delete_league_player(
            league_id,
            current_user.get('email', '')
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except LeagueAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return delete_league_player
