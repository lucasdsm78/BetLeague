from datetime import datetime
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.league.league_payout_usecase import LeaguePayoutUseCaseImpl
from domain.scheduler.league_payout_scheduler import LeaguePayoutScheduler


class LeaguePayoutSchedulerImpl(LeaguePayoutScheduler):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory
        self._payout_usecase = LeaguePayoutUseCaseImpl(session_factory=session_factory)

    async def process_due_payouts(self, as_of: datetime | None = None):
        run_at = as_of or datetime.utcnow()
        league_ids = await self._payout_usecase.get_due_league_ids(run_at)

        for league_id in league_ids:
            await self._payout_usecase.process_league_payout(league_id=league_id, as_of=run_at)



