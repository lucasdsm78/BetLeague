from datetime import datetime
from typing import Optional, Union

from sqlalchemy import Column, Integer, Float, BigInteger, ForeignKey, String, Index, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament_player import TournamentPlayer
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    # Always use UTC to avoid timezone-dependent shifts
    return int(datetime.utcnow().timestamp() * 1000)


class DBTournamentPlayer(Base):
    __tablename__ = "tournament_player"

    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user = relationship('DBUser', back_populates='tournaments_players', foreign_keys=[user_id])
    tournament_id: Union[int, Column] = Column(Integer, ForeignKey('tournament.id'))
    tournament = relationship('DBTournament', back_populates='players')
    stage: Union[str, Column] = Column(String, nullable=False, default=StageType.EIGHTH_FINAL.value)
    nb_btl: Union[float, Column] = Column(Float, default=0)
    is_eliminated = Column(Boolean, nullable=False, default=False)
    created_at: Union[int, Column] = Column(BigInteger, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index('idx_tournament_player_tournament', 'tournament_id'),
        Index('idx_tournament_player_user', 'user_id'),
        UniqueConstraint('tournament_id', 'user_id', name='uq_tournament_player_tournament_user'),
    )

    matches_as_player1 = relationship(
        "DBTournamentMatch",
        foreign_keys="DBTournamentMatch.player1_id",
        back_populates="player1"
    )

    matches_as_player2 = relationship(
        "DBTournamentMatch",
        foreign_keys="DBTournamentMatch.player2_id",
        back_populates="player2"
    )

    matches_won = relationship(
        "DBTournamentMatch",
        foreign_keys="DBTournamentMatch.winner_id",
        back_populates="winner"
    )

    matches_lost = relationship(
        "DBTournamentMatch",
        foreign_keys="DBTournamentMatch.loser_id",
        back_populates="loser"
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
        player_db.stage = player.current_stage.value if player.current_stage else None
        player_db.nb_btl = player.nb_btl
        player_db.is_eliminated = player.is_eliminated
        # Preserve original creation time when updating
        player_db.created_at = player_db.created_at if db_player is not None else now
        player_db.updated_at = now
        return player_db
