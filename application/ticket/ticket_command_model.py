from typing import List, Optional

from pydantic import BaseModel


class MatchChoiceData(BaseModel):
    match_id: int
    choice: str


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


class TicketUpdateResponse(BaseModel):
    message: str = "The ticket is well updated"


class TicketRemoveResponse(BaseModel):
    message: str = "The ticket is well removed"
