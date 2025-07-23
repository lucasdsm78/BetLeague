from abc import abstractmethod, ABC
from typing import Callable

from sqlalchemy.ext.asyncio.session import AsyncSession

from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
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
                stripe_subscription_id = subscription_data.get("id")
                items = subscription_data.get("items", {})
                items_data = items.get("data", [])
                first_item = items_data[0]

                tournament_subscription_repository = TournamentSubscriptionRepositoryImpl(session=session)

                if not stripe_subscription_id:
                    return

                uuid = metadata.get("uuid")
                if not uuid:
                    return

                print("dkkdkdkdkdkdk")

                subscription = await tournament_subscription_repository.find_by_uuid(uuid)

                print("fkfkfkfkfk")
                if not subscription:
                    return

                subscription.update_status_from_stripe(
                    status=subscription_data["status"],
                    period_start=first_item.get("current_period_start"),
                    period_end=first_item.get("current_period_end")
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

            # Extraction du subscription ID
            subscription_id = None

            # Méthode 1: Depuis parent.subscription_details.subscription
            parent = invoice_data.get("parent", {})
            if parent.get("type") == "subscription_details":
                subscription_details = parent.get("subscription_details", {})
                subscription_id = subscription_details.get("subscription")

            # Méthode 2: Fallback depuis lines[0].parent.subscription_item_details.subscription
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
                print("❌ Pas de subscription ID trouvé dans invoice")
                return

            print(f"💰 Paiement réussi pour subscription: {subscription_id}")
            print(f"🔍 Invoice ID: {invoice_data.get('id')}")
            print(f"🔍 Status: {invoice_data.get('status')}")
            print(f"🔍 Amount paid: {invoice_data.get('amount_paid')} centimes")

            # ✅ CORRECTION: Extraction des périodes depuis lines[0].period
            period_start = None
            period_end = None

            lines = invoice_data.get("lines", {})
            lines_data = lines.get("data", [])

            if lines_data and len(lines_data) > 0:
                first_line = lines_data[0]
                period = first_line.get("period", {})

                period_start = period.get("start")  # 1753309329
                period_end = period.get("end")      # 1784845329

                print(f"✅ Périodes extraites depuis lines[0].period:")
                print(f"  - start: {period_start}")
                print(f"  - end: {period_end}")

                # Debug des metadata dans la ligne
                line_metadata = first_line.get("metadata", {})
                print(f"  - line metadata: {line_metadata}")
            else:
                print("❌ Pas de lines trouvées dans invoice")

            # ✅ BONUS: Extraction metadata depuis parent.subscription_details
            metadata = {}
            if parent.get("type") == "subscription_details":
                subscription_details = parent.get("subscription_details", {})
                metadata = subscription_details.get("metadata", {})
                print(f"🔑 Metadata subscription: {metadata}")

            subscription = await tournament_subscription_repository.find_by_stripe_subscription_id(subscription_id)

            if not subscription:
                print(f"❌ Subscription non trouvé: {subscription_id}")
                return

            print(f"✅ Subscription trouvé:")
            print(f"  - UUID: {subscription.uuid}")
            print(f"  - Status avant: {subscription.status}")

            # Conversion des timestamps en datetime
            period_start_dt = None
            period_end_dt = None

            try:
                subscription.update_status_from_stripe(
                    status="active",
                    period_start=period_start,
                    period_end=period_end
                )
                print(f"✅ Status mis à jour: {subscription.status}")

            except Exception as update_error:
                print(f"❌ Erreur update_status_from_stripe: {update_error}")
                # Fallback: activation simple
                subscription.update_status_from_stripe(
                    status=TournamentSubscriptionStatus.ACTIVE,
                    period_start=period_start
                )
                print("✅ Status forcé à 'active'")

            await tournament_subscription_repository.update(subscription)

            print(f"🎉 Paiement traité avec succès:")
            print(f"  - UUID: {subscription.uuid}")
            print(f"  - Stripe ID: {subscription.stripe_subscription_id}")
            print(f"  - Status final: {subscription.status}")
            print(f"  - Période: {period_start_dt} → {period_end_dt}")

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
