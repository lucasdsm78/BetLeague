from pydantic import BaseModel

class LeagueSummary(BaseModel):

    id: int
    name: str

    class Config:
        arbitrary_types_allowed = True
