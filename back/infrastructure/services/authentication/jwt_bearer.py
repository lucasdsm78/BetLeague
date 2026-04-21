import logging
from typing import Optional

from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.utils import get_authorization_scheme_param
from fastapi.openapi.models import APIKey, APIKeyIn
from starlette import status
from starlette.status import HTTP_403_FORBIDDEN


logger = logging.getLogger(__name__)


class JwtBearer(HTTPBearer):

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
        self.model: APIKey = APIKey(
            **{"in": APIKeyIn.header}, name="Authorization"
        )

    async def __call__(self, request: Request):
        r = await self.__call__with_authentication_headers(request)
        if r is None:
            return None
        return r.credentials

    async def __call__with_authentication_headers(
            self, request: Request
    ) -> Optional[HTTPAuthorizationCredentials]:
        authorization = request.headers.get("Authorization")
        scheme, credentials = get_authorization_scheme_param(authorization)
        if not (authorization and scheme and credentials):
            logger.warning("auth.jwt_bearer.rejected", extra={"reason": "missing_authorization", "path": request.url.path, "method": request.method})
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Not authenticated"
                )
            else:
                return None
        if scheme.lower() != "bearer":
            logger.warning("auth.jwt_bearer.rejected", extra={"reason": "invalid_scheme", "scheme": scheme, "path": request.url.path, "method": request.method})
            if self.auto_error:
                raise HTTPException(
                    status_code=HTTP_403_FORBIDDEN,
                    detail="Invalid authentication credentials",
                )
            else:
                return None
        logger.debug("auth.jwt_bearer.accepted", extra={"path": request.url.path, "method": request.method})
        return HTTPAuthorizationCredentials(scheme=scheme, credentials=credentials)
