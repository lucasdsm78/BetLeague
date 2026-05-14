from types import SimpleNamespace

import pytest

from application.tournament.tournament_command_usecase import TournamentCommandUseCaseImpl
from domain.invitation.exception.invitation_exception import (
    InvitationDeletionNotAllowedError,
    InvitationNotFoundError,
)
from domain.invitation.model.invitation_status import InvitationStatus
from domain.tournament.exception.tournament_exception import (
    TournamentAlreadyStartedError,
    TournamentNotOwnerLeaguedError,
)
from domain.tournament.model.tournament import Tournament
from domain.tournament.model.tournament_status import TournamentStatus
from domain.user.model.email import Email
from domain.user.model.user_summary import UserSummary


class FakeTournamentUnitOfWork:
    def __init__(self, *, user_repo, tournament_repo, invitation_repo):
        self.user_repo = user_repo
        self.tournament_repo = tournament_repo
        self.invitation_repo = invitation_repo
        self.tournament_players_repo = SimpleNamespace()
        self.tournament_subscription_repo = SimpleNamespace()
        self.ticket_repo = SimpleNamespace()
        self.tournament_stage_repo = SimpleNamespace()
        self.tournament_match_repo = SimpleNamespace()
        self.committed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def commit(self):
        self.committed = True


class FakeUserRepository:
    def __init__(self, *, owner_id: int = 42):
        self.owner_id = owner_id

    async def find_by_email(self, email: str):
        return SimpleNamespace(id=self.owner_id, email=Email(email), pseudo='owner')


class FakeTournamentRepository:
    def __init__(self, *, owner_id: int = 42, status: TournamentStatus = TournamentStatus.PENDING):
        self.owner_id = owner_id
        self.status = status

    async def find_by_id_for_update(self, tournament_id: int):
        return Tournament(
            id=tournament_id,
            uuid=f"tournament-{tournament_id}",
            name=f"Tournament {tournament_id}",
            is_private=True,
            current_players=3,
            max_players=16,
            prize_pool=15.0,
            entry_fee=5.0,
            status=self.status,
            user=UserSummary(id=self.owner_id, email=Email('owner@example.com'), pseudo='owner'),
        )


class FakeInvitationRepository:
    def __init__(
            self,
            *,
            invitation=None,
    ):
        self.invitation = invitation
        self.deleted_invitation_id = None

    async def find_by_id(self, invitation_id: int):
        if self.invitation is None:
            raise InvitationNotFoundError
        return self.invitation

    async def delete(self, invitation_id: int):
        self.deleted_invitation_id = invitation_id
        return True


def make_invitation(*, status: InvitationStatus = InvitationStatus.pending, tournament_id: int | None = 12, user_sender_id: int = 42):
    return SimpleNamespace(
        id=5,
        user_id=7,
        user_sender_id=user_sender_id,
        tournament_id=tournament_id,
        league_id=None,
        status=status,
    )


@pytest.mark.asyncio
async def test_delete_tournament_invitation_deletes_pending_invitation_for_owner():
    invitation_repo = FakeInvitationRepository(invitation=make_invitation())
    uow = FakeTournamentUnitOfWork(
        user_repo=FakeUserRepository(owner_id=42),
        tournament_repo=FakeTournamentRepository(owner_id=42, status=TournamentStatus.PENDING),
        invitation_repo=invitation_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    result = await usecase.delete_invitation(5, 'owner@example.com')

    assert result.message == "L'invitation a bien été supprimée."
    assert invitation_repo.deleted_invitation_id == 5
    assert uow.committed is True


@pytest.mark.asyncio
async def test_delete_tournament_invitation_rejects_non_owner():
    invitation_repo = FakeInvitationRepository(invitation=make_invitation(user_sender_id=999))
    uow = FakeTournamentUnitOfWork(
        user_repo=FakeUserRepository(owner_id=42),
        tournament_repo=FakeTournamentRepository(owner_id=999, status=TournamentStatus.PENDING),
        invitation_repo=invitation_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    with pytest.raises(TournamentNotOwnerLeaguedError):
        await usecase.delete_invitation(5, 'owner@example.com')

    assert invitation_repo.deleted_invitation_id is None
    assert uow.committed is False


@pytest.mark.asyncio
async def test_delete_tournament_invitation_rejects_non_pending_invitation():
    invitation_repo = FakeInvitationRepository(invitation=make_invitation(status=InvitationStatus.accepted))
    uow = FakeTournamentUnitOfWork(
        user_repo=FakeUserRepository(owner_id=42),
        tournament_repo=FakeTournamentRepository(owner_id=42, status=TournamentStatus.PENDING),
        invitation_repo=invitation_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    with pytest.raises(InvitationDeletionNotAllowedError):
        await usecase.delete_invitation(5, 'owner@example.com')

    assert invitation_repo.deleted_invitation_id is None
    assert uow.committed is False


@pytest.mark.asyncio
async def test_delete_tournament_invitation_rejects_non_tournament_invitation():
    invitation_repo = FakeInvitationRepository(invitation=make_invitation(tournament_id=None))
    uow = FakeTournamentUnitOfWork(
        user_repo=FakeUserRepository(owner_id=42),
        tournament_repo=FakeTournamentRepository(owner_id=42, status=TournamentStatus.PENDING),
        invitation_repo=invitation_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    with pytest.raises(InvitationNotFoundError):
        await usecase.delete_invitation(5, 'owner@example.com')


@pytest.mark.asyncio
async def test_delete_tournament_invitation_rejects_started_tournament():
    invitation_repo = FakeInvitationRepository(invitation=make_invitation())
    uow = FakeTournamentUnitOfWork(
        user_repo=FakeUserRepository(owner_id=42),
        tournament_repo=FakeTournamentRepository(owner_id=42, status=TournamentStatus.IN_PROGRESS),
        invitation_repo=invitation_repo,
    )
    usecase = TournamentCommandUseCaseImpl(
        session_factory=lambda: SimpleNamespace(),
        uow_factory=lambda: uow,
    )

    with pytest.raises(TournamentAlreadyStartedError):
        await usecase.delete_invitation(5, 'owner@example.com')

    assert invitation_repo.deleted_invitation_id is None
    assert uow.committed is False

