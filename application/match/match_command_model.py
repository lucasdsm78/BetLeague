from pydantic import BaseModel

class MatchChoiceUpdatedResponse(BaseModel):
    message: str = "The match choice is well updated"


class NoMatchChoiceUpdatedResponse(BaseModel):
    message: str = "No match choice was updated"
