from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List

import shortuuid
from application.ticket.ticket_command_model import TicketCreateModel, TicketCreateResponse
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.ticket import Ticket
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository


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
    ):
        self.ticket_repository: TicketRepository = ticket_repository
        self.user_repository: UserRepository = user_repository
        self.league_repository: LeagueRepository = league_repository
        self.match_choices_repository: MatchChoiceRepository = match_choices_repository
        self.match_repository: MatchRepository = match_repository

    def create_ticket(self, league_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        try:
            existing_user = self.user_repository.find_by_email(email)

            existing_league = self.league_repository.find_by_id(league_id=league_id)

            uuid = shortuuid.uuid()

            ticket = Ticket(
                uuid=uuid,
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
                    choice=match_choice.choice
                )
                self.match_choices_repository.create(new_match_choice)
                self.match_choices_repository.commit()

        except:
            self.ticket_repository.rollback()
            self.match_choices_repository.rollback()
            raise

        return TicketCreateResponse()
