from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from urllib.parse import urlsplit


DEFAULT_API_SPORTS_LEAGUE_IDS = "39,61,78,135,140"


def strip_optional_wrapping_quotes(value: str) -> str:
    normalized = value.strip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {'"', "'"}:
        return normalized[1:-1]
    return normalized


def normalize_escaped_newlines(value: str) -> str:
    normalized = strip_optional_wrapping_quotes(value)
    return normalized.replace("\\r\\n", "\\n").replace("\\n", "\n")


class DatabaseSettings(BaseSettings):
    sqlalchemy_database_url: str
    alembic_database_url: str | None = Field(default=None, validation_alias="ALEMBIC_DATABASE_URL")
    environment: str = "dev"
    sqlalchemy_echo: bool = False
    sqlalchemy_pool_size: int = Field(default=5, validation_alias="SQLALCHEMY_POOL_SIZE")
    sqlalchemy_max_overflow: int = Field(default=10, validation_alias="SQLALCHEMY_MAX_OVERFLOW")
    sqlalchemy_pool_recycle_seconds: int = Field(default=300, validation_alias="SQLALCHEMY_POOL_RECYCLE")
    sqlalchemy_pool_timeout_seconds: int = Field(default=30, validation_alias="SQLALCHEMY_POOL_TIMEOUT")
    sqlalchemy_command_timeout_seconds: int = Field(default=30, validation_alias="SQLALCHEMY_COMMAND_TIMEOUT")
    sqlalchemy_ssl_mode: str = Field(default="", validation_alias="SQLALCHEMY_SSL_MODE")
    sqlalchemy_ssl_root_cert_path: str = Field(default="", validation_alias="SQLALCHEMY_SSL_ROOT_CERT_PATH")
    sqlalchemy_ssl_root_cert: str = Field(default="", validation_alias="SQLALCHEMY_SSL_ROOT_CERT")
    sqlalchemy_disable_jit: bool = Field(default=True, validation_alias="SQLALCHEMY_DISABLE_JIT")
    sqlalchemy_application_name: str = Field(default="betleague-api", validation_alias="SQLALCHEMY_APPLICATION_NAME")

    @property
    def sqlalchemy_ssl_mode_value(self) -> str:
        value = (self.sqlalchemy_ssl_mode or "").strip().lower()
        if value:
            return value
        return "verify-full" if self.environment == "prod" else "disable"

    @field_validator("sqlalchemy_database_url", "alembic_database_url", mode="before")
    @classmethod
    def normalize_database_url_env(cls, value: str | None) -> str | None:
        if not isinstance(value, str):
            return value
        return strip_optional_wrapping_quotes(value)

    @field_validator("sqlalchemy_ssl_root_cert", mode="before")
    @classmethod
    def normalize_sqlalchemy_ssl_root_cert(cls, value: str | None) -> str | None:
        if not isinstance(value, str):
            return value
        return normalize_escaped_newlines(value)

    class Config:
        env_file = ".env"
        extra = "ignore"
        populate_by_name = True


