"""
CivicConnect AI - Database Connection & Engine Configuration.

Supports production PostgreSQL (via DATABASE_URL with connection pooling)
and falls back cleanly to local SQLite for offline development and testing.
"""

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent

# Read connection string from environment
raw_database_url = os.environ.get("DATABASE_URL")

if raw_database_url and raw_database_url.strip():
    DATABASE_URL = raw_database_url.strip()

    # Standardize postgres dialect for SQLAlchemy 2.0+
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )
else:
    # Local SQLite persistent storage
    db_path = BASE_DIR / "civicconnect.db"
    DATABASE_URL = f"sqlite:///{db_path}"

    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy relational models."""
    pass


def get_db():
    """Yield a database session to API dependencies, then safely close."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

