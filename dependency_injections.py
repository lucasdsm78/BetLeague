from application.league.league_command_usecase import LeagueCommandUseCase, LeagueCommandUseCaseImpl
from application.match.match_query_usecase import MatchQueryUseCase, MatchQueryUseCaseImpl
from application.ticket.ticket_command_usecase import TicketCommandUseCase, TicketCommandUseCaseImpl
from application.user.user_command_usecase import UserCommandUseCase, UserCommandUseCaseImpl
from application.user.user_query_usecase import UserQueryUseCase, UserQueryUseCaseImpl
from domain.league.repository.league_players_repository import LeaguePlayersRepository
from domain.league.repository.league_repository import LeagueRepository
from domain.match.repository.match_repository import MatchRepository
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.services.authentication.totp_service import TOTPService
from domain.ticket.repository.match_choice_repository import MatchChoiceRepository
from domain.ticket.repository.ticket_repository import TicketRepository
from domain.user.repository.user_repository import UserRepository

from functools import lru_cache
from typing import Iterator

from fastapi import Depends
from sqlalchemy.orm.session import Session

from infrastructure.config import Settings
from infrastructure.postgresql.database import SessionLocal
from infrastructure.postgresql.league.league_players_repository import LeaguePlayersRepositoryImpl
from infrastructure.postgresql.league.league_repository import LeagueRepositoryImpl
from infrastructure.postgresql.match.match_repository import MatchRepositoryImpl
from infrastructure.postgresql.ticket.league_players_repository import MatchChoicesRepositoryImpl
from infrastructure.postgresql.ticket.ticket_repository import TicketRepositoryImpl
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl
from infrastructure.services.authentication.authentication import AuthenticationToken
from infrastructure.services.authentication.hash import HashImpl
from infrastructure.services.authentication.jwt_bearer import JwtBearer
from infrastructure.services.authentication.manager_token import JwtManagerTokenImpl
from infrastructure.services.authentication.totp_service import TOTPServiceImpl

jwt_auth = JwtBearer()


def get_session() -> Iterator[Session]:
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def manager_token_dependency(settings: Settings = Depends(get_settings)) -> ManagerToken:
    return JwtManagerTokenImpl(settings=settings)


def hash_dependency() -> Hash:
    return HashImpl()


def totp_service() -> TOTPService:
    return TOTPServiceImpl()


def user_repository_dependency(session: Session = Depends(get_session)) -> UserRepository:
    return UserRepositoryImpl(session)


def ticket_repository_dependency(session: Session = Depends(get_session)) -> TicketRepository:
    return TicketRepositoryImpl(session)


def match_choices_repository_dependency(session: Session = Depends(get_session)) -> MatchChoiceRepository:
    return MatchChoicesRepositoryImpl(session)


def league_repository_dependency(session: Session = Depends(get_session)) -> LeagueRepository:
    return LeagueRepositoryImpl(session)


def league_players_repository_dependency(session: Session = Depends(get_session)) -> LeaguePlayersRepository:
    return LeaguePlayersRepositoryImpl(session)


def match_repository_dependency(session: Session = Depends(get_session)) -> MatchRepository:
    return MatchRepositoryImpl(session)


def user_command_usecase(
        user_repository: UserRepository = Depends(user_repository_dependency),
        hasher: Hash = Depends(hash_dependency),
        manager_token: ManagerToken = Depends(manager_token_dependency),
        totp_service: TOTPService = Depends(totp_service),
        settings: Settings = Depends(get_settings)
) -> UserCommandUseCase:
    return UserCommandUseCaseImpl(
        user_repository=user_repository,
        hasher=hasher,
        manager_token=manager_token,
        totp_service=totp_service,
        settings=settings
    )


def league_command_usecase(
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency)
) -> LeagueCommandUseCase:
    return LeagueCommandUseCaseImpl(
        league_repository=league_repository,
        user_repository=user_repository,
        league_players_repository=league_players_repository
    )


def ticket_command_usecase(
        league_repository: LeagueRepository = Depends(league_repository_dependency),
        user_repository: UserRepository = Depends(user_repository_dependency),
        ticket_repository: TicketRepository = Depends(ticket_repository_dependency),
        match_choices_repository: MatchChoiceRepository = Depends(match_choices_repository_dependency),
        match_repository: MatchRepository = Depends(match_repository_dependency),
        league_players_repository: LeaguePlayersRepository = Depends(league_players_repository_dependency)
) -> TicketCommandUseCase:
    return TicketCommandUseCaseImpl(
        league_repository=league_repository,
        user_repository=user_repository,
        ticket_repository=ticket_repository,
        match_choices_repository=match_choices_repository,
        match_repository=match_repository,
        league_players_repository=league_players_repository
    )


def user_query_usecase(
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> UserQueryUseCase:
    return UserQueryUseCaseImpl(
        user_repository=user_repository
    )


def match_query_usecase(
        match_repository: MatchRepository = Depends(match_repository_dependency)
) -> MatchQueryUseCase:
    return MatchQueryUseCaseImpl(
        match_repository=match_repository
    )


def authentication(
        manager_token: ManagerToken = Depends(manager_token_dependency),
        token: str = Depends(jwt_auth)
) -> str:
    token_authenticator = AuthenticationToken(
        manager_token=manager_token,
        token=token
    )
    return token_authenticator.authentication()


def current_user(token: str = Depends(authentication),
                 manager_token: ManagerToken = Depends(manager_token_dependency)
                 ) -> dict:
    return manager_token.decode_token_login(token)
