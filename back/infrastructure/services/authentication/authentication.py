import logging

from fastapi import HTTPException, status
from pydantic import BaseModel

from domain.services.authentication.manager_token import ManagerToken


logger = logging.getLogger(__name__)

class AuthenticationToken(BaseModel):
    manager_token: ManagerToken
    token: str

    class Config:
        arbitrary_types_allowed = True

    async def authentication(self) -> str:
        decoded = await self.manager_token.decode_token_login(self.token)
        if decoded is None:
            logger.warning("auth.authentication.rejected", extra={"reason": "decode_failed"})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authenticated"
            )
        logger.info("auth.authentication.succeeded", extra={"user_id": decoded.get("id"), "token_type": decoded.get("type")})
        return self.token
