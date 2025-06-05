from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Callable

import shortuuid
from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.tournament_command_model import (
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentJoinResponse,
)
from domain.tournament.model.tournament import Tournament, TournamentStage
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
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


class TournamentCommandUseCaseImpl(TournamentCommandUseCase):
    def __init__(
        self,
        tournament_repository: TournamentRepository,
        tournament_players_repository: TournamentPlayersRepository,
        user_repository: UserRepository,
        session_factory: Callable[[], AsyncSession],
    ):
        self.tournament_repository = tournament_repository
        self.tournament_players_repository = tournament_players_repository
        self.user_repository = user_repository
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

                uuid = shortuuid.uuid()
                now_ms = int(datetime.now().timestamp() * 1000)
                tournament = Tournament(
                    uuid=uuid,
                    name=data.name,
                    is_private=data.is_private,
                    max_players=data.max_players,
                    start_date=now_ms,
                    end_date=int((datetime.now() + timedelta(days=7)).timestamp() * 1000),
                    user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
                )

                await tournament_repo.create(tournament)
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
                    raise ValueError("Tournament not found")

                if await players_repo.count_players(tournament_id) >= tournament.max_players:
                    raise ValueError("Tournament full")

                player = TournamentPlayer(
                    user_id=user.id,
                    tournament_id=tournament.id,
                    nb_btl=0,
                    stage=tournament.stage,
                )
                await players_repo.add_player(player)
        return TournamentJoinResponse()
