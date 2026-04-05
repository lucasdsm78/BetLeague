from types import SimpleNamespace

import pytest

import application.tournament.tournament_command_usecase as command_module
from application.tournament.tournament_command_usecase import TournamentCommandUseCaseImpl
from domain.invitation.exception.invitation_exception import InvitationNotFoundError
from domain.invitation.model.invitation_status import InvitationStatus
from domain.tournament.model.tournament import Tournament
from domain.tournament.exception.tournament_exception import UserNotInvitationTournamentError
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSession:
    def __init__(self):
        self.deleted_invitation_id = None
        self.added_player = None
        self.updated_tournament = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return FakeTransaction()


class FakeTournamentUnitOfWork:
    def __init__(self, session, tournament_repo, players_repo, invitation_repo):
        self.user_repo = FakeUserRepository(session)
        self.tournament_repo = tournament_repo
        self.tournament_players_repo = players_repo
        self.invitation_repo = invitation_repo
        self.tournament_subscription_repo = SimpleNamespace()
        self.ticket_repo = SimpleNamespace()
        self.tournament_stage_repo = SimpleNamespace()
        self.tournament_match_repo = SimpleNamespace()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def commit(self):
        return None


class FakeUserRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_email(self, email: str):
        return SimpleNamespace(id=7, email=Email(email), pseudo='invitee')


class FakeTournamentRepository:
    def __init__(self, session):
        self.session = session
        self.current_players = 15
        self.status = TournamentStatus.PENDING

    async def find_by_id(self, tournament_id: int):
        return Tournament(
            id=tournament_id,
            uuid=f"tournament-{tournament_id}",
            name=f"Tournament {tournament_id}",
            is_private=True,
            current_players=self.current_players,
            max_players=16,
            prize_pool=75.0,
            entry_fee=5.0,
            status=self.status,
            user=UserSummary(id=42, email=Email('owner@example.com'), pseudo='owner'),
        )

    async def find_by_id_for_update(self, tournament_id: int):
        return await self.find_by_id(tournament_id)

    async def update(self, tournament):
        self.session.updated_tournament = tournament
        self.current_players = tournament.current_players


class FakePlayersRepository:
    def __init__(self, session):
        self.session = session
        self.existing_player = None

    async def get_player(self, tournament_id: int, user_id: int):
        return self.existing_player

    async def add_player(self, player):
        self.session.added_player = player


class FakeInvitationRepository:
    def __init__(self, session):
        self.session = session
        self.user_id = 7
        self.tournament_id = 12

    async def find_by_id(self, invitation_id: int):
        return SimpleNamespace(
            id=invitation_id,
            user_id=self.user_id,
            user_sender_id=42,
            league_id=None,
            tournament_id=self.tournament_id,
            status=InvitationStatus.pending,
        )

    async def delete(self, invitation_id: int):
        self.session.deleted_invitation_id = invitation_id
        return True


@pytest.mark.asyncio
async def test_accept_tournament_invitation_adds_player_and_starts_when_full(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    tournament_repo = FakeTournamentRepository(session)
    players_repo = FakePlayersRepository(session)
    invitation_repo = FakeInvitationRepository(session)

    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: session,
        uow_factory=lambda: FakeTournamentUnitOfWork(session, tournament_repo, players_repo, invitation_repo),
    )

    started = {}

    async def fake_start_tournament(tournament_id: int, email: str):
        started['tournament_id'] = tournament_id
        started['email'] = email
        return SimpleNamespace(message='Tournament start successfully')

    usecase.start_tournament = fake_start_tournament

    result = await usecase.update_invitation(5, True, 'invitee@example.com')

    assert result.message == 'Tournament invitation accepted successfully'
    assert session.added_player is not None
    assert session.added_player.user_id == 7
    assert session.deleted_invitation_id == 5
    assert session.updated_tournament is not None
    assert session.updated_tournament.current_players == 16
    assert started == {'tournament_id': 12, 'email': 'owner@example.com'}


@pytest.mark.asyncio
async def test_decline_tournament_invitation_only_deletes_invitation(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    tournament_repo = FakeTournamentRepository(session)
    players_repo = FakePlayersRepository(session)
    invitation_repo = FakeInvitationRepository(session)

    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: session,
        uow_factory=lambda: FakeTournamentUnitOfWork(session, tournament_repo, players_repo, invitation_repo),
    )
    result = await usecase.update_invitation(5, False, 'invitee@example.com')

    assert result.message == 'Tournament invitation declined successfully'
    assert session.deleted_invitation_id == 5
    assert session.added_player is None
    assert session.updated_tournament is None


@pytest.mark.asyncio
async def test_accept_tournament_invitation_rejects_non_recipient(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    tournament_repo = FakeTournamentRepository(session)
    players_repo = FakePlayersRepository(session)
    invitation_repo = FakeInvitationRepository(session)
    invitation_repo.user_id = 999

    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: session,
        uow_factory=lambda: FakeTournamentUnitOfWork(session, tournament_repo, players_repo, invitation_repo),
    )

    with pytest.raises(UserNotInvitationTournamentError):
        await usecase.update_invitation(5, True, 'invitee@example.com')


@pytest.mark.asyncio
async def test_accept_tournament_invitation_rejects_non_tournament_invitation(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    tournament_repo = FakeTournamentRepository(session)
    players_repo = FakePlayersRepository(session)
    invitation_repo = FakeInvitationRepository(session)
    invitation_repo.tournament_id = None

    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: session,
        uow_factory=lambda: FakeTournamentUnitOfWork(session, tournament_repo, players_repo, invitation_repo),
    )

    with pytest.raises(InvitationNotFoundError):
        await usecase.update_invitation(5, True, 'invitee@example.com')

