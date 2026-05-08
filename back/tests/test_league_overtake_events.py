from application.league.league_overtake_events import build_overtaken_events
from domain.league.model.league_ranking_entry import LeagueRankingEntry


def _entry(*, user_id: int, pseudo: str, position: int, nb_btl: float) -> LeagueRankingEntry:
    return LeagueRankingEntry(
        user_id=user_id,
        pseudo=pseudo,
        nb_btl=nb_btl,
        nb_win=0,
        nb_lose=0,
        position=position,
    )


def test_build_overtaken_events_returns_event_for_each_user_passed_by_actor() -> None:
    before = [
        _entry(user_id=1, pseudo="Alice", position=1, nb_btl=120),
        _entry(user_id=2, pseudo="Bob", position=2, nb_btl=100),
        _entry(user_id=3, pseudo="Lucas", position=3, nb_btl=80),
    ]
    after = [
        _entry(user_id=3, pseudo="Lucas", position=1, nb_btl=140),
        _entry(user_id=1, pseudo="Alice", position=2, nb_btl=120),
        _entry(user_id=2, pseudo="Bob", position=3, nb_btl=100),
    ]

    events = build_overtaken_events(
        ranking_entries=before,
        league_id=9,
        league_name="Ligue 1",
        overtaken_by_user_id=3,
        overtaken_by_pseudo="Lucas",
        gain=60,
    )

    assert [(event.overtaken_user_id, event.previous_position, event.new_position) for event in events] == [
        (1, 1, 2),
        (2, 2, 3),
    ]


def test_build_overtaken_events_returns_empty_list_when_actor_does_not_improve_position() -> None:
    before = [
        _entry(user_id=1, pseudo="Alice", position=1, nb_btl=120),
        _entry(user_id=2, pseudo="Lucas", position=2, nb_btl=100),
    ]
    after = [
        _entry(user_id=1, pseudo="Alice", position=1, nb_btl=130),
        _entry(user_id=2, pseudo="Lucas", position=2, nb_btl=110),
    ]

    events = build_overtaken_events(
        ranking_entries=before,
        league_id=9,
        league_name="Ligue 1",
        overtaken_by_user_id=2,
        overtaken_by_pseudo="Lucas",
        gain=10,
    )

    assert events == []


def test_build_overtaken_events_emits_event_when_actor_breaks_a_tie_and_goes_ahead() -> None:
    before = [
        _entry(user_id=1, pseudo="Alice", position=2, nb_btl=100),
        _entry(user_id=2, pseudo="Lucas", position=2, nb_btl=100),
        _entry(user_id=3, pseudo="Bob", position=1, nb_btl=110),
    ]

    events = build_overtaken_events(
        ranking_entries=before,
        league_id=9,
        league_name="Ligue 1",
        overtaken_by_user_id=2,
        overtaken_by_pseudo="Lucas",
        gain=5,
    )

    assert [(event.overtaken_user_id, event.previous_position, event.new_position) for event in events] == [
        (1, 2, 3),
    ]




