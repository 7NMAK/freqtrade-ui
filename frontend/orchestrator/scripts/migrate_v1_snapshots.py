"""
Data migration: create v1 strategy_version for each existing strategy.
Run once after applying migration 007.

Usage: python -m scripts.migrate_v1_snapshots
"""
import asyncio
from sqlalchemy import select
from src.database import async_session
from src.models.strategy import Strategy
from src.models.strategy_version import StrategyVersion


async def migrate():
    async with async_session() as db:
        result = await db.execute(select(Strategy).where(Strategy.is_deleted == False))  # noqa: E712
        strategies = result.scalars().all()

        for strat in strategies:
            # Check if v1 already exists
            existing = await db.execute(
                select(StrategyVersion).where(
                    StrategyVersion.strategy_id == strat.id,
                    StrategyVersion.version_number == 1,
                )
            )
            if existing.scalar_one_or_none():
                print(f"  Skip {strat.name}: v1 already exists")
                continue

            v1 = StrategyVersion(
                strategy_id=strat.id,
                version_number=1,
                code=strat.code or "# No code migrated",
                builder_state=strat.builder_state,
                changelog="Initial version (migrated from legacy schema)",
            )
            db.add(v1)
            await db.flush()

            # Update strategy's current_version_id
            strat.current_version_id = v1.id

            print(f"  Migrated {strat.name} -> v1 (id={v1.id})")

        await db.commit()
        print(f"Done. {len(strategies)} strategies processed.")


if __name__ == "__main__":
    asyncio.run(migrate())
