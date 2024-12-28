from typing import Optional

from pydantic import BaseModel


class LeagueFreeCreateModel(BaseModel):
    name: str
    max_players: int
    is_private: bool


class LeagueJoinResponse(BaseModel):
    message: str = "Your participation is well saved for this league"


class LeagueFreeCreateResponse(BaseModel):
    message: str = "The free league is well created"
