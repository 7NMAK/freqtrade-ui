"""Create experiments and experiment_runs tables

Revision ID: 009_experiments
Revises: 008_backtest_is_deleted
Create Date: 2026-03-29

Experiments group related runs (backtest, hyperopt, AI) under one parent.
ExperimentRuns are individual runs within an experiment, with denormalized
metrics for fast table display.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009_experiments"
down_revision: Union[str, None] = "008_backtest_is_deleted"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── experiments table ──
    op.create_table(
        "experiments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("strategy_id", sa.Integer(), sa.ForeignKey("strategies.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("pair", sa.String(50), nullable=False),
        sa.Column("timeframe", sa.String(10), nullable=False),
        sa.Column("timerange_start", sa.Date(), nullable=True),
        sa.Column("timerange_end", sa.Date(), nullable=True),
        sa.Column("baseline_backtest_id", sa.Integer(), sa.ForeignKey("backtest_results.id"), nullable=True),
        sa.Column("best_version_id", sa.Integer(), sa.ForeignKey("strategy_versions.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_experiments_strategy_id", "experiments", ["strategy_id"])
    op.create_index("ix_experiments_pair", "experiments", ["pair"])

    # ── experiment_runs table ──
    op.create_table(
        "experiment_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("experiment_id", sa.Integer(), sa.ForeignKey("experiments.id"), nullable=False),
        sa.Column("parent_run_id", sa.Integer(), sa.ForeignKey("experiment_runs.id"), nullable=True),
        sa.Column("run_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        # Links to existing tables
        sa.Column("backtest_result_id", sa.Integer(), sa.ForeignKey("backtest_results.id"), nullable=True),
        sa.Column("strategy_version_id", sa.Integer(), sa.ForeignKey("strategy_versions.id"), nullable=True),
        sa.Column("ai_analysis_id", sa.Integer(), sa.ForeignKey("ai_hyperopt_analyses.id"), nullable=True),
        # Hyperopt-specific metadata
        sa.Column("sampler", sa.String(50), nullable=True),
        sa.Column("loss_function", sa.String(100), nullable=True),
        sa.Column("epochs", sa.Integer(), nullable=True),
        sa.Column("spaces", sa.JSON(), nullable=True),
        sa.Column("hyperopt_duration_seconds", sa.Integer(), nullable=True),
        # Quick metrics (denormalized)
        sa.Column("total_trades", sa.Integer(), nullable=True),
        sa.Column("win_rate", sa.Numeric(6, 2), nullable=True),
        sa.Column("profit_abs", sa.Numeric(20, 8), nullable=True),
        sa.Column("profit_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("max_drawdown", sa.Numeric(10, 4), nullable=True),
        sa.Column("sharpe_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("sortino_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("calmar_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("avg_duration", sa.String(50), nullable=True),
        # Output
        sa.Column("raw_output", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        # Soft delete + timestamp
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_experiment_runs_experiment_id", "experiment_runs", ["experiment_id"])
    op.create_index("ix_experiment_runs_run_type", "experiment_runs", ["run_type"])
    op.create_index("ix_experiment_runs_status", "experiment_runs", ["status"])


def downgrade() -> None:
    op.drop_table("experiment_runs")
    op.drop_table("experiments")
