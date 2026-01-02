from abc import abstractmethod, ABC
from typing import List, Callable

from sqlalchemy.ext.asyncio import AsyncSession
import shortuuid

from application.match.match_command_model import MatchChoiceUpdatedResponse, NoMatchChoiceUpdatedResponse
from application.ticket.ticket_command_model import TicketCreateModel, TicketCreateResponse, TicketRemoveResponse, \
    TicketUpdateResponse, MatchChoiceData, TicketUpdateModel, NoTicketUpdatedResponse, TicketUpdatedResponse
from domain.league.exception.league_exception import LeagueNotFoundError, LeagueParticipantNotFoundError, \
    NbBTLHasReached0, LeagueNotStartedError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.exception.match_exception import MatchNotFoundError
from domain.match.repository.match_repository import MatchRepository
from domain.services.rabbitmq.publisher import RabbitMQPublisher
from domain.ticket.event.match_choice_status_updated_event import MatchChoiceStatusUpdatedEvent
from domain.ticket.exception.ticket_exception import GainNotEqualsError, TicketNotFoundError, NotTicketOwnerError, \
    MatchAlreadyStartedError, MiseSuperiorToNbBtlError
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.token.token_exception import TokenInvalidError
from domain.tournament import TournamentPlayersRepository, TournamentRepository
from domain.tournament.exception.tournament_exception import TournamentNotFoundError, TournamentNotStartedError, TournamentMatchNotFoundError, TournamentPlayerNotFoundError
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.user_summary import UserSummary
from domain.user.repository.user_repository import UserRepository
from infrastructure.config import Settings
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament import TournamentPlayersRepositoryImpl, TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl

