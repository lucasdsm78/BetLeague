from datetime import datetime
import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.league.league_payout_usecase import LeaguePayoutUseCaseImpl
from domain.scheduler.league_payout_scheduler import LeaguePayoutScheduler


logger = logging.getLogger(__name__)


class LeaguePayoutSchedulerImpl(LeaguePayoutScheduler):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self._session_factory = session_factory
        self._payout_usecase = LeaguePayoutUseCaseImpl(session_factory=session_factory)

    async def process_due_payouts(self, as_of: datetime | None = None):
        run_at = as_of or datetime.utcnow()
        logger.info(
            "league_payout.batch_started",
            extra={
                "event": "league_payout.batch_started",
                "as_of": run_at.isoformat(),
            },
        )

        league_ids = await self._payout_usecase.get_due_league_ids(run_at)
        logger.info(
            "league_payout.batch_loaded",
            extra={
                "event": "league_payout.batch_loaded",
                "as_of": run_at.isoformat(),
                "due_league_ids": league_ids,
                "due_count": len(league_ids),
            },
        )

        for league_id in league_ids:
            logger.info(
                "league_payout.batch_processing_league",
                extra={
                    "event": "league_payout.batch_processing_league",
                    "league_id": league_id,
                    "as_of": run_at.isoformat(),
                },
            )
            await self._payout_usecase.process_league_payout(league_id=league_id, as_of=run_at)

        logger.info(
            "league_payout.batch_finished",
            extra={
                "event": "league_payout.batch_finished",
                "as_of": run_at.isoformat(),
                "due_count": len(league_ids),
            },
        )




