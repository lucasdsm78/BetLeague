from abc import abstractmethod, ABC
from typing import Callable

from sqlalchemy.ext.asyncio.session import AsyncSession

from domain.tournament_subscription.repository.tournament_subscription_repository import \
    TournamentSubscriptionRepository
from infrastructure.postgresql.tournament_subscription.tournament_subscription_repository import \
    TournamentSubscriptionRepositoryImpl


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
                subscription_id = metadata.get("subscription_id")
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)

                if not subscription_id:
                    return

                subscription = await tournament_subscription_repository.find_by_id(subscription_id)
                if not subscription:
                    return

                subscription.update_status_from_stripe(
                    status=subscription_data["status"],
                    period_start=subscription_data["period_start"],
                    period_end=subscription_data["period_end"]
                )

                await tournament_subscription_repository.update(subscription)

    async def _handle_subscription_updated(self, subscription_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(subscription_data["id"])

                if not subscription:
                    return

                subscription.update_status_from_stripe(
                    status=subscription_data["status"],
                    period_start=subscription_data["period_start"],
                    period_end=subscription_data["period_end"]
                )

                await tournament_subscription_repository.update(subscription)

    async def _handle_subscription_deleted(self, subscription_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                stripe_subscription_id = subscription_data["id"]
                subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(stripe_subscription_id)

                if subscription:
                    subscription.cancel()
                    await tournament_subscription_repository.update(subscription)

    async def _handle_payment_succeeded(self, invoice_data: dict) -> None:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)
                subscription_id = invoice_data.get("subscription")
                if not subscription_id:
                    return

                subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(subscription_id)

                if subscription:
                    subscription.activate(
                        period_start=invoice_data["period_start"],
                        period_end=invoice_data["period_end"]
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
