"""
Heartbeat Monitor.

Pings every registered bot via GET /api/v1/ping every 3 seconds.
3 consecutive failures = HARD KILL (safety rule #4).

This is one of our 5 custom features.
Everything else = FreqTrade.
"""
import asyncio
import logging

from sqlalchemy import select

from ..config import settings
from ..database import async_session
from ..models.bot_instance import BotInstance, BotStatus

logger = logging.getLogger(__name__)

_hb_counter = None

def _inc_heartbeat_failure():
    global _hb_counter
    if _hb_counter is None:
        try:
            from ..main import HEARTBEAT_FAILURES
            _hb_counter = HEARTBEAT_FAILURES
        except ImportError:
            return
    _hb_counter.inc()


class HeartbeatMonitor:
    """
    Background task that pings all active bots.

    Flow:
    1. Every 3s, ping all RUNNING bots (GET /api/v1/ping)
    2. Success → reset consecutive_failures to 0, mark healthy
    3. Failure → increment consecutive_failures
    4. 3 consecutive failures → trigger HARD KILL via kill switch
    """

    def __init__(self, bot_manager):
        self._bot_manager = bot_manager
        self._running = False
        self._kill_switch = None  # Set after import to avoid circular

    def set_kill_switch(self, kill_switch):
        """Set kill switch reference (avoids circular import)."""
        self._kill_switch = kill_switch

    def stop(self):
        """Signal the monitor to stop."""
        self._running = False

    async def run(self):
        """Main heartbeat loop. Runs until stop() is called."""
        self._running = True
        logger.info(
            "Heartbeat monitor started (interval=%ds, max_failures=%d)",
            settings.heartbeat_interval_seconds,
            settings.heartbeat_max_failures,
        )

        # Grace period: reset failure counters on startup to avoid
        # false-positive kills when orchestrator restarts while FT is booting
        await self._reset_failure_counters()
        grace_seconds = 10
        logger.info("Heartbeat grace period: %ds before monitoring starts", grace_seconds)
        await asyncio.sleep(grace_seconds)

        while self._running:
            try:
                await self._check_all_bots()
            except Exception as e:
                logger.error("Heartbeat cycle error: %s", e)

            await asyncio.sleep(settings.heartbeat_interval_seconds)

    async def _reset_failure_counters(self):
        """Reset consecutive_failures for all RUNNING bots on startup."""
        async with async_session() as db:
            result = await db.execute(
                select(BotInstance).where(
                    BotInstance.status == BotStatus.RUNNING,
                    BotInstance.is_deleted.is_(False),
                )
            )
            bots = list(result.scalars().all())
            for bot in bots:
                if bot.consecutive_failures > 0:
                    logger.info("Resetting failure counter for bot %s (was %d)", bot.name, bot.consecutive_failures)
                    bot.consecutive_failures = 0
                    bot.is_healthy = True
            await db.commit()

    async def _check_all_bots(self):
        """Ping all RUNNING bots, handle failures."""
        async with async_session() as db:
            result = await db.execute(
                select(BotInstance).where(
                    BotInstance.status == BotStatus.RUNNING,
                    BotInstance.is_deleted.is_(False),
                )
            )
            bots = list(result.scalars().all())

            for bot in bots:
                alive = await self._bot_manager.ping_bot(bot)

                if alive:
                    if bot.consecutive_failures > 0:
                        logger.info("Bot %s recovered (was at %d failures)", bot.name, bot.consecutive_failures)
                    bot.consecutive_failures = 0
                    bot.is_healthy = True
                else:
                    bot.consecutive_failures += 1
                    _inc_heartbeat_failure()
                    logger.warning(
                        "Bot %s ping failed (%d/%d)",
                        bot.name,
                        bot.consecutive_failures,
                        settings.heartbeat_max_failures,
                    )

                    if bot.consecutive_failures >= settings.heartbeat_max_failures:
                        bot.is_healthy = False
                        logger.critical(
                            "Bot %s: %d consecutive failures — triggering HARD KILL",
                            bot.name,
                            bot.consecutive_failures,
                        )
                        await self._trigger_hard_kill(db, bot)

            await db.commit()

    async def _trigger_hard_kill(self, db, bot: BotInstance):
        """Trigger hard kill for a bot that failed heartbeat."""
        if not self._kill_switch:
            logger.error("Kill switch not set — cannot hard kill bot %s", bot.name)
            # Still mark as killed even if kill switch unavailable
            bot.status = BotStatus.KILLED
            return

        try:
            await self._kill_switch.hard_kill_bot(
                db=db,
                bot_id=bot.id,
                trigger="heartbeat",
                reason=f"{settings.heartbeat_max_failures} consecutive ping failures",
            )
        except Exception as e:
            logger.error("Hard kill failed for bot %s: %s", bot.name, e)
            bot.status = BotStatus.ERROR
