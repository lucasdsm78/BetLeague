from types import SimpleNamespace

import pytest

import application.league.league_command_usecase as command_module
from application.league.league_command_usecase import LeagueCommandUseCaseImpl
from domain.invitation.exception.invitation_exception import InvitationDeletionNotAllowedError
from domain.invitation.model.invitation_status import InvitationStatus
from domain.league.exception.league_exception import UserNotOwnerLeaguedError
from domain.user.model.email import Email


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSession:
    def __init__(self):
        self.deleted_invitation_id = None
        self.updated_league = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return FakeTransaction()


class FakeUserRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_email(self, email: str):
        return SimpleNamespace(id=42, email=Email(email), pseudo='owner')


class FakeLeagueRepository:
    def __init__(self, session):
        self.session = session

    async def find_by_id(self, league_id: int):
        return SimpleNamespace(id=league_id, user=SimpleNamespace(id=42))

    async def increment_players_remaining(self, league_id: int):
        league = SimpleNamespace(id=league_id, nb_players_remaining=4)
        self.session.updated_league = league
        return league

    async def update(self, league):
        self.session.updated_league = league


class FakeInvitationRepository:
    def __init__(self, session):
        self.session = session
        self.sender_id = 42
        self.status = InvitationStatus.pending

    async def find_by_id(self, invitation_id: int):
        return SimpleNamespace(id=invitation_id, league_id=12, user_sender_id=self.sender_id, status=self.status)

    async def delete(self, invitation_id: int):
        self.session.deleted_invitation_id = invitation_id
        return True


@pytest.mark.asyncio
async def test_delete_league_invitation_deletes_when_current_user_is_owner(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    invitation_repo = FakeInvitationRepository(session)

    monkeypatch.setattr(command_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(command_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
    monkeypatch.setattr(command_module, 'InvitationRepositoryImpl', lambda s: invitation_repo)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=SimpleNamespace(),
    )

    result = await usecase.delete_invitation(5, 'owner@example.com')

    assert result.message == 'The invitation is well deleted.'
    assert session.deleted_invitation_id == 5
    assert session.updated_league is not None


@pytest.mark.asyncio
async def test_delete_league_invitation_rejects_non_sender_owner(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    invitation_repo = FakeInvitationRepository(session)
    invitation_repo.sender_id = 999

    monkeypatch.setattr(command_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(command_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
    monkeypatch.setattr(command_module, 'InvitationRepositoryImpl', lambda s: invitation_repo)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=SimpleNamespace(),
    )

    with pytest.raises(UserNotOwnerLeaguedError):
        await usecase.delete_invitation(5, 'owner@example.com')


@pytest.mark.asyncio
async def test_delete_league_invitation_rejects_non_pending_invitation(monkeypatch: pytest.MonkeyPatch):
    session = FakeSession()
    invitation_repo = FakeInvitationRepository(session)
    invitation_repo.status = InvitationStatus.accepted

    monkeypatch.setattr(command_module, 'UserRepositoryImpl', FakeUserRepository)
    monkeypatch.setattr(command_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
    monkeypatch.setattr(command_module, 'InvitationRepositoryImpl', lambda s: invitation_repo)

    usecase = LeagueCommandUseCaseImpl(
        league_repository=SimpleNamespace(),
        user_repository=SimpleNamespace(),
        session_factory=lambda: session,
        league_players_repository=SimpleNamespace(),
        invitation_repository=SimpleNamespace(),
        event_bus=SimpleNamespace(),
    )

    with pytest.raises(InvitationDeletionNotAllowedError):
        await usecase.delete_invitation(5, 'owner@example.com')
