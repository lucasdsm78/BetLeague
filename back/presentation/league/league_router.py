from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Query

from application.league.league_command_model import LeagueCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse, \
    LeaguePlayerDeletedResponse, LeagueInviteResponse, InvitationUpdateResponse, LeagueUpdateResponse, \
    LeagueUpdateModel, LeagueInjectBtlResponse, LeagueInjectBtlModel
from application.league.league_command_usecase import LeagueCommandUseCase
from application.league.league_query_model import LeagueReadModel, LeaguesListResponse
from application.league.league_query_usecase import LeagueQueryUseCase
from dependency_injections import current_user, league_command_usecase, league_query_usecase
from domain.invitation.exception.invitation_exception import InvitationFoundError
from domain.league.exception.league_exception import LeagueNotFoundError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError, LeagueAlreadyStartedError, LeagueParticipantNotFoundError, UserNotOwnerLeaguedError, \
    LeagueNameAlreadyExistsError, LeagueNbBtlIsNotEnoughError, LeagueMustHaveNbBtlError
from domain.user.exception.user_exception import UserNotFoundError

router = APIRouter(
    prefix="/api",
    tags=['league']
)


@router.post(
    "/league/create",
    response_model=LeagueFreeCreateResponse,
    summary="Create a league",
    status_code=status.HTTP_200_OK,
)
async def create_league(
        league_create_model: LeagueCreateModel,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        league = await league_command_usecase.create_league(league_create_model, current_user.get('email', ''))

    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except LeagueNameAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except LeagueMaxPlayersError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )

    except LeagueMustHaveNbBtlError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )

    except LeagueNbBtlIsNotEnoughError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la création de la ligue."
        )

    return league


@router.post(
    "/league/{id}/join",
    response_model=LeagueJoinResponse,
    summary="Join a league",
    status_code=status.HTTP_200_OK
)
async def join_league(
        id: int,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        league_players = await league_command_usecase.join_league(id, current_user.get('email', ''))

    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except LeagueMaxPlayersError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )

    except LeagueParticipantFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except LeagueNbBtlIsNotEnoughError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de l'inscription à la ligue.",
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
        return await league_query_usecase.get_rank_by_league_id( current_user.get('email', ''), league_id)

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
        id: int,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        delete_league_player = await league_command_usecase.delete_league_player(
            id,
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
        id: int,
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        league = await league_query_usecase.get_league_by_id(id, current_user.get('email', ''))
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
    response_model=LeaguesListResponse,
    status_code=status.HTTP_200_OK
)
async def get_leagues(
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=50),
):
    try:
        return await league_query_usecase.get_leagues(current_user.get('email', ''), page=page, page_size=page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur interne lors de la récupération des ligues")


@router.get(
    "/leagues/created",
    response_model=LeaguesListResponse,
    status_code=status.HTTP_200_OK
)
async def get_created_leagues(
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=50),
):
    try:
        return await league_query_usecase.get_created_leagues(current_user.get('email', ''), page=page, page_size=page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur interne lors de la récupération des ligues créées")


@router.get(
    "/leagues/participated",
    response_model=LeaguesListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get leagues where user is a participant"
)
async def get_participated_leagues(
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=50),
):
    try:
        return await league_query_usecase.get_participated_leagues(current_user.get('email', ''), page=page, page_size=page_size)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur interne lors de la récupération des ligues rejointes")


@router.post(
    "/league/{league_id}/{user_id}/invite",
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except UserNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )

    except LeagueAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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
        invitations = await league_query_usecase.get_invitations(current_user.get('email', ''), is_received)

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
        update_invitation_result = await league_command_usecase.update_invitation(invitation_id, action, current_user.get('email'))
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
        id: int,
        update_league_model: LeagueUpdateModel,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        update_league_result = await league_command_usecase.update_league(update_league_model, id, current_user.get('email'))
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except UserNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except LeagueAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification de la ligue"
        )

    return update_league_result


@router.post(
    "/league/{league_id}/inject-btl",
    response_model=LeagueInjectBtlResponse,
    status_code=status.HTTP_200_OK,
    summary="Inject paid BTL into league"
)
async def inject_btl(
        league_id: int,
        inject_model: LeagueInjectBtlModel,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        return await league_command_usecase.inject_btl(league_id, inject_model.amount, current_user.get('email', ''))
    except LeagueNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except LeagueParticipantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except LeagueNbBtlIsNotEnoughError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e)

@router.get(
    "/league/{league_id}/balance",
    status_code=status.HTTP_200_OK,
    summary="Get league balance of a user"
)
async def get_league_balance(
        league_id: int,
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        return await league_query_usecase.get_league_balance(current_user.get('email', ''), league_id)
    except LeagueNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except LeagueParticipantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unexpected error")
