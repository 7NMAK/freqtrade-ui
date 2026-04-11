"""
Dashboard Polling Worker.

Pre-fetches all dashboard data every 30s and stores a snapshot in Redis.
Frontend reads one cached endpoint instead of making N×3 live FT requests.

Redis key : dashboard:snapshot
TTL       : 90s (3× poll interval — always valid even if one cycle is slow)

Snapshot schema:
{
  "cached_at": <unix timestamp>,
  "portfolio": {
    "balance":  <same shape as GET /api/portfolio/balance>,
    "profit":   <same shape as GET /api/portfolio/profit>,
    "trades":   <same shape as GET /api/portfolio/trades>,
    "daily":    <same shape as GET /api/portfolio/daily?days=30>,
    "weekly":   <same shape as GET /api/portfolio/weekly?weeks=12>,
    "monthly":  <same shape as GET /api/portfolio/monthly?months=12>
  },
  "per_bot_profit": { "<bot_id>": <FT profit object> },
  "sparklines":     { "<bot_id>": [abs_profit_day1, ...] }  # 7 days
}
"""
import asyncio
import json
import logging
import time

from ..config import settings
from ..database import async_session
from ..models.bot_instance import BotStatus

logger = logging.getLogger(__name__)

REDIS_KEY = "dashboard:snapshot"
CACHE_TTL = 90   # seconds — 3× poll interval
POLL_INTERVAL = 30  # seconds


class DashboardWorker:
    """
    Background asyncio task.
    Polls all FT bots every POLL_INTERVAL seconds, aggregates the results,
    and stores a JSON snapshot in Redis for instant frontend reads.
    """

    def __init__(self, bot_manager):
        self._bot_manager = bot_manager
        self._running = False
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        return self._redis

    def stop(self):
        self._running = False

    async def run(self):
        self._running = True
        logger.info("Dashboard worker started (poll=%ds, ttl=%ds)", POLL_INTERVAL, CACHE_TTL)

        # First poll immediately so the snapshot is ready on frontend load
        try:
            await self._build_and_cache()
        except Exception as exc:
            logger.error("Dashboard worker initial poll error: %s", exc, exc_info=True)

        while self._running:
            await asyncio.sleep(POLL_INTERVAL)
            if not self._running:
                break
            try:
                await self._build_and_cache()
            except Exception as exc:
                logger.error("Dashboard worker poll error: %s", exc, exc_info=True)

    async def _build_and_cache(self):
        from ..portfolio.aggregator import PortfolioAggregator

        t0 = time.monotonic()

        # ── 1. Bot list (single DB query) ────────────────────────────────
        async with async_session() as db:
            bots_raw = await self._bot_manager.get_all_bots(db)

        agg_proto = PortfolioAggregator(self._bot_manager)
        trading = agg_proto._trading_bots(bots_raw)
        running = [b for b in trading if b.status in (BotStatus.RUNNING, BotStatus.DRAINING)]

        # ── 2. Portfolio aggregations (parallel, each with its own session) ─
        def _agg():
            return PortfolioAggregator(self._bot_manager)

        async def _balance():
            async with async_session() as db:
                return await _agg().get_combined_balance(db)

        async def _profit():
            async with async_session() as db:
                return await _agg().get_combined_profit(db)

        async def _trades():
            async with async_session() as db:
                return await _agg().get_all_open_trades(db)

        async def _daily():
            async with async_session() as db:
                return await _agg().get_combined_daily(db, days=30)

        async def _weekly():
            async with async_session() as db:
                return await _agg().get_combined_weekly(db, weeks=12)

        async def _monthly():
            async with async_session() as db:
                return await _agg().get_combined_monthly(db, months=12)

        balance, profit, trades, daily, weekly, monthly = await asyncio.gather(
            _balance(), _profit(), _trades(), _daily(), _weekly(), _monthly(),
            return_exceptions=True,
        )

        # ── 3. Per-bot profit (keyed by bot_id) ──────────────────────────
        # portfolio.profit.bots is keyed by name — we also expose by bot_id
        # so the frontend can look up profits[bot.id] without name→id mapping
        per_bot_profit: dict = {}
        if not isinstance(profit, Exception) and isinstance(profit, dict):
            name_to_id = {b.name: b.id for b in bots_raw if not b.is_deleted}
            for name, pdata in (profit.get("bots") or {}).items():
                bot_id = name_to_id.get(name)
                if bot_id is not None:
                    per_bot_profit[str(bot_id)] = pdata

        # ── 4. Per-bot sparklines (botDaily 7 days) ──────────────────────
        async def _sparkline(bot):
            try:
                result = await self._bot_manager.get_bot_daily(bot, days=7)
                return str(bot.id), [item.get("abs_profit", 0) for item in result.get("data", [])]
            except Exception:
                return str(bot.id), []

        sparkline_results = await asyncio.gather(
            *[_sparkline(b) for b in running],
            return_exceptions=True,
        )
        sparklines: dict = {}
        for r in sparkline_results:
            if isinstance(r, Exception):
                continue
            bot_id_str, data = r
            sparklines[bot_id_str] = data

        # ── 5. Assemble snapshot ─────────────────────────────────────────
        snapshot = {
            "cached_at": time.time(),
            "portfolio": {
                "balance":  balance  if not isinstance(balance,  Exception) else None,
                "profit":   profit   if not isinstance(profit,   Exception) else None,
                "trades":   trades   if not isinstance(trades,   Exception) else None,
                "daily":    daily    if not isinstance(daily,    Exception) else None,
                "weekly":   weekly   if not isinstance(weekly,   Exception) else None,
                "monthly":  monthly  if not isinstance(monthly,  Exception) else None,
            },
            "per_bot_profit": per_bot_profit,
            "sparklines": sparklines,
        }

        r = await self._get_redis()
        await r.setex(REDIS_KEY, CACHE_TTL, json.dumps(snapshot))

        elapsed = time.monotonic() - t0
        logger.info(
            "Dashboard snapshot cached in %.1fs (%d running bots, %d sparklines)",
            elapsed, len(running), len(sparklines),
        )
