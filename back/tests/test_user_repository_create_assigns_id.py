import pytest

from domain.user.model.email import Email
from domain.user.model.password import Password
from domain.user.model.user import User
from infrastructure.postgresql.init_models import init_models
from infrastructure.postgresql.user.user_repository import UserRepositoryImpl


init_models()


class FakeAsyncSession:
    def __init__(self):
        self.added = None
        self.flush_called = False

    def add(self, instance):
        self.added = instance

    async def flush(self):
        self.flush_called = True
        self.added.id = 123


@pytest.mark.asyncio
async def test_create_assigns_generated_database_id_back_to_domain_user():
    session = FakeAsyncSession()
    repository = UserRepositoryImpl(session)
    user = User(
        email=Email("new@example.com"),
        pseudo="new-user",
        uuid="uuid-new-user",
        password=Password("hashed::password"),
    )

    await repository.create(user)

    assert session.flush_called is True
    assert session.added is not None
    assert session.added.id == 123
    assert user.id == 123
    assert user.created_at == session.added.created_at
    assert user.updated_at == session.added.updated_at


