from typing import Optional


class Match:

    def __init__(
            self,
            uuid: str,
            home_team: str,
            away_team: str,
            cote_home: float,
            cote_draw: float,
            cote_away: float,
            time: str,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None,
    ):
        self.id: Optional[int] = id
        self.uuid: str = uuid
        self.home_team: str = home_team
        self.away_team: str = away_team
        self.cote_home: float = cote_home
        self.cote_draw: float = cote_draw
        self.cote_away: float = cote_away
        self.time: str = time
        self.created_at: Optional[int] = created_at
        self.updated_at: Optional[int] = updated_at
