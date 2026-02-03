from __future__ import annotations

from sqlalchemy import BigInteger, Column, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from infrastructure.postgresql.database import Base


class DBOutboxMessage(Base):
    __tablename__ = "outbox_message"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_name = Column(String(120), nullable=False, index=True)
    aggregate_type = Column(String(80), nullable=False, index=True)
    aggregate_id = Column(BigInteger, nullable=False, index=True)
    payload = Column(JSONB, nullable=False)
    created_at = Column(BigInteger, nullable=False, index=True)
    processed_at = Column(BigInteger, nullable=True, index=True)
    locked_at = Column(BigInteger, nullable=True, index=True)
    locked_by = Column(String(80), nullable=True, index=True)
    attempts = Column(Integer, nullable=False, server_default="0")
    last_error = Column(Text, nullable=True)
