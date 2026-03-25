from abc import ABC, abstractmethod
from typing import Callable

from sqlalchemy.ext.asyncio.session import AsyncSession

from application.tournament.tournament_query_model import TournamentReadModel, TournamentStageReadModel, \
    TournamentMatchReadModel, TournamentsRegisteredResponse, TournamentAvailablePublicReadModel, \
    TournamentsAvailablePublicResponse, TournamentFinishedResponse, TournamentFinishedReadModel, \
    TournamentCreatedResponse, TournamentCreatedReadModel, TournamentCreationAccessResponse
from application.user.user_query_model import UserSummaryReadModel
from domain.tournament.exception.tournament_exception import TournamentNotFoundError, TournamentStageNotFoundError
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from domain.tournament.service.tournament_creation_policy import TournamentCreationPolicy, current_month_window_ms
from domain.tournament_subscription.repository.tournament_subscription_repository import TournamentSubscriptionRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.repository.user_repository import UserRepository


class TournamentQueryUseCase(ABC):

    @abstractmethod
    async def get_tournament_stages(self, tournament_id: int, email: str):
        raise NotImplementedError

    @abstractmethod
    async def get_stage_matches(self, tournament_id: int, stage: str, email: str):
        raise NotImplementedError

    @abstractmethod
    async def get_user_tournaments_in_progress(self, email: str, page: int = 1, page_size: int = 10) -> TournamentsRegisteredResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_available_tournaments_public(self, email: str, page: int = 1, page_size: int = 10) -> TournamentsAvailablePublicResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_tournaments_finished(self, email: str, page: int = 1, page_size: int = 10) -> TournamentFinishedResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_tournaments_created(self, user_id: int, page: int = 1, page_size: int = 10) -> TournamentCreatedResponse:
        raise NotImplementedError

    @abstractmethod
    async def get_tournament_creation_access(self, email: str) -> TournamentCreationAccessResponse:
        raise NotImplementedError


