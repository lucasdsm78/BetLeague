from sqlalchemy import Column, Integer, ForeignKey, String, BigInteger
from sqlalchemy.orm import relationship
from typing import Optional, Union
from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.model.stage_type import StageType
from infrastructure.postgresql.database import Base
from infrastructure.postgresql.tournament.db_tournament_player import unixtimestamp


class DBTournamentMatch(Base):
    __tablename__ = "tournament_match"

    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, ForeignKey("tournament_stage.id"), nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournament.id"), nullable=False)
    type = Column(String(50), nullable=False)
    player1_id = Column(Integer, ForeignKey("tournament_player.id"), nullable=True)
    player2_id = Column(Integer, ForeignKey("tournament_player.id"), nullable=True)
    winner_id = Column(Integer, ForeignKey("tournament_player.id"), nullable=True)
    loser_id = Column(Integer, ForeignKey("tournament_player.id"), nullable=True)
    created_at: Union[int, Column] = Column(BigInteger, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, nullable=False)

    stage = relationship("DBTournamentStage", back_populates="matches")
    tournament = relationship("DBTournament", back_populates="matches")
    player1 = relationship(
        "DBTournamentPlayer",
        foreign_keys=[player1_id],
        back_populates="matches_as_player1"
    )
    player2 = relationship(
        "DBTournamentPlayer",
        foreign_keys=[player2_id],
        back_populates="matches_as_player2"
    )
    winner = relationship(
        "DBTournamentPlayer",
        foreign_keys=[winner_id],
        back_populates="matches_won"
    )
    loser = relationship(
        "DBTournamentPlayer",
        foreign_keys=[loser_id],
        back_populates="matches_lost"
    )

    def to_entity(self) -> TournamentMatch:
        return TournamentMatch(
            id=self.id,
            stage_id=self.stage_id,
            tournament_id=self.tournament_id,
            type=StageType(self.type),
            player1_id=self.player1_id,
            player2_id=self.player2_id,
            winner_id=self.winner_id,
            loser_id=self.loser_id,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    @staticmethod
    def from_entity(
            match: TournamentMatch,
            db_match: Optional["DBTournamentMatch"] = None
    ) -> "DBTournamentMatch":
        now = unixtimestamp()
        match_db = db_match if db_match is not None else DBTournamentMatch()

        match_db.id = match.id
        match_db.stage_id = match.stage_id
        match_db.tournament_id = match.tournament_id
        match_db.type = match.type.value if match.type is not None else None
        match_db.player1_id = match.player1_id
        match_db.player2_id = match.player2_id
        match_db.winner_id = match.winner_id
        match_db.loser_id = match.loser_id
        match_db.created_at = match.created_at if match.created_at is not None else now
        match_db.updated_at = now

        return match_db
