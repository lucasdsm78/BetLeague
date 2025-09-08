from typing import Optional

from pydantic import BaseModel

from domain.user.model.user import User
from domain.user.model.user_summary import UserSummary


class UserReadModel(BaseModel):

    id: int
    email: str
    pseudo: str
    nb_win: int
    nb_lose: int
    nb_btl: float

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity(user: User) -> "UserReadModel":
        return UserReadModel(
            id=user.id,
            email=user.email.value,
            pseudo=user.pseudo,
            nb_win=user.nb_win,
            nb_lose=user.nb_lose,
            nb_btl=user.nb_btl
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
