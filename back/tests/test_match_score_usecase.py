from datetime import UTC, datetime

import pytest

from application.match.match_command_model import MatchScoreUpdatedResponse
from application.match.match_command_usecase import MatchCommandUseCaseImpl
from domain.match.event.match_result_resolved_event import MatchResultResolvedEvent
from domain.match.model.bet_type import BetType
from domain.match.model.match import Match
from domain.match.model.match_odd import MatchOdd
from domain.match.model.match_status import MatchStatus


class FakeMatchRepository:
    def __init__(self, match: Match, fixture_id: int):
        self._match = match
        self._fixture_id = fixture_id
        self.bulk_update_scores_calls: list[list[dict]] = []

    async def find_finished_without_winner(self):
        return []

    async def find_active_fixture_ids(self):
        return [self._fixture_id]

    async def find_all_by_api_fixture_ids(self, api_fixture_ids):
        assert api_fixture_ids == [self._fixture_id]
        return [self._match]

    async def bulk_update_scores(self, updates):
        self.bulk_update_scores_calls.append(list(updates))


class FakeMatchOddRepository:
    def __init__(self, odds: list[MatchOdd]):
        self._odds = odds
        self.bulk_update_results_calls: list[list[dict]] = []

    async def find_by_match_ids(self, match_ids):
        assert match_ids == [2]
        return list(self._odds)

    async def bulk_update_results(self, updates):
        self.bulk_update_results_calls.append(list(updates))


class FakeOutboxBus:
    def __init__(self):
        self.events: list[MatchResultResolvedEvent] = []

    async def publish(self, event):
        self.events.append(event)


class FakeUnitOfWork:
    def __init__(self, match_repo: FakeMatchRepository, odd_repo: FakeMatchOddRepository, outbox_bus: FakeOutboxBus):
        self.match_repo = match_repo
        self.match_odd_repo = odd_repo
        self.outbox_bus = outbox_bus
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def commit(self):
        self.committed = True


class FakeMatchScoreApi:
    def __init__(self, api_results: list[dict]):
        self._api_results = api_results

    async def get_live_scores(self, fixture_ids):
        assert fixture_ids == [2002]
        return list(self._api_results)


def _build_match(*, winner: str | None, score_home: int, score_away: int) -> Match:
    return Match(
        id=2,
        uuid="match-2",
        home_team="PSG",
        away_team="OM",
        time=datetime.now(UTC).replace(tzinfo=None),
        winner=winner,
        status=MatchStatus.FINISHED,
        api_fixture_id=2002,
        score_home=score_home,
        score_away=score_away,
    )


@pytest.mark.asyncio
async def test_check_scores_v2_recalculates_existing_finished_odd_and_publishes_event():
    match = _build_match(winner="1", score_home=2, score_away=1)
    odd = MatchOdd(
        id=47,
        match_id=2,
        bet_type=BetType.MATCH_WINNER,
        bet_name="Match Winner",
        value="Home",
        odd=1.73,
        result="LOSE",
    )
    match_repo = FakeMatchRepository(match=match, fixture_id=2002)
    odd_repo = FakeMatchOddRepository(odds=[odd])
    outbox_bus = FakeOutboxBus()
    uow = FakeUnitOfWork(match_repo=match_repo, odd_repo=odd_repo, outbox_bus=outbox_bus)
    usecase = MatchCommandUseCaseImpl(
        match_score_api=FakeMatchScoreApi([
            {
                "api_fixture_id": 2002,
                "score_home": 3,
                "score_away": 1,
                "status": "FT",
                "winner": "HOME_TEAM",
            }
        ]),
        uow_factory=lambda: uow,
    )

    result = await usecase.check_scores_v2()

    assert isinstance(result, MatchScoreUpdatedResponse)
    assert match_repo.bulk_update_scores_calls == [[{
        "id": 2,
        "score_home": 3,
        "score_away": 1,
        "status": "FT",
        "winner": "1",
    }]]
    assert odd_repo.bulk_update_results_calls == [[{"id": 47, "result": "WIN"}]]
    assert [event.match_id for event in outbox_bus.events] == [2]
    assert uow.committed is True


@pytest.mark.asyncio
async def test_check_scores_v2_skips_event_when_finished_odds_and_winner_are_already_consistent():
    match = _build_match(winner="1", score_home=3, score_away=1)
    odd = MatchOdd(
        id=47,
        match_id=2,
        bet_type=BetType.MATCH_WINNER,
        bet_name="Match Winner",
        value="Home",
        odd=1.73,
        result="WIN",
    )
    match_repo = FakeMatchRepository(match=match, fixture_id=2002)
    odd_repo = FakeMatchOddRepository(odds=[odd])
    outbox_bus = FakeOutboxBus()
    uow = FakeUnitOfWork(match_repo=match_repo, odd_repo=odd_repo, outbox_bus=outbox_bus)
    usecase = MatchCommandUseCaseImpl(
        match_score_api=FakeMatchScoreApi([
            {
                "api_fixture_id": 2002,
                "score_home": 3,
                "score_away": 1,
                "status": "FT",
                "winner": "HOME_TEAM",
            }
        ]),
        uow_factory=lambda: uow,
    )

    result = await usecase.check_scores_v2()

    assert isinstance(result, MatchScoreUpdatedResponse)
    assert match_repo.bulk_update_scores_calls == [[{
        "id": 2,
        "score_home": 3,
        "score_away": 1,
        "status": "FT",
        "winner": "1",
    }]]
    assert odd_repo.bulk_update_results_calls == []
    assert outbox_bus.events == []
    assert uow.committed is True

