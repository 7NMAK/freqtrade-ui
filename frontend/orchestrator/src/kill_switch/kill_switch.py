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
from ..activity_logger import log_activity

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

        # Step 1: Force exit ALL positions (MUST succeed — safety rule #5)
        try:
            exit_result = await client.forceexit("all")
        except FTClientError as e:
            logger.error("Force exit failed for bot %s: %s", bot.name, e)
            exit_result = {"error": str(e)}
            forceexit_failed = True

        # Step 2: Stop trading (always attempt, even if forceexit failed)
        try:
            stop_result = await client.stop()
        except FTClientError as e:
            logger.error("Stop failed for bot %s: %s", bot.name, e)
            stop_result = {"error": str(e)}

        bot.status = BotStatus.KILLED

        # Immutable risk event
        db.add(RiskEvent(
            bot_instance_id=bot.id,
            kill_type=KillType.HARD_KILL,
            trigger=TRIGGER_MAP.get(trigger, KillTrigger.MANUAL),
            reason=reason,
            triggered_by=actor,
        ))

        # Audit log
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
            }),
            diagnosis="POSITIONS MAY STILL BE OPEN — forceexit failed" if forceexit_failed else None,
        )

        _inc_kill_counter("hard", trigger)
        logger.critical("HARD KILL: bot=%s trigger=%s reason=%s forceexit_failed=%s",
                        bot.name, trigger, reason, forceexit_failed)

        result = {"forceexit": exit_result, "stop": stop_result, "success": not forceexit_failed}

        if forceexit_failed:
            logger.critical("POSITIONS MAY STILL BE OPEN for bot %s — forceexit failed", bot.name)

        return result

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

        # L6: concurrent kill via asyncio.gather
        async def _kill_one(bot: BotInstance) -> tuple[str, dict]:
            try:
                result = await self.hard_kill_bot(
                    db=db,
                    bot_id=bot.id,
                    trigger=trigger,
                    reason=reason,
                    actor=actor,
                )
                return (bot.name, result)
            except Exception as e:
                logger.error("Hard kill all — failed for bot %s: %s", bot.name, e)
                return (bot.name, {"error": str(e)})

        kill_results = await asyncio.gather(*[_kill_one(b) for b in running_bots])
        results = dict(kill_results)

        # Additional audit for the "all" action
        await log_activity(
            db,
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

        # L6: concurrent kill via asyncio.gather
        async def _kill_one(bot: BotInstance) -> tuple[str, dict]:
            try:
                result = await self.soft_kill_bot(
                    db=db,
                    bot_id=bot.id,
                    trigger=trigger,
                    reason=reason,
                    actor=actor,
                )
                return (bot.name, result)
            except Exception as e:
                logger.error("Soft kill all — failed for bot %s: %s", bot.name, e)
                return (bot.name, {"error": str(e)})

        kill_results = await asyncio.gather(*[_kill_one(b) for b in running_bots])
        results = dict(kill_results)

        await log_activity(
            db,
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
