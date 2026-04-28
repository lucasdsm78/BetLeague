from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
import hashlib
import logging
from typing import Callable

import shortuuid
from sqlalchemy.ext.asyncio import AsyncSession

from application.tournament.tournament_command_model import (
    InvitationDeleteResponse,
    InvitationUpdateResponse,
    TournamentCreateModel,
    TournamentCreateResponse,
    TournamentInviteResponse,
    TournamentJoinResponse,
    TournamentPlayerDeletedResponse,
    TournamentStartResponse,
    TournamentUpdateModel,
    TournamentUpdateResponse,
)
from domain.invitation.exception.invitation_exception import (
    InvitationDeletionNotAllowedError,
    InvitationFoundError,
    InvitationNotFoundError,
)
from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus
from domain.ticket.model.ticket_status import TicketStatus
from domain.tournament.exception.tournament_exception import (
    TournamentAlreadyStartedError,
    TournamentMaxPlayersError,
    TournamentMonthlyFreeCreationLimitReachedError,
    TournamentNameAlreadyExistsError,
    TournamentNotEnoughPlayersError,
    TournamentNotFoundError,
    TournamentNotOwnerLeaguedError,
    TournamentPlayerFoundError,
    TournamentPlayerNotFoundError,
    TournamentSelfInvitationError,
    TournamentFullError,
    UserAlreadyInTournamentError,
    UserNotInvitationTournamentError,
)
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_player import TournamentPlayer
from domain.tournament.model.tournament_status import TournamentStatus
from domain.tournament.service.tournament_creation_policy import TournamentCreationPolicy, current_month_window_ms
from domain.tournament.service.tournament_progression_service import TournamentProgressionService
from domain.tournament.unit_of_work import TournamentUnitOfWork
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary


logger = logging.getLogger(__name__)


def _hash_identifier(value: str) -> str:
    normalized = (value or "").strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()



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

    @abstractmethod
    async def leave_tournament(self, tournament_id: int, user_id: int) -> TournamentPlayerDeletedResponse:
        raise NotImplementedError

    @abstractmethod
    async def delete_invitation(self, invitation_id: int, owner_email: str):
        raise NotImplementedError

    @abstractmethod
    async def invite_user(self, tournament_id: int, user_id: int, user_owner_email: str) -> TournamentInviteResponse:
        raise NotImplementedError

    @abstractmethod
    async def update_invitation(self, invitation_id: int, action: bool, email: str) -> InvitationUpdateResponse:
        raise NotImplementedError


