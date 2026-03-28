"""
Bot Instance model.

Maps a FreqTrade bot container to orchestrator metadata.
Each bot = 1 FT Docker container = 1 strategy.

Trade data is NOT here. Read from FT API:
- GET /api/v1/status (open trades)
- GET /api/v1/trades (trade history)
- GET /api/v1/profit (profit stats)
- GET /api/v1/balance (account balance)
"""
import enum

from sqlalchemy import Boolean, Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class BotStatus(str, enum.Enum):
    """Bot container status."""
    STARTING = "starting"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    KILLED = "killed"  # killed by kill switch


class BotInstance(Base, TimestampMixin):
    """
    One row per FT bot container.
    This is orchestrator metadata only — NOT trade data.
    """
    __tablename__ = "bot_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Container info
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    container_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    docker_image: Mapped[str] = mapped_column(String(200), default="freqtradeorg/freqtrade:stable_freqai")

    # FT API connection (how orchestrator talks to this bot)
    api_url: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g. http://127.0.0.1:8080
    api_username: Mapped[str] = mapped_column(String(100), nullable=False)
    api_password: Mapped[str] = mapped_column(String(100), nullable=False)

    # Strategy info (metadata only — FT has the actual .py file)
    strategy_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # State
    status: Mapped[BotStatus] = mapped_column(
        Enum(BotStatus, native_enum=False), default=BotStatus.STOPPED, nullable=False
    )
    is_dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    api_port: Mapped[int] = mapped_column(Integer, nullable=False)

    # Heartbeat tracking
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Soft delete (never hard delete — safety rule #7)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Notes
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
