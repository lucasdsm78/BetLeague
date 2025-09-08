from datetime import datetime
from typing import Optional, Union

from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, Float
from sqlalchemy.orm import relationship

from domain.tournament_subscription.model.tournament_subscription import TournamentSubscription
from domain.tournament_subscription.model.tournament_subscription_plan import TournamentSubscriptionPlan
from domain.tournament_subscription.model.tournament_subscription_price import TournamentSubscriptionPrice
from domain.tournament_subscription.model.tournament_subscription_status import TournamentSubscriptionStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBTournamentSubscription(Base):
    __tablename__ = "tournament_subscription"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True, index=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True, index=True)
    stripe_subscription_id: Union[str, Column] = Column(String, nullable=True, index=True)
    price_amount: Union[float, Column] = Column(Float, nullable=False)
    price_currency: Union[str, Column] = Column(String, nullable=False, default="EUR")
    status: Union[str, Column] = Column(String, nullable=False, index=True)
    plan: Union[str, Column] = Column(String, nullable=False)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship('DBUser')
    created_at: Union[int, Column] = Column(BigInteger, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, nullable=False)
    start_date: Union[int, Column] = Column(BigInteger, index=True, nullable=True)
    end_date: Union[int, Column] = Column(BigInteger, index=True, nullable=True)

    def to_entity(self) -> TournamentSubscription:
        return TournamentSubscription(
            id=self.id,
            uuid=self.uuid,
            user=UserSummary(id=self.user_id, email=Email(self.user.email), pseudo=self.user.pseudo),
            plan=TournamentSubscriptionPlan(self.plan),
            price=TournamentSubscriptionPrice(self.price_amount, self.price_currency),
            status=TournamentSubscriptionStatus(self.status),
            stripe_subscription_id=self.stripe_subscription_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
            current_period_start=self.start_date,
            current_period_end=self.end_date
        )

    @staticmethod
    def from_entity(tournament_subscription: TournamentSubscription, db_tournament_subscription: Optional["DBTournamentSubscription"] = None) -> "DBTournamentSubscription":
        now = unixtimestamp()
        tournament_subscription_db = db_tournament_subscription if db_tournament_subscription is not None else DBTournamentSubscription()
        tournament_subscription_db.id = tournament_subscription.id
        tournament_subscription_db.uuid = tournament_subscription.uuid
        tournament_subscription_db.price_currency = tournament_subscription.price.currency
        tournament_subscription_db.price_amount = tournament_subscription.price.amount
        tournament_subscription_db.stripe_subscription_id = tournament_subscription.stripe_subscription_id
        tournament_subscription_db.status = tournament_subscription.status.value
        tournament_subscription_db.plan = tournament_subscription.plan.value
        tournament_subscription_db.start_date = tournament_subscription.current_period_start
        tournament_subscription_db.end_date = tournament_subscription.current_period_end
        tournament_subscription_db.user_id = tournament_subscription.user.id
        tournament_subscription_db.created_at = now
        tournament_subscription_db.updated_at = now
        return tournament_subscription_db
