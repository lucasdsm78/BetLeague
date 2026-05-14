from decimal import Decimal
from types import SimpleNamespace

import pytest

from application.ticket.ticket_command_model import MatchChoiceData, TicketCreateModel
from application.ticket.ticket_command_usecase import TicketCommandUseCaseImpl
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.model.email import Email


class FakeUnitOfWork:
    def __init__(self):
        self.created_ticket = None
        self.bulk_choices = None
        self.committed = False
        self.next_display_number = 7
        self.ticket_id = 41
        self.user = SimpleNamespace(id=3, email=Email('player@example.com'), pseudo='player')
        self.league = SimpleNamespace(id=12, is_started=True)
        self.league_player = SimpleNamespace(nb_btl=100)
        self.tournament = SimpleNamespace(id=9, status=TournamentStatus.IN_PROGRESS)
        self.tournament_player = SimpleNamespace(nb_btl=100, is_eliminated=False)
        self.tournament_match = SimpleNamespace(id=33, tournament_id=9)

        self.user_repo = SimpleNamespace(find_by_email=self.find_by_email)
        self.league_repo = SimpleNamespace(find_by_id=self.find_league_by_id)
        self.league_players_repo = SimpleNamespace(
            get_participation_locked=self.get_participation_locked,
            update=self.update_league_player,
        )
        self.tournament_repo = SimpleNamespace(find_by_id=self.find_tournament_by_id)
        self.tournament_players_repo = SimpleNamespace(
            get_player=self.get_tournament_player,
            update=self.update_tournament_player,
        )
        self.tournament_match_repo = SimpleNamespace(find_by_id=self.find_tournament_match_by_id)
        self.match_repo = SimpleNamespace(
            exists_match_started_for_ticket=self.exists_match_started_for_ticket,
            find_all_by_ids=self.find_matches_by_ids,
        )
        self.match_odd_repo = SimpleNamespace(find_all_by_ids=self.find_odds_by_ids)
        self.ticket_repo = SimpleNamespace(
            reserve_next_display_number=self.reserve_next_display_number,
            create=self.create_ticket,
        )
        self.match_choice_repo = SimpleNamespace(bulk_create=self.bulk_create_choices)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def commit(self):
        self.committed = True

    async def find_by_email(self, email: str):
        return self.user if email == 'player@example.com' else None

    async def find_league_by_id(self, league_id: int):
        return self.league if league_id == 12 else None

    async def get_participation_locked(self, league_id: int, user_id: int):
        return self.league_player

    async def update_league_player(self, league_player):
        self.league_player = league_player

    async def find_tournament_by_id(self, tournament_id: int):
        return self.tournament if tournament_id == 9 else None

    async def get_tournament_player(self, tournament_id: int, user_id: int):
        return self.tournament_player

    async def update_tournament_player(self, tournament_player):
        self.tournament_player = tournament_player

    async def find_tournament_match_by_id(self, match_id: int):
        return self.tournament_match if match_id == 33 else None

    async def exists_match_started_for_ticket(self, match_choices_data):
        return False

    async def find_matches_by_ids(self, match_ids):
        return [SimpleNamespace(id=11)]

    async def find_odds_by_ids(self, odd_ids):
        return [SimpleNamespace(id=21, odd=Decimal('2.50'), match_id=11, value='Home')]

    async def reserve_next_display_number(self, user_id: int):
        return self.next_display_number

    async def create_ticket(self, ticket):
        self.created_ticket = ticket
        return self.ticket_id

    async def bulk_create_choices(self, choices):
        self.bulk_choices = choices


def make_usecase(uow: FakeUnitOfWork) -> TicketCommandUseCaseImpl:
    return TicketCommandUseCaseImpl(
        uow_factory=lambda: uow,
        settings=SimpleNamespace(secret_key_token='secret'),
    )


def make_model() -> TicketCreateModel:
    return TicketCreateModel(
        mise=10,
        match_choices=[MatchChoiceData(match_id=11, match_odd_id=21)],
    )


@pytest.mark.asyncio
async def test_create_ticket_persists_reserved_display_number():
    uow = FakeUnitOfWork()
    usecase = make_usecase(uow)

    response = await usecase.create_ticket(12, make_model(), 'player@example.com')

    assert response.ticket_id == 41
    assert uow.created_ticket is not None
    assert uow.created_ticket.display_number == 7
    assert uow.committed is True


@pytest.mark.asyncio
async def test_create_tournament_ticket_persists_reserved_display_number():
    uow = FakeUnitOfWork()
    uow.next_display_number = 8
    uow.ticket_id = 55
    usecase = make_usecase(uow)

    response = await usecase.create_tournament_ticket(9, 33, make_model(), 'player@example.com')

    assert response.ticket_id == 55
    assert uow.created_ticket is not None
    assert uow.created_ticket.display_number == 8
    assert uow.committed is True

