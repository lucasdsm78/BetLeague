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
    is_free: Optional[bool] = None
    uuid: Optional[str] = None
    start_date: int
    max_players: Optional[int] = None
    name: str
    end_date: Optional[int] = None
    user_creator: Optional[UserSummaryLeagueDetail] = None
    is_started: Optional[bool] = None
    nb_players_remaining: Optional[int] = None

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

    @staticmethod
    def from_entity_get_all(league: League) -> "LeagueReadModel":
        return LeagueReadModel(
            id=league.id,
            is_started=league.is_started,
            start_date=league.start_date,
            nb_players_remaining=league.nb_players_remaining,
            name=league.name,
        )
