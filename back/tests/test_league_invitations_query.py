from types import SimpleNamespace

import pytest

from application.league.league_query_usecase import LeagueQueryUseCaseImpl
from domain.league.exception.league_exception import UserNotOwnerLeaguedError
from domain.user.model.email import Email


class FakeUserRepository:
    async def find_by_email(self, email: str):
        return SimpleNamespace(id=42, email=Email(email), pseudo='owner')


class FakeLeagueRepository:
    def __init__(self, owner_id: int = 42):
        self.owner_id = owner_id

    async def find_by_id(self, league_id: int):
        return SimpleNamespace(id=league_id, user=SimpleNamespace(id=self.owner_id))


class FakeInvitationRepository:
    async def find_league_invitations_sent_by_owner(self, league_id: int, owner_user_id: int):
        return [
            SimpleNamespace(
                id=5,
                status='PENDING',
                created_at=1710000000000,
                user=SimpleNamespace(id=7, pseudo='emma', email='emma@example.com'),
            )
        ]


@pytest.mark.asyncio
async def test_get_league_invitations_returns_owner_sent_invitations():
    usecase = LeagueQueryUseCaseImpl.model_construct(
        league_players_repository=SimpleNamespace(),
        user_repository=FakeUserRepository(),
        league_repository=FakeLeagueRepository(owner_id=42),
        invitation_repository=FakeInvitationRepository(),
    )

    result = await usecase.get_league_invitations(12, 'owner@example.com')

    assert result.league_id == 12
    assert len(result.invitations) == 1
    assert result.invitations[0].user.pseudo == 'emma'
    assert result.invitations[0].user.email == 'emma@example.com'
    assert result.invitations[0].status == 'PENDING'


@pytest.mark.asyncio
async def test_get_league_invitations_rejects_non_owner():
    usecase = LeagueQueryUseCaseImpl.model_construct(
        league_players_repository=SimpleNamespace(),
        user_repository=FakeUserRepository(),
        league_repository=FakeLeagueRepository(owner_id=999),
        invitation_repository=FakeInvitationRepository(),
    )

    with pytest.raises(UserNotOwnerLeaguedError):
        await usecase.get_league_invitations(12, 'owner@example.com')

