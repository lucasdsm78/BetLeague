from __future__ import annotations

import pytest

from application.notification.handlers.league_minimum_players_reached_notification_handler import OnLeagueMinimumPlayersReachedCreateNotification
from domain.league.events.league_minimum_players_reached import LeagueMinimumPlayersReached
from domain.notification.model.notification import NotificationType


@pytest.mark.asyncio
async def test_league_minimum_players_reached_handler_creates_owner_notification() -> None:
    captured: dict = {}

    class FakeNotificationUseCase:
        async def create(self, **kwargs):
            captured.update(kwargs)
            return None

    handler = OnLeagueMinimumPlayersReachedCreateNotification(FakeNotificationUseCase())

    await handler(
        LeagueMinimumPlayersReached(
            league_id=9,
            league_name='Ligue Premium',
            owner_user_id=7,
            min_players=4,
            current_players_count=4,
        )
    )

    assert captured['user_id'] == 7
    assert captured['type'] == NotificationType.LEAGUE_MINIMUM_PLAYERS_REACHED
    assert captured['dedupe_key'] == 'league_minimum_players_reached:9:4'
    assert captured['data']['current_players_count'] == 4

