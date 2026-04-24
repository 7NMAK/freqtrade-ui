"""
Alembic migration environment.
Uses sync mode with psycopg for better compatibility.
"""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import create_engine

# Import all models so Alembic can see them
from src.models.base import Base
from src.models.bot_instance import BotInstance
from src.models.strategy import Strategy
from src.models.strategy_version import StrategyVersion
from src.models.exchange_profile import ExchangeProfile
from src.models.backtest_result import BacktestResult
from src.models.risk_event import RiskEvent
from src.models.audit_log import AuditLog
from src.models.experiment import Experiment
from src.models.experiment_run import ExperimentRun
from src.models.test_job import TestJob
from src.models.orch_settings import OrchSettings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from env var if available (Docker container uses this)
db_url = os.environ.get("ORCH_DATABASE_URL")
if db_url:
    # Use psycopg (v3) driver instead of asyncpg for Alembic
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
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
    """Run migrations in 'online' mode (sync)."""
    url = config.get_main_option("sqlalchemy.url")
    connectable = create_engine(url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
