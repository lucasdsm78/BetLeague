from types import SimpleNamespace

import pytest

from application.league.league_query_usecase import LeagueQueryUseCaseImpl
from domain.invitation.model.invitation_status import InvitationStatus
from domain.user.model.email import Email


class FakeUserRepository:
    async def find_by_email(self, email: str):
        return SimpleNamespace(id=42, email=Email(email), pseudo='player')


class FakeInvitationRepository:
    async def count_received_invitations(self, user_id: int, status=None):
        return 2

    async def find_received_invitations(self, user_id: int, status=None, page: int = 1, page_size: int = 20):
        return [
            SimpleNamespace(
                id=1,
                league_id=10,
                league=SimpleNamespace(
                    id=10,
                    name='Ligue VIP',
                    max_players=20,
                    start_date=1710000000000,
                    nb_players_remaining=8,
                    is_started=False,
                    user=SimpleNamespace(id=9, pseudo='captain'),
                ),
                tournament_id=None,
                tournament=None,
                status=InvitationStatus.pending.value,
            ),
            SimpleNamespace(
                id=2,
                league_id=None,
                league=None,
                tournament_id=77,
                tournament=SimpleNamespace(
                    id=77,
                    name='Tournoi Knockout',
                    max_players=16,
                    current_players=9,
                    start_date=1710100000000,
                    end_date=1710700000000,
                    is_private=True,
                    status='PENDING',
                    user=SimpleNamespace(id=3, pseudo='organizer'),
                ),
                status=InvitationStatus.pending.value,
            ),
        ]

    async def count_by_status(self, user_id: int, is_received: bool):
        return {'pending': 2, 'accepted': 0, 'refused': 0}

    async def count_sent_invitations(self, user_id: int, status=None):
        return 2

    async def find_sent_invitations(self, user_id: int, status=None, page: int = 1, page_size: int = 20):
        return [
            SimpleNamespace(
                id=11,
                league_id=10,
                league=SimpleNamespace(
                    id=10,
                    name='Ligue VIP',
                    max_players=20,
                    start_date=1710000000000,
                    nb_players_remaining=8,
                    is_started=False,
                ),
                tournament_id=None,
                tournament=None,
                user=SimpleNamespace(id=9, pseudo='captain', email='captain@example.com'),
                status=InvitationStatus.pending.value,
                created_at=1710000000000,
            ),
            SimpleNamespace(
                id=12,
                league_id=None,
                league=None,
                tournament_id=77,
                tournament=SimpleNamespace(
                    id=77,
                    name='Tournoi Knockout',
                    max_players=16,
                    current_players=9,
                    start_date=1710100000000,
                    end_date=1710700000000,
                    is_private=True,
                    status='PENDING',
                ),
                user=SimpleNamespace(id=3, pseudo='organizer', email='organizer@example.com'),
                status=InvitationStatus.accepted.value,
                created_at=1710100000000,
            ),
        ]


@pytest.mark.asyncio
async def test_get_invitations_returns_league_and_tournament_received_items():
    usecase = LeagueQueryUseCaseImpl.model_construct(
        league_players_repository=SimpleNamespace(),
        user_repository=FakeUserRepository(),
        league_repository=SimpleNamespace(),
        invitation_repository=FakeInvitationRepository(),
    )

    result = await usecase.get_invitations('player@example.com', is_received=True)

    assert result.total == 2
    assert len(result.invitations) == 2
    assert result.invitations[0].type == 'league'
    assert result.invitations[0].league.name == 'Ligue VIP'
    assert result.invitations[1].type == 'tournament'
    assert result.invitations[1].tournament.name == 'Tournoi Knockout'
    assert result.invitations[1].tournament.user_creator.pseudo == 'organizer'


@pytest.mark.asyncio
async def test_get_sent_invitations_returns_league_and_tournament_items():
    usecase = LeagueQueryUseCaseImpl.model_construct(
        league_players_repository=SimpleNamespace(),
        user_repository=FakeUserRepository(),
        league_repository=SimpleNamespace(),
        invitation_repository=FakeInvitationRepository(),
    )

    result = await usecase.get_sent_invitations('player@example.com')

    assert result.total == 2
    assert len(result.invitations) == 2
    assert result.invitations[0].type == 'league'
    assert result.invitations[0].user.email == 'captain@example.com'
    assert result.invitations[1].type == 'tournament'
    assert result.invitations[1].tournament.name == 'Tournoi Knockout'
    assert result.invitations[1].user.pseudo == 'organizer'

