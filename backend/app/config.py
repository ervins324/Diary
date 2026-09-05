from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings, loaded from environment variables or .env file.
    """
    DATABASE_URL: str = "postgresql+asyncpg://diary:diary_secret@db:5432/diary"
    SEMESTER_ANCHOR_DATE: str = "2026-09-01"
    GEMINI_API_KEY: str = ""
    CORS_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
