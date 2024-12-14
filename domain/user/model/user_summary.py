from typing import Optional

from domain.user.model.email import Email


class UserSummary:

    def __init__(
            self,
            email: Email,
            id: Optional[int] = None
    ):
        self.id: int = id
        self.email: Email = email

    def __eq__(self, o: object) -> bool:
        if isinstance(o, UserSummary):
            return self.id == o.id

        return False
