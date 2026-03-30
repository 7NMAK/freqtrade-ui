"""
Strategy Version model — immutable snapshots of strategy code and config.

Every save in Builder creates a new version.
Versions are never modified, only created and read.
Each version stores: code, builder state, risk config, callbacks.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class StrategyVersion(Base):
    """
    Immutable strategy snapshot.
    
    One version per edit cycle in Builder.
    Multiple bots can reference the same version.
    """
    __tablename__ = "strategy_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Link to parent strategy
    strategy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strategies.id"), nullable=False
    )

    # Version number (1, 2, 3... per strategy)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Immutable strategy code (.py file content)
    code: Mapped[str] = mapped_column(Text, nullable=False)

    # Full Builder snapshot for re-editing (JSON)
    builder_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Risk configuration (stoploss, roi, trailing stop, protections)
    risk_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Callbacks (which of 19 callbacks are enabled + their code)
    callbacks: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # FreqAI configuration (feature engineering, model params, etc.)
    freqai_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Human-readable changelog (what changed from previous version)
    changelog: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamp (immutable)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Unique constraint: one version_number per strategy
    __table_args__ = (
        UniqueConstraint("strategy_id", "version_number", name="uq_strategy_version"),
    )
