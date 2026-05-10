from application.events.jetstream_event_decoder import decode_domain_event
from domain.league.events.league_ended import LeagueEnded
from domain.league.events.league_user_overtaken import LeagueUserOvertaken
from domain.ticket.event.ticket_resolved_event import TicketResolvedEvent


def test_decode_ticket_resolved_event() -> None:
    decoded = decode_domain_event(
        {
            "event_name": "ticket.resolved",
            "ticket_id": 12,
            "user_id": 8,
            "league_id": 3,
            "is_win": True,
            "gain": 25.5,
        }
    )

    assert isinstance(decoded.event, TicketResolvedEvent)
    assert decoded.event.ticket_id == 12
    assert decoded.event.user_id == 8
    assert decoded.event.league_id == 3
    assert decoded.event.is_win is True
    assert decoded.event.gain == 25.5


def test_decode_league_ended_event() -> None:
    decoded = decode_domain_event(
        {
            "event_name": "league.ended",
            "league_id": 9,
            "league_name": "Ligue Premium",
            "winner_id": 4,
            "winner_pseudo": "Lucas",
            "rewarded_amount": 200,
        }
    )

    assert isinstance(decoded.event, LeagueEnded)
    assert decoded.event.league_name == "Ligue Premium"
    assert decoded.event.winner_id == 4
    assert decoded.event.winner_pseudo == "Lucas"
    assert decoded.event.rewarded_amount == 200.0


def test_decode_league_user_overtaken_event() -> None:
    decoded = decode_domain_event(
        {
            "event_name": "league.user.overtaken",
            "league_id": 9,
            "league_name": "Ligue Premium",
            "overtaken_user_id": 7,
            "overtaken_by_user_id": 4,
            "overtaken_by_pseudo": "Lucas",
            "previous_position": 1,
            "new_position": 2,
        }
    )

    assert isinstance(decoded.event, LeagueUserOvertaken)
    assert decoded.event.overtaken_user_id == 7
    assert decoded.event.overtaken_by_user_id == 4
    assert decoded.event.previous_position == 1
    assert decoded.event.new_position == 2

