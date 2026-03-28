"""
Tests for LLMGateway — OpenRouter API client.
All tests use mocked httpx responses (no real API calls).
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

from src.ai_validator.llm_gateway import LLMGateway, SYSTEM_PROMPT


# ── Fixtures ────────────────────────────────────────────────────────────────────

def _mock_openrouter_response(content: dict, model: str = "anthropic/claude-sonnet-4-5") -> dict:
    """Build a fake OpenRouter API response."""
    return {
        "id": "gen-test",
        "model": model,
        "choices": [
            {
                "message": {"role": "assistant", "content": json.dumps(content)},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 80,
            "total_tokens": 180,
        },
    }


_VALID_SIGNAL_RESPONSE = {
    "confidence": 0.72,
    "direction": "long",
    "agreement_with_freqai": True,
    "reasoning": "Strong momentum with volume confirmation.",
    "risk_factors": ["RSI approaching overbought"],
    "sentiment_assessment": "bullish",
    "suggested_tp_adjustment": None,
    "suggested_sl_adjustment": None,
    "market_regime": "trending_bullish",
}


# ── Tests ───────────────────────────────────────────────────────────────────────

class TestLLMGateway:

    @pytest.fixture
    def gateway(self):
        return LLMGateway(api_key="test-key-123")

    @pytest.mark.asyncio
    async def test_validate_signal_both_succeed(self, gateway):
        """validate_signal returns claude + grok when both succeed."""
        claude_resp = _mock_openrouter_response(_VALID_SIGNAL_RESPONSE, "anthropic/claude-sonnet-4-5")
        grok_resp = _mock_openrouter_response(
            {**_VALID_SIGNAL_RESPONSE, "confidence": 0.65, "reasoning": "Grok agrees."},
            "x-ai/grok-4.1-fast",
        )

        mock_response_claude = MagicMock()
        mock_response_claude.raise_for_status = MagicMock()
        mock_response_claude.json.return_value = claude_resp

        mock_response_grok = MagicMock()
        mock_response_grok.raise_for_status = MagicMock()
        mock_response_grok.json.return_value = grok_resp

        call_count = 0

        async def fake_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return mock_response_claude if call_count == 1 else mock_response_grok

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = fake_post
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            result = await gateway.validate_signal("test prompt")

        assert "claude" in result
        assert "grok" in result
        assert result["claude"]["confidence"] == 0.72
        assert result["grok"]["confidence"] == 0.65
        assert "timestamp" in result
        assert "total_cost_usd" in result

    @pytest.mark.asyncio
    async def test_validate_signal_one_fails(self, gateway):
        """validate_signal returns error struct when one advisor fails."""
        claude_resp = _mock_openrouter_response(_VALID_SIGNAL_RESPONSE)
        call_count = 0

        async def fake_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # Claude succeeds
                mock = MagicMock()
                mock.raise_for_status = MagicMock()
                mock.json.return_value = claude_resp
                return mock
            else:
                # Grok fails on both primary and fallback
                raise httpx.TimeoutException("Timeout")

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = fake_post
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            result = await gateway.validate_signal("test prompt")

        # Claude should succeed, Grok should return error struct
        assert result["claude"]["confidence"] == 0.72
        assert "error" in result["grok"]
        assert result["grok"]["confidence"] == 0.0
        assert result["grok"]["direction"] == "neutral"

    @pytest.mark.asyncio
    async def test_retry_on_rate_limit(self, gateway):
        """Rate limit (429) triggers retry with backoff."""
        call_count = 0

        async def fake_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                # First two calls: rate limited
                response = MagicMock()
                response.status_code = 429
                response.raise_for_status.side_effect = httpx.HTTPStatusError(
                    "429 Rate Limited", request=MagicMock(), response=response
                )
                return response
            else:
                # Third call: success
                mock = MagicMock()
                mock.raise_for_status = MagicMock()
                mock.json.return_value = _mock_openrouter_response(_VALID_SIGNAL_RESPONSE)
                return mock

        with patch("httpx.AsyncClient") as mock_client_cls:
            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                mock_client = AsyncMock()
                mock_client.post = fake_post
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=None)
                mock_client_cls.return_value = mock_client

                result = await gateway._call_with_retry(
                    "anthropic/claude-sonnet-4-5", SYSTEM_PROMPT, "test"
                )

        assert result["content"]["confidence"] == 0.72
        # Should have slept at least once for backoff
        assert mock_sleep.call_count >= 1

    def test_cost_calculation(self, gateway):
        """Token cost is computed correctly per model."""
        # Claude Sonnet: $3/1M input, $15/1M output
        # 1000 input + 300 output = $0.003 + $0.0045 = $0.0075
        # (rough sanity check — exact value depends on rounding)
        from src.ai_validator.llm_gateway import _COST_PER_1M

        claude_prices = _COST_PER_1M["anthropic/claude-sonnet-4-5"]
        cost = (1000 / 1_000_000) * claude_prices["input"] + (300 / 1_000_000) * claude_prices["output"]
        assert abs(cost - 0.0075) < 0.001

        grok_prices = _COST_PER_1M["x-ai/grok-4.1-fast"]
        grok_cost = (1000 / 1_000_000) * grok_prices["input"] + (300 / 1_000_000) * grok_prices["output"]
        assert grok_cost < cost  # Grok should be much cheaper

    @pytest.mark.asyncio
    async def test_fallback_model_used_on_failure(self, gateway):
        """Primary model failure triggers fallback model."""
        call_count = 0

        async def fake_post(url, *, headers, json, **kwargs):
            nonlocal call_count
            call_count += 1
            model_used = json["model"]

            if "claude-sonnet" in model_used:
                # Primary fails
                response = MagicMock()
                response.status_code = 503
                response.raise_for_status.side_effect = httpx.HTTPStatusError(
                    "503", request=MagicMock(), response=response
                )
                return response
            else:
                # Fallback (haiku) succeeds
                mock = MagicMock()
                mock.raise_for_status = MagicMock()
                mock.json.return_value = _mock_openrouter_response(
                    _VALID_SIGNAL_RESPONSE, model_used
                )
                return mock

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = fake_post
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            result = await gateway._query_with_fallback("claude", SYSTEM_PROMPT, "test prompt")

        # Should have used fallback model and gotten a response
        assert result["content"]["confidence"] == 0.72
        assert call_count >= 2  # At least primary + fallback attempts
