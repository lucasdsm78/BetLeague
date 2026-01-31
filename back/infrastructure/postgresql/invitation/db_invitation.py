from datetime import datetime
from typing import Union, Optional

from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger, Float, Index
from sqlalchemy.orm import relationship

from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus
from infrastructure.postgresql.database import Base


def unixtimestamp() -> int:
    # Always use UTC to avoid timezone-dependent shifts
    return int(datetime.utcnow().timestamp() * 1000)


class DBInvitation(Base):

    __tablename__ = "invitation"
    id: Union[int, Column] = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'), index=True)
    user_sender_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'))
    user_sender = relationship("DBUser", foreign_keys=[user_sender_id])
    user = relationship("DBUser", foreign_keys=[user_id])
    league_id: Union[int, Column] = Column(Integer, ForeignKey('league.id'), index=True, nullable=True)
    league = relationship("DBLeague", back_populates='invitations')
    tournament_id: Union[int, Column] = Column(Integer, ForeignKey('tournament.id'), index=True, nullable=True)
    tournament = relationship("DBTournament", back_populates='invitations')
    status: Union[str, Column] = Column(String, nullable=False, index=True)
    created_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)
    updated_at: Union[int, Column] = Column(BigInteger, index=True, nullable=False)

    __table_args__ = (
        Index("idx_user_league_invitations", "user_id", "league_id"),
        Index("idx_user_tournament_invitations", "user_id", "tournament_id"),
    )

    def to_entity(self) -> Invitation:
        return Invitation(
            id=self.id,
            user_id=self.user_id,
            user_sender_id=self.user_sender_id,
            league_id=self.league_id if self.league_id else None,
            status=InvitationStatus.from_str(self.status),
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    @staticmethod
    def from_entity(invitation: Invitation, db_invitation:
    Optional["DBInvitation"] = None) -> "DBInvitation":
        now = unixtimestamp()
        invitation_db_to_update = db_invitation if db_invitation \
                                                           is not None else DBInvitation()
        invitation_db_to_update.id = invitation.id
        invitation_db_to_update.user_id = invitation.user_id
        invitation_db_to_update.user_sender_id = invitation.user_sender
        invitation_db_to_update.league_id = invitation.league_id if invitation.league_id else None
        invitation_db_to_update.tournament_id = invitation.tournament_id if invitation.tournament_id else None
        invitation_db_to_update.status = invitation.status.value
        invitation_db_to_update.created_at = now
        invitation_db_to_update.updated_at = now
        return invitation_db_to_update
