"""
Accuracy Tracker — records advisor outcomes when trades close.

When a trade closes, compare each advisor's prediction against the actual result.
Writes to the ai_accuracy table ONLY — never touches FT data.
"""
from __future__ import annotations

import logging
from typing import Any

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AIAccuracy, AIValidation

logger = logging.getLogger(__name__)


class AccuracyTracker:
    """
    Records prediction accuracy when a trade closes.
    This is the feedback loop that makes the AI Advisory layer improve over time.

    RULE: This class NEVER modifies FreqTrade data.
          It only reads close_profit_abs and is_short from the closed trade.
    """

    async def record_outcome(
        self,
        db: AsyncSession,
        trade_id: int,
        actual_result: dict[str, Any],
    ) -> None:
        """
        Called when a trade closes. Compares predictions vs actual.

        Args:
            db: SQLAlchemy AsyncSession.
            trade_id: FT trade_id (from closed trade webhook or polling).
            actual_result: Closed trade dict from FT API.
                           Uses: close_profit_abs (profit in quote currency),
                                 is_short (direction),
                                 exit_reason (why trade closed).
        """
        # Find the AI validation record for this trade
        result = await db.execute(
            select(AIValidation).where(AIValidation.ft_trade_id == trade_id)
        )
        validation = result.scalar_one_or_none()

        if not validation:
            logger.debug(
                "Trade %d closed but has no AI validation record — skipping accuracy tracking.",
                trade_id,
            )
            return

        # FT field names — exact, never aliased
        actual_profit: float = float(actual_result.get("close_profit_abs", 0.0))
        actual_direction = "short" if actual_result.get("is_short") else "long"
        was_profitable = actual_profit > 0

        logger.info(
            "Recording accuracy for trade %d | profit=%.4f | direction=%s | profitable=%s",
            trade_id, actual_profit, actual_direction, was_profitable,
        )

        # Score each advisor
        for advisor in ("freqai", "claude", "grok"):
            predicted_dir: str = getattr(validation, f"{advisor}_direction", "neutral")
            predicted_conf: float = getattr(validation, f"{advisor}_confidence", 0.0)

            # Correct = (predicted same direction AND trade was profitable)
            #          OR (predicted opposite direction AND trade was NOT profitable
            #              — advisor warned us correctly)
            direction_correct = predicted_dir == actual_direction
            was_correct = (direction_correct and was_profitable) or (
                not direction_correct and not was_profitable
            )

            accuracy_record = AIAccuracy(
                validation_id=validation.id,
                advisor=advisor,
                predicted_direction=predicted_dir,
                predicted_confidence=predicted_conf,
                actual_profit=actual_profit,
                was_profitable=was_profitable,
                was_correct=was_correct,
            )
            db.add(accuracy_record)

        await db.commit()
        logger.info(
            "Accuracy records saved for trade %d (validation_id=%d)",
            trade_id, validation.id,
        )

    async def get_accuracy_stats(
        self, db: AsyncSession
    ) -> dict[str, dict[str, Any]]:
        """
        Compute rolling accuracy per advisor (all time).

        Returns:
            {
                "freqai": {"correct": 45, "total": 60, "pct": 75.0},
                "claude": {"correct": 48, "total": 60, "pct": 80.0},
                "grok":   {"correct": 42, "total": 60, "pct": 70.0},
            }
        """
        from sqlalchemy import func

        result = await db.execute(
            select(
                AIAccuracy.advisor,
                func.count(AIAccuracy.id).label("total"),
                func.sum(
                    func.cast(AIAccuracy.was_correct, sa.Integer)
                ).label("correct"),
            ).group_by(AIAccuracy.advisor)
        )
        rows = result.all()

        stats: dict[str, dict[str, Any]] = {}
        for row in rows:
            total = row.total or 0
            # was_correct is Boolean — PostgreSQL sum on boolean gives None or int
            correct_raw = row.correct
            # Handle PostgreSQL boolean sum quirk
            if correct_raw is None:
                correct = 0
            else:
                try:
                    correct = int(correct_raw)
                except (TypeError, ValueError):
                    correct = 0

            pct = round((correct / total * 100) if total > 0 else 0.0, 1)
            stats[row.advisor] = {"correct": correct, "total": total, "pct": pct}

        # Ensure all three advisors are always present
        for advisor in ("freqai", "claude", "grok"):
            if advisor not in stats:
                stats[advisor] = {"correct": 0, "total": 0, "pct": 0.0}

        return stats
