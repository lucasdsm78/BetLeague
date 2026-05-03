from __future__ import annotations

from datetime import UTC, datetime

import pytest

from infrastructure.services.api_sports.score_service import ApiSportsScoreService


def _utc_today_isoformat() -> str:
    return datetime.now(UTC).date().isoformat()


@pytest.mark.asyncio
async def test_get_live_scores_prefers_single_batch_request_when_batch_contains_all_requested_ids():
    calls: list[tuple[str, dict | None]] = []

    class FakeClient:
        async def get(self, endpoint: str, params=None):
            calls.append((endpoint, params))
            if endpoint == "/fixtures" and params and params.get("status"):
                return {
                    "response": [
                        {
                            "fixture": {"id": 101, "status": {"short": "NS"}},
                            "goals": {"home": None, "away": None},
                        },
                        {
                            "fixture": {"id": 202, "status": {"short": "FT"}},
                            "goals": {"home": 2, "away": 1},
                        },
                        {
                            "fixture": {"id": 999, "status": {"short": "FT"}},
                            "goals": {"home": 9, "away": 9},
                        },
                    ]
                }
            raise AssertionError(f"Unexpected call: {endpoint} {params}")

    service = ApiSportsScoreService(client=FakeClient())

    results = await service.get_live_scores([101, 202])

    assert sorted(item["api_fixture_id"] for item in results) == [101, 202]
    assert calls == [("/fixtures", {"date": _utc_today_isoformat(), "status": "1H-HT-2H-ET-BT-P-SUSP-INT-FT-AET-PEN-AWD-WO"})]


@pytest.mark.asyncio
async def test_get_live_scores_skips_missing_fixture_ids_by_default():
    calls: list[tuple[str, dict | None]] = []

    class FakeClient:
        async def get(self, endpoint: str, params=None):
            calls.append((endpoint, params))
            if endpoint == "/fixtures" and params and params.get("status"):
                return {
                    "response": [
                        {
                            "fixture": {"id": 101, "status": {"short": "NS"}},
                            "goals": {"home": None, "away": None},
                        },
                    ]
                }
            raise AssertionError(f"Unexpected call: {endpoint} {params}")

    service = ApiSportsScoreService(client=FakeClient())

    results = await service.get_live_scores([101, 202])

    assert sorted(item["api_fixture_id"] for item in results) == [101]
    assert calls == [
        (
            "/fixtures",
            {"date": _utc_today_isoformat(), "status": "1H-HT-2H-ET-BT-P-SUSP-INT-FT-AET-PEN-AWD-WO"},
        )
    ]


@pytest.mark.asyncio
async def test_get_live_scores_fetches_only_missing_fixture_ids_when_fallback_enabled():
    calls: list[tuple[str, dict | None]] = []

    class FakeClient:
        async def get(self, endpoint: str, params=None):
            calls.append((endpoint, params))
            if endpoint == "/fixtures" and params and params.get("status"):
                return {
                    "response": [
                        {
                            "fixture": {"id": 101, "status": {"short": "NS"}},
                            "goals": {"home": None, "away": None},
                        },
                    ]
                }
            if endpoint == "/fixtures" and params and params.get("id") == "202":
                return {
                    "response": [
                        {
                            "fixture": {"id": 202, "status": {"short": "FT"}},
                            "goals": {"home": 1, "away": 1},
                        },
                    ]
                }
            raise AssertionError(f"Unexpected call: {endpoint} {params}")

    service = ApiSportsScoreService(client=FakeClient(), fallback_enabled=True, fallback_max_fixtures=1)

    results = await service.get_live_scores([101, 202])

    assert sorted(item["api_fixture_id"] for item in results) == [101, 202]
    assert calls[0] == (
        "/fixtures",
        {"date": _utc_today_isoformat(), "status": "1H-HT-2H-ET-BT-P-SUSP-INT-FT-AET-PEN-AWD-WO"},
    )
    assert calls[1:] == [("/fixtures", {"id": "202"})]




