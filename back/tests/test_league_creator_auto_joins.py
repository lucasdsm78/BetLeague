import pytest


@pytest.mark.skip(reason="TODO: ajouter fixtures DB async_session_factory pour tests d'intégration league")
def test_creator_is_member_on_league_create():
    # Ce test devra valider qu'après POST /api/league/create le créateur est membre.
    assert True
