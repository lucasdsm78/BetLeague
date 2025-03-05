import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
import shortuuid

from application.league.constants import MAX_PLAYERS, MIN_PLAYERS
from application.league.league_command_model import LeagueFreeCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse, \
    LeaguePlayerDeletedResponse, LeagueInviteResponse
from domain.invitation.exception.invitation_exception import InvitationFoundError
from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.exception.league_exception import LeagueNameAlreadyExistsError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError, LeagueNotFoundError, LeagueParticipantNotFoundError, LeagueAlreadyStartedError, \
    UserNotOwnerLeaguedError
from domain.league.model.league import League
from domain.league.model.league_players import LeaguePlayers
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository


class LeagueCommandUseCase(ABC):

    @abstractmethod
    def create_free_league(self, free_league_model: LeagueFreeCreateModel, email: str) -> LeagueFreeCreateResponse:
        raise NotImplementedError

    @abstractmethod
    def join_league(self, league_id: int, email: str) -> LeagueJoinResponse:
        raise NotImplementedError

    @abstractmethod
    def delete_league_player(self, league_id: int, email: str) -> LeaguePlayerDeletedResponse:
        raise NotImplementedError

    @abstractmethod
    def invite_user(self, league_id: int, user_id: int, user_owner_email: str):
        raise NotImplementedError


class LeagueCommandUseCaseImpl(LeagueCommandUseCase):

    def __init__(
            self,
            league_repository: LeagueRepository,
            user_repository: UserRepository,
            league_players_repository: LeaguePlayersRepository,
            invitation_repository: InvitationRepository,
    ):
        self.league_repository: LeagueRepository = league_repository
        self.user_repository: UserRepository = user_repository
        self.league_players_repository: LeaguePlayersRepository = league_players_repository
        self.invitation_repository: InvitationRepository = invitation_repository

    def create_free_league(self, data: LeagueFreeCreateModel, email: str) -> LeagueFreeCreateResponse:
        try:
            existing_user = self.user_repository.find_by_email(email)

            uuid = shortuuid.uuid()
            end_date = int((datetime.now() + timedelta(weeks=1)).timestamp())

            nb_players_remaining = data.max_players - 1

            league = League(
                is_free=True,
                uuid=uuid,
                is_started= False,
                name=data.name,
                max_players=data.max_players,
                is_private=data.is_private,
                start_date=int(datetime.now().timestamp() * 1000),
                end_date=end_date,
                nb_players_remaining=nb_players_remaining,
                user=UserSummary(id=existing_user.id, email=existing_user.email, pseudo=existing_user.pseudo)
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
            if not user:
                raise UserNotFoundError

            league = self.league_repository.find_by_id(league_id)
            if not league:
                raise LeagueNotFoundError

            is_participate = self.league_players_repository.find_participation(
                league_id=league_id,
                user_id=user.id
            )

            if is_participate is True:
                raise LeagueParticipantFoundError

            if league.nb_players_remaining == 0:
                raise LeagueMaxPlayersError

            league_players = LeaguePlayers(
                user_id=user.id,
                league_id=league.id
            )

            unixtimestamp = int(datetime.now().timestamp() * 1000)

            if (
                    league.nb_players_remaining != 0
                    and league.nb_players_remaining - 1 <= MIN_PLAYERS
                    and unixtimestamp > league.start_date
            ):
                league.is_started = True

            league.nb_players_remaining -= 1

            self.league_repository.update(league)
            self.league_repository.commit()
            self.league_players_repository.join_league(league_players)
            self.league_players_repository.commit()

        except:
            self.league_players_repository.rollback()
            self.league_repository.rollback()
            raise

        return LeagueJoinResponse()

    def delete_league_player(self, league_id: int, email: str) -> LeaguePlayerDeletedResponse:
        try:
            user = self.user_repository.find_by_email(email)
            if not user:
                raise UserNotFoundError

            league = self.league_repository.find_by_id(league_id)
            if not league:
                raise LeagueNotFoundError

            if league.is_started is True:
                raise LeagueAlreadyStartedError

            league_player = self.league_players_repository.get_participation(league.id, user.id)
            if not league_player:
                raise LeagueParticipantNotFoundError

            league.nb_players_remaining+=1
            if league.nb_players_remaining + 1 >= MIN_PLAYERS:
                league.is_started = False

            self.league_repository.update(league)
            self.league_repository.commit()
            self.league_players_repository.delete_player(league_player.id)
            self.league_players_repository.commit()
        except:
            self.league_players_repository.rollback()
            self.league_repository.rollback()
            raise

        return LeaguePlayerDeletedResponse()

    def invite_user(self, league_id: int, user_id: int, user_owner_email: str):
        try:
            user_owner = self.user_repository.find_by_email(user_owner_email)
            if not user_owner:
                raise UserNotFoundError

            user = self.user_repository.find_by_id(user_id)
            if not user:
                raise UserNotFoundError

            league = self.league_repository.find_by_id(league_id)
            if not league:
                raise LeagueNotFoundError

            if user_owner.id != league.user.id:
                raise UserNotOwnerLeaguedError

            if league.is_started is True:
                raise LeagueAlreadyStartedError

            is_participate = self.league_players_repository.find_participation(
                    league_id=league_id,
                    user_id=user.id
                )

            if is_participate is True:
                raise LeagueParticipantFoundError

            is_invitate = self.invitation_repository.find_by_user_id_league_id(user.id, league.id)
            if is_invitate is True:
                raise InvitationFoundError

            new_invitation = Invitation(
                league_id=league.id,
                user_id=user.id,
                status=InvitationStatus.pending
            )

            self.invitation_repository.add(new_invitation)
            self.invitation_repository.commit()

            return LeagueInviteResponse()

        except:
            self.invitation_repository.rollback()
            raise

