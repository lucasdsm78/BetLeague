import pytest
from sqlalchemy.dialects import postgresql

from infrastructure.postgresql.init_models import init_models
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl


init_models()


class _ScalarResult:
    def all(self):
        return []


class _ExecuteResult:
    def scalars(self):
        return _ScalarResult()

    def all(self):
        return []


class CapturingAsyncSession:
    def __init__(self):
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return _ExecuteResult()

    async def run_sync(self, fn, objs):
        return []


def _compile(statement) -> str:
    return " ".join(
        str(
            statement.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        ).split()
    )


@pytest.mark.asyncio
async def test_find_leagues_orders_by_created_at_desc_then_id_desc():
    session = CapturingAsyncSession()
    repository = LeagueRepositoryImpl(session)

    await repository.find_leagues(user_id=42, page=1, limit=10)

    sql = _compile(session.statement)
    assert "league.is_private = false" in sql
    assert "league.status = 'OPEN'" in sql
    assert "league.nb_players_remaining > 0" in sql
    assert "ORDER BY league.created_at DESC, league.id DESC" in sql


@pytest.mark.asyncio
async def test_find_available_tournaments_public_orders_by_created_at_desc_then_id_desc():
    session = CapturingAsyncSession()
    repository = TournamentRepositoryImpl(session)

    await repository.find_available_tournaments_public(user_id=42, limit=10, offset=0)

    sql = _compile(session.statement)
    assert "tournament.is_private = false" in sql
    assert "tournament.status = 'pending'" in sql
    assert "tournament.current_players < tournament.max_players" in sql
    assert "ORDER BY tournament.created_at DESC, tournament.id DESC" in sql


@pytest.mark.asyncio
async def test_find_finished_tournaments_orders_by_end_date_desc_then_id_desc():
    session = CapturingAsyncSession()
    repository = TournamentRepositoryImpl(session)

    await repository.find_finished_tournaments(user_id=42, limit=10, offset=0)

    sql = _compile(session.statement)
    assert "tournament.status = 'completed'" in sql
    assert "ORDER BY tournament.end_date DESC, tournament.id DESC" in sql


@pytest.mark.asyncio
async def test_find_created_tournaments_orders_by_end_date_desc_then_id_desc():
    session = CapturingAsyncSession()
    repository = TournamentRepositoryImpl(session)

    await repository.find_created_tournaments(user_id=42, limit=10, offset=0)

    sql = _compile(session.statement)
    assert "tournament.user_id = 42" in sql
    assert "ORDER BY tournament.end_date DESC, tournament.id DESC" in sql



