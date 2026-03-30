"""
Strategy model.

Tracks strategy LIFECYCLE only.
The actual strategy code lives in FT: /opt/freqtrade/user_data/strategies/*.py
The actual strategy config lives in FT: config.json

We track: which lifecycle stage is this strategy in?
DRAFT → BACKTEST → AI_TESTED → DEPLOYABLE → RETIRED

Code and builder_state are moved to strategy_versions table.
"""
import enum

from sqlalchemy import Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class StrategyLifecycle(str, enum.Enum):
    """Strategy lifecycle stages."""
    DRAFT = "draft"          # Code being written/edited in Builder
    BACKTEST = "backtest"    # Has at least one completed backtest
    AI_TESTED = "ai_tested"  # AI analysis completed (optional step)
    DEPLOYABLE = "deployable"  # Approved for deployment to bots
    RETIRED = "retired"      # Archived, bots continue but no new deployments


class Strategy(Base, TimestampMixin):
    """
    Strategy lifecycle metadata.
    Does NOT contain strategy code or config — that's in strategy_versions.
    """
    __tablename__ = "strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Must match FT strategy class name exactly
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)

    # Lifecycle state
    lifecycle: Mapped[StrategyLifecycle] = mapped_column(
        Enum(StrategyLifecycle, native_enum=False), default=StrategyLifecycle.DRAFT, nullable=False
    )

    # Pointer to current version (the latest approved version to deploy)
    current_version_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("strategy_versions.id"), nullable=True
    )

    # Human-readable description
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # DEPRECATED: code moved to strategy_versions
    # Kept for backward compat, will be removed in future migration
    code: Mapped[str | None] = mapped_column(Text, nullable=True)

    # DEPRECATED: builder_state moved to strategy_versions
    # Kept for backward compat, will be removed in future migration
    builder_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # DEPRECATED: exchange moved to bot_instances
    exchange: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # DEPRECATED: timeframe is per-bot now
    timeframe: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # DEPRECATED: bot_instance_id moved to bot_instances.strategy_version_id
    bot_instance_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("bot_instances.id"), nullable=True
    )

    # Soft delete (never hard delete)
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False)
