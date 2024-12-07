from functools import lru_cache
from typing import Iterator

from sqlalchemy.orm import Session

from app.infrastructure.config import Settings
from app.infrastructure.postgresql.database import SessionLocal


def get_session() -> Iterator[Session]:
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@lru_cache()
def get_settings() -> Settings:
    return Settings()
