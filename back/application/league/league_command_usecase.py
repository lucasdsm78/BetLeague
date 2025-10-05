import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Callable, Optional
from sqlalchemy.ext.asyncio import AsyncSession

import shortuuid

from application.league.constants import MAX_PLAYERS, MIN_PLAYERS
from application.league.league_command_model import LeagueCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse, \
    LeaguePlayerDeletedResponse, LeagueInviteResponse, InvitationUpdateResponse, LeagueUpdateModel, \
    LeagueUpdateResponse, LeagueInjectBtlResponse
from domain.invitation.exception.invitation_exception import InvitationFoundError, InvitationNotFoundError
from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.exception.league_exception import LeagueNameAlreadyExistsError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError, LeagueNotFoundError, LeagueParticipantNotFoundError, LeagueAlreadyStartedError, \
    UserNotOwnerLeaguedError, UserNotInvitationLeaguedError, LeagueMustHaveNbBtlError, LeagueNbBtlIsNotEnoughError, \
    LeagueNotFinishedError, LeagueNotStartedError, LeagueFinishedError
from domain.league.model.league import League
from domain.league.model.league_players import LeaguePlayers
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.postgresql.invitation.invitation_repository import InvitationRepositoryImpl
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


class LeagueCommandUseCase(ABC):

    @abstractmethod
    async def create_league(self, free_league_model: LeagueCreateModel, email: str) -> LeagueFreeCreateResponse:
        raise NotImplementedError

    @abstractmethod
    async def join_league(self, league_id: int, email: str) -> LeagueJoinResponse:
        raise NotImplementedError

    @abstractmethod
    async def delete_league_player(self, id: int, email: str) -> LeaguePlayerDeletedResponse:
        raise NotImplementedError

    @abstractmethod
    async def invite_user(self, league_id: int, user_id: int, user_owner_email: str):
        raise NotImplementedError

    @abstractmethod
    async def update_invitation(self, invitation_id: int, action: bool, email: str):
        raise NotImplementedError

    @abstractmethod
    async def update_league(self, data: LeagueUpdateModel, league_id: int, email: str):
        raise NotImplementedError

    @abstractmethod
    async def process_payouts(self, as_of: datetime):
        raise NotImplementedError

    @abstractmethod
    async def inject_btl(self, league_id: int, amount: float, email: str) -> LeagueInjectBtlResponse:
        raise NotImplementedError


