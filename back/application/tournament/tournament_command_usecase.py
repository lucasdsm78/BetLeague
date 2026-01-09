from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Callable

import shortuuid
from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse, TournamentStartResponse, TournamentUpdateModel, TournamentUpdateResponse,
)
from domain.ticket.model.ticket_status import TicketStatus
from domain.tournament.exception.tournament_exception import UserNotSubscribedError, TournamentNotFoundError, \
    TournamentNotOwnerLeaguedError, TournamentNameAlreadyExistsError, TournamentAlreadyStartedError, \
    NotEnoughPaidPlayersError
from domain.tournament.model.stage_type import StageType
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_stage import TournamentStage
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.model.tournament_match import TournamentMatch
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament import TournamentRepositoryImpl, TournamentPlayersRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_stage_repository import TournamentStageRepositoryImpl
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

    @abstractmethod
    async def update(self, data: TournamentUpdateModel, tournament_id: int, email: str):
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
                players_repo = TournamentPlayersRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                existing = await tournament_repo.find_by_name(data.name)
                if existing is not None:
                    raise TournamentNameAlreadyExistsError

                uuid = shortuuid.uuid()
                now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

                # Le back impose le format actuel (16 joueurs) pour éviter toute manipulation côté client
                max_players = 16
                tournament = Tournament(
                    uuid=uuid,
                    name=data.name,
                    is_private=data.is_private,
                    max_players=max_players,
                    current_players=0,
                    prize_pool=0,
                    entry_fee=5.0,
                    status=TournamentStatus.PENDING,
                    start_date=now_ms,
                    end_date=int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp() * 1000),
                    user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
                )

                await tournament_repo.create(tournament)

                created_tournament = await tournament_repo.find_by_uuid(uuid)

                # Auto-inscription du créateur (atomique, pas de second appel API)
                existing_player = await players_repo.get_player(created_tournament.id, user.id)
                if not existing_player:
                    player = TournamentPlayer(
                        user_id=user.id,
                        tournament_id=created_tournament.id,
                        nb_btl=100,
                        is_eliminated=False,
                    )
                    await players_repo.add_player(player)

                    created_tournament.current_players += 1
                    created_tournament.prize_pool += created_tournament.entry_fee
                    await tournament_repo.update(created_tournament)

        return TournamentCreateResponse(
            tournament_id=created_tournament.id,
            tournament_uuid=created_tournament.uuid,
            name=created_tournament.name,
        )

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
                    nb_btl=100,
                    is_eliminated=False
                )
                await players_repo.add_player(player)

                tournament.current_players += 1
                tournament.prize_pool += tournament.entry_fee

                await tournament_repo.update(tournament)

                owner_email = tournament.user.email.value
                tournament_full = tournament.current_players >= tournament.max_players

                if tournament_full:
                    pass

        if tournament_full:
            await self.start_tournament(tournament_id, owner_email)

        return TournamentJoinResponse()

    async def start_tournament(self, tournament_id: int, email: str) -> TournamentStartResponse:
        async with self._session_factory() as session:
            async with session.begin():
                tournament_repo = TournamentRepositoryImpl(session)
                user_repo = UserRepositoryImpl(session)
                tournament_stage_repository = TournamentStageRepositoryImpl(session)
                tournament_player_repo = TournamentPlayersRepositoryImpl(session)

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
                now = datetime.utcnow()
                now_timestamp = int(now.timestamp() * 1000)
                tournament.start_date = now_timestamp
                tournament.end_date = int((now + timedelta(days=7)).timestamp() * 1000)
                tournament.status = TournamentStatus.IN_PROGRESS

                # Créer les étapes du tournoi
                stages = []

                # 8èmes de finales
                round_of_8_stage = TournamentStage(
                    user_id=user.id,
                    tournament_id=tournament.id,
                    type=StageType.EIGHTH_FINAL,
                    start_date=now_timestamp,
                    end_date=int((now + timedelta(days=2)).timestamp() * 1000),
                    is_active=True
                )
                stages.append(round_of_8_stage)
                start_date_next = now + timedelta(days=2)
                start_date_next_timestamp = int(start_date_next.timestamp() * 1000)

                # Quarts de finale
                quarter_final_stage = TournamentStage(
                    user_id=user.id,
                    tournament_id=tournament.id,
                    type=StageType.QUARTER_FINAL,
                    start_date=start_date_next_timestamp,
                    end_date=int((start_date_next + timedelta(days=2)).timestamp() * 1000),
                    is_active=False
                )
                stages.append(quarter_final_stage)

                # Demi-finales
                semi_final_stage = TournamentStage(
                    user_id=user.id,
                    tournament_id=tournament.id,
                    type=StageType.SEMI_FINAL,
                    start_date=int((start_date_next + timedelta(days=2)).timestamp() * 1000),
                    end_date=int((start_date_next + timedelta(days=4)).timestamp() * 1000),
                    is_active=False
                )
                stages.append(semi_final_stage)

                # Finale
                final_stage = TournamentStage(
                    user_id=user.id,
                    tournament_id=tournament.id,
                    type=StageType.FINAL,
                    start_date=int((start_date_next + timedelta(days=4)).timestamp() * 1000),
                    end_date=int((start_date_next + timedelta(days=5)).timestamp() * 1000),
                    is_active=False
                )
                stages.append(final_stage)

                # Sauvegarder les étapes
                for stage in stages:
                    await tournament_stage_repository.add_stage(stage)

                await tournament_repo.update(tournament)

                # Générer les matchs pour la première étape active
                await self._generate_matches_for_active_stage(tournament.id, session)

                return TournamentStartResponse()

    async def _generate_matches_for_active_stage(self, tournament_id: int, session: AsyncSession):

        # Instancier les repositories avec la session
        stage_repository = TournamentStageRepositoryImpl(session)
        player_repository = TournamentPlayersRepositoryImpl(session)
        match_repository = TournamentMatchRepositoryImpl(session)

        # Récupérer l'étape active
        active_stage = await stage_repository.get_active_stage(tournament_id)
        if not active_stage:
            return

        if active_stage.type == StageType.EIGHTH_FINAL:
            # Tous les joueurs non éliminés participent
            players = await player_repository.get_non_eliminated_players(tournament_id)
        else:
            # Seuls les joueurs de l'étape courante non éliminés participent
            players = await player_repository.find_players_by_stage(
                tournament_id,
                active_stage.type
            )

        if len(players) < 2:
            return

        # Mélanger les joueurs pour des matchs aléatoires
        import random
        random.shuffle(players)
        matches = []

        # Créer les matchs
        for i in range(0, len(players), 2):
            if i + 1 < len(players):
                match = TournamentMatch(
                    tournament_id=tournament_id,
                    stage_id=active_stage.id,
                    player1_id=players[i].id,
                    player2_id=players[i + 1].id,
                    type=active_stage.type,
                )
                matches.append(match)

        for match in matches:
            await match_repository.add_match(match)


    async def update_tournament_btl_scores(self, ticket_id: int):
            async with self._session_factory() as session:
                async with session.begin():
                    ticket_repo = TicketRepositoryImpl(session)
                    tournament_repo = TournamentRepositoryImpl(session)
                    tournament_player_repo = TournamentPlayersRepositoryImpl(session)

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
                                await tournament_player_repo.update_participant(player)


    async def update(
                self,
                data: TournamentUpdateModel,
                tournament_id: int,
                email: str
        ) -> TournamentUpdateResponse:
            async with self._session_factory() as session:
                async with session.begin():

                    user_repo = UserRepositoryImpl(session)
                    tournament_repo = TournamentRepositoryImpl(session)

                    user = await user_repo.find_by_email(email)
                    if not user:
                        raise UserNotFoundError

                    tournament = await tournament_repo.find_by_id(tournament_id)
                    if not tournament:
                        raise TournamentNotFoundError

                    if tournament.user.id != user.id:
                        raise TournamentNotOwnerLeaguedError

                    if data.name != tournament.name and await tournament_repo.find_by_name(data.name):
                        raise TournamentNameAlreadyExistsError

                    if tournament.status.value != TournamentStatus.PENDING.value:
                        raise TournamentAlreadyStartedError

                    tournament.name       = data.name
                    tournament.start_date = data.start_date
                    tournament.is_private = data.is_private
                    tournament.end_date = data.end_date

                    await tournament_repo.update(tournament)

            return TournamentUpdateResponse()
