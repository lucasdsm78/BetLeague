from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    sqlalchemy_database_url: str
    access_token_expire_minutes: int
    refresh_token_expire_minutes: int
    secret_key_token: str
    secret_key_token_refresh: str

    class Config:
        env_file = ".env"
