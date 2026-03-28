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
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from ..ft_client import FTClient, FTClientError
from ..models.bot_instance import BotInstance, BotStatus
from ..models.risk_event import RiskEvent, KillType, KillTrigger
from ..models.audit_log import AuditLog

logger = logging.getLogger(__name__)

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

        client = self._bot_manager.get_client(bot)

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
        db.add(AuditLog(
            action="kill_switch.soft",
            actor=actor,
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
            details=json.dumps({"trigger": trigger, "reason": reason}),
        ))

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

        client = self._bot_manager.get_client(bot)

        # Step 1: Force exit ALL positions
        try:
            exit_result = await client.forceexit("all")
        except FTClientError as e:
            logger.error("Force exit failed for bot %s: %s", bot.name, e)
            exit_result = {"error": str(e)}

        # Step 2: Stop trading
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
        db.add(AuditLog(
            action="kill_switch.hard",
            actor=actor,
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
            details=json.dumps({"trigger": trigger, "reason": reason}),
        ))

        logger.critical("HARD KILL: bot=%s trigger=%s reason=%s", bot.name, trigger, reason)
        return {"forceexit": exit_result, "stop": stop_result}

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

        results = {}
        for bot in running_bots:
            try:
                result = await self.hard_kill_bot(
                    db=db,
                    bot_id=bot.id,
                    trigger=trigger,
                    reason=reason,
                    actor=actor,
                )
                results[bot.name] = result
            except Exception as e:
                logger.error("Hard kill all — failed for bot %s: %s", bot.name, e)
                results[bot.name] = {"error": str(e)}

        # Additional audit for the "all" action
        db.add(AuditLog(
            action="kill_switch.hard_all",
            actor=actor,
            target_type="all_bots",
            target_id=None,
            target_name=None,
            details=json.dumps({
                "trigger": trigger,
                "reason": reason,
                "bot_count": len(running_bots),
                "bots": [b.name for b in running_bots],
            }),
        ))

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

        results = {}
        for bot in running_bots:
            try:
                result = await self.soft_kill_bot(
                    db=db,
                    bot_id=bot.id,
                    trigger=trigger,
                    reason=reason,
                    actor=actor,
                )
                results[bot.name] = result
            except Exception as e:
                logger.error("Soft kill all — failed for bot %s: %s", bot.name, e)
                results[bot.name] = {"error": str(e)}

        db.add(AuditLog(
            action="kill_switch.soft_all",
            actor=actor,
            target_type="all_bots",
            target_id=None,
            target_name=None,
            details=json.dumps({
                "trigger": trigger,
                "reason": reason,
                "bot_count": len(running_bots),
            }),
        ))

        return results
