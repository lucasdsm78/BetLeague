import logging
from abc import abstractmethod, ABC

import shortuuid

from application.match.match_command_model import NoMatchChoiceUpdatedResponse, MatchChoiceUpdatedResponse
from application.ticket.ticket_command_model import TicketCreateModel, TicketCreateResponse, TicketRemoveResponse
from domain.league.exception.league_exception import LeagueParticipantNotFoundError, NbBTLHasReached0, \
    LeagueNotStartedError, LeagueNotFoundError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.exception.match_exception import MatchNotFoundError
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.exception.ticket_exception import GainNotEqualsError, TicketNotFoundError, NotTicketOwnerError, \
    MatchAlreadyStartedError
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.token.token_exception import TokenInvalidError
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.config import Settings


class TicketCommandUseCase(ABC):

    @abstractmethod
    def create_ticket(self, league_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        raise NotImplementedError

    @abstractmethod
    def remove_ticket(self, email: str, ticket_id: int) -> TicketRemoveResponse:
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
            if not existing_user:
                raise UserNotFoundError

            existing_league = self.league_repository.find_by_id(league_id=league_id)
            if not existing_league:
                raise LeagueNotFoundError

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

            # if existing_league.is_started is False:
            #     raise LeagueNotStartedError

            gain = self.ticket_repository.get_gain(ticket_create_model.match_choices, ticket_create_model.mise)
            # if gain != ticket_create_model.gain:
            #     raise GainNotEqualsError

            uuid = shortuuid.uuid()

            ticket = Ticket(
                uuid=uuid,
                gain=gain,
                league_id=existing_league.id,
                mise=ticket_create_model.mise,
                status=TicketStatus.pending,
                user=UserSummary(id=existing_user.id, email=existing_user.email)
            )

            self.ticket_repository.create(ticket)
            self.ticket_repository.commit()

            ticket_creating = self.ticket_repository.find_by_uuid(uuid)
            if not ticket_creating:
                raise TicketNotFoundError

            match_choices_to_save = []
            for match_choice in ticket_create_model.match_choices:
                match = self.match_repository.find_by_id(match_choice.match_id)
                if not match:
                    raise MatchNotFoundError

                new_match_choice = MatchChoice(
                    match_id=match.id,
                    ticket_id=ticket_creating.id,
                    choice=match_choice.choice,
                    status=MatchChoiceStatus.pending,
                )
                match_choices_to_save.append(new_match_choice)

            for mc in match_choices_to_save:
                self.match_choices_repository.create(mc)

            self.match_choices_repository.commit()

        except:
            self.ticket_repository.rollback()
            self.match_choices_repository.rollback()
            raise

        return TicketCreateResponse()


    def remove_ticket(self, email: str, ticket_id: int) -> TicketRemoveResponse:
        try:
            ticket = self.ticket_repository.find_by_id(ticket_id)
            if ticket is None:
                raise TicketNotFoundError

            user = self.user_repository.find_by_email(email)
            if ticket.user.id != user.id:
                raise NotTicketOwnerError

            match_already_started = self.match_repository.exists_match_started_for_ticket(ticket_id)
            if match_already_started:
                raise MatchAlreadyStartedError

            self.match_choices_repository.delete_by_ticket_id(ticket.id)
            self.ticket_repository.delete(ticket_id)
            self.ticket_repository.commit()
        except:
            self.ticket_repository.rollback()
            raise

        return TicketRemoveResponse()
