"""
Score Calculator — computes weighted confidence and agreement metrics.

Combines FreqAI signal strength with Claude and Grok opinions.
Weights are configurable (default: FreqAI 50%, Claude 30%, Grok 20%).
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS: dict[str, float] = {
    "freqai": 0.50,
    "claude": 0.30,
    "grok":   0.20,
}


class ScoreCalculator:
    """
    Calculates combined confidence and agreement metrics from
    FreqAI signal + Claude response + Grok response.
    """

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = weights or DEFAULT_WEIGHTS

    def calculate(
        self,
        freqai_signal: dict[str, Any],
        claude_response: dict[str, Any],
        grok_response: dict[str, Any],
        weights: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        """
        Compute combined score from all three advisors.

        Args:
            freqai_signal: One entry from FT /api/v1/status.
                           Uses: is_short, do_predict (FreqAI confidence).
            claude_response: Parsed Claude response dict.
            grok_response:   Parsed Grok response dict.
            weights:         Optional override {freqai, claude, grok}.

        Returns:
            Full score dict with confidence, directions, agreement metrics,
            and all reasoning/sentiment fields.
        """
        w = weights or self.weights

        # ── FreqAI confidence ──────────────────────────────────────
        # do_predict: 2=high confidence LONG, 1=ok, 0=uncertain, -1/-2=outlier
        # Normalize to [0.0, 1.0]: (do_predict + 2) / 4
        do_predict = freqai_signal.get("do_predict", freqai_signal.get("freqai_do_predict", 1))
        try:
            do_predict_f = float(do_predict)
        except (TypeError, ValueError):
            do_predict_f = 1.0  # safe default if field missing

        freqai_confidence = max(0.0, min(1.0, (do_predict_f + 2) / 4))

        # ── LLM confidences ───────────────────────────────────────
        claude_conf = max(0.0, min(1.0, float(claude_response.get("confidence", 0.0))))
        grok_conf = max(0.0, min(1.0, float(grok_response.get("confidence", 0.0))))

        # ── Combined weighted confidence ───────────────────────────
        combined_confidence = (
            freqai_confidence * w["freqai"]
            + claude_conf * w["claude"]
            + grok_conf * w["grok"]
        )

        # ── Direction mapping ─────────────────────────────────────
        freqai_dir = "short" if freqai_signal.get("is_short") else "long"
        claude_dir = claude_response.get("direction", "neutral").lower()
        grok_dir = grok_response.get("direction", "neutral").lower()

        # ── Agreement scoring ─────────────────────────────────────
        directions = [freqai_dir, claude_dir, grok_dir]
        agreement_count = max(directions.count("long"), directions.count("short"))
        agreement_pct = agreement_count / 3

        all_agree = (claude_dir == freqai_dir) and (grok_dir == freqai_dir)

        # strong_disagree: BOTH LLMs explicitly disagree with FreqAI
        claude_disagrees = claude_response.get("agreement_with_freqai") is False
        grok_disagrees = grok_response.get("agreement_with_freqai") is False
        strong_disagree = claude_disagrees and grok_disagrees

        return {
            # Confidence scores
            "freqai_confidence": round(freqai_confidence, 3),
            "claude_confidence": round(claude_conf, 3),
            "grok_confidence": round(grok_conf, 3),
            "combined_confidence": round(combined_confidence, 3),

            # Directions
            "freqai_direction": freqai_dir,
            "claude_direction": claude_dir,
            "grok_direction": grok_dir,

            # Agreement
            "agreement_pct": round(agreement_pct, 3),
            "all_agree": all_agree,
            "strong_disagree": strong_disagree,

            # Claude details
            "claude_reasoning": claude_response.get("reasoning", ""),
            "claude_risk_factors": claude_response.get("risk_factors", []),
            "claude_sentiment": claude_response.get("sentiment_assessment", "neutral"),
            "claude_regime": claude_response.get("market_regime", "unknown"),

            # Grok details
            "grok_reasoning": grok_response.get("reasoning", ""),
            "grok_risk_factors": grok_response.get("risk_factors", []),
            "grok_sentiment": grok_response.get("sentiment_assessment", "neutral"),
            "grok_regime": grok_response.get("market_regime", "unknown"),
        }
