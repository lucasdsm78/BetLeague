from infrastructure.config import Settings


def test_fastapi_docs_are_disabled_in_prod():
    settings = Settings.model_construct(environment="prod")

    assert settings.fastapi_docs_enabled is False
    assert settings.fastapi_docs_urls == {
        "docs_url": None,
        "redoc_url": None,
        "openapi_url": None,
    }


def test_fastapi_docs_are_enabled_outside_prod():
    settings = Settings.model_construct(environment="dev")

    assert settings.fastapi_docs_enabled is True
    assert settings.fastapi_docs_urls == {
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "openapi_url": "/openapi.json",
    }

