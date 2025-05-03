from fastapi import APIRouter, Depends, HTTPException, status

from application.league.league_command_model import LeagueFreeCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse, \
    LeaguePlayerDeletedResponse, LeagueInviteResponse, InvitationUpdateResponse, LeagueUpdateResponse, LeagueUpdateModel
from application.league.league_command_usecase import LeagueCommandUseCase
from application.league.league_query_model import LeagueReadModel
from application.league.league_query_usecase import LeagueQueryUseCase
from dependency_injections import current_user, league_command_usecase, league_query_usecase
from domain.invitation.exception.invitation_exception import InvitationFoundError
from domain.league.exception.league_exception import LeagueNotFoundError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError, LeagueAlreadyStartedError, LeagueParticipantNotFoundError, UserNotOwnerLeaguedError, \
    LeagueNameAlreadyExistsError
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
        league = await league_command_usecase.create_free_league(free_league_model, current_user.get('email', ''))

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
        league_players = await league_command_usecase.join_league(league_id, current_user.get('email', ''))

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
        return league_query_usecase.get_rank_by_league_id( current_user.get('email', ''), league_id)

    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except LeagueParticipantNotFoundError as e:
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
        delete_league_player = await league_command_usecase.delete_league_player(
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
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return delete_league_player


@router.get(
    "/league/{id}",
    response_model=LeagueReadModel,
    status_code=status.HTTP_200_OK
)
async def get_league(
        league_id: int,
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        league = league_query_usecase.get_league_by_id(league_id, current_user.get('email', ''))
    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )
    except LeagueParticipantNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    return league


@router.get(
    "/leagues",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def get_leagues(
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        leagues = league_query_usecase.get_leagues(current_user.get('email', ''))

        if not leagues:
            raise HTTPException(
                status_code=status.HTTP_204_NO_CONTENT,
                detail="No leagues found."
            )

    except Exception as e:
        raise

    return leagues



@router.post(
    "/league/{id}/{user_id}/invite",
    response_model=LeagueInviteResponse,
    summary="Invite user to a league",
    status_code=status.HTTP_200_OK
)
async def invite_user_to_league(
        league_id: int,
        user_id: int,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        invitation = await league_command_usecase.invite_user(league_id, user_id, current_user.get('email', ''))

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

    except UserNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except LeagueAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except LeagueParticipantFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except InvitationFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return invitation


@router.get(
    "/invitations",
    status_code=status.HTTP_200_OK
)
async def get_invitations(
        is_received: bool,
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        invitations = league_query_usecase.get_invitations(current_user.get('email', ''), is_received)

        if not invitations:
            raise HTTPException(
                status_code=status.HTTP_204_NO_CONTENT,
                detail="No invitations found."
            )

    except Exception as e:
        raise

    return invitations


@router.put(
    "/league/invitation/{action}",
    response_model=InvitationUpdateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Update invitation status",
)
async def update_invitation(
        invitation_id: int,
        action: bool,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        update_invitation_result = league_command_usecase.update_invitation(invitation_id, action, current_user.get('email'))
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except UserNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du status de l'invitation."
        )

    return update_invitation_result

@router.put(
    "/league/{id}",
    response_model=LeagueUpdateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Update league",
)
async def update_league(
        league_id: int,
        update_league_model: LeagueUpdateModel,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        update_league_result = league_command_usecase.update_league(update_league_model, league_id, current_user.get('email'))
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except LeagueNameAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
    except LeagueMaxPlayersError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except UserNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except LeagueAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification de la league"
        )

    return update_league_result
