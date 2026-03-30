"""
AI Validation Scheduler — polling loop that drives the full validation pipeline.

Runs on configurable interval (default: 60s).
Full cycle per bot: detect new signals → build context → query LLMs → score → store.
Enforces daily cost limit and hourly validation limit (spec §13, §14).
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any

from sqlalchemy import select

from .collector import SignalCollector
from .context_builder import ContextBuilder
from .llm_gateway import LLMGateway
from .models import AIValidation
from .scorer import ScoreCalculator
from .tracker import AccuracyTracker
from .telegram_notifier import send_telegram_alert, format_strong_disagree_alert
from ..config import settings
from ..crypto import decrypt
from ..database import async_session
from ..models.bot_instance import BotInstance, BotStatus

logger = logging.getLogger(__name__)


class AIValidationScheduler:
    """
    Polls all running bots for new FreqAI signals and runs the full
    AI validation pipeline when new trades are detected.

    Pipeline per new trade:
    1. detect_new_signals (collector)
    2. collect_context (collector)
    3. build_prompt (context builder)
    4. validate_signal (LLM gateway — Claude + Grok in parallel)
    5. calculate scores (scorer)
    6. store in DB (ai_validations)
    7. alert on strong_disagree (Telegram / log)
    8. enforce cost limits
    """

    def __init__(
        self,
        gateway: LLMGateway,
        scorer: ScoreCalculator,
        tracker: AccuracyTracker,
        interval_seconds: int = 60,
        max_daily_cost_usd: float = 5.00,
        max_validations_per_hour: int = 30,
    ) -> None:
        self.gateway = gateway
        self.scorer = scorer
        self.tracker = tracker
        self.interval = interval_seconds
        self.max_daily_cost = max_daily_cost_usd
        self.max_per_hour = max_validations_per_hour

        # Per-bot collector + context builder instances
        self._collectors: dict[int, SignalCollector] = {}
        self._context_builder = ContextBuilder()

        # Cost / rate tracking (reset daily/hourly)
        self._daily_cost: float = 0.0
        self._daily_cost_reset: datetime = self._next_midnight_utc()
        self._hourly_counts: dict[int, list[datetime]] = defaultdict(list)  # bot_id → timestamps

        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the polling loop as a background task."""
        if self._running:
            logger.warning("AIValidationScheduler already running")
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info(
            "AIValidationScheduler started (interval=%ds, max_cost=$%.2f/day, max=%d/hour)",
            self.interval, self.max_daily_cost, self.max_per_hour,
        )

    async def stop(self) -> None:
        """Gracefully stop the polling loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("AIValidationScheduler stopped")

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._check_all_bots()
            except Exception as exc:
                logger.error("AI validation cycle failed: %s", exc, exc_info=True)
            await asyncio.sleep(self.interval)

    async def validate_bot(self, bot_id: int) -> None:
        """Manually trigger validation for a specific bot (called by validate-now endpoint)."""
        async with async_session() as db:
            result = await db.execute(
                select(BotInstance).where(
                    BotInstance.id == bot_id,
                    BotInstance.is_deleted.is_(False),
                )
            )
            bot = result.scalar_one_or_none()

        if not bot:
            logger.error("Manual validation: bot %d not found", bot_id)
            return

        logger.info("Manual validation triggered for bot %d (%s)", bot_id, bot.name)
        try:
            await self._process_bot(bot)
        except Exception as exc:
            logger.error("Manual validation failed for bot %d: %s", bot_id, exc, exc_info=True)

    async def _check_all_bots(self) -> None:
        """Run one validation cycle across all running bots."""
        # Reset daily cost counter at midnight UTC
        now_utc = datetime.now(timezone.utc)
        if now_utc >= self._daily_cost_reset:
            self._daily_cost = 0.0
            self._daily_cost_reset = self._next_midnight_utc()
            logger.info("Daily AI cost counter reset")

        # Check daily cost gate
        if self._daily_cost >= self.max_daily_cost:
            logger.warning(
                "Daily AI cost limit reached ($%.2f/$%.2f). "
                "Skipping validation until midnight UTC.",
                self._daily_cost, self.max_daily_cost,
            )
            return

        async with async_session() as db:
            # Get all running bots (not deleted)
            result = await db.execute(
                select(BotInstance).where(
                    BotInstance.status == BotStatus.RUNNING,
                    BotInstance.is_deleted.is_(False),
                )
            )
            bots = result.scalars().all()

        for bot in bots:
            try:
                await self._process_bot(bot)
            except Exception as exc:
                logger.error("Validation failed for bot %d (%s): %s", bot.id, bot.name, exc)

    async def _process_bot(self, bot: BotInstance) -> None:
        """Run validation cycle for one bot."""
        # Hourly rate limit per bot
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=1)
        recent_times = [t for t in self._hourly_counts[bot.id] if t > cutoff]
        self._hourly_counts[bot.id] = recent_times

        if len(recent_times) >= self.max_per_hour:
            logger.warning(
                "Hourly validation limit (%d) reached for bot %d. Skipping.",
                self.max_per_hour, bot.id,
            )
            return

        # Get or create collector for this bot
        if bot.id not in self._collectors:
            from ..ft_client import FTClient
            ft_url = f"{bot.api_url.rstrip('/')}:{bot.api_port}" if bot.api_port else bot.api_url
            ft = FTClient(ft_url, bot.api_username, decrypt(bot.api_password) or "")
            self._collectors[bot.id] = SignalCollector(ft)

        collector = self._collectors[bot.id]
        new_trades = await collector.detect_new_signals(bot.id)

        timeframe = getattr(bot, "timeframe", None) or "1h"

        for trade in new_trades:
            if self._daily_cost >= self.max_daily_cost:
                logger.warning("Daily cost limit hit mid-cycle — stopping.")
                return

            try:
                cost = await self._validate_trade(collector, bot, trade, timeframe)
                self._daily_cost += cost
                self._hourly_counts[bot.id].append(now)
            except Exception as exc:
                logger.error(
                    "Failed to validate trade %s for bot %d: %s",
                    trade.get("trade_id"), bot.id, exc,
                )

    async def _validate_trade(
        self,
        collector: SignalCollector,
        bot: Any,
        trade: dict[str, Any],
        timeframe: str,
    ) -> float:
        """
        Full pipeline for one trade. Returns the API cost incurred (USD).
        """
        pair = trade.get("pair", "BTC/USDT:USDT")
        trade_id = trade.get("trade_id")

        logger.info("Validating trade %s (%s) for bot %d", trade_id, pair, bot.id)

        # 1. Collect market context
        context = await collector.collect_context(bot.id, pair, timeframe)

        # 2. Build prompt
        prompt = self._context_builder.build_prompt(trade, context)

        # 3. Query Claude + Grok in parallel
        responses = await self.gateway.validate_signal(prompt)

        # 4. Parse responses
        claude_response = responses.get("claude", {})
        grok_response = responses.get("grok", {})

        # 5. Calculate scores
        scores = self.scorer.calculate(trade, claude_response, grok_response)

        # 6. Store in DB
        async with async_session() as db:
            validation = AIValidation(
                bot_id=bot.id,
                ft_trade_id=trade_id,
                pair=pair,
                freqai_direction=scores["freqai_direction"],
                freqai_confidence=scores["freqai_confidence"],
                claude_direction=scores["claude_direction"],
                claude_confidence=scores["claude_confidence"],
                claude_reasoning=scores.get("claude_reasoning"),
                claude_risk_factors=scores.get("claude_risk_factors", []),
                claude_sentiment=scores.get("claude_sentiment"),
                claude_regime=scores.get("claude_regime"),
                grok_direction=scores["grok_direction"],
                grok_confidence=scores["grok_confidence"],
                grok_reasoning=scores.get("grok_reasoning"),
                grok_risk_factors=scores.get("grok_risk_factors", []),
                grok_sentiment=scores.get("grok_sentiment"),
                grok_regime=scores.get("grok_regime"),
                combined_confidence=scores["combined_confidence"],
                agreement_pct=scores["agreement_pct"],
                all_agree=scores["all_agree"],
                strong_disagree=scores["strong_disagree"],
                claude_tokens_used=responses.get("claude_tokens", 0),
                grok_tokens_used=responses.get("grok_tokens", 0),
                total_cost_usd=responses.get("total_cost_usd", 0.0),
            )
            db.add(validation)
            await db.commit()

        cost = responses.get("total_cost_usd", 0.0)

        # 7. Alert on strong disagreement
        if scores["strong_disagree"]:
            logger.warning(
                "⚠️  STRONG DISAGREE: Bot %d | Trade %s | %s | "
                "FreqAI=%s, Claude=%s, Grok=%s | combined=%.1f%%",
                bot.id, trade_id, pair,
                scores["freqai_direction"],
                scores["claude_direction"],
                scores["grok_direction"],
                scores["combined_confidence"] * 100,
            )
            # Phase 14: Send Telegram notification on strong disagree
            if getattr(settings, "ai_telegram_notify_disagree", False):
                tg_message = format_strong_disagree_alert(
                    bot_id=bot.id,
                    bot_name=getattr(bot, "name", f"Bot-{bot.id}"),
                    trade_id=trade_id,
                    pair=pair,
                    freqai_dir=scores["freqai_direction"],
                    claude_dir=scores["claude_direction"],
                    grok_dir=scores["grok_direction"],
                    combined_conf=scores["combined_confidence"],
                    claude_reasoning=scores.get("claude_reasoning"),
                    grok_reasoning=scores.get("grok_reasoning"),
                )
                # Fire-and-forget — do NOT await, don't block validation pipeline
                asyncio.create_task(send_telegram_alert(tg_message))

        logger.info(
            "Validation stored: trade=%s | combined=%.1f%% | agree=%s | cost=$%.4f",
            trade_id, scores["combined_confidence"] * 100,
            "ALL" if scores["all_agree"] else "PARTIAL",
            cost,
        )
        return cost

    @staticmethod
    def _next_midnight_utc() -> datetime:
        """Return next midnight UTC."""
        now = datetime.now(timezone.utc)
        return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