class TournamentQueryUseCaseImpl(TournamentQueryUseCase):

    def __init__(
            self,
            session_factory: Callable[[], AsyncSession],
            tournament_repository: TournamentRepository,
            tournament_stage_repository: TournamentStageRepository,
            user_repository: UserRepository,
            stage_repository: TournamentStageRepository,
            tournament_match_repository: TournamentMatchRepository,
            tournament_subscription_repository: TournamentSubscriptionRepository,
            creation_policy: TournamentCreationPolicy | None = None,
    ):
        self.tournament_repository: TournamentRepository = tournament_repository
        self._session_factory = session_factory
        self.user_repository: UserRepository = user_repository
        self.tournament_stage_repository: TournamentStageRepository = tournament_stage_repository
        self.stage_repository: TournamentStageRepository = stage_repository
        self.tournament_match_repository: TournamentMatchRepository = tournament_match_repository
        self.tournament_subscription_repository: TournamentSubscriptionRepository = tournament_subscription_repository
        self.creation_policy = creation_policy or TournamentCreationPolicy()

    class Config:
        arbitrary_types_allowed = True

    async def get_tournament_stages(self, tournament_id: int, email: str) -> dict:
        result = {"stages": []}
        async with self._session_factory() as session:
            async with session.begin():

                user = await self.user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                tournament = await self.tournament_repository.find_by_id(tournament_id)
                if not tournament:
                    raise TournamentNotFoundError

                stages = await self.stage_repository.find_all_by_tournament(tournament_id)

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

    async def get_stage_matches(self, tournament_id: int, stage: str, email: str):
        result = {"matches": []}
        async with self._session_factory() as session:
            async with session.begin():

                user = await self.user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                tournament = await self.tournament_repository.find_by_id(tournament_id)
                if not tournament:
                    raise TournamentNotFoundError

                tournament_stage = await self.stage_repository.find_by_id(tournament.id, stage)
                if not tournament_stage:
                    raise TournamentStageNotFoundError

                matches = await self.tournament_match_repository.find_matches_by_tournament_stages(tournament.id, stage)

                player_ids = set()
                for match in matches:
                    player_ids.add(match.player1_id)
                    player_ids.add(match.player2_id)

                players = await self.user_repository.find_users_by_ids(list(player_ids))

                for match in matches:
                    player1 = players[match.player1_id]
                    player2 = players[match.player2_id]

                    match_model = TournamentMatchReadModel(
                        id=match.id,
                        tournament_id=match.tournament_id,
                        stage=tournament_stage.type.value,
                        winner_id=match.winner_id,
                        loser_id=match.loser_id,
                        player1_summary=UserSummaryReadModel(
                            id=player1.id,
                            email=player1.email.value,
                            pseudo=player1.pseudo
                        ),
                        player2_summary=UserSummaryReadModel(
                            id=player2.id,
                            email=player2.email.value,
                            pseudo=player2.pseudo
                        ),
                        start_date=tournament_stage.start_date,
                        end_date=tournament_stage.end_date
                    )
                    result["matches"].append(match_model.dict())

        return result

    async def get_user_tournaments_in_progress(self, email: str, page: int = 1, page_size: int = 10) -> TournamentsRegisteredResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)

        async with self._session_factory() as session:
            async with session.begin():

                user = await self.user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                offset = (page - 1) * page_size

                tournaments, total_count = await self.tournament_repository.find_all_by_user_participant(
                    user.id, page_size, offset
                )

                response = TournamentsRegisteredResponse(
                    page_size=page_size,
                    total_count=total_count,
                    page=page,
                    tournaments=[TournamentReadModel.from_entity(t) for t in tournaments]
                )

                return response

    async def get_available_tournaments_public(self, email: str, page: int = 1, page_size: int = 10) -> TournamentsAvailablePublicResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)

        async with self._session_factory() as session:
            async with session.begin():

                user = await self.user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                offset = (page - 1) * page_size

                tournaments, total_count = await self.tournament_repository.find_available_tournaments_public(
                    user.id, page_size, offset
                )

                response = TournamentsAvailablePublicResponse(
                    page_size=page_size,
                    total_count=total_count,
                    page=page,
                    tournaments=[TournamentAvailablePublicReadModel.from_entity(t) for t in tournaments]
                )

                return response

    async def get_tournaments_finished(self, email: str, page: int = 1, page_size: int = 10) -> TournamentFinishedResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)

        async with self._session_factory() as session:
            async with session.begin():

                user = await self.user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                offset = (page - 1) * page_size

                tournaments, total_count = await self.tournament_repository.find_finished_tournaments(
                    user.id, page_size, offset
                )

                response = TournamentFinishedResponse(
                    page_size=page_size,
                    total_count=total_count,
                    page=page,
                    tournaments=[TournamentFinishedReadModel.from_entity(t) for t in tournaments]
                )

                return response

    async def get_tournaments_created(self, user_id: int, page: int = 1, page_size: int = 10) -> TournamentCreatedResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)

        async with self._session_factory() as session:
            async with session.begin():
                offset = (page - 1) * page_size

                tournaments, total_count = await self.tournament_repository.find_created_tournaments(
                    user_id, page_size, offset
                )

                response = TournamentCreatedResponse(
                    page_size=page_size,
                    total_count=total_count,
                    page=page,
                    tournaments=[TournamentCreatedReadModel.from_entity(t) for t in tournaments]
                )

                return response

    async def get_tournament_creation_access(self, email: str) -> TournamentCreationAccessResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user = await self.user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                month_start_ms, next_month_start_ms = current_month_window_ms()
                monthly_used = await self.tournament_repository.count_created_by_user_between(
                    user.id,
                    month_start_ms,
                    next_month_start_ms,
                )
                subscription = await self.tournament_subscription_repository.find_active_by_user_id(user.id)
                access = self.creation_policy.evaluate(
                    has_active_subscription=bool(subscription and subscription.is_active()),
                    monthly_free_tournaments_used=monthly_used,
                )
                return TournamentCreationAccessResponse(**access.__dict__)
