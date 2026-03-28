"""
Tests for ResponseParser — LLM JSON extraction and validation.
"""
from __future__ import annotations

import json
import pytest

from src.ai_validator.response_parser import (
    parse_llm_response,
    _extract_json,
    build_retry_prompt,
    parse_pre_hyperopt_response,
    parse_post_hyperopt_response,
)


_VALID_SIGNAL = {
    "confidence": 0.72,
    "direction": "long",
    "agreement_with_freqai": True,
    "reasoning": "Strong momentum confirmed by volume.",
    "risk_factors": ["RSI at 68 approaching overbought"],
    "sentiment_assessment": "bullish",
    "suggested_tp_adjustment": None,
    "suggested_sl_adjustment": None,
    "market_regime": "trending_bullish",
}


class TestExtractJson:

    def test_plain_json_string(self):
        """Pure JSON string parses directly."""
        result = _extract_json(json.dumps(_VALID_SIGNAL))
        assert result["confidence"] == 0.72

    def test_json_in_markdown_block(self):
        """JSON wrapped in ```json``` block is extracted."""
        text = f"```json\n{json.dumps(_VALID_SIGNAL)}\n```"
        result = _extract_json(text)
        assert result["direction"] == "long"

    def test_json_in_plain_code_block(self):
        """JSON wrapped in ``` ``` block (no language) is extracted."""
        text = f"Sure, here is the analysis:\n```\n{json.dumps(_VALID_SIGNAL)}\n```"
        result = _extract_json(text)
        assert result["market_regime"] == "trending_bullish"

    def test_json_embedded_in_prose(self):
        """JSON object embedded in prose text is extracted."""
        prose = f"Based on my analysis: {json.dumps(_VALID_SIGNAL)} Hope that helps!"
        result = _extract_json(prose)
        assert result["confidence"] == 0.72

    def test_invalid_json_raises(self):
        """Completely invalid text raises JSONDecodeError."""
        with pytest.raises(json.JSONDecodeError):
            _extract_json("This is definitely not JSON at all")


class TestParseLlmResponse:

    def test_valid_dict_passthrough(self):
        """Already-parsed dict passes through validation."""
        result = parse_llm_response(_VALID_SIGNAL.copy())
        assert result["confidence"] == 0.72

    def test_content_wrapper_dict(self):
        """Dict with 'content' key (from LLMGateway) unwraps correctly."""
        wrapped = {"content": _VALID_SIGNAL.copy(), "tokens_used": 150}
        result = parse_llm_response(wrapped)
        assert result["direction"] == "long"

    def test_missing_optional_fields_get_defaults(self):
        """Missing optional fields (suggested_tp/sl_adjustment) get None defaults."""
        signal = _VALID_SIGNAL.copy()
        del signal["suggested_tp_adjustment"]
        del signal["suggested_sl_adjustment"]
        result = parse_llm_response(signal)
        assert result["suggested_tp_adjustment"] is None
        assert result["suggested_sl_adjustment"] is None

    def test_missing_required_field_raises(self):
        """Missing required field (direction) raises ValueError."""
        signal = _VALID_SIGNAL.copy()
        del signal["direction"]
        with pytest.raises(ValueError, match="missing required fields"):
            parse_llm_response(signal)

    def test_confidence_clamped_to_range(self):
        """Confidence > 1.0 or < 0.0 is clamped."""
        signal = {**_VALID_SIGNAL, "confidence": 1.5}
        result = parse_llm_response(signal)
        assert result["confidence"] == 1.0

        signal_neg = {**_VALID_SIGNAL, "confidence": -0.1}
        result_neg = parse_llm_response(signal_neg)
        assert result_neg["confidence"] == 0.0

    def test_exception_reraises(self):
        """Exception from asyncio.gather is re-raised."""
        exc = RuntimeError("LLM timeout")
        with pytest.raises(RuntimeError, match="LLM timeout"):
            parse_llm_response(exc)

    def test_string_json_input(self):
        """JSON string is parsed correctly."""
        result = parse_llm_response(json.dumps(_VALID_SIGNAL))
        assert result["sentiment_assessment"] == "bullish"


class TestBuildRetryPrompt:

    def test_retry_prompt_appended(self):
        """Retry prompt is appended to original."""
        original = "Analyze this trade."
        retry = build_retry_prompt(original)
        assert original in retry
        assert "valid JSON" in retry
        assert "Return ONLY" in retry


class TestHyperoptParsers:

    def test_parse_pre_hyperopt_valid(self):
        """Valid pre-hyperopt response parses correctly."""
        pre_response = {
            "recommended_loss_function": "SharpeHyperOptLossDaily",
            "recommended_sampler": "TPESampler",
            "recommended_epochs": 300,
            "parameter_suggestions": [],
            "spaces_to_optimize": ["buy", "sell"],
            "confidence": 0.8,
        }
        result = parse_pre_hyperopt_response(pre_response)
        assert result["recommended_loss_function"] == "SharpeHyperOptLossDaily"

    def test_parse_pre_hyperopt_missing_field_raises(self):
        """Missing required pre-hyperopt field raises ValueError."""
        bad = {
            "recommended_loss_function": "SharpeHyperOptLossDaily",
            # missing recommended_sampler, recommended_epochs, etc.
        }
        with pytest.raises(ValueError, match="missing required fields"):
            parse_pre_hyperopt_response(bad)

    def test_parse_post_hyperopt_valid(self):
        """Valid post-hyperopt response parses correctly."""
        post_response = {
            "recommended_result_index": 2,
            "overfitting_risk_scores": [{"result_index": 0, "risk_score": 0.2}],
            "general_analysis": "Results look solid.",
            "confidence": 0.75,
        }
        result = parse_post_hyperopt_response(post_response)
        assert result["recommended_result_index"] == 2
