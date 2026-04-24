"""
Kill Switch — emergency stop for bots.

Two modes:
  Soft Kill = POST /api/v1/stop → stops trading, positions stay open
  Hard Kill = POST /api/v1/forceexit(all) + POST /api/v1/stop → closes ALL positions + stops

Triggers:
  - Manual (user pressed button)
  - Heartbeat failure (3 consecutive pings failed)
  - Drawdown limit (cross-bot drawdown exceeded)

Every activation is logged to risk_events (immutable — safety rule #9).
Recovery is MANUAL ONLY (safety rule #6).
"""
import asyncio
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from ..ft_client import FTClient, FTClientError
from ..models.bot_instance import BotInstance, BotStatus
from ..models.risk_event import RiskEvent, KillType, KillTrigger
from ..models.audit_log import AuditLog
from ..activity_logger import log_activity, log_activity_independent

logger = logging.getLogger(__name__)

# Lazy import to avoid circular — metrics defined in main.py
_kill_counter = None

def _inc_kill_counter(kill_type: str, trigger: str):
    global _kill_counter
    if _kill_counter is None:
        try:
            from ..main import KILL_EVENTS_TOTAL
            _kill_counter = KILL_EVENTS_TOTAL
        except ImportError:
            return
    _kill_counter.labels(type=kill_type, trigger=trigger).inc()

# Map string triggers to enum
TRIGGER_MAP = {
    "manual": KillTrigger.MANUAL,
    "heartbeat": KillTrigger.HEARTBEAT_FAILURE,
    "drawdown": KillTrigger.DRAWDOWN_LIMIT,
}


