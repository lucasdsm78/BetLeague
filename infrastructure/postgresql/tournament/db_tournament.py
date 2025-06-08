from datetime import datetime
from typing import Optional, Union

from sqlalchemy import Column, Integer, String, Boolean, BigInteger, ForeignKey, Float
from sqlalchemy.orm import relationship

from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBTournament(Base):
    __tablename__ = "tournament"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True, index=True)
    uuid: Union[str, Column] = Column(String, nullable=False, unique=True, index=True)
    name: Union[str, Column] = Column(String, nullable=False)
    is_private: Union[bool, Column] = Column(Boolean, nullable=False)
    max_players = Column(Integer, default=16)
    min_players = Column(Integer, default=3)
    current_players = Column(Integer, default=0)
    entry_fee = Column(Float, default=5.0)
    prize_pool = Column(Float, default=0.0)
    status: Union[str, Column] = Column(String, nullable=False, index=True)
    start_date: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    end_date: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    winner_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    winner = relationship('DBUser', foreign_keys=[winner_id])
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship('DBUser', back_populates='tournaments', foreign_keys=[user_id])
    created_at: Union[int, Column] = Column(BigInteger, nullable=False)
    players = relationship('DBTournamentPlayer', back_populates='tournament')
    stages = relationship("DBTournamentStage", back_populates="tournament", cascade="all, delete-orphan")

    def to_entity(self) -> Tournament:
        return Tournament(
            id=self.id,
            uuid=self.uuid,
            name=self.name,
            is_private=self.is_private,
            status=TournamentStatus.from_str(self.status),
            min_players=self.min_players,
            max_players=self.max_players,
            current_players=self.current_players,
            entry_fee=self.entry_fee,
            prize_pool=self.prize_pool,
            start_date=self.start_date,
            end_date=self.end_date,
            user=UserSummary(id=self.user_id, email=Email(self.user.email), pseudo=self.user.pseudo),
            winner_id=self.winner_id,
            created_at=self.created_at
        )

    @staticmethod
    def from_entity(tournament: Tournament, db_tournament: Optional["DBTournament"] = None) -> "DBTournament":
        now = unixtimestamp()
        tournament_db = db_tournament if db_tournament is not None else DBTournament()
        tournament_db.id = tournament.id
        tournament_db.uuid = tournament.uuid
        tournament_db.name = tournament.name
        tournament_db.is_private = tournament.is_private
        tournament_db.start_date = tournament.start_date
        tournament_db.end_date = tournament.end_date
        tournament_db.max_players = tournament.max_players
        tournament_db.status = tournament.status.value
        tournament_db.winner_id = tournament.winner_id
        tournament_db.entry_fee=tournament.entry_fee
        tournament_db.prize_pool=tournament.prize_pool
        tournament_db.current_players=tournament.current_players
        tournament_db.user_id = tournament.user.id
        tournament_db.created_at = now
        tournament_db.updated_at = now
        return tournament_db
