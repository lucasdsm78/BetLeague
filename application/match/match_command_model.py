from pydantic import BaseModel


class MatchScoreUpdatedResponse(BaseModel):
    message: str = "The match score is well updated"


class NoMatchScoreUpdatedResponse(BaseModel):
    message: str = "No score was updated"
