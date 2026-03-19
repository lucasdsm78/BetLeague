import redis

from infrastructure.services.notification.threaded_redis_pubsub import ThreadedRedisPubSubSubscriber


def test_threaded_pubsub_builds_blocking_client(monkeypatch):
    captured: dict[str, object] = {}

    def fake_from_url(url: str, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(redis.Redis, "from_url", staticmethod(fake_from_url))

    subscriber = ThreadedRedisPubSubSubscriber(
        redis_url="redis://notif:secret@redis:6379/0",
        channel="betleague:notifications:user:42",
    )

    client = subscriber._build_client()

    assert client is not None
    assert captured["url"] == "redis://notif:secret@redis:6379/0"
    assert captured["socket_connect_timeout"] == 2
    assert captured["socket_timeout"] is None
    assert captured["health_check_interval"] == 30
    assert captured["retry_on_timeout"] is False
    assert captured["socket_keepalive"] is True

