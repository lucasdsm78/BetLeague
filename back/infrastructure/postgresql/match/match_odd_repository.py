from typing import List, Optional

from sqlalchemy import select, delete, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from domain.match.model.match_odd import MatchOdd
from domain.match.repository.match_odd_repository import MatchOddRepository
from infrastructure.postgresql.match.db_match_odd import DBMatchOdd
from infrastructure.postgresql.ticket.db_match_choices import DBMatchChoices


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

    async def find_all_by_ids(self, odd_ids: List[int]) -> List[MatchOdd]:
        if not odd_ids:
            return []
        result = await self.session.execute(
            select(DBMatchOdd).where(DBMatchOdd.id.in_(odd_ids))
        )
        return [row.to_entity() for row in result.scalars().all()]

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

    async def upsert_many_for_match(self, match_id: int, odds: List[MatchOdd]) -> None:
        if not odds:
            return

        # 1. Load existing odds for this match
        result = await self.session.execute(
            select(DBMatchOdd).where(DBMatchOdd.match_id == match_id)
        )
        existing_db_odds = {
            (row.bet_type, row.value): row for row in result.scalars().all()
        }

        matched_keys: set[tuple[str, str]] = set()

        for o in odds:
            bet_type_val = o.bet_type.value if hasattr(o.bet_type, "value") else o.bet_type
            key = (bet_type_val, o.value)

            if key in existing_db_odds:
                # 2a. Update existing odd value (preserves the id for pending tickets)
                db_odd = existing_db_odds[key]
                db_odd.odd = o.odd
                matched_keys.add(key)
            else:
                # 2b. Insert new odd
                o.match_id = match_id
                self.session.add(DBMatchOdd.from_entity(o))
                matched_keys.add(key)

        # 3. Delete stale odds ONLY if no pending match_choices reference them
        stale_ids = [
            db_odd.id
            for key, db_odd in existing_db_odds.items()
            if key not in matched_keys
        ]

        if stale_ids:
            # Check which stale odds are referenced by pending match_choices
            ref_result = await self.session.execute(
                select(DBMatchChoices.match_odd_id)
                .where(DBMatchChoices.match_odd_id.in_(stale_ids))
                .distinct()
            )
            referenced_ids = {row[0] for row in ref_result.all()}

            safe_to_delete = [oid for oid in stale_ids if oid not in referenced_ids]
            if safe_to_delete:
                await self.session.execute(
                    delete(DBMatchOdd).where(DBMatchOdd.id.in_(safe_to_delete))
                )

        await self.session.flush()

    async def delete_by_match_id(self, match_id: int) -> None:
        await self.session.execute(
            delete(DBMatchOdd).where(DBMatchOdd.match_id == match_id)
        )
