from typing import Optional

from pydantic import BaseModel


class LeagueCreateModel(BaseModel):
    name: str
    max_players: int
    is_private: bool
    is_free: Optional[bool]
    nb_btl: Optional[int]


class LeagueUpdateModel(BaseModel):
    name: str
    max_players: int
    start_date: int

class LeagueJoinResponse(BaseModel):
    message: str = "Your participation is well saved for this league"


class LeagueInviteResponse(BaseModel):
    message: str = "The user is invited to join this league"


class InvitationUpdateResponse(BaseModel):
    message: str = "The invitation is well updated."


class LeagueUpdateResponse(BaseModel):
    message: str = "The league is well updated."


class LeagueFreeCreateResponse(BaseModel):
    message: str = "The free league is well created"


class LeaguePlayerDeletedResponse(BaseModel):
    message: str = "The player is well deleted to the league"
