import pytest

import dependency_injections as di


@pytest.mark.asyncio
async def test_shutdown_api_sports_clients_closes_and_clears_cached_singletons():
    di._api_sports_score_service.cache_clear()
    di._api_sports_match_fetch_router.cache_clear()
    di._api_sports_football_client.cache_clear()

    client = di._api_sports_football_client()
    assert di._api_sports_football_client.cache_info().currsize == 1

    await di.shutdown_api_sports_clients()

    assert di._api_sports_football_client.cache_info().currsize == 0
    assert di._api_sports_score_service.cache_info().currsize == 0
    assert di._api_sports_match_fetch_router.cache_info().currsize == 0
    assert client._client.is_closed


@pytest.mark.asyncio
async def test_shutdown_api_sports_clients_is_idempotent_when_no_client_cached():
    di._api_sports_score_service.cache_clear()
    di._api_sports_match_fetch_router.cache_clear()
    di._api_sports_football_client.cache_clear()

    await di.shutdown_api_sports_clients()

    assert di._api_sports_football_client.cache_info().currsize == 0
    assert di._api_sports_score_service.cache_info().currsize == 0
    assert di._api_sports_match_fetch_router.cache_info().currsize == 0


@pytest.mark.asyncio
async def test_shutdown_api_sports_clients_clears_caches_when_close_fails(monkeypatch: pytest.MonkeyPatch):
    di._api_sports_score_service.cache_clear()
    di._api_sports_match_fetch_router.cache_clear()
    di._api_sports_football_client.cache_clear()

    client = di._api_sports_football_client()
    di._api_sports_score_service()
    di._api_sports_match_fetch_router()

    async def close_raises():
        raise RuntimeError("close boom")

    monkeypatch.setattr(client, "close", close_raises)

    await di.shutdown_api_sports_clients()

    assert di._api_sports_football_client.cache_info().currsize == 0
    assert di._api_sports_score_service.cache_info().currsize == 0
    assert di._api_sports_match_fetch_router.cache_info().currsize == 0
    await client._client.aclose()
