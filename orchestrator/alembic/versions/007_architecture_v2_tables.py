"""Architecture V2: strategy_versions, exchange_profiles, backtest_results tables + bot_instances V2 columns

Revision ID: 007_architecture_v2
Revises: 006_audit_log_level_botid
Create Date: 2026-03-29

Phase 1 of ARCHITECTURE_V2.md:
1. Create exchange_profiles table
2. Create strategy_versions table (FK to strategies)
3. Create backtest_results table (FK to strategy_versions)
4. Add V2 columns to bot_instances (exchange, trading config, strategy_version_id)
5. Add current_version_id to strategies
6. Add DRAINING to bot_status enum (already in model, ensure DB has it)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "007_architecture_v2"
down_revision: Union[str, None] = "006_audit_log_level_botid"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. exchange_profiles table ────────────────────────────
    op.create_table(
        "exchange_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("exchange_name", sa.String(50), nullable=False),
        sa.Column("api_key_enc", sa.Text(), nullable=True),
        sa.Column("api_secret_enc", sa.Text(), nullable=True),
        sa.Column("api_password", sa.Text(), nullable=True),
        sa.Column("uid", sa.String(100), nullable=True),
        sa.Column("subaccount", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), default=False, nullable=False),
    )

    # ── 2. strategy_versions table ────────────────────────────
    op.create_table(
        "strategy_versions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("strategy_id", sa.Integer(), sa.ForeignKey("strategies.id"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("builder_state", sa.JSON(), nullable=True),
        sa.Column("risk_config", sa.JSON(), nullable=True),
        sa.Column("callbacks", sa.JSON(), nullable=True),
        sa.Column("freqai_config", sa.JSON(), nullable=True),
        sa.Column("changelog", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("strategy_id", "version_number", name="uq_strategy_version"),
    )

    # ── 3. backtest_results table ─────────────────────────────
    op.create_table(
        "backtest_results",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("strategy_version_id", sa.Integer(), sa.ForeignKey("strategy_versions.id"), nullable=False),
        sa.Column("exchange_data", sa.String(50), nullable=False),
        sa.Column("pairs", sa.JSON(), nullable=False),
        sa.Column("timeframe", sa.String(10), nullable=False),
        sa.Column("timerange_start", sa.Date(), nullable=False),
        sa.Column("timerange_end", sa.Date(), nullable=False),
        sa.Column("total_trades", sa.Integer(), nullable=True),
        sa.Column("winning_trades", sa.Integer(), nullable=True),
        sa.Column("losing_trades", sa.Integer(), nullable=True),
        sa.Column("profit_total", sa.Numeric(20, 8), nullable=True),
        sa.Column("profit_percent", sa.Numeric(10, 4), nullable=True),
        sa.Column("max_drawdown", sa.Numeric(10, 4), nullable=True),
        sa.Column("sharpe_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("sortino_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("sqn", sa.Numeric(10, 4), nullable=True),
        sa.Column("full_results", sa.JSON(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), default=False, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 4. Add V2 columns to bot_instances ────────────────────
    # Exchange config
    op.add_column("bot_instances", sa.Column("exchange_name", sa.String(50), nullable=True, server_default="binance"))
    op.add_column("bot_instances", sa.Column("exchange_key_enc", sa.Text(), nullable=True))
    op.add_column("bot_instances", sa.Column("exchange_secret_enc", sa.Text(), nullable=True))
    op.add_column("bot_instances", sa.Column("exchange_password", sa.Text(), nullable=True))
    op.add_column("bot_instances", sa.Column("exchange_uid", sa.String(100), nullable=True))
    op.add_column("bot_instances", sa.Column("exchange_subaccount", sa.String(100), nullable=True))
    op.add_column("bot_instances", sa.Column("exchange_profile_id", sa.Integer(), sa.ForeignKey("exchange_profiles.id"), nullable=True))

    # Trading config
    op.add_column("bot_instances", sa.Column("stake_currency", sa.String(20), nullable=True, server_default="USDT"))
    op.add_column("bot_instances", sa.Column("stake_amount", sa.String(50), nullable=True, server_default="unlimited"))
    op.add_column("bot_instances", sa.Column("max_open_trades", sa.Integer(), nullable=True, server_default="3"))
    op.add_column("bot_instances", sa.Column("timeframe", sa.String(10), nullable=True, server_default="5m"))
    op.add_column("bot_instances", sa.Column("pair_whitelist", sa.JSON(), nullable=True))
    op.add_column("bot_instances", sa.Column("pair_blacklist", sa.JSON(), nullable=True))
    op.add_column("bot_instances", sa.Column("trading_mode", sa.String(20), nullable=True, server_default="futures"))
    op.add_column("bot_instances", sa.Column("margin_mode", sa.String(20), nullable=True, server_default="isolated"))

    # Strategy version reference
    op.add_column("bot_instances", sa.Column("strategy_version_id", sa.Integer(), sa.ForeignKey("strategy_versions.id"), nullable=True))

    # Utility flag + cached data + FT mode
    op.add_column("bot_instances", sa.Column("is_utility", sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("bot_instances", sa.Column("ft_mode", sa.String(20), nullable=True, server_default="trade"))
    op.add_column("bot_instances", sa.Column("cached_profit", sa.JSON(), nullable=True))
    op.add_column("bot_instances", sa.Column("cached_balance", sa.JSON(), nullable=True))

    # ── 5. Add current_version_id to strategies ───────────────
    op.add_column("strategies", sa.Column("current_version_id", sa.Integer(), sa.ForeignKey("strategy_versions.id"), nullable=True))

    # ── 6. Add builder_state to strategies (for backward compat) ──
    # May already exist from migration 003, so use batch mode to be safe
    try:
        op.add_column("strategies", sa.Column("builder_state", sa.JSON(), nullable=True))
    except Exception:
        pass  # Column already exists from migration 003


def downgrade() -> None:
    # Remove strategy current_version_id
    op.drop_column("strategies", "current_version_id")

    # Remove V2 columns from bot_instances
    for col in [
        "exchange_name", "exchange_key_enc", "exchange_secret_enc",
        "exchange_password", "exchange_uid", "exchange_subaccount",
        "exchange_profile_id", "stake_currency", "stake_amount",
        "max_open_trades", "timeframe", "pair_whitelist", "pair_blacklist",
        "trading_mode", "margin_mode", "strategy_version_id",
        "is_utility", "ft_mode", "cached_profit", "cached_balance",
    ]:
        op.drop_column("bot_instances", col)

    # Drop tables in reverse dependency order
    op.drop_table("backtest_results")
    op.drop_table("strategy_versions")
    op.drop_table("exchange_profiles")
