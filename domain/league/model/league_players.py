from typing import Optional


class LeaguePlayers:

    def __init__(
            self,
            user_id: int,
            league_id: int,
            nb_btl: Optional[float] = None,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None
    ):
        self.user_id: int = user_id
        self.league_id: int = league_id
        self.nb_btl: Optional[float] = nb_btl
        self.id: Optional[int] = id
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at
