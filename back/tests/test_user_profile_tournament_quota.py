import pytest

from application.user.user_query_usecase import UserQueryUseCaseImpl
from domain.shop.service.shop_availability_policy import ShopAvailabilityPolicy
from domain.tournament.repository.tournament_repository import TournamentRepository
from domain.tournament.service.tournament_creation_policy import TournamentCreationPolicy
from domain.tournament_subscription.repository.tournament_subscription_repository import TournamentSubscriptionRepository
from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from domain.user.repository.user_repository import UserRepository


class FakeUserRepository(UserRepository):
    def __init__(self, user: User):
        self.user = user

    async def create(self, user: User):
        raise NotImplementedError

    async def commit(self):
        raise NotImplementedError

    async def find_by_email(self, email: str):
        if email == self.user.email.value:
            return self.user
        return None

    async def credit_btl(self, user_id: int, amount: float):
        raise NotImplementedError

    async def find_by_pseudo_or_email(self, pseudo=None, email=None):
        raise NotImplementedError

    async def find_by_pseudo(self, pseudo: str):
        raise NotImplementedError

    async def update(self, user: User):
        raise NotImplementedError

    async def find_by_id(self, user_id: int):
        if user_id == self.user.id:
            return self.user
        return None

    async def find_users(self):
        return [self.user]

    async def delete_user(self, user_id: int):
        raise NotImplementedError

    async def get_all_rank_users(self):
        raise NotImplementedError

    async def find_users_by_ids(self, user_ids: list[int]):
        raise NotImplementedError

    async def apply_ticket_win(self, user_id: int, gain: float) -> None:
        raise NotImplementedError

    async def apply_ticket_lose(self, user_id: int) -> None:
        raise NotImplementedError

    async def rollback(self):
        raise NotImplementedError


class FakeTournamentRepository(TournamentRepository):
    def __init__(self, monthly_used: int):
        self.monthly_used = monthly_used

    async def create(self, tournament):
        raise NotImplementedError

    async def find_by_id(self, tournament_id: int):
        raise NotImplementedError

    async def find_by_name(self, tournament_name: str):
        raise NotImplementedError

    async def find_all_by_user_creator(self, user_id: int):
        raise NotImplementedError

    async def find_all_by_user_participant(self, user_id: int, limit: int, offset: int):
        raise NotImplementedError

    async def find_all_by_status(self, status: str):
        raise NotImplementedError

    async def find_available_tournaments_public(self, user_id: int, limit: int, offset: int):
        raise NotImplementedError

    async def find_finished_tournaments(self, user_id: int, limit: int, offset: int):
        raise NotImplementedError

    async def find_created_tournaments(self, user_id: int, limit: int, offset: int):
        raise NotImplementedError

    async def find_by_uuid(self, uuid: str):
        raise NotImplementedError

    async def find_by_id_for_update(self, tournament_id: int):
        raise NotImplementedError

    async def find_due_tournament_ids(self, now_ms: int, limit: int):
        raise NotImplementedError

    async def find_in_progress_for_user(self, user_id: int):
        raise NotImplementedError

    async def update(self, tournament):
        raise NotImplementedError

    async def count_players(self, tournament_id: int) -> int:
        raise NotImplementedError

    async def begin(self):
        raise NotImplementedError

    async def commit(self):
        raise NotImplementedError

    async def rollback(self):
        raise NotImplementedError

    async def count_created_by_user_between(self, user_id: int, created_from_ms: int, created_to_ms: int) -> int:
        return self.monthly_used


class FakeSubscription:
    def __init__(self, active: bool):
        self._active = active

    def is_active(self) -> bool:
        return self._active


class FakeTournamentSubscriptionRepository(TournamentSubscriptionRepository):
    def __init__(self, subscription=None):
        self.subscription = subscription

    async def create(self, subscription):
        raise NotImplementedError

    async def find_active_by_user_id(self, user_id: int):
        return self.subscription

    async def find_by_id(self, subscription_id: int):
        raise NotImplementedError

    async def find_by_uuid(self, uuid: str):
        raise NotImplementedError

    async def find_by_stripe_subscription_id(self, stripe_subscription_id: str):
        raise NotImplementedError

    async def update(self, subscription):
        raise NotImplementedError

    async def commit(self):
        raise NotImplementedError

    async def rollback(self):
        raise NotImplementedError


