from fastapi import FastAPI
from fastapi.testclient import TestClient
from types import SimpleNamespace

import presentation.ticket.ticket_router as ticket_router_module


class FakeTicketUseCase:
    async def create_tournament_ticket(self, *args, **kwargs):
        return {"ticket_id": 99, "message": "ok"}


def _settings(enabled: bool):
    return SimpleNamespace(tournament_subscription_enabled=enabled)


def test_create_tournament_ticket_returns_gone_when_feature_is_disabled():
    app = FastAPI()
    app.include_router(ticket_router_module.router)
    app.dependency_overrides[ticket_router_module.ticket_command_usecase] = lambda: FakeTicketUseCase()
    app.dependency_overrides[ticket_router_module.get_settings] = lambda: _settings(False)
    app.dependency_overrides[ticket_router_module.current_user] = lambda: {
        "email": "player@example.com",
        "id": "user-1",
        "token": "access-token",
    }

    client = TestClient(app)

    response = client.post(
        "/api/tournament/12/match/34/bet",
        json={
            "match_choices": [{"match_id": 34, "match_odd_id": 56}],
            "mise": 10,
            "gain": None,
        },
        headers={"Authorization": "Bearer access-token"},
    )

    assert response.status_code == 410
    assert response.json() == {"detail": "La création de tickets tournoi est désactivée."}


def test_create_tournament_ticket_calls_usecase_when_feature_is_enabled():
    app = FastAPI()
    app.include_router(ticket_router_module.router)
    app.dependency_overrides[ticket_router_module.ticket_command_usecase] = lambda: FakeTicketUseCase()
    app.dependency_overrides[ticket_router_module.get_settings] = lambda: _settings(True)
    app.dependency_overrides[ticket_router_module.current_user] = lambda: {
        "email": "player@example.com",
        "id": "user-1",
        "token": "access-token",
    }

    client = TestClient(app)

    response = client.post(
        "/api/tournament/12/match/34/bet",
        json={
            "match_choices": [{"match_id": 34, "match_odd_id": 56}],
            "mise": 10,
            "gain": None,
        },
        headers={"Authorization": "Bearer access-token"},
    )

    assert response.status_code == 201
    assert response.json() == {"ticket_id": 99, "message": "ok"}



