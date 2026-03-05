import pytest

from application.ticket.match_choice_summary import MatchChoiceSummary
from application.match.match_summary import MatchSummary
from application.match.match_odd_summary import MatchOddSummary


def test_match_choice_summary_serializes_match_odd_summary():
    mc = MatchChoiceSummary(
        id=1,
        match_summary=MatchSummary(
            id=10,
            home_team="Home",
            away_team="Away",
            time="2026-01-01T00:00:00Z",
            winner=None,
        ),
        choice="Draw/Away",
        status="pending",
        match_odd_summary=MatchOddSummary(bet_type="double_chance", bet_name="Double Chance"),
    )

    d = mc.model_dump()
    assert "match_odd_summary" in d
    assert d["match_odd_summary"]["bet_type"] == "double_chance"
    assert d["match_odd_summary"]["bet_name"] == "Double Chance"

