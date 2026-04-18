from types import SimpleNamespace

import pytest

from application.purchase.purchase_query_usecase import PurchaseQueryUseCaseImpl
from domain.purchase.model.pack_summary import PackSummary
from domain.purchase.model.purchase import Purchase
from domain.purchase.model.purchase_status import PurchaseStatus
from domain.shop.exception.shop_exception import BTLPurchaseDisabledError
from domain.shop.service.shop_availability_policy import ShopAvailabilityPolicy
from domain.user.exception.user_exception import UserNotFoundError
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


class FakePackRepository:
    async def find_all(self):
        return []


class FakePurchaseRepository:
    def __init__(self, purchases):
        self.purchases = purchases
        self.requested_user_id = None

    async def find_all_by_user_id(self, user_id: int):
        self.requested_user_id = user_id
        return self.purchases


class FakeUserRepository:
    def __init__(self, user):
        self.user = user

    async def find_by_email(self, email: str):
        return self.user


@pytest.mark.asyncio
async def test_get_user_purchases_returns_connected_user_history_sorted_by_repository():
    user = SimpleNamespace(id=7, email=Email('player@example.com'), pseudo='player')
    purchases = [
        Purchase(
            id=2,
            uuid='purchase-2',
            pack=PackSummary(id=2, name='Pack Pro', price_cents=1999, total_btl=220),
            user=UserSummary(id=7, email=Email('player@example.com'), pseudo='player'),
            status=PurchaseStatus.succeeded,
            created_at=2000,
        ),
        Purchase(
            id=1,
            uuid='purchase-1',
            pack=PackSummary(id=1, name='Pack Starter', price_cents=999, total_btl=100),
            user=UserSummary(id=7, email=Email('player@example.com'), pseudo='player'),
            status=PurchaseStatus.pending,
            created_at=1000,
        ),
    ]
    purchase_repository = FakePurchaseRepository(purchases)
    usecase = PurchaseQueryUseCaseImpl(
        pack_repository=FakePackRepository(),
        purchase_repository=purchase_repository,
        user_repository=FakeUserRepository(user),
        shop_availability_policy=ShopAvailabilityPolicy(),
    )

    result = await usecase.get_user_purchases('player@example.com')

    assert purchase_repository.requested_user_id == 7
    assert [purchase.uuid for purchase in result] == ['purchase-2', 'purchase-1']


@pytest.mark.asyncio
async def test_get_user_purchases_raises_when_user_not_found():
    usecase = PurchaseQueryUseCaseImpl(
        pack_repository=FakePackRepository(),
        purchase_repository=FakePurchaseRepository([]),
        user_repository=FakeUserRepository(None),
        shop_availability_policy=ShopAvailabilityPolicy(),
    )

    with pytest.raises(UserNotFoundError):
        await usecase.get_user_purchases('missing@example.com')


@pytest.mark.asyncio
async def test_get_all_packs_raises_when_btl_purchase_disabled():
    usecase = PurchaseQueryUseCaseImpl(
        pack_repository=FakePackRepository(),
        purchase_repository=FakePurchaseRepository([]),
        user_repository=FakeUserRepository(SimpleNamespace(id=7, email=Email('player@example.com'), pseudo='player')),
        shop_availability_policy=ShopAvailabilityPolicy(shop_enabled=True, btl_purchase_enabled=False),
    )

    with pytest.raises(BTLPurchaseDisabledError):
        await usecase.get_all_packs('player@example.com')


