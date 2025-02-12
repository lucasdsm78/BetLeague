from typing import List, Optional

from pydantic import BaseModel


class MatchChoice(BaseModel):
    match_id: int
    choice: str


class TicketCreateModel(BaseModel):
    match_choices: List[MatchChoice]
    mise: int
    gain: Optional[int]


class TicketCreateResponse(BaseModel):
    message: str = "The ticket is well created"


class TicketRemoveResponse(BaseModel):
    message: str = "The ticket is well removed"
