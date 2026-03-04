from typing import List, Optional

from pydantic import BaseModel, Field


class MatchChoiceData(BaseModel):
    match_id: int = Field(..., gt=0)
    match_odd_id: int = Field(..., gt=0)


class TicketCreateModel(BaseModel):
    match_choices: List[MatchChoiceData] = Field(..., min_length=1, max_length=20)
    mise: int = Field(..., ge=1)


class TicketUpdateModel(BaseModel):
    match_choices: Optional[List[MatchChoiceData]] = Field(None, min_length=1, max_length=20)
    mise: Optional[int] = Field(None, ge=1)


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
