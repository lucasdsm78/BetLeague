from __future__ import annotations

import asyncio
import time
from types import SimpleNamespace

from fastapi.testclient import TestClient

from infrastructure import readiness as readiness_module
import main


client = TestClient(main.app)


def test_ready_returns_200_when_all_dependencies_are_ready(monkeypatch):
	async def fake_readiness_report(_settings):
		return True, {"status": "ok", "checks": {"database": "ok", "redis": "ok", "nats": "ok"}}

	monkeypatch.setattr(main, "readiness_report", fake_readiness_report)

	response = client.get("/ready", headers={"host": "localhost"})

	assert response.status_code == 200
	assert response.json() == {"status": "ok", "checks": {"database": "ok", "redis": "ok", "nats": "ok"}}


def test_ready_returns_503_when_a_dependency_is_not_ready(monkeypatch):
	async def fake_readiness_report(_settings):
		return False, {
			"status": "degraded",
			"checks": {"database": "ok", "redis": "error", "nats": "ok"},
			"errors": {"redis": "timeout"},
		}

	monkeypatch.setattr(main, "readiness_report", fake_readiness_report)

	response = client.get("/ready", headers={"host": "localhost"})

	assert response.status_code == 503
	assert response.json()["status"] == "degraded"
	assert response.json()["errors"] == {"redis": "timeout"}


def test_readiness_report_runs_dependency_checks_concurrently(monkeypatch):
	async def slow_check_database():
		await asyncio.sleep(0.2)

	async def slow_check_redis(_settings):
		await asyncio.sleep(0.2)

	async def slow_check_nats():
		await asyncio.sleep(0.2)

	monkeypatch.setattr(readiness_module, "check_database", slow_check_database)
	monkeypatch.setattr(readiness_module, "check_redis", slow_check_redis)
	monkeypatch.setattr(readiness_module, "check_nats", slow_check_nats)

	started_at = time.perf_counter()
	ready, payload = asyncio.run(readiness_module.readiness_report(SimpleNamespace()))
	duration = time.perf_counter() - started_at

	assert ready is True
	assert payload == {
		"status": "ok",
		"checks": {"database": "ok", "redis": "ok", "nats": "ok"},
	}
	assert duration < 0.45


