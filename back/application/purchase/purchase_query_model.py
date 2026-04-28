from typing import List, Optional, Literal
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


class PurchaseItemResponse(BaseModel):
    id: int
    uuid: str
    status: Literal["PENDING", "SUCCEEDED", "FAILED"]
    created_at: Optional[int] = None
    pack_id: int
    pack_name: str
    pack_price_cents: int
    pack_total_btl: float


class PacksListResponse(BaseModel):
    packs: List[PackResponse]


class PurchasesListResponse(BaseModel):
    purchases: List[PurchaseItemResponse]
