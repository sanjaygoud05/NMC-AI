"""
NMC — National Material Code Platform
Application configuration
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List, Union
import json


class Settings(BaseSettings):
    """Application settings"""

    # API Settings
    API_TITLE: str = "NMC Material Harmonization API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS Settings
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
    ]

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, str):
            val = self.ALLOWED_ORIGINS.strip()
            if val == "*":
                return ["*"]
            if val.startswith("[") and val.endswith("]"):
                try:
                    return json.loads(val)
                except Exception:
                    pass
            return [origin.strip() for origin in val.split(",") if origin.strip()]
        return self.ALLOWED_ORIGINS

    # NMC Auth — simple credential-based (no Supabase)
    ADMIN_PASSWORD: str = "nmc-admin-2026"
    REVIEWER_KEY: str = "nmc-reviewer-key"

    # Database
    # If DATABASE_URL is set in env and points to PostgreSQL, use it.
    # Otherwise fall back to a local SQLite DB.
    DATABASE_URL: str = ""

    @property
    def effective_db_url(self) -> str:
        env_url = self.DATABASE_URL
        if env_url and (env_url.startswith("postgresql") or env_url.startswith("postgres://")):
            return env_url.replace("postgres://", "postgresql://", 1)
        # SQLite fallback
        data_dir = Path(__file__).resolve().parent.parent.parent / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{data_dir / 'nmc.db'}"

    # AI/ML
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # Data Settings
    DATA_DIR: str = "data"
    UPLOADS_DIR: str = "data/uploads"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

