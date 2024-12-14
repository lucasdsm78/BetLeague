from pydantic import BaseModel

from domain.user.model.user import User


class UserReadModel(BaseModel):

    id: int
    email: str
    first_name: str
    last_name: str
    uuid: str
    pseudo: str
    createdAt: int
    updatedAt: int

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    def from_entity(user: User) -> "UserReadModel":
        return UserReadModel(
            id=user.id,
            uuid=user.uuid,
            email=user.email.value,
            createdAt=user.created_at,
            updatedAt=user.updated_at,
            first_name=user.first_name,
            last_name=user.last_name,
            pseudo=user.pseudo,
        )
