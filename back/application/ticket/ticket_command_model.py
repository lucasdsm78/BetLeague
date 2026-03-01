from typing import List, Optional

from pydantic import BaseModel


class MatchChoiceData(BaseModel):
    match_id: int
    match_odd_id: int


class TicketCreateModel(BaseModel):
    match_choices: List[MatchChoiceData]
    mise: int
    gain: Optional[int]


class TicketUpdateModel(BaseModel):
    match_choices: Optional[List[MatchChoiceData]]
    mise: Optional[int] = None
    gain: Optional[int] = None


class TicketCreateResponse(BaseModel):
    message: str = "The ticket is well created"
    ticket_id: Optional[int] = None


class TicketUpdateResponse(BaseModel):
    message: str = "The ticket is well updated"


class TicketRemoveResponse(BaseModel):
    message: str = "The ticket is well removed"


class TicketUpdatedResponse(BaseModel):
    message: str = "The ticket is well updated"


class NoTicketUpdatedResponse(BaseModel):
    message: str = "No ticket was updated"
