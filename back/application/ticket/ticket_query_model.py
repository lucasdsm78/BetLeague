from typing import Optional, List

from pydantic import BaseModel

from application.league.league_summary import LeagueSummary
from application.ticket.match_choice_summary import MatchChoiceSummary
from application.tournament.tournament_match_summary import TournamentMatchSummary


class TicketReadModel(BaseModel):

    id: int
    mise: int
    uuid: str
    gain: float
    status: str
    league_summary: Optional[LeagueSummary] = None
    tournament_match_summary: Optional[TournamentMatchSummary] = None
    match_choice_summaries: List[MatchChoiceSummary] = []

    class Config:
        arbitrary_types_allowed = True


class SharedTicketReadModel(BaseModel):

    uuid: str
    mise: int
    gain: float
    status: str
    league_summary: Optional[LeagueSummary] = None
    tournament_match_summary: Optional[TournamentMatchSummary] = None
    match_choice_summaries: List[MatchChoiceSummary] = []

    class Config:
        arbitrary_types_allowed = True


class TicketsInProgressResponse(BaseModel):
    tickets: List[TicketReadModel] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


class TicketsFinishedResponse(BaseModel):
    tickets: List[TicketReadModel] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
