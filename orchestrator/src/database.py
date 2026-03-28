"""
Database connection for Orchestrator.

ONLY stores cross-bot metadata:
- bot_instances (container mapping, health status)
- strategies (lifecycle state — FT has the actual code)
- risk_events (kill switch activations)
- audit_log (immutable action log)

Trade data is NEVER stored here. Always read from FT API:
- GET /api/v1/trades
- GET /api/v1/profit
- GET /api/v1/balance
- GET /api/v1/status
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_size=10, max_overflow=20)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """FastAPI dependency for DB sessions."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
