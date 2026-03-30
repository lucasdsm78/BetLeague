from typing import Optional
from typing import List

from pydantic import conlist
from pydantic import Field, BaseModel

from application.user.user_query_model import UserSummaryReadModel
from domain.league.model.league import League


class UserSummaryLeagueDetail(BaseModel):

    id: int
    pseudo: str

    class Config:
        arbitrary_types_allowed = True


class LeagueInvitationReceivedSummary(BaseModel):

    id: int
    name: str
    max_players: int
    start_date: int
    user_creator: UserSummaryLeagueDetail
    nb_players_remaining: int
    is_started: Optional[bool] = None

    class Config:
        arbitrary_types_allowed = True


class TournamentInvitationReceivedSummary(BaseModel):

    id: int
    name: str
    max_players: int
    current_players: int
    start_date: int
    end_date: int
    is_private: bool
    status: str
    user_creator: UserSummaryLeagueDetail

    class Config:
        arbitrary_types_allowed = True


class LeagueReadModel(BaseModel):

    id: int
    is_free: Optional[bool] = None
    nb_btl: Optional[float] = None
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
            nb_btl=league.nb_btl,
            start_date=league.start_date,
            max_players=league.max_players,
            name=league.name,
            end_date=league.end_date,
            is_started=league.is_started,
            nb_players_remaining=league.nb_players_remaining,
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
            is_free=league.is_free,
            nb_btl=league.nb_btl,
        )


class InvitationReceivedReadModel(BaseModel):

    id: int
    type: str
    league: Optional[LeagueInvitationReceivedSummary] = None
    tournament: Optional[TournamentInvitationReceivedSummary] = None
    status: str

    class Config:
        arbitrary_types_allowed = True


class InvitationsReceivedResponse(BaseModel):
    invitations: List[InvitationReceivedReadModel] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20


class InvitationCountsResponse(BaseModel):
    pending: int = 0
    accepted: int = 0
    refused: int = 0


class LeagueInvitationSentReadModel(BaseModel):
    id: int
    status: str
    created_at: int
    user: UserSummaryReadModel


class LeagueInvitationsSentResponse(BaseModel):
    league_id: int
    invitations: List[LeagueInvitationSentReadModel] = Field(default_factory=list)


class LeaguesListResponse(BaseModel):
    leagues: List[LeagueReadModel] = Field(default_factory=list)
    page: int
    page_size: int
    total: int
    total_pages: int


class LeagueBalancesBulkRequest(BaseModel):
    league_ids: conlist(int, min_length=1, max_length=200) = Field(
        ..., description="Liste d'IDs de ligues (max 200)."
    )


class LeagueBalancesBulkResponse(BaseModel):
    balances: dict[int, float] = Field(default_factory=dict)
    not_found: List[int] = Field(default_factory=list)
    forbidden: List[int] = Field(default_factory=list)
