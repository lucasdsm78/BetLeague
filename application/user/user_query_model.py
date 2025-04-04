from pydantic import BaseModel

from domain.user.model.user import User


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
