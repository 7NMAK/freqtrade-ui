"""
AI Validation API endpoints.

Routes:
    GET  /api/ai/validations
    GET  /api/ai/validations/{ft_trade_id}
    GET  /api/ai/accuracy
    GET  /api/ai/accuracy/history
    GET  /api/ai/agreement-rate
    GET  /api/ai/cost
    POST /api/ai/validate-now/{bot_id}
    GET  /api/ai/config
    PATCH /api/ai/config
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..config import settings
from ..database import get_db
from ..ai_validator.models import AIValidation, AIAccuracy
from ..ai_validator.tracker import AccuracyTracker

router = APIRouter()


# ── Response schemas ───────────────────────────────────────────────────────────

class AIValidationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bot_id: int
    ft_trade_id: int
    pair: str
    created_at: datetime
    freqai_direction: str
    freqai_confidence: float
    claude_direction: str
    claude_confidence: float
    claude_reasoning: str | None
    claude_risk_factors: list[Any]
    claude_sentiment: str | None
    claude_regime: str | None
    grok_direction: str
    grok_confidence: float
    grok_reasoning: str | None
    grok_risk_factors: list[Any]
    grok_sentiment: str | None
    grok_regime: str | None
    combined_confidence: float
    agreement_pct: float
    all_agree: bool
    strong_disagree: bool
    claude_tokens_used: int
    grok_tokens_used: int
    total_cost_usd: float


class AIConfigPatch(BaseModel):
    """Fields that can be patched via PATCH /api/ai/config."""
    enabled: bool | None = None
    interval_seconds: int | None = None
    claude_model: str | None = None
    grok_model: str | None = None
    weight_freqai: float | None = None
    weight_claude: float | None = None
    weight_grok: float | None = None
    max_daily_cost_usd: float | None = None
    max_validations_per_hour: int | None = None
    telegram_notify_disagree: bool | None = None
    hyperopt_enabled: bool | None = None
    hyperopt_auto_post_analyze: bool | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/validations", response_model=list[AIValidationOut])
async def list_validations(
    bot_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    strong_disagree_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> list[AIValidationOut]:
    """List recent AI validations, optionally filtered by bot."""
    q = select(AIValidation).order_by(AIValidation.created_at.desc())

    if bot_id is not None:
        q = q.where(AIValidation.bot_id == bot_id)
    if strong_disagree_only:
        q = q.where(AIValidation.strong_disagree.is_(True))

    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return [AIValidationOut.model_validate(v) for v in result.scalars().all()]


@router.get("/validations/{ft_trade_id}", response_model=AIValidationOut)
async def get_validation(
    ft_trade_id: int,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> AIValidationOut:
    """Get AI validation for a specific FT trade."""
    result = await db.execute(
        select(AIValidation)
        .where(AIValidation.ft_trade_id == ft_trade_id)
        .order_by(AIValidation.created_at.desc())
        .limit(1)
    )
    validation = result.scalar_one_or_none()
    if not validation:
        raise HTTPException(status_code=404, detail=f"No validation found for trade {ft_trade_id}")
    return AIValidationOut.model_validate(validation)


@router.get("/accuracy")
async def get_accuracy(
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """Accuracy stats per advisor (all time)."""
    tracker = AccuracyTracker()
    return await tracker.get_accuracy_stats(db)


@router.get("/accuracy/history")
async def get_accuracy_history(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """Rolling accuracy per advisor over time (for chart, grouped by day)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.date_trunc("day", AIAccuracy.closed_at).label("day"),
            AIAccuracy.advisor,
            func.count(AIAccuracy.id).label("total"),
            func.sum(func.cast(AIAccuracy.was_correct, sa.Integer)).label("correct"),
        )
        .where(AIAccuracy.closed_at >= cutoff)
        .group_by(func.date_trunc("day", AIAccuracy.closed_at), AIAccuracy.advisor)
        .order_by(func.date_trunc("day", AIAccuracy.closed_at))
    )
    rows = result.all()

    # Structure: {day_str: {advisor: pct}}
    history: dict[str, dict[str, float]] = {}
    for row in rows:
        day_str = row.day.strftime("%Y-%m-%d") if row.day else "unknown"
        if day_str not in history:
            history[day_str] = {}
        total = row.total or 0
        correct = int(row.correct or 0)
        history[day_str][row.advisor] = round((correct / total * 100) if total else 0.0, 1)

    return {"days": days, "history": history}


