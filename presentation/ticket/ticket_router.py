from fastapi import APIRouter, Depends, HTTPException, status
from application.ticket.ticket_command_model import TicketCreateResponse, TicketCreateModel
from application.ticket.ticket_command_usecase import TicketCommandUseCase
from dependency_injections import current_user, ticket_command_usecase
from domain.league.exception.league_exception import LeagueNotFoundError, \
    LeagueParticipantNotFoundError
from domain.match.exception.match_exception import MatchNotFoundError
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

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return ticket
