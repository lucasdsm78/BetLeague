from typing import Optional

from domain.user.model.email import Email
from domain.user.model.password import Password


class User:
    def __init__(
            self,
            email: Email,
            pseudo: str,
            uuid: str,
            first_name: str,
            last_name: str,
            password: Password,
            id: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None,
    ):
        self.id: Optional[int] = id
        self.password: Password = password
        self.uuid: str = uuid
        self.email: Email = email
        self.created_at: Optional[int] = created_at
        self.pseudo: str = pseudo
        self.first_name: str = first_name
        self.last_name: str = last_name
        self.updated_at: Optional[int] = updated_at

    def token_details(self) -> dict:
        return dict(
            email=self.email.value,
            uuid=self.uuid,
            pseudo=self.pseudo,
            first_name=self.first_name,
            last_name=self.last_name,
            id=self.id
        )
