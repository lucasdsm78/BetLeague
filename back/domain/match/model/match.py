from datetime import datetime
from typing import Optional

from domain.match.model.sport import Sport
from domain.match.model.match_status import MatchStatus


class Match:

    def __init__(
            self,
            uuid: str,
            home_team: str,
            away_team: str,
            time: datetime,
            id: Optional[int] = None,
            winner: Optional[str] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None,
            sport: Sport = Sport.FOOTBALL,
            league_name: Optional[str] = None,
            league_id: Optional[int] = None,
            logo_home: Optional[str] = None,
            logo_away: Optional[str] = None,
            score_home: Optional[int] = None,
            score_away: Optional[int] = None,
            status: MatchStatus = MatchStatus.NOT_STARTED,
            api_fixture_id: Optional[int] = None,
            season: Optional[int] = None,
    ):
        self.id: Optional[int] = id
        self.uuid: str = uuid
        self.home_team: str = home_team
        self.away_team: str = away_team
        self.time: datetime = time
        self.created_at: Optional[int] = created_at
        self.winner: Optional[str] = winner
        self.updated_at: Optional[int] = updated_at
        self.sport: Sport = sport
        self.league_name: Optional[str] = league_name
        self.league_id: Optional[int] = league_id
        self.logo_home: Optional[str] = logo_home
        self.logo_away: Optional[str] = logo_away
        self.score_home: Optional[int] = score_home
        self.score_away: Optional[int] = score_away
        self.status: MatchStatus = status
        self.api_fixture_id: Optional[int] = api_fixture_id
        self.season: Optional[int] = season

    def determine_winner(self) -> Optional[str]:
        if not self.status.is_finished():
            return None
        if self.score_home is None or self.score_away is None:
            return None
        if self.score_home > self.score_away:
            return "1"
        elif self.score_home < self.score_away:
            return "2"
        return "N"
