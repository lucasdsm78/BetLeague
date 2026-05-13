from typing import Optional
from pydantic import BaseModel, Field, field_validator

from domain.tournament.model.tournament import Tournament

TOURNAMENT_NAME_REGEX = r"[A-Za-z0-9\s\-_éèêàâôûùçÉÈÊÀÂÔÛÙÇ]+"

class TournamentCreateModel(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    is_private: bool
    max_players: int = Field(Tournament.DEFAULT_BRACKET_SIZE)
    start_date: Optional[int] = None

    @field_validator('name')
    @classmethod
    def _normalize_and_validate_name(cls, v: str) -> str:
        n = (v or '').strip()
        n = ' '.join(n.split())
        import re
        if not re.fullmatch(TOURNAMENT_NAME_REGEX, n):
            raise ValueError('Le nom contient des caractères invalides')
        return n

    @field_validator('max_players')
    @classmethod
    def _validate_max_players(cls, v: int) -> int:
        return Tournament.validate_max_players(v)

    @field_validator('start_date')
    @classmethod
    def _validate_ms_timestamp(cls, v: Optional[int]):
        if v is None:
            return v
        if not isinstance(v, int):
            raise ValueError('La date doit être un timestamp en millisecondes')
        if v < 0:
            raise ValueError('La date doit être positive')
        if v < 10_000_000_000:
            raise ValueError('La date doit être exprimée en millisecondes')
        return v

class TournamentCreateResponse(BaseModel):
    message: str = "Tournoi créé avec succès."
    tournament_id: Optional[int] = None
    tournament_uuid: Optional[str] = None
    name: Optional[str] = None
    max_players: int = Tournament.DEFAULT_BRACKET_SIZE
    monthly_free_tournaments_limit: int = 2
    monthly_free_tournaments_used: int = 0
    monthly_free_tournaments_remaining: int = 2
    can_create_tournament: bool = True
    requires_tournament_subscription: bool = False

class TournamentJoinResponse(BaseModel):
    message: str = "Inscription au tournoi effectuée avec succès."

class TournamentStartResponse(BaseModel):
    message: str = "Le tournoi a bien démarré."

class TournamentUpdateModel(BaseModel):
    name: Optional[str]
    is_private: Optional[bool] = None
    start_date: Optional[int] = None
    end_date: Optional[int] = None

class TournamentUpdateResponse(BaseModel):
    message: str = "Le tournoi a bien été mis à jour."

class SchedulerSuccessfulyRunResponse(BaseModel):
    message: str = "Le scheduler a bien été exécuté."

class TournamentPlayerDeletedResponse(BaseModel):
    message: str = "Le joueur a bien été retiré du tournoi."

class TournamentInviteResponse(BaseModel):
    message: str = "L'utilisateur a bien été invité à rejoindre ce tournoi."

class InvitationUpdateResponse(BaseModel):
    message: str = "L'invitation a bien été mise à jour."

class InvitationDeleteResponse(BaseModel):
    message: str = "L'invitation a bien été supprimée."
