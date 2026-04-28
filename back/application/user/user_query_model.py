from typing import Optional, List

from pydantic import BaseModel

from domain.user.model.user import User
from domain.user.model.user_summary import UserSummary


class TournamentCreationAccessReadModel(BaseModel):
    monthly_free_tournaments_limit: int
    monthly_free_tournaments_used: int
    monthly_free_tournaments_remaining: int
    has_active_subscription: bool
    can_create_tournament: bool
    requires_tournament_subscription: bool


class CommerceAvailabilityReadModel(BaseModel):
    shop_enabled: bool
    btl_purchase_enabled: bool
    tournament_subscription_enabled: bool


class UserReadModel(BaseModel):

    id: int
    email: str
    pseudo: str
    nb_win: int
    nb_lose: int
    nb_btl: float
    is_tournament_subscriber: bool = False
    is_two_factor_enabled: bool = False
    tournament_creation_access: Optional[TournamentCreationAccessReadModel] = None
    commerce_availability: Optional[CommerceAvailabilityReadModel] = None

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity(
        user: User,
        tournament_creation_access: Optional[TournamentCreationAccessReadModel] = None,
        is_tournament_subscriber: Optional[bool] = None,
        commerce_availability: Optional[CommerceAvailabilityReadModel] = None,
    ) -> "UserReadModel":
        return UserReadModel(
            id=user.id,
            email=user.email.value,
            pseudo=user.pseudo,
            nb_win=user.nb_win,
            nb_lose=user.nb_lose,
            nb_btl=user.nb_btl,
            is_tournament_subscriber=user.is_tournament_subscriber if is_tournament_subscriber is None else is_tournament_subscriber,
            is_two_factor_enabled=user.is_two_factor_enabled,
            tournament_creation_access=tournament_creation_access,
            commerce_availability=commerce_availability,
        )


class UserSummaryReadModel(BaseModel):
    id: Optional[int] = None
    email: str
    pseudo: str

    class Config:
        arbitrary_types_allowed = True

    @classmethod
    def from_entity(cls, user_summary: UserSummary) -> 'UserSummaryReadModel':
        return cls(
            id=user_summary.id,
            email=str(user_summary.email),
            pseudo=user_summary.pseudo
        )


class UserSearchQuery(BaseModel):
    query: str
    limit: Optional[int] = 10

    class Config:
        arbitrary_types_allowed = True

    def validate_query(self) -> None:
        if not self.query or not isinstance(self.query, str):
            raise ValueError("Terme de recherche requis")

        trimmed = self.query.strip()
        if len(trimmed) < 2:
            raise ValueError("Le terme de recherche doit contenir au moins 2 caractères")

        if len(trimmed) > 50:
            raise ValueError("Le terme de recherche ne peut pas dépasser 50 caractères")

        import re
        forbidden_patterns = r'[<>\\&"\']|script|javascript|eval|onclick|onerror'
        if re.search(forbidden_patterns, trimmed, re.IGNORECASE):
            raise ValueError("Caractères ou mots-clés non autorisés dans la recherche")


class UserSearchResultModel(BaseModel):
    id: int
    pseudo: str
    email: str

    @staticmethod
    def from_user_read_model(user: UserReadModel) -> "UserSearchResultModel":
        return UserSearchResultModel(
            id=user.id,
            pseudo=user.pseudo or 'Utilisateur',
            email=user.email or ''
        )


class UserSearchResponse(BaseModel):
    users: List[UserSearchResultModel]
    total: int
    query: str
