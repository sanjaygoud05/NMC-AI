"""
Application configuration
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import json


class Settings(BaseSettings):
    """Application settings"""

    # API Settings
    API_TITLE: str = "SIH26099 Material Harmonization API"
    API_VERSION: str = "0.1.0"
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
