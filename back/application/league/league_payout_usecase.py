from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, UTC
import logging
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from application.events.outbox_event_bus import OutboxDomainEventBus
from domain.league.events.league_ended import LeagueEnded
from domain.league.model.league import LeagueStatus
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


logger = logging.getLogger(__name__)


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
            league_ids = await league_repo.find_due_payout_ids(normalized_as_of)
            logger.info(
                "league_payout.due_ids_loaded",
                extra={
                    "event": "league_payout.due_ids_loaded",
                    "as_of": normalized_as_of.isoformat(),
                    "due_league_ids": league_ids,
                    "due_count": len(league_ids),
                },
            )
            return league_ids

    async def process_league_payout(self, league_id: int, as_of: datetime) -> None:
        normalized_as_of = self._normalize_as_of(as_of)
        closed_at_ms = int(normalized_as_of.timestamp() * 1000)

        logger.info(
            "league_payout.processing_started",
            extra={
                "event": "league_payout.processing_started",
                "league_id": league_id,
                "as_of": normalized_as_of.isoformat(),
            },
        )

        try:
            async with self._session_factory() as session:
                async with session.begin():
                    user_repo = UserRepositoryImpl(session)
                    league_repo = LeagueRepositoryImpl(session)
                    outbox_bus = OutboxDomainEventBus(session)

                    league = await league_repo.find_by_id_for_update(league_id)
                    if league is None:
                        logger.info(
                            "league_payout.skipped",
                            extra={
                                "event": "league_payout.skipped",
                                "league_id": league_id,
                                "reason": "not_found_or_locked",
                                "as_of": normalized_as_of.isoformat(),
                            },
                        )
                        return

                    if league.status == LeagueStatus.CLOSED or league.closed_at is not None:
                        logger.info(
                            "league_payout.skipped",
                            extra={
                                "event": "league_payout.skipped",
                                "league_id": league_id,
                                "league_status": getattr(league.status, "value", league.status),
                                "reason": "already_closed",
                                "as_of": normalized_as_of.isoformat(),
                            },
                        )
                        return

                    if not league.can_determine_winner(normalized_as_of):
                        logger.info(
                            "league_payout.skipped",
                            extra={
                                "event": "league_payout.skipped",
                                "league_id": league_id,
                                "league_status": getattr(league.status, "value", league.status),
                                "reason": "winner_not_determinable_yet",
                                "as_of": normalized_as_of.isoformat(),
                                "league_end_date": league.end_date,
                            },
                        )
                        return

                    winner_id = league.winner_id
                    if winner_id is None:
                        winner_id, _ = await league_repo.get_top_scorer(league.id)
                        logger.info(
                            "league_payout.winner_resolved",
                            extra={
                                "event": "league_payout.winner_resolved",
                                "league_id": league.id,
                                "winner_id": winner_id,
                                "as_of": normalized_as_of.isoformat(),
                            },
                        )

                    if winner_id is None:
                        logger.warning(
                            "league_payout.skipped",
                            extra={
                                "event": "league_payout.skipped",
                                "league_id": league.id,
                                "reason": "winner_not_found",
                                "league_status": getattr(league.status, "value", league.status),
                                "as_of": normalized_as_of.isoformat(),
                            },
                        )
                        return

                    reward_amount = None
                    participants_count = None
                    if league.is_free:
                        reward_amount = 200.0
                    else:
                        participants_count = await league_repo.count_players(league.id)
                        reward_amount = float(participants_count * (league.nb_btl or 0))

                    if reward_amount <= 0:
                        logger.warning(
                            "league_payout.skipped",
                            extra={
                                "event": "league_payout.skipped",
                                "league_id": league.id,
                                "winner_id": winner_id,
                                "participants_count": participants_count,
                                "entry_btl": league.nb_btl,
                                "reason": "invalid_reward_amount",
                                "reward_amount": reward_amount,
                                "as_of": normalized_as_of.isoformat(),
                            },
                        )
                        return

                    await user_repo.credit_btl(winner_id, reward_amount)
                    winner = await user_repo.find_by_id(winner_id)
                    logger.info(
                        "league_payout.reward_credited",
                        extra={
                            "event": "league_payout.reward_credited",
                            "league_id": league.id,
                            "winner_id": winner_id,
                            "reward_amount": reward_amount,
                            "is_free": league.is_free,
                            "participants_count": participants_count,
                            "entry_btl": league.nb_btl,
                            "as_of": normalized_as_of.isoformat(),
                        },
                    )

                    league.close(
                        closed_at=closed_at_ms,
                        winner_id=winner_id,
                        rewarded_amount=reward_amount,
                    )
                    await league_repo.update(league)
                    await outbox_bus.publish(
                        LeagueEnded(
                            league_id=league.id,
                            league_name=league.name,
                            winner_id=winner_id,
                            winner_pseudo=winner.pseudo if winner is not None else "",
                            rewarded_amount=float(reward_amount),
                        )
                    )
                    logger.info(
                        "league_payout.closed",
                        extra={
                            "event": "league_payout.closed",
                            "league_id": league.id,
                            "winner_id": winner_id,
                            "reward_amount": reward_amount,
                            "closed_at": closed_at_ms,
                            "league_status": league.status.value,
                            "as_of": normalized_as_of.isoformat(),
                        },
                    )
        except Exception:
            logger.exception(
                "league_payout.failed",
                extra={
                    "event": "league_payout.failed",
                    "league_id": league_id,
                    "as_of": normalized_as_of.isoformat(),
                },
            )
            raise





