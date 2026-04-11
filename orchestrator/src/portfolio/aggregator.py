"""
Portfolio Aggregator — cross-bot balance and profit aggregation.

KEY DESIGN PRINCIPLE:
  - P&L, Win Rate, trade counts → ALL bots (running + stopped via cached_profit)
  - Balance → ALL bots (running: live API; stopped: cached_balance from DB)
  - Open Trades → RUNNING bots only (stopped bots can't have open trades)
  - Stopped bots use cached_profit / cached_balance snapshots from last time they ran
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
        """Filter out utility bots, deleted bots, and webserver-mode bots.

        Matches the same filter as GET /api/bots (Fleet Manager):
          is_utility=false AND is_deleted=false AND ft_mode != 'webserver'
        """
        return [
            b for b in bots
            if not getattr(b, "is_utility", False)
            and not b.is_deleted
            and getattr(b, "ft_mode", "trade") != "webserver"
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
        active = [b for b in trading if b.status in (BotStatus.RUNNING, BotStatus.DRAINING)]
        stopped = [b for b in trading if b.status not in (BotStatus.RUNNING, BotStatus.DRAINING)]

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

        running = active  # alias for clarity below
        # Fetch live from running/draining bots
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
                # Cache it (inline await ensures cache is written before response)
                await self._update_cache(db, bot.id, profit=profit)
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
        Aggregate balance across ALL trading bots (mirrors get_combined_profit).
        Running bots: live FT API + cache update.
        Stopped bots: cached_balance from DB (last known balance when they stopped).
        This ensures Total Equity and P&L move together — both include stopped bots.
        """
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        running = [b for b in trading if b.status in (BotStatus.RUNNING, BotStatus.DRAINING)]
        stopped = [b for b in trading if b.status not in (BotStatus.RUNNING, BotStatus.DRAINING)]

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
                await self._update_cache(db, bot.id, balance=balance)
            elif bot.cached_balance:
                # API failed but we have cache — use it as fallback
                per_bot[bot.name] = {**bot.cached_balance, "_cached": True}
                total_value += float(bot.cached_balance.get("total", 0))

        # Include stopped bots via cached balance (same pattern as get_combined_profit)
        for bot in stopped:
            if bot.cached_balance:
                per_bot[bot.name] = {**bot.cached_balance, "_cached": True, "_stopped": True}
                total_value += float(bot.cached_balance.get("total", 0))

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
        running = [b for b in trading if b.status in (BotStatus.RUNNING, BotStatus.DRAINING)]

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

    async def _aggregate_time_series(
        self,
        bots: list[BotInstance],
        fetch_fn,
    ) -> dict:
        """
        Generic aggregator for daily/weekly/monthly FT time-series endpoints.
        Sums abs_profit and trade_count across all running bots per date bucket.
        rel_profit is averaged (weighted equally — FT doesn't expose stake per period).
        """
        running = [b for b in bots if b.status in (BotStatus.RUNNING, BotStatus.DRAINING)]
        results = await asyncio.gather(*[fetch_fn(b) for b in running], return_exceptions=True)

        # Accumulate per date: abs_profit sum, rel_profit sum + count, trade_count sum
        date_map: dict[str, dict] = {}
        stake_currency = "USDT"

        for result in results:
            if isinstance(result, Exception):
                continue
            if not isinstance(result, dict) or "data" not in result:
                continue
            stake_currency = result.get("stake_currency", stake_currency)
            for item in result["data"]:
                d = item.get("date", "")
                if not d:
                    continue
                cur = date_map.setdefault(d, {
                    "date": d,
                    "abs_profit": 0.0,
                    "rel_profit_sum": 0.0,
                    "rel_profit_count": 0,
                    "trade_count": 0,
                    "starting_balance": 0.0,
                })
                cur["abs_profit"] += float(item.get("abs_profit", 0))
                rel = item.get("rel_profit")
                if rel is not None:
                    cur["rel_profit_sum"] += float(rel)
                    cur["rel_profit_count"] += 1
                cur["trade_count"] += int(item.get("trade_count", 0))
                cur["starting_balance"] += float(item.get("starting_balance", 0))

        data = sorted(
            [
                {
                    "date": v["date"],
                    "abs_profit": v["abs_profit"],
                    "rel_profit": (
                        v["rel_profit_sum"] / v["rel_profit_count"]
                        if v["rel_profit_count"] > 0
                        else 0.0
                    ),
                    "trade_count": v["trade_count"],
                    "starting_balance": v["starting_balance"],
                }
                for v in date_map.values()
            ],
            key=lambda x: x["date"],
        )

        return {"data": data, "stake_currency": stake_currency, "bot_count": len(running)}

    async def get_combined_daily(self, db: AsyncSession, days: int = 30) -> dict:
        """Daily P&L aggregated across all running bots."""
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        return await self._aggregate_time_series(
            trading,
            lambda bot: self._bot_manager.get_bot_daily(bot, days=days),
        )

    async def get_combined_weekly(self, db: AsyncSession, weeks: int = 12) -> dict:
        """Weekly P&L aggregated across all running bots."""
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        return await self._aggregate_time_series(
            trading,
            lambda bot: self._bot_manager.get_bot_weekly(bot, weeks=weeks),
        )

    async def get_combined_monthly(self, db: AsyncSession, months: int = 12) -> dict:
        """Monthly P&L aggregated across all running bots."""
        bots = await self._bot_manager.get_all_bots(db)
        trading = self._trading_bots(bots)
        return await self._aggregate_time_series(
            trading,
            lambda bot: self._bot_manager.get_bot_monthly(bot, months=months),
        )
