from redis.asyncio import Redis

from infrastructure.services.notification.redis_notification_realtime import RedisNotificationSubscriber


def test_async_redis_notification_subscriber_builds_long_lived_client(monkeypatch):
    captured: dict[str, object] = {}

    def fake_from_url(url: str, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(Redis, "from_url", staticmethod(fake_from_url))

    subscriber = RedisNotificationSubscriber(
        redis_url="redis://notif:secret@redis:6379/0",
        channel_prefix="betleague:notifications:user:",
    )

    client = subscriber._build_client()

    assert client is not None
    assert captured["url"] == "redis://notif:secret@redis:6379/0"
    assert captured["decode_responses"] is False
    assert captured["socket_connect_timeout"] == 2
    assert captured["socket_timeout"] is None
    assert captured["health_check_interval"] == 30
    assert captured["retry_on_timeout"] is False
    assert captured["socket_keepalive"] is True

