from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _get_database_url() -> str:
    """
    Get database URL from environment or construct from settings.
    Supports both SQLite (development) and PostgreSQL (production).
    """
    # First priority: explicit DATABASE_URL or OCEANET_DATABASE_URL
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")
    
    if os.getenv("OCEANET_DATABASE_URL"):
        return os.getenv("OCEANET_DATABASE_URL")
    
    # Check database type
    db_type = os.getenv("OCEANET_DB_TYPE", "sqlite").lower()
    
    if db_type == "postgres":
        # PostgreSQL configuration
        host = os.getenv("OCEANET_DB_HOST", "localhost")
        port = os.getenv("OCEANET_DB_PORT", "5432")
        user = os.getenv("OCEANET_DB_USER", "oceanet")
        password = os.getenv("OCEANET_DB_PASSWORD", "")
        database = os.getenv("OCEANET_DB_NAME", "oceanet_prod")
        
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
    
    # Default to SQLite
    data_root = os.path.abspath(
        os.getenv(
            "OCEANET_DATA_ROOT",
            os.path.join(os.path.dirname(__file__), "..", "..", "data")
        )
    )
    return f"sqlite:///{os.path.join(data_root, 'oceanet.db')}"


# Set database URL in config
config.set_main_option("sqlalchemy.url", _get_database_url())
target_metadata = None


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

