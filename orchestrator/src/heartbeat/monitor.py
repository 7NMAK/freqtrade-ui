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
from ..activity_logger import log_activity

logger = logging.getLogger(__name__)

_hb_counter = None
_hb_cycle_errors = None

def _inc_heartbeat_failure():
    global _hb_counter
    if _hb_counter is None:
        try:
            from ..main import HEARTBEAT_FAILURES
            _hb_counter = HEARTBEAT_FAILURES
        except ImportError:
            return
    _hb_counter.inc()


def _inc_cycle_error():
    """Counter of whole-cycle failures — surfaces 'heartbeat is broken' class of bugs."""
    global _hb_cycle_errors
    if _hb_cycle_errors is None:
        try:
            from ..main import HEARTBEAT_CYCLE_ERRORS
            _hb_cycle_errors = HEARTBEAT_CYCLE_ERRORS
        except ImportError:
            return
    _hb_cycle_errors.inc()


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

        consecutive_cycle_errors = 0
        while self._running:
            try:
                await self._check_all_bots()
                consecutive_cycle_errors = 0
            except Exception as e:
                consecutive_cycle_errors += 1
                _inc_cycle_error()
                # Escalate log level once the heartbeat has been broken multiple
                # cycles in a row — this is the "monitoring has gone silent"
                # failure mode that violates safety rule #4.
                if consecutive_cycle_errors >= 3:
                    logger.critical(
                        "HEARTBEAT CYCLE FAILING: %d consecutive errors — auto-kill is NOT firing. Error: %s",
                        consecutive_cycle_errors, e,
                    )
                else:
                    logger.error("Heartbeat cycle error (%d consecutive): %s", consecutive_cycle_errors, e)

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
        """
        Ping all RUNNING/DRAINING bots using PER-BOT DB sessions.

        Why per-bot sessions: one bot's DB write error (deadlock, connection
        reset during Postgres VACUUM, constraint violation) would previously
        poison the whole cycle via a shared session — all bots that cycle
        would have their consecutive_failures un-incremented, silently
        breaking safety rule #4 ("3 failures = HARD KILL").
        """
        # Load bot list once (short-lived session)
        async with async_session() as db:
            running_result = await db.execute(
                select(BotInstance.id).where(
                    BotInstance.status.in_([BotStatus.RUNNING, BotStatus.DRAINING]),
                    BotInstance.is_deleted.is_(False),
                )
            )
            running_ids = [row[0] for row in running_result.all()]

            recovery_result = await db.execute(
                select(BotInstance.id).where(
                    BotInstance.status.in_([BotStatus.KILLED, BotStatus.ERROR]),
                    BotInstance.is_deleted.is_(False),
                )
            )
            recovery_ids = [row[0] for row in recovery_result.all()]

        # Recovery check for KILLED/ERROR bots — each gets its own session
        for bot_id in recovery_ids:
            try:
                await self._check_recovery(bot_id)
            except Exception as e:
                logger.error("Recovery check failed for bot %d: %s", bot_id, e)

        # Heartbeat check for active bots — each gets its own session so one
        # bot's DB error does not prevent other bots from being processed.
        for bot_id in running_ids:
            try:
                await self._check_one_bot(bot_id)
            except Exception as e:
                logger.error("Heartbeat check failed for bot %d: %s", bot_id, e)
                _inc_cycle_error()

    async def _check_recovery(self, bot_id: int):
        """Check a KILLED/ERROR bot — revive if it responds to ping."""
        async with async_session() as db:
            bot = await db.get(BotInstance, bot_id)
            if not bot or bot.is_deleted:
                return
            if getattr(bot, "is_utility", False) or getattr(bot, "ft_mode", "trade") == "webserver":
                return
            alive = await self._bot_manager.ping_bot(bot)
            if not alive:
                return
            prev_status = bot.status.value
            bot.status = BotStatus.RUNNING
            bot.consecutive_failures = 0
            bot.is_healthy = True
            logger.info("Bot %s auto-recovered (was %s) — status → RUNNING", bot.name, prev_status)
            await log_activity(
                db,
                action="heartbeat.auto_recovered",
                level="info",
                bot_id=bot.id,
                bot_name=bot.name,
                details=f"Bot responded to ping after being {prev_status}",
                diagnosis=f"Bot {bot.name} was {prev_status} but is now responding. "
                          f"Docker likely auto-restarted the container. Status restored to RUNNING.",
            )
            await db.commit()

    async def _check_one_bot(self, bot_id: int):
        """Ping one bot, update its row, trigger hard-kill if threshold exceeded."""
        async with async_session() as db:
            bot = await db.get(BotInstance, bot_id)
            if not bot or bot.is_deleted:
                return
            if getattr(bot, "is_utility", False) or getattr(bot, "ft_mode", "trade") == "webserver":
                return

            alive = await self._bot_manager.ping_bot(bot)

            if alive:
                if bot.consecutive_failures > 0:
                    logger.info("Bot %s recovered (was at %d failures)", bot.name, bot.consecutive_failures)
                    await log_activity(
                        db,
                        action="heartbeat.recovered",
                        level="info",
                        bot_id=bot.id,
                        bot_name=bot.name,
                        details=f"Recovered after {bot.consecutive_failures} failures",
                    )
                bot.consecutive_failures = 0
                bot.is_healthy = True
                await db.commit()
                return

            bot.consecutive_failures += 1
            _inc_heartbeat_failure()
            logger.warning(
                "Bot %s ping failed (%d/%d)",
                bot.name, bot.consecutive_failures, settings.heartbeat_max_failures,
            )
            await log_activity(
                db,
                action="heartbeat.failure",
                level="warning",
                bot_id=bot.id,
                bot_name=bot.name,
                details=f"Ping failed ({bot.consecutive_failures}/{settings.heartbeat_max_failures})",
                diagnosis=f"Bot {bot.name} is not responding to ping. "
                          f"Failure {bot.consecutive_failures} of {settings.heartbeat_max_failures} before auto-kill.",
            )

            should_kill = bot.consecutive_failures >= settings.heartbeat_max_failures
            if should_kill:
                bot.is_healthy = False
                logger.critical(
                    "Bot %s: %d consecutive failures — triggering HARD KILL",
                    bot.name, bot.consecutive_failures,
                )
                await log_activity(
                    db,
                    action="heartbeat.auto_kill",
                    level="critical",
                    bot_id=bot.id,
                    bot_name=bot.name,
                    details=f"{bot.consecutive_failures} consecutive ping failures",
                    diagnosis=f"Bot {bot.name} failed {bot.consecutive_failures} consecutive heartbeat pings. "
                              f"Triggering automatic HARD KILL. Check: docker logs {bot.name}",
                )
            await db.commit()

            if should_kill:
                # Kill switch opens its own session so its audit log + risk
                # event writes survive any failure in this function.
                await self._trigger_hard_kill(bot.id)

    async def _trigger_hard_kill(self, bot_id: int):
        """Trigger hard kill for a bot that failed heartbeat. Uses its own DB session."""
        async with async_session() as db:
            bot = await db.get(BotInstance, bot_id)
            if not bot:
                return
            if not self._kill_switch:
                logger.critical(
                    "Kill switch not set — cannot auto-kill bot %s. Marking ERROR (positions may be open).",
                    bot.name,
                )
                bot.status = BotStatus.ERROR
                await db.commit()
                return

            try:
                await self._kill_switch.hard_kill_bot(
                    db=db,
                    bot_id=bot.id,
                    trigger="heartbeat",
                    reason=f"{settings.heartbeat_max_failures} consecutive ping failures",
                )
                await db.commit()
            except Exception as e:
                # Hard kill itself failed — bot stays in ERROR so heartbeat keeps
                # pinging (it only skips RUNNING/DRAINING bots). Operator must
                # intervene manually; the error log here is the last signal.
                logger.critical(
                    "AUTO HARD KILL FAILED for bot %s: %s. Positions may be open. MANUAL INTERVENTION REQUIRED.",
                    bot.name, e,
                )
                bot.status = BotStatus.ERROR
                await db.commit()
