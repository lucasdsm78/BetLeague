from abc import abstractmethod, ABC
from typing import Callable

from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionNotFoundError
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.tournament_subscription.unit_of_work import TournamentSubscriptionUnitOfWork


class ProcessStripeWebhookTournamentSubscriptionUseCase(ABC):

    @abstractmethod
    async def execute(self, event_type: str, event_data: dict) -> None:
        raise NotImplementedError


class ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(ProcessStripeWebhookTournamentSubscriptionUseCase):
    def __init__(self, uow_factory: Callable[[], TournamentSubscriptionUnitOfWork]):
        self._uow_factory = uow_factory

    @staticmethod
    def _extract_subscription_period_bounds(subscription_data: dict) -> tuple[int | None, int | None]:
        period_start = subscription_data.get("current_period_start") or subscription_data.get("period_start")
        period_end = subscription_data.get("current_period_end") or subscription_data.get("period_end")

        if period_start and period_end:
            return period_start * 1000, period_end * 1000

        items = subscription_data.get("items", {})
        items_data = items.get("data", [])
        if items_data:
            first_item = items_data[0]
            return (
                first_item.get("current_period_start") * 1000 if first_item.get("current_period_start") else None,
                first_item.get("current_period_end") * 1000 if first_item.get("current_period_end") else None,
            )

        return None, None

    async def execute(self, event_type: str, event_data: dict) -> None:
        async with self._uow_factory() as uow:
            if event_type == "customer.subscription.created":
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

    async def _handle_subscription_created(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        metadata = subscription_data.get("metadata", {})
        stripe_subscription_id = subscription_data.get("id")

        if not stripe_subscription_id:
            return

        uuid = metadata.get("uuid")
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

        period_start, period_end = self._extract_subscription_period_bounds(subscription_data)
        subscription.update_status_from_stripe(
            status=subscription_data["status"],
            period_start=period_start,
            period_end=period_end,
            cancel_at_period_end=subscription_data.get("cancel_at_period_end"),
        )
        subscription.update_stripe_subscription_id_from_stripe(stripe_subscription_id)
        await uow.tournament_subscription_repo.update(subscription)

    async def _handle_subscription_updated(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        stripe_subscription_id = subscription_data.get("id")
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
            status=subscription_data["status"],
            period_start=period_start,
            period_end=period_end,
            cancel_at_period_end=subscription_data.get("cancel_at_period_end"),
        )
        await uow.tournament_subscription_repo.update(subscription)

    async def _handle_subscription_deleted(self, uow: TournamentSubscriptionUnitOfWork, subscription_data: dict) -> None:
        stripe_subscription_id = subscription_data.get("id")
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
        subscription_id = None

        parent = invoice_data.get("parent", {})
        if parent.get("type") == "subscription_details":
            subscription_details = parent.get("subscription_details", {})
            subscription_id = subscription_details.get("subscription")

        if not subscription_id:
            lines = invoice_data.get("lines", {})
            lines_data = lines.get("data", [])
            if lines_data:
                first_line = lines_data[0]
                line_parent = first_line.get("parent", {})
                if line_parent.get("type") == "subscription_item_details":
                    sub_item_details = line_parent.get("subscription_item_details", {})
                    subscription_id = sub_item_details.get("subscription")

        if not subscription_id:
            return

        period_start = None
        period_end = None
        lines = invoice_data.get("lines", {})
        lines_data = lines.get("data", [])
        if lines_data:
            first_line = lines_data[0]
            period = first_line.get("period", {})
            period_start = period.get("start")
            period_end = period.get("end")

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
        subscription.update_status_from_stripe(
            status=TournamentSubscriptionStatus.ACTIVE.value,
            period_start=period_start_ms,
            period_end=period_end_ms,
        )
        await uow.tournament_subscription_repo.update(subscription)

    async def _handle_payment_failed(self, uow: TournamentSubscriptionUnitOfWork, invoice_data: dict) -> None:
        subscription_id = invoice_data.get("subscription")
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
