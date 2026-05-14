from types import SimpleNamespace

import pytest

from application.tournament.tournament_command_usecase import TournamentCommandUseCaseImpl
from domain.tournament.exception.tournament_exception import (
    TournamentAlreadyStartedError,
    TournamentOwnerCannotLeaveError,
    TournamentPlayerNotFoundError,
)
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


class FakeTournamentUnitOfWork:
    def __init__(self, *, tournament_repo, tournament_players_repo):
        self.tournament_repo = tournament_repo
        self.tournament_players_repo = tournament_players_repo
        self.user_repo = SimpleNamespace()
        self.invitation_repo = SimpleNamespace()
        self.tournament_subscription_repo = SimpleNamespace()
        self.ticket_repo = SimpleNamespace()
        self.tournament_stage_repo = SimpleNamespace()
        self.tournament_match_repo = SimpleNamespace()
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def commit(self):
        self.committed = True


class FakeTournamentRepository:
    def __init__(self, tournament: Tournament | None):
        self.tournament = tournament
        self.updated_tournament = None

    async def find_by_id_for_update(self, tournament_id: int):
        return self.tournament

    async def update(self, tournament: Tournament):
        self.updated_tournament = tournament
        return tournament


class FakeTournamentPlayersRepository:
    def __init__(self, player: TournamentPlayer | None):
        self.player = player
        self.unregistered_player_id = None

    async def get_player(self, tournament_id: int, user_id: int):
        return self.player

    async def unregister_tournament(self, tournament_players_id: int):
        self.unregistered_player_id = tournament_players_id


def make_tournament(*, owner_id: int = 42, status: TournamentStatus = TournamentStatus.PENDING):
    return Tournament(
        id=12,
        uuid='tournament-12',
        name='Tournament 12',
        is_private=False,
        current_players=3,
        max_players=4,
        prize_pool=15.0,
        entry_fee=5.0,
        status=status,
        user=UserSummary(id=owner_id, email=Email('owner@example.com'), pseudo='owner'),
    )


def make_player(*, player_id: int = 99, user_id: int = 7, tournament_id: int = 12):
    return TournamentPlayer(
        id=player_id,
        user_id=user_id,
        tournament_id=tournament_id,
        nb_btl=100.0,
        is_eliminated=False,
    )


@pytest.mark.asyncio
async def test_leave_tournament_unregisters_participant_and_updates_tournament_counts():
    tournament = make_tournament(owner_id=42, status=TournamentStatus.PENDING)
    players_repo = FakeTournamentPlayersRepository(player=make_player(player_id=99, user_id=7))
    tournament_repo = FakeTournamentRepository(tournament=tournament)
    uow = FakeTournamentUnitOfWork(
        tournament_repo=tournament_repo,
        tournament_players_repo=players_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    result = await usecase.leave_tournament(12, 7)

    assert result.message == 'Le joueur a bien été retiré du tournoi.'
    assert players_repo.unregistered_player_id == 99
    assert tournament.current_players == 2
    assert tournament.prize_pool == 10.0
    assert tournament_repo.updated_tournament is tournament
    assert uow.committed is True


@pytest.mark.asyncio
async def test_leave_tournament_rejects_owner_leaving_own_tournament():
    tournament = make_tournament(owner_id=42, status=TournamentStatus.PENDING)
    players_repo = FakeTournamentPlayersRepository(player=make_player(player_id=101, user_id=42))
    tournament_repo = FakeTournamentRepository(tournament=tournament)
    uow = FakeTournamentUnitOfWork(
        tournament_repo=tournament_repo,
        tournament_players_repo=players_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    with pytest.raises(TournamentOwnerCannotLeaveError):
        await usecase.leave_tournament(12, 42)

    assert players_repo.unregistered_player_id is None
    assert tournament_repo.updated_tournament is None
    assert uow.committed is False
    assert tournament.current_players == 3
    assert tournament.prize_pool == 15.0


@pytest.mark.asyncio
async def test_leave_tournament_rejects_started_tournament():
    tournament = make_tournament(owner_id=42, status=TournamentStatus.IN_PROGRESS)
    players_repo = FakeTournamentPlayersRepository(player=make_player(player_id=99, user_id=7))
    tournament_repo = FakeTournamentRepository(tournament=tournament)
    uow = FakeTournamentUnitOfWork(
        tournament_repo=tournament_repo,
        tournament_players_repo=players_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    with pytest.raises(TournamentAlreadyStartedError):
        await usecase.leave_tournament(12, 7)

    assert players_repo.unregistered_player_id is None
    assert tournament_repo.updated_tournament is None
    assert uow.committed is False


@pytest.mark.asyncio
async def test_leave_tournament_rejects_when_player_not_registered():
    tournament = make_tournament(owner_id=42, status=TournamentStatus.PENDING)
    players_repo = FakeTournamentPlayersRepository(player=None)
    tournament_repo = FakeTournamentRepository(tournament=tournament)
    uow = FakeTournamentUnitOfWork(
        tournament_repo=tournament_repo,
        tournament_players_repo=players_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    with pytest.raises(TournamentPlayerNotFoundError):
        await usecase.leave_tournament(12, 7)

    assert players_repo.unregistered_player_id is None
    assert tournament_repo.updated_tournament is None
    assert uow.committed is False

