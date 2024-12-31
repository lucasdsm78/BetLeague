from typing import List

from pydantic import BaseModel


class MatchChoice(BaseModel):
    match_id: int
    choice: int


class TicketCreateModel(BaseModel):
    match_choices: List[MatchChoice]
    mise: int


class TicketCreateResponse(BaseModel):
    message: str = "The ticket is well created"
