"""Add config_overrides JSON column to bot_instances table

Revision ID: 004_bot_config_overrides
Revises: 003_strategy_code
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_bot_config_overrides"
down_revision: Union[str, None] = "003_strategy_code"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bot_instances", sa.Column("config_overrides", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("bot_instances", "config_overrides")
