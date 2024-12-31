from typing import List, Optional

from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm.session import Session
from domain.ticket.exception.ticket_exception import TicketNotFoundError
from domain.ticket.model.ticket import Ticket
from domain.ticket.repository.ticket_repository import TicketRepository
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
