import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Path
from fastapi import Query
from fastapi import Request

from application.league.league_command_model import LeagueCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse, \
    LeaguePlayerDeletedResponse, LeagueInviteResponse, InvitationUpdateResponse, LeagueUpdateResponse, \
    LeagueUpdateModel, LeagueInjectBtlModel, LeagueInjectBtlResponse, InvitationDeleteResponse, LeagueStartResponse
from application.league.league_command_usecase import LeagueCommandUseCase
from application.league.league_query_model import LeagueReadModel, LeaguesListResponse, LeagueBalancesBulkRequest, LeagueBalancesBulkResponse, InvitationsReceivedResponse, InvitationCountsResponse, LeagueInvitationsSentResponse, InvitationsSentResponse
from application.league.league_query_usecase import LeagueQueryUseCase
from dependency_injections import current_user, league_command_usecase, league_query_usecase
from domain.invitation.exception.invitation_exception import InvitationFoundError, InvitationDeletionNotAllowedError
from domain.invitation.model.invitation_status import InvitationStatus
from domain.league.exception.league_exception import LeagueNotFoundError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError, LeagueAlreadyStartedError, LeagueParticipantNotFoundError, UserNotOwnerLeaguedError, \
    LeagueNameAlreadyExistsError, LeagueNbBtlIsNotEnoughError, LeagueMustHaveNbBtlError, LeagueFinishedError, \
    LeagueNotThePlayerError, LeagueMinimumPlayersNotReachedError, \
    UserNotInvitationLeaguedError
from domain.user.exception.user_exception import UserNotFoundError
from domain.invitation.exception.invitation_exception import InvitationNotFoundError
from infrastructure.services.rate_limiter import rate_limiter

router = APIRouter(
    prefix="/api",
    tags=['league']
)

logger = logging.getLogger(__name__)


def _log_league_event(level: int, event: str, *, current_user: dict | None = None, **extra) -> None:
    payload = {key: value for key, value in extra.items() if value is not None}
    if current_user:
        payload.setdefault("user_id", current_user.get("id"))
    logger.log(level, event, extra=payload)


