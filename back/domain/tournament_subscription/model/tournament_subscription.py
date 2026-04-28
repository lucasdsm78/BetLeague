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
            cancel_at_period_end: bool = False,
            cancellation_requested_at: Optional[int] = None,
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
        self._cancel_at_period_end = cancel_at_period_end
        self._cancellation_requested_at = cancellation_requested_at

    @staticmethod
    def _now_ms() -> int:
        return int(datetime.utcnow().timestamp() * 1000)

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

    @property
    def cancel_at_period_end(self) -> bool:
        return self._cancel_at_period_end

    @property
    def cancellation_requested_at(self) -> Optional[int]:
        return self._cancellation_requested_at

    def _calculate_period_end(self) -> int:
        if self._current_period_start is None:
            raise ValueError("Current period start is not set.")
        # Return ms duration according to plan
        day_ms = 24 * 60 * 60 * 1000
        if self._plan == TournamentSubscriptionPlan.MONTHLY:
            return self._current_period_start + 30 * day_ms
        elif self._plan == TournamentSubscriptionPlan.YEARLY:
            return self._current_period_start + 365 * day_ms
        else:
            raise ValueError(f"Unknown plan: {self._plan}")

    def activate(self, period_start: int, period_end: int) -> None:
        if self._status == TournamentSubscriptionStatus.ACTIVE:
            self._cancel_at_period_end = False
            self._cancellation_requested_at = None
            return

        self._status = TournamentSubscriptionStatus.ACTIVE
        self._current_period_start = period_start
        self._current_period_end = period_end
        self._cancel_at_period_end = False
        self._cancellation_requested_at = None
        self._updated_at = self._now_ms()

    def schedule_cancellation_at_period_end(self, requested_at: Optional[int] = None) -> None:
        if self._status == TournamentSubscriptionStatus.CANCELLED:
            raise ValueError("L'abonnement tournoi est déjà terminé")

        if self._cancel_at_period_end:
            return

        self._cancel_at_period_end = True
        self._cancellation_requested_at = requested_at or self._now_ms()
        self._updated_at = self._cancellation_requested_at

    def cancel(self, cancelled_at: Optional[int] = None) -> None:
        self._status = map_stripe_status_to_enum(TournamentSubscriptionStatus.CANCELLED.value)
        self._cancel_at_period_end = False
        self._updated_at = cancelled_at or self._now_ms()

    def update_status_from_stripe(
            self,
            status: str,
            period_start: int,
            period_end: int,
            cancel_at_period_end: Optional[bool] = None,
    ) -> None:
        mapped_status = map_stripe_status_to_enum(status)
        if mapped_status is not None:
            self._status = mapped_status


        if period_start is not None:
            self._current_period_start = period_start

        if period_end is not None:
            self._current_period_end = period_end

        if cancel_at_period_end is not None:
            self._cancel_at_period_end = cancel_at_period_end
            if cancel_at_period_end:
                self._cancellation_requested_at = self._cancellation_requested_at or self._now_ms()
            elif self._status != TournamentSubscriptionStatus.CANCELLED:
                self._cancellation_requested_at = None

        if self._status == TournamentSubscriptionStatus.CANCELLED:
            self._cancel_at_period_end = False

        self._updated_at = self._now_ms()

    def update_stripe_subscription_id_from_stripe(
                self,
                stripe_subscription_id: str
        ) -> None:
            self._stripe_subscription_id = stripe_subscription_id

    def is_active(self) -> bool:
        return (self._status == TournamentSubscriptionStatus.ACTIVE and
                self._current_period_end is not None and
                self._current_period_end > self._now_ms())
