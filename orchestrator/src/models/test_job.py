"""
TestJob model — background test job queue.

Jobs are submitted by the frontend and executed by the JobRunner background worker.
Each job type (backtest, hyperopt, freqai_matrix) maps to one or more FT API calls.
The frontend polls for progress — closing the tab does NOT stop the job.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime, Float, ForeignKey, Integer, JSON, Numeric, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class TestJob(Base):
    """
    A queued/running/completed test job.

    Lifecycle: queued → running → completed | failed | cancelled
    The JobRunner picks up the oldest 'queued' job and processes it.
    """
    __tablename__ = "test_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Parent references ──
    experiment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("experiments.id"), nullable=False
    )
    bot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bot_instances.id"), nullable=False
    )

    # ── Job type & config ──
    job_type: Mapped[str] = mapped_column(
        String(30), nullable=False  # "backtest" | "hyperopt" | "freqai_matrix"
    )
    strategy: Mapped[str] = mapped_column(String(200), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Full FT config or matrix queue

    # ── Status tracking ──
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued"
        # "queued" | "running" | "completed" | "failed" | "cancelled"
    )
    progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # 0.0 → 1.0
    current_step: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Single-run results (backtest/hyperopt) ──
    total_trades: Mapped[int | None] = mapped_column(Integer, nullable=True)
    profit_pct: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    win_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    max_drawdown: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    sharpe_ratio: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    sortino_ratio: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    raw_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # ── Matrix results (freqai_matrix) ──
    matrix_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    matrix_completed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    matrix_results: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # ── Error tracking ──
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Timestamps ──
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
