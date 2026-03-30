"""
Tests for ScoreCalculator — weighted confidence and agreement metrics.
"""
from __future__ import annotations

import pytest

from src.ai_validator.scorer import ScoreCalculator, DEFAULT_WEIGHTS


_LONG_TRADE = {"is_short": False, "do_predict": 2}
_SHORT_TRADE = {"is_short": True, "do_predict": 1}

_BULLISH_CLAUDE = {
    "confidence": 0.80,
    "direction": "long",
    "agreement_with_freqai": True,
    "reasoning": "Uptrend confirmed.",
    "risk_factors": [],
    "sentiment_assessment": "bullish",
    "market_regime": "trending_bullish",
}

_BULLISH_GROK = {
    "confidence": 0.70,
    "direction": "long",
    "agreement_with_freqai": True,
    "reasoning": "Momentum strong.",
    "risk_factors": [],
    "sentiment_assessment": "bullish",
    "market_regime": "trending_bullish",
}

_BEARISH_CLAUDE = {
    "confidence": 0.75,
    "direction": "short",
    "agreement_with_freqai": False,
    "reasoning": "FreqAI missed the breakdown.",
    "risk_factors": ["Macro risk"],
    "sentiment_assessment": "bearish",
    "market_regime": "trending_bearish",
}

_BEARISH_GROK = {
    "confidence": 0.65,
    "direction": "short",
    "agreement_with_freqai": False,
    "reasoning": "Divergence visible.",
    "risk_factors": ["FED meeting"],
    "sentiment_assessment": "bearish",
    "market_regime": "trending_bearish",
}


class TestScoreCalculator:

    @pytest.fixture
    def scorer(self):
        return ScoreCalculator()

    def test_all_agree_long(self, scorer):
        """All 3 agree on LONG → all_agree=True, strong_disagree=False."""
        result = scorer.calculate(_LONG_TRADE, _BULLISH_CLAUDE, _BULLISH_GROK)

        assert result["all_agree"] is True
        assert result["strong_disagree"] is False
        assert result["freqai_direction"] == "long"
        assert result["claude_direction"] == "long"
        assert result["grok_direction"] == "long"
        assert result["agreement_pct"] == 1.0

    def test_strong_disagree(self, scorer):
        """Both LLMs disagree with FreqAI → strong_disagree=True."""
        result = scorer.calculate(_LONG_TRADE, _BEARISH_CLAUDE, _BEARISH_GROK)

        assert result["strong_disagree"] is True
        assert result["all_agree"] is False
        assert result["freqai_direction"] == "long"
        assert result["claude_direction"] == "short"
        assert result["grok_direction"] == "short"

    def test_combined_confidence_weighted(self, scorer):
        """Combined confidence uses correct weights."""
        # FreqAI do_predict=2 → normalized = (2+2)/4 = 1.0
        # Claude = 0.80, Grok = 0.70
        # Combined = 1.0*0.50 + 0.80*0.30 + 0.70*0.20 = 0.50 + 0.24 + 0.14 = 0.88
        result = scorer.calculate(_LONG_TRADE, _BULLISH_CLAUDE, _BULLISH_GROK)

        expected = round(1.0 * 0.50 + 0.80 * 0.30 + 0.70 * 0.20, 3)
        assert result["combined_confidence"] == pytest.approx(expected, abs=0.001)

    def test_freqai_do_predict_normalization(self, scorer):
        """FreqAI do_predict is normalized correctly to [0, 1]."""
        # do_predict=2 → (2+2)/4 = 1.0
        trade_max = {"is_short": False, "do_predict": 2}
        result = scorer.calculate(trade_max, _BULLISH_CLAUDE, _BULLISH_GROK)
        assert result["freqai_confidence"] == 1.0

        # do_predict=0 → (0+2)/4 = 0.5
        trade_mid = {"is_short": False, "do_predict": 0}
        result_mid = scorer.calculate(trade_mid, _BULLISH_CLAUDE, _BULLISH_GROK)
        assert result_mid["freqai_confidence"] == 0.5

        # do_predict=-2 → (-2+2)/4 = 0.0
        trade_min = {"is_short": False, "do_predict": -2}
        result_min = scorer.calculate(trade_min, _BULLISH_CLAUDE, _BULLISH_GROK)
        assert result_min["freqai_confidence"] == 0.0

    def test_custom_weights(self, scorer):
        """Custom weights override defaults."""
        custom_weights = {"freqai": 0.33, "claude": 0.33, "grok": 0.34}
        result = scorer.calculate(_LONG_TRADE, _BULLISH_CLAUDE, _BULLISH_GROK, weights=custom_weights)
        # Should not raise and combined_confidence should be in [0, 1]
        assert 0.0 <= result["combined_confidence"] <= 1.0

    def test_missing_do_predict_uses_default(self, scorer):
        """Missing do_predict field defaults safely."""
        trade_no_predict = {"is_short": False}  # no do_predict
        result = scorer.calculate(trade_no_predict, _BULLISH_CLAUDE, _BULLISH_GROK)
        # Should not raise
        assert 0.0 <= result["freqai_confidence"] <= 1.0

    def test_partial_agreement(self, scorer):
        """2 agree, 1 disagrees → all_agree=False, strong_disagree=False."""
        grok_neutral = {
            **_BULLISH_GROK,
            "direction": "short",
            "agreement_with_freqai": False,
        }
        result = scorer.calculate(_LONG_TRADE, _BULLISH_CLAUDE, grok_neutral)

        assert result["all_agree"] is False
        assert result["strong_disagree"] is False  # only 1 LLM disagrees

    def test_reasoning_included(self, scorer):
        """Reasoning text is copied into result."""
        result = scorer.calculate(_LONG_TRADE, _BULLISH_CLAUDE, _BULLISH_GROK)
        assert result["claude_reasoning"] == "Uptrend confirmed."
        assert result["grok_reasoning"] == "Momentum strong."

    def test_risk_factors_included(self, scorer):
        """Risk factors from both advisors are included."""
        result = scorer.calculate(_LONG_TRADE, _BEARISH_CLAUDE, _BEARISH_GROK)
        assert "Macro risk" in result["claude_risk_factors"]
        assert "FED meeting" in result["grok_risk_factors"]
