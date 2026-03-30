"""
ExperimentRun model — individual run within an experiment.

Each run is one of: backtest, hyperopt, ai_pre, ai_post, oos_validation, freqai.
Runs link to existing tables (backtest_results, strategy_versions, ai_hyperopt_analyses)
and also store denormalized quick metrics for fast table display.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ExperimentRun(Base):
    """
    A single run (backtest, hyperopt, AI analysis, etc.) within an experiment.

    Stores links to existing detail tables plus denormalized metrics
    for fast display in the Experiments page table.
    """
    __tablename__ = "experiment_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Parent experiment
    experiment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("experiments.id"), nullable=False
    )

    # For hierarchical grouping (e.g. re-backtest under a hyperopt run)
    parent_run_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("experiment_runs.id"), nullable=True
    )

    # Run classification
    run_type: Mapped[str] = mapped_column(
        String(20), nullable=False  # backtest, hyperopt, ai_pre, ai_post, oos_validation, freqai
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="running"  # running, completed, failed
    )

    # ── Links to existing tables ──
    backtest_result_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("backtest_results.id"), nullable=True
    )
    strategy_version_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("strategy_versions.id"), nullable=True
    )
    ai_analysis_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ai_hyperopt_analyses.id"), nullable=True
    )

    # ── Hyperopt-specific metadata ──
    sampler: Mapped[str | None] = mapped_column(String(50), nullable=True)
    loss_function: Mapped[str | None] = mapped_column(String(100), nullable=True)
    epochs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    spaces: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["buy", "sell", "roi", "stoploss"]
    hyperopt_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Quick metrics (denormalized for fast display) ──
    total_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    win_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    profit_abs: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    profit_pct: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    max_drawdown: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    sharpe_ratio: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    sortino_ratio: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    calmar_ratio: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    avg_duration: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Output ──
    raw_output: Mapped[str | None] = mapped_column(Text, nullable=True)  # last 8000 chars of CLI output
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    experiment: Mapped["Experiment"] = relationship(
        "Experiment", back_populates="runs"
    )
