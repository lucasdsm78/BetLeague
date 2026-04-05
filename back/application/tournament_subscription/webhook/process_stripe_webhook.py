from abc import abstractmethod, ABC
from typing import Callable

from sqlalchemy.ext.asyncio.session import AsyncSession

from domain.tournament_subscription.exception.tournament_subscription_exception import TournamentSubscriptionNotFoundError
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from infrastructure.postgresql.tournament_subscription.tournament_subscription_repository import \
    TournamentSubscriptionRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class ProcessStripeWebhookTournamentSubscriptionUseCase(ABC):

    @abstractmethod
    async def execute(self, event_type: str, event_data: dict) -> None:
        raise NotImplementedError


class ProcessStripeWebhookTournamentSubscriptionUseCaseImpl(ProcessStripeWebhookTournamentSubscriptionUseCase):
    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory


    async def execute(self, event_type: str, event_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                if event_type == "customer.subscription.created":
                    await self._handle_subscription_created(event_data)
                elif event_type == "customer.subscription.updated":
                    await self._handle_subscription_updated(event_data)
                elif event_type == "customer.subscription.deleted":
                    await self._handle_subscription_deleted(event_data)
                elif event_type == "invoice.payment_succeeded":
                    await self._handle_payment_succeeded(event_data)
                elif event_type == "invoice.payment_failed":
                    await self._handle_payment_failed(event_data)

    async def _handle_subscription_created(self, subscription_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                metadata = subscription_data.get("metadata", {})
                stripe_subscription_id = subscription_data.get("id")
                items = subscription_data.get("items", {})
                items_data = items.get("data", [])
                first_item = items_data[0]

                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                user_repository = UserRepositoryImpl(session=session)

                if not stripe_subscription_id:
                    return

                uuid = metadata.get("uuid")
                if not uuid:
                    return

                subscription = await tournament_subscription_repository.find_by_uuid(uuid)

                if not subscription:
                    return

                user = await user_repository.find_by_id(subscription.user.id)
                if user:
                    user.is_tournament_subscriber = True
                    await user_repository.update(user)

                period_start = first_item.get("current_period_start")
                period_end = first_item.get("current_period_end")

                subscription.update_status_from_stripe(
                    status=subscription_data["status"],
                    period_start=period_start * 1000 if period_start else None,
                    period_end=period_end * 1000 if period_end else None
                )

                subscription.update_stripe_subscription_id_from_stripe(stripe_subscription_id)

                await tournament_subscription_repository.update(subscription)

    async def _handle_subscription_updated(self, subscription_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(subscription_data["id"])

                if not subscription:
                    return

                period_start = subscription_data.get("period_start")
                period_end = subscription_data.get("period_end")

                subscription.update_status_from_stripe(
                    status=subscription_data["status"],
                    period_start=period_start * 1000 if period_start else None,
                    period_end=period_end * 1000 if period_end else None
                )

                await tournament_subscription_repository.update(subscription)

    async def _handle_subscription_deleted(self, subscription_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                user_repository = UserRepositoryImpl(session=session)

                stripe_subscription_id = subscription_data.get("id")
                if not stripe_subscription_id:
                    return

                try:
                    subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(stripe_subscription_id)
                except TournamentSubscriptionNotFoundError:
                    return

                if not subscription:
                    return

                user = await user_repository.find_by_id(subscription.user.id)

                if user:
                    user.is_tournament_subscriber = False
                    await user_repository.update(user)

                subscription.cancel()
                await tournament_subscription_repository.update(subscription)

    async def _handle_payment_succeeded(self, invoice_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)

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

                if lines_data and len(lines_data) > 0:
                    first_line = lines_data[0]
                    period = first_line.get("period", {})

                    period_start = period.get("start")
                    period_end = period.get("end")

                subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(subscription_id)

                if not subscription:
                    return

                # Convert Stripe timestamps (seconds) to milliseconds
                period_start_ms = period_start * 1000 if period_start else None
                period_end_ms = period_end * 1000 if period_end else None

                try:
                    subscription.update_status_from_stripe(
                        status="active",
                        period_start=period_start_ms,
                        period_end=period_end_ms
                    )

                except Exception:
                    subscription.update_status_from_stripe(
                        status=TournamentSubscriptionStatus.ACTIVE.value,
                        period_start=period_start_ms,
                        period_end=period_end_ms
                    )

                await tournament_subscription_repository.update(subscription)


    async def _handle_payment_failed(self, invoice_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                subscription_id = invoice_data.get("subscription")
                if not subscription_id:
                    return

                subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(subscription_id)

                if subscription:
                    subscription.update_status_from_stripe(
                        status="past_due",
                        period_start=subscription.current_period_start,
                        period_end=subscription.current_period_end
                    )
                    await tournament_subscription_repository.update(subscription)
