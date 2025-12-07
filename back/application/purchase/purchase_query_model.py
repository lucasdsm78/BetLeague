from typing import List, Optional
from pydantic import BaseModel


class PackResponse(BaseModel):
    id: int
    name: str
    price_cents: int
    nb_btl: float
    bonus: float
    total_btl: float
    price_per_100: float
    note: Optional[str] = None
    created_at: Optional[int] = None

    class Config:
        from_attributes = True


class PacksListResponse(BaseModel):
    packs: List[PackResponse]
