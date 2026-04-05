from typing import Optional

from domain.tournament.exception.tournament_exception import (
    TournamentAlreadyStartedError,
    TournamentMaxPlayersError,
    TournamentNotEnoughPlayersError,
    TournamentNotOwnerLeaguedError,
)
from domain.tournament.model.tournament_status import TournamentStatus

from domain.user.model.user_summary import UserSummary

class Tournament:
    ALLOWED_BRACKET_SIZES = (4, 8, 16)
    DEFAULT_BRACKET_SIZE = 16
    DEFAULT_ENTRY_FEE = 5.0
    DEFAULT_PLAYER_START_BTL = 100.0

    def __init__(
        self,
        uuid: str,
        name: str,
        is_private: bool,
        user: UserSummary,
        status: TournamentStatus = TournamentStatus.PENDING,
        max_players: int = DEFAULT_BRACKET_SIZE,
        min_players: Optional[int] = None,
        current_players: int = 0,
        entry_fee: float = 0.0,
        prize_pool: float = 0.0,
        id: Optional[int] = None,
        winner_id: Optional[int] = None,
        created_at: Optional[int] = None,
        start_date: Optional[int] = None,
        end_date: Optional[int] = None,
    ):
        self.id = id
        self.uuid = uuid
        self.name = name
        self.status = status
        self.max_players = self.validate_max_players(max_players)
        self.min_players = self.max_players if min_players is None else max(2, min(int(min_players), self.max_players))
        self.current_players = current_players
        self.entry_fee = entry_fee
        self.prize_pool = prize_pool
        self.is_private = is_private
        self.start_date = start_date
        self.end_date = end_date
        self.user = user
        self.winner_id = winner_id
        self.created_at = created_at

    @classmethod
    def validate_max_players(cls, max_players: int) -> int:
        normalized = int(max_players)
        if normalized not in cls.ALLOWED_BRACKET_SIZES:
            raise ValueError(
                f"Le bracket tournoi doit contenir l'un des formats suivants: {', '.join(map(str, cls.ALLOWED_BRACKET_SIZES))} joueurs"
            )
        return normalized

    @property
    def is_full(self) -> bool:
        return self.current_players >= self.max_players

    def ensure_joinable(self) -> None:
        if self.status != TournamentStatus.PENDING:
            raise TournamentAlreadyStartedError
        if self.is_full:
            raise TournamentMaxPlayersError

    def register_player(self) -> None:
        self.ensure_joinable()
        self.current_players += 1
        self.prize_pool = float(self.prize_pool or 0.0) + float(self.entry_fee or 0.0)

    def unregister_player(self) -> None:
        if self.status != TournamentStatus.PENDING:
            raise TournamentAlreadyStartedError
        self.current_players = max(0, int(self.current_players) - 1)
        self.prize_pool = max(0.0, float(self.prize_pool or 0.0) - float(self.entry_fee or 0.0))

    def ensure_startable(self, owner_user_id: int) -> None:
        if self.user.id != owner_user_id:
            raise TournamentNotOwnerLeaguedError
        if self.status != TournamentStatus.PENDING:
            raise TournamentAlreadyStartedError
        if self.current_players != self.max_players:
            raise TournamentNotEnoughPlayersError

    def start(self, *, at_ms: int, end_date_ms: int) -> None:
        self.status = TournamentStatus.IN_PROGRESS
        self.start_date = at_ms
        self.end_date = end_date_ms

