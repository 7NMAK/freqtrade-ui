"""Add level and bot_id columns to audit_log for comprehensive logging

Revision ID: 006_audit_log_level_botid
Revises: 005_ai_hyperopt
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_audit_log_level_botid"
down_revision: Union[str, None] = "005_ai_hyperopt"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add level column with default 'info'
    op.add_column(
        "audit_log",
        sa.Column("level", sa.String(20), nullable=False, server_default="info"),
    )
    # Add bot_id column (nullable — system-wide events have no bot)
    op.add_column(
        "audit_log",
        sa.Column("bot_id", sa.Integer(), nullable=True),
    )
    # Add bot_name column for display convenience
    op.add_column(
        "audit_log",
        sa.Column("bot_name", sa.String(200), nullable=True),
    )
    # Indexes for fast querying
    op.create_index("ix_audit_log_created_at_desc", "audit_log", ["created_at"])
    op.create_index("ix_audit_log_bot_id", "audit_log", ["bot_id"])
    op.create_index("ix_audit_log_level", "audit_log", ["level"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_level", table_name="audit_log")
    op.drop_index("ix_audit_log_bot_id", table_name="audit_log")
    op.drop_index("ix_audit_log_created_at_desc", table_name="audit_log")
    op.drop_column("audit_log", "bot_name")
    op.drop_column("audit_log", "bot_id")
    op.drop_column("audit_log", "level")
