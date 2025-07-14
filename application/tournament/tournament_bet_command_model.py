from pydantic import BaseModel


class TournamentBetCreateModel(BaseModel):
    amount: float
    choice: str


class TournamentBetCreateResponse(BaseModel):
    message: str = "Bet placed successfully"
