from __future__ import annotations

import pytest

from application.notification.notification_command_usecase_impl import NotificationCommandUseCaseImpl
from domain.notification.model.notification import Notification, NotificationType


class FakeNotificationRepository:
    def __init__(self, existing: Notification | None = None):
        self.existing = existing
        self.create_calls: list[Notification] = []
        self.find_calls: list[tuple[int, NotificationType, str]] = []

    async def create(self, notification: Notification) -> Notification:
        self.create_calls.append(notification)
        return Notification(
            id=999,
            user_id=notification.user_id,
            type=notification.type,
            title=notification.title,
            message=notification.message,
            data=notification.data,
            created_at=notification.created_at,
            read_at=notification.read_at,
        )

    async def find_by_dedupe_key(self, *, user_id: int, type: NotificationType, dedupe_key: str):
        self.find_calls.append((user_id, type, dedupe_key))
        return self.existing

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
    assert repository.find_calls == [(7, NotificationType.MATCH_RESULT, "match_result:1:2:correct")]
    assert repository.create_calls == []
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
    assert repository.find_calls == [(7, NotificationType.BET_WON, "ticket_resolved:55:win")]
    assert len(repository.create_calls) == 1
    assert repository.create_calls[0].data["dedupe_key"] == "ticket_resolved:55:win"
    assert realtime.calls[0][0] == 7

