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
            btl_from_tickets: Optional[float] = None,
            nb_btl_paid: Optional[float] = None,
            nb_win: Optional[int] = None,
            nb_lose: Optional[int] = None,
            created_at: Optional[int] = None,
            updated_at: Optional[int] = None,
            two_factor_secret: Optional[str] = None,
            is_two_factor_enabled: bool = False,
            is_tournament_subscriber: bool = False,
            is_two_factor_verified: bool = False,
            deleted_at: Optional[int] = None,
            auth_revoked_at: Optional[int] = None,
    ):
        self.id: Optional[int] = id
        self.password: Password = password
        self.uuid: str = uuid
        self.email: Email = email
        self.created_at: Optional[int] = created_at
        self.pseudo: str = pseudo
        self.nb_btl: float = nb_btl
        self.nb_btl_paid: float = nb_btl_paid if nb_btl_paid is not None else 0
        self.btl_from_tickets: float = btl_from_tickets if btl_from_tickets is not None else 0
        self.nb_win: int = nb_win
        self.nb_lose: int = nb_lose
        self.updated_at: Optional[int] = updated_at
        self.two_factor_secret = two_factor_secret
        self.is_two_factor_enabled = is_two_factor_enabled
        self.is_two_factor_verified = is_two_factor_verified
        self.is_tournament_subscriber = is_tournament_subscriber
        self.deleted_at = deleted_at
        self.auth_revoked_at = auth_revoked_at

    def mark_as_deleted(
            self,
            *,
            anonymized_email: str,
            anonymized_pseudo: str,
            hashed_password: str,
            new_uuid: str,
            deleted_at: int,
            auth_revoked_at: int,
    ) -> None:
        self.email = Email(anonymized_email)
        self.pseudo = anonymized_pseudo
        self.password = Password(hashed_password)
        self.uuid = new_uuid
        self.two_factor_secret = None
        self.is_two_factor_enabled = False
        self.is_two_factor_verified = False
        self.is_tournament_subscriber = False
        self.deleted_at = deleted_at
        self.auth_revoked_at = auth_revoked_at

    def token_details(self) -> dict:
        return dict(
            email=self.email.value,
            uuid=self.uuid,
            pseudo=self.pseudo,
            id=self.id
        )

    def begin_two_factor_setup(self, encrypted_secret: str) -> None:
        self.two_factor_secret = encrypted_secret
        self.is_two_factor_enabled = False
        self.is_two_factor_verified = False

    def confirm_two_factor_setup(self) -> None:
        if not self.two_factor_secret:
            raise ValueError("2FA secret missing")
        self.is_two_factor_enabled = True
        self.is_two_factor_verified = True

    def disable_two_factor(self) -> None:
        self.two_factor_secret = None
        self.is_two_factor_enabled = False
        self.is_two_factor_verified = False
