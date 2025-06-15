from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Callable

import shortuuid
from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse, TournamentStartResponse,
)
from domain.ticket.model.ticket_status import TicketStatus
from domain.tournament.exception.tournament_exception import UserNotSubscribedError, TournamentNotFoundError
from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_stage import TournamentStage
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.model.tournament_status import TournamentStatus
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class TournamentCommandUseCase(ABC):
    @abstractmethod
    async def create_tournament(self, data: TournamentCreateModel, email: str) -> TournamentCreateResponse:
        raise NotImplementedError

    @abstractmethod
    async def join_tournament(self, tournament_id: int, email: str) -> TournamentJoinResponse:
        raise NotImplementedError

    @abstractmethod
    async def start_tournament(self, tournament_id: int, email: str) -> TournamentStartResponse:
        raise NotImplementedError


class TournamentCommandUseCaseImpl(TournamentCommandUseCase):
    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
    ):
        self._session_factory = session_factory

    async def create_tournament(self, data: TournamentCreateModel, email: str) -> TournamentCreateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo = UserRepositoryImpl(session)
                tournament_repo = TournamentRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                uuid = shortuuid.uuid()
                now_ms = int(datetime.now().timestamp() * 1000)
                tournament = Tournament(
                    uuid=uuid,
                    name=data.name,
                    is_private=data.is_private,
                    start_date=now_ms,
                    end_date=int((datetime.now() + timedelta(days=7)).timestamp() * 1000),
                    user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
                )

                await tournament_repo.create(tournament)

                created_tournament = await tournament_repo.find_by_uuid(uuid)

        await self.join_tournament(created_tournament.id, email)

        return TournamentCreateResponse()

    async def join_tournament(self, tournament_id: int, email: str) -> TournamentJoinResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo = UserRepositoryImpl(session)
                tournament_repo = TournamentRepositoryImpl(session)
                players_repo = TournamentPlayersRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                tournament = await tournament_repo.find_by_id(tournament_id)
                if not tournament:
                    raise TournamentNotFoundError

                if tournament.current_players >= tournament.max_players:
                    raise ValueError("Tournament full")

                if tournament.status != TournamentStatus.PENDING:
                    raise ValueError("Impossible de rejoindre un tournoi déjà commencé")

                existing_player = await players_repo.get_player(tournament.id, user.id)
                if existing_player:
                    raise ValueError("User already joined the tournament")

                player = TournamentPlayer(
                    user_id=user.id,
                    tournament_id=tournament.id,
                    nb_btl=0,
                    is_eliminated=False
                )
                await players_repo.add_player(player)

                tournament.current_players += 1
                tournament.prize_pool += tournament.entry_fee
                await tournament_repo.update(tournament)

        return TournamentJoinResponse()

    async def start_tournament(self, tournament_id: int, email: str) -> Tournament:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_repo = TournamentRepositoryImpl(session)
                user_repo = UserRepositoryImpl(session)

                tournament = await tournament_repo.find_by_id(tournament_id)
                if not tournament:
                    raise ValueError("Tournoi introuvable")

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                if tournament.user.id != user.id:
                    raise ValueError("Seul le créateur du tournoi peut le démarrer")

                if tournament.current_players < tournament.min_players:
                    raise ValueError(f"Minimum {tournament.min_players} players requis pour démarrer le tournoi")

                if tournament.status != TournamentStatus.PENDING:
                    raise ValueError("Le tournoi a déjà commencé ou est terminé")

                # Définir les dates du tournoi
                now = datetime.now()
                tournament.start_date = now
                tournament.end_date = now + timedelta(days=7)
                tournament.status = TournamentStatus.IN_PROGRESS

                # Créer les étapes du tournoi
                stages = []

                # 8èmes de finales
                round_of_8_stage = TournamentStage(
                    tournament_id=tournament.id,
                    type=StageType.EIGHTH_FINAL,
                    start_date=now,
                    end_date=now + timedelta(days=2),
                    is_active=True
                )
                stages.append(round_of_8_stage)
                start_date_next = now + timedelta(days=2)

                # Quarts de finale
                quarter_final_stage = TournamentStage(
                    tournament_id=tournament.id,
                    type=StageType.QUARTER_FINAL,
                    start_date=start_date_next,
                    end_date=start_date_next + timedelta(days=2),
                    is_active=tournament.current_players <= 16
                )
                stages.append(quarter_final_stage)

                # Demi-finales
                semi_final_stage = TournamentStage(
                    tournament_id=tournament.id,
                    type=StageType.SEMI_FINAL,
                    start_date=start_date_next + timedelta(days=2),
                    end_date=start_date_next + timedelta(days=4),
                    is_active=False
                )
                stages.append(semi_final_stage)

                # Finale
                final_stage = TournamentStage(
                    tournament_id=tournament.id,
                    type=StageType.FINAL,
                    start_date=start_date_next + timedelta(days=4),
                    end_date=start_date_next + timedelta(days=5),  # 1 jour pour la finale
                    is_active=False
                )
                stages.append(final_stage)

                # Sauvegarder les étapes
                for stage in stages:
                    await self.tournament_stage_repository.add_stage(stage)

                # Générer les matchs pour la première étape active
                await self._generate_matches_for_active_stage(tournament)

                # Mettre à jour le tournoi
                return await tournament_repo.update(tournament)

    async def _generate_matches_for_active_stage(self, tournament: Tournament):
        # Trouver l'étape active
        active_stage = None
        for stage in tournament.stages:
            if stage.is_active:
                active_stage = stage
                break

        if not active_stage:
            return

        # Définir les players pour cette étape
        players = []
        if active_stage.type == StageType.EIGHTH_FINAL:
            # Tous les players participent
            players = [p for p in tournament.players if not p.is_eliminated]
        else:
            # Seuls les gagnants de l'étape précédente participent
            players = [p for p in tournament.players if p.current_stage == active_stage.type and not p.is_eliminated]

        # Mélanger les players pour des matchs aléatoires
        import random
        random.shuffle(players)

        # Créer les matchs
        matches = []
        for i in range(0, len(players), 2):
            if i + 1 < len(players):
                match = TournamentMatch(
                    tournament_id=tournament.id,
                    stage_id=active_stage.id,
                    player1_id=players[i].id,
                    player2_id=players[i+1].id
                )
                matches.append(match)

        # Sauvegarder les matchs
        for match in matches:
            await self.tournament_match_repository.add_match(match)


    async def update_tournament_btl_scores(self, ticket_id: int):
        async with self._session_factory() as session:
            async with session.begin():
                ticket_repo = TicketRepositoryImpl(session)
                tournament_repo = TournamentRepositoryImpl(session)

                ticket = await ticket_repo.find_by_id(ticket_id)
                if not ticket or ticket.status != TicketStatus.correct:
                    return

                active_tournaments = await tournament_repo.find_all_active_by_participant(ticket.user_id)

                for tournament in active_tournaments:
                    # Trouver le player
                    player = next((p for p in tournament.players if p.user_id == ticket.user_id and not p.is_eliminated), None)
                    if player:
                        # Trouver l'étape active
                        active_stage = next((s for s in tournament.stages if s.is_active), None)
                        if active_stage and player.current_stage == active_stage.type:
                            # Calculer les BTL gagnés (1 BTL par euro gagné)
                            btl_gained = int(ticket.gain)

                            # Mise à jour du score BTL
                            player.btl_score += btl_gained

                            # Sauvegarder
                            await tournament_repo.update_participant(player)
