"""
Portfolio Aggregator — cross-bot balance and profit aggregation.

This is one of our 5 custom features.
It aggregates data from FT REST API across all bots:
  - GET /api/v1/balance (per bot) → combined portfolio balance
  - GET /api/v1/profit (per bot) → combined profit stats
  - GET /api/v1/status (per bot) → all open trades across bots

We do NOT calculate anything ourselves.
We just SUM what FT already calculated per-bot.
"""
import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from ..ft_client import FTClientError
from ..models.bot_instance import BotInstance, BotStatus

logger = logging.getLogger(__name__)


class PortfolioAggregator:
    """
    Aggregates FT API data across all running bots.
    No custom calculations — just combines per-bot FT data.
    """

    def __init__(self, bot_manager):
        self._bot_manager = bot_manager

    async def get_combined_balance(self, db: AsyncSession) -> dict:
        """
        Aggregate GET /api/v1/balance from all running bots.
        Returns per-bot balances + total.
        """
        bots = await self._bot_manager.get_all_bots(db)
        running = [b for b in bots if b.status == BotStatus.RUNNING]

        per_bot = {}
        total_value = 0.0

        async def fetch_balance(bot):
            try:
                return bot.name, await self._bot_manager.get_bot_balance(bot)
            except FTClientError as e:
                logger.warning("Balance fetch failed for bot %s: %s", bot.name, e)
                return bot.name, {"error": str(e)}

        results = await asyncio.gather(*(fetch_balance(b) for b in running))
        for name, balance in results:
            per_bot[name] = balance
            if "error" not in balance:
                total_value += float(balance.get("total", 0))

        return {
            "bots": per_bot,
            "total_value": total_value,
            "bot_count": len(running),
        }

    async def get_combined_profit(self, db: AsyncSession) -> dict:
        """
        Aggregate GET /api/v1/profit from all running bots.
        Returns per-bot profit + combined totals.
        """
        bots = await self._bot_manager.get_all_bots(db)
        running = [b for b in bots if b.status == BotStatus.RUNNING]

        per_bot = {}
        combined = {
            "profit_all_coin": 0.0,
            "profit_all_fiat": 0.0,
            "profit_closed_coin": 0.0,
            "profit_closed_fiat": 0.0,
            "trade_count": 0,
            "closed_trade_count": 0,
        }

        async def fetch_profit(bot):
            try:
                return bot.name, await self._bot_manager.get_bot_profit(bot)
            except FTClientError as e:
                logger.warning("Profit fetch failed for bot %s: %s", bot.name, e)
                return bot.name, {"error": str(e)}

        results = await asyncio.gather(*(fetch_profit(b) for b in running))
        for name, profit in results:
            per_bot[name] = profit
            if "error" not in profit:
                combined["profit_all_coin"] += float(profit.get("profit_all_coin", 0))
                combined["profit_all_fiat"] += float(profit.get("profit_all_fiat", 0))
                combined["profit_closed_coin"] += float(profit.get("profit_closed_coin", 0))
                combined["profit_closed_fiat"] += float(profit.get("profit_closed_fiat", 0))
                combined["trade_count"] += int(profit.get("trade_count", 0))
                combined["closed_trade_count"] += int(profit.get("closed_trade_count", 0))

        return {
            "bots": per_bot,
            "combined": combined,
            "bot_count": len(running),
        }

    async def get_all_open_trades(self, db: AsyncSession) -> dict:
        """
        Aggregate GET /api/v1/status from all running bots.
        Returns all open trades across all bots, tagged with bot name.
        Uses FT field names: open_rate, stake_amount, current_profit, etc.
        """
        bots = await self._bot_manager.get_all_bots(db)
        running = [b for b in bots if b.status == BotStatus.RUNNING]

        all_trades = []

        async def fetch_status(bot):
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
        Aggregate GET /api/v1/daily from all running bots.
        Returns per-bot daily data.
        """
        bots = await self._bot_manager.get_all_bots(db)
        running = [b for b in bots if b.status == BotStatus.RUNNING]

        per_bot = {}

        async def fetch_daily(bot):
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