class LeagueCommandUseCaseImpl(LeagueCommandUseCase):

    def __init__(
            self,
            league_repository: LeagueRepository,
            user_repository: UserRepository,
            session_factory: Callable[[], AsyncSession],
            league_players_repository: LeaguePlayersRepository,
            invitation_repository: InvitationRepository,
    ):
        self.league_repository: LeagueRepository = league_repository
        self._session_factory = session_factory
        self.user_repository: UserRepository = user_repository
        self.league_players_repository: LeaguePlayersRepository = league_players_repository
        self.invitation_repository: InvitationRepository = invitation_repository

    async def create_league(
            self,
            data: LeagueCreateModel,
            email: str
    ) -> LeagueFreeCreateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo    = UserRepositoryImpl(session)
                league_repo  = LeagueRepositoryImpl(session)
                players_repo = LeaguePlayersRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                if await league_repo.find_by_name(data.name):
                    raise LeagueNameAlreadyExistsError

                if data.max_players > MAX_PLAYERS:
                    raise LeagueMaxPlayersError

                if data.is_free is False and (data.nb_btl is None or data.nb_btl <= 0):
                    raise LeagueMustHaveNbBtlError

                now_ms = int(datetime.utcnow().timestamp() * 1000)
                uuid = shortuuid.uuid()
                league = League(
                    is_free=data.is_free,
                    uuid=uuid,
                    nb_btl=data.nb_btl,
                    is_started=False,
                    name=data.name,
                    max_players=data.max_players,
                    is_private=data.is_private,
                    start_date=now_ms,
                    end_date=int((datetime.utcnow() + timedelta(weeks=1)).timestamp() * 1000),
                    nb_players_remaining=data.max_players - 1,
                    user=UserSummary(
                        id=user.id,
                        email=user.email,
                        pseudo=user.pseudo
                    )
                )

                await league_repo.create(league)
                league = await league_repo.find_by_uuid(uuid)

                await players_repo.join_league(
                    LeaguePlayers(user_id=user.id, league_id=league.id)
                )

        return LeagueFreeCreateResponse()

    async def join_league(self, league_id: int, email: str) -> LeagueJoinResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repository = UserRepositoryImpl(session)
                league_repository = LeagueRepositoryImpl(session)
                league_players_repository = LeaguePlayersRepositoryImpl(session)

                user = await user_repository.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                league = await league_repository.find_by_id(league_id)
                if not league:
                    raise LeagueNotFoundError

                is_participate = await league_players_repository.find_participation(
                    league_id=league_id,
                    user_id=user.id
                )
                if is_participate is True:
                    raise LeagueParticipantFoundError

                if league.nb_players_remaining == 0:
                    raise LeagueMaxPlayersError

                if not league.is_free:
                    if league.nb_btl is None or user.nb_btl < league.nb_btl:
                        raise LeagueNbBtlIsNotEnoughError

                unixtimestamp = int(datetime.utcnow().timestamp() * 1000)
                if (
                        league.nb_players_remaining != 0 and
                        league.nb_players_remaining - 1 <= MIN_PLAYERS
                        and unixtimestamp > league.start_date
                ):
                    league.is_started = True

                league.nb_players_remaining -= 1
                if not league.is_free and league.nb_btl is not None:
                    user.nb_btl -= league.nb_btl

                league_players = LeaguePlayers(
                    user_id=user.id,
                    league_id=league.id
                )

                await league_repository.update(league)
                await user_repository.update(user)
                await league_players_repository.join_league(league_players)

        return LeagueJoinResponse()

    async def delete_league_player(
            self,
            id: int,
            email: str
    ) -> LeaguePlayerDeletedResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo    = UserRepositoryImpl(session)
                league_repo  = LeagueRepositoryImpl(session)
                players_repo = LeaguePlayersRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                league = await league_repo.find_by_id(id)
                if not league:
                    raise LeagueNotFoundError

                if league.is_started:
                    raise LeagueAlreadyStartedError

                league_player = await players_repo.get_participation(
                    league_id=league.id,
                    user_id=user.id
                )

                if not league_player:
                    raise LeagueParticipantNotFoundError

                league.nb_players_remaining += 1
                if league.nb_players_remaining + 1 >= MIN_PLAYERS:
                    league.is_started = False

                await league_repo.update(league)
                await players_repo.delete_player(league_player.id)

        return LeaguePlayerDeletedResponse()

    async def invite_user(
            self,
            league_id: int,
            user_id: int,
            user_owner_email: str
    ) -> LeagueInviteResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo        = UserRepositoryImpl(session)
                league_repo      = LeagueRepositoryImpl(session)
                players_repo     = LeaguePlayersRepositoryImpl(session)
                invitation_repo  = InvitationRepositoryImpl(session)

                user_owner = await user_repo.find_by_email(user_owner_email)
                if not user_owner:
                    raise UserNotFoundError

                user = await user_repo.find_by_id(user_id)
                if not user:
                    raise UserNotFoundError

                league = await league_repo.find_by_id(league_id)
                if not league:
                    raise LeagueNotFoundError

                if user_owner.id != league.user.id:
                    raise UserNotOwnerLeaguedError

                if league.is_started:
                    raise LeagueAlreadyStartedError

                if await players_repo.find_participation(league_id, user.id):
                    raise LeagueParticipantFoundError

                if await invitation_repo.find_by_user_id_league_id(user.id, league.id):
                    raise InvitationFoundError

                if league.nb_players_remaining == 0:
                    raise LeagueMaxPlayersError

                if not league.is_free:
                    if league.nb_btl is None or user.nb_btl < league.nb_btl:
                        raise LeagueNbBtlIsNotEnoughError

                unixtimestamp = int(datetime.utcnow().timestamp() * 1000)
                if (
                        league.nb_players_remaining != 0 and
                        league.nb_players_remaining - 1 <= MIN_PLAYERS
                        and unixtimestamp > league.start_date
                ):
                    league.is_started = True

                league.nb_players_remaining -= 1
                if not league.is_free and league.nb_btl is not None:
                    user.nb_btl -= league.nb_btl

                invitation = Invitation(
                    league_id=league.id,
                    user_sender_id=user_owner.id,
                    user_id=user.id,
                    status=InvitationStatus.pending
                )
                await invitation_repo.add(invitation)

        return LeagueInviteResponse()

    async def update_invitation(
            self,
            invitation_id: int,
            action: bool,
            email: str
    ) -> InvitationUpdateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo        = UserRepositoryImpl(session)
                league_repo      = LeagueRepositoryImpl(session)
                players_repo     = LeaguePlayersRepositoryImpl(session)
                invitation_repo  = InvitationRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                invitation = await invitation_repo.find_by_id(invitation_id)
                if not invitation:
                    raise InvitationNotFoundError

                if user.id != invitation.user_id:
                    raise UserNotInvitationLeaguedError

                if action:
                    invitation.status = InvitationStatus.accepted
                    await self.join_league(league_id=invitation.league_id, email=email)
                else:
                    invitation.status = InvitationStatus.refused

                await invitation_repo.delete(invitation.id)

        return InvitationUpdateResponse()

    async def update_league(
            self,
            data: LeagueUpdateModel,
            league_id: int,
            email: str
    ) -> LeagueUpdateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo           = UserRepositoryImpl(session)
                league_repo         = LeagueRepositoryImpl(session)
                players_repo        = LeaguePlayersRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                league = await league_repo.find_by_id(league_id)
                if not league:
                    raise LeagueNotFoundError

                if league.user.id != user.id:
                    raise UserNotOwnerLeaguedError

                if data.name != league.name and await league_repo.find_by_name(data.name):
                    raise LeagueNameAlreadyExistsError

                if data.max_players > MAX_PLAYERS:
                    raise LeagueMaxPlayersError

                if league.is_started and (
                        data.max_players != league.max_players or
                        data.start_date   != league.start_date
                ):
                    raise LeagueAlreadyStartedError

                current_players = await players_repo.count_players(league_id=league.id)
                league.nb_players_remaining = data.max_players - current_players

                league.name       = data.name
                league.start_date = data.start_date
                league.max_players = data.max_players

                await league_repo.update(league)

        return LeagueUpdateResponse()

    async def process_payouts(self, as_of: datetime):
        async with self._session_factory() as session:
            async with session.begin():
                user_repo           = UserRepositoryImpl(session)
                league_repo         = LeagueRepositoryImpl(session)
                leagues = await league_repo.find_ended_before_not_paid(as_of)
                for league in leagues:
                    try:
                        if league.winner_id is None and league.can_determine_winner(as_of):
                            winner_id, _ = await league_repo.get_top_scorer(league.id)
                            if winner_id:
                                league.winner_id = winner_id
                                await league_repo.update(league)

                        if league.winner_id is not None:
                            amount = 200 if league.is_free else \
                                (await league_repo.count_players(league.id) * league.nb_btl)

                            await user_repo.credit_btl(league.winner_id, amount)

                    except LeagueNotFinishedError:
                        continue

    async def inject_btl(
            self,
            league_id: int,
            amount: float,
            email: str
    ) -> LeagueInjectBtlResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo = UserRepositoryImpl(session)
                league_repo = LeagueRepositoryImpl(session)
                players_repo = LeaguePlayersRepositoryImpl(session)

                if amount <= 0:
                    raise LeagueNbBtlIsNotEnoughError

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                if user.nb_btl_paid < amount:
                    raise LeagueNbBtlIsNotEnoughError

                league = await league_repo.find_by_id(league_id)
                if not league:
                    raise LeagueNotFoundError

                if not league.is_started:
                    raise LeagueNotStartedError

                if league.winner_id is not None:
                    raise LeagueFinishedError

                league_player = await players_repo.get_participation(league_id, user.id)
                if not league_player:
                    raise LeagueParticipantNotFoundError

                league_player.nb_btl += amount
                await players_repo.update(league_player)

                user.nb_btl_paid -= amount
                await user_repo.update(user)

        return LeagueInjectBtlResponse()
