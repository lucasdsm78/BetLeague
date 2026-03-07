from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    sqlalchemy_database_url: str
    environment: str = "dev"  # dev|prod
    sqlalchemy_echo: bool = False
    json_logs: bool = False
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
    api_sports_league_ids: str = Field(default="39,61,78,135,140", validation_alias="API_SPORTS_LEAGUE_IDS")  # Top 5 European leagues
    celery_broker_url: str = Field(default="redis://localhost:6379/1", validation_alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://localhost:6379/2", validation_alias="CELERY_RESULT_BACKEND")
    password_reset_challenge_ttl_s: int = Field(default=600, validation_alias="PASSWORD_RESET_CHALLENGE_TTL_S")
    password_reset_token_ttl_s: int = Field(default=600, validation_alias="PASSWORD_RESET_TOKEN_TTL_S")
    password_reset_rate_limit_per_minute: int = Field(default=5, validation_alias="PASSWORD_RESET_RATE_LIMIT_PER_MINUTE")
    password_reset_log_notifier_enabled: bool = Field(default=False, validation_alias="PASSWORD_RESET_LOG_NOTIFIER_ENABLED")

    class Config:
        env_file = ".env"
