from datetime import UTC, datetime

import pytest
from sqlalchemy.dialects import postgresql

from infrastructure.postgresql.init_models import init_models
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl


init_models()


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class CapturingAsyncSession:
    def __init__(self, rows):
        self.rows = rows
        self.statement = None

    async def execute(self, statement):
        self.statement = statement
        return FakeResult(self.rows)


@pytest.mark.asyncio
async def test_find_due_tournament_ids_uses_group_by_query_compatible_with_postgresql():
    session = CapturingAsyncSession(rows=[(42, 1_775_390_405_250), (84, 1_775_390_505_250)])
    repository = TournamentRepositoryImpl(session)

    due_ids = await repository.find_due_tournament_ids(datetime(2026, 4, 5, 12, 0, tzinfo=UTC))

    assert due_ids == [42, 84]
    assert session.statement is not None

    compiled_sql = str(
        session.statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    normalized_sql = " ".join(compiled_sql.split())

    assert "SELECT DISTINCT" not in normalized_sql
    assert "GROUP BY tournament.id" in normalized_sql
    assert "min(tournament_stage.end_date) AS due_end_date" in normalized_sql
    assert "ORDER BY due_end_date ASC, tournament.id ASC" in normalized_sql


