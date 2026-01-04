from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class LeagueCreateModel(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    max_players: int = Field(..., ge=2, le=200)
    is_private: bool
    is_free: bool = True
    nb_btl: Optional[int] = None

    @field_validator('name')
    @classmethod
    def _normalize_name(cls, v: str) -> str:
        n = (v or '').strip()
        n = ' '.join(n.split())
        import re
        if not re.fullmatch(r"[A-Za-z0-9\s\-_.]+", n):
            raise ValueError('Nom invalide (caractères non autorisés)')
        return n

    @model_validator(mode='after')
    def _validate_paid_rules(self):
        if self.is_free is False:
            if self.nb_btl is None or self.nb_btl <= 0:
                raise ValueError('nb_btl requis et > 0 pour une ligue payante')
        else:
            if self.nb_btl is not None and self.nb_btl != 0:
                raise ValueError('nb_btl doit être null/0 pour une ligue gratuite')
        return self


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


class LeagueInjectBtlModel(BaseModel):
    amount: float


class LeagueInjectBtlResponse(BaseModel):
    message: str = "BTL successfully injected"