def _raise_league_finished(e: LeagueFinishedError) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=e.message,
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

    except LeagueFinishedError as e:
        _raise_league_finished(e)

    except Exception as e:
        logger.exception("league.http.create_failed", extra={"user_id": current_user.get("id")})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la création de la ligue."
        )

    _log_league_event(logging.INFO, "league.http.create_succeeded", current_user=current_user)
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

    except LeagueFinishedError as e:
        _raise_league_finished(e)

    except Exception as e:
        logger.exception("league.http.join_failed", extra={"user_id": current_user.get("id"), "league_id": id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de l'inscription à la ligue.",
        )

    _log_league_event(logging.INFO, "league.http.join_succeeded", current_user=current_user, league_id=id)
    return league_players


@router.post(
    "/league/{id}/start",
    response_model=LeagueStartResponse,
    summary="Start a league manually",
    status_code=status.HTTP_200_OK,
)
async def start_league(
        id: int,
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        result = await league_command_usecase.start_league(id, current_user.get('email', ''))
    except LeagueNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UserNotOwnerLeaguedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except LeagueMinimumPlayersNotReachedError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except LeagueAlreadyStartedError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except LeagueFinishedError as e:
        _raise_league_finished(e)
    except Exception:
        logger.exception("league.http.start_failed", extra={"user_id": current_user.get("id"), "league_id": id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors du démarrage de la ligue.",
        )

    _log_league_event(logging.INFO, "league.http.start_succeeded", current_user=current_user, league_id=id)
    return result


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
        ranking = await league_query_usecase.get_rank_by_league_id(current_user.get('email', ''), league_id)
        _log_league_event(logging.INFO, "league.http.rank_succeeded", current_user=current_user, league_id=league_id, results_count=len(ranking))
        return ranking

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
        logger.exception("league.http.rank_failed", extra={"user_id": current_user.get("id"), "league_id": league_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred."
        )

@router.post(
    "/leagues/balances",
    summary="Bulk: get the connected user's BTL balances in multiple leagues",
    status_code=status.HTTP_200_OK,
    response_model=LeagueBalancesBulkResponse,
)
async def get_leagues_balances_bulk(
        payload: LeagueBalancesBulkRequest,
        request: Request,
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        email = (current_user or {}).get('email', '')
        client_host = getattr(getattr(request, 'client', None), 'host', 'unknown') if request else 'unknown'
        key = f"leagues_balances_bulk:{email or client_host}"
        rl = rate_limiter.check(key=key, limit=30, window_seconds=60)
        if not rl.allowed:
            logger.warning(
                "ratelimit.hit",
                extra={
                    "endpoint": "league.balances_bulk",
                    "client_key": key,
                    "retry_after_s": int(rl.retry_after_seconds),
                    "user_id": current_user.get("id"),
                    "method": request.method,
                    "path": request.url.path,
                    "client_ip": client_host,
                    "limiter_backend": "memory",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de requêtes. Réessayez plus tard.",
                headers={"Retry-After": str(rl.retry_after_seconds)},
            )

        result = await league_query_usecase.get_leagues_balances(
            current_user.get('email', ''),
            payload.league_ids,
        )
        _log_league_event(logging.INFO, "league.http.balances_bulk_succeeded", current_user=current_user, requested_count=len(payload.league_ids), results_count=len(result.balances))
        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        logger.exception("league.http.balances_bulk_failed", extra={"user_id": current_user.get("id")})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")


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

    except LeagueParticipantNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except LeagueNotThePlayerError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message,
        )

    except LeagueAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except LeagueFinishedError as e:
        _raise_league_finished(e)

    except Exception as e:
        logger.exception("league.http.delete_player_failed", extra={"user_id": current_user.get("id"), "league_id": id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    _log_league_event(logging.INFO, "league.http.delete_player_succeeded", current_user=current_user, league_id=id)
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
        logger.exception("league.http.detail_failed", extra={"user_id": current_user.get("id"), "league_id": id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    _log_league_event(logging.INFO, "league.http.detail_succeeded", current_user=current_user, league_id=id)
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
        result = await league_query_usecase.get_leagues(current_user.get('email', ''), page=page, page_size=page_size)
        _log_league_event(logging.INFO, "league.http.list_succeeded", current_user=current_user, page=page, page_size=page_size, results_count=len(result.leagues))
        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        logger.exception("league.http.list_failed", extra={"user_id": current_user.get("id"), "page": page, "page_size": page_size})
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
        result = await league_query_usecase.get_created_leagues(current_user.get('email', ''), page=page, page_size=page_size)
        _log_league_event(logging.INFO, "league.http.created_list_succeeded", current_user=current_user, page=page, page_size=page_size, results_count=len(result.leagues))
        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        logger.exception("league.http.created_list_failed", extra={"user_id": current_user.get("id"), "page": page, "page_size": page_size})
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
        result = await league_query_usecase.get_participated_leagues(current_user.get('email', ''), page=page, page_size=page_size)
        _log_league_event(logging.INFO, "league.http.participated_list_succeeded", current_user=current_user, page=page, page_size=page_size, results_count=len(result.leagues))
        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        logger.exception("league.http.participated_list_failed", extra={"user_id": current_user.get("id"), "page": page, "page_size": page_size})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur interne lors de la récupération des ligues rejointes")


@router.get(
    "/leagues/mine",
    response_model=LeaguesListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get leagues where user is owner or participant"
)
async def get_my_leagues(
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=50),
):
    try:
        result = await league_query_usecase.get_my_leagues(current_user.get('email', ''), page=page, page_size=page_size)
        _log_league_event(logging.INFO, "league.http.mine_list_succeeded", current_user=current_user, page=page, page_size=page_size, results_count=len(result.leagues))
        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        logger.exception("league.http.mine_list_failed", extra={"user_id": current_user.get("id"), "page": page, "page_size": page_size})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erreur interne lors de la récupération de mes ligues")


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

    except LeagueFinishedError as e:
        _raise_league_finished(e)

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
        logger.exception("league.http.invite_failed", extra={"user_id": current_user.get("id"), "league_id": league_id, "invited_user_id": user_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    _log_league_event(logging.INFO, "league.http.invite_succeeded", current_user=current_user, league_id=league_id, invited_user_id=user_id)
    return invitation


@router.get(
    "/league/{league_id}/invitations",
    response_model=LeagueInvitationsSentResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer les invitations envoyées pour une ligue du créateur connecté",
)
async def get_league_invitations(
        league_id: int = Path(..., gt=0),
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        result = await league_query_usecase.get_league_invitations(
            league_id=league_id,
            email=current_user.get('email', ''),
        )
        _log_league_event(logging.INFO, "league.http.invitations_for_league_succeeded", current_user=current_user, league_id=league_id, results_count=len(result.invitations))
        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except LeagueNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UserNotOwnerLeaguedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except Exception:
        logger.exception("league.http.invitations_for_league_failed", extra={"user_id": current_user.get("id"), "league_id": league_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération des invitations de la ligue"
        )


@router.get(
    "/invitations/counts",
    response_model=InvitationCountsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get invitation counts by status",
)
async def get_invitation_counts(
        is_received: bool = Query(True),
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        counts = await league_query_usecase.get_invitation_counts(
            current_user.get('email', ''), is_received
        )
        _log_league_event(logging.INFO, "league.http.invitation_counts_succeeded", current_user=current_user, is_received=is_received)
        return InvitationCountsResponse(**counts)
    except HTTPException:
        raise
    except Exception:
        logger.exception("league.http.invitation_counts_failed", extra={"user_id": current_user.get("id"), "is_received": is_received})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération des compteurs d'invitations."
        )


@router.get(
    "/invitations",
    response_model=InvitationsReceivedResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer les invitations reçues",
)
async def get_invitations(
        is_received: bool,
        invitation_status: str | None = Query(None, alias="status"),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        # Validate and convert status if provided
        status_enum = None
        if invitation_status:
            try:
                status_enum = InvitationStatus.from_str(invitation_status.upper())
            except Exception:
                _log_league_event(logging.WARNING, "league.http.invitations_rejected", current_user=current_user, reason="invalid_status", invitation_status=invitation_status)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Statut invalide: {invitation_status}. Valeurs acceptées: PENDING, ACCEPTED, REFUSED"
                )

        result = await league_query_usecase.get_invitations(
            current_user.get('email', ''), is_received,
            status=status_enum, page=page, page_size=page_size,
        )
        _log_league_event(logging.INFO, "league.http.invitations_succeeded", current_user=current_user, is_received=is_received, page=page, page_size=page_size, results_count=len(result.invitations))
        return result

    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("league.http.invitations_failed", extra={"user_id": current_user.get("id"), "is_received": is_received, "page": page, "page_size": page_size})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération des invitations."
        )


@router.get(
    "/invitations/sent",
    response_model=InvitationsSentResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer les invitations envoyées",
)
async def get_sent_invitations(
        invitation_status: str | None = Query(None, alias="status"),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        league_query_usecase: LeagueQueryUseCase = Depends(league_query_usecase),
        current_user: dict = Depends(current_user),
):
    try:
        status_enum = None
        if invitation_status:
            try:
                status_enum = InvitationStatus.from_str(invitation_status.upper())
            except Exception:
                _log_league_event(logging.WARNING, "league.http.sent_invitations_rejected", current_user=current_user, reason="invalid_status", invitation_status=invitation_status)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Statut invalide: {invitation_status}. Valeurs acceptées: PENDING, ACCEPTED, REFUSED"
                )

        result = await league_query_usecase.get_sent_invitations(
            current_user.get('email', ''),
            status=status_enum,
            page=page,
            page_size=page_size,
        )
        _log_league_event(logging.INFO, "league.http.sent_invitations_succeeded", current_user=current_user, page=page, page_size=page_size, results_count=len(result.invitations))
        return result
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except HTTPException:
        raise
    except Exception:
        logger.exception("league.http.sent_invitations_failed", extra={"user_id": current_user.get("id"), "page": page, "page_size": page_size})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération des invitations envoyées."
        )


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
    except InvitationNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UserNotInvitationLeaguedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except LeagueParticipantFoundError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except UserNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message
        )
    except LeagueFinishedError as e:
        _raise_league_finished(e)
    except Exception as e:
        logger.exception("league.http.invitation_update_failed", extra={"user_id": current_user.get("id"), "invitation_id": invitation_id, "action": action})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du status de l'invitation."
        )

    _log_league_event(logging.INFO, "league.http.invitation_update_succeeded", current_user=current_user, invitation_id=invitation_id, action=action)
    return update_invitation_result


@router.delete(
    "/league/invitation/{invitation_id}",
    response_model=InvitationDeleteResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Delete invitation to a league",
)
async def delete_invitation(
        invitation_id: int = Path(..., gt=0),
        league_command_usecase: LeagueCommandUseCase = Depends(league_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        delete_invitation_result = await league_command_usecase.delete_invitation(invitation_id, current_user.get('email'))
    except InvitationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except InvitationDeletionNotAllowedError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message
        )
    except UserNotOwnerLeaguedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except LeagueFinishedError as e:
        _raise_league_finished(e)
    except Exception as e:
        logger.exception("league.http.invitation_delete_failed", extra={"user_id": current_user.get("id"), "invitation_id": invitation_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la suppression d'une l'invitation à une league"
        )

    _log_league_event(logging.INFO, "league.http.invitation_delete_succeeded", current_user=current_user, invitation_id=invitation_id)
    return delete_invitation_result

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
    except LeagueFinishedError as e:
        _raise_league_finished(e)
    except Exception as e:
        logger.exception("league.http.update_failed", extra={"user_id": current_user.get("id"), "league_id": id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification de la ligue"
        )

    _log_league_event(logging.INFO, "league.http.update_succeeded", current_user=current_user, league_id=id)
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
        result = await league_command_usecase.inject_btl(league_id, inject_model.amount, current_user.get('email', ''))
        _log_league_event(logging.INFO, "league.http.inject_btl_succeeded", current_user=current_user, league_id=league_id, amount=inject_model.amount)
        return result
    except LeagueNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except LeagueParticipantNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except LeagueNbBtlIsNotEnoughError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except LeagueFinishedError as e:
        _raise_league_finished(e)
    except UserNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        logger.exception("league.http.inject_btl_failed", extra={"user_id": current_user.get("id"), "league_id": league_id})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=e)

