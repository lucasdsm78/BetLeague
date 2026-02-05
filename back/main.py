from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from contextlib import asynccontextmanager

from dependency_injections import get_settings
from infrastructure.logging_config import setup_logging

from presentation.user.user_router import router as user_router
from presentation.league.league_router import router as league_router
from presentation.match.match_router import router as match_router
from presentation.ticket.ticket_router import router as ticket_router
from presentation.tournament.tournament_router import router as tournament_router
from presentation.purchase.purchase_router import router as purchase_router
from presentation.notification.notification_router import router as notification_router
from presentation.realtime.notifications_stream_router import router as realtime_router
from presentation.push_subscription.push_subscription_router import router as push_router
from infrastructure.postgresql.init_models import init_models

settings = get_settings()
setup_logging(environment=getattr(settings, 'environment', 'dev'), json_logs=bool(getattr(settings, 'json_logs', False)))

logger = logging.getLogger(__name__)
_uvicorn_logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Charge les modèles SQLAlchemy (nécessaire pour Alembic autogenerate).
    init_models()

    yield


app = FastAPI(lifespan=lifespan)

# Enhanced CORS Middleware for OPTIONS requests
class CORSOptionsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Handle OPTIONS requests immediately
        if request.method == "OPTIONS":
            response = Response(
                content="OK",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Authentication",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Max-Age": "3600",
                }
            )
            return response

        # For all other requests, proceed normally
        response = await call_next(request)
        return response

# Add the custom CORS middleware BEFORE the standard CORS middleware
app.add_middleware(CORSOptionsMiddleware)

# Configure CORS avec options complètes pour la sécurité
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",  # Dev server backup
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "X-Authentication",  # Custom auth header
        "Cache-Control",
        "Pragma",
    ],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight for 1 hour
)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "BetLeague API is running"}

# CORS preflight is now handled by CORSOptionsMiddleware

# Add all routers
app.include_router(user_router)
app.include_router(league_router)
app.include_router(match_router)
app.include_router(ticket_router)
app.include_router(tournament_router)
app.include_router(purchase_router)
app.include_router(notification_router)
app.include_router(realtime_router)
app.include_router(push_router)
