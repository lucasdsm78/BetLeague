import pytest

from application.user.user_query_model import UserSearchQuery
from application.user.user_query_usecase import UserQueryUseCaseImpl
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User


class FakeUserRepository:
    def __init__(self, users: list[User]):
        self._users = users

    async def find_users(self):
        return self._users


def make_user(*, user_id: int, pseudo: str, email: str) -> User:
    return User(
        id=user_id,
        email=Email(email),
        pseudo=pseudo,
        uuid=f"user-{user_id}-uuid",
        password=Password("hashed::secret"),
        nb_win=0,
        nb_lose=0,
        nb_btl=0.0,
    )


@pytest.mark.asyncio
async def test_search_users_returns_pseudo_only_without_exposing_email():
    usecase = UserQueryUseCaseImpl.model_construct(
        user_repository=FakeUserRepository([
            make_user(user_id=7, pseudo="Lucas", email="lucas@example.com"),
            make_user(user_id=8, pseudo="Amelie", email="amelie@example.com"),
        ]),
        tournament_repository=None,
        tournament_subscription_repository=None,
    )

    result = await usecase.search_users(UserSearchQuery(query="luc", limit=10))

    assert result.total == 1
    assert [user.pseudo for user in result.users] == ["Lucas"]
    payload = result.model_dump()
    assert payload["users"] == [{"id": 7, "pseudo": "Lucas"}]
    assert "email" not in payload["users"][0]


@pytest.mark.asyncio
async def test_search_users_can_still_match_email_without_returning_it():
    usecase = UserQueryUseCaseImpl.model_construct(
        user_repository=FakeUserRepository([
            make_user(user_id=7, pseudo="Lucas", email="lucas@example.com"),
            make_user(user_id=8, pseudo="Amelie", email="amelie@example.com"),
        ]),
        tournament_repository=None,
        tournament_subscription_repository=None,
    )

    result = await usecase.search_users(UserSearchQuery(query="lucas@example", limit=10))

    assert result.total == 1
    assert result.users[0].id == 7
    assert result.users[0].pseudo == "Lucas"
    assert "email" not in result.model_dump()["users"][0]

