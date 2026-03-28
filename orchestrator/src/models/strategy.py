"""
Strategy model.

Tracks strategy LIFECYCLE only.
The actual strategy code lives in FT: /opt/freqtrade/user_data/strategies/*.py
The actual strategy config lives in FT: config.json

We only track: which lifecycle stage is this strategy in?
DRAFT → BACKTEST → PAPER → LIVE → RETIRED

PAPER → LIVE = change dry_run flag in FT config. That's it.
"""
import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class StrategyLifecycle(str, enum.Enum):
    """Strategy lifecycle stages."""
    DRAFT = "draft"          # Strategy file created, not tested
    BACKTEST = "backtest"    # Backtesting in progress or completed
    PAPER = "paper"          # Running in dry_run mode
    LIVE = "live"            # Running with real money (dry_run: false)
    RETIRED = "retired"      # No longer active


class Strategy(Base, TimestampMixin):
    """
    Strategy lifecycle metadata.
    Does NOT contain strategy code or config — that's in FT.
    """
    __tablename__ = "strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Must match FT strategy class name exactly
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)

    # Lifecycle state
    lifecycle: Mapped[StrategyLifecycle] = mapped_column(
        Enum(StrategyLifecycle, native_enum=False), default=StrategyLifecycle.DRAFT, nullable=False
    )

    # Which bot is running this strategy (if any)
    bot_instance_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bot_instances.id"), nullable=True
    )

    # Human-readable description
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Generated strategy .py code (stored so it can be deployed to FT)
    code: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Exchange and timeframe metadata
    exchange: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timeframe: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Soft delete (never hard delete)
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
