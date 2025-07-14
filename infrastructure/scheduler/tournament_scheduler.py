from datetime import datetime
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from domain.scheduler.tournament_scheduler import TournamentScheduler
from domain.tournament.model.tournament import Tournament, TournamentStatus
from domain.tournament.model.tournament_stage import StageType
from domain.tournament.model.tournament_match import TournamentMatch

from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_stage_repository import TournamentStageRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl


class TournamentSchedulerImpl(TournamentScheduler):

    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self.session_factory = session_factory

    async def process_tournaments(self):
        """Fonction principale appelée chaque jour par un cron."""
        async with self.session_factory() as session:
            async with session.begin():
                # Instanciation unique des repositories
                tr = TournamentRepositoryImpl(session)
                sr = TournamentStageRepositoryImpl(session)
                mr = TournamentMatchRepositoryImpl(session)
                pr = TournamentPlayersRepositoryImpl(session)

                active = await tr.find_all_by_status(TournamentStatus.IN_PROGRESS.value)
                for tournament in active:
                    await self._process_tournament(tournament, tr, sr, mr, pr)

    async def _process_tournament(
            self,
            tournament: Tournament,
            tr: TournamentRepositoryImpl,
            sr: TournamentStageRepositoryImpl,
            mr: TournamentMatchRepositoryImpl,
            pr: TournamentPlayersRepositoryImpl,
    ):
        now = datetime.now()
        stages = await sr.find_all_by_tournament(tournament.id)
        active_stage = next((s for s in stages if s.is_active), None)
        if not active_stage or not active_stage.end_date:
            return

        # Normalisation du timestamp (ms vs s)
        raw = active_stage.end_date
        end_dt = datetime.fromtimestamp(raw / 1000) if raw > 9_999_999_999 else datetime.fromtimestamp(raw)
        if now < end_dt:
            return

        # 1) Finaliser l’étape actuelle
        await self._finalize_stage(tournament, active_stage, sr, mr, pr)
        # 2) Passer à la suivante
        await self._advance_to_next_stage(tournament, active_stage, tr, sr, mr, pr)

    async def _finalize_stage(
            self,
            tournament: Tournament,
            stage,
            sr: TournamentStageRepositoryImpl,
            mr: TournamentMatchRepositoryImpl,
            pr: TournamentPlayersRepositoryImpl,
    ):
        # Clôturer l’étape
        stage.is_completed = True
        stage.is_active    = False
        await sr.update_stage(stage)

        # Déterminer et enregistrer les gagnants
        matches     = await mr.find_matches_by_tournament_id(tournament.id)
        participants = await pr.find_players_by_tournament_id(tournament.id)
        for m in matches:
            if m.stage_id != stage.id or m.winner_id:
                continue

            p1 = next((p for p in participants if p.id == m.player1_id), None)
            p2 = next((p for p in participants if p.id == m.player2_id), None)
            if not (p1 and p2):
                continue

            # Plus haut score BTL gagne
            if p1.nb_btl > p2.nb_btl:
                winner, loser = p1, p2
            else:
                winner, loser = p2, p1

            m.winner_id = winner.id
            m.loser_id  = loser.id
            loser.is_eliminated = True

            await mr.update(m)
            await pr.update(loser)

    async def _advance_to_next_stage(
            self,
            tournament: Tournament,
            completed_stage,
            tr: TournamentRepositoryImpl,
            sr: TournamentStageRepositoryImpl,
            mr: TournamentMatchRepositoryImpl,
            pr: TournamentPlayersRepositoryImpl,
    ):
        # 1) Charger et trier les étapes
        stages = await sr.find_all_by_tournament(tournament.id)
        stages.sort(key=lambda s: s.start_date)

        # 2) Repérer l'index de l'étape terminée
        idx = next((i for i, s in enumerate(stages) if s.id == completed_stage.id), None)
        if idx is None or idx == len(stages) - 1:
            # Dernière étape ou introuvable → terminer le tournoi
            tournament.status = TournamentStatus.COMPLETED
            await tr.update(tournament)
            return

        # 3) Activer la prochaine
        next_stage = stages[idx + 1]
        next_stage.is_active = True
        await sr.update_stage(next_stage)

        # 4) Promouvoir les gagnants
        matches      = await mr.find_matches_by_tournament_id(tournament.id)
        participants = await pr.find_players_by_tournament_id(tournament.id)
        for m in matches:
            if m.stage_id != completed_stage.id or not m.winner_id:
                continue
            winner = next((p for p in participants if p.id == m.winner_id), None)
            if winner:
                winner.current_stage = next_stage.type
                winner.btl_score     = 0
                await pr.update(winner)

        # 5) Ne pas recréer si déjà présent
        existing = await mr.find_matches_by_tournament_stages(
            tournament.id,
            next_stage.type.value
        )
        if existing:
            return

        # 6) Générer les nouveaux matchs
        await self._generate_matches_for_stage(tournament, next_stage, pr, mr)

    async def _generate_matches_for_stage(
            self,
            tournament: Tournament,
            stage,
            pr: TournamentPlayersRepositoryImpl,
            mr: TournamentMatchRepositoryImpl,
    ):
        # Filtrer les qualifiés (gagnants non éliminés)
        participants = await pr.find_players_by_tournament_id(tournament.id)
        qualified    = [
            p for p in participants
            if p.current_stage == stage.type and not p.is_eliminated
        ]
        if len(qualified) < 2:
            return

        import random
        random.shuffle(qualified)

        # Un seul match par paire
        for i in range(0, len(qualified), 2):
            match = TournamentMatch(
                tournament_id=tournament.id,
                stage_id   =stage.id,
                type       =stage.type,
                player1_id =qualified[i].id,
                player2_id =qualified[i+1].id,
            )
            await mr.add_match(match)
