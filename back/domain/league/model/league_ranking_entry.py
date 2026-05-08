from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LeagueRankingEntry:
    user_id: int
    pseudo: str
    nb_btl: float
    nb_win: int
    nb_lose: int
    position: int

