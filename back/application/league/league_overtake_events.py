from __future__ import annotations

from domain.league.events.league_user_overtaken import LeagueUserOvertaken
from domain.league.model.league_ranking_entry import LeagueRankingEntry


def build_overtaken_events(
    *,
    ranking_entries: list[LeagueRankingEntry],
    league_id: int,
    league_name: str,
    overtaken_by_user_id: int,
    overtaken_by_pseudo: str,
    gain: float,
) -> list[LeagueUserOvertaken]:
    if gain <= 0:
        return []

    ranking_by_user = {entry.user_id: entry for entry in ranking_entries}
    actor_before = ranking_by_user.get(overtaken_by_user_id)
    if actor_before is None:
        return []

    actor_before_score = float(actor_before.nb_btl or 0)
    actor_after_score = actor_before_score + float(gain or 0)

    events: list[LeagueUserOvertaken] = []
    for user_id, previous_entry in ranking_by_user.items():
        if user_id == overtaken_by_user_id:
            continue
        previous_score = float(previous_entry.nb_btl or 0)
        was_not_ahead_before = actor_before_score <= previous_score
        is_strictly_ahead_after = actor_after_score > previous_score
        if not (was_not_ahead_before and is_strictly_ahead_after):
            continue
        events.append(
            LeagueUserOvertaken(
                league_id=league_id,
                league_name=league_name,
                overtaken_user_id=user_id,
                overtaken_by_user_id=overtaken_by_user_id,
                overtaken_by_pseudo=overtaken_by_pseudo,
                previous_position=previous_entry.position,
                new_position=previous_entry.position + 1,
            )
        )
    return sorted(events, key=lambda event: (event.previous_position, event.overtaken_user_id))



