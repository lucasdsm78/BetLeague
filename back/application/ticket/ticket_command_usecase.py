import hmac
import hashlib
import logging
from abc import abstractmethod, ABC
from decimal import Decimal
from typing import List, Callable

import shortuuid

from application.match.match_command_model import MatchChoiceUpdatedResponse, NoMatchChoiceUpdatedResponse
from application.league.league_overtake_events import build_overtaken_events
from application.ticket.ticket_command_model import TicketCreateModel, TicketCreateResponse, TicketRemoveResponse, \
    TicketUpdateResponse, MatchChoiceData, TicketUpdateModel, NoTicketUpdatedResponse, TicketUpdatedResponse
from domain.ticket.event.ticket_resolved_event import TicketResolvedEvent
from domain.league.exception.league_exception import LeagueNotFoundError, \
    NbBTLHasReached0, LeagueNotStartedError
from domain.match.exception.match_exception import MatchNotFoundError
from domain.match.repository.match_odd_repository import MatchOddRepository
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.event.ticket_choices_resolved_event import TicketChoicesResolvedEvent
from domain.ticket.exception.ticket_exception import TicketNotFoundError, NotTicketOwnerError, \
     MatchAlreadyStartedError, MiseSuperiorToNbBtlError
from domain.ticket.exception.duplicate_match_choice_error import DuplicateMatchChoiceError
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.service.ticket_domain_service import TicketDomainService
from domain.ticket.unit_of_work import TicketUnitOfWork
from domain.token.token_exception import TokenInvalidError
from domain.tournament.exception.tournament_exception import TournamentNotFoundError, TournamentNotStartedError, TournamentMatchNotFoundError, TournamentPlayerNotFoundError
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from infrastructure.config import Settings

from domain.league.exception.league_exception import LeagueParticipantFoundError


logger = logging.getLogger(__name__)


