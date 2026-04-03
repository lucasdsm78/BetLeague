from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, UTC
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.league.model.league import LeagueStatus
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class LeaguePayoutUseCase(ABC):

    @abstractmethod
    async def get_due_league_ids(self, as_of: datetime) -> list[int]:
        raise NotImplementedError

    @abstractmethod
    async def process_league_payout(self, league_id: int, as_of: datetime) -> None:
        raise NotImplementedError


class LeaguePayoutUseCaseImpl(LeaguePayoutUseCase):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory

    @staticmethod
    def _normalize_as_of(as_of: datetime | None) -> datetime:
        if as_of is None:
            return datetime.now(UTC)
        if as_of.tzinfo is None:
            return as_of.replace(tzinfo=UTC)
        return as_of.astimezone(UTC)

    async def get_due_league_ids(self, as_of: datetime) -> list[int]:
        normalized_as_of = self._normalize_as_of(as_of)
        async with self._session_factory() as session:
            league_repo = LeagueRepositoryImpl(session)
            return await league_repo.find_due_payout_ids(normalized_as_of)

    async def process_league_payout(self, league_id: int, as_of: datetime) -> None:
        normalized_as_of = self._normalize_as_of(as_of)
        closed_at_ms = int(normalized_as_of.timestamp() * 1000)

        async with self._session_factory() as session:
            async with session.begin():
                user_repo = UserRepositoryImpl(session)
                league_repo = LeagueRepositoryImpl(session)

                league = await league_repo.find_by_id_for_update(league_id)
                if league is None:
                    return

                if league.status == LeagueStatus.CLOSED or league.closed_at is not None:
                    return

                if not league.can_determine_winner(normalized_as_of):
                    return

                winner_id = league.winner_id
                if winner_id is None:
                    winner_id, _ = await league_repo.get_top_scorer(league.id)

                reward_amount = None
                if winner_id is not None:
                    if league.is_free:
                        reward_amount = 200.0
                    else:
                        reward_amount = float((await league_repo.count_players(league.id)) * (league.nb_btl or 0))

                    if reward_amount > 0:
                        await user_repo.credit_btl(winner_id, reward_amount)

                league.close(
                    closed_at=closed_at_ms,
                    winner_id=winner_id,
                    rewarded_amount=reward_amount,
                )
                await league_repo.update(league)

