from __future__ import annotations

from domain.league.events.league_user_overtaken import LeagueUserOvertaken
from domain.league.model.league_ranking_entry import LeagueRankingEntry


def build_overtaken_events(
    *,
    before_entries: list[LeagueRankingEntry],
    after_entries: list[LeagueRankingEntry],
    league_id: int,
    league_name: str,
    overtaken_by_user_id: int,
    overtaken_by_pseudo: str,
) -> list[LeagueUserOvertaken]:
    before_by_user = {entry.user_id: entry for entry in before_entries}
    after_by_user = {entry.user_id: entry for entry in after_entries}

    actor_before = before_by_user.get(overtaken_by_user_id)
    actor_after = after_by_user.get(overtaken_by_user_id)
    if actor_before is None or actor_after is None:
        return []
    if actor_after.position >= actor_before.position:
        return []

    events: list[LeagueUserOvertaken] = []
    for user_id, previous_entry in before_by_user.items():
        if user_id == overtaken_by_user_id:
            continue
        new_entry = after_by_user.get(user_id)
        if new_entry is None:
            continue
        if new_entry.position <= previous_entry.position:
            continue
        if not (actor_before.position > previous_entry.position and actor_after.position < new_entry.position):
            continue
        events.append(
            LeagueUserOvertaken(
                league_id=league_id,
                league_name=league_name,
                overtaken_user_id=user_id,
                overtaken_by_user_id=overtaken_by_user_id,
                overtaken_by_pseudo=overtaken_by_pseudo,
                previous_position=previous_entry.position,
                new_position=new_entry.position,
            )
        )
    return events

