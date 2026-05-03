from datetime import date, datetime, timedelta

import pytest

from application.match.match_fetch_usecase import MatchFetchUseCaseImpl
from domain.match.model.match import Match
from domain.match.model.sport import Sport
from infrastructure.celery import celery_app as celery_app_module
from infrastructure.config import Settings


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


class FakeMatchFetchApi:
    def __init__(self, pairs):
        self._pairs = pairs

    async def get_upcoming_matches(self, sport: Sport, date_from: date, date_to: date):
        return self._pairs


@pytest.mark.asyncio
async def test_fetch_usecase_persists_matches_even_without_odds(monkeypatch: pytest.MonkeyPatch):
    stored_matches: list[Match] = []
    stored_odds_calls: list[tuple[int, list]] = []

    class FakeMatchRepository:
        def __init__(self, session):
            self.session = session

        async def upsert_by_api_fixture_id(self, match: Match) -> Match:
            stored_matches.append(match)
            match.id = len(stored_matches)
            return match

    class FakeMatchOddRepository:
        def __init__(self, session):
            self.session = session

        async def upsert_many_for_match(self, match_id: int, odds: list):
            stored_odds_calls.append((match_id, list(odds)))

    monkeypatch.setattr("application.match.match_fetch_usecase.MatchRepositoryImpl", FakeMatchRepository)
    monkeypatch.setattr("application.match.match_fetch_usecase.MatchOddRepositoryImpl", FakeMatchOddRepository)

    match_without_odds = Match(
        uuid="match-without-odds",
        home_team="PSG",
        away_team="OM",
        time=datetime.utcnow() + timedelta(days=1),
        api_fixture_id=12345,
    )

    usecase = MatchFetchUseCaseImpl(
        match_fetch_api=FakeMatchFetchApi([(match_without_odds, [])]),
        session_factory=lambda: FakeSession(),
    )

    count = await usecase.fetch_and_store_matches(
        sport=Sport.FOOTBALL,
        date_from=date.today(),
        date_to=date.today() + timedelta(days=7),
    )

    assert count == 1
    assert [m.api_fixture_id for m in stored_matches] == [12345]
    assert stored_odds_calls == []


def test_celery_beat_fetch_matches_catchup_dispatches_when_first_run(monkeypatch: pytest.MonkeyPatch):
    sent_tasks: list[str] = []

    monkeypatch.setattr(celery_app_module, "_ENABLE_CATCHUP", False)
    monkeypatch.setattr(celery_app_module, "_ENABLE_FETCH_MATCHES_CATCHUP", True)
    monkeypatch.setattr(celery_app_module, "_acquire_fetch_matches_catchup_lock", lambda: True)
    monkeypatch.setattr(celery_app_module, "_read_fetch_matches_last_finished_epoch", lambda: None)
    monkeypatch.setattr(celery_app_module.celery_app, "send_task", lambda name: sent_tasks.append(name))

    celery_app_module._beat_catchup_on_start()

    assert sent_tasks == ["infrastructure.celery.tasks.fetch_daily_matches"]


def test_settings_api_sports_league_ids_empty_string_falls_back_to_default():
    settings = Settings(
        sqlalchemy_database_url="postgresql+asyncpg://user:pass@example.test/db",
        access_token_expire_minutes=15,
        refresh_token_expire_minutes=60,
        secret_key_token="secret",
        secret_key_token_refresh="refresh",
        encryption_key="enc",
        api_football_data_token="token",
        url_api_football_data="https://example.test/api",
        private_key="PRIVATE",
        public_key="PUBLIC",
        stripe_api_key="stripe",
        stripe_webhook_secret="whsec",
        the_odds_api_api_key="odds",
        API_SPORTS_LEAGUE_IDS="",
    )

    assert settings.api_sports_league_ids_set == frozenset({39, 61, 78, 135, 140})


def test_settings_api_sports_league_ids_trims_spaces():
    settings = Settings(
        sqlalchemy_database_url="postgresql+asyncpg://user:pass@example.test/db",
        access_token_expire_minutes=15,
        refresh_token_expire_minutes=60,
        secret_key_token="secret",
        secret_key_token_refresh="refresh",
        encryption_key="enc",
        api_football_data_token="token",
        url_api_football_data="https://example.test/api",
        private_key="PRIVATE",
        public_key="PUBLIC",
        stripe_api_key="stripe",
        stripe_webhook_secret="whsec",
        the_odds_api_api_key="odds",
        API_SPORTS_LEAGUE_IDS="39, 61,78 ",
    )

    assert settings.api_sports_league_ids_set == frozenset({39, 61, 78})


