"""
OrchSettings — orchestrator-level runtime settings.

Single-row table (id=1). Runtime-editable via Settings page so user can
adjust safety thresholds without a redeploy. Enforcement code reads via
`get_safety_settings()` helper which auto-creates the row with defaults.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class OrchSettings(Base):
    __tablename__ = "orch_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # ── Safety thresholds (user-editable) ─────────────────────
    # Max leverage per bot on futures — blocks bot start / config apply if exceeded.
    max_leverage: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # Max cumulative stake across all RUNNING bots, as percentage of total balance.
    # Blocks bot start / increase if projected exposure would exceed this.
    portfolio_exposure_pct: Mapped[int] = mapped_column(Integer, default=70, nullable=False)

    # Daily loss circuit breaker: trigger action if sum of today's profit_abs
    # across all bots falls below -(threshold % of portfolio starting equity).
    daily_loss_threshold_pct: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    # Action when breaker trips: "soft_kill_all" (stops new trades, positions open)
    # or "hard_kill_all" (close positions + stop). Soft is safer default — lets
    # operator intervene instead of forcing market exits in a bad market.
    daily_loss_action: Mapped[str] = mapped_column(String(32), default="soft_kill_all", nullable=False)

    # UX safety: require typing "GO LIVE" to flip dry_run → False on a live bot.
    require_typed_go_live: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Config sanity: reject stake_amount="unlimited" on non-dry-run bots.
    forbid_unlimited_stake_live: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Audit ──────────────────────────────────────────────────
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
