from typing import Optional


class LeaguePlayers:

    def __init__(
            self,
            user_id: int,
            league_id: int,
            nb_btl: Optional[float] = None,
            btl_from_tickets: Optional[float] = None,
            nb_win: Optional[int] = None,
            nb_lose: Optional[int] = None,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.user_id: int = user_id
        self.league_id: int = league_id
        self.nb_win: Optional[int] = nb_win
        self.nb_lose: Optional[int] = nb_lose
        self.nb_btl: Optional[float] = nb_btl
        self.btl_from_tickets: float = btl_from_tickets if btl_from_tickets is not None else 0
        self.id: Optional[int] = id
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at
