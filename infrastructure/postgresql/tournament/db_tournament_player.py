from datetime import datetime
from typing import Optional, Union

from sqlalchemy import Column, Integer, Float, BigInteger, ForeignKey, String, Index, Boolean
from sqlalchemy.orm import relationship

from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament_player import TournamentPlayer
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    return int(datetime.now().timestamp() * 1000)


class DBTournamentPlayer(Base):
    __tablename__ = "tournament_player"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship('DBUser', back_populates='tournaments_players', foreign_keys=[user_id])
    tournament_id: Union[int, Column] = Column(Integer, ForeignKey('tournament.id'))
    tournament = relationship('DBTournament', back_populates='players')
    stage: Union[str, Column] = Column(String, nullable=False)
    nb_btl: Union[float, Column] = Column(Float, default=0)
    is_eliminated = Column(Boolean, nullable=False, default=False)
    created_at: Union[int, Column] = Column(BigInteger, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index('idx_tournament_player_tournament', 'tournament_id'),
        Index('idx_tournament_player_user', 'user_id'),
    )

    def to_entity(self) -> TournamentPlayer:
        return TournamentPlayer(
            id=self.id,
            user_id=self.user_id,
            tournament_id=self.tournament_id,
            nb_btl=self.nb_btl,
            is_eliminated=self.is_eliminated,
            current_stage=StageType.from_str(self.stage),
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    @staticmethod
    def from_entity(player: TournamentPlayer, db_player: Optional["DBTournamentPlayer"] = None) -> "DBTournamentPlayer":
        now = unixtimestamp()
        player_db = db_player if db_player is not None else DBTournamentPlayer()
        player_db.id = player.id
        player_db.user_id = player.user_id
        player_db.tournament_id = player.tournament_id
        player_db.stage = StageType.from_str(player.current_stage.value)
        player_db.nb_btl = player.nb_btl
        player_db.is_eliminated = player.is_eliminated,
        player_db.created_at = now
        player_db.updated_at = now
        return player_db
