from fastapi import APIRouter, Depends, HTTPException, Header, Query, status

from application.match.match_command_model import MatchChoiceUpdatedResponse
from application.ticket.ticket_command_model import TicketCreateResponse, TicketCreateModel, TicketRemoveResponse, \
    TicketUpdateResponse, TicketUpdateModel
from application.ticket.ticket_command_usecase import TicketCommandUseCase
from application.ticket.ticket_query_model import TicketReadModel, TicketsInProgressResponse, TicketsFinishedResponse, SharedTicketReadModel
from application.ticket.ticket_query_usecase import TicketQueryUseCase
from dependency_injections import current_user, get_settings, ticket_command_usecase, ticket_query_usecase
from infrastructure.config import Settings
from domain.league.exception.league_exception import LeagueNotFoundError, \
    LeagueParticipantNotFoundError, NbBTLHasReached0, LeagueNotStartedError
from domain.match.exception.match_exception import MatchNotFoundError
from domain.ticket.exception.ticket_exception import TicketNotFoundError, NotTicketOwnerError, MatchAlreadyStartedError, \
    MiseSuperiorToNbBtlError, TicketAccessDeniedError, GainNotEqualsError, TicketNotShareableError
from domain.token.token_exception import TokenInvalidError
from domain.tournament.exception.tournament_exception import TournamentNotFoundError, UserNotInTournamentError, \
    TournamentAlreadyStartedError
from domain.user.exception.user_exception import UserNotFoundError
from domain.ticket.exception.duplicate_match_choice_error import DuplicateMatchChoiceError

router = APIRouter(
    prefix="/api",
    tags=['ticket']
)


@router.post(
    "/ticket/create",
    response_model=TicketCreateResponse,
    summary="Create a ticket to bet",
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket(
        league_id: int,
        ticket_create_model: TicketCreateModel,
        ticket_command_usecase: TicketCommandUseCase = Depends(ticket_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        ticket = await ticket_command_usecase.create_ticket(league_id, ticket_create_model, current_user.get('email', ''))

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

    except MatchNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except LeagueParticipantNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except NbBTLHasReached0 as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    except LeagueNotStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    except MiseSuperiorToNbBtlError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.message,
        )

    except MatchAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message,
        )

    except DuplicateMatchChoiceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=e.message,
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return ticket


@router.delete(
    "/ticket/{ticket_id}",
    response_model=TicketRemoveResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Retirer un ticket (pari) si tous les matchs sont à venir"
)
async def remove_ticket(
        ticket_id: int,
        ticket_command_usecase: TicketCommandUseCase = Depends(ticket_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        remove_ticket_result = await ticket_command_usecase.remove_ticket(current_user.get('email'), ticket_id)
    except TicketNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except NotTicketOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except MatchAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la suppression du ticket."
        )

    return remove_ticket_result


@router.get(
    "/ticket/{ticket_id}",
    response_model=TicketReadModel,
    status_code=status.HTTP_200_OK,
    summary="Get détails ticket"
)
async def get_details_ticket(
        ticket_id: int,
        ticket_query_usecase: TicketQueryUseCase = Depends(ticket_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        ticket = await ticket_query_usecase.get_ticket_details(ticket_id, current_user.get('email'))
    except TicketNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except TicketAccessDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération du ticket."
        )

    return ticket


@router.get(
    "/ticket/shared/{ticket_uuid}",
    response_model=SharedTicketReadModel,
    status_code=status.HTTP_200_OK,
    summary="Get public shared winning ticket details",
)
async def get_shared_ticket(
        ticket_uuid: str,
        ticket_query_usecase: TicketQueryUseCase = Depends(ticket_query_usecase),
):
    try:
        return await ticket_query_usecase.get_shared_ticket_details(ticket_uuid)
    except TicketNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TicketNotShareableError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except LeagueNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération du ticket partagé."
        )


@router.put(
    "/ticket/{ticket_id}",
    response_model=TicketUpdateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Update ticket"
)
async def update_ticket(
        ticket_id: int,
        ticket_create_model: TicketUpdateModel,
        ticket_command_usecase: TicketCommandUseCase = Depends(ticket_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        remove_ticket_result = await ticket_command_usecase.update_ticket(current_user.get('email'), ticket_id, ticket_create_model)
    except TicketNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except NotTicketOwnerError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except MatchAlreadyStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except GainNotEqualsError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=e.message
        )
    except MatchNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du ticket."
        )

    return remove_ticket_result


@router.get(
    "/tickets/in-progress",
    response_model=TicketsInProgressResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer tous les tickets en cours"
)
async def get_tickets_in_progress(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        league_id: int | None = Query(None, ge=1),
        is_tournament: bool | None = Query(None),
        ticket_query_usecase: TicketQueryUseCase = Depends(ticket_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        if league_id is not None and is_tournament is True:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choisissez soit league_id soit is_tournament=true (pas les deux).",
            )

        tickets = await ticket_query_usecase.get_tickets_in_progress(
            current_user.get('email', ''),
            page,
            page_size,
            league_id=league_id,
            is_tournament=is_tournament,
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération des tickets en cours."
        )

    return tickets


@router.get(
    "/tickets/finished",
    response_model=TicketsFinishedResponse,
    status_code=status.HTTP_200_OK,
    summary="Récupérer tous les tickets terminés"
)
async def get_tickets_finished(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        league_id: int | None = Query(None, ge=1),
        is_tournament: bool | None = Query(None),
        ticket_query_usecase: TicketQueryUseCase = Depends(ticket_query_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        if league_id is not None and is_tournament is True:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choisissez soit league_id soit is_tournament=true (pas les deux).",
            )

        tickets = await ticket_query_usecase.get_tickets_finished(
            current_user.get('email', ''),
            page,
            page_size,
            league_id=league_id,
            is_tournament=is_tournament,
        )
    except UserNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération des tickets terminés."
        )

    return tickets


@router.post(
    "/tournament/{tournament_id}/match/{match_id}/bet",
    response_model=TicketCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Parier sur un match de tournoi",
)
async def create_tournament_ticket(
        tournament_id: int,
        match_id: int,
        ticket_model: TicketCreateModel,
        ticket_usecase: TicketCommandUseCase = Depends(ticket_command_usecase),
        current_user: dict = Depends(current_user),
        settings: Settings = Depends(get_settings),
):
    if not settings.tournament_subscription_enabled:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="La création de tickets tournoi est désactivée.",
        )

    try:
        return await ticket_usecase.create_tournament_ticket(tournament_id, match_id, ticket_model, current_user.get('email', ''))
    except UserNotFoundError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except TournamentNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except MiseSuperiorToNbBtlError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except TournamentAlreadyStartedError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except MatchNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UserNotInTournamentError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la création du pari de tournoi."
        )

@router.post(
    "/ticket/check_match_choices",
    response_model=MatchChoiceUpdatedResponse,
    summary="Check match choices",
    status_code=status.HTTP_200_OK,
)
async def check_match_choices_by_match_id(
        match_id: int,
        authorization: str = Header(...),
        ticket_command_usecase: TicketCommandUseCase = Depends(ticket_command_usecase),
):
    token = authorization.removeprefix("Bearer ").strip()
    try:
        return await ticket_command_usecase.check_match_choices_by_match_id(token=token, match_id=match_id)

    except TokenInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
