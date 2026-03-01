from typing import Union, Optional

from sqlalchemy import Column, Integer, String, Float, ForeignKey, Index
from sqlalchemy.orm import relationship

from domain.match.model.bet_type import BetType
from domain.match.model.match_odd import MatchOdd
from infrastructure.postgresql.database import Base


class DBMatchOdd(Base):

    __tablename__ = "match_odds"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    match_id: Union[int, Column] = Column(Integer, ForeignKey("match.id", ondelete="CASCADE"), nullable=False)
    bet_type: Union[str, Column] = Column(String, nullable=False)
    bet_name: Union[str, Column] = Column(String, nullable=False)
    value: Union[str, Column] = Column(String, nullable=False)
    odd: Union[float, Column] = Column(Float, nullable=False)
    result: Union[str, Column] = Column(String, nullable=True)

    match = relationship("DBMatch", backref="odds")

    __table_args__ = (
        Index("ix_match_odds_match_id_bet_type", "match_id", "bet_type"),
    )

    def to_entity(self) -> MatchOdd:
        return MatchOdd(
            id=self.id,
            match_id=self.match_id,
            bet_type=BetType(self.bet_type),
            bet_name=self.bet_name,
            value=self.value,
            odd=self.odd,
            result=self.result,
        )

    @staticmethod
    def from_entity(odd: MatchOdd) -> "DBMatchOdd":
        return DBMatchOdd(
            id=odd.id,
            match_id=odd.match_id,
            bet_type=odd.bet_type.value if isinstance(odd.bet_type, BetType) else odd.bet_type,
            bet_name=odd.bet_name,
            value=odd.value,
            odd=odd.odd,
            result=odd.result,
        )
