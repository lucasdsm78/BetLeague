from typing import Optional

from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.utils import get_authorization_scheme_param
from fastapi.openapi.models import APIKey, APIKeyIn
from starlette import status
from starlette.status import HTTP_403_FORBIDDEN


class JwtBearer(HTTPBearer):

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
        self.model: APIKey = APIKey(
            **{"in": APIKeyIn.header}, name="X-Authentication"
        )

    async def __call__(self, request: Request):
        r = await self.__call__with_x_authentication(request)
        if r is None:
            return None
        return r.credentials

    async def __call__with_x_authentication(
            self, request: Request
    ) -> Optional[HTTPAuthorizationCredentials]:
        authorization = request.headers.get("X-Authentication")
        scheme, credentials = get_authorization_scheme_param(authorization)
        if not (authorization and scheme and credentials):
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Not authenticated"
                )
            else:
                return None
        if scheme.lower() != "bearer":
            if self.auto_error:
                raise HTTPException(
                    status_code=HTTP_403_FORBIDDEN,
                    detail="Invalid authentication credentials",
                )
            else:
                return None
        return HTTPAuthorizationCredentials(scheme=scheme, credentials=credentials)
