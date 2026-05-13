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
    message: str = "Ticket créé avec succès."
    ticket_id: Optional[int] = None


class TicketUpdateResponse(BaseModel):
    message: str = "Ticket mis à jour avec succès."


class TicketRemoveResponse(BaseModel):
    message: str = "Ticket supprimé avec succès."


class TicketUpdatedResponse(BaseModel):
    message: str = "Ticket mis à jour avec succès."


class NoTicketUpdatedResponse(BaseModel):
    message: str = "Aucun ticket n'a été mis à jour."
