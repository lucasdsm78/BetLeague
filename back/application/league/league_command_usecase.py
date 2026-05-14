import time
import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional
from sqlalchemy.ext.asyncio import AsyncSession

import shortuuid

from application.league.constants import LEAGUE_DURATION_DAYS, MAX_PLAYERS
from application.league.league_command_model import LeagueCreateModel, LeagueFreeCreateResponse, LeagueJoinResponse, \
    LeaguePlayerDeletedResponse, LeagueInviteResponse, InvitationUpdateResponse, LeagueUpdateModel, \
    LeagueUpdateResponse, LeagueInjectBtlResponse, InvitationDeleteResponse, LeagueStartResponse
from application.events.event_bus import DomainEventBus
from domain.league.events.league_invitation_created import LeagueInvitationCreated
from domain.league.events.league_invitation_accepted import LeagueInvitationAccepted
from domain.league.events.league_invitation_refused import LeagueInvitationRefused
from domain.league.events.league_minimum_players_reached import LeagueMinimumPlayersReached
from domain.league.events.league_started import LeagueStarted
from domain.invitation.exception.invitation_exception import InvitationFoundError, InvitationNotFoundError, InvitationDeletionNotAllowedError
from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.exception.league_exception import LeagueNameAlreadyExistsError, LeagueMaxPlayersError, \
    LeagueParticipantFoundError, LeagueNotFoundError, LeagueParticipantNotFoundError, LeagueAlreadyStartedError, \
    UserNotOwnerLeaguedError, UserNotInvitationLeaguedError, LeagueMustHaveNbBtlError, LeagueNbBtlIsNotEnoughError, \
    LeagueNotStartedError, LeagueFinishedError, LeagueNotThePlayerError, LeagueMinimumPlayersNotReachedError
from domain.league.model.league import League, LeagueStatus
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


logger = logging.getLogger(__name__)


def _hash_identifier(value: str) -> str:
    normalized = (value or "").strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class _NoOpDomainEventBus(DomainEventBus):
    async def publish(self, event):
        return None


class LeagueCommandUseCase(ABC):

    @abstractmethod
    async def create_league(self, free_league_model: LeagueCreateModel, email: str) -> LeagueFreeCreateResponse:
        raise NotImplementedError

    @abstractmethod
    async def join_league(self, league_id: int, email: str) -> LeagueJoinResponse:
        raise NotImplementedError

    @abstractmethod
    async def delete_league_player(self, league_id: int, email: str) -> LeaguePlayerDeletedResponse:
        raise NotImplementedError

    @abstractmethod
    async def start_league(self, league_id: int, email: str) -> LeagueStartResponse:
        raise NotImplementedError

    @abstractmethod
    async def delete_invitation(self, invitation_id: int, user_email: str):
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
    async def inject_btl(self, league_id: int, amount: float, email: str) -> LeagueInjectBtlResponse:
        raise NotImplementedError


