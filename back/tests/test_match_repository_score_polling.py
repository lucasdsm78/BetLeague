import pytest
from sqlalchemy.dialects import postgresql

from infrastructure.postgresql.init_models import init_models
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl


init_models()


class _ExecuteResult:
    def all(self):
        return []


class CapturingAsyncSession:
    def __init__(self):
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return _ExecuteResult()


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
async def test_find_active_fixture_ids_keeps_finished_matches_in_polling_without_winner_filter():
    session = CapturingAsyncSession()
    repository = MatchRepositoryImpl(session)

    await repository.find_active_fixture_ids()

    sql = _compile(session.statement)
    assert "status IN ('FT', 'AET', 'AP', 'PEN', 'AWD', 'WO')" in sql
    assert "winner IS NULL" not in sql

