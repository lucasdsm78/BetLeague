from enum import Enum

from domain.purchase.exception.purchase_exception import InvalidPlatformException, InvalidPurchaseStatusException


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
