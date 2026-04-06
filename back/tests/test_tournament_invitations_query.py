from types import SimpleNamespace

import pytest

from application.tournament.tournament_query_usecase import TournamentQueryUseCaseImpl
from domain.tournament.exception.tournament_exception import TournamentNotOwnerLeaguedError
from domain.user.model.email import Email


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def begin(self):
        return FakeTransaction()


class FakeUserRepository:
    def __init__(self, user_id: int = 42):
        self.user_id = user_id

    async def find_by_email(self, email: str):
        return SimpleNamespace(id=self.user_id, email=Email(email), pseudo='owner')


class FakeTournamentRepository:
    def __init__(self, owner_id: int = 42):
        self.owner_id = owner_id

    async def find_by_id(self, tournament_id: int):
        return SimpleNamespace(id=tournament_id, user=SimpleNamespace(id=self.owner_id))


class FakeInvitationRepository:
    async def find_tournament_invitations_sent_by_owner(self, tournament_id: int, owner_user_id: int):
        return [
            SimpleNamespace(
                id=10,
                status='pending',
                created_at=1710000000000,
                user=SimpleNamespace(id=7, pseudo='emma', email='emma@example.com'),
            ),
        ]


@pytest.mark.asyncio
async def test_get_tournament_invitations_returns_owner_sent_invitations():
    usecase = TournamentQueryUseCaseImpl(
        session_factory=lambda: FakeSession(),
        tournament_repository=FakeTournamentRepository(owner_id=42),
        tournament_stage_repository=None,
        user_repository=FakeUserRepository(user_id=42),
        stage_repository=None,
        tournament_match_repository=None,
        tournament_subscription_repository=None,
        invitation_repository=FakeInvitationRepository(),
    )

    result = await usecase.get_tournament_invitations(12, 'owner@example.com')

    assert result.tournament_id == 12
    assert len(result.invitations) == 1
    assert result.invitations[0].user.pseudo == 'emma'
    assert result.invitations[0].user.email == 'emma@example.com'
    assert result.invitations[0].status == 'pending'


@pytest.mark.asyncio
async def test_get_tournament_invitations_rejects_non_owner():
    usecase = TournamentQueryUseCaseImpl(
        session_factory=lambda: FakeSession(),
        tournament_repository=FakeTournamentRepository(owner_id=999),
        tournament_stage_repository=None,
        user_repository=FakeUserRepository(user_id=42),
        stage_repository=None,
        tournament_match_repository=None,
        tournament_subscription_repository=None,
        invitation_repository=FakeInvitationRepository(),
    )

    with pytest.raises(TournamentNotOwnerLeaguedError):
        await usecase.get_tournament_invitations(12, 'owner@example.com')

