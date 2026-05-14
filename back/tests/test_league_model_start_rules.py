from domain.league.exception.league_exception import (
    LeagueAlreadyStartedError,
    LeagueMinimumPlayersNotReachedError,
    UserNotOwnerLeaguedError,
)
from domain.league.model.league import League, LeagueStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


OWNER = UserSummary(id=7, email=Email('owner@example.com'), pseudo='owner')


def _build_league(*, current_players_count: int = 0, is_started: bool = False, status: LeagueStatus = LeagueStatus.OPEN) -> League:
    return League(
        id=12,
        uuid='league-uuid',
        name='Ligue test',
        is_free=True,
        is_started=is_started,
        max_players=8,
        min_players=4,
        is_private=False,
        start_date=1_710_000_000_000,
        end_date=1_710_604_800_000,
        current_players_count=current_players_count,
        status=status,
        user=OWNER,
    )


def test_can_start_requires_minimum_players_and_open_state():
    not_ready = _build_league(current_players_count=3)
    ready = _build_league(current_players_count=4)
    already_started = _build_league(current_players_count=4, is_started=True, status=LeagueStatus.IN_PROGRESS)
    closed = _build_league(current_players_count=8, status=LeagueStatus.CLOSED)

    assert not not_ready.can_start()
    assert ready.can_start()
    assert not already_started.can_start()
    assert not closed.can_start()


def test_ensure_startable_rejects_non_owner():
    league = _build_league(current_players_count=4)

    try:
        league.ensure_startable(owner_user_id=999)
        assert False, 'expected UserNotOwnerLeaguedError'
    except UserNotOwnerLeaguedError:
        pass


def test_ensure_startable_rejects_started_or_closed_leagues():
    started = _build_league(current_players_count=4, is_started=True, status=LeagueStatus.IN_PROGRESS)
    closed = _build_league(current_players_count=4, status=LeagueStatus.CLOSED)

    for league in (started, closed):
        try:
            league.ensure_startable(owner_user_id=OWNER.id)
            assert False, 'expected LeagueAlreadyStartedError'
        except LeagueAlreadyStartedError:
            pass


def test_ensure_startable_requires_minimum_players():
    league = _build_league(current_players_count=2)

    try:
        league.ensure_startable(owner_user_id=OWNER.id)
        assert False, 'expected LeagueMinimumPlayersNotReachedError'
    except LeagueMinimumPlayersNotReachedError:
        pass


def test_ensure_startable_accepts_owner_when_minimum_players_reached():
    league = _build_league(current_players_count=4)

    league.ensure_startable(owner_user_id=OWNER.id)

