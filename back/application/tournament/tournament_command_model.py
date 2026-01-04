from typing import Optional
from pydantic import BaseModel, Field, field_validator

TOURNAMENT_NAME_REGEX = r"[A-Za-z0-9\s\-_éèêàâôûùçÉÈÊÀÂÔÛÙÇ]+"

class TournamentCreateModel(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    is_private: bool
    max_players: int = Field(16, ge=16, le=16)

    @field_validator('name')
    @classmethod
    def _normalize_and_validate_name(cls, v: str) -> str:
        n = (v or '').strip()
        n = ' '.join(n.split())
        import re
        if not re.fullmatch(TOURNAMENT_NAME_REGEX, n):
            raise ValueError('Le nom contient des caractères invalides')
        return n

class TournamentCreateResponse(BaseModel):
    message: str = "Tournament created successfully"
    tournament_id: Optional[int] = None
    tournament_uuid: Optional[str] = None
    name: Optional[str] = None

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

class SchedulerSuccessfulyRunResponse(BaseModel):
    message: str = "Scheduler run successfully"
