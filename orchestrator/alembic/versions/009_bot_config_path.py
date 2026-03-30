"""Add config_path column to bot_instances

Revision ID: 009_bot_config_path
Revises: 008_backtest_is_deleted
Create Date: 2026-03-29

Orchestrator needs to know where each bot's config.json lives on disk
so it can write generated config (including FreqAI section) before
starting or reloading the bot.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009_bot_config_path"
down_revision: Union[str, None] = "008_backtest_is_deleted"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bot_instances",
        sa.Column("config_path", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bot_instances", "config_path")