def _hash_identifier(value: str) -> str:
    normalized = (value or "").strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class TicketCommandUseCase(ABC):

    @abstractmethod
    async def create_ticket(self, league_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        raise NotImplementedError

    @abstractmethod
    async def remove_ticket(self, email: str, ticket_id: int) -> TicketRemoveResponse:
        raise NotImplementedError

    @abstractmethod
    async def update_ticket(self, email: str, ticket_id: int, ticket_update_model: TicketUpdateModel):
        raise NotImplementedError

    @abstractmethod
    async def create_tournament_ticket(self, tournament_id: int, match_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        raise NotImplementedError

    @abstractmethod
    async def check_match_choices_by_match_id(self, token: str, match_id: int):
        raise NotImplementedError

    @abstractmethod
    async def check_ticket_status(self, token: str, ticket_id: int):
        raise NotImplementedError


class TicketCommandUseCaseImpl(TicketCommandUseCase):

    def __init__(
            self,
            uow_factory: Callable[[], TicketUnitOfWork],
            settings: Settings,
    ):
        self._uow_factory = uow_factory
        self.settings = settings

    async def _process_match_choices(
            self,
            mc_repo: MatchChoiceRepository,
            match_repo: MatchRepository,
            odd_repo: MatchOddRepository,
            updated: bool,
            ticket_id: int,
            match_choices_data: List[MatchChoiceData],
    ) -> None:
        if updated:
            await mc_repo.delete_by_ticket_id(ticket_id)

        # Duplicate match check (in memory, O(n))
        seen: set[int] = set()
        for cd in match_choices_data:
            mid = int(cd.match_id)
            if mid in seen:
                raise DuplicateMatchChoiceError
            seen.add(mid)

        already_started = await match_repo.exists_match_started_for_ticket(match_choices_data)
        if already_started:
            raise MatchAlreadyStartedError

        # Bulk fetch: 2 queries instead of 2N
        match_ids = [cd.match_id for cd in match_choices_data]
        odd_ids   = [cd.match_odd_id for cd in match_choices_data]

        matches = await match_repo.find_all_by_ids(match_ids)
        odds    = await odd_repo.find_all_by_ids(odd_ids)

        match_dict = {m.id: m for m in matches}
        odd_dict   = {o.id: o for o in odds}

        # Validation in memory
        for cd in match_choices_data:
            match = match_dict.get(cd.match_id)
            odd   = odd_dict.get(cd.match_odd_id)
            if not match:
                raise MatchNotFoundError
            if not odd or odd.match_id != match.id:
                raise MatchNotFoundError

        # Bulk insert
        db_choices = [
            MatchChoice(
                match_id=cd.match_id,
                ticket_id=ticket_id,
                choice=odd_dict[cd.match_odd_id].value,
                status=MatchChoiceStatus.pending,
                match_odd_id=cd.match_odd_id,
            )
            for cd in match_choices_data
        ]
        await mc_repo.bulk_create(db_choices)


    async def create_ticket(
            self,
            league_id: int,
            ticket_create_model: TicketCreateModel,
            email: str
    ) -> TicketCreateResponse:
        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            league = await uow.league_repo.find_by_id(league_id)
            if not league:
                raise LeagueNotFoundError

            # SELECT FOR UPDATE — prevents concurrent double-spending on BTL balance
            league_player = await uow.league_players_repo.get_participation_locked(
                league_id=league.id, user_id=user.id
            )

            if league_player.nb_btl == 0:
                raise NbBTLHasReached0
            if ticket_create_model.mise > league_player.nb_btl:
                raise MiseSuperiorToNbBtlError
            if not league.is_started:
                raise LeagueNotStartedError

            # Gain calculated server-side — never trust the client
            odd_ids = [cd.match_odd_id for cd in ticket_create_model.match_choices]
            odds = await uow.match_odd_repo.find_all_by_ids(odd_ids)
            odd_values = [Decimal(str(o.odd)) for o in odds]
            gain = TicketDomainService.calculate_gain(odd_values, ticket_create_model.mise)

            uuid = shortuuid.uuid()
            ticket = Ticket(
                uuid=uuid,
                gain=gain,
                league_id=league.id,
                mise=ticket_create_model.mise,
                status=TicketStatus.pending,
                user=UserSummary(
                    id=user.id, email=user.email, pseudo=user.pseudo
                )
            )
            ticket_id = await uow.ticket_repo.create(ticket)

            league_player.nb_btl -= ticket_create_model.mise
            await uow.league_players_repo.update(league_player)

            await self._process_match_choices(
                mc_repo=uow.match_choice_repo,
                match_repo=uow.match_repo,
                odd_repo=uow.match_odd_repo,
                updated=False,
                ticket_id=ticket_id,
                match_choices_data=ticket_create_model.match_choices,
            )

            await uow.commit()
            logger.info(
                "ticket.created",
                extra={
                    "ticket_id": ticket_id,
                    "ticket_uuid": ticket.uuid,
                    "league_id": league.id,
                    "user_id": user.id,
                    "user_email_hash": _hash_identifier(email),
                    "mise": ticket_create_model.mise,
                    "gain": str(gain),
                    "choices_count": len(ticket_create_model.match_choices),
                },
            )

        return TicketCreateResponse(ticket_id=ticket_id)

    async def remove_ticket(self, email: str, ticket_id: int) -> TicketRemoveResponse:
        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            ticket = await uow.ticket_repo.find_by_id(ticket_id)

            if ticket.user.id != user.id:
                raise NotTicketOwnerError

            mise_to_refund = int(ticket.mise or 0)
            if mise_to_refund <= 0:
                mise_to_refund = 0

            choices = await uow.match_choice_repo.find_all_by_ticket_id(ticket_id)
            choice_data_list = [
                MatchChoiceData(match_id=mc.match_id, match_odd_id=mc.match_odd_id)
                for mc in choices
            ]

            if await uow.match_repo.exists_match_started_for_ticket(choice_data_list):
                raise MatchAlreadyStartedError

            if ticket.league_id is not None:
                league_player = await uow.league_players_repo.get_participation_locked(
                    league_id=ticket.league_id,
                    user_id=ticket.user.id
                )

                if league_player is None:
                    raise LeagueParticipantFoundError

                if mise_to_refund > 0:
                    league_player.nb_btl += mise_to_refund
                await uow.league_players_repo.update(league_player)

            if ticket.tournament_match_id is not None:
                tournament_match = await uow.tournament_match_repo.find_by_id(ticket.tournament_match_id)
                if tournament_match is None:
                    raise TournamentMatchNotFoundError

                tournament_player = await uow.tournament_players_repo.get_player(
                    tournament_match.tournament_id,
                    ticket.user.id
                )

                if tournament_player is None:
                    raise TournamentPlayerNotFoundError

                if mise_to_refund > 0:
                    tournament_player.nb_btl += mise_to_refund
                await uow.tournament_players_repo.update(tournament_player)

            await uow.match_choice_repo.delete_by_ticket_id(ticket.id)
            await uow.ticket_repo.delete(ticket.id)
            await uow.commit()
            logger.info(
                "ticket.removed",
                extra={
                    "ticket_id": ticket.id,
                    "league_id": ticket.league_id,
                    "tournament_match_id": ticket.tournament_match_id,
                    "user_id": user.id,
                    "user_email_hash": _hash_identifier(email),
                    "refund_btl": mise_to_refund,
                },
            )

        return TicketRemoveResponse()

    async def update_ticket(
            self,
            email: str,
            ticket_id: int,
            ticket_update_model: TicketUpdateModel
    ) -> TicketUpdateResponse:
        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            ticket = await uow.ticket_repo.find_by_id(ticket_id)
            if not ticket:
                raise TicketNotFoundError

            if ticket.user.id != user.id:
                raise NotTicketOwnerError

            mise_to_use = (
                ticket_update_model.mise
                if ticket_update_model.mise is not None
                else ticket.mise
            )

            # Adjust BTL balance when mise changes
            if ticket_update_model.mise is not None and ticket_update_model.mise != ticket.mise:
                mise_diff = ticket_update_model.mise - ticket.mise
                if ticket.league_id is not None:
                    league_player = await uow.league_players_repo.get_participation_locked(
                        league_id=ticket.league_id, user_id=user.id
                    )
                    if mise_diff > 0 and mise_diff > league_player.nb_btl:
                        raise MiseSuperiorToNbBtlError
                    league_player.nb_btl -= mise_diff  # Deducts if positive, refunds if negative
                    await uow.league_players_repo.update(league_player)

            if ticket_update_model.match_choices:
                choice_data = ticket_update_model.match_choices
            else:
                existing_choices = await uow.match_choice_repo.find_all_by_ticket_id(ticket.id)
                choice_data = [
                    MatchChoiceData(match_id=mc.match_id, match_odd_id=mc.match_odd_id)
                    for mc in existing_choices
                ]

            # Gain calculated server-side
            odd_ids = [cd.match_odd_id for cd in choice_data]
            odds = await uow.match_odd_repo.find_all_by_ids(odd_ids)
            odd_values = [Decimal(str(o.odd)) for o in odds]
            new_gain = TicketDomainService.calculate_gain(odd_values, mise_to_use)

            if ticket_update_model.mise is not None:
                ticket.mise = ticket_update_model.mise
            ticket.gain = new_gain
            await uow.ticket_repo.update(ticket)

            if ticket_update_model.match_choices:
                await self._process_match_choices(
                    mc_repo=uow.match_choice_repo,
                    match_repo=uow.match_repo,
                    odd_repo=uow.match_odd_repo,
                    updated=True,
                    ticket_id=ticket.id,
                    match_choices_data=ticket_update_model.match_choices,
                )

            await uow.commit()
            logger.info(
                "ticket.updated",
                extra={
                    "ticket_id": ticket.id,
                    "league_id": ticket.league_id,
                    "tournament_match_id": ticket.tournament_match_id,
                    "user_id": user.id,
                    "user_email_hash": _hash_identifier(email),
                    "mise": ticket.mise,
                    "gain": str(ticket.gain),
                    "choices_updated": bool(ticket_update_model.match_choices),
                },
            )

        return TicketUpdateResponse()


    async def create_tournament_ticket(self, tournament_id: int, match_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        async with self._uow_factory() as uow:
            user = await uow.user_repo.find_by_email(email)
            if not user:
                raise UserNotFoundError

            tournament = await uow.tournament_repo.find_by_id(tournament_id)
            if not tournament:
                raise TournamentNotFoundError

            tournament_player = await uow.tournament_players_repo.get_player(tournament_id, user.id)
            if not tournament_player or tournament_player.is_eliminated:
                raise UserNotFoundError

            if tournament_player.nb_btl == 0:
                raise NbBTLHasReached0

            if ticket_create_model.mise > tournament_player.nb_btl:
                raise MiseSuperiorToNbBtlError

            if tournament.status != TournamentStatus.IN_PROGRESS:
                raise TournamentNotStartedError

            # Gain calculated server-side
            odd_ids = [cd.match_odd_id for cd in ticket_create_model.match_choices]
            odds = await uow.match_odd_repo.find_all_by_ids(odd_ids)
            odd_values = [Decimal(str(o.odd)) for o in odds]
            gain = TicketDomainService.calculate_gain(odd_values, ticket_create_model.mise)

            match = await uow.tournament_match_repo.find_by_id(match_id)
            if not match or match.tournament_id != tournament_id:
                raise TournamentMatchNotFoundError

            uuid = shortuuid.uuid()
            ticket = Ticket(
                uuid=uuid,
                gain=gain,
                tournament_match_id=match.id,
                mise=ticket_create_model.mise,
                status=TicketStatus.pending,
                user=UserSummary(
                    id=user.id, email=user.email, pseudo=user.pseudo
                )
            )

            ticket_id = await uow.ticket_repo.create(ticket)

            tournament_player.nb_btl -= ticket_create_model.mise
            await uow.tournament_players_repo.update(tournament_player)

            await self._process_match_choices(
                mc_repo=uow.match_choice_repo,
                match_repo=uow.match_repo,
                odd_repo=uow.match_odd_repo,
                updated=False,
                ticket_id=ticket_id,
                match_choices_data=ticket_create_model.match_choices,
            )

            await uow.commit()
            logger.info(
                "ticket.tournament.created",
                extra={
                    "ticket_id": ticket_id,
                    "ticket_uuid": ticket.uuid,
                    "tournament_id": tournament_id,
                    "tournament_match_id": match.id,
                    "user_id": user.id,
                    "user_email_hash": _hash_identifier(email),
                    "mise": ticket_create_model.mise,
                    "gain": str(gain),
                    "choices_count": len(ticket_create_model.match_choices),
                },
            )

        return TicketCreateResponse(ticket_id=ticket_id)

    async def check_match_choices_by_match_id(self, token: str, match_id: int):
        if not hmac.compare_digest(token, self.settings.secret_key_token):
            raise TokenInvalidError

        async with self._uow_factory() as uow:
            match = await uow.match_repo.find_by_id(match_id)
            if not match:
                raise MatchNotFoundError

            pending_choices = await uow.match_choice_repo.get_match_choices_pending_by_match_id(match_id)

            if not pending_choices:
                return NoMatchChoiceUpdatedResponse()

            # Bulk fetch odds: 1 query
            odd_ids = [c.match_odd_id for c in pending_choices]
            odds = await uow.match_odd_repo.find_all_by_ids(odd_ids)
            odd_dict = {o.id: o for o in odds}

            # Prepare bulk status updates + collect unique ticket_ids
            status_updates: list[tuple[int, MatchChoiceStatus]] = []
            updated_ticket_ids: set[int] = set()

            for choice in pending_choices:
                odd = odd_dict.get(choice.match_odd_id)
                if not odd or odd.result is None:
                    continue
                new_status = MatchChoiceStatus.correct if odd.result == "WIN" else MatchChoiceStatus.wrong
                status_updates.append((choice.id, new_status))
                updated_ticket_ids.add(choice.ticket_id)

            if not status_updates:
                return NoMatchChoiceUpdatedResponse()

            # Single bulk update + single flush
            await uow.match_choice_repo.bulk_mark_choice_status(status_updates)

            # 1 outbox event per unique ticket (deduplicated) — atomic with DB commit
            for tid in updated_ticket_ids:
                await uow.outbox_bus.publish(
                    TicketChoicesResolvedEvent(ticket_id=tid, match_id=match_id)
                )

            await uow.commit()
            logger.info(
                "ticket.match_choices.resolved",
                extra={
                    "match_id": match_id,
                    "updated_ticket_ids": sorted(updated_ticket_ids),
                    "updated_choices_count": len(status_updates),
                },
            )
            return MatchChoiceUpdatedResponse()

    async def check_ticket_status(self, token: str, ticket_id: int):
        if not hmac.compare_digest(token, self.settings.secret_key_token):
            raise TokenInvalidError

        async with self._uow_factory() as uow:
            # SELECT FOR UPDATE — serializes concurrent access to the same ticket
            ticket = await uow.ticket_repo.find_by_id_for_update(ticket_id)
            if ticket.status != TicketStatus.pending:
                return TicketUpdatedResponse()  # Already resolved

            wrong, pend = await uow.match_choice_repo.count_wrong_and_pending_by_ticket(ticket_id)
            resolved = await uow.ticket_repo.resolve_status(
                ticket_id=ticket.id,
                wrong_count=wrong,
                pending_count=pend,
            )

            if resolved:
                is_win = wrong == 0
                league_name = ""
                ranking_entries = []
                if is_win:
                    await uow.user_repo.apply_ticket_win(ticket.user.id, ticket.gain)
                else:
                    await uow.user_repo.apply_ticket_lose(ticket.user.id)

                if ticket.league_id is not None:
                    if is_win:
                        ranking_entries = await uow.league_players_repo.get_league_ranking_entries(ticket.league_id)
                        league = await uow.league_repo.find_by_id(ticket.league_id)
                        league_name = league.name if league else ""
                        await uow.league_players_repo.apply_ticket_win(
                            ticket.league_id, ticket.user.id, ticket.gain
                        )
                        for overtaken_event in build_overtaken_events(
                            ranking_entries=ranking_entries,
                            league_id=ticket.league_id,
                            league_name=league_name,
                            overtaken_by_user_id=ticket.user.id,
                            overtaken_by_pseudo=ticket.user.pseudo,
                            gain=float(ticket.gain or 0),
                        ):
                            await uow.outbox_bus.publish(overtaken_event)
                    else:
                        await uow.league_players_repo.apply_ticket_lose(
                            ticket.league_id, ticket.user.id
                        )

                await uow.outbox_bus.publish(
                    TicketResolvedEvent(
                        ticket_id=ticket.id,
                        user_id=ticket.user.id,
                        league_id=ticket.league_id,
                        is_win=is_win,
                        gain=float(ticket.gain or 0),
                    )
                )

            await uow.commit()
            if resolved:
                logger.info(
                    "ticket.status.resolved",
                    extra={
                        "ticket_id": ticket.id,
                        "user_id": ticket.user.id,
                        "league_id": ticket.league_id,
                        "is_win": is_win,
                        "wrong_count": wrong,
                        "pending_count": pend,
                        "gain": str(ticket.gain),
                    },
                )
            else:
                logger.debug(
                    "ticket.status.noop",
                    extra={"ticket_id": ticket.id, "wrong_count": wrong, "pending_count": pend},
                )

            if resolved:
                return TicketUpdatedResponse()
            else:
                return NoTicketUpdatedResponse()
