from datetime import datetime

from domain.scheduler.tournament_scheduler import TournamentScheduler
from domain.tournament.model.tournament import Tournament, TournamentStatus
from domain.tournament.model.tournament_stage import StageType
from domain.tournament.model.tournament_match import TournamentMatch

from infrastructure.postgresql.tournament.tournament_repository import (
    TournamentRepositoryImpl,
)
from infrastructure.postgresql.tournament.tournament_stage_repository import (
    TournamentStageRepositoryImpl,
)
from infrastructure.postgresql.tournament.tournament_match_repository import (
    TournamentMatchRepositoryImpl,
)
from infrastructure.postgresql.tournament.tournament_players_repository import (
    TournamentPlayersRepositoryImpl,
)

class TournamentSchedulerImpl(TournamentScheduler):

    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def process_tournaments(self):
        """Fonction principale appelée par un scheduler (ex: cron) chaque jour"""
        async with self.session_factory() as session:
            async with session.begin():
                tournament_repo = TournamentRepositoryImpl(session)
                stage_repo = TournamentStageRepositoryImpl(session)
                match_repo = TournamentMatchRepositoryImpl(session)
                player_repo = TournamentPlayersRepositoryImpl(session)

                # Récupérer tous les tournois actifs
                active_tournaments = await tournament_repo.find_all_by_status(TournamentStatus.IN_PROGRESS.value)

                # Traiter chaque tournoi
                for tournament in active_tournaments:
                    await self._process_tournament(
                        tournament,
                        tournament_repo,
                        stage_repo,
                        match_repo,
                        player_repo,
                    )

    async def _process_tournament(
        self,
        tournament: Tournament,
        tournament_repo: TournamentRepositoryImpl,
        stage_repo: TournamentStageRepositoryImpl,
        match_repo: TournamentMatchRepositoryImpl,
        player_repo: TournamentPlayersRepositoryImpl,
    ):
        now = datetime.now()

        # Récupérer les étapes du tournoi
        stages = await stage_repo.find_all_by_tournament(tournament.id)

        # Trouver l'étape active
        active_stage = next((stage for stage in stages if stage.is_active), None)

        if not active_stage:
            return

        # Vérifier si l'étape est terminée
        if active_stage.end_date and now >= datetime.fromtimestamp(active_stage.end_date / 1000 if active_stage.end_date > 9999999999 else active_stage.end_date):
            # Finaliser les résultats de cette étape
            await self._finalize_stage(
                tournament,
                active_stage,
                stage_repo,
                match_repo,
                player_repo,
            )

            # Passer à l'étape suivante
            await self._advance_to_next_stage(
                tournament,
                active_stage,
                tournament_repo,
                stage_repo,
                match_repo,
                player_repo,
            )

    async def _finalize_stage(
        self,
        tournament: Tournament,
        stage,
        stage_repo: TournamentStageRepositoryImpl,
        match_repo: TournamentMatchRepositoryImpl,
        player_repo: TournamentPlayersRepositoryImpl,
    ):
        # Marquer l'étape comme terminée
        stage.is_completed = True
        stage.is_active = False
        await stage_repo.update_stage(stage)

        # Récupérer les matches et participants du tournoi
        matches = await match_repo.find_matches_by_tournament_id(tournament.id)
        participants = await player_repo.find_players_by_tournament_id(tournament.id)

        # Mettre à jour les matches et déterminer les gagnants
        for match in matches:
            if match.stage_id == stage.id and not match.winner_id:
                # Trouver le participant avec le meilleur score BTL
                participant1 = next((p for p in participants if p.id == match.player1_id), None)
                participant2 = next((p for p in participants if p.id == match.player2_id), None)

                if participant1 and participant2:
                    if participant1.nb_btl > participant2.nb_btl:
                        match.winner_id = participant1.id
                        match.loser_id = participant2.id
                        participant2.is_eliminated = True
                    else:
                        match.winner_id = participant2.id
                        match.loser_id = participant1.id
                        participant1.is_eliminated = True

                    await match_repo.update(match)

                    # Mettre à jour les participants
                    if participant1.is_eliminated:
                        await player_repo.update(participant1)

                    if participant2.is_eliminated:
                        await player_repo.update(participant2)

    async def _advance_to_next_stage(
            self,
            tournament: Tournament,
            completed_stage,
            tournament_repo: TournamentRepositoryImpl,
            stage_repo: TournamentStageRepositoryImpl,
            match_repo: TournamentMatchRepositoryImpl,
            player_repo: TournamentPlayersRepositoryImpl,
    ):
        # 1) Récupère et trie toutes les étapes
        stages = await stage_repo.find_all_by_tournament(tournament.id)
        stages.sort(key=lambda s: s.start_date)

        # 2) Trouve l'index de l'étape qu'on vient de terminer
        idx = next(
            (i for i, s in enumerate(stages) if s.id == completed_stage.id),
            None
        )

        # Si on ne trouve pas ou qu'on était déjà sur la dernière, on termine
        if idx is None or idx == len(stages) - 1:
            tournament.status = TournamentStatus.COMPLETED
            await tournament_repo.update(tournament)
            return

        # 3) Active la prochaine étape dans l'ordre chronologique
        next_stage = stages[idx + 1]
        next_stage.is_active = True
        await stage_repo.update_stage(next_stage)

        # 4) Promeut les gagnants de l'étape précédente
        matches = await match_repo.find_matches_by_tournament_id(tournament.id)
        participants = await player_repo.find_players_by_tournament_id(tournament.id)
        for m in matches:
            if m.stage_id == completed_stage.id and m.winner_id:
                winner = next((p for p in participants if p.id == m.winner_id), None)
                if winner:
                    winner.current_stage = next_stage.type
                    winner.btl_score = 0
                    await player_repo.update(winner)

        # 5) Génère les matchs pour la nouvelle étape
        await self._generate_matches_for_stage(tournament, next_stage, player_repo, match_repo)

    async def _generate_matches_for_stage(
        self,
        tournament: Tournament,
        stage,
        player_repo: TournamentPlayersRepositoryImpl,
        match_repo: TournamentMatchRepositoryImpl,
    ):
        # Récupérer les participants du tournoi
        participants = await player_repo.find_players_by_tournament_id(tournament.id)

        # Filtrer les participants qualifiés pour cette étape
        qualified_participants = [p for p in participants if p.current_stage == stage.type and not p.is_eliminated]

        # Mélanger les participants pour des matchs aléatoires
        import random
        random.shuffle(qualified_participants)

        # Créer les matchs
        for i in range(0, len(qualified_participants), 2):
            if i + 1 < len(qualified_participants):
                match = TournamentMatch(
                    tournament_id=tournament.id,
                    stage_id=stage.id,
                    type=stage.type,
                    player1_id=qualified_participants[i].id,
                    player2_id=qualified_participants[i+1].id
                )
                await match_repo.add_match(match)
