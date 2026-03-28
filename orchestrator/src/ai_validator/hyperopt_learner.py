"""
Hyperopt Learner — tracks whether AI hyperopt suggestions led to better outcomes.

Computes advisor accuracy over time: follow AI vs ignore AI profit comparison.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AIHyperoptAnalysis, AIHyperoptOutcome

logger = logging.getLogger(__name__)


class HyperoptLearner:
    """
    Tracks hyperopt AI suggestion accuracy over time.
    Reads outcome data from ai_hyperopt_outcomes table.
    Does NOT modify any FreqTrade data.
    """

    async def compute_advisor_accuracy(
        self, db: AsyncSession
    ) -> dict[str, Any]:
        """
        Compute aggregate stats: follow AI vs ignore AI profit comparison.

        Returns:
            {
                "followed_ai": {
                    "count": 12,
                    "avg_paper_result": 0.042,
                    "avg_live_result": 0.038,
                    "helpful_pct": 75.0,
                },
                "ignored_ai": {
                    "count": 8,
                    "avg_paper_result": 0.021,
                    "avg_live_result": None,
                    "helpful_pct": None,
                },
                "recommendation": "Following AI suggestions has led to better results.",
            }
        """
        result = await db.execute(
            select(
                AIHyperoptOutcome.used_ai_suggestion,
                func.count(AIHyperoptOutcome.id).label("count"),
                func.avg(AIHyperoptOutcome.paper_trade_result).label("avg_paper"),
                func.avg(AIHyperoptOutcome.live_trade_result).label("avg_live"),
            ).group_by(AIHyperoptOutcome.used_ai_suggestion)
        )
        rows = result.all()

        stats: dict[str, dict[str, Any]] = {
            "followed_ai": {"count": 0, "avg_paper_result": None, "avg_live_result": None},
            "ignored_ai": {"count": 0, "avg_paper_result": None, "avg_live_result": None},
        }

        for row in rows:
            key = "followed_ai" if row.used_ai_suggestion else "ignored_ai"
            stats[key] = {
                "count": int(row.count),
                "avg_paper_result": round(float(row.avg_paper), 4) if row.avg_paper else None,
                "avg_live_result": round(float(row.avg_live), 4) if row.avg_live else None,
            }

        # Compute helpful_pct for followed_ai (how often user felt it helped)
        helpful_result = await db.execute(
            select(
                AIHyperoptOutcome.user_feedback,
                func.count(AIHyperoptOutcome.id).label("count"),
            )
            .where(
                AIHyperoptOutcome.used_ai_suggestion.is_(True),
                AIHyperoptOutcome.user_feedback != None,  # noqa: E711
            )
            .group_by(AIHyperoptOutcome.user_feedback)
        )
        feedback_rows = helpful_result.all()

        total_feedback = sum(r.count for r in feedback_rows)
        helpful_count = next(
            (r.count for r in feedback_rows if r.user_feedback == "helpful"), 0
        )
        stats["followed_ai"]["helpful_pct"] = (
            round(helpful_count / total_feedback * 100, 1) if total_feedback else None
        )

        # Generate recommendation
        followed = stats["followed_ai"]
        ignored = stats["ignored_ai"]

        if followed["count"] >= 3 and ignored["count"] >= 3:
            f_paper = followed["avg_paper_result"] or 0
            i_paper = ignored["avg_paper_result"] or 0
            if f_paper > i_paper:
                recommendation = (
                    f"Following AI suggestions shows better results "
                    f"(+{f_paper:.4f} vs +{i_paper:.4f} avg profit)."
                )
            elif i_paper > f_paper:
                recommendation = (
                    f"Ignoring AI suggestions shows better results "
                    f"(+{i_paper:.4f} vs +{f_paper:.4f} avg profit). "
                    f"Consider adjusting AI confidence thresholds."
                )
            else:
                recommendation = "Insufficient data to determine which approach is better."
        else:
            recommendation = (
                f"More data needed ({followed['count']} followed, {ignored['count']} ignored). "
                f"Run at least 3 hyperopt cycles with and without AI suggestions."
            )

        return {**stats, "recommendation": recommendation}

    async def get_suggestions_by_outcome(
        self, db: AsyncSession, limit: int = 20
    ) -> list[dict[str, Any]]:
        """
        List recent suggestions with their known outcomes.

        Returns a list of {analysis_id, strategy, pair, used_ai, profit, feedback}.
        """
        result = await db.execute(
            select(
                AIHyperoptOutcome.id,
                AIHyperoptOutcome.analysis_id,
                AIHyperoptOutcome.used_ai_suggestion,
                AIHyperoptOutcome.paper_trade_result,
                AIHyperoptOutcome.live_trade_result,
                AIHyperoptOutcome.user_feedback,
                AIHyperoptOutcome.created_at,
                AIHyperoptAnalysis.strategy_name,
                AIHyperoptAnalysis.pair,
                AIHyperoptAnalysis.timeframe,
            )
            .join(AIHyperoptAnalysis, AIHyperoptOutcome.analysis_id == AIHyperoptAnalysis.id)
            .order_by(AIHyperoptOutcome.created_at.desc())
            .limit(limit)
        )
        rows = result.all()

        return [
            {
                "outcome_id": row.id,
                "analysis_id": row.analysis_id,
                "strategy_name": row.strategy_name,
                "pair": row.pair,
                "timeframe": row.timeframe,
                "used_ai_suggestion": row.used_ai_suggestion,
                "paper_profit": row.paper_trade_result,
                "live_profit": row.live_trade_result,
                "user_feedback": row.user_feedback,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
