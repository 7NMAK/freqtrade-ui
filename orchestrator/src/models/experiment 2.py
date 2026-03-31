"""
Experiment model — groups related runs (backtest, hyperopt, AI) under one experiment.

An experiment ties together a strategy + pair + timerange combination.
All runs within that combination (baseline backtest, hyperopt iterations,
AI analyses, validation backtests) belong to the same experiment.
"""
from datetime import date, datetime

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Experiment(Base):
    """
    Groups related test runs for a strategy+pair+timerange.

    Auto-created when a backtest completes successfully.
    Subsequent hyperopts/AI analyses for the same combo get linked here.
    """
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Link to strategy
    strategy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strategies.id"), nullable=False
    )

    # Auto-generated name: "Strategy004 — BTC/USDT 2024-2026"
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Pair + timeframe + timerange that defines this experiment
    pair: Mapped[str] = mapped_column(String(50), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    timerange_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    timerange_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    # The first backtest that created this experiment
    baseline_backtest_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("backtest_results.id"), nullable=True
    )

    # Best performing version found so far
    best_version_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("strategy_versions.id"), nullable=True
    )

    # User notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    runs: Mapped[list["ExperimentRun"]] = relationship(
        "ExperimentRun", back_populates="experiment", lazy="selectin"
    )