def make_user() -> User:
    return User(
        id=77,
        email=Email("quota@example.com"),
        pseudo="quota-player",
        uuid="quota-uuid",
        password=Password("hashed::secret"),
        nb_win=5,
        nb_lose=2,
        nb_btl=125.0,
        is_tournament_subscriber=False,
        is_two_factor_enabled=True,
    )


@pytest.mark.asyncio
async def test_fetch_user_by_id_includes_tournament_creation_access_for_profile_me():
    user = make_user()
    usecase = UserQueryUseCaseImpl(
        user_repository=FakeUserRepository(user),
        tournament_repository=FakeTournamentRepository(monthly_used=1),
        tournament_subscription_repository=FakeTournamentSubscriptionRepository(subscription=None),
        tournament_creation_policy=TournamentCreationPolicy(),
    )

    result = await usecase.fetch_user_by_id(user.id, user.email.value)

    assert result is not None
    assert result.email == "quota@example.com"
    assert result.tournament_creation_access is not None
    assert result.tournament_creation_access.monthly_free_tournaments_limit == 2
    assert result.tournament_creation_access.monthly_free_tournaments_used == 1
    assert result.tournament_creation_access.monthly_free_tournaments_remaining == 1
    assert result.tournament_creation_access.has_active_subscription is False
    assert result.tournament_creation_access.can_create_tournament is True
    assert result.commerce_availability is not None
    assert result.commerce_availability.shop_enabled is True
    assert result.commerce_availability.btl_purchase_enabled is True
    assert result.commerce_availability.tournament_subscription_enabled is True


@pytest.mark.asyncio
async def test_fetch_user_by_id_reports_unlimited_when_subscription_active():
    user = make_user()
    usecase = UserQueryUseCaseImpl(
        user_repository=FakeUserRepository(user),
        tournament_repository=FakeTournamentRepository(monthly_used=2),
        tournament_subscription_repository=FakeTournamentSubscriptionRepository(subscription=FakeSubscription(active=True)),
        tournament_creation_policy=TournamentCreationPolicy(),
    )

    result = await usecase.fetch_user_by_id(user.id, user.email.value)

    assert result is not None
    assert result.tournament_creation_access is not None
    assert result.tournament_creation_access.has_active_subscription is True
    assert result.tournament_creation_access.can_create_tournament is True
    assert result.tournament_creation_access.requires_tournament_subscription is False
    assert result.tournament_creation_access.monthly_free_tournaments_used == 2
    assert result.tournament_creation_access.monthly_free_tournaments_remaining == 0
    assert result.is_tournament_subscriber is True


@pytest.mark.asyncio
async def test_fetch_user_by_id_uses_active_subscription_as_source_of_truth_for_profile_flag():
    user = make_user()
    user.is_tournament_subscriber = False
    usecase = UserQueryUseCaseImpl(
        user_repository=FakeUserRepository(user),
        tournament_repository=FakeTournamentRepository(monthly_used=2),
        tournament_subscription_repository=FakeTournamentSubscriptionRepository(subscription=FakeSubscription(active=True)),
        tournament_creation_policy=TournamentCreationPolicy(),
    )

    result = await usecase.fetch_user_by_id(user.id, user.email.value)

    assert result is not None
    assert result.is_tournament_subscriber is True


@pytest.mark.asyncio
async def test_fetch_user_by_id_exposes_disabled_commerce_flags():
    user = make_user()
    usecase = UserQueryUseCaseImpl(
        user_repository=FakeUserRepository(user),
        tournament_repository=FakeTournamentRepository(monthly_used=0),
        tournament_subscription_repository=FakeTournamentSubscriptionRepository(subscription=None),
        tournament_creation_policy=TournamentCreationPolicy(),
        shop_availability_policy=ShopAvailabilityPolicy(shop_enabled=False),
    )

    result = await usecase.fetch_user_by_id(user.id, user.email.value)

    assert result is not None
    assert result.commerce_availability is not None
    assert result.commerce_availability.shop_enabled is False
    assert result.commerce_availability.btl_purchase_enabled is False
    assert result.commerce_availability.tournament_subscription_enabled is False

