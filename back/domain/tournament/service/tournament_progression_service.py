from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.model.tournament_stage import TournamentStage
from domain.tournament.model.tournament_status import TournamentStatus


@dataclass(slots=True)
class FinalizedTournamentStageResult:
    stage: TournamentStage
    resolved_matches: list[TournamentMatch]
    eliminated_players: list[TournamentPlayer]
    qualified_players: list[TournamentPlayer]


@dataclass(slots=True)
class CompletedTournamentResult:
    tournament: Tournament
    winner_user_id: int | None
    payout_amount: float


class TournamentProgressionService:
    """Encapsule les règles métier de progression d'un tournoi."""

    _BRACKET_STAGES: dict[int, list[StageType]] = {
        4: [StageType.SEMI_FINAL, StageType.FINAL],
        8: [StageType.QUARTER_FINAL, StageType.SEMI_FINAL, StageType.FINAL],
        16: [StageType.EIGHTH_FINAL, StageType.QUARTER_FINAL, StageType.SEMI_FINAL, StageType.FINAL],
    }

    def stage_types_for_bracket_size(self, max_players: int) -> list[StageType]:
        normalized = Tournament.validate_max_players(max_players)
        return self._BRACKET_STAGES[normalized][:]

    def build_stages_for_tournament(
        self,
        *,
        tournament: Tournament,
        owner_user_id: int,
        start_ms: int,
    ) -> list[TournamentStage]:
        stages: list[TournamentStage] = []
        current_start_ms = start_ms

        for index, stage_type in enumerate(self.stage_types_for_bracket_size(tournament.max_players)):
            duration_days = 1 if stage_type == StageType.FINAL else 2
            end_ms = current_start_ms + int(timedelta(days=duration_days).total_seconds() * 1000)
            stages.append(
                TournamentStage(
                    user_id=owner_user_id,
                    tournament_id=tournament.id,
                    type=stage_type,
                    start_date=current_start_ms,
                    end_date=end_ms,
                    is_active=index == 0,
                )
            )
            current_start_ms = end_ms

        return stages

    @staticmethod
    def _pick_match_winner(
        player1: TournamentPlayer,
        player2: TournamentPlayer,
    ) -> tuple[TournamentPlayer, TournamentPlayer]:
        # Comportement actuel conservé pour éviter une régression fonctionnelle:
        # en cas d'égalité, player2 l'emporte.
        if player1.nb_btl > player2.nb_btl:
            return player1, player2
        return player2, player1

    @staticmethod
    def _normalize_match_players(
        player1: TournamentPlayer,
        player2: TournamentPlayer,
    ) -> tuple[TournamentPlayer, TournamentPlayer]:
        if (player1.id or 0) <= (player2.id or 0):
            return player1, player2
        return player2, player1

    def finalize_stage(
        self,
        *,
        stage: TournamentStage,
        matches: list[TournamentMatch],
        stage_players: list[TournamentPlayer],
    ) -> FinalizedTournamentStageResult:
        stage.is_completed = True
        stage.is_active = False

        players_by_id = {player.id: player for player in stage_players if player.id is not None}
        qualified_by_id: dict[int, TournamentPlayer] = {}
        resolved_matches: list[TournamentMatch] = []
        eliminated_players: list[TournamentPlayer] = []

        for match in matches:
            if match.winner_id is not None:
                winner = players_by_id.get(match.winner_id)
                if winner is not None and winner.id is not None:
                    qualified_by_id[winner.id] = winner
                continue

            player1 = players_by_id.get(match.player1_id)
            player2 = players_by_id.get(match.player2_id)
            if player1 is None or player2 is None:
                continue

            winner, loser = self._pick_match_winner(player1, player2)
            match.winner_id = winner.id
            match.loser_id = loser.id
            loser.is_eliminated = True

            resolved_matches.append(match)
            eliminated_players.append(loser)
            if winner.id is not None:
                qualified_by_id[winner.id] = winner

        if not matches and len(stage_players) == 1:
            only_player = stage_players[0]
            if only_player.id is not None:
                qualified_by_id[only_player.id] = only_player

        return FinalizedTournamentStageResult(
            stage=stage,
            resolved_matches=resolved_matches,
            eliminated_players=eliminated_players,
            qualified_players=list(qualified_by_id.values()),
        )

    @staticmethod
    def activate_stage(stage: TournamentStage) -> TournamentStage:
        stage.is_active = True
        return stage

    @staticmethod
    def promote_players_to_stage(
        players: list[TournamentPlayer],
        *,
        stage_type: StageType,
        reset_btl_to: float = Tournament.DEFAULT_PLAYER_START_BTL,
    ) -> list[TournamentPlayer]:
        for player in players:
            player.current_stage = stage_type
            player.nb_btl = reset_btl_to
        return players

    def build_matches_for_stage(
        self,
        *,
        tournament_id: int,
        stage: TournamentStage,
        qualified_players: list[TournamentPlayer],
    ) -> list[TournamentMatch]:
        eligible_players = [player for player in qualified_players if not player.is_eliminated]
        if len(eligible_players) < 2:
            return []

        seeded_players = sorted(eligible_players, key=lambda player: ((player.id or 0), player.user_id))

        matches: list[TournamentMatch] = []
        for index in range(0, len(seeded_players) - 1, 2):
            player1, player2 = self._normalize_match_players(
                seeded_players[index],
                seeded_players[index + 1],
            )
            matches.append(
                TournamentMatch(
                    tournament_id=tournament_id,
                    stage_id=stage.id,
                    type=stage.type,
                    player1_id=player1.id,
                    player2_id=player2.id,
                )
            )
        return matches

    @staticmethod
    def complete_tournament(
        tournament: Tournament,
        *,
        qualified_players: list[TournamentPlayer],
    ) -> CompletedTournamentResult:
        winner_user_id = qualified_players[0].user_id if len(qualified_players) == 1 else None
        payout_amount = float(tournament.prize_pool or 0.0) if winner_user_id is not None else 0.0

        tournament.winner_id = winner_user_id
        tournament.status = TournamentStatus.COMPLETED

        return CompletedTournamentResult(
            tournament=tournament,
            winner_user_id=winner_user_id,
            payout_amount=payout_amount,
        )


