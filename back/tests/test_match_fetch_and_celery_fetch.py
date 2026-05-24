from datetime import UTC, date, datetime, timedelta
import logging
import sys
import types

import httpx
import pytest

from application.match.match_fetch_usecase import MatchFetchUseCaseImpl
from domain.match.model.match import Match
from domain.match.model.sport import Sport
from infrastructure.celery import celery_app as celery_app_module
from infrastructure.celery import tasks as celery_tasks_module
from infrastructure.config import Settings
from infrastructure.services.api_sports.base_client import ApiSportsBaseClient
from infrastructure.services.api_sports import football_fetch_service as football_fetch_service_module
from infrastructure.services.api_sports.football_fetch_service import ApiSportsFootballFetchService


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
        time=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1),
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


def test_settings_api_sports_odds_fetch_defaults_cover_full_daily_batch():
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
    )

    assert settings.api_sports_fetch_odds_days_ahead == 0
    assert settings.api_sports_fetch_odds_max_fixtures_per_run == 30


@pytest.mark.asyncio
async def test_api_sports_base_client_request_error_logs_network_context(caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch):
    client = ApiSportsBaseClient(
        base_url="https://v3.football.api-sports.io",
        api_key="test-key",
        timeout=12.0,
    )

    request = httpx.Request("GET", "https://v3.football.api-sports.io/fixtures?date=2026-05-03")

    async def fake_get(*args, **kwargs):
        raise httpx.ConnectError("dns failed", request=request)

    monkeypatch.setattr(client._client, "get", fake_get)

    try:
        with caplog.at_level(logging.ERROR, logger="infrastructure.services.api_sports.base_client"):
            data = await client.get("/fixtures", params={"date": "2026-05-03"})
    finally:
        await client.close()

    assert data == {"response": [], "errors": ["request_error"]}
    record = next(record for record in caplog.records if record.getMessage() == "api_sports.client.request_error")
    assert record.api_host == "v3.football.api-sports.io"
    assert record.path == "/fixtures"
    assert record.error_type == "ConnectError"
    assert record.timeout_s == 12.0


@pytest.mark.asyncio
async def test_football_fetch_service_raises_when_primary_fixtures_fetch_fails():
    class FakeClient:
        async def get(self, endpoint: str, params=None):
            assert endpoint == "/fixtures"
            return {"response": [], "errors": ["request_error"]}

    service = ApiSportsFootballFetchService(client=FakeClient(), league_ids=frozenset({39}))

    with pytest.raises(RuntimeError, match="fixtures fetch failed"):
        await service.get_upcoming_matches(
            sport=Sport.FOOTBALL,
            date_from=date(2026, 5, 3),
            date_to=date(2026, 5, 3),
        )


@pytest.mark.asyncio
async def test_football_fetch_service_keeps_match_when_odds_fetch_fails():
    fixture_payload = {
        "fixture": {"id": 98765, "date": "2026-05-03T20:00:00Z", "status": {"short": "NS"}},
        "league": {"id": 39, "name": "Premier League", "season": 2026},
        "teams": {
            "home": {"name": "Arsenal", "logo": "home.png"},
            "away": {"name": "Chelsea", "logo": "away.png"},
        },
        "goals": {"home": None, "away": None},
    }

    class FakeClient:
        async def get(self, endpoint: str, params=None):
            if endpoint == "/fixtures":
                return {"response": [fixture_payload], "errors": []}
            if endpoint == "/odds":
                return {"response": [], "errors": ["request_error"]}
            raise AssertionError(f"Unexpected endpoint: {endpoint}")

    service = ApiSportsFootballFetchService(
        client=FakeClient(),
        league_ids=frozenset({39}),
        fetch_odds_until=date(2026, 5, 3),
        max_odds_fixtures=1,
    )
    pairs = await service.get_upcoming_matches(
        sport=Sport.FOOTBALL,
        date_from=date(2026, 5, 3),
        date_to=date(2026, 5, 3),
    )

    assert len(pairs) == 1
    match, odds = pairs[0]
    assert match.api_fixture_id == 98765
    assert odds == []


