"""
Database Configuration & Connection Management
- Supports SQLite (dev) and PostgreSQL (prod)
- Connection pooling with pre-ping for reliability
- Migration management
"""

import os
from sqlalchemy import create_engine, event, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool

from .config import settings


def get_database_url() -> str:
    """
    Get database URL from environment or use default SQLite.
    
    PostgreSQL URL format:
        postgresql+psycopg2://user:password@localhost:5432/oceanet_prod
    
    SQLite URL format (dev only):
        sqlite:///data/oceanet.db
    """
    env_url = os.getenv("OCEANET_DATABASE_URL", "").strip()
    if env_url:
        return env_url
    
    # Check if using PostgreSQL
    db_type = os.getenv("OCEANET_DB_TYPE", "sqlite").lower()
    if db_type == "postgres":
        host = os.getenv("OCEANET_DB_HOST", "localhost")
        port = os.getenv("OCEANET_DB_PORT", "5432")
        user = os.getenv("OCEANET_DB_USER", "oceanet")
        password = os.getenv("OCEANET_DB_PASSWORD", "")
        database = os.getenv("OCEANET_DB_NAME", "oceanet_prod")
        
        if not password:
            raise ValueError("OCEANET_DB_PASSWORD not set for PostgreSQL connection")
        
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}"
    
    # Default to SQLite
    db_path = os.path.join(settings.data_root, "oceanet.db")
    return f"sqlite:///{db_path}"


def create_db_engine():
    """
    Create SQLAlchemy engine with pooling configuration.
    """
    database_url = get_database_url()
    is_sqlite = database_url.startswith("sqlite")
    
    if is_sqlite:
        # SQLite doesn't support connection pooling
        engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            poolclass=NullPool,
        )
    else:
        # PostgreSQL with connection pooling
        engine = create_engine(
            database_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,  # Test connections before using
            pool_recycle=3600,   # Recycle connections every hour
            echo=os.getenv("OCEANET_SQL_ECHO", "0").lower() in {"1", "true"},
        )
    
    # Set WAL mode for SQLite (better concurrency)
    if is_sqlite:
        @event.listens_for(Engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()
    
    return engine


# Create engine and session factory
engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """
    Dependency for getting database session in routes.
    
    Usage:
        @router.get("/data")
        async def get_data(db: Session = Depends(get_db)):
            # Use db session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    """Create all tables from declarative base."""
    # Import here to avoid circular imports
    from app.models import Base
    Base.metadata.create_all(bind=engine)
