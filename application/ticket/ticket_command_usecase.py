import logging
from abc import abstractmethod, ABC

import shortuuid

from application.match.match_command_model import NoMatchChoiceUpdatedResponse, MatchChoiceUpdatedResponse
from application.ticket.ticket_command_model import TicketCreateModel, TicketCreateResponse
from domain.league.exception.league_exception import LeagueParticipantNotFoundError, NbBTLHasReached0, \
    LeagueNotStartedError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.exception.ticket_exception import GainNotEqualsError
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from domain.ticket.model.ticket import Ticket
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.token.token_exception import TokenInvalidError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.config import Settings


class TicketCommandUseCase(ABC):

    @abstractmethod
    def create_ticket(self, league_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        raise NotImplementedError


class TicketCommandUseCaseImpl(TicketCommandUseCase):

    def __init__(
            self,
            ticket_repository: TicketRepository,
            league_repository: LeagueRepository,
            user_repository: UserRepository,
            match_choices_repository: MatchChoiceRepository,
            match_repository: MatchRepository,
            league_players_repository: LeaguePlayersRepository,
            settings: Settings
    ):
        self.ticket_repository: TicketRepository = ticket_repository
        self.user_repository: UserRepository = user_repository
        self.league_repository: LeagueRepository = league_repository
        self.match_choices_repository: MatchChoiceRepository = match_choices_repository
        self.match_repository: MatchRepository = match_repository
        self.league_players_repository: LeaguePlayersRepository = league_players_repository
        self.settings: Settings = settings

    def create_ticket(self, league_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        try:
            existing_user = self.user_repository.find_by_email(email)

            existing_league = self.league_repository.find_by_id(league_id=league_id)

            is_participate = self.league_players_repository.find_participation(
                league_id=existing_league.id,
                user_id=existing_user.id
            )

            if is_participate is False:
                raise LeagueParticipantNotFoundError

            league_player = self.league_players_repository.get_participation(
                league_id=existing_league.id,
                user_id=existing_user.id
            )

            if league_player.nb_btl == 0:
                raise NbBTLHasReached0

            if existing_league.is_started is False:
                raise LeagueNotStartedError

            gain = self.ticket_repository.get_gain(ticket_create_model.match_choices, ticket_create_model.mise)
            # if gain != ticket_create_model.gain:
            #     raise GainNotEqualsError

            uuid = shortuuid.uuid()

            ticket = Ticket(
                uuid=uuid,
                gain=gain,
                league_id=existing_league.id,
                mise=ticket_create_model.mise,
                user=UserSummary(id=existing_user.id, email=existing_user.email)
            )

            self.ticket_repository.create(ticket)
            self.ticket_repository.commit()

            ticket_creating = self.ticket_repository.find_by_uuid(uuid)

            for match_choice in ticket_create_model.match_choices:
                match = self.match_repository.find_by_id(match_choice.match_id)
                new_match_choice = MatchChoice(
                    match_id=match.id,
                    ticket_id=ticket_creating.id,
                    choice=match_choice.choice,
                    status=MatchChoiceStatus.pending,
                )
                self.match_choices_repository.create(new_match_choice)
                self.match_choices_repository.commit()

        except:
            self.ticket_repository.rollback()
            self.match_choices_repository.rollback()
            raise

        return TicketCreateResponse()
