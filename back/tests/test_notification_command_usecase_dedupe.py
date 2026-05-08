from __future__ import annotations

import pytest

from application.notification.notification_command_usecase import NotificationCreateCommand
from application.notification.notification_command_usecase_impl import NotificationCommandUseCaseImpl
from domain.notification.model.notification import Notification, NotificationType


class FakeNotificationRepository:
    def __init__(self, existing: Notification | None = None):
        self.existing = existing
        self.create_calls: list[Notification] = []
        self._by_key: dict[tuple[int, NotificationType, str], Notification] = {}
        if existing is not None:
            dedupe_key = str(existing.data.get("dedupe_key") or "").strip()
            if dedupe_key:
                self._by_key[(existing.user_id, existing.type, dedupe_key)] = existing

    async def create(self, notification: Notification) -> Notification:
        created, _ = await self.create_or_get(notification)
        return created

    async def create_or_get(self, notification: Notification) -> tuple[Notification, bool]:
        self.create_calls.append(notification)
        dedupe_key = str(notification.data.get("dedupe_key") or "").strip()
        key = (notification.user_id, notification.type, dedupe_key)
        if dedupe_key and key in self._by_key:
            return self._by_key[key], False
        created = Notification(
            id=999,
            user_id=notification.user_id,
            type=notification.type,
            title=notification.title,
            message=notification.message,
            data=notification.data,
            created_at=notification.created_at,
            read_at=notification.read_at,
        )
        if dedupe_key:
            self._by_key[key] = created
        return created, True

    async def create_many(self, notifications: list[Notification]) -> list[tuple[Notification, bool]]:
        results: list[tuple[Notification, bool]] = []
        for notification in notifications:
            results.append(await self.create_or_get(notification))
        return results

    async def list_by_user(self, user_id: int, limit: int, cursor: str | None):
        raise NotImplementedError

    async def unread_count(self, user_id: int) -> int:
        raise NotImplementedError

    async def mark_read(self, user_id: int, notification_id: int, read_at: int) -> None:
        raise NotImplementedError

    async def mark_all_read(self, user_id: int, read_at: int) -> int:
        raise NotImplementedError

    async def delete(self, user_id: int, notification_id: int) -> None:
        raise NotImplementedError


class FakeRealtimePublisher:
    def __init__(self):
        self.calls: list[tuple[int, Notification]] = []

    async def publish_to_user(self, user_id: int, notification: Notification) -> None:
        self.calls.append((user_id, notification))


@pytest.mark.asyncio
async def test_create_returns_existing_notification_when_dedupe_key_already_exists():
    existing = Notification(
        id=123,
        user_id=7,
        type=NotificationType.MATCH_RESULT,
        title="Match gagné",
        message="Déjà créée",
        data={"dedupe_key": "match_result:1:2:correct"},
        created_at=111,
        read_at=None,
    )
    repository = FakeNotificationRepository(existing=existing)
    realtime = FakeRealtimePublisher()
    usecase = NotificationCommandUseCaseImpl(
        notification_repository=repository,
        realtime_publisher=realtime,
        session_factory=lambda: None,
        push_subscription_uc=None,
    )

    created = await usecase.create(
        user_id=7,
        type=NotificationType.MATCH_RESULT,
        title="Match gagné",
        message="PSG - OM",
        data={"ticket_id": 1},
        dedupe_key="match_result:1:2:correct",
    )

    assert created == existing
    assert len(repository.create_calls) == 1
    assert realtime.calls == []


@pytest.mark.asyncio
async def test_create_persists_and_enriches_payload_with_dedupe_key_when_missing():
    repository = FakeNotificationRepository(existing=None)
    realtime = FakeRealtimePublisher()
    usecase = NotificationCommandUseCaseImpl(
        notification_repository=repository,
        realtime_publisher=realtime,
        session_factory=lambda: None,
        push_subscription_uc=None,
    )

    created = await usecase.create(
        user_id=7,
        type=NotificationType.BET_WON,
        title="Ticket gagné",
        message="Bravo",
        data={"ticket_id": 55},
        dedupe_key="ticket_resolved:55:win",
    )

    assert created.id == 999
    assert len(repository.create_calls) == 1
    assert repository.create_calls[0].data["dedupe_key"] == "ticket_resolved:55:win"
    assert realtime.calls[0][0] == 7


@pytest.mark.asyncio
async def test_create_many_only_publishes_realtime_for_inserted_notifications():
    existing = Notification(
        id=123,
        user_id=7,
        type=NotificationType.LEAGUE_ENDED,
        title="Ligue terminée",
        message="Déjà créée",
        data={"dedupe_key": "league_ended:9"},
        created_at=111,
        read_at=None,
    )
    repository = FakeNotificationRepository(existing=existing)
    realtime = FakeRealtimePublisher()
    usecase = NotificationCommandUseCaseImpl(
        notification_repository=repository,
        realtime_publisher=realtime,
        session_factory=lambda: None,
        push_subscription_uc=None,
    )

    created = await usecase.create_many(
        items=[
            NotificationCreateCommand(
                user_id=7,
                type=NotificationType.LEAGUE_ENDED,
                title="Ligue terminée",
                message="Fin",
                data={"league_id": 9},
                dedupe_key="league_ended:9",
            )
        ]
    )

    assert created == [existing]
    assert realtime.calls == []


@pytest.mark.asyncio
async def test_create_many_keeps_duplicate_commands_stable_and_only_publishes_once_per_inserted_key():
    repository = FakeNotificationRepository(existing=None)
    realtime = FakeRealtimePublisher()
    usecase = NotificationCommandUseCaseImpl(
        notification_repository=repository,
        realtime_publisher=realtime,
        session_factory=lambda: None,
        push_subscription_uc=None,
    )

    created = await usecase.create_many(
        items=[
            NotificationCreateCommand(
                user_id=7,
                type=NotificationType.LEAGUE_ENDED,
                title="Ligue terminée",
                message="Fin",
                data={"league_id": 9},
                dedupe_key="league_ended:9",
            ),
            NotificationCreateCommand(
                user_id=7,
                type=NotificationType.LEAGUE_ENDED,
                title="Ligue terminée bis",
                message="Fin bis",
                data={"league_id": 9},
                dedupe_key="league_ended:9",
            ),
        ]
    )

    assert len(created) == 2
    assert len(realtime.calls) == 1





