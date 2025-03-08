from typing import Optional

from domain.user.model.email import Email
from domain.user.model.password import Password


class User:
    def __init__(
            self,
            email: Email,
            pseudo: str,
            uuid: str,
            password: Password,
            id: Optional[int] = None,
            nb_btl: Optional[float] = None,
            nb_win: Optional[int] = None,
            nb_lose: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None,
            two_factor_secret: Optional[str] = None,
            is_two_factor_enabled: bool = False,
            is_two_factor_verified: bool = False
    ):
        self.id: Optional[int] = id
        self.password: Password = password
        self.uuid: str = uuid
        self.email: Email = email
        self.created_at: Optional[int] = created_at
        self.pseudo: str = pseudo
        self.nb_btl: float = nb_btl
        self.nb_win: int = nb_win
        self.nb_lose: int = nb_lose
        self.updated_at: Optional[int] = updated_at
        self.two_factor_secret = two_factor_secret
        self.is_two_factor_enabled = is_two_factor_enabled
        self.is_two_factor_verified = is_two_factor_verified

    def token_details(self) -> dict:
        return dict(
            email=self.email.value,
            uuid=self.uuid,
            pseudo=self.pseudo,
            id=self.id
        )
