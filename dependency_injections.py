from application.user.user_command_usecase import UserCommandUseCase, UserCommandUseCaseImpl
from application.user.user_query_usecase import UserQueryUseCase, UserQueryUseCaseImpl
from domain.services.authentication.hash import Hash
from domain.services.authentication.manager_token import ManagerToken
from domain.user.repository.user_repository import UserRepository

from functools import lru_cache
from typing import Iterator

from fastapi import Depends
from sqlalchemy.orm.session import Session

from infrastructure.config import Settings
from infrastructure.postgresql.database import SessionLocal
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl
from infrastructure.services.authentication.authentication import AuthenticationToken
from infrastructure.services.authentication.hash import HashImpl
from infrastructure.services.authentication.jwt_bearer import JwtBearer
from infrastructure.services.authentication.manager_token import JwtManagerTokenImpl

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


def user_repository_dependency(session: Session = Depends(get_session)) -> UserRepository:
    return UserRepositoryImpl(session)


def user_command_usecase(
        user_repository: UserRepository = Depends(user_repository_dependency),
        hasher: Hash = Depends(hash_dependency),
        manager_token: ManagerToken = Depends(manager_token_dependency),
) -> UserCommandUseCase:
    return UserCommandUseCaseImpl(
        user_repository=user_repository,
        hasher=hasher,
        manager_token=manager_token
    )


def user_query_usecase(
        user_repository: UserRepository = Depends(user_repository_dependency)
) -> UserQueryUseCase:
    return UserQueryUseCaseImpl(
        user_repository=user_repository
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
