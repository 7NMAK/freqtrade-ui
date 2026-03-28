"""
AI Hyperopt API endpoints.

Routes:
    POST /api/ai/hyperopt/pre-analyze
    POST /api/ai/hyperopt/post-analyze
    GET  /api/ai/hyperopt/analyses
    GET  /api/ai/hyperopt/analyses/{id}
    POST /api/ai/hyperopt/outcome
    GET  /api/ai/hyperopt/comparison/{analysis_id}
    GET  /api/ai/hyperopt/comparison/history
    GET  /api/ai/hyperopt/comparison/stats
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import require_auth
from ..config import settings
from ..database import get_db
from ..ai_validator.models import AIHyperoptAnalysis, AIHyperoptOutcome

router = APIRouter()


# ── Request / Response schemas ─────────────────────────────────────────────────

class PreAnalyzeRequest(BaseModel):
    bot_id: int
    strategy_name: str
    pair: str
    timeframe: str


class PostAnalyzeRequest(BaseModel):
    bot_id: int
    strategy_name: str
    pair: str
    timeframe: str
    results: list[dict[str, Any]]          # Top 10 hyperopt results
    epochs_run: int = 0
    loss_function_used: str = "SharpeHyperOptLossDaily"
    timerange: str = ""
    baseline_profit: float | None = None
    baseline_trades: int | None = None
    baseline_sharpe: float | None = None
    baseline_max_drawdown: float | None = None


class OutcomeRequest(BaseModel):
    analysis_id: int
    used_ai_suggestion: bool
    final_params: dict[str, Any] | None = None
    paper_trade_result: float | None = None
    user_feedback: str | None = None       # 'helpful' | 'neutral' | 'wrong'


class HyperoptAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bot_id: int
    strategy_name: str
    pair: str
    timeframe: str
    analysis_type: str
    suggested_loss_function: str | None
    suggested_sampler: str | None
    suggested_epochs: int | None
    suggested_param_ranges: Any
    suggested_spaces: Any
    recommended_result_index: int | None
    overfitting_scores: Any
    claude_response: dict | None = None
    grok_response: dict | None = None
    claude_confidence: float | None
    grok_confidence: float | None
    total_cost_usd: float
    created_at: datetime
    baseline_profit: float | None
    baseline_trades: int | None
    baseline_sharpe: float | None
    baseline_max_drawdown: float | None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/pre-analyze")
async def pre_analyze(
    body: PreAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """
    AI analysis BEFORE running hyperopt.
    Reads strategy file, fetches market context, queries Claude + Grok.
    Returns: loss function, sampler, epochs, and parameter range suggestions.
    """
    if not settings.ai_validation_enabled and not settings.ai_hyperopt_enabled:
        raise HTTPException(
            status_code=422,
            detail="AI Hyperopt is disabled. Set ORCH_AI_HYPEROPT_ENABLED=true",
        )

    from ..ai_validator.hyperopt_advisor import HyperoptAdvisor
    from ..ai_validator.llm_gateway import LLMGateway
    from ..ft_client import FTClient
    from ..models.bot_instance import BotInstance

    # Get bot from DB
    result = await db.execute(
        select(BotInstance).where(
            BotInstance.id == body.bot_id,
            BotInstance.is_deleted.is_(False),
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot {body.bot_id} not found")

    ft_url = f"{bot.api_url.rstrip('/')}:{bot.api_port}" if bot.api_port else bot.api_url
    ft = FTClient(ft_url, bot.api_username, bot.api_password)
    gateway = LLMGateway()
    advisor = HyperoptAdvisor(gateway=gateway, ft_client=ft, db_session=db)

    try:
        result_data = await advisor.pre_analyze(
            bot_id=body.bot_id,
            strategy_name=body.strategy_name,
            pair=body.pair,
            timeframe=body.timeframe,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    return result_data


@router.post("/post-analyze")
async def post_analyze(
    body: PostAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """
    AI analysis AFTER hyperopt completes.
    Sends top N results to Claude + Grok for overfitting detection.
    Returns: overfitting scores, recommended result, reasoning.
    """
    if not settings.ai_hyperopt_enabled:
        raise HTTPException(
            status_code=422,
            detail="AI Hyperopt is disabled. Set ORCH_AI_HYPEROPT_ENABLED=true",
        )

    from ..ai_validator.hyperopt_advisor import HyperoptAdvisor
    from ..ai_validator.llm_gateway import LLMGateway
    from ..ft_client import FTClient
    from ..models.bot_instance import BotInstance

    result = await db.execute(
        select(BotInstance).where(
            BotInstance.id == body.bot_id,
            BotInstance.is_deleted.is_(False),
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail=f"Bot {body.bot_id} not found")

    ft_url = f"{bot.api_url.rstrip('/')}:{bot.api_port}" if bot.api_port else bot.api_url
    ft = FTClient(ft_url, bot.api_username, bot.api_password)
    gateway = LLMGateway()
    advisor = HyperoptAdvisor(gateway=gateway, ft_client=ft, db_session=db)

    try:
        result_data = await advisor.post_analyze(
            bot_id=body.bot_id,
            strategy_name=body.strategy_name,
            pair=body.pair,
            timeframe=body.timeframe,
            hyperopt_results=body.results,
            epochs_run=body.epochs_run,
            loss_function_used=body.loss_function_used,
            timerange=body.timerange,
            baseline_profit=body.baseline_profit,
            baseline_trades=body.baseline_trades,
            baseline_sharpe=body.baseline_sharpe,
            baseline_max_drawdown=body.baseline_max_drawdown,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    return result_data


@router.get("/analyses", response_model=list[HyperoptAnalysisOut])
async def list_analyses(
    bot_id: int | None = Query(None),
    analysis_type: str | None = Query(None),  # 'pre_hyperopt' | 'post_hyperopt'
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> list[HyperoptAnalysisOut]:
    """List past AI hyperopt analyses."""
    q = select(AIHyperoptAnalysis).order_by(AIHyperoptAnalysis.created_at.desc())

    if bot_id is not None:
        q = q.where(AIHyperoptAnalysis.bot_id == bot_id)
    if analysis_type is not None:
        q = q.where(AIHyperoptAnalysis.analysis_type == analysis_type)

    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return [HyperoptAnalysisOut.model_validate(a) for a in result.scalars().all()]


@router.get("/analyses/{analysis_id}", response_model=HyperoptAnalysisOut)
async def get_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> HyperoptAnalysisOut:
    """Get a specific hyperopt analysis with full LLM reasoning."""
    result = await db.execute(
        select(AIHyperoptAnalysis).where(AIHyperoptAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found")
    return HyperoptAnalysisOut.model_validate(analysis)


@router.post("/outcome")
async def record_outcome(
    body: OutcomeRequest,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """
    Record whether user followed AI hyperopt suggestion and what happened.
    Used to measure and improve AI advice quality over time.
    """
    # Validate analysis exists
    result = await db.execute(
        select(AIHyperoptAnalysis).where(AIHyperoptAnalysis.id == body.analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail=f"Analysis {body.analysis_id} not found")

    # Validate user_feedback value
    if body.user_feedback and body.user_feedback not in ("helpful", "neutral", "wrong"):
        raise HTTPException(
            status_code=422,
            detail="user_feedback must be 'helpful', 'neutral', or 'wrong'",
        )

    outcome = AIHyperoptOutcome(
        analysis_id=body.analysis_id,
        used_ai_suggestion=body.used_ai_suggestion,
        final_params=body.final_params,
        paper_trade_result=body.paper_trade_result,
        user_feedback=body.user_feedback,
    )
    db.add(outcome)
    await db.commit()
    await db.refresh(outcome)

    return {"status": "recorded", "outcome_id": outcome.id}


@router.get("/comparison/{analysis_id}")
async def get_comparison(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """
    Get 4-way comparison for a post-hyperopt analysis:
    baseline + hyperopt results + Claude analysis + Grok analysis.
    Spec §19.12, §19.19.
    """
    result = await db.execute(
        select(AIHyperoptAnalysis).where(
            AIHyperoptAnalysis.id == analysis_id,
            AIHyperoptAnalysis.analysis_type == "post_hyperopt",
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"Post-hyperopt analysis {analysis_id} not found",
        )

    return {
        "analysis_id": analysis_id,
        "strategy_name": analysis.strategy_name,
        "pair": analysis.pair,
        "timeframe": analysis.timeframe,
        "baseline": {
            "profit": analysis.baseline_profit,
            "trades": analysis.baseline_trades,
            "sharpe": analysis.baseline_sharpe,
            "max_drawdown": analysis.baseline_max_drawdown,
        },
        "recommended_result_index": analysis.recommended_result_index,
        "overfitting_scores": analysis.overfitting_scores or [],
        "claude_analysis": analysis.claude_response,
        "grok_analysis": analysis.grok_response,
        "claude_confidence": analysis.claude_confidence,
        "grok_confidence": analysis.grok_confidence,
        "advisors_agree": (
            analysis.claude_response.get("recommended_result_index")
            == analysis.grok_response.get("recommended_result_index")
            if analysis.claude_response and analysis.grok_response
            else None
        ),
    }


@router.get("/comparison/history")
async def get_comparison_history(
    bot_id: int | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """List recent post-hyperopt comparisons."""
    q = (
        select(AIHyperoptAnalysis)
        .where(AIHyperoptAnalysis.analysis_type == "post_hyperopt")
        .order_by(AIHyperoptAnalysis.created_at.desc())
    )
    if bot_id is not None:
        q = q.where(AIHyperoptAnalysis.bot_id == bot_id)
    q = q.limit(limit)

    result = await db.execute(q)
    analyses = result.scalars().all()

    return {
        "total": len(analyses),
        "comparisons": [
            {
                "id": a.id,
                "strategy_name": a.strategy_name,
                "pair": a.pair,
                "timeframe": a.timeframe,
                "recommended_result_index": a.recommended_result_index,
                "claude_confidence": a.claude_confidence,
                "grok_confidence": a.grok_confidence,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in analyses
        ],
    }


@router.get("/comparison/stats")
async def get_comparison_stats(
    db: AsyncSession = Depends(get_db),
    _: Any = Depends(require_auth),
) -> dict[str, Any]:
    """Aggregate stats: follow AI vs ignore AI outcome comparison."""
    result = await db.execute(
        select(
            AIHyperoptOutcome.used_ai_suggestion,
            func.count(AIHyperoptOutcome.id).label("count"),
            func.avg(AIHyperoptOutcome.paper_trade_result).label("avg_paper"),
            func.avg(AIHyperoptOutcome.live_trade_result).label("avg_live"),
        ).group_by(AIHyperoptOutcome.used_ai_suggestion)
    )
    rows = result.all()

    stats: dict[str, Any] = {
        "followed_ai": {"count": 0, "avg_paper_result": None, "avg_live_result": None},
        "ignored_ai": {"count": 0, "avg_paper_result": None, "avg_live_result": None},
    }

    for row in rows:
        key = "followed_ai" if row.used_ai_suggestion else "ignored_ai"
        stats[key] = {
            "count": row.count,
            "avg_paper_result": round(float(row.avg_paper), 4) if row.avg_paper else None,
            "avg_live_result": round(float(row.avg_live), 4) if row.avg_live else None,
        }

    return stats