class LeagueCommandUseCaseImpl(LeagueCommandUseCase):

    def __init__(
            self,
            league_repository: LeagueRepository | None,
            user_repository: UserRepository | None,
            session_factory: Callable[[], AsyncSession],
            league_players_repository: LeaguePlayersRepository | None,
            invitation_repository: InvitationRepository | None,
            event_bus: DomainEventBus | None,
    ):
        self.league_repository: LeagueRepository | None = league_repository
        self._session_factory = session_factory
        self.user_repository: UserRepository | None = user_repository
        self.league_players_repository: LeaguePlayersRepository | None = league_players_repository
        self.invitation_repository: InvitationRepository | None = invitation_repository
        self._event_bus: DomainEventBus = event_bus or _NoOpDomainEventBus()

    @staticmethod
    def _league_is_closed(league) -> bool:
        if league is None:
            return False
        if getattr(league, "is_closed", False):
            return True
        status = getattr(league, "status", None)
        if isinstance(status, LeagueStatus):
            return status == LeagueStatus.CLOSED
        return status == LeagueStatus.CLOSED.value

    async def _publish_minimum_players_reached_if_needed(
            self,
            *,
            league: League,
            previous_current_players_count: int,
            previous_min_players: int,
            current_players_count: int,
    ) -> None:
        league.current_players_count = current_players_count
        if league.is_started or self._league_is_closed(league):
            return

        previously_met = int(previous_current_players_count) >= int(previous_min_players)
        currently_met = league.has_minimum_players(current_players_count)
        if previously_met or not currently_met:
            return

        await self._event_bus.publish(
            LeagueMinimumPlayersReached(
                league_id=int(league.id),
                league_name=league.name,
                owner_user_id=int(league.user.id),
                min_players=int(league.min_players),
                current_players_count=int(current_players_count),
            )
        )

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

                if not data.is_free and data.nb_btl is not None:
                    ok = await user_repo.debit_btl_if_enough(user_id=user.id, amount=float(data.nb_btl))
                    if not ok:
                        raise LeagueNbBtlIsNotEnoughError

                now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
                start_ms = data.start_date if data.start_date is not None else now_ms
                end_ms = start_ms + int(timedelta(days=LEAGUE_DURATION_DAYS).total_seconds() * 1000)
                uuid = shortuuid.uuid()
                league = League(
                    is_free=data.is_free,
                    uuid=uuid,
                    nb_btl=data.nb_btl,
                    is_started=False,
                    status=LeagueStatus.OPEN,
                    name=data.name,
                    max_players=data.max_players,
                    min_players=data.min_players,
                    is_private=data.is_private,
                    start_date=start_ms,
                    end_date=end_ms,
                    nb_players_remaining=data.max_players - 1,
                    current_players_count=1,
                    user=UserSummary(
                        id=user.id,
                        email=user.email,
                        pseudo=user.pseudo
                    )
                )

                await league_repo.create(league)
                league = await league_repo.find_by_uuid(uuid)

                # Ajout idempotent du créateur comme membre (UPSERT côté repo)
                await players_repo.join_league(
                    LeaguePlayers(user_id=user.id, league_id=league.id)
                )

                logger.info(
                    "league.created",
                    extra={
                        "league_id": league.id,
                        "league_uuid": league.uuid,
                        "owner_user_id": user.id,
                        "owner_email_hash": _hash_identifier(email),
                        "is_private": league.is_private,
                        "is_free": league.is_free,
                        "max_players": league.max_players,
                        "min_players": league.min_players,
                    },
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

                # Vérifie participation AVANT de consommer une place/BTL
                is_participate = await league_players_repository.find_participation(
                    league_id=league_id,
                    user_id=user.id
                )
                if is_participate is True:
                    raise LeagueParticipantFoundError

                # Lock ligue + décrémentation atomique des places
                league_snapshot = await league_repository.find_by_id(league_id)
                if self._league_is_closed(league_snapshot):
                    raise LeagueFinishedError

                league = await league_repository.decrement_players_remaining_if_available(league_id)
                if league is None:
                    # ligue pleine
                    raise LeagueMaxPlayersError

                previous_current_players_count = await league_players_repository.count_players(league.id)

                # Pour ligue payante: débit atomique après lock league.
                # Si débit échoue, on annule la transaction (rollback) => la place est rendue.
                if not league.is_free and league.nb_btl is not None:
                    ok = await user_repository.debit_btl_if_enough(user_id=user.id, amount=float(league.nb_btl))
                    if not ok:
                        raise LeagueNbBtlIsNotEnoughError

                # Enregistre membership (UPSERT)
                await league_players_repository.join_league(
                    LeaguePlayers(
                        user_id=user.id,
                        league_id=league.id,
                    )
                )

                current_players_count = previous_current_players_count + 1
                await self._publish_minimum_players_reached_if_needed(
                    league=league,
                    previous_current_players_count=previous_current_players_count,
                    previous_min_players=league.min_players,
                    current_players_count=current_players_count,
                )

                await league_repository.update(league)

                logger.info(
                    "league.joined",
                    extra={
                        "league_id": league.id,
                        "user_id": user.id,
                        "user_email_hash": _hash_identifier(email),
                        "is_started": league.is_started,
                        "current_players_count": current_players_count,
                        "players_remaining": league.nb_players_remaining,
                    },
                )

        return LeagueJoinResponse()

    async def delete_league_player(
            self,
            league_id: int,
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

                league = await league_repo.find_by_id(league_id)
                if not league:
                    raise LeagueNotFoundError

                if league.is_started:
                    raise LeagueAlreadyStartedError

                if self._league_is_closed(league):
                    raise LeagueFinishedError

                league_player = await players_repo.get_participation(
                    league_id=league.id,
                    user_id=user.id
                )

                if not league_player:
                    raise LeagueParticipantNotFoundError

                if league_player.user_id != user.id:
                    raise LeagueNotThePlayerError

                if league.is_free is False and league.nb_btl is not None and league.nb_btl > 0:
                    await user_repo.credit_btl(user_id=user.id, amount=float(league.nb_btl))

                league = await league_repo.increment_players_remaining(league.id)
                league.current_players_count = league.current_players

                await league_repo.update(league)
                await players_repo.delete_player(league_player.id)

                logger.info(
                    "league.player_left",
                    extra={
                        "league_id": league.id,
                        "user_id": user.id,
                        "user_email_hash": _hash_identifier(email),
                        "refunded_btl": float(league.nb_btl or 0) if league.is_free is False and league.nb_btl is not None and league.nb_btl > 0 else 0.0,
                        "players_remaining": league.nb_players_remaining,
                    },
                )

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

                if self._league_is_closed(league):
                    raise LeagueFinishedError

                if await players_repo.find_participation(league_id, user.id):
                    raise LeagueParticipantFoundError

                if await invitation_repo.find_by_user_id_league_id(user.id, league.id):
                    raise InvitationFoundError

                league = await league_repo.decrement_players_remaining_if_available(league.id)
                if league is None:
                    raise LeagueMaxPlayersError

                invitation = Invitation(
                    league_id=league.id,
                    tournament_id=None,
                    user_sender_id=user_owner.id,
                    user_id=user.id,
                    status=InvitationStatus.pending
                )
                await invitation_repo.add(invitation)

                await self._event_bus.publish(
                    LeagueInvitationCreated(
                        league_id=league.id,
                        league_name=league.name,
                        invited_user_id=user.id,
                        sender_user_id=user_owner.id,
                        sender_pseudo=user_owner.pseudo,
                    )
                )

                await league_repo.update(league)

                logger.info(
                    "league.invitation_created",
                    extra={
                        "league_id": league.id,
                        "owner_user_id": user_owner.id,
                        "invited_user_id": user.id,
                        "players_remaining": league.nb_players_remaining,
                        "is_started": league.is_started,
                    },
                )

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

                league = await league_repo.find_by_id(invitation.league_id)
                if not league:
                    raise LeagueNotFoundError

                if action:
                    previous_current_players_count = await players_repo.count_players(league.id)
                    already_participating = await players_repo.find_participation(league_id=league.id, user_id=user.id)
                    if self._league_is_closed(league):
                        raise LeagueFinishedError

                    if not league.is_free and league.nb_btl is not None:
                        ok = await user_repo.debit_btl_if_enough(user_id=user.id, amount=float(league.nb_btl))
                        if not ok:
                            league = await league_repo.increment_players_remaining(league.id)
                            await league_repo.update(league)
                            raise LeagueNbBtlIsNotEnoughError

                    if already_participating:
                        invitation.status = InvitationStatus.accepted
                    else:
                        invitation.status = InvitationStatus.accepted
                        await players_repo.join_league(
                            LeaguePlayers(user_id=user.id, league_id=league.id)
                        )

                    # la participation peut déjà exister si l’utilisateur avait rejoint autrement
                    actual_current_players_count = await players_repo.count_players(league.id)
                    await self._publish_minimum_players_reached_if_needed(
                        league=league,
                        previous_current_players_count=previous_current_players_count,
                        previous_min_players=league.min_players,
                        current_players_count=actual_current_players_count,
                    )

                    await self._event_bus.publish(
                        LeagueInvitationAccepted(
                            league_id=league.id,
                            league_name=league.name,
                            invited_user_id=user.id,
                            invited_user_pseudo=user.pseudo,
                            sender_user_id=invitation.user_sender_id,
                        )
                    )
                else:
                    invitation.status = InvitationStatus.refused

                    league = await league_repo.increment_players_remaining(league.id)
                    await league_repo.update(league)

                    await self._event_bus.publish(
                        LeagueInvitationRefused(
                            league_id=league.id,
                            league_name=league.name,
                            invited_user_id=user.id,
                            invited_user_pseudo=user.pseudo,
                            sender_user_id=invitation.user_sender_id,
                        )
                    )

                await invitation_repo.delete(invitation.id)

                logger.info(
                    "league.invitation_updated",
                    extra={
                        "league_id": league.id,
                        "user_id": user.id,
                        "user_email_hash": _hash_identifier(email),
                        "invitation_action": "accepted" if action else "refused",
                        "players_remaining": league.nb_players_remaining,
                    },
                )

        return InvitationUpdateResponse()

    async def delete_invitation(self, invitation_id: int, user_email: str):
        async with self._session_factory() as session:
            async with session.begin():
                invitation_repo = InvitationRepositoryImpl(session)
                league_repo = LeagueRepositoryImpl(session)
                user_repo = UserRepositoryImpl(session)

                user = await user_repo.find_by_email(user_email)
                if not user:
                    raise UserNotFoundError

                invitation = await invitation_repo.find_by_id(invitation_id)
                if not invitation:
                    raise InvitationNotFoundError

                if invitation.league_id is None:
                    raise InvitationNotFoundError

                if invitation.status != InvitationStatus.pending:
                    raise InvitationDeletionNotAllowedError

                league = await league_repo.find_by_id(invitation.league_id)
                if not league:
                    raise LeagueNotFoundError

                if self._league_is_closed(league):
                    raise LeagueFinishedError

                if league.user.id != user.id or invitation.user_sender_id != user.id:
                    raise UserNotOwnerLeaguedError

                # Libérer la place réservée (pas de crédit BTL : rien n'a été débité à l'invitation)
                league = await league_repo.increment_players_remaining(league.id)
                await league_repo.update(league)

                await invitation_repo.delete(invitation.id)

                logger.info(
                    "league.invitation_deleted",
                    extra={
                        "league_id": league.id,
                        "owner_user_id": user.id,
                        "owner_email_hash": _hash_identifier(user_email),
                        "players_remaining": league.nb_players_remaining,
                    },
                )

        return InvitationDeleteResponse()

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

                if self._league_is_closed(league):
                    raise LeagueFinishedError

                if data.name != league.name and await league_repo.find_by_name(data.name):
                    raise LeagueNameAlreadyExistsError

                if data.max_players > MAX_PLAYERS:
                    raise LeagueMaxPlayersError

                current_players = await players_repo.count_players(league_id=league.id)
                if data.max_players < current_players:
                    raise LeagueMaxPlayersError

                if league.is_started and (
                        data.max_players != league.max_players or
                        data.start_date   != league.start_date or
                        data.min_players  != league.min_players
                ):
                    raise LeagueAlreadyStartedError

                previous_min_players = league.min_players
                league.nb_players_remaining = data.max_players - current_players

                league.name       = data.name
                league.start_date = data.start_date
                league.max_players = data.max_players
                league.min_players = data.min_players
                league.current_players_count = current_players

                await self._publish_minimum_players_reached_if_needed(
                    league=league,
                    previous_current_players_count=current_players,
                    previous_min_players=previous_min_players,
                    current_players_count=current_players,
                )

                await league_repo.update(league)

                logger.info(
                    "league.updated",
                    extra={
                        "league_id": league.id,
                        "owner_user_id": user.id,
                        "owner_email_hash": _hash_identifier(email),
                        "max_players": league.max_players,
                        "min_players": league.min_players,
                        "start_date": league.start_date,
                        "league_name": league.name,
                    },
                )

        return LeagueUpdateResponse()

    async def start_league(
            self,
            league_id: int,
            email: str
    ) -> LeagueStartResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo = UserRepositoryImpl(session)
                league_repo = LeagueRepositoryImpl(session)
                players_repo = LeaguePlayersRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                league = await league_repo.find_by_id_for_update(league_id)
                if not league:
                    raise LeagueNotFoundError

                current_players_count = await players_repo.count_players(league.id)
                league.current_players_count = current_players_count
                league.ensure_startable(owner_user_id=user.id, current_players=current_players_count)

                now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
                end_ms = now_ms + int(timedelta(days=LEAGUE_DURATION_DAYS).total_seconds() * 1000)
                league.start(at_ms=now_ms, end_date_ms=end_ms)

                await league_repo.update(league)
                await self._event_bus.publish(
                    LeagueStarted(
                        league_id=int(league.id),
                        league_name=league.name,
                        started_by_user_id=int(user.id),
                    )
                )

                logger.info(
                    "league.started_manually",
                    extra={
                        "league_id": league.id,
                        "owner_user_id": user.id,
                        "owner_email_hash": _hash_identifier(email),
                        "current_players_count": current_players_count,
                        "min_players": league.min_players,
                    },
                )

        return LeagueStartResponse()

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

                if self._league_is_closed(league):
                    raise LeagueFinishedError

                if league.winner_id is not None:
                    raise LeagueFinishedError

                league_player = await players_repo.get_participation(league_id, user.id)
                if not league_player:
                    raise LeagueParticipantNotFoundError

                league_player.nb_btl += amount
                await players_repo.update(league_player)

                user.nb_btl_paid -= amount
                await user_repo.update(user)

                logger.info(
                    "league.btl_injected",
                    extra={
                        "league_id": league.id,
                        "user_id": user.id,
                        "user_email_hash": _hash_identifier(email),
                        "amount": amount,
                        "league_player_btl": league_player.nb_btl,
                    },
                )

        return LeagueInjectBtlResponse()
