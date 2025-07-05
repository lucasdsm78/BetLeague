from typing import Optional
from pydantic import BaseModel

class TournamentCreateModel(BaseModel):
    name: str
    is_private: bool
    max_players: int

class TournamentCreateResponse(BaseModel):
    message: str = "Tournament created successfully"

class TournamentJoinResponse(BaseModel):
    message: str = "Joined tournament successfully"

class TournamentStartResponse(BaseModel):
    message: str = "Tournament start successfully"

class TournamentUpdateModel(BaseModel):
    name: Optional[str]
    is_private: Optional[bool] = None
    start_date: Optional[int] = None
    end_date: Optional[int] = None

class TournamentUpdateResponse(BaseModel):
    message: str = "Tournament updated successfully"
