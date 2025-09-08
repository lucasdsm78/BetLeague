from enum import Enum
from dataclasses import dataclass

from domain.purchase.exception.purchase_exception import InvalidPlatformException, InvalidPurchaseStatusException


@dataclass(init=False, eq=True, frozen=True)
class PurchaseStatus(Enum):
    failed = 'FAILED'
    pending = 'PENDING'
    succeeded = 'SUCCEEDED'

    @classmethod
    def from_str(cls, status: str) -> "PurchaseStatus":
        try:
            return cls(status)
        except ValueError:
            raise InvalidPurchaseStatusException(status) from None
