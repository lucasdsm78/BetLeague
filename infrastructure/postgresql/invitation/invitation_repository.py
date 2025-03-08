from typing import List, Optional, Dict

from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session

from domain.invitation.exception.invitation_exception import InvitationNotFoundError
from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus
from domain.invitation.repository.invitation_repository import InvitationRepository
from infrastructure.postgresql.invitation.db_invitation import DBInvitation
from infrastructure.postgresql.league.db_league import DBLeague


class InvitationRepositoryImpl(InvitationRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def add(self, invitation: Invitation):
        invitation_db = DBInvitation.from_entity(invitation)
        try:
            self.session.add(invitation_db)
        except:
            raise

    def find_by_id(self, invitation_id: int) -> Optional[Invitation]:
        try:
            invitation_db = self.session.get(DBInvitation, invitation_id)
        except NoResultFound:
            raise InvitationNotFoundError
        except Exception as e:
            raise

        return invitation_db.to_entity()

    def find_by_user_id_league_id(self, user_id: int, league_id: int) -> bool:
        try:
            result = False
            invitation_db = self.session.query(DBInvitation).filter_by(
                league_id=league_id,
                user_id=user_id
            ).count()

            if invitation_db != 0:
                result = True
        except Exception:
            raise

        return result

    def find_invitations(
            self,
            user_id: int,
            is_received: bool,
            status: Optional[InvitationStatus] = None,
            page: int = 1,
            limit: int = 10
    ) -> Dict[str, List[Invitation]]:

        offset = (page - 1) * limit

        query = self.session.query(DBInvitation).filter(DBInvitation.user_id == user_id)

        if not is_received:
            query = (
                self.session.query(DBInvitation)
                .join(DBLeague, DBInvitation.league_id == DBLeague.id)
                .filter(DBLeague.user_id == user_id)
            )

        if status:
            query = query.filter(DBInvitation.status == status.value)

        query = query.order_by(DBInvitation.created_at.desc())

        try:
            invitation_dbs = (
                query
                .offset(offset)
                .limit(limit)
                .all()
            )
        except Exception as e:
            raise e

        grouped_invitations = {
            "pending": [],
            "accepted": [],
            "refused": []
        }

        for db_inv in invitation_dbs:
            if db_inv.status == InvitationStatus.pending.value:
                grouped_invitations["pending"].append(db_inv.to_entity())
            elif db_inv.status == InvitationStatus.accepted.value:
                grouped_invitations["accepted"].append(db_inv.to_entity())
            elif db_inv.status == InvitationStatus.refused.value:
                grouped_invitations["refused"].append(db_inv.to_entity())
            else:
                pass

        return grouped_invitations

    def update(self, invitation: Invitation):
        try:
            _invitation = self.session.get(DBInvitation, invitation.id)
            invitation_db = DBInvitation.from_entity(invitation, _invitation)
        except:
            raise

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()
