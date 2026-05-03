import logging
from abc import ABC, abstractmethod
from typing import Callable, Dict

from application.match.match_command_model import NoMatchScoreUpdatedResponse, MatchScoreUpdatedResponse
from domain.match.event.match_result_resolved_event import MatchResultResolvedEvent
from domain.match.model.match_status import MatchStatus
from domain.match.service.odds_result_calculator import calculate_result
from domain.match.unit_of_work import MatchScoreUnitOfWork
from domain.services.match_score_api.match_score_api import MatchScoreApi

logger = logging.getLogger(__name__)


class MatchCommandUseCase(ABC):

    @abstractmethod
    async def check_scores_v2(self):
        raise NotImplementedError


class MatchCommandUseCaseImpl(MatchCommandUseCase):

    def __init__(
            self,
            match_score_api: MatchScoreApi,
            uow_factory: Callable[[], MatchScoreUnitOfWork],
    ):
        self.match_score_api: MatchScoreApi = match_score_api
        self._uow_factory = uow_factory

    async def check_scores_v2(self):
        async with self._uow_factory() as uow:
            to_update = []
            finished_scores: Dict[int, tuple] = {}
            resolved_match_ids: set[int] = set()

            finished_no_winner = await uow.match_repo.find_finished_without_winner()
            logger.info("match.score_check.finished_without_winner_loaded", extra={"matches_count": len(finished_no_winner)})
            for match in finished_no_winner:
                new_winner = match.determine_winner()
                if new_winner:
                    to_update.append({
                        "id": match.id,
                        "score_home": match.score_home,
                        "score_away": match.score_away,
                        "status": match.status.value,
                        "winner": new_winner,
                    })
                    finished_scores[match.id] = (match.score_home, match.score_away)
                    if match.winner != new_winner:
                        resolved_match_ids.add(match.id)

            fixture_ids = await uow.match_repo.find_active_fixture_ids()
            logger.info("match.score_check.active_fixture_ids_loaded", extra={"fixture_ids_count": len(fixture_ids)})

            api_results = []
            if fixture_ids:
                api_results = await self.match_score_api.get_live_scores(fixture_ids)
                logger.info("match.score_check.api_results_loaded", extra={"fixture_ids_count": len(fixture_ids), "api_results_count": len(api_results)})
                if not api_results:
                    sample = fixture_ids[:20]
                    logger.info("match.score_check.api_results_empty", extra={"fixture_ids_sample": sample})

                api_fixture_ids = [r["api_fixture_id"] for r in api_results]
                matches_by_fixture = await uow.match_repo.find_all_by_api_fixture_ids(api_fixture_ids)
                match_dict = {m.api_fixture_id: m for m in matches_by_fixture}

                for result in api_results:
                    match = match_dict.get(result["api_fixture_id"])
                    if not match:
                        continue

                    match.score_home = result.get("score_home")
                    match.score_away = result.get("score_away")
                    try:
                        match.status = MatchStatus.from_str(result.get("status", "NS"))
                    except Exception:
                        match.status = MatchStatus.NOT_STARTED

                    new_winner = match.determine_winner()

                    to_update.append({
                        "id": match.id,
                        "score_home": match.score_home,
                        "score_away": match.score_away,
                        "status": match.status.value,
                        "winner": new_winner,
                    })

                    if match.status.is_finished() and new_winner:
                        finished_scores[match.id] = (match.score_home, match.score_away)
                        if match.winner != new_winner:
                            resolved_match_ids.add(match.id)
            else:
                logger.info("match.score_check.api_results_loaded", extra={"fixture_ids_count": 0, "api_results_count": 0})

            logger.info("match.score_check.updates_prepared", extra={"to_update_count": len(to_update), "resolved_events_count": len(resolved_match_ids), "finished_scores_count": len(finished_scores)})

            if to_update:
                await uow.match_repo.bulk_update_scores(to_update)

            if finished_scores:
                odds = await uow.match_odd_repo.find_by_match_ids(list(finished_scores.keys()))
                if odds:
                    odd_updates = []
                    odd_changed_match_ids: set[int] = set()
                    for odd in odds:
                        scores = finished_scores.get(odd.match_id)
                        if scores is None or scores[0] is None or scores[1] is None:
                            continue
                        result_val = calculate_result(odd.bet_type, odd.value, scores[0], scores[1])
                        if odd.result == result_val:
                            continue
                        odd_updates.append({"id": odd.id, "result": result_val})
                        odd_changed_match_ids.add(odd.match_id)
                    if odd_updates:
                        await uow.match_odd_repo.bulk_update_results(odd_updates)
                        resolved_match_ids.update(odd_changed_match_ids)
                        logger.info(
                            "match.score_check.odds_resolved",
                            extra={
                                "odd_updates_count": len(odd_updates),
                                "affected_matches_count": len(odd_changed_match_ids),
                            },
                        )

            for match_id in sorted(resolved_match_ids):
                await uow.outbox_bus.publish(MatchResultResolvedEvent(match_id=match_id))

            await uow.commit()

            if to_update or finished_scores:
                logger.info("match.score_check.completed", extra={"updated_matches_count": len(to_update), "finished_scores_count": len(finished_scores), "published_events_count": len(resolved_match_ids)})
                return MatchScoreUpdatedResponse()

            logger.info("match.score_check.noop")
            return NoMatchScoreUpdatedResponse()
