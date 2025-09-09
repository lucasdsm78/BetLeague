from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dependency_injections import get_settings
from infrastructure.postgresql.database import create_tables
from presentation.user.user_router import router as user_router
from presentation.league.league_router import router as league_router
from presentation.match.match_router import router as match_router
from presentation.ticket.ticket_router import router as ticket_router
from presentation.tournament.tournament_router import router as tournament_router
from presentation.purchase.purchase_router import router as purchase_router
from infrastructure.postgresql.init_models import init_models

settings = get_settings()
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create database tables
    init_models()
    await create_tables()
# Add all routers

app.include_router(user_router)
app.include_router(league_router)
app.include_router(match_router)
app.include_router(ticket_router)
app.include_router(tournament_router)
app.include_router(purchase_router)
