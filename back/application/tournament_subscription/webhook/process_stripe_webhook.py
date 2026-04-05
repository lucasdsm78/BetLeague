from abc import abstractmethod, ABC
from typing import Any, Callable, Mapping

from domain.services.stripe.stripe_service import StripeService
from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionNotFoundError
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.tournament_subscription.unit_of_work import TournamentSubscriptionUnitOfWork


class ProcessStripeWebhookTournamentSubscriptionUseCase(ABC):

    @abstractmethod
    async def execute(self, event_type: str, event_data: dict) -> None:
        raise NotImplementedError


class ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(ProcessStripeWebhookTournamentSubscriptionUseCase):
    def __init__(
            self,
            uow_factory: Callable[[], TournamentSubscriptionUnitOfWork],
            stripe_service: StripeService | None = None,
    ):
        self._uow_factory = uow_factory
        self._stripe_service = stripe_service

    @staticmethod
    def _as_mapping(value: Any) -> Mapping[str, Any]:
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        to_dict_recursive = getattr(value, "to_dict_recursive", None)
        if callable(to_dict_recursive):
            converted = to_dict_recursive()
            if isinstance(converted, dict):
                return converted
        items = getattr(value, "items", None)
        if callable(items):
            try:
                return dict(items())
            except Exception:
                return {}
        return {}

    @classmethod
    def _safe_get(cls, value: Any, key: str, default: Any = None) -> Any:
        return cls._as_mapping(value).get(key, default)

    async def _load_checkout_session_if_needed(self, session_data: Any) -> Mapping[str, Any]:
        payload = self._as_mapping(session_data)
        if self._safe_get(payload, "subscription"):
            return payload
        if self._stripe_service is None:
            return payload

        session_id = self._safe_get(payload, "id")
        if not session_id:
            return payload

        try:
            return self._as_mapping(await self._stripe_service.retrieve_checkout_session(session_id))
        except ValueError:
            return payload

    async def _load_subscription_if_needed(self, subscription_data: Any) -> Mapping[str, Any]:
        payload = self._as_mapping(subscription_data)
        has_uuid = bool(self._safe_get(self._safe_get(payload, "metadata", {}), "uuid"))
        has_periods = any([
            self._safe_get(payload, "current_period_start"),
            self._safe_get(payload, "current_period_end"),
            self._safe_get(payload, "period_start"),
            self._safe_get(payload, "period_end"),
        ])
        if has_uuid and has_periods:
            return payload
        if self._stripe_service is None:
            return payload

        subscription_id = self._safe_get(payload, "id")
        if not subscription_id:
            return payload

        try:
            return self._as_mapping(await self._stripe_service.retrieve_subscription(subscription_id))
        except ValueError:
            return payload

    @staticmethod
    def _extract_subscription_period_bounds(subscription_data: Any) -> tuple[int | None, int | None]:
        period_start = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(subscription_data, "current_period_start") or ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(subscription_data, "period_start")
        period_end = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(subscription_data, "current_period_end") or ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(subscription_data, "period_end")

        if period_start and period_end:
            return period_start * 1000, period_end * 1000

        items = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(subscription_data, "items", {})
        items_data = ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(items, "data", [])
        if items_data:
            first_item = items_data[0]
            return (
                ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(first_item, "current_period_start") * 1000 if ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(first_item, "current_period_start") else None,
                ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(first_item, "current_period_end") * 1000 if ProcessStripeWebhookTournamentSubscriptionUseCaseImpl._safe_get(first_item, "current_period_end") else None,
            )

        return None, None

    async def execute(self, event_type: str, event_data: dict) -> None:
        async with self._uow_factory() as uow:
            if event_type == "checkout.session.completed":
                await self._handle_checkout_session_completed(uow, event_data)
            elif event_type == "customer.subscription.created":
                await self._handle_subscription_created(uow, event_data)
            elif event_type == "customer.subscription.updated":
                await self._handle_subscription_updated(uow, event_data)
            elif event_type == "customer.subscription.deleted":
                await self._handle_subscription_deleted(uow, event_data)
            elif event_type == "invoice.payment_succeeded":
                await self._handle_payment_succeeded(uow, event_data)
            elif event_type == "invoice.payment_failed":
                await self._handle_payment_failed(uow, event_data)
            else:
                return

            await uow.commit()

    async def _handle_checkout_session_completed(self, uow: TournamentSubscriptionUnitOfWork, session_data: dict) -> None:
        session_payload = await self._load_checkout_session_if_needed(session_data)
        if self._safe_get(session_payload, "mode") != "subscription":
            return

        uuid = self._safe_get(session_payload, "client_reference_id")
        if not uuid:
            metadata = self._safe_get(session_payload, "metadata", {})
            uuid = self._safe_get(metadata, "uuid")
        if not uuid:
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_uuid(uuid)
        except TournamentSubscriptionNotFoundError:
            return

        if not subscription:
            return

        stripe_subscription_id = self._safe_get(session_payload, "subscription")
        if stripe_subscription_id:
            subscription.update_stripe_subscription_id_from_stripe(stripe_subscription_id)
            await uow.tournament_subscription_repo.update(subscription)

    async def _handle_subscription_created(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        subscription_payload = await self._load_subscription_if_needed(subscription_data)
        metadata = self._safe_get(subscription_payload, "metadata", {})
        stripe_subscription_id = self._safe_get(subscription_payload, "id")

        if not stripe_subscription_id:
            return

        uuid = self._safe_get(metadata, "uuid")
        if not uuid:
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_uuid(uuid)
        except TournamentSubscriptionNotFoundError:
            return

        if not subscription:
            return

        user = await uow.user_repo.find_by_id(subscription.user.id)
        if user:
            user.is_tournament_subscriber = True
            await uow.user_repo.update(user)

        period_start, period_end = self._extract_subscription_period_bounds(subscription_payload)
        subscription.update_status_from_stripe(
            status=self._safe_get(subscription_payload, "status", "incomplete"),
            period_start=period_start,
            period_end=period_end,
            cancel_at_period_end=self._safe_get(subscription_payload, "cancel_at_period_end"),
        )
        subscription.update_stripe_subscription_id_from_stripe(stripe_subscription_id)
        await uow.tournament_subscription_repo.update(subscription)

    async def _handle_subscription_updated(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        stripe_subscription_id = self._safe_get(subscription_data, "id")
        if not stripe_subscription_id:
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
        except TournamentSubscriptionNotFoundError:
            return

        if not subscription:
            return

        period_start, period_end = self._extract_subscription_period_bounds(subscription_data)
        subscription.update_status_from_stripe(
            status=self._safe_get(subscription_data, "status", TournamentSubscriptionStatus.INCOMPLETE.value),
            period_start=period_start,
            period_end=period_end,
            cancel_at_period_end=self._safe_get(subscription_data, "cancel_at_period_end"),
        )
        await uow.tournament_subscription_repo.update(subscription)

    async def _handle_subscription_deleted(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        stripe_subscription_id = self._safe_get(subscription_data, "id")
        if not stripe_subscription_id:
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
        except TournamentSubscriptionNotFoundError:
            return

        if not subscription:
            return

        user = await uow.user_repo.find_by_id(subscription.user.id)
        if user:
            user.is_tournament_subscriber = False
            await uow.user_repo.update(user)

        subscription.cancel()
        await uow.tournament_subscription_repo.update(subscription)

    async def _handle_payment_succeeded(self, uow: TournamentSubscriptionUnitOfWork, invoice_data: dict) -> None:
        subscription_id = self._safe_get(invoice_data, "subscription")

        if not subscription_id:
            parent = self._safe_get(invoice_data, "parent", {})
            if self._safe_get(parent, "type") == "subscription_details":
                subscription_details = self._safe_get(parent, "subscription_details", {})
                subscription_id = self._safe_get(subscription_details, "subscription")

        if not subscription_id:
            lines = self._safe_get(invoice_data, "lines", {})
            lines_data = self._safe_get(lines, "data", [])
            if lines_data:
                first_line = lines_data[0]
                line_parent = self._safe_get(first_line, "parent", {})
                if self._safe_get(line_parent, "type") == "subscription_item_details":
                    sub_item_details = self._safe_get(line_parent, "subscription_item_details", {})
                    subscription_id = self._safe_get(sub_item_details, "subscription")

        if not subscription_id:
            return

        period_start = None
        period_end = None
        lines = self._safe_get(invoice_data, "lines", {})
        lines_data = self._safe_get(lines, "data", [])
        if lines_data:
            first_line = lines_data[0]
            period = self._safe_get(first_line, "period", {})
            period_start = self._safe_get(period, "start")
            period_end = self._safe_get(period, "end")

        try:
            subscription = await uow.tournament_subscription_repo.find_by_stripe_subscription_id(subscription_id)
        except TournamentSubscriptionNotFoundError:
            return

        if not subscription:
            return

        user = await uow.user_repo.find_by_id(subscription.user.id)
        if user:
            user.is_tournament_subscriber = True
            await uow.user_repo.update(user)

        period_start_ms = period_start * 1000 if period_start else None
        period_end_ms = period_end * 1000 if period_end else None
        if (period_start_ms is None or period_end_ms is None) and self._stripe_service is not None:
            try:
                subscription_payload = await self._stripe_service.retrieve_subscription(subscription_id)
            except ValueError:
                subscription_payload = None
            if subscription_payload is not None:
                period_start_ms, period_end_ms = self._extract_subscription_period_bounds(subscription_payload)

        subscription.update_status_from_stripe(
            status=TournamentSubscriptionStatus.ACTIVE.value,
            period_start=period_start_ms,
            period_end=period_end_ms,
        )
        await uow.tournament_subscription_repo.update(subscription)

    async def _handle_payment_failed(self, uow: TournamentSubscriptionUnitOfWork, invoice_data: dict) -> None:
        subscription_id = self._safe_get(invoice_data, "subscription")
        if not subscription_id:
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_stripe_subscription_id(subscription_id)
        except TournamentSubscriptionNotFoundError:
            return

        if subscription:
            subscription.update_status_from_stripe(
                status=TournamentSubscriptionStatus.PAST_DUE.value,
                period_start=subscription.current_period_start,
                period_end=subscription.current_period_end,
            )
            await uow.tournament_subscription_repo.update(subscription)

