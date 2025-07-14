from abc import abstractmethod, ABC
from typing import List, Callable

from sqlalchemy.ext.asyncio import AsyncSession
import shortuuid

from application.ticket.ticket_command_model import TicketCreateModel, TicketCreateResponse, TicketRemoveResponse, \
    TicketUpdateResponse, MatchChoiceData, TicketUpdateModel
from domain.league.exception.league_exception import LeagueNotFoundError, LeagueParticipantNotFoundError, \
    NbBTLHasReached0, LeagueNotStartedError
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.exception.match_exception import MatchNotFoundError
from domain.match.repository.match_repository import MatchRepository
from domain.ticket.exception.ticket_exception import GainNotEqualsError, TicketNotFoundError, NotTicketOwnerError, \
    MatchAlreadyStartedError, MiseSuperiorToNbBtlError
from domain.ticket.model.match_choice import MatchChoice
from domain.ticket.model.match_choice_status import MatchChoiceStatus
from domain.ticket.model.ticket import Ticket
from domain.ticket.model.ticket_status import TicketStatus
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.tournament import TournamentPlayersRepository, TournamentRepository
from domain.tournament.exception.tournament_exception import TournamentNotFoundError, TournamentNotStartedError
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
            settings: Settings
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

        for choice_data in match_choices_data:
            match = await match_repo.find_by_id(choice_data.match_id)
            if not match:
                raise MatchNotFoundError

            mc = MatchChoice(
                match_id=match.id,
                ticket_id=ticket_id,
                choice=choice_data.choice,
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

        return TicketCreateResponse()

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

                created = await tournament_repo.find_by_uuid(uuid)
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

        return TicketCreateResponse()
