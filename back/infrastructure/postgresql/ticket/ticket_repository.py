from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy.orm import joinedload, selectinload

from sqlalchemy import select, update
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from domain.ticket.exception.ticket_exception import TicketNotFoundError
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.ticket.repository.ticket_repository import TicketRepository
from infrastructure.postgresql.league.db_league_players import DBLeaguePlayers
from infrastructure.postgresql.match.db_match_odd import DBMatchOdd
from infrastructure.postgresql.ticket.db_match_choices import DBMatchChoices
from infrastructure.postgresql.ticket.db_ticket import DBTicket
from infrastructure.postgresql.user.db_user import DBUser


class TicketRepositoryImpl(TicketRepository):

    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(self, ticket: Ticket) -> int:
        ticket_db = DBTicket.from_entity(ticket)
        self.session.add(ticket_db)
        await self.session.flush()
        return ticket_db.id

    async def find_by_id(self, ticket_id: int) -> Ticket:
        q = (
            select(DBTicket)
            .options(
                joinedload(DBTicket.user),
                joinedload(DBTicket.league),
                joinedload(DBTicket.tournament_match),
                selectinload(DBTicket.match_choices)
            )
            .where(DBTicket.id == ticket_id)
        )
        result = await self.session.execute(q)
        ticket_db = result.scalar_one_or_none()
        if not ticket_db:
            raise TicketNotFoundError
        return ticket_db.to_entity()

    async def find_by_id_for_update(self, ticket_id: int) -> Ticket:
        q = (
            select(DBTicket)
            .options(joinedload(DBTicket.user))
            .where(DBTicket.id == ticket_id)
            .with_for_update()
        )
        result = await self.session.execute(q)
        ticket_db = result.scalar_one_or_none()
        if not ticket_db:
            raise TicketNotFoundError
        return ticket_db.to_entity()

    async def get_gain(self, match_choices: List[MatchChoice], mise: int) -> float:
        try:
            odd_ids = [mc.match_odd_id for mc in match_choices]
            odd_result = await self.session.execute(
                select(DBMatchOdd).where(DBMatchOdd.id.in_(odd_ids))
            )
            odd_dict = {o.id: o for o in odd_result.scalars().all()}

            total_coefficient = Decimal("1.0")
            for mc in match_choices:
                db_odd = odd_dict.get(mc.match_odd_id)
                if not db_odd:
                    raise ValueError(f"MatchOdd introuvable avec l'id {mc.match_odd_id}")
                total_coefficient *= Decimal(str(db_odd.odd))

            gain_decimal = Decimal(str(mise)) * total_coefficient
            return float(gain_decimal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
        except:
            raise

    async def find_by_uuid(self, ticket_uuid: str) -> Optional[Ticket]:
        q = (
            select(DBTicket)
            .options(
                joinedload(DBTicket.user),
                joinedload(DBTicket.league),
                joinedload(DBTicket.tournament_match),
                joinedload(DBTicket.match_choices),
            )
            .where(DBTicket.uuid == ticket_uuid)
        )

        result = await self.session.execute(q)
        ticket_db = result.unique().scalar_one_or_none()
        if ticket_db is None:
            return None
        return ticket_db.to_entity()

    async def find_by_player_match(self, user_id: int, tournament_match_id: int) -> Optional[Ticket]:
        result = await self.session.execute(
            select(DBTicket).where(
    DBTicket.user_id == user_id,
                DBTicket.tournament_match_id == tournament_match_id
            )
        )
        bet_db = result.scalar_one_or_none()
        return bet_db.to_entity() if bet_db else None

    async def find_all_in_progress_by_user_id(self, user_id: int) -> List[DBTicket]:
        query = (
            select(DBTicket)
            .where(
                DBTicket.user_id == user_id,
                DBTicket.status == TicketStatus.pending.value
            )
            .options(
                # Charger la ligue associée à chaque ticket
                selectinload(DBTicket.league),
                selectinload(DBTicket.tournament_match),
                # Charger en cascade : pour chaque ticket, toutes ses choices
                selectinload(DBTicket.match_choices)
                .selectinload(DBMatchChoices.match)
            )
            .order_by(DBTicket.id)  # ou tout autre ordre voulu
        )

        result = await self.session.execute(query)
        return result.scalars().all()

    async def find_all_finished_by_user_id(self, user_id: int) -> List[DBTicket]:
        # 1. Construire la requête avec eager-loading
        query = (
            select(DBTicket)
            .where(
                DBTicket.user_id == user_id,
                DBTicket.status.in_([TicketStatus.correct.value, TicketStatus.wrong.value])
            )
            .options(
                # Charger la ligue associée à chaque ticket
                selectinload(DBTicket.league),
                selectinload(DBTicket.tournament_match),
                # Charger en cascade : pour chaque ticket, toutes ses choices
                selectinload(DBTicket.match_choices)
                .selectinload(DBMatchChoices.match)
                # ^ ici, DBMatchChoices.match est la relation vers DBMatch
            )
            .order_by(DBTicket.id.desc())
        )

        # 2. Exécuter en mode async
        result = await self.session.execute(query)
        # 3. Scalar() renvoie des instances DBTicket (eager-loaded)
        return result.scalars().all()


    async def update(self, ticket: Ticket):
        try:
            result = await self.session.execute(
                select(DBTicket).where(DBTicket.id == ticket.id)
            )
            _ticket = result.scalar_one()
            ticket_db = DBTicket.from_entity(ticket, _ticket)
        except:
            raise

    async def delete(self, ticket_id: int):
        try:
            result = await self.session.execute(
                select(DBTicket).where(DBTicket.id == ticket_id)
            )
            ticket = result.scalar_one()
            await self.session.delete(ticket)
        except:
            raise



    async def apply_ticket_updates(
            self,
            ticket_id: int,
            user_id: int,
            league_id: int,
            wrong_count: int,
            pending_count: int,
            gain: float
    ) -> bool:
        # 1) Déterminer le nouveau statut
        if wrong_count > 0:
            new_status = TicketStatus.wrong.value
        elif pending_count == 0:
            new_status = TicketStatus.correct.value
        else:
            return False  # choices encore en attente

        # 2) UPDATE idempotent : WHERE status = ‘PENDING’ empêche le double-traitement
        result = await self.session.execute(
            update(DBTicket)
            .where(
                DBTicket.id == ticket_id,
                DBTicket.status == TicketStatus.pending.value,
            )
            .values(status=new_status)
        )
        if result.rowcount == 0:
            return False  # Déjà résolu — idempotent

        # 3) Mettre à jour les compteurs de l’utilisateur
        user_values = {}
        if wrong_count > 0:
            user_values["nb_lose"] = DBUser.nb_lose + 1
        else:
            user_values.update({
                "nb_win":  DBUser.nb_win + 1,
                "nb_btl":  DBUser.nb_btl + gain,
                "btl_from_tickets": DBUser.btl_from_tickets + gain,
            })

        await self.session.execute(
            update(DBUser)
            .where(DBUser.id == user_id)
            .values(**user_values)
        )

        # 4) Même chose pour league_players (seulement si le ticket appartient à une ligue)
        if league_id is not None:
            lp_values = {}
            if wrong_count > 0:
                lp_values["nb_lose"] = DBLeaguePlayers.nb_lose + 1
            else:
                lp_values.update({
                    "nb_win": DBLeaguePlayers.nb_win + 1,
                    "nb_btl": DBLeaguePlayers.nb_btl + gain,
                    "btl_from_tickets": DBLeaguePlayers.btl_from_tickets + gain,
                })

            await self.session.execute(
                update(DBLeaguePlayers)
                .where(
                    DBLeaguePlayers.league_id == league_id,
                    DBLeaguePlayers.user_id   == user_id
                )
                .values(**lp_values)
            )

        return True

    async def begin(self):
        await self.session.begin()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()
