from pydantic import BaseModel

class MatchChoiceUpdatedResponse(BaseModel):
    message: str = "Le choix du match a bien été mis à jour."


class NoMatchChoiceUpdatedResponse(BaseModel):
    message: str = "Aucun choix de match n'a été mis à jour."


class MatchScoreUpdatedResponse(BaseModel):
    message: str = "Le score du match a bien été mis à jour."


class NoMatchScoreUpdatedResponse(BaseModel):
    message: str = "Aucun score n'a été mis à jour."
