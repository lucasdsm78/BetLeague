from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from domain.tournament.model.tournament import Tournament, TournamentStatus, StageType
from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.repository.tournament_repository import TournamentRepository
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl

class TournamentScheduler:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def process_tournaments(self):
        """Fonction principale appelée par un scheduler (ex: cron) chaque jour"""
        async with self.session_factory() as session:
            async with session.begin():
                tournament_repo = TournamentRepositoryImpl(session)

                # Récupérer tous les tournois actifs
                active_tournaments = await tournament_repo.find_all_by_status(TournamentStatus.IN_PROGRESS)

                # Traiter chaque tournoi
                for tournament in active_tournaments:
                    await self._process_tournament(tournament, tournament_repo)

    async def _process_tournament(self, tournament: Tournament, repo: TournamentRepository):
        now = datetime.now()

        # Trouver l'étape active
        active_stage = None
        for stage in tournament.stages:
            if stage.is_active:
                active_stage = stage
                break

        if not active_stage:
            return

        # Vérifier si l'étape est terminée
        if now >= active_stage.end_date:
            # Finaliser les résultats de cette étape
            await self._finalize_stage(tournament, active_stage, repo)

            # Passer à l'étape suivante
            await self._advance_to_next_stage(tournament, active_stage, repo)

    async def _finalize_stage(self, tournament: Tournament, stage, repo: TournamentRepository):
        # Marquer l'étape comme terminée
        stage.is_completed = True
        stage.is_active = False
        await repo.update_stage(stage)

        # Mettre à jour les matches et déterminer les gagnants
        for match in tournament.matches:
            if match.stage_id == stage.id and not match.winner_id:
                # Trouver le player avec le meilleur score BTL
                participant1 = next((p for p in tournament.players if p.id == match.participant1_id), None)
                participant2 = next((p for p in tournament.players if p.id == match.participant2_id), None)

                if player1 and player2:
                    if player1.btl_score > player2.btl_score:
                        match.winner_id = player1.id
                        match.loser_id = player2.id
                        player2.is_eliminated = True
                    else:
                        match.winner_id = player2.id
                        match.loser_id = player1.id
                        player1.is_eliminated = True

                    await repo.update_match(match)

                    # Mettre à jour les players
                    if player1.is_eliminated:
                        await repo.update_participant(participant1)
                    if player2.is_eliminated:
                        await repo.update_participant(participant2)

    async def _advance_to_next_stage(self, tournament: Tournament, completed_stage, repo: TournamentRepository):
        # Trouver la prochaine étape
        next_stage = None

        if completed_stage.type == StageType.ROUND_OF_16:
            next_stage = next((s for s in tournament.stages if s.type == StageType.QUARTER_FINAL), None)
        elif completed_stage.type == StageType.QUARTER_FINAL:
            next_stage = next((s for s in tournament.stages if s.type == StageType.SEMI_FINAL), None)
        elif completed_stage.type == StageType.SEMI_FINAL:
            next_stage = next((s for s in tournament.stages if s.type == StageType.FINAL), None)
        elif completed_stage.type == StageType.FINAL:
            # Le tournoi est terminé
            tournament.status = TournamentStatus.COMPLETED
            await repo.update(tournament)
            return

        if next_stage:
            # Activer la prochaine étape
            next_stage.is_active = True
            await repo.update_stage(next_stage)

            # Mettre à jour la phase actuelle des gagnants
            for match in tournament.matches:
                if match.stage_id == completed_stage.id and match.winner_id:
                    winner = next((p for p in tournament.participants if p.id == match.winner_id), None)
                    if winner:
                        winner.current_stage = next_stage.type
                        winner.btl_score = 0  # Réinitialiser le score pour la nouvelle étape
                        await repo.update_participant(winner)

            # Générer les matchs pour la nouvelle étape
            await self._generate_matches_for_stage(tournament, next_stage, repo)

    async def _generate_matches_for_stage(self, tournament: Tournament, stage, repo: TournamentRepository):
        # Récupérer les players qualifiés pour cette étape
        qualified_players = [p for p in tournament.players if p.current_stage == stage.type and not p.is_eliminated]

        # Mélanger les players pour des matchs aléatoires
        import random
        random.shuffle(qualified_players)

        # Créer les matchs
        for i in range(0, len(qualified_players), 2):
            if i + 1 < len(qualified_players):
                match = TournamentMatch(
                    tournament_id=tournament.id,
                    stage_id=stage.id,
                    player1_id=qualified_players[i].id,
                    player2_id=qualified_players[i+1].id
                )
                await repo.add_match(match)
