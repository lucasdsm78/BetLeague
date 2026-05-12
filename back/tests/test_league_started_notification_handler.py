from __future__ import annotations

import pytest

from application.notification.handlers.league_started_notification_handler import OnLeagueStartedCreateNotification
from application.notification.notification_command_usecase import NotificationCreateCommand
from domain.league.events.league_started import LeagueStarted
from domain.notification.model.notification import NotificationType


class _AsyncContext:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_league_started_handler_notifies_other_players_only(monkeypatch):
    captured_items: list[NotificationCreateCommand] = []

    class FakeLeagueRepository:
        def __init__(self, session):
            pass

        async def find_by_id(self, league_id: int):
            return type('League', (), {'id': league_id, 'name': 'Ligue Premium'})()

    class FakeLeaguePlayersRepository:
        def __init__(self, session):
            pass

        async def list_user_ids_by_league_id(self, league_id: int):
            assert league_id == 9
            return [4, 7, 12]

    class FakeNotificationUseCase:
        async def create_many(self, *, items):
            captured_items.extend(items)
            return []

    import application.notification.handlers.league_started_notification_handler as handler_module

    monkeypatch.setattr(handler_module, 'LeagueRepositoryImpl', FakeLeagueRepository)
    monkeypatch.setattr(handler_module, 'LeaguePlayersRepositoryImpl', FakeLeaguePlayersRepository)

    handler = OnLeagueStartedCreateNotification(
        notification_uc=FakeNotificationUseCase(),
        session_factory=lambda: _AsyncContext(),
    )

    await handler(
        LeagueStarted(
            league_id=9,
            league_name='Ligue Premium',
            started_by_user_id=7,
        )
    )

    assert [item.user_id for item in captured_items] == [4, 12]
    assert all(item.type == NotificationType.LEAGUE_STARTED for item in captured_items)
    assert all(item.dedupe_key == 'league_started:9' for item in captured_items)

