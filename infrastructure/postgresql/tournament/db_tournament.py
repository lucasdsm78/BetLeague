from datetime import datetime
from typing import Optional, Union

from sqlalchemy import Column, Integer, String, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import relationship

from domain.tournament.model.tournament import Tournament, TournamentStage
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
    stage: Union[str, Column] = Column(String, nullable=False)
    start_date: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    end_date: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    max_players: Union[int, Column] = Column(Integer, nullable=False)
    winner_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    winner = relationship('DBUser', foreign_keys=[winner_id])
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship('DBUser', foreign_keys=[user_id])
    created_at: Union[int, Column] = Column(BigInteger, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, nullable=False)
    players = relationship('DBTournamentPlayer', back_populates='tournament')

    def to_entity(self) -> Tournament:
        return Tournament(
            id=self.id,
            uuid=self.uuid,
            name=self.name,
            is_private=self.is_private,
            max_players=self.max_players,
            start_date=self.start_date,
            end_date=self.end_date,
            stage=TournamentStage(self.stage),
            user=UserSummary(id=self.user_id, email=Email(self.user.email), pseudo=self.user.pseudo),
            winner_id=self.winner_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    @staticmethod
    def from_entity(tournament: Tournament, db_tournament: Optional["DBTournament"] = None) -> "DBTournament":
        now = unixtimestamp()
        tournament_db = db_tournament if db_tournament is not None else DBTournament()
        tournament_db.id = tournament.id
        tournament_db.uuid = tournament.uuid
        tournament_db.name = tournament.name
        tournament_db.is_private = tournament.is_private
        tournament_db.stage = tournament.stage.value
        tournament_db.start_date = tournament.start_date
        tournament_db.end_date = tournament.end_date
        tournament_db.max_players = tournament.max_players
        tournament_db.winner_id = tournament.winner_id
        tournament_db.user_id = tournament.user.id
        tournament_db.created_at = now
        tournament_db.updated_at = now
        return tournament_db
