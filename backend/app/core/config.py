from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GradeFlow API"
    api_prefix: str = "/api/v1"
    frontend_origin: str = "http://localhost:3000"

    supabase_url: str
    supabase_secret_key: str = Field(
        validation_alias=AliasChoices(
            "SUPABASE_SECRET_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
        )
    )
    supabase_storage_bucket: str = "submissions"
    db_url: str | None = None

    jwt_secret: str = Field(min_length=24)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    cookie_secure: bool = False

    gemini_api_key: str
    gemini_model: str = "gemini-3.1-flash-lite"
    grading_confidence_threshold: float = Field(default=0.72, ge=0, le=1)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
