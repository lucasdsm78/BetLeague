from abc import abstractmethod, ABC
import logging
from typing import Any, Callable, Mapping

from domain.services.stripe.stripe_service import StripeService
from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionNotFoundError
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.tournament_subscription.unit_of_work import TournamentSubscriptionUnitOfWork


logger = logging.getLogger(__name__)


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

    @classmethod
    def _event_extra(cls, event_type: str, payload: Any, **extra: Any) -> dict[str, Any]:
        payload_mapping = cls._as_mapping(payload)
        metadata = cls._safe_get(payload_mapping, "metadata", {})
        base = {
            "stripe_event_type": event_type,
            "stripe_object_id": cls._safe_get(payload_mapping, "id"),
            "subscription_uuid": cls._safe_get(metadata, "uuid"),
            "stripe_subscription_id": cls._safe_get(payload_mapping, "subscription") or cls._safe_get(payload_mapping, "id"),
        }
        base.update(extra)
        return {key: value for key, value in base.items() if value is not None}

    async def execute(self, event_type: str, event_data: dict) -> None:
        logger.info("tournament.subscription.webhook.received", extra=self._event_extra(event_type, event_data))
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
                logger.info("tournament.subscription.webhook.ignored", extra=self._event_extra(event_type, event_data, reason="unsupported_event_type"))
                return

            await uow.commit()
            logger.info("tournament.subscription.webhook.processed", extra=self._event_extra(event_type, event_data))

    async def _handle_checkout_session_completed(self, uow: TournamentSubscriptionUnitOfWork, session_data: dict) -> None:
        session_payload = await self._load_checkout_session_if_needed(session_data)
        if self._safe_get(session_payload, "mode") != "subscription":
            logger.info(
                "tournament.subscription.webhook.ignored",
                extra=self._event_extra("checkout.session.completed", session_payload, reason="non_subscription_mode"),
            )
            return

        uuid = self._safe_get(session_payload, "client_reference_id")
        if not uuid:
            metadata = self._safe_get(session_payload, "metadata", {})
            uuid = self._safe_get(metadata, "uuid")
        if not uuid:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("checkout.session.completed", session_payload, reason="missing_uuid"),
            )
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_uuid(uuid)
        except TournamentSubscriptionNotFoundError:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("checkout.session.completed", session_payload, subscription_uuid=uuid, reason="subscription_not_found"),
            )
            return

        if not subscription:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("checkout.session.completed", session_payload, subscription_uuid=uuid, reason="subscription_missing"),
            )
            return

        stripe_subscription_id = self._safe_get(session_payload, "subscription")
        if stripe_subscription_id:
            subscription.update_stripe_subscription_id_from_stripe(stripe_subscription_id)
            await uow.tournament_subscription_repo.update(subscription)
            logger.info(
                "tournament.subscription.checkout.completed",
                extra=self._event_extra(
                    "checkout.session.completed",
                    session_payload,
                    subscription_uuid=subscription.uuid,
                    user_id=subscription.user.id,
                    stripe_subscription_id=stripe_subscription_id,
                ),
            )

    async def _handle_subscription_created(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        subscription_payload = await self._load_subscription_if_needed(subscription_data)
        metadata = self._safe_get(subscription_payload, "metadata", {})
        stripe_subscription_id = self._safe_get(subscription_payload, "id")

        if not stripe_subscription_id:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.created", subscription_payload, reason="missing_subscription_id"),
            )
            return

        uuid = self._safe_get(metadata, "uuid")
        if not uuid:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.created", subscription_payload, reason="missing_uuid"),
            )
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_uuid(uuid)
        except TournamentSubscriptionNotFoundError:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.created", subscription_payload, subscription_uuid=uuid, reason="subscription_not_found"),
            )
            return

        if not subscription:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.created", subscription_payload, subscription_uuid=uuid, reason="subscription_missing"),
            )
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
        logger.info(
            "tournament.subscription.activated",
            extra=self._event_extra(
                "customer.subscription.created",
                subscription_payload,
                subscription_uuid=subscription.uuid,
                user_id=subscription.user.id,
                status=subscription.status.value,
                current_period_start=subscription.current_period_start,
                current_period_end=subscription.current_period_end,
            ),
        )

    async def _handle_subscription_updated(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        stripe_subscription_id = self._safe_get(subscription_data, "id")
        if not stripe_subscription_id:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.updated", subscription_data, reason="missing_subscription_id"),
            )
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
        except TournamentSubscriptionNotFoundError:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.updated", subscription_data, stripe_subscription_id=stripe_subscription_id, reason="subscription_not_found"),
            )
            return

        if not subscription:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.updated", subscription_data, stripe_subscription_id=stripe_subscription_id, reason="subscription_missing"),
            )
            return

        period_start, period_end = self._extract_subscription_period_bounds(subscription_data)
        subscription.update_status_from_stripe(
            status=self._safe_get(subscription_data, "status", TournamentSubscriptionStatus.INCOMPLETE.value),
            period_start=period_start,
            period_end=period_end,
            cancel_at_period_end=self._safe_get(subscription_data, "cancel_at_period_end"),
        )
        await uow.tournament_subscription_repo.update(subscription)
        logger.info(
            "tournament.subscription.updated",
            extra=self._event_extra(
                "customer.subscription.updated",
                subscription_data,
                subscription_uuid=subscription.uuid,
                user_id=subscription.user.id,
                status=subscription.status.value,
                cancel_at_period_end=subscription.cancel_at_period_end,
                current_period_start=subscription.current_period_start,
                current_period_end=subscription.current_period_end,
            ),
        )

    async def _handle_subscription_deleted(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        stripe_subscription_id = self._safe_get(subscription_data, "id")
        if not stripe_subscription_id:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.deleted", subscription_data, reason="missing_subscription_id"),
            )
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_stripe_subscription_id(stripe_subscription_id)
        except TournamentSubscriptionNotFoundError:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.deleted", subscription_data, stripe_subscription_id=stripe_subscription_id, reason="subscription_not_found"),
            )
            return

        if not subscription:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("customer.subscription.deleted", subscription_data, stripe_subscription_id=stripe_subscription_id, reason="subscription_missing"),
            )
            return

        user = await uow.user_repo.find_by_id(subscription.user.id)
        if user:
            user.is_tournament_subscriber = False
            await uow.user_repo.update(user)

        subscription.cancel()
        await uow.tournament_subscription_repo.update(subscription)
        logger.info(
            "tournament.subscription.deleted",
            extra=self._event_extra(
                "customer.subscription.deleted",
                subscription_data,
                subscription_uuid=subscription.uuid,
                user_id=subscription.user.id,
                status=subscription.status.value,
            ),
        )

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
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("invoice.payment_succeeded", invoice_data, reason="missing_subscription_id"),
            )
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
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("invoice.payment_succeeded", invoice_data, stripe_subscription_id=subscription_id, reason="subscription_not_found"),
            )
            return

        if not subscription:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("invoice.payment_succeeded", invoice_data, stripe_subscription_id=subscription_id, reason="subscription_missing"),
            )
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
        logger.info(
            "tournament.subscription.payment_succeeded",
            extra=self._event_extra(
                "invoice.payment_succeeded",
                invoice_data,
                subscription_uuid=subscription.uuid,
                user_id=subscription.user.id,
                stripe_subscription_id=subscription_id,
                status=subscription.status.value,
                current_period_start=subscription.current_period_start,
                current_period_end=subscription.current_period_end,
            ),
        )

    async def _handle_payment_failed(self, uow: TournamentSubscriptionUnitOfWork, invoice_data: dict) -> None:
        subscription_id = self._safe_get(invoice_data, "subscription")
        if not subscription_id:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("invoice.payment_failed", invoice_data, reason="missing_subscription_id"),
            )
            return

        try:
            subscription = await uow.tournament_subscription_repo.find_by_stripe_subscription_id(subscription_id)
        except TournamentSubscriptionNotFoundError:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("invoice.payment_failed", invoice_data, stripe_subscription_id=subscription_id, reason="subscription_not_found"),
            )
            return

        if subscription:
            subscription.update_status_from_stripe(
                status=TournamentSubscriptionStatus.PAST_DUE.value,
                period_start=subscription.current_period_start,
                period_end=subscription.current_period_end,
            )
            await uow.tournament_subscription_repo.update(subscription)
            logger.warning(
                "tournament.subscription.payment_failed",
                extra=self._event_extra(
                    "invoice.payment_failed",
                    invoice_data,
                    subscription_uuid=subscription.uuid,
                    user_id=subscription.user.id,
                    stripe_subscription_id=subscription_id,
                    status=subscription.status.value,
                ),
            )
        else:
            logger.warning(
                "tournament.subscription.webhook.rejected",
                extra=self._event_extra("invoice.payment_failed", invoice_data, stripe_subscription_id=subscription_id, reason="subscription_missing"),
            )

