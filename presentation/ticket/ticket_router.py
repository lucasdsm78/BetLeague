from fastapi import APIRouter, Depends, HTTPException, status

from application.match.match_command_model import MatchChoiceUpdatedResponse
from application.ticket.ticket_command_model import TicketCreateResponse, TicketCreateModel
from application.ticket.ticket_command_usecase import TicketCommandUseCase
from dependency_injections import current_user, ticket_command_usecase
from domain.league.exception.league_exception import LeagueNotFoundError, \
    LeagueParticipantNotFoundError, NbBTLHasReached0, LeagueNotStartedError
from domain.match.exception.match_exception import MatchNotFoundError
from domain.token.token_exception import TokenInvalidError
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

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return ticket


@router.post(
    "/ticket/check_match_choices",
    response_model=MatchChoiceUpdatedResponse,
    summary="Check match choices",
    status_code=status.HTTP_200_OK,
)
async def check_match_choices(
        token: str,
        ticket_command_usecase: TicketCommandUseCase = Depends(ticket_command_usecase),
):
    try:
        return ticket_command_usecase.check_match_choices(token=token)

    except TokenInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.message,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
