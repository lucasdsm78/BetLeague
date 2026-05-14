from typing import Union

from sqlalchemy import Column, ForeignKey, Integer

from infrastructure.postgresql.database import Base


class DBUserTicketCounter(Base):
    __tablename__ = 'user_ticket_counter'

    user_id: Union[int, Column] = Column(Integer, ForeignKey('user.id'), primary_key=True)
    next_value: Union[int, Column] = Column(Integer, nullable=False)

