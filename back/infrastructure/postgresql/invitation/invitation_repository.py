from typing import List, Optional, Dict
from sqlalchemy import select, func, case
from sqlalchemy import delete
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from domain.invitation.exception.invitation_exception import InvitationNotFoundError
from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus
from domain.invitation.repository.invitation_repository import InvitationRepository
from infrastructure.postgresql.invitation.db_invitation import DBInvitation
from infrastructure.postgresql.league.db_league import DBLeague
from infrastructure.postgresql.user.db_user import DBUser
from infrastructure.postgresql.tournament.db_tournament import DBTournament

class InvitationRepositoryImpl(InvitationRepository):
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def delete(self, invitation_id: int) -> bool:
        stmt = delete(DBInvitation).where(DBInvitation.id == invitation_id)
        res = await self.session.execute(stmt)
        return bool(res.rowcount and res.rowcount > 0)

    async def add(self, invitation: Invitation):
        invitation_db = DBInvitation.from_entity(invitation)
        try:
            self.session.add(invitation_db)
        except:
            raise

    async def find_by_id(self, invitation_id: int) -> Optional[Invitation]:
        try:
            result = await self.session.execute(
                select(DBInvitation).where(DBInvitation.id == invitation_id)
            )
            invitation_db = result.scalar_one()
            return invitation_db.to_entity()
        except NoResultFound:
            raise InvitationNotFoundError
        except:
            raise

    async def find_by_user_id_league_id(self, user_id: int, league_id: int) -> bool:
        try:
            result = await self.session.execute(
                select(DBInvitation).where(
                    DBInvitation.league_id == league_id,
                    DBInvitation.user_id == user_id
                )
            )
            count = len(result.scalars().all())
            return count != 0
        except:
            raise

    async def find_by_user_id_tournament_id(self, user_id: int, tournament_id: int) -> bool:
        try:
            result = await self.session.execute(
                select(DBInvitation).where(
                    DBInvitation.tournament_id == tournament_id,
                    DBInvitation.user_id == user_id
                )
            )
            count = len(result.scalars().all())
            return count != 0
        except:
            raise

    async def find_tournament_invitations_sent_by_owner(self, tournament_id: int, owner_user_id: int) -> List[DBInvitation]:
        query = (
            select(DBInvitation)
            .join(DBTournament, DBInvitation.tournament_id == DBTournament.id)
            .where(
                DBInvitation.tournament_id == tournament_id,
                DBTournament.user_id == owner_user_id,
            )
            .options(
                selectinload(DBInvitation.user),
                selectinload(DBInvitation.user_sender),
                selectinload(DBInvitation.tournament),
            )
            .order_by(DBInvitation.created_at.desc())
        )

        result = await self.session.execute(query)
        return result.scalars().all()

    async def find_received_invitations(
            self,
            user_id: int,
            status: Optional[InvitationStatus] = None,
            page: int = 1,
            page_size: int = 20,
    ) -> List[DBInvitation]:
        offset = (page - 1) * page_size

        filters = [DBInvitation.user_id == user_id]
        if status is not None:
            filters.append(DBInvitation.status == status.value)

        query = (
            select(DBInvitation)
            .where(*filters)
            .options(
                selectinload(DBInvitation.league).selectinload(DBLeague.user),
                selectinload(DBInvitation.tournament).selectinload(DBTournament.user),
                selectinload(DBInvitation.user_sender),
            )
            .order_by(DBInvitation.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_received_invitations(
            self,
            user_id: int,
            status: Optional[InvitationStatus] = None,
    ) -> int:
        filters = [DBInvitation.user_id == user_id]
        if status is not None:
            filters.append(DBInvitation.status == status.value)

        result = await self.session.execute(
            select(func.count(DBInvitation.id)).where(*filters)
        )
        return result.scalar_one()

    async def find_invitations(
            self,
            user_id: int,
            is_received: bool,
            status: Optional[InvitationStatus] = None,
            page: int = 1,
            limit: int = 10
    ) -> Dict[str, List[Invitation]]:
        offset = (page - 1) * limit

        if not is_received:
            query = (
                select(DBInvitation)
                .join(DBLeague, DBInvitation.league_id == DBLeague.id)
                .where(DBLeague.user_id == user_id)
            )
        else:
            query = select(DBInvitation).where(DBInvitation.user_id == user_id)

        if status:
            query = query.where(DBInvitation.status == status.value)

        query = query.order_by(DBInvitation.created_at.desc())
        query = query.offset(offset).limit(limit)

        try:
            result = await self.session.execute(query)
            invitation_dbs = result.scalars().all()
        except:
            raise

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

        return grouped_invitations

    async def count_by_status(self, user_id: int, is_received: bool) -> Dict[str, int]:
        if not is_received:
            base = (
                select(
                    DBInvitation.status,
                    func.count().label('cnt'),
                )
                .join(DBLeague, DBInvitation.league_id == DBLeague.id)
                .where(DBLeague.user_id == user_id)
                .group_by(DBInvitation.status)
            )
        else:
            base = (
                select(
                    DBInvitation.status,
                    func.count().label('cnt'),
                )
                .where(DBInvitation.user_id == user_id)
                .group_by(DBInvitation.status)
            )

        result = await self.session.execute(base)
        rows = result.all()

        counts = {"pending": 0, "accepted": 0, "refused": 0}
        for row in rows:
            status_val = row[0]
            cnt = row[1]
            if status_val == InvitationStatus.pending.value:
                counts["pending"] = cnt
            elif status_val == InvitationStatus.accepted.value:
                counts["accepted"] = cnt
            elif status_val == InvitationStatus.refused.value:
                counts["refused"] = cnt

        return counts

    async def delete_tournament_invitation_if_owner(self, *, invitation_id: int, owner_user_id: int) -> bool:
        exists_subq = (
            select(1)
            .where(DBTournament.id == DBInvitation.tournament_id)
            .where(DBTournament.user_id == owner_user_id)
            .exists()
        )

        stmt = delete(DBInvitation).where(DBInvitation.id == invitation_id).where(exists_subq)
        res = await self.session.execute(stmt)
        return bool(res.rowcount and res.rowcount > 0)

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()
