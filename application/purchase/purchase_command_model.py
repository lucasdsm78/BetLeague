from typing import Optional

from pydantic import BaseModel


class PurchaseCreateModel(BaseModel):
    pack_id: int


class PurchaseCreateResponse(BaseModel):
    message: str = "The purchase is well created"
