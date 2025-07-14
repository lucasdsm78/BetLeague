from application.league.league_command_usecase import LeagueCommandUseCase, LeagueCommandUseCaseImpl
from application.league.league_query_usecase import LeagueQueryUseCase, LeagueQueryUseCaseImpl
from application.match.match_command_usecase import MatchCommandUseCase, MatchCommandUseCaseImpl
from application.match.match_query_usecase import MatchQueryUseCase, MatchQueryUseCaseImpl
from application.ticket.ticket_command_usecase import TicketCommandUseCase, TicketCommandUseCaseImpl
from application.ticket.ticket_query_usecase import TicketQueryUseCaseImpl, TicketQueryUseCase
from application.user.user_command_usecase import UserCommandUseCase, UserCommandUseCaseImpl
from application.user.user_query_usecase import UserQueryUseCase, UserQueryUseCaseImpl
from application.tournament.tournament_command_usecase import TournamentCommandUseCase, TournamentCommandUseCaseImpl
from application.tournament.tournament_query_usecase import TournamentQueryUseCase, TournamentQueryUseCaseImpl
from domain.invitation.repository.invitation_repository import InvitationRepository
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.totp_service import TOTPService
from domain.services.match_score_api.match_score_api import MatchScoreApi
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.tournament.repository.tournament_match_repository import TournamentMatchRepository
from domain.tournament.repository.tournament_stage_repository import TournamentStageRepository
from domain.user.repository.user_repository import UserRepository
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.repository.tournament_players_repository import TournamentPlayersRepository

from functools import lru_cache
from typing import Iterator, AsyncGenerator, Callable

from fastapi import Depends
from sqlalchemy.orm.session import Session

from infrastructure.config import Settings
from infrastructure.postgresql.database import AsyncSessionLocal
from infrastructure.postgresql.invitation.invitation_repository import InvitationRepositoryImpl
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.match_choices_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.tournament.tournament_match_repository import TournamentMatchRepositoryImpl
from infrastructure.postgresql.tournament.tournament_stage_repository import TournamentStageRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl
from infrastructure.postgresql.tournament.tournament_repository import TournamentRepositoryImpl
from infrastructure.postgresql.tournament.tournament_players_repository import TournamentPlayersRepositoryImpl
from infrastructure.scheduler.tournament_scheduler import TournamentScheduler, TournamentSchedulerImpl
from infrastructure.services.authentication.authentication import AuthenticationToken
from infrastructure.services.authentication.hash import HashImpl
from infrastructure.services.authentication.jwt_bearer import JwtBearer
from infrastructure.services.authentication.manager_token import JwtManagerTokenImpl
from infrastructure.services.authentication.totp_service import TOTPServiceImpl
from infrastructure.services.match_score_api.match_score_api import MatchScoreApiImpl
from sqlalchemy.ext.asyncio import AsyncSession

jwt_auth = JwtBearer()


def get_session() -> Iterator[Session]:
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        session.close()

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            pass

def get_session_factory() -> Callable[[], AsyncSession]:
    return AsyncSessionLocal

@lru_cache()
def get_settings() -> Settings:
    return Settings()


def manager_token_dependency(settings: Settings = Depends(get_settings)) -> ManagerToken:
    return JwtManagerTokenImpl(settings=settings)


def hash_dependency() -> Hash:
    return HashImpl()


def totp_service() -> TOTPService:
    return TOTPServiceImpl()


def match_score_api(settings: Settings = Depends(get_settings)) -> MatchScoreApi:
    return MatchScoreApiImpl(settings=settings)


def user_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> UserRepository:
    return UserRepositoryImpl(session)


def ticket_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TicketRepository:
    return TicketRepositoryImpl(session)


def match_choices_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> MatchChoiceRepository:
    return MatchChoicesRepositoryImpl(session)


def league_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> LeagueRepository:
    return LeagueRepositoryImpl(session)


def league_players_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> LeaguePlayersRepository:
    return LeaguePlayersRepositoryImpl(session)


def tournament_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentRepository:
    return TournamentRepositoryImpl(session)


def tournament_stage_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentStageRepository:
    return TournamentStageRepositoryImpl(session)


def tournament_players_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentPlayersRepository:
    return TournamentPlayersRepositoryImpl(session)


def tournament_match_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> TournamentMatchRepository:
    return TournamentMatchRepositoryImpl(session)


def match_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> MatchRepository:
    return MatchRepositoryImpl(session)


def invitation_repository_dependency(session: AsyncSession = Depends(get_async_session)) -> InvitationRepository:
    return InvitationRepositoryImpl(session)

