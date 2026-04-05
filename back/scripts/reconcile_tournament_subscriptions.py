import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import stripe
from sqlalchemy import select
from sqlalchemy.orm import joinedload

sys.path.append(str(Path(__file__).resolve().parents[1]))

from domain.tournament_subscription.model.tournament_subscription_status import map_stripe_status_to_enum
from infrastructure.config import Settings
from infrastructure.postgresql.database import AsyncSessionLocal
from infrastructure.postgresql.init_models import init_models
from infrastructure.postgresql.tournament_subscription.db_tournament_subscription import DBTournamentSubscription
from infrastructure.postgresql.user.db_user import DBUser


init_models()


def _now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def _extract_period_bounds_ms(subscription_payload: dict[str, Any]) -> tuple[int | None, int | None]:
    period_start = subscription_payload.get("current_period_start") or subscription_payload.get("period_start")
    period_end = subscription_payload.get("current_period_end") or subscription_payload.get("period_end")
    if period_start and period_end:
        return int(period_start) * 1000, int(period_end) * 1000

    items = subscription_payload.get("items") or {}
    items_data = items.get("data") or []
    if items_data:
        first_item = items_data[0] or {}
        item_start = first_item.get("current_period_start")
        item_end = first_item.get("current_period_end")
        return (
            int(item_start) * 1000 if item_start else None,
            int(item_end) * 1000 if item_end else None,
        )

    return None, None


def _subscription_to_dict(subscription_obj: Any) -> dict[str, Any]:
    to_dict_recursive = getattr(subscription_obj, "to_dict_recursive", None)
    if callable(to_dict_recursive):
        return to_dict_recursive()
    internal_recursive = getattr(subscription_obj, "_to_dict_recursive", None)
    if callable(internal_recursive):
        return internal_recursive()
    if isinstance(subscription_obj, dict):
        return subscription_obj
    raise ValueError("Impossible de convertir l'abonnement Stripe en dictionnaire")


async def reconcile(email: str, apply: bool, latest_only: bool) -> int:
    settings = Settings()
    stripe.api_key = settings.stripe_api_key

    async with AsyncSessionLocal() as session:
        user_result = await session.execute(
            select(DBUser).where(DBUser.email == email)
        )
        user = user_result.scalar_one_or_none()
        if user is None:
            print(f"Utilisateur introuvable pour email={email}")
            return 1

        subscriptions_result = await session.execute(
            select(DBTournamentSubscription)
            .options(joinedload(DBTournamentSubscription.user))
            .where(DBTournamentSubscription.user_id == user.id)
            .order_by(DBTournamentSubscription.created_at.desc(), DBTournamentSubscription.id.desc())
        )
        subscriptions = list(subscriptions_result.scalars().all())
        if not subscriptions:
            print(f"Aucun abonnement local trouvé pour user_id={user.id}")
            return 1

        pending = [sub for sub in subscriptions if not sub.stripe_subscription_id and sub.status == "incomplete"]
        targets = pending[:1] if latest_only else pending
        if not targets:
            print("Aucune ligne locale incomplète à réconcilier.")
            return 0

        print(f"Réconciliation de {len(targets)} ligne(s) locale(s) pour user_id={user.id}")

        updated = 0
        for local_sub in targets:
            search_result = stripe.Subscription.search(
                query=f"metadata['uuid']:'{local_sub.uuid}'",
                limit=10,
            )
            payload = search_result._to_dict_recursive()
            stripe_subscriptions = payload.get("data", [])
            if not stripe_subscriptions:
                print(f"- UUID {local_sub.uuid}: aucun abonnement Stripe trouvé")
                continue

            stripe_subscriptions.sort(
                key=lambda item: (int(item.get("created") or 0), str(item.get("status") or "")),
                reverse=True,
            )
            stripe_subscription = stripe_subscriptions[0]
            mapped_status = map_stripe_status_to_enum(str(stripe_subscription.get("status") or "incomplete"))
            if mapped_status is None:
                print(f"- UUID {local_sub.uuid}: statut Stripe inconnu {stripe_subscription.get('status')!r}")
                continue

            period_start_ms, period_end_ms = _extract_period_bounds_ms(stripe_subscription)
            print(
                f"- UUID {local_sub.uuid}: Stripe id={stripe_subscription.get('id')} status={mapped_status.value} "
                f"start={period_start_ms} end={period_end_ms} cancel_at_period_end={bool(stripe_subscription.get('cancel_at_period_end'))}"
            )

            if apply:
                local_sub.stripe_subscription_id = stripe_subscription.get("id")
                local_sub.status = mapped_status.value
                local_sub.start_date = period_start_ms
                local_sub.end_date = period_end_ms
                local_sub.cancel_at_period_end = bool(stripe_subscription.get("cancel_at_period_end"))
                if local_sub.cancel_at_period_end and local_sub.cancellation_requested_at is None:
                    local_sub.cancellation_requested_at = _now_ms()
                if not local_sub.cancel_at_period_end:
                    local_sub.cancellation_requested_at = None
                local_sub.updated_at = _now_ms()
                updated += 1

        if apply:
            active_now_exists = any(
                sub.status in {"active", "past_due"} and (sub.end_date is None or sub.end_date > _now_ms())
                for sub in subscriptions
            )
            user.is_tournament_subscriber = active_now_exists
            await session.commit()
            print(f"Réconciliation appliquée. Lignes mises à jour: {updated}. user.is_tournament_subscriber={active_now_exists}")
        else:
            print("Dry-run uniquement, aucune modification en base.")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Réconcilie les abonnements tournoi locaux avec Stripe")
    parser.add_argument("--email", required=True, help="Email de l'utilisateur à réconcilier")
    parser.add_argument("--apply", action="store_true", help="Applique réellement les modifications")
    parser.add_argument(
        "--all-pending",
        action="store_true",
        help="Réconcilie toutes les lignes locales incomplètes sans stripe_subscription_id au lieu de seulement la plus récente",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    raise SystemExit(asyncio.run(reconcile(email=args.email, apply=args.apply, latest_only=not args.all_pending)))


