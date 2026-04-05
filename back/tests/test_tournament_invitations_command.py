from types import SimpleNamespace

import pytest

import application.tournament.tournament_command_usecase as command_module
from application.tournament.tournament_command_usecase import TournamentCommandUseCaseImpl
from domain.invitation.model.invitation_status import InvitationStatus
from domain.tournament.exception.tournament_exception import TournamentSelfInvitationError
from domain.tournament.model.tournament import Tournament
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
        self.invitation_added = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return FakeTransaction()


class FakeTournamentUnitOfWork:
    def __init__(self, session):
        self.user_repo = FakeUserRepository(session)
        self.tournament_repo = FakeTournamentRepository(session)
        self.tournament_players_repo = FakePlayersRepository(session)
        self.invitation_repo = FakeInvitationRepository(session)
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
        return SimpleNamespace(id=42, email=Email(email), pseudo='owner')

    async def find_by_id(self, user_id: int):
        return SimpleNamespace(id=user_id, email=Email(f'user{user_id}@example.com'), pseudo=f'user-{user_id}')


class FakeTournamentRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_id(self, tournament_id: int):
        return Tournament(
            id=tournament_id,
            uuid=f"tournament-{tournament_id}",
            name=f"Tournament {tournament_id}",
            is_private=True,
            user=UserSummary(id=42, email=Email('owner@example.com'), pseudo='owner'),
            status=TournamentStatus.PENDING,
            current_players=4,
            max_players=16,
            min_players=8,
            start_date=9999999999999,
            entry_fee=5.0,
            prize_pool=20.0,
        )

    async def find_by_id_for_update(self, tournament_id: int):
        return await self.find_by_id(tournament_id)


class FakePlayersRepository:
    def __init__(self, session):
        self.session = session

    async def get_player(self, tournament_id: int, user_id: int):
        return None


class FakeInvitationRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_user_id_tournament_id(self, user_id: int, tournament_id: int):
        return False

    async def add(self, invitation):
        self.session.invitation_added = invitation


@pytest.mark.asyncio
async def test_invite_user_creates_pending_tournament_invitation(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()

    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: session,
        uow_factory=lambda: FakeTournamentUnitOfWork(session),
    )

    result = await usecase.invite_user(12, 7, 'owner@example.com')

    assert result.message == 'The user is invited to join this tournament'
    assert session.invitation_added is not None
    assert session.invitation_added.tournament_id == 12
    assert session.invitation_added.user_id == 7
    assert session.invitation_added.user_sender_id == 42
    assert session.invitation_added.status == InvitationStatus.pending


@pytest.mark.asyncio
async def test_invite_user_rejects_self_invitation(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()

    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: session,
        uow_factory=lambda: FakeTournamentUnitOfWork(session),
    )

    with pytest.raises(TournamentSelfInvitationError):
        await usecase.invite_user(12, 42, 'owner@example.com')

    assert session.invitation_added is None

