import pytest
from fastapi import HTTPException

from domain.tournament.exception.tournament_exception import (
    TournamentAlreadyStartedError,
    TournamentNotFoundError,
    TournamentOwnerCannotLeaveError,
    TournamentPlayerNotFoundError,
)
from presentation.tournament.tournament_router import leave_tournament


class DummyTournamentCommandUseCase:
    def __init__(self, *, result=None, error=None):
        self.result = result
        self.error = error
        self.calls: list[tuple[int, int]] = []

    async def leave_tournament(self, tournament_id: int, user_id: int):
        self.calls.append((tournament_id, user_id))
        if self.error:
            raise self.error
        return self.result


@pytest.mark.asyncio
async def test_leave_tournament_returns_response_payload():
    usecase = DummyTournamentCommandUseCase(result={'message': 'The player is well deleted to the tournament'})

    result = await leave_tournament(
        12,
        tournament_command_usecase=usecase,
        current_user={'id': 7},
        _rate_limited=True,
    )

    assert result == {'message': 'The player is well deleted to the tournament'}
    assert usecase.calls == [(12, 7)]


@pytest.mark.asyncio
async def test_leave_tournament_maps_started_tournament_to_409():
    with pytest.raises(HTTPException) as exc:
        await leave_tournament(
            12,
            tournament_command_usecase=DummyTournamentCommandUseCase(error=TournamentAlreadyStartedError()),
            current_user={'id': 7},
            _rate_limited=True,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == TournamentAlreadyStartedError.message


@pytest.mark.asyncio
async def test_leave_tournament_maps_owner_cannot_leave_to_403():
    with pytest.raises(HTTPException) as exc:
        await leave_tournament(
            12,
            tournament_command_usecase=DummyTournamentCommandUseCase(error=TournamentOwnerCannotLeaveError()),
            current_user={'id': 42},
            _rate_limited=True,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == TournamentOwnerCannotLeaveError.message


@pytest.mark.asyncio
async def test_leave_tournament_maps_missing_player_to_404():
    with pytest.raises(HTTPException) as exc:
        await leave_tournament(
            12,
            tournament_command_usecase=DummyTournamentCommandUseCase(error=TournamentPlayerNotFoundError()),
            current_user={'id': 7},
            _rate_limited=True,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == TournamentPlayerNotFoundError.message


@pytest.mark.asyncio
async def test_leave_tournament_maps_missing_tournament_to_404():
    with pytest.raises(HTTPException) as exc:
        await leave_tournament(
            12,
            tournament_command_usecase=DummyTournamentCommandUseCase(error=TournamentNotFoundError()),
            current_user={'id': 7},
            _rate_limited=True,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == TournamentNotFoundError.message

