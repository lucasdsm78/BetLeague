from abc import ABC, abstractmethod
from datetime import datetime, timedelta
import shortuuid

from application.league.constants import MAX_PLAYERS, MIN_PLAYERS
from application.league.league_command_model import LeagueFreeCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse
from domain.league.exception.league_exception import LeagueNameAlreadyExistsError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError
from domain.league.model.league import League
from domain.league.model.league_players import LeaguePlayers
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository


class LeagueCommandUseCase(ABC):

    @abstractmethod
    def create_free_league(self, free_league_model: LeagueFreeCreateModel, email: str) -> LeagueFreeCreateResponse:
        raise NotImplementedError

    @abstractmethod
    def join_league(self, league_id: int, email: str) -> LeagueJoinResponse:
        raise NotImplementedError


class LeagueCommandUseCaseImpl(LeagueCommandUseCase):

    def __init__(
            self,
            league_repository: LeagueRepository,
            user_repository: UserRepository,
            league_players_repository: LeaguePlayersRepository,
    ):
        self.league_repository: LeagueRepository = league_repository
        self.user_repository: UserRepository = user_repository
        self.league_players_repository = league_players_repository

    def create_free_league(self, data: LeagueFreeCreateModel, email: str) -> LeagueFreeCreateResponse:
        try:
            existing_user = self.user_repository.find_by_email(email)

            uuid = shortuuid.uuid()
            end_date = int((datetime.now() + timedelta(weeks=1)).timestamp())

            league = League(
                is_free=True,
                uuid=uuid,
                name=data.name,
                max_players=data.max_players,
                is_private=data.is_private,
                start_date=int(datetime.now().timestamp() * 1000),
                end_date=end_date,
                user=UserSummary(id=existing_user.id, email=existing_user.email)
            )

            existing_league = self.league_repository.find_by_name(data.name)
            if existing_league is True:
                raise LeagueNameAlreadyExistsError

            if data.max_players > MAX_PLAYERS:
                raise LeagueMaxPlayersError

            self.league_repository.create(league)
            self.league_repository.commit()

            league_created = self.league_repository.find_by_uuid(league.uuid)

            league_player = LeaguePlayers(
                user_id=existing_user.id,
                league_id=league_created.id
            )

            self.league_players_repository.join_league(league_player)
            self.league_players_repository.commit()

        except:
            self.league_repository.rollback()
            raise

        return LeagueFreeCreateResponse()

    def join_league(self, league_id: int, email: str) -> LeagueJoinResponse:
        try:
            user = self.user_repository.find_by_email(email)
            league = self.league_repository.find_by_id(league_id)

            is_participate = self.league_players_repository.find_participation(
                league_id=league_id,
                user_id=user.id
            )

            if is_participate is True:
                raise LeagueParticipantFoundError

            league_players = LeaguePlayers(
                user_id=user.id,
                league_id=league.id
            )

            current_count_players = self.league_players_repository.count_players(league.id)
            if current_count_players == league.max_players:
                raise LeagueMaxPlayersError

            count_players = self.league_players_repository.count_players(league_id=league.id)
            if count_players != 0 and count_players == MIN_PLAYERS - 1:
                league.is_started = True
                self.league_repository.update(league)
                self.league_repository.commit()

            self.league_players_repository.join_league(league_players)
            self.league_players_repository.commit()

        except:
            self.league_players_repository.rollback()
            raise

        return LeagueJoinResponse()
