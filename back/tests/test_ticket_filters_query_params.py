import pytest
from fastapi import HTTPException

from presentation.ticket.ticket_router import get_tickets_in_progress, get_tickets_finished


@pytest.mark.asyncio
async def test_ticket_filters_exclusive_in_progress_raises_422():
    async def _dummy(*args, **kwargs):
        raise AssertionError("Should not be called when both filters are set")

    with pytest.raises(HTTPException) as exc:
        await get_tickets_in_progress(
            page=1,
            page_size=20,
            league_id=1,
            is_tournament=True,
            ticket_query_usecase=type("U", (), {"get_tickets_in_progress": _dummy})(),
            current_user={"email": "a@b.com"},
        )

    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_ticket_filters_exclusive_finished_raises_422():
    async def _dummy(*args, **kwargs):
        raise AssertionError("Should not be called when both filters are set")

    with pytest.raises(HTTPException) as exc:
        await get_tickets_finished(
            page=1,
            page_size=20,
            league_id=1,
            is_tournament=True,
            ticket_query_usecase=type("U", (), {"get_tickets_finished": _dummy})(),
            current_user={"email": "a@b.com"},
        )

    assert exc.value.status_code == 422

