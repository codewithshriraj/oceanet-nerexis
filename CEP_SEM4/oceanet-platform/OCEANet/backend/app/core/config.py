import os
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Settings:
    # Application
    app_name: str = os.getenv("OCEANET_APP_NAME", "OCEANet Backend")
    app_env: str = os.getenv("OCEANET_ENV", "development")
    log_level: str = os.getenv("OCEANET_LOG_LEVEL", "INFO")
    debug: bool = os.getenv("OCEANET_DEBUG", "0").lower() in {"1", "true"}
    
    # Data paths
    data_root: str = os.path.abspath(
        os.getenv(
            "OCEANET_DATA_ROOT",
            os.path.join(os.path.dirname(__file__), "..", "..", "data"),
        )
    )
    
    # Database configuration
    database_url: Optional[str] = os.getenv("OCEANET_DATABASE_URL")
    db_type: str = os.getenv("OCEANET_DB_TYPE", "sqlite")  # "sqlite" or "postgres"
    db_host: str = os.getenv("OCEANET_DB_HOST", "localhost")
    db_port: str = os.getenv("OCEANET_DB_PORT", "5432")
    db_user: str = os.getenv("OCEANET_DB_USER", "oceanet")
    db_password: str = os.getenv("OCEANET_DB_PASSWORD", "")
    db_name: str = os.getenv("OCEANET_DB_NAME", "oceanet_prod")
    
    # JWT Configuration
    jwt_secret: str = os.getenv("OCEANET_JWT_SECRET", "dev-secret-change-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    
    # Secrets Management
    vault_enabled: bool = os.getenv("OCEANET_VAULT_ENABLED", "0").lower() in {"1", "true"}
    vault_addr: str = os.getenv("OCEANET_VAULT_ADDR", "http://localhost:8200")
    vault_token: str = os.getenv("OCEANET_VAULT_TOKEN", "")
    
    aws_secrets_enabled: bool = os.getenv("OCEANET_AWS_SECRETS_ENABLED", "0").lower() in {"1", "true"}
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")
    
    # CORS
    cors_origins: list = None
    
    def __post_init__(self):
        if self.cors_origins is None:
            origins_str = os.getenv("OCEANET_CORS_ALLOWED_ORIGINS", "http://localhost:3000")
            object.__setattr__(self, "cors_origins", [x.strip() for x in origins_str.split(",")])
    
    @property
    def db_path(self) -> str:
        return os.path.join(self.data_root, "oceanet.db")
    
    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"prod", "production"}
    
    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"dev", "development", "local"}


settings = Settings()
