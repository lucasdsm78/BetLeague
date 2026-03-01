from typing import List, Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from domain.match.model.match_odd import MatchOdd
from domain.match.repository.match_odd_repository import MatchOddRepository
from infrastructure.postgresql.match.db_match_odd import DBMatchOdd


class MatchOddRepositoryImpl(MatchOddRepository):

    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_many(self, odds: List[MatchOdd]) -> None:
        if not odds:
            return
        db_odds = [DBMatchOdd.from_entity(o) for o in odds]
        self.session.add_all(db_odds)
        await self.session.flush()

    async def find_by_match_id(self, match_id: int) -> List[MatchOdd]:
        result = await self.session.execute(
            select(DBMatchOdd).where(DBMatchOdd.match_id == match_id)
        )
        return [row.to_entity() for row in result.scalars().all()]

    async def find_by_id(self, odd_id: int) -> Optional[MatchOdd]:
        result = await self.session.execute(
            select(DBMatchOdd).where(DBMatchOdd.id == odd_id)
        )
        row = result.scalar_one_or_none()
        return row.to_entity() if row else None

    async def find_pending_by_match_ids(self, match_ids: List[int]) -> List[MatchOdd]:
        if not match_ids:
            return []
        result = await self.session.execute(
            select(DBMatchOdd).where(
                DBMatchOdd.match_id.in_(match_ids),
                DBMatchOdd.result.is_(None),
            )
        )
        return [row.to_entity() for row in result.scalars().all()]

    async def bulk_update_results(self, updates: List[dict]) -> None:
        if not updates:
            return

        def _do_bulk(sess):
            sess.bulk_update_mappings(DBMatchOdd, updates)

        await self.session.run_sync(_do_bulk)

    async def delete_by_match_id(self, match_id: int) -> None:
        await self.session.execute(
            delete(DBMatchOdd).where(DBMatchOdd.match_id == match_id)
        )
