from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus


class InvitationRepository(ABC):

    @abstractmethod
    async def add(self, invitation: Invitation) -> Optional[Invitation]:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, invitation_id: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def find_by_id(self, invitation_id: int) -> Optional[Invitation]:
        raise NotImplementedError

    @abstractmethod
    async def find_by_user_id_league_id(self, user_id: int, league_id: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def find_by_user_id_tournament_id(self, user_id: int, tournament_id: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def find_tournament_invitations_sent_by_owner(self, tournament_id: int, owner_user_id: int):
        raise NotImplementedError

    @abstractmethod
    async def find_received_invitations(
            self,
            user_id: int,
            status: Optional[InvitationStatus] = None,
            page: int = 1,
            page_size: int = 20,
    ):
        raise NotImplementedError

    @abstractmethod
    async def count_received_invitations(
            self,
            user_id: int,
            status: Optional[InvitationStatus] = None,
    ) -> int:
        raise NotImplementedError

    @abstractmethod
    async def find_invitations(
            self,
            user_id: int,
            is_received: bool,
            status: Optional[InvitationStatus] = None,
            page: int = 1,
            limit: int = 10
    ) -> Dict[str, List[Invitation]]:
        raise NotImplementedError

    @abstractmethod
    async def count_by_status(self, user_id: int, is_received: bool) -> Dict[str, int]:
        raise NotImplementedError

    @abstractmethod
    async def delete_tournament_invitation_if_owner(self, *, invitation_id: int, owner_user_id: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def begin(self):
        raise NotImplementedError

    @abstractmethod
    async def commit(self):
        raise NotImplementedError

    @abstractmethod
    async def rollback(self):
        raise NotImplementedError
