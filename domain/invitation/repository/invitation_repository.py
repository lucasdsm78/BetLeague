from abc import ABC, abstractmethod
from typing import Optional, List, Dict

from domain.invitation.model.invitation import Invitation
from domain.invitation.model.invitation_status import InvitationStatus


class InvitationRepository(ABC):

    @abstractmethod
    def add(self, invitation: Invitation) -> Optional[Invitation]:
        raise NotImplementedError

    @abstractmethod
    def find_by_id(self, invitation_id: int) -> Optional[Invitation]:
        raise NotImplementedError

    @abstractmethod
    def find_by_user_id_league_id(self, user_id: int, league_id: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    def find_invitations(
            self,
            user_id: int,
            status: Optional[InvitationStatus] = None,
            page: int = 1,
            limit: int = 10
    ) -> Dict[str, List[Invitation]]:
        raise NotImplementedError

    @abstractmethod
    def update(self, invitation: Invitation) -> Optional[Invitation]:
        raise NotImplementedError

    @abstractmethod
    def commit(self):
        raise NotImplementedError

    @abstractmethod
    def rollback(self):
        raise NotImplementedError
