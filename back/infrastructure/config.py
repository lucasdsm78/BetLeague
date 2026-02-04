from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    sqlalchemy_database_url: str
    environment: str = "dev"  # dev|prod
    sqlalchemy_echo: bool = False
    json_logs: bool = False
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")
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
    rabbitmq_url: str
    stripe_api_key: str
    stripe_webhook_secret: str
    the_odds_api_api_key: str

    class Config:
        env_file = ".env"
