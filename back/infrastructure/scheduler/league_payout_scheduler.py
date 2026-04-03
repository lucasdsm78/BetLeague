from datetime import datetime
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.league.league_command_usecase import LeagueCommandUseCaseImpl
from domain.scheduler.league_payout_scheduler import LeaguePayoutScheduler


class LeaguePayoutSchedulerImpl(LeaguePayoutScheduler):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory

    async def process_due_payouts(self, as_of: datetime | None = None):
        scheduler_usecase = LeagueCommandUseCaseImpl(
            league_repository=None,
            user_repository=None,
            session_factory=self._session_factory,
            league_players_repository=None,
            invitation_repository=None,
            event_bus=None,
        )
        await scheduler_usecase.process_payouts(as_of=as_of or datetime.utcnow())


