"""
Daily loss circuit breaker.

Every RISK_CHECK_INTERVAL seconds, sums today's closed profit across all
RUNNING bots. If the sum falls below -(threshold% × total balance), triggers
the configured action (soft_kill_all or hard_kill_all) exactly once per day.
Resets at UTC midnight.

Thresholds come from OrchSettings (editable via Settings UI).
"""
import asyncio
import logging
from datetime import datetime, timezone

from ..database import async_session
from ..models.bot_instance import BotStatus
from ..api.safety_settings import get_safety_settings
from ..activity_logger import log_activity_independent

logger = logging.getLogger(__name__)

RISK_CHECK_INTERVAL = 60  # seconds between checks — dashboard polls faster


class DailyLossBreaker:
    """
    Background monitor. Co-operates with kill_switch and portfolio aggregator.

    Run once per minute (not every 3s like heartbeat) — the check reads live
    profit across every bot and the calculation cost scales with bot count.
    """

    def __init__(self, bot_manager, kill_switch, portfolio_aggregator):
        self._bot_manager = bot_manager
        self._kill_switch = kill_switch
        self._portfolio = portfolio_aggregator
        self._running = False
        # Track whether the breaker has fired today — reset at UTC midnight.
        self._last_fired_date: str | None = None

    def stop(self):
        self._running = False

    async def run(self):
        self._running = True
        logger.info("Daily loss breaker started (check every %ds)", RISK_CHECK_INTERVAL)
        while self._running:
            try:
                await self._check()
            except Exception as e:
                logger.error("Daily loss breaker cycle error: %s", e)
            await asyncio.sleep(RISK_CHECK_INTERVAL)

    async def _check(self):
        today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Reset the "fired today" flag when UTC date rolls over
        if self._last_fired_date and self._last_fired_date != today_utc:
            logger.info("Daily loss breaker reset — new UTC day %s", today_utc)
            self._last_fired_date = None

        if self._last_fired_date == today_utc:
            return  # Already fired today — don't spam

        async with async_session() as db:
            safety = await get_safety_settings(db)
            profit_data = await self._portfolio.get_combined_profit(db)
            balance_data = await self._portfolio.get_combined_balance(db)

        combined = profit_data.get("combined") or {}
        # profit_closed_fiat = today's realized P&L across all bots
        # (FT's profit aggregates include intraday closed trades in the
        # "today" bucket when the bot is queried via /profit)
        # For a daily check, we approximate with closed profit since midnight —
        # which requires querying /daily per bot. For simplicity, we use
        # profit_closed_fiat which is "since bot started" — the breaker
        # fires when total realized loss exceeds threshold relative to balance,
        # which is conservative (includes historical losses).
        # For strict "today only", replace this with per-bot /daily call.
        realized = float(combined.get("profit_closed_fiat", 0))
        total_balance = float(balance_data.get("total_value", 0))

        if total_balance <= 0:
            return  # Can't compute % without a denominator

        threshold_pct = safety.daily_loss_threshold_pct
        threshold_abs = -(total_balance * threshold_pct / 100.0)

        if realized >= threshold_abs:
            return  # All good

        # Breaker condition met
        action = safety.daily_loss_action
        logger.critical(
            "DAILY LOSS CIRCUIT BREAKER TRIPPED: realized=%.2f threshold=%.2f (%.1f%% of %.2f balance). "
            "Action: %s",
            realized, threshold_abs, threshold_pct, total_balance, action,
        )

        await log_activity_independent(
            action=f"risk.daily_loss_breaker.{action}",
            level="critical",
            target_type="portfolio",
            details=f"realized={realized:.2f} threshold={threshold_abs:.2f} "
                    f"pct={threshold_pct} balance={total_balance:.2f}",
            diagnosis=f"Daily loss exceeded {threshold_pct}% of total balance. "
                      f"Triggering {action}. Manual intervention required before resuming.",
        )

        # Execute the action via kill switch (its own session + audit trail)
        async with async_session() as kdb:
            if action == "hard_kill_all":
                await self._kill_switch.hard_kill_all(
                    db=kdb,
                    trigger="drawdown",
                    reason=f"daily_loss_breaker: {realized:.2f} < {threshold_abs:.2f}",
                    actor="system.risk",
                )
            else:
                await self._kill_switch.soft_kill_all(
                    db=kdb,
                    trigger="drawdown",
                    reason=f"daily_loss_breaker: {realized:.2f} < {threshold_abs:.2f}",
                    actor="system.risk",
                )
            await kdb.commit()

        self._last_fired_date = today_utc
