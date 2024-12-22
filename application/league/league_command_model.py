from typing import Optional

from pydantic import BaseModel


class LeagueFreeCreateModel(BaseModel):
    name: str
    max_players: int
    is_private: bool
    end_date: int


class LeagueFreeCreateResponse(BaseModel):
    message: str = "The free league is well created"
