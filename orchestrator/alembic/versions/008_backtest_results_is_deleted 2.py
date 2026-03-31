"""Add is_deleted column to backtest_results

Revision ID: 008_backtest_is_deleted
Revises: 007_architecture_v2
Create Date: 2026-03-29

Migration 007 defined is_deleted but the table was created before
the column was added to the migration. This adds it retroactively.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008_backtest_is_deleted"
down_revision: Union[str, None] = "007_architecture_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if column already exists (007 may have created it on fresh DB)
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='backtest_results' AND column_name='is_deleted'"
    ))
    if result.fetchone() is None:
        op.add_column(
            "backtest_results",
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        )


def downgrade() -> None:
    op.drop_column("backtest_results", "is_deleted")
