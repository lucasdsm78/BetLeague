import asyncio

import bcrypt as _bcrypt

from domain.services.authentication.hash import Hash

ALGORITHM = "RS256"


class HashImpl(Hash):

    async def bcrypt(self, password: str) -> str:
        hashed = await asyncio.to_thread(
            _bcrypt.hashpw, password.encode("utf-8"), _bcrypt.gensalt(rounds=12)
        )
        return hashed.decode("utf-8")

    async def verify(self, plain_password: str, hashed_password: str) -> bool:
        return await asyncio.to_thread(
            _bcrypt.checkpw, plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
