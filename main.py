from fastapi import FastAPI

from dependency_injections import get_settings
from infrastructure.postgresql import database
from infrastructure.postgresql.database import engine
from presentation.user.user_router import router as user_router

settings = get_settings()
app = FastAPI()

# Add all routers

app.include_router(user_router)

database.Base.metadata.create_all(engine)