class Settings(BaseSettings):
    sqlalchemy_database_url: str
    alembic_database_url: str | None = Field(default=None, validation_alias="ALEMBIC_DATABASE_URL")
    environment: str = "dev"  # dev|prod
    sqlalchemy_echo: bool = False
    sqlalchemy_pool_size: int = Field(default=5, validation_alias="SQLALCHEMY_POOL_SIZE")
    sqlalchemy_max_overflow: int = Field(default=10, validation_alias="SQLALCHEMY_MAX_OVERFLOW")
    sqlalchemy_pool_recycle_seconds: int = Field(default=300, validation_alias="SQLALCHEMY_POOL_RECYCLE")
    sqlalchemy_pool_timeout_seconds: int = Field(default=30, validation_alias="SQLALCHEMY_POOL_TIMEOUT")
    sqlalchemy_command_timeout_seconds: int = Field(default=30, validation_alias="SQLALCHEMY_COMMAND_TIMEOUT")
    sqlalchemy_ssl_mode: str = Field(default="", validation_alias="SQLALCHEMY_SSL_MODE")
    sqlalchemy_ssl_root_cert_path: str = Field(default="", validation_alias="SQLALCHEMY_SSL_ROOT_CERT_PATH")
    sqlalchemy_ssl_root_cert: str = Field(default="", validation_alias="SQLALCHEMY_SSL_ROOT_CERT")
    sqlalchemy_disable_jit: bool = Field(default=True, validation_alias="SQLALCHEMY_DISABLE_JIT")
    sqlalchemy_application_name: str = Field(default="betleague-api", validation_alias="SQLALCHEMY_APPLICATION_NAME")
    json_logs: bool | None = Field(default=None, validation_alias="JSON_LOGS")
    queue_logs_enabled: bool | None = Field(default=None, validation_alias="QUEUE_LOGGING_ENABLED")
    http_request_logging_enabled: bool = Field(default=True, validation_alias="HTTP_REQUEST_LOGGING_ENABLED")
    http_request_logging_excluded_paths: str = Field(default="/health,/metrics", validation_alias="HTTP_REQUEST_LOGGING_EXCLUDED_PATHS")
    http_slow_request_threshold_ms: int = Field(default=1000, validation_alias="HTTP_SLOW_REQUEST_THRESHOLD_MS")
    internal_trusted_hosts: str = Field(default="backend,backend:8000,localhost,127.0.0.1", validation_alias="INTERNAL_TRUSTED_HOSTS")
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")
    redis_socket_connect_timeout_s: int = Field(default=2, validation_alias="REDIS_SOCKET_CONNECT_TIMEOUT_S")
    redis_socket_timeout_s: int = Field(default=2, validation_alias="REDIS_SOCKET_TIMEOUT_S")
    redis_health_check_interval_s: int = Field(default=30, validation_alias="REDIS_HEALTH_CHECK_INTERVAL_S")
    notifications_realtime_driver: str = Field(default="memory", validation_alias="NOTIFICATIONS_REALTIME_DRIVER")  # memory|redis
    notifications_redis_channel_prefix: str = "betleague:notifications:user:"
    sse_max_connections_per_user: int = 2
    sse_rate_limit_per_minute: int = 30  # nouvelles connexions SSE / minute / (ip,user)
    sse_idle_timeout_seconds: int = 60 * 15  # coupe un stream après N secondes (reconnect côté client)
    sse_heartbeat_seconds: int = 20
    access_token_expire_minutes: int
    refresh_token_expire_minutes: int
    secret_key_token: str
    secret_key_token_refresh: str
    encryption_key: str
    api_football_data_token: str
    url_api_football_data: str
    private_key: str
    public_key: str
    rabbitmq_url: str = Field(default="", validation_alias="RABBITMQ_URL")
    stripe_api_key: str
    stripe_webhook_secret: str
    app_frontend_url: str = Field(default="http://localhost:3000", validation_alias="APP_FRONTEND_URL")
    cors_allowed_origins: str = Field(default="", validation_alias="CORS_ALLOWED_ORIGINS")
    trusted_hosts: str = Field(default="localhost,127.0.0.1", validation_alias="TRUSTED_HOSTS")
    trusted_proxy_ips: str = Field(default="", validation_alias="TRUSTED_PROXY_IPS")
    shop_enabled: bool = Field(default=False, validation_alias="SHOP_ENABLED")
    btl_purchase_enabled: bool = Field(default=False, validation_alias="BTL_PURCHASE_ENABLED")
    tournament_subscription_enabled: bool = Field(default=False, validation_alias="TOURNAMENT_SUBSCRIPTION_ENABLED")
    the_odds_api_api_key: str
    vapid_private_key: str = Field(default="", validation_alias="VAPID_PRIVATE_KEY")
    vapid_public_key: str = Field(default="", validation_alias="VAPID_PUBLIC_KEY")
    vapid_claims_email: str = Field(default="contact@betleague.app", validation_alias="VAPID_CLAIMS_EMAIL")
    vapid_ttl: int = Field(default=86400, validation_alias="VAPID_TTL")
    api_sports_key: str = Field(default="", validation_alias="API_SPORTS_KEY")
    api_sports_football_url: str = Field(default="https://v3.football.api-sports.io", validation_alias="API_SPORTS_FOOTBALL_URL")
    api_sports_basketball_url: str = Field(default="https://v1.basketball.api-sports.io", validation_alias="API_SPORTS_BASKETBALL_URL")
    api_sports_rugby_url: str = Field(default="https://v1.rugby.api-sports.io", validation_alias="API_SPORTS_RUGBY_URL")
    api_sports_hockey_url: str = Field(default="https://v1.hockey.api-sports.io", validation_alias="API_SPORTS_HOCKEY_URL")
    api_sports_baseball_url: str = Field(default="https://v1.baseball.api-sports.io", validation_alias="API_SPORTS_BASEBALL_URL")
    api_sports_league_ids: str = Field(default=DEFAULT_API_SPORTS_LEAGUE_IDS, validation_alias="API_SPORTS_LEAGUE_IDS")  # Top 5 European leagues
    api_sports_fetch_odds_days_ahead: int = Field(default=0, validation_alias="API_SPORTS_FETCH_ODDS_DAYS_AHEAD")
    api_sports_fetch_odds_max_fixtures_per_run: int = Field(default=30, validation_alias="API_SPORTS_FETCH_ODDS_MAX_FIXTURES_PER_RUN")
    api_sports_score_by_id_fallback_enabled: bool = Field(default=False, validation_alias="API_SPORTS_SCORE_BY_ID_FALLBACK_ENABLED")
    api_sports_score_by_id_fallback_max_fixtures: int = Field(default=2, validation_alias="API_SPORTS_SCORE_BY_ID_FALLBACK_MAX_FIXTURES")
    celery_broker_url: str = Field(default="redis://localhost:6379/1", validation_alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://localhost:6379/2", validation_alias="CELERY_RESULT_BACKEND")
    celery_metrics_queues: str = Field(default="celery", validation_alias="CELERY_METRICS_QUEUES")
    celery_metrics_enabled: bool = Field(default=True, validation_alias="CELERY_METRICS_ENABLED")
    celery_metrics_scrape_interval_s: int = Field(default=15, validation_alias="CELERY_METRICS_SCRAPE_INTERVAL_S")
    celery_metrics_redis_timeout_s: float = Field(default=0.5, validation_alias="CELERY_METRICS_REDIS_TIMEOUT_S")
    league_payout_metrics_enabled: bool = Field(default=True, validation_alias="LEAGUE_PAYOUT_METRICS_ENABLED")
    league_payout_metrics_scrape_interval_s: int = Field(default=30, validation_alias="LEAGUE_PAYOUT_METRICS_SCRAPE_INTERVAL_S")
    league_payout_overdue_threshold_minutes: int = Field(default=15, validation_alias="LEAGUE_PAYOUT_OVERDUE_THRESHOLD_MINUTES")
    password_reset_challenge_ttl_s: int = Field(default=600, validation_alias="PASSWORD_RESET_CHALLENGE_TTL_S")
    password_reset_token_ttl_s: int = Field(default=600, validation_alias="PASSWORD_RESET_TOKEN_TTL_S")
    password_reset_rate_limit_per_minute: int = Field(default=5, validation_alias="PASSWORD_RESET_RATE_LIMIT_PER_MINUTE")
    password_reset_log_notifier_enabled: bool = Field(default=False, validation_alias="PASSWORD_RESET_LOG_NOTIFIER_ENABLED")
    delete_account_rate_limit_per_minute: int = Field(default=3, validation_alias="DELETE_ACCOUNT_RATE_LIMIT_PER_MINUTE")
    delete_account_rate_limit_window_s: int = Field(default=60, validation_alias="DELETE_ACCOUNT_RATE_LIMIT_WINDOW_S")
    change_password_rate_limit_per_minute: int = Field(default=5, validation_alias="CHANGE_PASSWORD_RATE_LIMIT_PER_MINUTE")
    change_password_rate_limit_window_s: int = Field(default=60, validation_alias="CHANGE_PASSWORD_RATE_LIMIT_WINDOW_S")
    two_factor_verify_rate_limit_per_minute: int = Field(default=5, validation_alias="TWO_FACTOR_VERIFY_RATE_LIMIT_PER_MINUTE")
    two_factor_verify_rate_limit_window_s: int = Field(default=60, validation_alias="TWO_FACTOR_VERIFY_RATE_LIMIT_WINDOW_S")
    disable_2fa_rate_limit_per_minute: int = Field(default=5, validation_alias="DISABLE_2FA_RATE_LIMIT_PER_MINUTE")
    disable_2fa_rate_limit_window_s: int = Field(default=60, validation_alias="DISABLE_2FA_RATE_LIMIT_WINDOW_S")
    login_rate_limit_per_minute: int = Field(default=10, validation_alias="LOGIN_RATE_LIMIT_PER_MINUTE")
    login_rate_limit_window_s: int = Field(default=60, validation_alias="LOGIN_RATE_LIMIT_WINDOW_S")
    login_2fa_rate_limit_per_minute: int = Field(default=5, validation_alias="LOGIN_2FA_RATE_LIMIT_PER_MINUTE")
    login_2fa_rate_limit_window_s: int = Field(default=60, validation_alias="LOGIN_2FA_RATE_LIMIT_WINDOW_S")
    tournament_mutation_rate_limit_per_minute: int = Field(default=20, validation_alias="TOURNAMENT_MUTATION_RATE_LIMIT_PER_MINUTE")
    tournament_mutation_rate_limit_window_s: int = Field(default=60, validation_alias="TOURNAMENT_MUTATION_RATE_LIMIT_WINDOW_S")
    auth_redis_fail_closed: bool = Field(default=True, validation_alias="AUTH_REDIS_FAIL_CLOSED")
    auth_tokens_invalid_before_ttl_s: int = Field(default=60 * 60 * 24 * 90, validation_alias="AUTH_TOKENS_INVALID_BEFORE_TTL_S")
    auth_blacklisted_jti_ttl_grace_s: int = Field(default=60, validation_alias="AUTH_BLACKLISTED_JTI_TTL_GRACE_S")
    scheduler_internal_token: str = Field(default="", validation_alias="SCHEDULER_INTERNAL_TOKEN")
    scheduler_admin_emails: str = Field(default="", validation_alias="SCHEDULER_ADMIN_EMAILS")
    auth_refresh_cookie_name: str = Field(default="betleague_refresh_token", validation_alias="AUTH_REFRESH_COOKIE_NAME")
    auth_refresh_cookie_domain: str = Field(default="", validation_alias="AUTH_REFRESH_COOKIE_DOMAIN")
    auth_refresh_cookie_path: str = Field(default="/api/auth", validation_alias="AUTH_REFRESH_COOKIE_PATH")
    auth_refresh_cookie_samesite: str = Field(default="lax", validation_alias="AUTH_REFRESH_COOKIE_SAMESITE")
    auth_refresh_cookie_secure: bool | None = Field(default=None, validation_alias="AUTH_REFRESH_COOKIE_SECURE")

    @field_validator("sqlalchemy_database_url", "alembic_database_url", mode="before")
    @classmethod
    def normalize_database_url_env(cls, value: str | None) -> str | None:
        if not isinstance(value, str):
            return value
        return strip_optional_wrapping_quotes(value)

    @field_validator("private_key", "public_key", "sqlalchemy_ssl_root_cert", mode="before")
    @classmethod
    def normalize_multiline_secret_env(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return normalize_escaped_newlines(value)

    @field_validator("api_sports_league_ids", mode="before")
    @classmethod
    def normalize_api_sports_league_ids(cls, value: str | None) -> str:
        if value is None:
            return DEFAULT_API_SPORTS_LEAGUE_IDS
        if not isinstance(value, str):
            return value
        normalized = strip_optional_wrapping_quotes(value)
        if not normalized.strip():
            return DEFAULT_API_SPORTS_LEAGUE_IDS
        return normalized

    @staticmethod
    def _split_csv(raw: str) -> list[str]:
        return [item.strip() for item in (raw or "").split(",") if item.strip()]

    @property
    def app_frontend_origin(self) -> str:
        parsed = urlsplit(self.app_frontend_url)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
        return self.app_frontend_url.rstrip("/")

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        origins = self._split_csv(self.cors_allowed_origins)
        frontend_origin = self.app_frontend_origin
        if frontend_origin:
            origins.insert(0, frontend_origin)

        if self.environment != "prod":
            origins.extend([
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:3001",
            ])

        unique: list[str] = []
        for origin in origins:
            if origin not in unique:
                unique.append(origin)
        return unique

    @property
    def api_sports_league_ids_set(self) -> frozenset[int]:
        return frozenset(int(item) for item in self._split_csv(self.api_sports_league_ids))

    @property
    def trusted_hosts_list(self) -> list[str]:
        hosts = self._split_csv(self.trusted_hosts)
        for host in self._split_csv(self.internal_trusted_hosts):
            if host not in hosts:
                hosts.append(host)
        if self.environment != "prod":
            for host in ["localhost", "127.0.0.1"]:
                if host not in hosts:
                    hosts.append(host)
        return hosts

    @property
    def trusted_proxy_ips_list(self) -> list[str]:
        return self._split_csv(self.trusted_proxy_ips)

    @property
    def http_request_logging_excluded_paths_list(self) -> list[str]:
        return self._split_csv(self.http_request_logging_excluded_paths)

    @property
    def celery_metrics_queues_list(self) -> list[str]:
        return self._split_csv(self.celery_metrics_queues)

    @property
    def auth_refresh_cookie_secure_value(self) -> bool:
        if self.auth_refresh_cookie_secure is not None:
            return bool(self.auth_refresh_cookie_secure)
        return self.environment == "prod"

    @property
    def auth_refresh_cookie_samesite_value(self) -> str:
        value = (self.auth_refresh_cookie_samesite or "lax").strip().lower()
        if value not in {"lax", "strict", "none"}:
            return "lax"
        return value

    @property
    def sqlalchemy_ssl_mode_value(self) -> str:
        value = (self.sqlalchemy_ssl_mode or "").strip().lower()
        if value:
            return value
        return "verify-full" if self.environment == "prod" else "disable"

    @property
    def queue_logs_enabled_value(self) -> bool:
        if self.queue_logs_enabled is not None:
            return bool(self.queue_logs_enabled)
        return self.environment == "prod"

    @property
    def fastapi_docs_enabled(self) -> bool:
        return self.environment != "prod"

    @property
    def fastapi_docs_urls(self) -> dict[str, str | None]:
        if not self.fastapi_docs_enabled:
            return {
                "docs_url": None,
                "redoc_url": None,
                "openapi_url": None,
            }
        return {
            "docs_url": "/docs",
            "redoc_url": "/redoc",
            "openapi_url": "/openapi.json",
        }

    class Config:
        env_file = ".env"
        extra = "ignore"
        populate_by_name = True
