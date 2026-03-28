"""
Signal Collector — reads FreqAI signals and market context from FT bots.

RULE: NEVER duplicates trade data. ALL data comes from FT REST API.
This module is purely a read-only consumer of FreqTrade data.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from ..ft_client import FTClient

logger = logging.getLogger(__name__)


class SignalCollector:
    """
    Detects new FreqAI signals and collects market context.
    Uses the existing FTClient — no direct HTTP calls here.

    FT field names (NEVER alias these):
    - trade_id, pair, is_short, open_rate, close_rate
    - stake_amount, current_profit, close_profit_abs
    - enter_tag, exit_reason, open_date, close_date
    """

    def __init__(self, ft_client: FTClient) -> None:
        self.ft = ft_client
        # Snapshot of trade_ids from the previous poll per bot_id
        # {bot_id: set[trade_id]}
        self._previous_trades: dict[int, set[int]] = {}

    async def detect_new_signals(self, bot_id: int) -> list[dict[str, Any]]:
        """
        Compare current open trades with the previous snapshot.
        Returns a list of *new* trades that need AI validation.

        Only new trade_ids trigger validation — not every poll cycle.
        This prevents re-validating the same open trade repeatedly.
        """
        try:
            current_trades: list[dict] = await self.ft.status()
        except Exception as exc:
            logger.warning("Could not fetch status for bot %d: %s", bot_id, exc)
            return []

        current_ids = {t["trade_id"] for t in current_trades}
        prev_ids = self._previous_trades.get(bot_id, set())

        # Detect new trade IDs since last poll
        new_trades = [t for t in current_trades if t["trade_id"] not in prev_ids]

        # Update snapshot
        self._previous_trades[bot_id] = current_ids

        if new_trades:
            logger.info(
                "Bot %d: detected %d new trade(s): %s",
                bot_id,
                len(new_trades),
                [t["trade_id"] for t in new_trades],
            )

        return new_trades

    async def collect_context(
        self, bot_id: int, pair: str, timeframe: str
    ) -> dict[str, Any]:
        """
        Gather all context needed for LLM analysis of a trade.

        Returns:
            {
                "pair": str,
                "timeframe": str,
                "candles": {...},        # Last 100 OHLCV candles from FT
                "bot_profit": {...},     # Overall bot profit stats
                "pair_performance": [...], # Per-pair performance history
                "bot_stats": {...},      # Max drawdown, trade count
                "daily_profit": {...},   # Last 30 days P&L
            }
        """
        results: dict[str, Any] = {
            "pair": pair,
            "timeframe": timeframe,
        }

        # Fetch all context concurrently (separate try/except per call)
        # so one failure doesn't block the others

        candles_task = self._safe_fetch("candles", self.ft.pair_candles, pair, timeframe, 100)
        profit_task = self._safe_fetch("bot_profit", self.ft.profit)
        perf_task = self._safe_fetch("pair_performance", self.ft.performance)
        stats_task = self._safe_fetch("bot_stats", self.ft.stats)
        daily_task = self._safe_fetch("daily_profit", self.ft.daily, 30)

        (
            results["candles"],
            results["bot_profit"],
            results["pair_performance"],
            results["bot_stats"],
            results["daily_profit"],
        ) = await asyncio.gather(
            candles_task, profit_task, perf_task, stats_task, daily_task
        )

        return results

    async def _safe_fetch(
        self, label: str, fn: Any, *args: Any
    ) -> Any:
        """Wrap an FT API call so one failure returns {} instead of crashing."""
        try:
            return await fn(*args)
        except Exception as exc:
            logger.warning("Failed to fetch %s: %s", label, exc)
            return {}
