"""
Portfolio Aggregator — cross-bot balance and profit aggregation.

KEY DESIGN PRINCIPLE:
  - P&L, Win Rate, trade counts → ALL bots (running + stopped)
  - Balance, Open Trades → RUNNING bots only (stopped bots have no API)
  - Stopped bots use cached_profit snapshot from last time they were running
  - Cache is updated every poll cycle while bot is running
"""
import asyncio
import logging
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from ..ft_client import FTClientError
from ..models.bot_instance import BotInstance, BotStatus

logger = logging.getLogger(__name__)


class PortfolioAggregator:
    """
    Aggregates FT API data across all bots.
    Running bots: live API data (+ cache update).
    Stopped bots: cached snapshot for profit/winrate.
    """

    def __init__(self, bot_manager: Any):
        self._bot_manager = bot_manager

    def _trading_bots(self, bots: list[BotInstance]) -> list[BotInstance]:
        """Filter out utility bots and deleted bots."""
        return [
            b for b in bots
            if not getattr(b, "is_utility", False) and not b.is_deleted
        ]

    async def _update_cache(self, db: AsyncSession, bot_id: int, profit: dict | None = None, balance: dict | None = None) -> None:
        """Persist latest profit/balance snapshot to DB."""
        values: dict[str, Any] = {}
        if profit is not None:
            values["cached_profit"] = profit
        if balance is not None:
            values["cached_balance"] = balance
        if values:
            await db.execute(
                update(BotInstance).where(BotInstance.id == bot_id).values(**values)
            )
            await db.commit()

    async def get_combined_profit(self, db: AsyncSession) -> dict:
        """
        Aggregate profit across ALL trading bots.
        Running bots: live FT API + cache update.
        Stopped bots: cached_profit from DB.
        """
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        running = [b for b in trading if b.status == BotStatus.RUNNING]
        stopped = [b for b in trading if b.status != BotStatus.RUNNING]

        per_bot: dict[str, Any] = {}
        combined = {
            "profit_all_coin": 0.0,
            "profit_all_fiat": 0.0,
            "profit_closed_coin": 0.0,
            "profit_closed_fiat": 0.0,
            "trade_count": 0,
            "closed_trade_count": 0,
            "winning_trades": 0,
            "losing_trades": 0,
        }

        # Fetch live from running bots
        async def fetch_profit(bot: BotInstance):
            try:
                return bot, await self._bot_manager.get_bot_profit(bot)
            except FTClientError as e:
                logger.warning("Profit fetch failed for bot %s: %s", bot.name, e)
                return bot, None

        results = await asyncio.gather(*(fetch_profit(b) for b in running))
        for bot, profit in results:
            if profit is not None:
                per_bot[bot.name] = profit
                # Cache it
                asyncio.create_task(self._update_cache(db, bot.id, profit=profit))
                self._accumulate_profit(combined, profit)
            elif bot.cached_profit:
                # API failed but we have cache
                per_bot[bot.name] = {**bot.cached_profit, "_cached": True}
                self._accumulate_profit(combined, bot.cached_profit)

        # Add stopped bots from cache
        for bot in stopped:
            if bot.cached_profit:
                per_bot[bot.name] = {**bot.cached_profit, "_cached": True, "_stopped": True}
                self._accumulate_profit(combined, bot.cached_profit)

        total_bots = len(trading)
        running_count = len(running)

        return {
            "bots": per_bot,
            "combined": combined,
            "bot_count": total_bots,
            "running_count": running_count,
            "stopped_count": total_bots - running_count,
        }

    def _accumulate_profit(self, combined: dict, profit: dict) -> None:
        """Sum profit fields into combined dict."""
        combined["profit_all_coin"] += float(profit.get("profit_all_coin", 0))
        combined["profit_all_fiat"] += float(profit.get("profit_all_fiat", 0))
        combined["profit_closed_coin"] += float(profit.get("profit_closed_coin", 0))
        combined["profit_closed_fiat"] += float(profit.get("profit_closed_fiat", 0))
        combined["trade_count"] += int(profit.get("trade_count", 0))
        combined["closed_trade_count"] += int(profit.get("closed_trade_count", 0))
        combined["winning_trades"] += int(profit.get("winning_trades", 0))
        combined["losing_trades"] += int(profit.get("losing_trades", 0))

    async def get_combined_balance(self, db: AsyncSession) -> dict:
        """
        Aggregate balance from RUNNING bots only.
        (Stopped bots don't hold capital in FT.)
        """
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        running = [b for b in trading if b.status == BotStatus.RUNNING]

        per_bot: dict[str, Any] = {}
        total_value = 0.0

        async def fetch_balance(bot: BotInstance):
            try:
                return bot, await self._bot_manager.get_bot_balance(bot)
            except FTClientError as e:
                logger.warning("Balance fetch failed for bot %s: %s", bot.name, e)
                return bot, None

        results = await asyncio.gather(*(fetch_balance(b) for b in running))
        for bot, balance in results:
            if balance is not None:
                per_bot[bot.name] = balance
                total_value += float(balance.get("total", 0))
                # Cache it
                asyncio.create_task(self._update_cache(db, bot.id, balance=balance))

        return {
            "bots": per_bot,
            "total_value": total_value,
            "bot_count": len(running),
            "total_bots": len(trading),
        }

    async def get_all_open_trades(self, db: AsyncSession) -> dict:
        """
        Open trades from RUNNING bots only.
        (Stopped bots can't have open trades.)
        """
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        running = [b for b in trading if b.status == BotStatus.RUNNING]

        all_trades: list[dict] = []

        async def fetch_status(bot: BotInstance):
            try:
                trades = await self._bot_manager.get_bot_status(bot)
                for trade in trades:
                    trade["_bot_name"] = bot.name
                    trade["_bot_id"] = bot.id
                return trades
            except FTClientError as e:
                logger.warning("Status fetch failed for bot %s: %s", bot.name, e)
                return []

        results = await asyncio.gather(*(fetch_status(b) for b in running))
        for trades in results:
            all_trades.extend(trades)

        return {
            "trades": all_trades,
            "trade_count": len(all_trades),
            "bot_count": len(running),
        }

    async def get_combined_daily(self, db: AsyncSession, days: int = 30) -> dict:
        """
        Daily P&L from RUNNING bots.
        Note: stopped bots' cached daily data is not merged yet — Phase 4 enhancement.
        """
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        running = [b for b in trading if b.status == BotStatus.RUNNING]

        per_bot: dict[str, Any] = {}

        async def fetch_daily(bot: BotInstance):
            try:
                return bot.name, await self._bot_manager.get_bot_daily(bot, days=days)
            except FTClientError as e:
                logger.warning("Daily fetch failed for bot %s: %s", bot.name, e)
                return bot.name, {"error": str(e)}

        results = await asyncio.gather(*(fetch_daily(b) for b in running))
        for name, daily in results:
            per_bot[name] = daily

        return {
            "bots": per_bot,
            "bot_count": len(running),
        }