@router.get("/agreement-rate")
async def get_agreement_rate(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """How often all 3 agree / 2 agree / strong disagree."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.count(AIValidation.id).label("total"),
            func.sum(func.cast(AIValidation.all_agree, sa.Integer)).label("all_agree"),
            func.sum(func.cast(AIValidation.strong_disagree, sa.Integer)).label("strong_disagree"),
        ).where(AIValidation.created_at >= cutoff)
    )
    row = result.one()

    total = row.total or 0
    all_agree_n = int(row.all_agree or 0)
    strong_disagree_n = int(row.strong_disagree or 0)
    partial_agree_n = max(0, total - all_agree_n - strong_disagree_n)

    return {
        "days": days,
        "total_validations": total,
        "all_agree": all_agree_n,
        "partial_agree": partial_agree_n,
        "strong_disagree": strong_disagree_n,
        "all_agree_pct": round((all_agree_n / total * 100) if total else 0.0, 1),
        "strong_disagree_pct": round((strong_disagree_n / total * 100) if total else 0.0, 1),
    }


@router.get("/cost")
async def get_cost(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """API cost breakdown — tokens used and USD spent."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.count(AIValidation.id).label("total_validations"),
            func.sum(AIValidation.claude_tokens_used).label("claude_tokens"),
            func.sum(AIValidation.grok_tokens_used).label("grok_tokens"),
            func.sum(AIValidation.total_cost_usd).label("total_cost"),
        ).where(AIValidation.created_at >= cutoff)
    )
    row = result.one()

    total_cost = float(row.total_cost or 0.0)
    total_validations = int(row.total_validations or 0)

    return {
        "days": days,
        "total_validations": total_validations,
        "claude_tokens_used": int(row.claude_tokens or 0),
        "grok_tokens_used": int(row.grok_tokens or 0),
        "total_cost_usd": round(total_cost, 4),
        "avg_cost_per_validation": round(
            (total_cost / total_validations) if total_validations else 0.0, 4
        ),
        "projected_monthly_usd": round(
            (total_cost / days * 30) if days > 0 else 0.0, 2
        ),
    }


