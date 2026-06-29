from functools import lru_cache

from typing import Literal

from pydantic import AliasChoices, Field, model_validator
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
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    gemini_api_key: str
    gemini_model: str = "gemini-3.1-flash-lite"
    grading_confidence_threshold: float = Field(default=0.72, ge=0, le=1)

    langsmith_tracing: bool
    langsmith_api_key: str = Field(min_length=1)
    langsmith_project: str = Field(min_length=1)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def require_langsmith_tracing(self) -> "Settings":
        if not self.langsmith_tracing:
            raise ValueError("LANGSMITH_TRACING must be true because LangSmith tracing is required")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true when COOKIE_SAMESITE=none")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
