"""AI validation tables: ai_validations, ai_accuracy

Revision ID: 002_ai_validation
Revises: 001_initial
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002_ai_validation"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ai_validations — one row per AI validation of a FreqAI signal
    op.create_table(
        "ai_validations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bot_id", sa.Integer(), sa.ForeignKey("bot_instances.id"), nullable=False),
        sa.Column("ft_trade_id", sa.Integer(), nullable=False),
        sa.Column("pair", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        # FreqAI signal
        sa.Column("freqai_direction", sa.String(10), nullable=False),   # 'long' | 'short'
        sa.Column("freqai_confidence", sa.Float(), nullable=False),      # 0.0-1.0 (normalized do_predict)

        # Claude response
        sa.Column("claude_direction", sa.String(10), nullable=False),
        sa.Column("claude_confidence", sa.Float(), nullable=False),
        sa.Column("claude_reasoning", sa.Text(), nullable=True),
        sa.Column("claude_risk_factors", postgresql.JSONB(astext_type=sa.Text()), server_default="[]"),
        sa.Column("claude_sentiment", sa.String(20), nullable=True),
        sa.Column("claude_regime", sa.String(30), nullable=True),

        # Grok response
        sa.Column("grok_direction", sa.String(10), nullable=False),
        sa.Column("grok_confidence", sa.Float(), nullable=False),
        sa.Column("grok_reasoning", sa.Text(), nullable=True),
        sa.Column("grok_risk_factors", postgresql.JSONB(astext_type=sa.Text()), server_default="[]"),
        sa.Column("grok_sentiment", sa.String(20), nullable=True),
        sa.Column("grok_regime", sa.String(30), nullable=True),

        # Combined scores
        sa.Column("combined_confidence", sa.Float(), nullable=False),
        sa.Column("agreement_pct", sa.Float(), nullable=False),
        sa.Column("all_agree", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("strong_disagree", sa.Boolean(), nullable=False, server_default=sa.text("false")),

        # Cost tracking
        sa.Column("claude_tokens_used", sa.Integer(), server_default=sa.text("0")),
        sa.Column("grok_tokens_used", sa.Integer(), server_default=sa.text("0")),
        sa.Column("total_cost_usd", sa.Float(), server_default=sa.text("0.0")),

        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes per spec §6
    op.create_index("idx_ai_validations_bot", "ai_validations", ["bot_id", "created_at"], postgresql_ops={"created_at": "DESC"})
    op.create_index("idx_ai_validations_pair", "ai_validations", ["pair", "created_at"], postgresql_ops={"created_at": "DESC"})
    op.create_index(
        "idx_ai_validations_disagree",
        "ai_validations",
        ["strong_disagree"],
        postgresql_where=sa.text("strong_disagree = TRUE"),
    )

    # ai_accuracy — filled when a trade closes
    op.create_table(
        "ai_accuracy",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("validation_id", sa.Integer(), sa.ForeignKey("ai_validations.id"), nullable=False),
        sa.Column("advisor", sa.String(10), nullable=False),              # 'freqai' | 'claude' | 'grok'
        sa.Column("predicted_direction", sa.String(10), nullable=False),
        sa.Column("predicted_confidence", sa.Float(), nullable=False),
        sa.Column("actual_profit", sa.Float(), nullable=False),
        sa.Column("was_profitable", sa.Boolean(), nullable=False),
        sa.Column("was_correct", sa.Boolean(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("idx_ai_accuracy_advisor", "ai_accuracy", ["advisor", "was_correct"])


def downgrade() -> None:
    op.drop_index("idx_ai_accuracy_advisor", table_name="ai_accuracy")
    op.drop_table("ai_accuracy")
    op.drop_index("idx_ai_validations_disagree", table_name="ai_validations")
    op.drop_index("idx_ai_validations_pair", table_name="ai_validations")
    op.drop_index("idx_ai_validations_bot", table_name="ai_validations")
    op.drop_table("ai_validations")