@router.post("/validate-now/{bot_id}")
async def validate_now(
    bot_id: int,
    request: Request,
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """
    Manually trigger AI validation for all open trades on a bot.
    Returns immediately — validation runs in background.
    """
    scheduler = getattr(request.app.state, "ai_scheduler", None)

    if scheduler is None:
        raise HTTPException(
            status_code=422,
            detail="AI validation scheduler is not running. Enable it via ORCH_AI_VALIDATION_ENABLED=true",
        )

    async def _run() -> None:
        try:
            await scheduler.validate_bot(bot_id)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("Manual validation error for bot %d: %s", bot_id, exc)

    asyncio.create_task(_run())

    return {
        "status": "triggered",
        "bot_id": bot_id,
        "message": "Validation started in background",
    }


@router.get("/config")
async def get_ai_config(
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """Return current AI validator configuration (API key masked)."""
    return {
        "enabled": settings.ai_validation_enabled,
        "interval_seconds": settings.ai_validation_interval,
        "claude_model": settings.ai_claude_model,
        "claude_fallback": settings.ai_claude_fallback,
        "grok_model": settings.ai_grok_model,
        "grok_fallback": settings.ai_grok_fallback,
        "weight_freqai": settings.ai_weight_freqai,
        "weight_claude": settings.ai_weight_claude,
        "weight_grok": settings.ai_weight_grok,
        "max_daily_cost_usd": settings.ai_max_daily_cost_usd,
        "max_validations_per_hour": settings.ai_max_validations_per_hour,
        "telegram_notify_disagree": settings.ai_telegram_notify_disagree,
        "hyperopt_enabled": settings.ai_hyperopt_enabled,
        "hyperopt_auto_post_analyze": settings.ai_hyperopt_auto_post_analyze,
        # API key is NEVER returned — just whether it's set
        "api_key_configured": bool(settings.ai_openrouter_api_key),
    }


@router.patch("/config")
async def patch_ai_config(
    body: AIConfigPatch,
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """
    Update AI validator configuration at runtime.

    Note: Changes are applied to the in-memory Settings object.
    They will NOT persist across restarts unless the .env file is updated.
    For persistent changes, update ORCH_AI_* vars in .env.
    """
    patched: list[str] = []

    if body.enabled is not None:
        settings.ai_validation_enabled = body.enabled
        patched.append("enabled")

    if body.interval_seconds is not None:
        settings.ai_validation_interval = body.interval_seconds
        patched.append("interval_seconds")

    if body.claude_model is not None:
        settings.ai_claude_model = body.claude_model
        patched.append("claude_model")

    if body.grok_model is not None:
        settings.ai_grok_model = body.grok_model
        patched.append("grok_model")

    if body.max_daily_cost_usd is not None:
        if body.max_daily_cost_usd <= 0:
            raise HTTPException(status_code=422, detail="max_daily_cost_usd must be > 0")
        settings.ai_max_daily_cost_usd = body.max_daily_cost_usd
        patched.append("max_daily_cost_usd")

    if body.max_validations_per_hour is not None:
        settings.ai_max_validations_per_hour = body.max_validations_per_hour
        patched.append("max_validations_per_hour")

    if body.telegram_notify_disagree is not None:
        settings.ai_telegram_notify_disagree = body.telegram_notify_disagree
        patched.append("telegram_notify_disagree")

    if body.hyperopt_enabled is not None:
        settings.ai_hyperopt_enabled = body.hyperopt_enabled
        patched.append("hyperopt_enabled")

    if body.hyperopt_auto_post_analyze is not None:
        settings.ai_hyperopt_auto_post_analyze = body.hyperopt_auto_post_analyze
        patched.append("hyperopt_auto_post_analyze")

    # Weights — validate sum = 1.0 before applying
    if any(v is not None for v in [body.weight_freqai, body.weight_claude, body.weight_grok]):
        new_freqai = body.weight_freqai if body.weight_freqai is not None else settings.ai_weight_freqai
        new_claude = body.weight_claude if body.weight_claude is not None else settings.ai_weight_claude
        new_grok = body.weight_grok if body.weight_grok is not None else settings.ai_weight_grok

        total = new_freqai + new_claude + new_grok
        if abs(total - 1.0) > 0.001:
            raise HTTPException(
                status_code=422,
                detail=f"Weights must sum to 1.0, got {total:.3f}",
            )

        settings.ai_weight_freqai = new_freqai
        settings.ai_weight_claude = new_claude
        settings.ai_weight_grok = new_grok
        patched.extend(["weight_freqai", "weight_claude", "weight_grok"])

    return {"status": "ok", "patched": patched}


# ── Strategy Review (for Experiments AI Review tab) ────────────────────────────

# H3 FIX: In-memory rate limiter — max 10 strategy reviews per hour
_review_timestamps: list[datetime] = []
_REVIEW_MAX_PER_HOUR = 10


class StrategyReviewRequest(BaseModel):
    """Request body for AI strategy review."""
    strategy: str
    model: str = "claude"          # C2 FIX: only "claude" or "grok"
    system_prompt: str
    user_prompt: str
    scope: str = "all"


@router.post("/strategy-review")
async def strategy_review(
    body: StrategyReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Any = Depends(require_auth),
) -> dict[str, Any]:
    """
    Run AI strategy review via OpenRouter.

    Proxies the request to the configured LLM (Claude or Grok) and returns
    the parsed analysis result. Used by the Experiments → AI Review tab.

    Fixes applied:
    - C2: Only routes to "claude" or "grok" (no GPT-4o/Llama)
    - C3: Logs cost to DB for accurate cost tracking
    - H3: Rate limited to 10/hour
    - M1: Uses max_tokens=2500 for strategy reviews (larger than signal validations)
    """
    import logging
    import json
    import re
    logger = logging.getLogger(__name__)

    if not settings.ai_openrouter_api_key:
        raise HTTPException(
            status_code=422,
            detail="OpenRouter API key not configured. Set ORCH_AI_OPENROUTER_API_KEY in .env",
        )

    # H3 FIX: Rate limiting — max 10 strategy reviews per hour
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)
    _review_timestamps[:] = [t for t in _review_timestamps if t > cutoff]
    if len(_review_timestamps) >= _REVIEW_MAX_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: max {_REVIEW_MAX_PER_HOUR} strategy reviews per hour. Try again later.",
        )

    # C2 FIX: Only "claude" or "grok" — reject anything else
    advisor = body.model.lower().strip()
    if advisor not in ("claude", "grok"):
        advisor = "claude"  # safe fallback

    try:
        from ..ai_validator.llm_gateway import LLMGateway

        gateway = LLMGateway(api_key=settings.ai_openrouter_api_key)

        # M1 FIX: Strategy reviews need more output tokens than signal validations
        result = await gateway.query(
            model=advisor,
            system_prompt=body.system_prompt,
            user_content=body.user_prompt,
            max_tokens=2500,  # M1: 2500 for reviews vs 1000 for signal validations
        )

        # result is a dict with: content, tokens_used, cost_usd, model_used
        raw_content = result.get("content", {})
        cost_usd = result.get("cost_usd", 0.0)
        tokens_used = result.get("tokens_used", 0)

        # content is already parsed JSON dict from gateway
        # If it's a string (unlikely), try to parse it
        analysis = raw_content
        if isinstance(raw_content, str):
            try:
                json_match = re.search(r'\{[\s\S]*\}', raw_content)
                if json_match:
                    analysis = json.loads(json_match.group(0))
            except (json.JSONDecodeError, ValueError):
                logger.warning("AI response for strategy %s was not valid JSON", body.strategy)
                analysis = raw_content

        # C3 FIX: Log cost via raw SQL to avoid FK constraint on bot_id
        # Uses ft_trade_id=-1 as sentinel for strategy reviews
        # The /api/ai/cost endpoint sums total_cost_usd from this table
        try:
            from sqlalchemy import text
            await db.execute(text(
                "INSERT INTO ai_validations "
                "(bot_id, ft_trade_id, pair, freqai_direction, freqai_confidence, "
                "claude_direction, claude_confidence, grok_direction, grok_confidence, "
                "combined_confidence, agreement_pct, all_agree, strong_disagree, "
                "claude_tokens_used, grok_tokens_used, total_cost_usd) "
                "VALUES ("
                "(SELECT id FROM bot_instances WHERE is_deleted = false LIMIT 1), "
                ":ft_trade_id, :pair, 'neutral', 0.0, "
                ":claude_dir, 0.0, :grok_dir, 0.0, "
                "0.0, 0.0, true, false, "
                ":claude_tokens, :grok_tokens, :cost)"
            ), {
                "ft_trade_id": -1,
                "pair": f"review:{body.strategy[:40]}",
                "claude_dir": "neutral" if advisor == "claude" else "n/a",
                "grok_dir": "neutral" if advisor == "grok" else "n/a",
                "claude_tokens": tokens_used if advisor == "claude" else 0,
                "grok_tokens": tokens_used if advisor == "grok" else 0,
                "cost": cost_usd,
            })
            await db.commit()
        except Exception as db_exc:
            logger.warning("Failed to log strategy review cost: %s", db_exc)
            try:
                await db.rollback()
            except Exception:
                pass

        # H3 FIX: Record successful review for rate limiting
        _review_timestamps.append(now)

        logger.info(
            "Strategy review complete: %s | model=%s | tokens=%d | cost=$%.4f",
            body.strategy, advisor, tokens_used, cost_usd,
        )

        return {
            "analysis": analysis,
            "cost_usd": cost_usd,
            "tokens_used": tokens_used,
            "model": advisor,
            "strategy": body.strategy,
            "scope": body.scope,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Strategy review failed for %s: %s", body.strategy, exc)
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {exc}")

