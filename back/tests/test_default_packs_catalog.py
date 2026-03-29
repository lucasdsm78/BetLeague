from application.purchase.default_packs import get_default_packs_catalog


def test_default_packs_catalog_is_stable_and_sorted_by_price():
    packs = get_default_packs_catalog()

    assert [pack.name for pack in packs] == ["Pack Starter", "Pack Pro", "Pack Elite"]
    assert [pack.price_cents for pack in packs] == [399, 1299, 2499]
    assert [pack.total_btl for pack in packs] == [50, 220, 575]
    assert all(pack.price_per_100 > 0 for pack in packs)