@pytest.mark.asyncio
async def test_football_fetch_service_caps_odds_requests_per_run(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(football_fetch_service_module, "_REQUEST_DELAY", 0)

    fixture_payloads = [
        {
            "fixture": {"id": fixture_id, "date": f"2026-05-03T{hour:02d}:00:00Z", "status": {"short": "NS"}},
            "league": {"id": 39, "name": "Premier League", "season": 2026},
            "teams": {
                "home": {"name": f"Home {fixture_id}", "logo": "home.png"},
                "away": {"name": f"Away {fixture_id}", "logo": "away.png"},
            },
            "goals": {"home": None, "away": None},
        }
        for hour, fixture_id in enumerate([1001, 1002, 1003], start=12)
    ]
    calls: list[tuple[str, dict | None]] = []

    class FakeClient:
        async def get(self, endpoint: str, params=None):
            calls.append((endpoint, params))
            if endpoint == "/fixtures":
                return {"response": fixture_payloads, "errors": []}
            if endpoint == "/odds":
                return {"response": [], "errors": []}
            raise AssertionError(f"Unexpected endpoint: {endpoint}")

    service = ApiSportsFootballFetchService(
        client=FakeClient(),
        league_ids=frozenset({39}),
        fetch_odds_until=date(2026, 5, 3),
        max_odds_fixtures=2,
    )

    pairs = await service.get_upcoming_matches(
        sport=Sport.FOOTBALL,
        date_from=date(2026, 5, 3),
        date_to=date(2026, 5, 3),
    )

    assert len(pairs) == 3
    assert [call for call in calls if call[0] == "/odds"] == [
        ("/odds", {"fixture": "1001"}),
        ("/odds", {"fixture": "1002"}),
    ]


@pytest.mark.asyncio
async def test_fetch_daily_matches_async_chains_root_cause(monkeypatch: pytest.MonkeyPatch):
    class FakeEngine:
        async def dispose(self):
            return None

    class FakeSettings:
        api_sports_football_url = "https://v3.football.api-sports.io"
        api_sports_key = "test-key"
        api_sports_league_ids_set = frozenset({39})
        api_sports_fetch_odds_days_ahead = 1
        api_sports_fetch_odds_max_fixtures_per_run = 2

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def close(self):
            return None

    class FakeFetchService:
        def __init__(self, *args, **kwargs):
            pass

    class FakeUseCase:
        def __init__(self, *args, **kwargs):
            pass

        async def fetch_and_store_matches(self, *args, **kwargs):
            raise ValueError("db boom")

    fake_sport = types.SimpleNamespace(value="football")
    fake_sport_module = types.ModuleType("domain.match.model.sport")
    fake_sport_module.Sport = types.SimpleNamespace(FOOTBALL=fake_sport)

    fake_models_module = types.ModuleType("infrastructure.postgresql.models")

    fake_config_module = types.ModuleType("infrastructure.config")
    fake_config_module.Settings = FakeSettings

    fake_client_module = types.ModuleType("infrastructure.services.api_sports.base_client")
    fake_client_module.ApiSportsBaseClient = FakeClient

    fake_fetch_module = types.ModuleType("infrastructure.services.api_sports.football_fetch_service")
    fake_fetch_module.ApiSportsFootballFetchService = FakeFetchService

    fake_usecase_module = types.ModuleType("application.match.match_fetch_usecase")
    fake_usecase_module.MatchFetchUseCaseImpl = FakeUseCase

    monkeypatch.setattr(celery_tasks_module, "_make_session_factory", lambda: (FakeEngine(), lambda: None))
    monkeypatch.setitem(sys.modules, "infrastructure.postgresql.models", fake_models_module)
    monkeypatch.setitem(sys.modules, "infrastructure.config", fake_config_module)
    monkeypatch.setitem(sys.modules, "domain.match.model.sport", fake_sport_module)
    monkeypatch.setitem(sys.modules, "infrastructure.services.api_sports.base_client", fake_client_module)
    monkeypatch.setitem(sys.modules, "infrastructure.services.api_sports.football_fetch_service", fake_fetch_module)
    monkeypatch.setitem(sys.modules, "application.match.match_fetch_usecase", fake_usecase_module)

    with pytest.raises(RuntimeError, match="fetch_daily_matches failed for sports: football") as exc_info:
        await celery_tasks_module._fetch_daily_matches_async()

    assert isinstance(exc_info.value.__cause__, ValueError)
    assert str(exc_info.value.__cause__) == "db boom"


@pytest.mark.asyncio
async def test_fetch_daily_matches_async_clamps_aggressive_odds_configuration(monkeypatch: pytest.MonkeyPatch):
    captured_kwargs: dict[str, object] = {}

    class FakeEngine:
        async def dispose(self):
            return None

    class FakeSettings:
        api_sports_football_url = "https://v3.football.api-sports.io"
        api_sports_key = "test-key"
        api_sports_league_ids_set = frozenset({39})
        api_sports_fetch_odds_days_ahead = 999
        api_sports_fetch_odds_max_fixtures_per_run = 999

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def close(self):
            return None

    class FakeFetchService:
        def __init__(self, *args, **kwargs):
            captured_kwargs.update(kwargs)

    class FakeUseCase:
        def __init__(self, *args, **kwargs):
            pass

        async def fetch_and_store_matches(self, *args, **kwargs):
            return 0

    fake_sport = types.SimpleNamespace(value="football")
    fake_sport_module = types.ModuleType("domain.match.model.sport")
    fake_sport_module.Sport = types.SimpleNamespace(FOOTBALL=fake_sport)

    fake_models_module = types.ModuleType("infrastructure.postgresql.models")

    fake_config_module = types.ModuleType("infrastructure.config")
    fake_config_module.Settings = FakeSettings

    fake_client_module = types.ModuleType("infrastructure.services.api_sports.base_client")
    fake_client_module.ApiSportsBaseClient = FakeClient

    fake_fetch_module = types.ModuleType("infrastructure.services.api_sports.football_fetch_service")
    fake_fetch_module.ApiSportsFootballFetchService = FakeFetchService

    fake_usecase_module = types.ModuleType("application.match.match_fetch_usecase")
    fake_usecase_module.MatchFetchUseCaseImpl = FakeUseCase

    monkeypatch.setattr(celery_tasks_module, "_make_session_factory", lambda: (FakeEngine(), lambda: None))
    monkeypatch.setitem(sys.modules, "infrastructure.postgresql.models", fake_models_module)
    monkeypatch.setitem(sys.modules, "infrastructure.config", fake_config_module)
    monkeypatch.setitem(sys.modules, "domain.match.model.sport", fake_sport_module)
    monkeypatch.setitem(sys.modules, "infrastructure.services.api_sports.base_client", fake_client_module)
    monkeypatch.setitem(sys.modules, "infrastructure.services.api_sports.football_fetch_service", fake_fetch_module)
    monkeypatch.setitem(sys.modules, "application.match.match_fetch_usecase", fake_usecase_module)

    await celery_tasks_module._fetch_daily_matches_async()

    assert captured_kwargs["max_odds_fixtures"] == celery_tasks_module._MAX_FETCH_ODDS_FIXTURES_PER_RUN
    assert captured_kwargs["fetch_odds_until"] == datetime.now(UTC).date() + timedelta(days=celery_tasks_module._MAX_FETCH_ODDS_DAYS_AHEAD)