def user_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        user_repository: UserRepository = Depends(user_repository_dependency),
        hasher: Hash = Depends(hash_dependency),
        manager_token: ManagerToken = Depends(manager_token_dependency),
        totp_service: TOTPService = Depends(totp_service),
        settings: Settings = Depends(get_settings)
) -> UserCommandUseCase:
    return UserCommandUseCaseImpl(
        user_repository=user_repository,
        hasher=hasher,
        session_factory=session_factory,
        manager_token=manager_token,
        totp_service=totp_service,
        settings=settings
    )


def league_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency),
        invitation_repository: InvitationRepository = Depends(invitation_repository_dependency),
) -> LeagueCommandUseCase:
    return LeagueCommandUseCaseImpl(
        session_factory=session_factory,
        league_repository=league_repository,
        user_repository=user_repository,
        league_players_repository=league_players_repository,
        invitation_repository=invitation_repository
    )

def league_query_usecase(
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency),
        user_repository_dependency: UserRepository = Depends(user_repository_dependency),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        invitation_repository_dependency: InvitationRepository = Depends(invitation_repository_dependency),
) -> LeagueQueryUseCase:
    return LeagueQueryUseCaseImpl(
        league_players_repository=league_players_repository,
        user_repository=user_repository_dependency,
        league_repository=league_repository,
        invitation_repository=invitation_repository_dependency,
    )

def ticket_query_usecase(
        match_choices_repository: MatchChoiceRepository = Depends(match_choices_repository_dependency),
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        user_repository_dependency: UserRepository = Depends(user_repository_dependency),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        match_repository: MatchRepository = Depends(match_repository_dependency),
        ticket_repository: TicketRepository = Depends(ticket_repository_dependency)
) -> TicketQueryUseCase:
    return TicketQueryUseCaseImpl(
        ticket_repository=ticket_repository,
        session_factory=session_factory,
        match_repository=match_repository,
        match_choices_repository=match_choices_repository,
        user_repository=user_repository_dependency,
        league_repository=league_repository
    )


def ticket_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        ticket_repository: TicketRepository = Depends(ticket_repository_dependency),
        match_choices_repository: MatchChoiceRepository = Depends(match_choices_repository_dependency),
        match_repository: MatchRepository = Depends(match_repository_dependency),
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency),
        settings: Settings = Depends(get_settings)
) -> TicketCommandUseCase:
    return TicketCommandUseCaseImpl(
        league_repository=league_repository,
        session_factory=session_factory,
        user_repository=user_repository,
        ticket_repository=ticket_repository,
        match_choices_repository=match_choices_repository,
        match_repository=match_repository,
        league_players_repository=league_players_repository,
        settings=settings
    )


def user_query_usecase(
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> UserQueryUseCase:
    return UserQueryUseCaseImpl(
        user_repository=user_repository
    )


def match_query_usecase(
        match_repository: MatchRepository = Depends(match_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> MatchQueryUseCase:
    return MatchQueryUseCaseImpl(
        match_repository=match_repository,
        user_repository=user_repository
    )


def match_command_usecase(
        match_repository: MatchRepository = Depends(match_repository_dependency),
        settings: Settings = Depends(get_settings),
        match_score_api_dependency: MatchScoreApi = Depends(match_score_api)
) -> MatchCommandUseCase:
    return MatchCommandUseCaseImpl(
        match_repository=match_repository,
        settings=settings,
        match_score_api=match_score_api_dependency
    )


def tournament_command_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory)
) -> TournamentCommandUseCase:
    return TournamentCommandUseCaseImpl(
        session_factory=session_factory
    )

def tournament_query_usecase(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
        tournament_repository: TournamentRepository = Depends(tournament_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        stage_repository: TournamentStageRepository = Depends(tournament_stage_repository_dependency),
        tournament_match_repository: TournamentMatchRepository = Depends(tournament_match_repository_dependency)
) -> TournamentQueryUseCase:
    return TournamentQueryUseCaseImpl(
        session_factory=session_factory,
        tournament_repository=tournament_repository,
        user_repository=user_repository,
        tournament_stage_repository=stage_repository,
        tournament_match_repository=tournament_match_repository,
        stage_repository=stage_repository
    )

def tournament_scheduler(
        session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
) -> TournamentScheduler:
    return TournamentSchedulerImpl(
        session_factory=session_factory,
    )


async def authentication(
        manager_token: ManagerToken = Depends(manager_token_dependency),
        token: str = Depends(jwt_auth)
) -> str:
    token_authenticator = AuthenticationToken(
        manager_token=manager_token,
        token=token
    )
    return await token_authenticator.authentication()


async def current_user(
        token: str = Depends(authentication),
        manager_token: ManagerToken = Depends(manager_token_dependency)
) -> dict:
    return await manager_token.decode_token_login(token)
