from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from domain.tournament_subscription.exception.tournament_subscription_exception import \
    TournamentSubscriptionNotFoundError
from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.tournament_subscription.repository.tournament_subscription_repository import \
    TournamentSubscriptionRepository
from infrastructure.postgresql.tournament_subscription.db_tournament_subscription import DBTournamentSubscription


class TournamentSubscriptionRepositoryImpl(TournamentSubscriptionRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(self, subscription: TournamentSubscription):
        sub_db = DBTournamentSubscription.from_entity(subscription)
        try:
            self.session.add(sub_db)
        except:
            raise

    async def find_active_by_user_id(self, user_id: int) -> Optional[TournamentSubscription]:
        result = await self.session.execute(
            select(DBTournamentSubscription)
            .options(joinedload(DBTournamentSubscription.user))
            .where(
                and_(
                    DBTournamentSubscription.user_id == user_id,
                    DBTournamentSubscription.status.in_([
                        TournamentSubscriptionStatus.ACTIVE.value,
                        TournamentSubscriptionStatus.PAST_DUE.value
                    ])
                )
            )
        )
        tournament_subscription_db = result.scalar_one_or_none()
        if not tournament_subscription_db:
            return None
        return tournament_subscription_db.to_entity()

    async def update(self, tournament_subscription: TournamentSubscription):
        result = await self.session.execute(
            select(DBTournamentSubscription).where(DBTournamentSubscription.id == tournament_subscription.id)
        )
        _tournament_subscription = result.scalar_one()
        tournament_db = DBTournamentSubscription.from_entity(tournament_subscription, _tournament_subscription)

    async def find_by_stripe_subscription_id(self, stripe_id: str) -> Optional[TournamentSubscription]:
        result = await self.session.execute(
            select(DBTournamentSubscription)
            .options(joinedload(DBTournamentSubscription.user))
            .where(DBTournamentSubscription.stripe_subscription_id == stripe_id)
        )
        tournament_subscription_db = result.scalar_one_or_none()
        if not tournament_subscription_db:
            raise TournamentSubscriptionNotFoundError
        return tournament_subscription_db.to_entity()

    async def find_by_id(self, tournament_subscription_id: int) -> Optional[TournamentSubscription]:
        result = await self.session.execute(
            select(DBTournamentSubscription)
            .options(joinedload(DBTournamentSubscription.user))
            .where(DBTournamentSubscription.id == tournament_subscription_id)
        )
        tournament_subscription_db = result.scalar_one_or_none()
        if not tournament_subscription_db:
            raise TournamentSubscriptionNotFoundError
        return tournament_subscription_db.to_entity()

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()
