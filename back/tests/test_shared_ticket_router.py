import pytest
from fastapi import HTTPException

from domain.ticket.exception.ticket_exception import TicketNotFoundError, TicketNotShareableError
from presentation.ticket.ticket_router import get_shared_ticket


class DummyUseCase:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error

    async def get_shared_ticket_details(self, ticket_uuid: str):
        if self.error:
            raise self.error
        return self.result


@pytest.mark.asyncio
async def test_get_shared_ticket_returns_payload():
    payload = {
        'uuid': 'ticket-uuid',
        'mise': 10,
        'gain': 28.5,
        'status': 'CORRECT',
        'league_summary': {'id': 11, 'name': 'Ligue VIP'},
        'tournament_match_summary': None,
        'match_choice_summaries': [],
    }

    result = await get_shared_ticket('ticket-uuid', ticket_query_usecase=DummyUseCase(result=payload))

    assert result['uuid'] == 'ticket-uuid'
    assert result['gain'] == 28.5


@pytest.mark.asyncio
async def test_get_shared_ticket_maps_not_shareable_to_403():
    with pytest.raises(HTTPException) as exc:
        await get_shared_ticket('ticket-uuid', ticket_query_usecase=DummyUseCase(error=TicketNotShareableError()))

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_shared_ticket_maps_missing_to_404():
    with pytest.raises(HTTPException) as exc:
        await get_shared_ticket('ticket-uuid', ticket_query_usecase=DummyUseCase(error=TicketNotFoundError()))

    assert exc.value.status_code == 404

