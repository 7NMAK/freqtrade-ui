"""AI hyperopt tables: ai_hyperopt_analyses, ai_hyperopt_outcomes

Revision ID: 005_ai_hyperopt
Revises: 004_bot_config_overrides
Create Date: 2026-03-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005_ai_hyperopt"
down_revision: Union[str, None] = "004_bot_config_overrides"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ai_hyperopt_analyses — one row per AI analysis of a hyperopt run
    op.create_table(
        "ai_hyperopt_analyses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bot_id", sa.Integer(), sa.ForeignKey("bot_instances.id"), nullable=False),
        sa.Column("strategy_name", sa.String(100), nullable=False),
        sa.Column("pair", sa.String(30), nullable=False),
        sa.Column("timeframe", sa.String(10), nullable=False),
        sa.Column("analysis_type", sa.String(20), nullable=False),  # 'pre_hyperopt' | 'post_hyperopt'

        # Pre-hyperopt suggestions
        sa.Column("suggested_loss_function", sa.String(60), nullable=True),
        sa.Column("suggested_sampler", sa.String(30), nullable=True),
        sa.Column("suggested_epochs", sa.Integer(), nullable=True),
        sa.Column("suggested_param_ranges", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("suggested_spaces", postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Post-hyperopt analysis
        sa.Column("hyperopt_epochs_run", sa.Integer(), nullable=True),
        sa.Column("loss_function_used", sa.String(60), nullable=True),
        sa.Column("results_analyzed", sa.Integer(), nullable=True),
        sa.Column("recommended_result_index", sa.Integer(), nullable=True),
        sa.Column("overfitting_scores", postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Baseline comparison fields (§19.19)
        sa.Column("baseline_profit", sa.Float(), nullable=True),
        sa.Column("baseline_trades", sa.Integer(), nullable=True),
        sa.Column("baseline_sharpe", sa.Float(), nullable=True),
        sa.Column("baseline_max_drawdown", sa.Float(), nullable=True),

        # LLM responses
        sa.Column("claude_response", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("grok_response", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("claude_confidence", sa.Float(), nullable=True),
        sa.Column("grok_confidence", sa.Float(), nullable=True),

        # Meta / cost
        sa.Column("claude_tokens_used", sa.Integer(), server_default=sa.text("0")),
        sa.Column("grok_tokens_used", sa.Integer(), server_default=sa.text("0")),
        sa.Column("total_cost_usd", sa.Float(), server_default=sa.text("0.0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),

        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("idx_hyperopt_analyses_bot", "ai_hyperopt_analyses", ["bot_id", "created_at"], postgresql_ops={"created_at": "DESC"})
    op.create_index("idx_hyperopt_analyses_type", "ai_hyperopt_analyses", ["analysis_type"])

    # ai_hyperopt_outcomes — tracks whether user followed AI advice and what happened
    op.create_table(
        "ai_hyperopt_outcomes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("ai_hyperopt_analyses.id"), nullable=False),
        sa.Column("used_ai_suggestion", sa.Boolean(), nullable=False),     # did user follow the suggestion?
        sa.Column("final_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),  # what they actually used
        sa.Column("paper_trade_result", sa.Float(), nullable=True),         # profit if paper traded
        sa.Column("live_trade_result", sa.Float(), nullable=True),          # profit if live traded (filled later)
        sa.Column("user_feedback", sa.String(20), nullable=True),           # 'helpful' | 'neutral' | 'wrong'
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("idx_hyperopt_outcomes_suggestion", "ai_hyperopt_outcomes", ["used_ai_suggestion"])


def downgrade() -> None:
    op.drop_index("idx_hyperopt_outcomes_suggestion", table_name="ai_hyperopt_outcomes")
    op.drop_table("ai_hyperopt_outcomes")
    op.drop_index("idx_hyperopt_analyses_type", table_name="ai_hyperopt_analyses")
    op.drop_index("idx_hyperopt_analyses_bot", table_name="ai_hyperopt_analyses")
    op.drop_table("ai_hyperopt_analyses")
