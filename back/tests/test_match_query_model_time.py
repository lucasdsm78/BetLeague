from datetime import UTC, datetime

from application.match.match_query_model import MatchReadModel
from domain.match.model.match import Match


def test_match_read_model_attaches_utc_to_naive_match_time():
    match = Match(
        id=2,
        uuid="match-2",
        home_team="PSG",
        away_team="OM",
        time=datetime(2026, 7, 1, 18, 0, 0),
        created_at=1,
        updated_at=2,
    )

    read_model = MatchReadModel.from_entity(match)

    assert read_model.time.tzinfo == UTC
    assert read_model.time.isoformat() == "2026-07-01T18:00:00+00:00"


def test_match_read_model_exposes_league_metadata():
    match = Match(
        id=3,
        uuid="match-3",
        home_team="France",
        away_team="Brazil",
        time=datetime(2026, 7, 19, 19, 0, 0),
        created_at=10,
        updated_at=11,
        league_name="World Cup",
        league_id=1,
        season=2026,
    )

    read_model = MatchReadModel.from_entity(match)

    assert read_model.league_name == "World Cup"
    assert read_model.league_id == 1
    assert read_model.season == 2026


