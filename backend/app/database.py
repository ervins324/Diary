from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

# Create the async engine
engine = create_async_engine(settings.DATABASE_URL, echo=False)

# Session factory for creating new AsyncSessions
async_sessionmaker_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Declarative base for models
Base = declarative_base()

async def get_db() -> AsyncSession: # type: ignore
    """
    Dependency to yield an async database session.
    """
    async with async_sessionmaker_factory() as session:
        yield session
