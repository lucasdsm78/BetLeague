from __future__ import annotations

from fastapi.testclient import TestClient

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


