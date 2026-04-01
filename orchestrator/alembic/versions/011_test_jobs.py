"""Add test_jobs table for background job queue.

Revision ID: 011
Revises: 010_bot_config_path
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "011_test_jobs"
down_revision = "010_bot_config_path"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "test_jobs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("experiment_id", sa.Integer, sa.ForeignKey("experiments.id"), nullable=False),
        sa.Column("bot_id", sa.Integer, sa.ForeignKey("bot_instances.id"), nullable=False),
        sa.Column("job_type", sa.String(30), nullable=False),
        sa.Column("strategy", sa.String(200), nullable=False),
        sa.Column("config", sa.JSON, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="queued"),
        sa.Column("progress", sa.Float, nullable=False, server_default="0"),
        sa.Column("current_step", sa.String(500), nullable=True),
        # Single-run results
        sa.Column("total_trades", sa.Integer, nullable=True),
        sa.Column("profit_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("win_rate", sa.Numeric(6, 2), nullable=True),
        sa.Column("max_drawdown", sa.Numeric(10, 4), nullable=True),
        sa.Column("sharpe_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("sortino_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("raw_result", sa.JSON, nullable=True),
        # Matrix results
        sa.Column("matrix_total", sa.Integer, nullable=True),
        sa.Column("matrix_completed", sa.Integer, nullable=True),
        sa.Column("matrix_results", sa.JSON, nullable=True),
        # Error
        sa.Column("error_message", sa.Text, nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Index for worker polling (pick next queued job)
    op.create_index("ix_test_jobs_status_created", "test_jobs", ["status", "created_at"])
    # Index for per-bot active job check
    op.create_index("ix_test_jobs_bot_status", "test_jobs", ["bot_id", "status"])


def downgrade():
    op.drop_index("ix_test_jobs_bot_status")
    op.drop_index("ix_test_jobs_status_created")
    op.drop_table("test_jobs")
