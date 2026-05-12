from datetime import datetime
from enum import Enum
from typing import Optional

from domain.league.exception.league_exception import UserNotOwnerLeaguedError, LeagueAlreadyStartedError, LeagueMinimumPlayersNotReachedError
from domain.user.model.user_summary import UserSummary


class LeagueStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    CLOSED = "CLOSED"


class League:
    def __init__(
            self,
            is_free: bool,
            uuid: str,
            name: str,
            max_players: int,
            start_date: int,
            end_date: int,
            is_private: bool,
            user: UserSummary,
            min_players: Optional[int] = None,
            nb_players_remaining: Optional[int] = None,
            current_players_count: Optional[int] = None,
            is_started: Optional[bool] = None,
            nb_btl: Optional[int] = None,
            id: Optional[int] = None,
            winner_id: Optional[int] = None,
            status: LeagueStatus | str = LeagueStatus.OPEN,
            closed_at: Optional[int] = None,
            reward_paid_at: Optional[int] = None,
            rewarded_amount: Optional[float] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.id: Optional[int] = id
        self.winner_id: Optional[int] = winner_id
        self.uuid: str = uuid
        self.name: str = name
        self.is_free: bool = is_free
        self.is_started: Optional[bool] = is_started
        self.max_players: int = max_players
        self.min_players: int = self.max_players if min_players is None else max(2, min(int(min_players), self.max_players))
        self.is_private: bool = is_private
        self.start_date: int = start_date
        self.end_date: int = end_date
        self.nb_players_remaining: Optional[int] = nb_players_remaining
        self.current_players_count: Optional[int] = current_players_count
        self.user: UserSummary = user
        self.nb_btl: Optional[int] = nb_btl
        self.status: LeagueStatus = status if isinstance(status, LeagueStatus) else LeagueStatus(status)
        self.closed_at: Optional[int] = closed_at
        self.reward_paid_at: Optional[int] = reward_paid_at
        self.rewarded_amount: Optional[float] = rewarded_amount
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at

    def can_determine_winner(self, as_of: datetime) -> bool:
        timestamp = int(as_of.timestamp() * 1000)
        return self.status == LeagueStatus.IN_PROGRESS and self.is_started and timestamp >= self.end_date

    @property
    def is_closed(self) -> bool:
        return self.status == LeagueStatus.CLOSED

    @property
    def current_players(self) -> Optional[int]:
        if self.current_players_count is not None:
            return max(int(self.current_players_count), 0)

        if self.nb_players_remaining is None:
            return None

        return max(self.max_players - self.nb_players_remaining, 0)

    def has_minimum_players(self, current_players: Optional[int] = None) -> bool:
        players_count = self.current_players if current_players is None else current_players
        if players_count is None:
            return False
        return int(players_count) >= int(self.min_players)

    def can_start(self, current_players: Optional[int] = None) -> bool:
        return not self.is_closed and not bool(self.is_started) and self.has_minimum_players(current_players)

    def ensure_startable(self, owner_user_id: int, current_players: Optional[int] = None) -> None:
        if self.user.id != owner_user_id:
            raise UserNotOwnerLeaguedError
        if self.is_closed:
            raise LeagueAlreadyStartedError
        if self.is_started:
            raise LeagueAlreadyStartedError
        if not self.has_minimum_players(current_players):
            raise LeagueMinimumPlayersNotReachedError

    @property
    def current_total_pot(self) -> Optional[float]:
        current_players = self.current_players
        if current_players is None:
            return None

        if self.is_free or self.nb_btl is None:
            return None

        entry_fee = float(self.nb_btl)
        if entry_fee < 0:
            return None

        return float(current_players * entry_fee)

    def mark_started(self) -> None:
        self.is_started = True
        self.status = LeagueStatus.IN_PROGRESS

    def start(self, *, at_ms: int, end_date_ms: int) -> None:
        self.start_date = at_ms
        self.end_date = end_date_ms
        self.mark_started()

    def mark_waiting(self) -> None:
        self.is_started = False
        self.status = LeagueStatus.OPEN

    def close(self, *, closed_at: int, winner_id: Optional[int], rewarded_amount: Optional[float]) -> None:
        self.winner_id = winner_id
        self.rewarded_amount = rewarded_amount
        self.reward_paid_at = closed_at if rewarded_amount and rewarded_amount > 0 else None
        self.closed_at = closed_at
        self.is_started = False
        self.status = LeagueStatus.CLOSED
