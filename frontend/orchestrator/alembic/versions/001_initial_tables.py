"""Initial tables: bot_instances, strategies, risk_events, audit_log

Revision ID: 001_initial
Revises: None
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # bot_instances — one row per FT bot container (metadata only, no trade data)
    op.create_table(
        "bot_instances",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("container_id", sa.String(100), nullable=True),
        sa.Column("docker_image", sa.String(200), server_default="freqtradeorg/freqtrade:stable_freqai"),
        sa.Column("api_url", sa.String(200), nullable=False),
        sa.Column("api_username", sa.String(100), nullable=False),
        sa.Column("api_password", sa.String(100), nullable=False),
        sa.Column("strategy_name", sa.String(200), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="stopped"),
        sa.Column("is_dry_run", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("api_port", sa.Integer(), nullable=False),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_healthy", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # strategies — lifecycle metadata only (FT has the actual .py files)
    op.create_table(
        "strategies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(200), unique=True, nullable=False),
        sa.Column("lifecycle", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("bot_instance_id", sa.Integer(), sa.ForeignKey("bot_instances.id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # risk_events — immutable kill switch log (never updated, never deleted)
    op.create_table(
        "risk_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bot_instance_id", sa.Integer(), sa.ForeignKey("bot_instances.id"), nullable=True),
        sa.Column("kill_type", sa.String(50), nullable=False),
        sa.Column("trigger", sa.String(50), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("triggered_by", sa.String(100), nullable=False, server_default="system"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # audit_log — immutable action log (never updated, never deleted)
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("actor", sa.String(100), nullable=False, server_default="system"),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("target_name", sa.String(200), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("risk_events")
    op.drop_table("strategies")
    op.drop_table("bot_instances")