class TournamentCommandUseCaseImpl(TournamentCommandUseCase):
    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        creation_policy: TournamentCreationPolicy | None = None,
        progression_service: TournamentProgressionService | None = None,
        uow_factory: Callable[[], TournamentUnitOfWork] | None = None,
    ):
        self._session_factory = session_factory
        self._creation_policy = creation_policy or TournamentCreationPolicy()
        self._progression_service = progression_service or TournamentProgressionService()
        if uow_factory is None:
            raise ValueError("TournamentCommandUseCaseImpl requires a TournamentUnitOfWork factory")
        self._uow_factory = uow_factory

    def _initial_stage_type_for_tournament(self, max_players: int):
        return self._progression_service.stage_types_for_bracket_size(max_players)[0]

    def _build_player(self, *, user_id: int, tournament_id: int, max_players: int) -> TournamentPlayer:
        return TournamentPlayer(
            user_id=user_id,
            tournament_id=tournament_id,
            nb_btl=Tournament.DEFAULT_PLAYER_START_BTL,
            is_eliminated=False,
            current_stage=self._initial_stage_type_for_tournament(max_players),
        )

    async def create_tournament(self, data: TournamentCreateModel, email: str) -> TournamentCreateResponse:
        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            month_start_ms, next_month_start_ms = current_month_window_ms()
            monthly_used = await uow.tournament_repo.count_created_by_user_between(
                user.id,
                month_start_ms,
                next_month_start_ms,
            )
            subscription = await uow.tournament_subscription_repo.find_active_by_user_id(user.id)
            access = self._creation_policy.evaluate(
                has_active_subscription=bool(subscription and subscription.is_active()),
                monthly_free_tournaments_used=monthly_used,
            )
            if not access.can_create_tournament:
                raise TournamentMonthlyFreeCreationLimitReachedError(
                    monthly_free_limit=access.monthly_free_tournaments_limit,
                    monthly_free_used=access.monthly_free_tournaments_used,
                )

            existing = await uow.tournament_repo.find_by_name(data.name)
            if existing is not None:
                raise TournamentNameAlreadyExistsError

            uuid = shortuuid.uuid()
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            start_ms = data.start_date if data.start_date is not None else now_ms
            end_ms = start_ms + int(timedelta(days=7).total_seconds() * 1000)

            tournament = Tournament(
                uuid=uuid,
                name=data.name,
                is_private=data.is_private,
                max_players=data.max_players,
                current_players=0,
                prize_pool=0,
                entry_fee=Tournament.DEFAULT_ENTRY_FEE,
                start_date=start_ms,
                end_date=end_ms,
                user=UserSummary(id=user.id, email=user.email, pseudo=user.pseudo),
            )
            await uow.tournament_repo.create(tournament)

            created_tournament = await uow.tournament_repo.find_by_uuid(uuid)
            existing_player = await uow.tournament_players_repo.get_player(created_tournament.id, user.id)
            if existing_player is None:
                await uow.tournament_players_repo.add_player(
                    self._build_player(
                        user_id=user.id,
                        tournament_id=created_tournament.id,
                        max_players=created_tournament.max_players,
                    )
                )
                created_tournament.register_player()
                await uow.tournament_repo.update(created_tournament)

            await uow.commit()

            created_access = self._creation_policy.evaluate(
                has_active_subscription=access.has_active_subscription,
                monthly_free_tournaments_used=access.monthly_free_tournaments_used + 1,
            )
            logger.info(
                "tournament.created",
                extra={
                    "tournament_id": created_tournament.id,
                    "tournament_uuid": created_tournament.uuid,
                    "owner_user_id": user.id,
                    "owner_email_hash": _hash_identifier(email),
                    "max_players": created_tournament.max_players,
                    "is_private": created_tournament.is_private,
                    "requires_tournament_subscription": created_access.requires_tournament_subscription,
                },
            )

        return TournamentCreateResponse(
            tournament_id=created_tournament.id,
            tournament_uuid=created_tournament.uuid,
            name=created_tournament.name,
            max_players=created_tournament.max_players,
            monthly_free_tournaments_limit=created_access.monthly_free_tournaments_limit,
            monthly_free_tournaments_used=created_access.monthly_free_tournaments_used,
            monthly_free_tournaments_remaining=created_access.monthly_free_tournaments_remaining,
            can_create_tournament=created_access.can_create_tournament,
            requires_tournament_subscription=created_access.requires_tournament_subscription,
        )

    async def join_tournament(self, tournament_id: int, email: str) -> TournamentJoinResponse:
        tournament_full = False
        owner_email = None

        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            tournament = await uow.tournament_repo.find_by_id_for_update(tournament_id)
            if not tournament:
                raise TournamentNotFoundError

            try:
                tournament.ensure_joinable()
            except TournamentMaxPlayersError as exc:
                raise TournamentFullError from exc

            existing_player = await uow.tournament_players_repo.get_player(tournament.id, user.id)
            if existing_player:
                raise UserAlreadyInTournamentError

            await uow.tournament_players_repo.add_player(
                self._build_player(
                    user_id=user.id,
                    tournament_id=tournament.id,
                    max_players=tournament.max_players,
                )
            )
            tournament.register_player()
            await uow.tournament_repo.update(tournament)

            tournament_full = tournament.is_full
            owner_email = tournament.user.email.value
            await uow.commit()
            logger.info(
                "tournament.joined",
                extra={
                    "tournament_id": tournament.id,
                    "user_id": user.id,
                    "user_email_hash": _hash_identifier(email),
                    "current_players": tournament.current_players,
                    "is_full": tournament_full,
                },
            )

        if tournament_full:
            await self.start_tournament(tournament_id, owner_email)

        return TournamentJoinResponse()

    async def start_tournament(self, tournament_id: int, email: str) -> TournamentStartResponse:
        async with self._uow_factory() as uow:
            tournament = await uow.tournament_repo.find_by_id_for_update(tournament_id)
            if not tournament:
                raise TournamentNotFoundError

            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            tournament.ensure_startable(user.id)

            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            stages = self._progression_service.build_stages_for_tournament(
                tournament=tournament,
                owner_user_id=user.id,
                start_ms=now_ms,
            )
            tournament.start(at_ms=now_ms, end_date_ms=stages[-1].end_date)

            players = await uow.tournament_players_repo.find_players_by_tournament_id(tournament.id)
            if len(players) != tournament.max_players:
                raise TournamentNotEnoughPlayersError

            for stage in stages:
                await uow.tournament_stage_repo.add_stage(stage)

            active_stage = stages[0]
            promoted_players = self._progression_service.promote_players_to_stage(
                players,
                stage_type=active_stage.type,
            )
            for player in promoted_players:
                await uow.tournament_players_repo.update(player)

            await uow.tournament_repo.update(tournament)
            persisted_active_stage = await uow.tournament_stage_repo.get_active_stage(tournament.id)
            if persisted_active_stage is None:
                raise TournamentNotFoundError
            matches = self._progression_service.build_matches_for_stage(
                tournament_id=tournament.id,
                stage=persisted_active_stage,
                qualified_players=promoted_players,
            )
            for match in matches:
                await uow.tournament_match_repo.add_match(match)

            await uow.commit()
            logger.info(
                "tournament.started",
                extra={
                    "tournament_id": tournament.id,
                    "owner_user_id": user.id,
                    "owner_email_hash": _hash_identifier(email),
                    "stages_count": len(stages),
                    "matches_count": len(matches),
                    "max_players": tournament.max_players,
                },
            )

        return TournamentStartResponse()


    async def update_tournament_btl_scores(self, ticket_id: int):
        async with self._uow_factory() as uow:
            ticket = await uow.ticket_repo.find_by_id(ticket_id)
            if not ticket or ticket.status != TicketStatus.correct:
                return

            active_tournaments = await uow.tournament_repo.find_in_progress_for_user(ticket.user_id)
            for tournament in active_tournaments:
                active_stage = await uow.tournament_stage_repo.get_active_stage(tournament.id)
                if active_stage is None:
                    continue

                players = await uow.tournament_players_repo.find_players_by_tournament_id(tournament.id)
                player = next(
                    (
                        participant for participant in players
                        if participant.user_id == ticket.user_id
                        and not participant.is_eliminated
                        and participant.current_stage == active_stage.type
                    ),
                    None,
                )
                if player is None:
                    continue

                player.nb_btl += int(ticket.gain or 0)
                await uow.tournament_players_repo.update(player)
                logger.info(
                    "tournament.player_btl_updated_from_ticket",
                    extra={
                        "tournament_id": tournament.id,
                        "ticket_id": ticket.id,
                        "user_id": ticket.user_id,
                        "stage_type": active_stage.type,
                        "credited_btl": int(ticket.gain or 0),
                        "player_btl": player.nb_btl,
                    },
                )

            await uow.commit()


    async def update(
                self,
                data: TournamentUpdateModel,
                tournament_id: int,
                email: str
        ) -> TournamentUpdateResponse:
            async with self._uow_factory() as uow:
                user = await uow.user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                tournament = await uow.tournament_repo.find_by_id_for_update(tournament_id)
                if not tournament:
                    raise TournamentNotFoundError

                if tournament.user.id != user.id:
                    raise TournamentNotOwnerLeaguedError

                if data.name != tournament.name and await uow.tournament_repo.find_by_name(data.name):
                    raise TournamentNameAlreadyExistsError

                if tournament.status != TournamentStatus.PENDING:
                    raise TournamentAlreadyStartedError

                if data.name is not None:
                    tournament.name = data.name
                if data.start_date is not None:
                    tournament.start_date = data.start_date
                if data.is_private is not None:
                    tournament.is_private = data.is_private
                if data.end_date is not None:
                    tournament.end_date = data.end_date

                await uow.tournament_repo.update(tournament)
                await uow.commit()
                logger.info(
                    "tournament.updated",
                    extra={
                        "tournament_id": tournament.id,
                        "owner_user_id": user.id,
                        "owner_email_hash": _hash_identifier(email),
                        "name": tournament.name,
                        "is_private": tournament.is_private,
                        "start_date": tournament.start_date,
                        "end_date": tournament.end_date,
                    },
                )

                return TournamentUpdateResponse()

    async def leave_tournament(
            self,
            tournament_id: int,
            user_id: int
    ) -> TournamentPlayerDeletedResponse:
        async with self._uow_factory() as uow:
            tournament = await uow.tournament_repo.find_by_id_for_update(tournament_id)
            if not tournament:
                raise TournamentNotFoundError

            tournament_player = await uow.tournament_players_repo.get_player(
                tournament_id=tournament.id,
                user_id=user_id,
            )
            if not tournament_player:
                raise TournamentPlayerNotFoundError

            tournament.ensure_player_can_leave(user_id)
            tournament.unregister_player()
            await uow.tournament_players_repo.unregister_tournament(tournament_player.id)
            await uow.tournament_repo.update(tournament)
            await uow.commit()
            logger.info(
                "tournament.player_left",
                extra={
                    "tournament_id": tournament.id,
                    "user_id": user_id,
                    "current_players": tournament.current_players,
                },
            )

        return TournamentPlayerDeletedResponse()

    async def invite_user(
            self,
            tournament_id: int,
            user_id: int,
            user_owner_email: str
    ) -> TournamentInviteResponse:
        async with self._uow_factory() as uow:
            user_owner = await uow.user_repo.find_by_email(user_owner_email)
            if not user_owner:
                raise UserNotFoundError

            if int(user_id) == int(user_owner.id):
                raise TournamentSelfInvitationError

            user = await uow.user_repo.find_by_id(user_id)
            if not user:
                raise UserNotFoundError

            tournament = await uow.tournament_repo.find_by_id_for_update(tournament_id)
            if not tournament:
                raise TournamentNotFoundError

            if user_owner.id != tournament.user.id:
                raise TournamentNotOwnerLeaguedError

            tournament.ensure_joinable()

            if await uow.tournament_players_repo.get_player(tournament_id, user.id):
                raise TournamentPlayerFoundError

            if await uow.invitation_repo.find_by_user_id_tournament_id(user.id, tournament.id):
                raise InvitationFoundError

            invitation = Invitation(
                league_id=None,
                tournament_id=tournament.id,
                user_sender_id=user_owner.id,
                user_id=user.id,
                status=InvitationStatus.pending,
            )
            await uow.invitation_repo.add(invitation)
            await uow.commit()
            logger.info(
                "tournament.invitation_created",
                extra={
                    "tournament_id": tournament.id,
                    "owner_user_id": user_owner.id,
                    "owner_email_hash": _hash_identifier(user_owner_email),
                    "invited_user_id": user.id,
                },
            )

        return TournamentInviteResponse()

    async def update_invitation(
            self,
            invitation_id: int,
            action: bool,
            email: str
    ) -> InvitationUpdateResponse:
        tournament_full = False
        owner_email = None

        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            invitation = await uow.invitation_repo.find_by_id(invitation_id)
            if not invitation or invitation.tournament_id is None:
                raise InvitationNotFoundError

            if user.id != invitation.user_id:
                raise UserNotInvitationTournamentError

            tournament = await uow.tournament_repo.find_by_id_for_update(invitation.tournament_id)
            if not tournament:
                raise TournamentNotFoundError

            if tournament.status != TournamentStatus.PENDING:
                raise TournamentAlreadyStartedError

            if action:
                existing_player = await uow.tournament_players_repo.get_player(tournament.id, user.id)
                if existing_player is None:
                    tournament.ensure_joinable()
                    await uow.tournament_players_repo.add_player(
                        self._build_player(
                            user_id=user.id,
                            tournament_id=tournament.id,
                            max_players=tournament.max_players,
                        )
                    )
                    tournament.register_player()
                    await uow.tournament_repo.update(tournament)

                owner_email = tournament.user.email.value
                tournament_full = tournament.is_full

            await uow.invitation_repo.delete(invitation.id)
            await uow.commit()
            logger.info(
                "tournament.invitation_updated",
                extra={
                    "tournament_id": tournament.id,
                    "user_id": user.id,
                    "user_email_hash": _hash_identifier(email),
                    "invitation_action": "accepted" if action else "refused",
                    "current_players": tournament.current_players,
                    "is_full": tournament_full,
                },
            )

        if action and tournament_full and owner_email:
            await self.start_tournament(invitation.tournament_id, owner_email)

        return InvitationUpdateResponse(
            message="Tournament invitation accepted successfully" if action else "Tournament invitation declined successfully"
        )

    async def delete_invitation(self, invitation_id: int, owner_email: str):
        async with self._uow_factory() as uow:
            owner = await uow.user_repo.find_by_email(owner_email)
            if not owner:
                raise UserNotFoundError

            invitation = await uow.invitation_repo.find_by_id(invitation_id)
            if not invitation or invitation.tournament_id is None:
                raise InvitationNotFoundError

            if invitation.status != InvitationStatus.pending:
                raise InvitationDeletionNotAllowedError

            tournament = await uow.tournament_repo.find_by_id_for_update(invitation.tournament_id)
            if not tournament:
                raise TournamentNotFoundError

            if tournament.user.id != owner.id or invitation.user_sender_id != owner.id:
                raise TournamentNotOwnerLeaguedError

            if tournament.status != TournamentStatus.PENDING:
                raise TournamentAlreadyStartedError

            await uow.invitation_repo.delete(invitation.id)
            await uow.commit()
            logger.info(
                "tournament.invitation_deleted",
                extra={
                    "tournament_id": tournament.id,
                    "owner_user_id": owner.id,
                    "owner_email_hash": _hash_identifier(owner_email),
                },
            )

        return InvitationDeleteResponse()
