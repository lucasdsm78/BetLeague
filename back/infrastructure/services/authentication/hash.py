from passlib.context import CryptContext

from domain.services.authentication.hash import Hash
import asyncio

ALGORITHM = "RS256"
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

class HashImpl(Hash):

    async def bcrypt(self, password: str) -> str:
        return await asyncio.to_thread(pwd_context.hash, password)

    async def verify(self, plain_password: str, hashed_password: str) -> bool:
        return await asyncio.to_thread(pwd_context.verify, plain_password, hashed_password)
