from typing import Optional

from domain.purchase.model.pack_summary import PackSummary
from domain.purchase.model.purchase_status import PurchaseStatus
from domain.user.model.user_summary import UserSummary


class Purchase:
    def __init__(
            self,
            uuid: str,
            pack: PackSummary,
            user: UserSummary,
            status: PurchaseStatus,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            stripe_session_id: str | None = None
    ):
        self.id: Optional[int] = id
        self.uuid: str = uuid
        self.pack: PackSummary = pack
        self.status: PurchaseStatus = status
        self.user: UserSummary = user
        self.created_at: Optional[int] = created_at
        self.stripe_session_id: Optional[str] = stripe_session_id
