"""Add code, exchange, timeframe columns to strategies table

Revision ID: 003_strategy_code
Revises: 002_ai_validation
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_strategy_code"
down_revision: Union[str, None] = "002_ai_validation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("strategies", sa.Column("code", sa.Text(), nullable=True))
    op.add_column("strategies", sa.Column("exchange", sa.String(50), nullable=True))
    op.add_column("strategies", sa.Column("timeframe", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("strategies", "timeframe")
    op.drop_column("strategies", "exchange")
    op.drop_column("strategies", "code")
