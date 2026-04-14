from application.league.league_query_model import LeagueReadModel
from domain.league.model.league import League, LeagueStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


def _build_league(*, nb_btl: int | None, nb_players_remaining: int | None, max_players: int = 8) -> League:
    return League(
        id=12,
        uuid='league-uuid',
        name='Ligue Premium',
        is_free=nb_btl in (None, 0),
        is_started=False,
        max_players=max_players,
        is_private=False,
        start_date=1_710_000_000_000,
        end_date=1_710_604_800_000,
        nb_players_remaining=nb_players_remaining,
        nb_btl=nb_btl,
        status=LeagueStatus.OPEN,
        user=UserSummary(id=7, email=Email('owner@example.com'), pseudo='owner'),
    )


def test_league_read_model_exposes_estimated_total_pot_for_detail_and_list_views():
    league = _build_league(nb_btl=10, nb_players_remaining=5)

    detail = LeagueReadModel.from_entity_get_by_id(league)
    summary = LeagueReadModel.from_entity_get_all(league)

    assert league.current_players == 3
    assert league.estimated_total_pot == 30.0
    assert detail.estimated_total_pot == 30.0
    assert summary.estimated_total_pot == 30.0


def test_league_estimated_total_pot_is_zero_for_free_or_incomplete_leagues():
    free_league = _build_league(nb_btl=None, nb_players_remaining=4)
    incomplete_league = _build_league(nb_btl=15, nb_players_remaining=None)

    assert free_league.estimated_total_pot == 0.0
    assert LeagueReadModel.from_entity_get_by_id(free_league).estimated_total_pot == 0.0

    assert incomplete_league.current_players is None
    assert incomplete_league.estimated_total_pot == 0.0
    assert LeagueReadModel.from_entity_get_all(incomplete_league).estimated_total_pot == 0.0