from domain.league.exception.league_exception import LeagueParticipantFoundError


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
            session_factory: Callable[[], AsyncSession],
            ticket_repository: TicketRepository,
            league_repository: LeagueRepository,
            user_repository: UserRepository,
            match_choices_repository: MatchChoiceRepository,
            match_repository: MatchRepository,
            league_players_repository: LeaguePlayersRepository,
            tournament_repository: TournamentRepository,
            tournament_players_repository: TournamentPlayersRepository,
            settings: Settings,
            publisher: RabbitMQPublisher
    ):
        self.ticket_repository: TicketRepository = ticket_repository
        self._session_factory = session_factory
        self.user_repository: UserRepository = user_repository
        self.league_repository: LeagueRepository = league_repository
        self.match_choices_repository: MatchChoiceRepository = match_choices_repository
        self.match_repository: MatchRepository = match_repository
        self.league_players_repository: LeaguePlayersRepository = league_players_repository
        self.settings: Settings = settings
        self.tournament_repository: TournamentRepository = tournament_repository
        self.tournament_players_repository: TournamentPlayersRepository = tournament_players_repository
        self.publisher: RabbitMQPublisher = publisher

    async def _process_match_choices(
            self,
            session: AsyncSession,
            updated: bool,
            ticket_id: int,
            match_choices_data: List[MatchChoiceData],
    ) -> None:
        mc_repo    = MatchChoicesRepositoryImpl(session)
        match_repo = MatchRepositoryImpl(session)

        if updated:
            await mc_repo.delete_by_ticket_id(ticket_id)

        already_started = await match_repo.exists_match_started_for_ticket(match_choices_data)
        if already_started:
            raise MatchAlreadyStartedError

        def normalize_choice(choice: str) -> str:
            c = (choice or '').strip()
            mapping = {
                'home': '1',
                'draw': 'N',
                'away': '2',
                '1': '1',
                '2': '2',
                'N': 'N',
                'n': 'N',
            }
            return mapping.get(c, c)

        for choice_data in match_choices_data:
            match = await match_repo.find_by_id(choice_data.match_id)
            if not match:
                raise MatchNotFoundError

            normalized = normalize_choice(choice_data.choice)
            mc = MatchChoice(
                match_id=match.id,
                ticket_id=ticket_id,
                choice=normalized,
                status=MatchChoiceStatus.pending,
            )
            await mc_repo.create(mc)


    async def create_ticket(
            self,
            league_id: int,
            ticket_create_model: TicketCreateModel,
            email: str
    ) -> TicketCreateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo          = UserRepositoryImpl(session)
                league_repo        = LeagueRepositoryImpl(session)
                players_repo       = LeaguePlayersRepositoryImpl(session)
                ticket_repo        = TicketRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                league = await league_repo.find_by_id(league_id)
                if not league:
                    raise LeagueNotFoundError

                participated = await players_repo.find_participation(
                    league_id=league.id, user_id=user.id
                )
                if not participated:
                    raise LeagueParticipantNotFoundError

                league_player = await players_repo.get_participation(
                    league_id=league.id, user_id=user.id
                )
                if league_player.nb_btl == 0:
                    raise NbBTLHasReached0
                if ticket_create_model.mise > league_player.nb_btl:
                    raise MiseSuperiorToNbBtlError
                if not league.is_started:
                    raise LeagueNotStartedError

                gain = await ticket_repo.get_gain(
                    ticket_create_model.match_choices,
                    ticket_create_model.mise
                )
                # if gain != ticket_create_model.gain:
                #     raise GainNotEqualsError

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
                await ticket_repo.create(ticket)

                league_player.nb_btl -= ticket_create_model.mise
                await players_repo.update(league_player)

                created = await ticket_repo.find_by_uuid(uuid)
                if not created:
                    raise TicketNotFoundError

                await self._process_match_choices(
                    session=session,
                    updated=False,
                    ticket_id=created.id,
                    match_choices_data=ticket_create_model.match_choices
                )

        return TicketCreateResponse(ticket_id=created.id)

    async def remove_ticket(self, email: str, ticket_id: int) -> TicketRemoveResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo           = UserRepositoryImpl(session)
                ticket_repo         = TicketRepositoryImpl(session)
                match_repo          = MatchRepositoryImpl(session)
                match_choices_repo  = MatchChoicesRepositoryImpl(session)

                ticket = await ticket_repo.find_by_id(ticket_id)
                if ticket.user.id != (await user_repo.find_by_email(email)).id:
                    raise NotTicketOwnerError

                choices = await match_choices_repo.find_all_by_ticket_id(ticket_id)
                choice_data_list = [
                    MatchChoiceData(match_id=mc.match_id, choice=mc.choice)
                    for mc in choices
                ]

                if await match_repo.exists_match_started_for_ticket(choice_data_list):
                    raise MatchAlreadyStartedError

                mise_to_refund = ticket.mise

                if ticket.league_id is not None:
                    players_repo = LeaguePlayersRepositoryImpl(session)
                    league_player = await players_repo.get_participation(
                        ticket.league_id,
                        ticket.user.id
                    )

                    if league_player is None:
                        raise LeagueParticipantFoundError

                    league_player.nb_btl += mise_to_refund
                    await players_repo.update(league_player)

                if ticket.tournament_match_id is not None:
                    tournament_players_repo = TournamentPlayersRepositoryImpl(session)
                    tournament_match_repo = TournamentMatchRepositoryImpl(session)

                    tournament_match = await tournament_match_repo.find_by_id(ticket.tournament_match_id)
                    if tournament_match is None:
                        raise TournamentMatchNotFoundError

                    tournament_player = await tournament_players_repo.get_player(
                        tournament_match.tournament_id,
                        ticket.user.id
                    )

                    if tournament_player is None:
                        raise TournamentPlayerNotFoundError

                    tournament_player.nb_btl += mise_to_refund
                    await tournament_players_repo.update(tournament_player)

                await match_choices_repo.delete_by_ticket_id(ticket.id)
                await ticket_repo.delete(ticket.id)

        return TicketRemoveResponse()

    async def update_ticket(
            self,
            email: str,
            ticket_id: int,
            ticket_update_model: TicketUpdateModel
    ) -> TicketUpdateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo           = UserRepositoryImpl(session)
                ticket_repo         = TicketRepositoryImpl(session)
                match_choices_repo  = MatchChoicesRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                ticket = await ticket_repo.find_by_id(ticket_id)
                if not ticket:
                    raise TicketNotFoundError

                if ticket.user.id != user.id:
                    raise NotTicketOwnerError

                mise_to_use = (
                    ticket_update_model.mise
                    if ticket_update_model.mise is not None
                    else ticket.mise
                )

                if ticket_update_model.match_choices:
                    choice_data = ticket_update_model.match_choices
                else:
                    existing_choices = await match_choices_repo.find_all_by_ticket_id(ticket.id)
                    choice_data = [
                        MatchChoiceData(match_id=mc.match_id, choice=mc.choice)
                        for mc in existing_choices
                    ]

                new_gain = await ticket_repo.get_gain(choice_data, mise_to_use)
                if new_gain != ticket_update_model.gain:
                    raise GainNotEqualsError

                if ticket_update_model.mise is not None:
                    ticket.mise = ticket_update_model.mise
                ticket.gain = new_gain
                await ticket_repo.update(ticket)

                if ticket_update_model.match_choices:
                    await self._process_match_choices(
                        session=session,
                        updated=True,
                        ticket_id=ticket.id,
                        match_choices_data=ticket_update_model.match_choices
                    )

        return TicketUpdateResponse()


    async def create_tournament_ticket(self, tournament_id: int, match_id: int, ticket_create_model: TicketCreateModel, email: str) -> TicketCreateResponse:
        async with self._session_factory() as session:
            async with session.begin():
                user_repo = UserRepositoryImpl(session)
                tournament_player_repo = TournamentPlayersRepositoryImpl(session)
                tournament_match_repo = TournamentMatchRepositoryImpl(session)
                ticket_repo = TicketRepositoryImpl(session)
                tournament_repo = TournamentRepositoryImpl(session)

                user = await user_repo.find_by_email(email)
                if not user:
                    raise UserNotFoundError

                tournament = await tournament_repo.find_by_id(tournament_id)
                if not tournament:
                    raise TournamentNotFoundError

                tournament_player = await tournament_player_repo.get_player(tournament_id, user.id)
                if not tournament_player or tournament_player.is_eliminated:
                    raise UserNotFoundError

                if ticket_create_model.mise > tournament_player.nb_btl:
                    raise MiseSuperiorToNbBtlError

                if tournament_player.nb_btl == 0:
                    raise NbBTLHasReached0

                if not tournament.status.IN_PROGRESS:
                    raise TournamentNotStartedError

                if ticket_create_model.mise > tournament_player.nb_btl:
                    raise MiseSuperiorToNbBtlError

                gain = await ticket_repo.get_gain(
                    ticket_create_model.match_choices,
                    ticket_create_model.mise
                )

                # if gain != tournament_ticket_create_model.gain:
                #     raise GainNotEqualsError

                match = await tournament_match_repo.find_by_id(match_id)
                if not match or match.tournament_id != tournament_id:
                    raise ValueError("Match not found")

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

                await ticket_repo.create(ticket)

                created = await ticket_repo.find_by_uuid(uuid)
                if not created:
                    raise TicketNotFoundError

                tournament_player.nb_btl -= ticket_create_model.mise
                await tournament_player_repo.update(tournament_player)

                await self._process_match_choices(
                    session=session,
                    updated=False,
                    ticket_id=created.id,
                    match_choices_data=ticket_create_model.match_choices
                )

        return TicketCreateResponse(ticket_id=created.id)

    async def check_match_choices_by_match_id(self, token: str, match_id: int):
        if token != self.settings.secret_key_token:
            raise TokenInvalidError

        await self.publisher.connect()

        async with self._session_factory() as session:
            async with session.begin():
                match_repo = MatchRepositoryImpl(session)
                mc_repo    = MatchChoicesRepositoryImpl(session)

                match = await match_repo.find_by_id(match_id)
                if not match:
                    raise MatchNotFoundError

                pending_choices = await mc_repo.get_match_choices_pending_by_match_id(match_id)

                for choice in pending_choices:
                    is_correct = await match_repo.is_correct_score(
                        choice=choice.choice,
                        match_id=match.id
                    )

                    if not isinstance(is_correct, bool):
                        continue

                    new_status = MatchChoiceStatus.correct if is_correct else MatchChoiceStatus.wrong
                    await mc_repo.mark_choice_status(choice.id, new_status)
                    await session.flush()

                    event = MatchChoiceStatusUpdatedEvent(
                        ticket_id=choice.ticket_id,
                        event_type="MatchChoiceStatusUpdatedEvent"
                    )
                    await self.publisher.publish_match_choice_status_updated(event)

                    return MatchChoiceUpdatedResponse()

                return NoMatchChoiceUpdatedResponse()

    async def check_ticket_status(self, token: str, ticket_id: int):
        if token != self.settings.secret_key_token:
            raise TokenInvalidError

        async with self._session_factory() as session:
            async with session.begin():
                ticket_repo    = TicketRepositoryImpl(session)
                match_choices_repository  = MatchChoicesRepositoryImpl(session)
                ticket = await ticket_repo.find_by_id(ticket_id)
                wrong, pend = await match_choices_repository.count_wrong_and_pending_by_ticket(ticket_id)
                await ticket_repo.apply_ticket_updates(
                    ticket_id=ticket.id,
                    user_id=ticket.user.id,
                    league_id=ticket.league_id,
                    wrong_count=wrong,
                    pending_count=pend,
                    gain=ticket.gain
                )
                # commit automatique à la sortie de session.begin()
                if wrong > 0 or pend == 0:
                    return TicketUpdatedResponse()
                else:
                    return NoTicketUpdatedResponse()
