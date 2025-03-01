from typing import Optional

from domain.user.model.user_summary import UserSummary


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
            nb_players_remaining: Optional[int] = None,
            is_started: Optional[bool] = None,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.id: Optional[int] = id
        self.uuid: str = uuid
        self.name: str = name
        self.is_free: bool = is_free
        self.is_started: Optional[bool] = is_started
        self.max_players: int = max_players
        self.is_private: bool = is_private
        self.start_date: int = start_date
        self.end_date: int = end_date
        self.nb_players_remaining: Optional[int] = nb_players_remaining
        self.user: UserSummary = user
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at
