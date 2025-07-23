from datetime import datetime
from typing import Optional

from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.model.tournament_subscription_price import TournamentSubscriptionPrice
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus, \
    map_stripe_status_to_enum
from domain.user.model.user_summary import UserSummary


class TournamentSubscription:
    def __init__(
            self,
            uuid: str,
            user: UserSummary,
            plan: TournamentSubscriptionPlan,
            price: TournamentSubscriptionPrice,
            status: TournamentSubscriptionStatus = TournamentSubscriptionStatus.INCOMPLETE,
            current_period_start: Optional[int] = None,
            current_period_end: Optional[int] = None,
            created_at: Optional[int] = None,
            id: Optional[int] = None,
            stripe_subscription_id: Optional[str] = None,
            updated_at: Optional[int] = None,
    ):
        self._id = id
        self._user = user
        self._price = price
        self._plan = plan
        self._uuid = uuid
        self._stripe_subscription_id = stripe_subscription_id
        self._status = status
        self._current_period_start = current_period_start
        self._current_period_end = current_period_end
        self._created_at = created_at
        self._updated_at = updated_at

    @property
    def id(self) -> Optional[int]:
        return self._id

    @property
    def uuid(self) -> str:
        return self._uuid

    @property
    def user(self) -> UserSummary:
        return self._user

    @property
    def plan(self) -> TournamentSubscriptionPlan:
        return self._plan

    @property
    def price(self) -> "TournamentSubscriptionPrice":
        return self._price

    @property
    def status(self) -> TournamentSubscriptionStatus:
        return self._status

    @property
    def current_period_start(self) -> Optional[int]:
        return self._current_period_start

    @property
    def current_period_end(self) -> Optional[int]:
        return self._current_period_end

    @property
    def created_at(self) -> Optional[int]:
        return self._created_at

    @property
    def stripe_subscription_id(self) -> Optional[str]:
        return self._stripe_subscription_id

    @property
    def updated_at(self) -> Optional[int]:
        return self._updated_at

    def _calculate_period_end(self) -> int:
        if self._current_period_start is None:
            raise ValueError("Current period start is not set.")
        if self._plan == TournamentSubscriptionPlan.MONTHLY:
            return self._current_period_start + 30 * 24 * 60 * 60
        elif self._plan == TournamentSubscriptionPlan.YEARLY:
            return self._current_period_start + 365 * 24 * 60 * 60
        else:
            raise ValueError(f"Unknown plan: {self._plan}")

    def activate(self, period_start: int, period_end: int) -> None:
        if self._status == TournamentSubscriptionStatus.ACTIVE:
            return

        self._status = TournamentSubscriptionStatus.ACTIVE
        self._current_period_start = period_start
        self._current_period_end = period_end
        self._updated_at = int(datetime.now().timestamp())

    def cancel(self) -> None:
        if self._status in [TournamentSubscriptionStatus.CANCELLED, TournamentSubscriptionStatus.UNPAID]:
            return

        self._status = TournamentSubscriptionStatus.CANCELLED
        self._updated_at = int(datetime.now().timestamp())

    def update_status_from_stripe(
            self,
            status: str,
            period_start: int,
            period_end: int
    ) -> None:

        print(f"🔄 Mise à jour status depuis Stripe: '{status}'")

        old_status = self._status
        self._status = map_stripe_status_to_enum(status)

        print(f"📊 Changement status: {old_status} -> {self._status}")

        if period_start is not None:
            self._current_period_start = period_start

        if period_end is not None:
            self._current_period_end = period_end

        if hasattr(self, 'updated_at'):
            self._updated_at = datetime.utcnow()

        print(f"✅ Status mis à jour vers: {self._status}")

    def update_stripe_subscription_id_from_stripe(
                self,
                stripe_subscription_id: str
        ) -> None:
            self._stripe_subscription_id = stripe_subscription_id

    def is_active(self) -> bool:
        return (self._status == TournamentSubscriptionStatus.ACTIVE and
                self._current_period_end > int(datetime.now().timestamp()))
