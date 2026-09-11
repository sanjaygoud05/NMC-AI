"""
Application configuration
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # API Settings
    API_TITLE: str = "SIH26099 Material Harmonization API"
    API_VERSION: str = "0.1.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Database Settings (placeholder for future)
    DATABASE_URL: str = "postgresql://user:password@localhost/sih26099"

    # Supabase Settings (placeholder for future)
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # AI/ML Settings (placeholder for future)
    GEMINI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Data Settings
    DATA_DIR: str = "data"
    RAW_DATA_PATH: str = "data/raw/CPSE_Material_Master_cleaned.csv"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
