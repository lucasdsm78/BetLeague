from abc import ABC, abstractmethod
from typing import Optional, List, Callable

from pydantic import BaseModel
from sqlalchemy.ext.asyncio.session import AsyncSession

from application.tournament.tournament_query_model import TournamentReadModel, TournamentStageReadModel, \
    TournamentStagesResponse
from application.user.user_query_model import UserSummaryReadModel
from domain.tournament import Tournament
from domain.tournament.exception.tournament_exception import TournamentNotFoundError
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.tournament import TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_stage_repository import TournamentStageRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class TournamentQueryUseCase(ABC):

    @abstractmethod
    async def get_tournament_stages(self, tournament_id: int, email: str):
        raise NotImplementedError


class TournamentQueryUseCaseImpl(TournamentQueryUseCase):

    def __init__(
            self,
            session_factory: Callable[[], AsyncSession],
            tournament_repository: TournamentRepository,
            tournament_stage_repository: TournamentStageRepository,
            user_repository: UserRepository
    ):
        self.tournament_repository: TournamentRepository = tournament_repository
        self._session_factory = session_factory
        self.user_repository: UserRepository = user_repository
        self.tournament_stage_repository: TournamentStageRepository = tournament_stage_repository

    class Config:
        arbitrary_types_allowed = True

    async def get_tournament_stages(self, tournament_id: int, email: str) -> dict:
        result = {"stages": []}
        async with self._session_factory() as session:
            async with session.begin():

                user_repo = UserRepositoryImpl(session)
                tournament_repo = TournamentRepositoryImpl(session)
                stage_repo = TournamentStageRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                tournament = await tournament_repo.find_by_id(tournament_id)
                if not tournament:
                    raise TournamentNotFoundError

                stages = await stage_repo.find_all_by_tournament(tournament_id)

                for stage in stages:
                    stage_model = TournamentStageReadModel(
                        id=stage.id,
                        tournament_id=stage.tournament_id,
                        user_summary=UserSummaryReadModel(
                            id=user.id,
                            email=user.email.value,
                            pseudo=user.pseudo
                        ),
                        type=stage.type.value,
                        is_active=stage.is_active,
                        is_completed=stage.is_completed,
                        created_at=stage.created_at,
                        start_date=stage.start_date,
                        end_date=stage.end_date
                    )
                    result["stages"].append(stage_model.dict())

        return result
