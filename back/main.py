from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
import logging
from contextlib import asynccontextmanager

from dependency_injections import get_settings, token_blacklist_singleton
from infrastructure.logging_config import setup_logging
from infrastructure.services.authentication.token_blacklist_impl import shutdown_token_blacklist_service, start_token_blacklist_service

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

    blacklist_service = token_blacklist_singleton()
    await start_token_blacklist_service(blacklist_service)

    yield

    await shutdown_token_blacklist_service(blacklist_service)


app = FastAPI(lifespan=lifespan)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")

        if getattr(settings, "environment", "dev") == "prod":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")

        return response


trusted_hosts = getattr(settings, "trusted_hosts_list", [])
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

app.add_middleware(SecurityHeadersMiddleware)

# Configure CORS avec options complètes pour la sécurité
app.add_middleware(
    CORSMiddleware,
    allow_origins=getattr(settings, "cors_allowed_origins_list", []),
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
        "Cache-Control",
        "Pragma",
        "X-CSRF-Token",
    ],
    expose_headers=["Content-Type", "Cache-Control", "Retry-After", "X-Request-Id"],
    max_age=3600,  # Cache preflight for 1 hour
)

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "BetLeague API is running"}

# CORS preflight est géré directement par CORSMiddleware.

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
