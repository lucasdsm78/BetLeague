from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session
from domain.ticket.exception.ticket_exception import TicketNotFoundError
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from domain.ticket.model.ticket import Ticket
from domain.ticket.repository.ticket_repository import TicketRepository
from infrastructure.postgresql.match.db_match import DBMatch
from infrastructure.postgresql.ticket.db_ticket import DBTicket


class TicketRepositoryImpl(TicketRepository):

    def __init__(self, session: Session):
        self.session: Session = session

    def create(self, ticket: Ticket):
        ticket_db = DBTicket.from_entity(ticket)
        try:
            self.session.add(ticket_db)
        except:
            raise

    def find_by_id(self, ticket_id: int) -> Optional[Ticket]:
        try:
            ticket_db = self.session.query(DBTicket).filter_by(id=ticket_id).one()
        except NoResultFound:
            raise TicketNotFoundError
        except Exception as e:
            raise
        return ticket_db.to_entity()

    def get_gain(self, match_choices: List[MatchChoice], mise: int) -> float:
        try:
            match_ids = [mc.match_id for mc in match_choices]

            db_matches = self.session.query(DBMatch).filter(DBMatch.id.in_(match_ids)).all()

            match_dict = {m.id: m for m in db_matches}

            total_coefficient = Decimal("1.0")

            for mc in match_choices:
                if mc.match_id not in match_dict:
                    raise ValueError(f"Match introuvable avec l'id {mc.match_id}")

                db_match = match_dict[mc.match_id]

                if mc.choice == "1":
                    cote = db_match.cote_home
                elif mc.choice == "N":
                    cote = db_match.cote_draw
                elif mc.choice == "2":
                    cote = db_match.cote_away
                else:
                    raise ValueError(f"Choix inconnu : {mc.choice}")

                total_coefficient *= Decimal(str(cote))

            gain_decimal = Decimal(str(mise)) * total_coefficient
            gain_decimal = gain_decimal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            return gain_decimal
        except:
            raise

    def find_by_uuid(self, ticket_uuid: str) -> Optional[Ticket]:
        try:
            ticket_db = self.session.query(DBTicket).filter_by(uuid=ticket_uuid).one()
        except NoResultFound:
            raise TicketNotFoundError
        except Exception as e:
            raise
        return ticket_db.to_entity()

    def update(self, ticket: Ticket):
        try:
            _ticket = self.session.query(DBTicket).filter_by(id=ticket.id).one()
            ticket_db = DBTicket.from_entity(ticket, _ticket)
        except:
            raise

    def begin(self):
        self.session.begin()

    def commit(self):
        self.session.commit()

    def rollback(self):
        self.session.rollback()
