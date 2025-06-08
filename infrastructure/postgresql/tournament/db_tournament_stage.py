from typing import Union, Optional
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, BigInteger, ForeignKey, Float
from sqlalchemy.orm import relationship

from domain.tournament.model import TournamentStage
from domain.tournament.model.stage_type import StageType
from infrastructure.postgresql.database import Base
from infrastructure.postgresql.tournament import DBTournament


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)

class DBTournamentStage(Base):
    __tablename__ = "tournament_stage"

    id = Column(Integer, index=True, primary_key=True)
    tournament_id = Column(Integer, ForeignKey("tournament.id"), nullable=False)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship('DBUser', back_populates="tournament_stages", foreign_keys=[user_id])
    type = Column(String, nullable=False)
    start_date: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    end_date: Union[int, Column] = Column(BigInteger, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=False)
    is_completed = Column(Boolean, nullable=False, default=False)

    tournament = relationship("DBTournament", back_populates="stages")

    def to_entity(self) -> TournamentStage:
        return TournamentStage(
            id=self.id,
            tournament_id=self.tournament_id,
            type=StageType(self.type),
            start_date=self.start_date,
            end_date=self.end_date,
            is_active=self.is_active,
            is_completed=self.is_completed,
        )

    @staticmethod
    def from_entity(tournament_stage: TournamentStage, db_tournament_stage: Optional["DBTournamentStage"] = None) -> "DBTournamentStage":
        now = unixtimestamp()
        tournament_stage_db = db_tournament_stage if db_tournament_stage is not None else DBTournamentStage()
        tournament_stage_db.id = tournament_stage.id
        tournament_stage_db.user_id = tournament_stage.user_id
        tournament_stage_db.tournament_id = tournament_stage.tournament_id
        tournament_stage_db.is_active = tournament_stage.is_active
        tournament_stage_db.is_completed = tournament_stage.is_completed
        tournament_stage_db.end_date = tournament_stage.end_date
        tournament_stage_db.start_date = tournament_stage.start_date
        tournament_stage_db.type = tournament_stage.type.value
        return tournament_stage_db
