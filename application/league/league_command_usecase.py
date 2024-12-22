from abc import ABC, abstractmethod
from datetime import datetime
import shortuuid

from application.league.league_command_model import LeagueFreeCreateModel, LeagueFreeCreateResponse
from domain.league.exception.league_exception import LeagueNameAlreadyExistsError
from domain.league.model.league import League
from domain.league.repository.league_repository import LeagueRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository


class LeagueCommandUseCase(ABC):

    @abstractmethod
    def create_free_league(self, free_league_model: LeagueFreeCreateModel, email: str) -> LeagueFreeCreateResponse:
        raise NotImplementedError


class LeagueCommandUseCaseImpl(LeagueCommandUseCase):

    def __init__(
            self,
            league_repository: LeagueRepository,
            user_repository: UserRepository
    ):
        self.league_repository: LeagueRepository = league_repository
        self.user_repository: UserRepository = user_repository

    def create_free_league(self, data: LeagueFreeCreateModel, email: str) -> LeagueFreeCreateResponse:
        try:
            existing_user = self.user_repository.find_by_email(email)

            uuid = shortuuid.uuid()

            league = League(
                is_free=True,
                uuid=uuid,
                name=data.name,
                max_players=data.max_players,
                is_private=data.is_private,
                start_date=int(datetime.now().timestamp() * 1000),
                end_date=data.end_date,
                user=UserSummary(id=existing_user.id, email=existing_user.email)
            )

            existing_league = self.league_repository.find_by_name(data.name)
            if existing_league is True:
                raise LeagueNameAlreadyExistsError

            self.league_repository.create(league)
            self.league_repository.commit()

        except:
            self.league_repository.rollback()
            raise

        return LeagueFreeCreateResponse()
