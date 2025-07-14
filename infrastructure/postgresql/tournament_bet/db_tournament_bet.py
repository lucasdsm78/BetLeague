from typing import Optional, Union
from sqlalchemy import Column, Integer, Float, String, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from datetime import datetime

from domain.tournament_bet.model.tournament_bet import TournamentBet
from domain.tournament_bet.model.tournament_bet_status import TournamentBetStatus
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBTournamentBet(Base):
    __tablename__ = "tournament_bet"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    player_id: Union[int, Column] = Column(Integer, ForeignKey("tournament_player.id"), index=True)
    match_id: Union[int, Column] = Column(Integer, ForeignKey("tournament_match.id"), index=True)
    amount: Union[float, Column] = Column(Float, nullable=False)
    choice: Union[str, Column] = Column(String, nullable=False)
    status: Union[str, Column] = Column(String, nullable=False)
    created_at: Union[int, Column] = Column(BigInteger, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, nullable=False)

    player = relationship("DBTournamentPlayer")
    match = relationship("DBTournamentMatch")

    def to_entity(self) -> TournamentBet:
        return TournamentBet(
            id=self.id,
            player_id=self.player_id,
            match_id=self.match_id,
            amount=self.amount,
            choice=self.choice,
            status=TournamentBetStatus.from_str(self.status),
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    @staticmethod
    def from_entity(bet: TournamentBet, db_obj: Optional["DBTournamentBet"] = None) -> "DBTournamentBet":
        now = unixtimestamp()
        bet_db = db_obj if db_obj is not None else DBTournamentBet()
        bet_db.id = bet.id
        bet_db.player_id = bet.player_id
        bet_db.match_id = bet.match_id
        bet_db.amount = bet.amount
        bet_db.choice = bet.choice
        bet_db.status = bet.status.value
        bet_db.created_at = bet.created_at if bet.created_at is not None else now
        bet_db.updated_at = now
        return bet_db
