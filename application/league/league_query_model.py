from typing import Optional

from pydantic import Field, BaseModel

from domain.league.model.league import League


class UserSummaryLeagueDetail(BaseModel):

    id: int
    pseudo: str

    class Config:
        arbitrary_types_allowed = True


class LeagueReadModel(BaseModel):

    id: int
    is_free: bool
    uuid: str
    start_date: int
    max_players: int
    name: str
    end_date: int
    user_creator: UserSummaryLeagueDetail
    is_started: Optional[bool] = None

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity_get_by_id(league: League) -> "LeagueReadModel":
        return LeagueReadModel(
            id=league.id,
            uuid=league.uuid,
            is_free=league.is_free,
            start_date=league.start_date,
            max_players=league.max_players,
            name=league.name,
            end_date=league.end_date,
            is_started=league.is_started,
            user_creator=UserSummaryLeagueDetail(id=league.user.id, pseudo=league.user.pseudo),
        )
