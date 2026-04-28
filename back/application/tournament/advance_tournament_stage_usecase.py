from __future__ import annotations

from abc import ABC, abstractmethod
import logging

from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_stage import TournamentStage
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from domain.tournament.service.tournament_progression_service import TournamentProgressionService
from domain.user.repository.user_repository import UserRepository


logger = logging.getLogger(__name__)


class AdvanceTournamentStageUseCase(ABC):

    @abstractmethod
    async def execute(
        self,
        *,
        tournament: Tournament,
        active_stage: TournamentStage,
        next_stage: TournamentStage | None,
        stage_matches: list,
        stage_players: list,
        tournament_repository: TournamentRepository,
        tournament_stage_repository: TournamentStageRepository,
        tournament_match_repository: TournamentMatchRepository,
        tournament_players_repository: TournamentPlayersRepository,
        user_repository: UserRepository,
    ) -> None:
        raise NotImplementedError


class AdvanceTournamentStageUseCaseImpl(AdvanceTournamentStageUseCase):
    def __init__(self, progression_service: TournamentProgressionService | None = None):
        self._progression_service = progression_service or TournamentProgressionService()

    async def execute(
        self,
        *,
        tournament: Tournament,
        active_stage: TournamentStage,
        next_stage: TournamentStage | None,
        stage_matches: list,
        stage_players: list,
        tournament_repository: TournamentRepository,
        tournament_stage_repository: TournamentStageRepository,
        tournament_match_repository: TournamentMatchRepository,
        tournament_players_repository: TournamentPlayersRepository,
        user_repository: UserRepository,
    ) -> None:
        finalized = self._progression_service.finalize_stage(
            stage=active_stage,
            matches=stage_matches,
            stage_players=stage_players,
        )
        logger.info(
            "tournament.stage.finalized",
            extra={
                "tournament_id": tournament.id,
                "stage_id": active_stage.id,
                "stage_type": active_stage.type,
                "resolved_matches_count": len(finalized.resolved_matches),
                "qualified_players_count": len(finalized.qualified_players),
                "eliminated_players_count": len(finalized.eliminated_players),
            },
        )

        await tournament_stage_repository.update_stage(finalized.stage)

        for match in finalized.resolved_matches:
            await tournament_match_repository.update(match)

        for eliminated_player in finalized.eliminated_players:
            await tournament_players_repository.update(eliminated_player)

        if next_stage is None:
            completed = self._progression_service.complete_tournament(
                tournament,
                qualified_players=finalized.qualified_players,
            )
            if completed.winner_user_id is not None and completed.payout_amount > 0:
                await user_repository.credit_btl(completed.winner_user_id, completed.payout_amount)
                logger.info(
                    "tournament.completed.payout_credited",
                    extra={
                        "tournament_id": tournament.id,
                        "winner_user_id": completed.winner_user_id,
                        "payout_amount": completed.payout_amount,
                    },
                )
            await tournament_repository.update(completed.tournament)
            logger.info(
                "tournament.completed",
                extra={
                    "tournament_id": tournament.id,
                    "winner_user_id": completed.winner_user_id,
                    "payout_amount": completed.payout_amount,
                },
            )
            return

        activated_next_stage = self._progression_service.activate_stage(next_stage)
        await tournament_stage_repository.update_stage(activated_next_stage)
        logger.info(
            "tournament.stage.activated",
            extra={
                "tournament_id": tournament.id,
                "stage_id": activated_next_stage.id,
                "stage_type": activated_next_stage.type,
            },
        )

        promoted_players = self._progression_service.promote_players_to_stage(
            finalized.qualified_players,
            stage_type=activated_next_stage.type,
        )
        for promoted_player in promoted_players:
            await tournament_players_repository.update(promoted_player)

        existing_matches = await tournament_match_repository.find_matches_by_stage_id(activated_next_stage.id)
        if existing_matches:
            logger.info(
                "tournament.stage.matches_existing",
                extra={
                    "tournament_id": tournament.id,
                    "stage_id": activated_next_stage.id,
                    "matches_count": len(existing_matches),
                },
            )
            return

        new_matches = self._progression_service.build_matches_for_stage(
            tournament_id=tournament.id,
            stage=activated_next_stage,
            qualified_players=promoted_players,
        )
        for match in new_matches:
            await tournament_match_repository.add_match(match)
        logger.info(
            "tournament.stage.matches_created",
            extra={
                "tournament_id": tournament.id,
                "stage_id": activated_next_stage.id,
                "stage_type": activated_next_stage.type,
                "matches_count": len(new_matches),
                "promoted_players_count": len(promoted_players),
            },
        )

