"""Add orch_settings table (safety thresholds) + cached_at on bot_instances.

Revision ID: 012_safety_settings
Revises: 011_test_jobs
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa


revision = "012_safety_settings"
down_revision = "011_test_jobs"
branch_labels = None
depends_on = None


def upgrade():
    # 1) Per-bot cache staleness tracking
    op.add_column(
        "bot_instances",
        sa.Column("cached_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2) Orchestrator-level safety thresholds (single row, id=1)
    op.create_table(
        "orch_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("max_leverage", sa.Integer, nullable=False, server_default="10"),
        sa.Column("portfolio_exposure_pct", sa.Integer, nullable=False, server_default="70"),
        sa.Column("daily_loss_threshold_pct", sa.Integer, nullable=False, server_default="7"),
        sa.Column("daily_loss_action", sa.String(32), nullable=False, server_default="soft_kill_all"),
        sa.Column("require_typed_go_live", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("forbid_unlimited_stake_live", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
    )

    # Seed the single row with defaults. Idempotent via ON CONFLICT.
    op.execute(
        "INSERT INTO orch_settings (id, max_leverage, portfolio_exposure_pct, "
        "daily_loss_threshold_pct, daily_loss_action, require_typed_go_live, "
        "forbid_unlimited_stake_live) VALUES "
        "(1, 10, 70, 7, 'soft_kill_all', true, true) ON CONFLICT (id) DO NOTHING"
    )


def downgrade():
    op.drop_table("orch_settings")
    op.drop_column("bot_instances", "cached_at")
