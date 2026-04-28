from types import UnionType
from typing import get_args, get_origin

import pytest
from sqlalchemy.dialects import postgresql

from infrastructure.postgresql.init_models import init_models
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from domain.league.model.league import League


init_models()


class FakeDbObject:
    def __init__(self, value: str):
        self.value = value

    def to_entity(self):
        return self.value


class FakeScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeExecuteResult:
    def __init__(self, *, scalar_rows=None, rows=None):
        self._scalar_rows = scalar_rows or []
        self._rows = rows or []

    def scalars(self):
        return FakeScalarResult(self._scalar_rows)

    def all(self):
        return self._rows


class CapturingAsyncSession:
    def __init__(self, result: FakeExecuteResult):
        self.result = result
        self.statement = None
        self.run_sync_called = False

    async def execute(self, statement):
        self.statement = statement
        return self.result

    async def run_sync(self, fn, objs):
        self.run_sync_called = True
        raise AssertionError("run_sync should not be used for repository list conversions")


def _compile(statement) -> str:
    return " ".join(
        str(
            statement.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        ).split()
    )


def _has_loader_path(statement, expected_fragment: str) -> bool:
    return any(expected_fragment in str(option.path) for option in statement._with_options)


@pytest.mark.asyncio
async def test_find_all_by_user_creator_has_no_join_on_tournament_player_and_preloads_user():
    session = CapturingAsyncSession(
        FakeExecuteResult(scalar_rows=[FakeDbObject("creator-tournament")])
    )
    repository = TournamentRepositoryImpl(session)

    tournaments = await repository.find_all_by_user_creator(user_id=7)

    sql = _compile(session.statement)
    assert "JOIN tournament_player" not in sql
    assert "WHERE tournament.user_id = 7" in sql
    assert _has_loader_path(session.statement, "DBTournament.user")
    assert tournaments == ["creator-tournament"]


@pytest.mark.asyncio
async def test_find_all_by_user_participant_preloads_user_without_run_sync():
    session = CapturingAsyncSession(
        FakeExecuteResult(rows=[(FakeDbObject("participant-tournament"), 1)])
    )
    repository = TournamentRepositoryImpl(session)

    tournaments, total = await repository.find_all_by_user_participant(user_id=42, limit=10, offset=0)

    assert _has_loader_path(session.statement, "DBTournament.user")
    assert session.run_sync_called is False
    assert tournaments == ["participant-tournament"]
    assert total == 1


@pytest.mark.asyncio
async def test_find_available_tournaments_public_preloads_user_without_run_sync():
    session = CapturingAsyncSession(
        FakeExecuteResult(rows=[(FakeDbObject("public-tournament"), 1)])
    )
    repository = TournamentRepositoryImpl(session)

    tournaments, total = await repository.find_available_tournaments_public(user_id=42, limit=10, offset=0)

    assert _has_loader_path(session.statement, "DBTournament.user")
    assert session.run_sync_called is False
    assert tournaments == ["public-tournament"]
    assert total == 1


@pytest.mark.asyncio
async def test_find_finished_tournaments_preloads_user_without_run_sync():
    session = CapturingAsyncSession(
        FakeExecuteResult(rows=[(FakeDbObject("finished-tournament"), 1)])
    )
    repository = TournamentRepositoryImpl(session)

    tournaments, total = await repository.find_finished_tournaments(user_id=42, limit=10, offset=0)

    assert _has_loader_path(session.statement, "DBTournament.user")
    assert session.run_sync_called is False
    assert tournaments == ["finished-tournament"]
    assert total == 1


@pytest.mark.asyncio
async def test_find_created_tournaments_preloads_user_without_run_sync():
    session = CapturingAsyncSession(
        FakeExecuteResult(rows=[(FakeDbObject("created-tournament"), 1)])
    )
    repository = TournamentRepositoryImpl(session)

    tournaments, total = await repository.find_created_tournaments(user_id=42, limit=10, offset=0)

    assert _has_loader_path(session.statement, "DBTournament.user")
    assert session.run_sync_called is False
    assert tournaments == ["created-tournament"]
    assert total == 1


@pytest.mark.asyncio
async def test_find_all_by_ids_preloads_user_without_run_sync_for_leagues():
    session = CapturingAsyncSession(
        FakeExecuteResult(scalar_rows=[FakeDbObject("league-a"), FakeDbObject("league-b")])
    )
    repository = LeagueRepositoryImpl(session)

    leagues = await repository.find_all_by_ids([1, 2])

    assert _has_loader_path(session.statement, "DBLeague.user")
    assert session.run_sync_called is False
    assert leagues == ["league-a", "league-b"]


def test_decrement_players_remaining_if_available_is_typed_optional_league():
    annotation = LeagueRepositoryImpl.decrement_players_remaining_if_available.__annotations__["return"]

    assert get_origin(annotation) in (UnionType, getattr(__import__("typing"), "Union"))
    assert League in get_args(annotation)
    assert type(None) in get_args(annotation)



