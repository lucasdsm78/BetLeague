from fastapi import APIRouter, Depends, HTTPException, status

from application.ticket.ticket_command_model import TicketCreateResponse, TicketCreateModel, TicketRemoveResponse, \
    TicketUpdateResponse, TicketUpdateModel
from application.ticket.ticket_command_usecase import TicketCommandUseCase
from application.ticket.ticket_query_model import TicketReadModel
from application.ticket.ticket_query_usecase import TicketQueryUseCase
from dependency_injections import current_user, ticket_command_usecase, ticket_query_usecase
from domain.league.exception.league_exception import LeagueNotFoundError, \
    LeagueParticipantNotFoundError, NbBTLHasReached0, LeagueNotStartedError
from domain.match.exception.match_exception import MatchNotFoundError
from domain.ticket.exception.ticket_exception import TicketNotFoundError, NotTicketOwnerError, MatchAlreadyStartedError, \
    MiseSuperiorToNbBtlError, TicketAccessDeniedError, GainNotEqualsError
from domain.user.exception.user_exception import UserNotFoundError

router = APIRouter(
    tags=['ticket']
)


@router.post(
    "/ticket/create",
    response_model=TicketCreateResponse,
    summary="Create a ticket to bet",
    status_code=status.HTTP_200_OK,
)
async def create_ticket(
        league_id: int,
        ticket_create_model: TicketCreateModel,
        ticket_command_usecase: TicketCommandUseCase = Depends(ticket_command_usecase),
        current_user: dict = Depends(current_user)
):
    try:
        ticket = ticket_command_usecase.create_ticket(league_id, ticket_create_model, current_user.get('email', ''))

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
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except LeagueNotStartedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except MiseSuperiorToNbBtlError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
        )

    except Exception as e:
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
        remove_ticket_result = ticket_command_usecase.remove_ticket(current_user.get('email'), ticket_id)
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
    except Exception as e:
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
        ticket = ticket_query_usecase.get_ticket_details(ticket_id, current_user.get('email'))
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message
        )
    except LeagueNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la récupération du ticket."
        )

    return ticket


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
        remove_ticket_result = ticket_command_usecase.update_ticket(current_user.get('email'), ticket_id, ticket_create_model)
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la modification du ticket."
        )

    return remove_ticket_result
