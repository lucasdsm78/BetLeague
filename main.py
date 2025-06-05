from fastapi import FastAPI

from dependency_injections import get_settings
from infrastructure.postgresql import database
from infrastructure.postgresql.database import engine, create_tables
from presentation.user.user_router import router as user_router
from presentation.league.league_router import router as league_router
from presentation.match.match_router import router as match_router
from presentation.ticket.ticket_router import router as ticket_router
from presentation.tournament.tournament_router import router as tournament_router

settings = get_settings()
app = FastAPI()
@app.on_event("startup")
async def startup():
    # Create database tables
    await create_tables()
# Add all routers

app.include_router(user_router)
app.include_router(league_router)
app.include_router(match_router)
app.include_router(ticket_router)
app.include_router(tournament_router)
