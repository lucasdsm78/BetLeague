from fastapi import HTTPException, status
from pydantic import BaseModel

from domain.services.authentication.manager_token import ManagerToken


class AuthenticationToken(BaseModel):
    manager_token: ManagerToken
    token: str

    class Config:
        arbitrary_types_allowed = True

    def authentication(self) -> str:
        not_valid = self.manager_token.decode_token_login(
            self.token) is None

        if not_valid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authenticated"
            )
        return self.token
