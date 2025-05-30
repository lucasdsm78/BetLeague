from typing import Optional, List

from pydantic import BaseModel

from application.league.league_summary import LeagueSummary
from application.ticket.match_choice_summary import MatchChoiceSummary


class TicketReadModel(BaseModel):

    id: int
    mise: int
    uuid: str
    gain: float
    status: str
    league_summary: LeagueSummary
    match_choice_summaries: List[MatchChoiceSummary] = []

    class Config:
        arbitrary_types_allowed = True


class TicketsInProgressResponse(BaseModel):
    tickets: List[TicketReadModel] = []
