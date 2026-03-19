from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

FREE_TOURNAMENT_CREATIONS_PER_MONTH = 2


@dataclass(frozen=True)
class TournamentCreationAccessStatus:
    monthly_free_tournaments_limit: int
    monthly_free_tournaments_used: int
    monthly_free_tournaments_remaining: int
    has_active_subscription: bool
    can_create_tournament: bool
    requires_tournament_subscription: bool


class TournamentCreationPolicy:
    def __init__(self, *, monthly_free_limit: int = FREE_TOURNAMENT_CREATIONS_PER_MONTH):
        self._monthly_free_limit = monthly_free_limit

    @property
    def monthly_free_limit(self) -> int:
        return self._monthly_free_limit

    def evaluate(
        self,
        *,
        has_active_subscription: bool,
        monthly_free_tournaments_used: int,
    ) -> TournamentCreationAccessStatus:
        used = max(0, monthly_free_tournaments_used)
        remaining = max(0, self._monthly_free_limit - used)
        can_create = has_active_subscription or remaining > 0
        return TournamentCreationAccessStatus(
            monthly_free_tournaments_limit=self._monthly_free_limit,
            monthly_free_tournaments_used=used,
            monthly_free_tournaments_remaining=remaining,
            has_active_subscription=has_active_subscription,
            can_create_tournament=can_create,
            requires_tournament_subscription=not can_create,
        )


def current_month_window_ms(now_ms: int | None = None) -> tuple[int, int]:
    now = datetime.fromtimestamp((now_ms / 1000) if now_ms is not None else datetime.now(UTC).timestamp(), tz=UTC)
    month_start = datetime(year=now.year, month=now.month, day=1, tzinfo=UTC)
    if now.month == 12:
        next_month_start = datetime(year=now.year + 1, month=1, day=1, tzinfo=UTC)
    else:
        next_month_start = datetime(year=now.year, month=now.month + 1, day=1, tzinfo=UTC)
    return int(month_start.timestamp() * 1000), int(next_month_start.timestamp() * 1000)

