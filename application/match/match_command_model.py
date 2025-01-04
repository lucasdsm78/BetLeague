from pydantic import BaseModel


class MatchScoreUpdatedResponse(BaseModel):
    message: str = "The match score is well updated"


class NoMatchScoreUpdatedResponse(BaseModel):
    message: str = "No score was updated"


class MatchChoiceUpdatedResponse(BaseModel):
    message: str = "The match choice is well updated"


class NoMatchChoiceUpdatedResponse(BaseModel):
    message: str = "No match choice was updated"