class KillSwitch:
    """
    Kill switch for FreqTrade bots.

    Soft Kill = stop trading (positions stay open)
    Hard Kill = close all positions + stop trading

    Every activation creates an immutable RiskEvent record.
    """

    def __init__(self, bot_manager):
        self._bot_manager = bot_manager

    async def soft_kill_bot(
        self,
        db: AsyncSession,
        bot_id: int,
        trigger: str = "manual",
        reason: str = "",
        actor: str = "system",
    ) -> dict:
        """
        Soft Kill — POST /api/v1/stop on one bot.
        Stops trading but keeps positions open.
        """
        bot = await self._bot_manager.get_bot(db, bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")

        client = await self._bot_manager.get_client(bot)

        try:
            result = await client.stop()
        except FTClientError as e:
            logger.error("Soft kill failed for bot %s: %s", bot.name, e)
            result = {"error": str(e)}

        bot.status = BotStatus.KILLED

        # Immutable risk event (never updated, never deleted)
        db.add(RiskEvent(
            bot_instance_id=bot.id,
            kill_type=KillType.SOFT_KILL,
            trigger=TRIGGER_MAP.get(trigger, KillTrigger.MANUAL),
            reason=reason,
            triggered_by=actor,
        ))

        # Audit log
        await log_activity(
            db,
            action="kill_switch.soft",
            level="warning",
            actor=actor,
            bot_id=bot.id,
            bot_name=bot.name,
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
            details=json.dumps({"trigger": trigger, "reason": reason}),
        )

        _inc_kill_counter("soft", trigger)
        logger.warning("SOFT KILL: bot=%s trigger=%s reason=%s", bot.name, trigger, reason)
        return result

    async def hard_kill_bot(
        self,
        db: AsyncSession,
        bot_id: int,
        trigger: str = "manual",
        reason: str = "",
        actor: str = "system",
    ) -> dict:
        """
        Hard Kill — POST /api/v1/forceexit(all) + POST /api/v1/stop on one bot.
        Closes ALL positions with MARKET orders, then stops trading.
        Exit orders are ALWAYS MARKET (safety rule #5).
        """
        bot = await self._bot_manager.get_bot(db, bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")

        client = await self._bot_manager.get_client(bot)
        forceexit_failed = False
        positions_remaining = -1  # -1 = unknown (verification failed too)
        exit_attempts = 0

        # Step 1: Force-exit ALL positions with retry + verification.
        # FT's /forceexit is fire-and-forget — it queues orders, does not wait
        # for fills. We retry up to 5× with exponential backoff, polling /status
        # between attempts, until open trades drop to 0.
        exit_result: dict = {}
        for attempt in range(5):
            exit_attempts = attempt + 1
            try:
                exit_result = await client.forceexit("all")
            except FTClientError as e:
                logger.error("Force exit attempt %d failed for bot %s: %s", exit_attempts, bot.name, e)
                exit_result = {"error": str(e)}
                forceexit_failed = True
                # Don't abort — retry after backoff

            # Poll /status to see if positions actually closed
            await asyncio.sleep(2 ** attempt)  # 1, 2, 4, 8, 16 seconds
            try:
                status = await client.status()
                open_trades = status if isinstance(status, list) else status.get("trades", [])
                positions_remaining = len(open_trades)
                if positions_remaining == 0:
                    forceexit_failed = False
                    break
                logger.warning(
                    "Hard kill attempt %d: bot=%s still has %d open positions, retrying",
                    exit_attempts, bot.name, positions_remaining,
                )
            except FTClientError as e:
                logger.error("Status poll failed during hard kill for bot %s: %s", bot.name, e)
                positions_remaining = -1
                forceexit_failed = True

        # Step 2: Stop trading — only if all positions confirmed closed.
        # If positions remain, keep bot RUNNING so stoploss-on-exchange (if set)
        # can still trigger, and operator can manually intervene.
        stop_result: dict = {}
        if positions_remaining == 0:
            try:
                stop_result = await client.stop()
            except FTClientError as e:
                logger.error("Stop failed for bot %s: %s", bot.name, e)
                stop_result = {"error": str(e)}
            bot.status = BotStatus.KILLED
        else:
            # Critical state: do NOT mark KILLED. Set ERROR and keep heartbeat
            # pinging so operator is alerted continuously.
            bot.status = BotStatus.ERROR
            stop_result = {"skipped": "positions still open"}
            logger.critical(
                "HARD KILL INCOMPLETE: bot=%s has %d positions still open after %d attempts. "
                "Bot left in ERROR state. MANUAL INTERVENTION REQUIRED.",
                bot.name, positions_remaining, exit_attempts,
            )

        # Immutable risk event
        db.add(RiskEvent(
            bot_instance_id=bot.id,
            kill_type=KillType.HARD_KILL,
            trigger=TRIGGER_MAP.get(trigger, KillTrigger.MANUAL),
            reason=reason,
            triggered_by=actor,
        ))

        # Audit log
        diagnosis = None
        if positions_remaining > 0:
            diagnosis = f"{positions_remaining} POSITIONS STILL OPEN after {exit_attempts} attempts — MANUAL INTERVENTION"
        elif positions_remaining < 0:
            diagnosis = "CANNOT VERIFY position state (status poll failed) — check exchange manually"

        await log_activity(
            db,
            action="kill_switch.hard",
            level="critical",
            actor=actor,
            bot_id=bot.id,
            bot_name=bot.name,
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
            details=json.dumps({
                "trigger": trigger,
                "reason": reason,
                "forceexit_failed": forceexit_failed,
                "exit_attempts": exit_attempts,
                "positions_remaining": positions_remaining,
            }),
            diagnosis=diagnosis,
        )

        _inc_kill_counter("hard", trigger)
        logger.critical(
            "HARD KILL: bot=%s trigger=%s reason=%s positions_remaining=%d attempts=%d",
            bot.name, trigger, reason, positions_remaining, exit_attempts,
        )

        return {
            "forceexit": exit_result,
            "stop": stop_result,
            "success": positions_remaining == 0,
            "positions_remaining": positions_remaining,
            "exit_attempts": exit_attempts,
        }

    async def hard_kill_all(
        self,
        db: AsyncSession,
        trigger: str = "manual",
        reason: str = "",
        actor: str = "system",
    ) -> dict:
        """
        Hard Kill ALL — forceexit + stop on every running bot.
        Nuclear option. Use with caution.
        """
        bots = await self._bot_manager.get_all_bots(db)
        running_bots = [b for b in bots if b.status == BotStatus.RUNNING]
        running_ids_names = [(b.id, b.name) for b in running_bots]

        # Each task opens its own DB session — SQLAlchemy AsyncSession is NOT
        # safe for concurrent use. Sharing a session across gather() tasks
        # causes interleaved writes, lost RiskEvent rows, and InterfaceErrors
        # exactly on the "nuclear option" path where we need audit trail most.
        from ..database import async_session

        async def _kill_one(bot_id: int, bot_name: str) -> tuple[str, dict]:
            try:
                async with async_session() as task_db:
                    result = await self.hard_kill_bot(
                        db=task_db,
                        bot_id=bot_id,
                        trigger=trigger,
                        reason=reason,
                        actor=actor,
                    )
                    await task_db.commit()
                    return (bot_name, result)
            except Exception as e:
                logger.error("Hard kill all — failed for bot %s: %s", bot_name, e)
                return (bot_name, {"error": str(e), "success": False})

        kill_results = await asyncio.gather(*[_kill_one(bid, bn) for bid, bn in running_ids_names])
        results = dict(kill_results)

        # Overall audit for "all" action written via INDEPENDENT session
        # so it survives any rollback of the caller's transaction.
        await log_activity_independent(
            action="kill_switch.hard_all",
            level="critical",
            actor=actor,
            target_type="all_bots",
            details=json.dumps({
                "trigger": trigger,
                "reason": reason,
                "bot_count": len(running_bots),
                "bots": [b.name for b in running_bots],
            }),
        )

        logger.critical(
            "HARD KILL ALL: %d bots killed, trigger=%s reason=%s",
            len(running_bots), trigger, reason,
        )
        return results

    async def soft_kill_all(
        self,
        db: AsyncSession,
        trigger: str = "manual",
        reason: str = "",
        actor: str = "system",
    ) -> dict:
        """
        Soft Kill ALL — stop on every running bot.
        Positions stay open.
        """
        bots = await self._bot_manager.get_all_bots(db)
        running_bots = [b for b in bots if b.status == BotStatus.RUNNING]
        running_ids_names = [(b.id, b.name) for b in running_bots]

        # Per-task DB sessions (see hard_kill_all comment for rationale).
        from ..database import async_session

        async def _kill_one(bot_id: int, bot_name: str) -> tuple[str, dict]:
            try:
                async with async_session() as task_db:
                    result = await self.soft_kill_bot(
                        db=task_db,
                        bot_id=bot_id,
                        trigger=trigger,
                        reason=reason,
                        actor=actor,
                    )
                    await task_db.commit()
                    return (bot_name, result)
            except Exception as e:
                logger.error("Soft kill all — failed for bot %s: %s", bot_name, e)
                return (bot_name, {"error": str(e)})

        kill_results = await asyncio.gather(*[_kill_one(bid, bn) for bid, bn in running_ids_names])
        results = dict(kill_results)

        await log_activity_independent(
            action="kill_switch.soft_all",
            level="warning",
            actor=actor,
            target_type="all_bots",
            details=json.dumps({
                "trigger": trigger,
                "reason": reason,
                "bot_count": len(running_bots),
            }),
        )

        return results
