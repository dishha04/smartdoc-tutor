import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

from sqlalchemy.pool import NullPool

# Default to asyncpg with postgresql
DATABASE_URL = os.getenv("POSTGRES_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/smartdoc_tutor")

engine = create_async_engine(DATABASE_URL, echo=False, poolclass=NullPool)

# Create an async session factory
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def close_db():
    await engine.dispose()
    logger.info("PostgreSQL engine disposed")
