from types import SimpleNamespace

import pytest

from application.league.league_query_usecase import LeagueQueryUseCaseImpl
from domain.league.model.league import League, LeagueStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


class FakeUserRepository:
    async def find_by_email(self, email: str):
        return SimpleNamespace(id=42, email=Email(email), pseudo='owner')


class FakeLeagueRepository:
    async def count_created_leagues(self, user_id: int) -> int:
        return 2

    async def find_created_leagues(self, user_id: int, page: int, limit: int):
        return [
            make_league(12, 'Ligue A'),
            make_league(13, 'Ligue B'),
        ]


class FakeInvitationRepository:
    pass


class FakeLeaguePlayersRepository:
    def __init__(self):
        self.bulk_calls: list[list[int]] = []

    async def count_players_by_league_ids(self, league_ids: list[int]):
        self.bulk_calls.append(list(league_ids))
        return {12: 3, 13: 5}

    async def count_players(self, league_id: int):
        raise AssertionError('Le fallback count_players() ne doit pas être utilisé quand le bulk count est disponible.')


def make_league(league_id: int, name: str) -> League:
    return League(
        id=league_id,
        uuid=f'league-{league_id}',
        name=name,
        is_free=True,
        is_started=False,
        max_players=8,
        min_players=3,
        is_private=False,
        start_date=1_710_000_000_000,
        end_date=1_710_604_800_000,
        nb_players_remaining=7,
        status=LeagueStatus.OPEN,
        user=UserSummary(id=42, email=Email('owner@example.com'), pseudo='owner'),
    )


@pytest.mark.asyncio
async def test_get_created_leagues_uses_bulk_player_count_query():
    league_players_repository = FakeLeaguePlayersRepository()
    usecase = LeagueQueryUseCaseImpl.model_construct(
        league_players_repository=league_players_repository,
        user_repository=FakeUserRepository(),
        league_repository=FakeLeagueRepository(),
        invitation_repository=FakeInvitationRepository(),
    )

    result = await usecase.get_created_leagues('owner@example.com', page=1, page_size=10)

    assert league_players_repository.bulk_calls == [[12, 13]]
    assert [league.current_players_count for league in result.leagues] == [3, 5]

