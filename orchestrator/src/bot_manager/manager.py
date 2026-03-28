"""
Bot Manager — manages FreqTrade bot Docker containers.

Each bot = 1 FT Docker container = 1 strategy.
We create/start/stop containers via Docker API.
We talk to each bot via FT REST API (ft_client.py).

This is the ONLY place we interact with Docker.
Trade data comes from FT API, never from us.
"""
import asyncio
import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..ft_client import FTClient, FTClientError
from ..models.bot_instance import BotInstance, BotStatus
from ..models.audit_log import AuditLog

logger = logging.getLogger(__name__)


class BotManager:
    """
    Manages N FreqTrade bot containers.
    Each bot gets its own FTClient for REST API communication.
    """

    def __init__(self):
        self._clients: dict[int, FTClient] = {}
        self._clients_lock = asyncio.Lock()

    async def get_client(self, bot: BotInstance) -> FTClient:
        """Get or create FTClient for a bot. Thread-safe via lock."""
        async with self._clients_lock:
            if bot.id not in self._clients:
                # Build full URL including port
                url = bot.api_url.rstrip("/")
                if bot.api_port:
                    url = f"{url}:{bot.api_port}"
                self._clients[bot.id] = FTClient(
                    api_url=url,
                    username=bot.api_username,
                    password=bot.api_password,
                )
            return self._clients[bot.id]

    async def remove_client(self, bot_id: int):
        """Remove cached client and close HTTP connection."""
        async with self._clients_lock:
            client = self._clients.pop(bot_id, None)
        if client:
            await client.close()

    # ── Bot CRUD ──────────────────────────────────────────────

    async def register_bot(
        self,
        db: AsyncSession,
        name: str,
        api_url: str,
        api_port: int,
        api_username: str,
        api_password: str,
        strategy_name: str | None = None,
        is_dry_run: bool = True,
        description: str | None = None,
        container_id: str | None = None,
        docker_image: str = "freqtradeorg/freqtrade:stable_freqai",
    ) -> BotInstance:
        """
        Register an existing FT bot container with the orchestrator.
        Does NOT create a Docker container — that's done separately or already exists.
        """
        # M5: duplicate bot name check
        existing = await db.execute(
            select(BotInstance).where(
                BotInstance.name == name,
                BotInstance.is_deleted.is_(False),
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Bot with name '{name}' already exists")

        bot = BotInstance(
            name=name,
            api_url=api_url,
            api_port=api_port,
            api_username=api_username,
            api_password=api_password,
            strategy_name=strategy_name,
            is_dry_run=is_dry_run,
            status=BotStatus.STOPPED,
            description=description,
            container_id=container_id,
            docker_image=docker_image,
        )
        db.add(bot)
        await db.flush()

        # Audit
        db.add(AuditLog(
            action="bot.register",
            actor="user",
            target_type="bot",
            target_id=bot.id,
            target_name=name,
            details=json.dumps({"api_url": api_url, "strategy": strategy_name}),
        ))

        return bot

    async def get_bot(self, db: AsyncSession, bot_id: int) -> BotInstance | None:
        """Get bot by ID (excludes soft-deleted)."""
        result = await db.execute(
            select(BotInstance).where(
                BotInstance.id == bot_id,
                BotInstance.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def get_all_bots(self, db: AsyncSession) -> list[BotInstance]:
        """Get all active (non-deleted) bots."""
        result = await db.execute(
            select(BotInstance).where(BotInstance.is_deleted.is_(False))
        )
        return list(result.scalars().all())

    async def delete_bot(self, db: AsyncSession, bot_id: int) -> BotInstance | None:
        """Soft-delete a bot (safety rule #7 — never hard delete)."""
        bot = await self.get_bot(db, bot_id)
        if not bot:
            return None

        # L12: stop running bot before soft-deleting
        if bot.status == BotStatus.RUNNING:
            try:
                client = await self.get_client(bot)
                await client.stop()
                logger.info("Stopped running bot %s before deletion", bot.name)
            except FTClientError as e:
                logger.warning("Failed to stop bot %s before deletion: %s", bot.name, e)

        bot.is_deleted = True
        bot.status = BotStatus.STOPPED
        await self.remove_client(bot_id)

        db.add(AuditLog(
            action="bot.delete",
            actor="user",
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
        ))

        return bot

    # ── Bot Control (via FT REST API) ─────────────────────────

    async def start_bot(self, db: AsyncSession, bot_id: int) -> dict:
        """
        POST /api/v1/start on the FT bot.
        Does NOT create a container — the container must already be running.
        """
        bot = await self.get_bot(db, bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")

        client = await self.get_client(bot)
        result = await client.start()

        bot.status = BotStatus.RUNNING
        bot.consecutive_failures = 0
        bot.is_healthy = True

        db.add(AuditLog(
            action="bot.start",
            actor="user",
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
        ))

        return result

    async def stop_bot(self, db: AsyncSession, bot_id: int) -> dict:
        """
        POST /api/v1/stop on the FT bot (Soft Kill for single bot).
        Stops trading but keeps positions open.
        """
        bot = await self.get_bot(db, bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")

        client = await self.get_client(bot)
        result = await client.stop()

        bot.status = BotStatus.STOPPED

        db.add(AuditLog(
            action="bot.stop",
            actor="user",
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
        ))

        return result

    async def reload_bot_config(self, db: AsyncSession, bot_id: int) -> dict:
        """POST /api/v1/reload_config — reload FT config."""
        bot = await self.get_bot(db, bot_id)
        if not bot:
            raise ValueError(f"Bot {bot_id} not found")

        client = await self.get_client(bot)
        result = await client.reload_config()

        db.add(AuditLog(
            action="bot.reload_config",
            actor="user",
            target_type="bot",
            target_id=bot.id,
            target_name=bot.name,
        ))

        return result

    # ── FT API Passthrough (read-only) ────────────────────────
    # These just proxy FT API calls — no orchestrator logic needed.

    async def get_bot_status(self, bot: BotInstance) -> list:
        """GET /api/v1/status — open trades for this bot."""
        client = await self.get_client(bot)
        return await client.status()

    async def get_bot_profit(self, bot: BotInstance) -> dict:
        """GET /api/v1/profit — profit stats for this bot."""
        client = await self.get_client(bot)
        return await client.profit()

    async def get_bot_balance(self, bot: BotInstance) -> dict:
        """GET /api/v1/balance — account balance for this bot."""
        client = await self.get_client(bot)
        return await client.balance()

    async def get_bot_trades(self, bot: BotInstance, limit: int = 50, offset: int = 0) -> dict:
        """GET /api/v1/trades — trade history for this bot."""
        client = await self.get_client(bot)
        return await client.trades(limit=limit, offset=offset)

    async def get_bot_daily(self, bot: BotInstance, days: int = 30) -> dict:
        """GET /api/v1/daily — daily profit for this bot."""
        client = await self.get_client(bot)
        return await client.daily(days=days)

    async def get_bot_performance(self, bot: BotInstance) -> list:
        """GET /api/v1/performance — per-pair performance."""
        client = await self.get_client(bot)
        return await client.performance()

    async def get_bot_config(self, bot: BotInstance) -> dict:
        """GET /api/v1/show_config — current FT config."""
        client = await self.get_client(bot)
        return await client.show_config()

    async def get_bot_health(self, bot: BotInstance) -> dict:
        """GET /api/v1/health — bot health status."""
        client = await self.get_client(bot)
        return await client.health()

    async def get_bot_logs(self, bot: BotInstance, limit: int = 50) -> dict:
        """GET /api/v1/logs — bot logs."""
        client = await self.get_client(bot)
        return await client.logs(limit=limit)

    async def ping_bot(self, bot: BotInstance) -> bool:
        """GET /api/v1/ping — returns True if bot responds."""
        client = await self.get_client(bot)
        try:
            await client.ping()
            return True
        except FTClientError:
            return False
