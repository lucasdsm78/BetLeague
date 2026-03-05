from pydantic import BaseModel


class MatchOddSummary(BaseModel):
    bet_type: str
    bet_name: str

    class Config:
        arbitrary_types_allowed = True

