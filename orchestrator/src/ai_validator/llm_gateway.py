"""
LLM Gateway — OpenRouter API client.

Sends prompts to Claude and Grok via OpenRouter.
Handles:
- Parallel queries (asyncio.gather)
- Primary / fallback model selection
- Exponential backoff retry (2s, 4s, 8s, max 60s)
- Token counting and cost calculation
- Detailed error handling (no bare except)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

# Cost per 1M tokens (input / output) as of 2026-03
# Source: https://openrouter.ai/models
_COST_PER_1M = {
    "anthropic/claude-sonnet-4-5":       {"input": 3.00,  "output": 15.00},
    "anthropic/claude-haiku-4-5-20251001": {"input": 0.25,  "output": 1.25},
    "x-ai/grok-4.1-fast":               {"input": 0.20,  "output": 0.50},
    "x-ai/grok-3-mini-fast":            {"input": 0.10,  "output": 0.25},
}

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are a cryptocurrency trading analyst working alongside a FreqAI ML model. "
    "FreqAI uses LightGBM/XGBoost/PyTorch to analyze OHLCV data and technical indicators. "
    "It has generated a trading signal. Your job is to provide a SECOND OPINION.\n\n"
    "RULES:\n"
    "1. Analyze the provided market data objectively\n"
    "2. Consider factors the ML model might miss: macro events, market structure, liquidity\n"
    "3. Be specific — reference actual price levels, percentages, and data points\n"
    "4. If you agree with FreqAI, explain why the signal is strong\n"
    "5. If you disagree, explain what FreqAI might be missing\n"
    "6. Always return valid JSON matching the requested schema exactly\n"
    "7. Keep reasoning to 2-3 sentences maximum\n"
    "8. Confidence 0.0 = no confidence, 1.0 = absolute certainty\n"
    "9. Never hallucinate data — only reference what is provided in the prompt\n\n"
    "MARKET REGIMES:\n"
    "- trending_bullish: Clear uptrend, higher highs/lows\n"
    "- trending_bearish: Clear downtrend, lower highs/lows\n"
    "- ranging: Price oscillating in a defined range\n"
    "- volatile: Large candles, no clear direction\n"
    "- breakout: Price breaking out of a range or pattern"
)


class LLMGateway:
    """
    Sends prompts to Claude and Grok via OpenRouter, returns parsed responses.
    All communication with external LLM APIs goes through this class.
    """

    # Retry config — exponential backoff per spec §13
    _RETRY_DELAYS = [2, 4, 8, 16, 32, 60]   # seconds
    _MAX_RETRIES = len(_RETRY_DELAYS)

    @property
    def MODELS(self) -> dict[str, dict[str, str]]:
        """Read model names from settings each time (supports runtime config changes)."""
        return {
            "claude": {
                "primary": settings.ai_claude_model,
                "fallback": settings.ai_claude_fallback,
            },
            "grok": {
                "primary": settings.ai_grok_model,
                "fallback": settings.ai_grok_fallback,
            },
        }

    def __init__(self, api_key: str | None = None, timeout: float = 30.0) -> None:
        # api_key is loaded from settings by default — never pass it from caller code
        self.api_key = api_key or settings.ai_openrouter_api_key
        self.timeout = timeout

    async def validate_signal(self, prompt: str) -> dict:
        """
        Send prompt to both Claude and Grok IN PARALLEL.

        Returns:
            {
                "claude": {confidence, direction, agreement_with_freqai, reasoning, ...},
                "grok":   {confidence, direction, ...},
                "claude_tokens": int,
                "grok_tokens": int,
                "total_cost_usd": float,
                "timestamp": str,
            }
        """
        claude_task = self._query_with_fallback("claude", SYSTEM_PROMPT, prompt)
        grok_task = self._query_with_fallback("grok", SYSTEM_PROMPT, prompt)

        results = await asyncio.gather(claude_task, grok_task, return_exceptions=True)

        response: dict = {"timestamp": datetime.now(timezone.utc).isoformat()}
        token_data = {"claude_tokens": 0, "grok_tokens": 0, "total_cost_usd": 0.0}

        for name, result in zip(["claude", "grok"], results):
            if isinstance(result, Exception):
                logger.error("LLM query failed for %s: %s", name, result)
                response[name] = {
                    "error": str(result),
                    "confidence": 0.0,
                    "direction": "neutral",
                    "agreement_with_freqai": None,
                    "reasoning": f"LLM unavailable: {result}",
                    "risk_factors": [],
                    "sentiment_assessment": "neutral",
                    "suggested_tp_adjustment": None,
                    "suggested_sl_adjustment": None,
                    "market_regime": "unknown",
                }
            else:
                response[name] = result["content"]
                tokens = result.get("tokens_used", 0)
                cost = result.get("cost_usd", 0.0)
                token_data[f"{name}_tokens"] = tokens
                token_data["total_cost_usd"] += cost

        response.update(token_data)
        return response

    async def query(
        self, model: str, system_prompt: str, user_content: str,
        max_tokens: int = 1000,
    ) -> dict:
        """
        Query a single advisor (for use by HyperoptAdvisor / strategy-review).
        model: 'claude' or 'grok'
        max_tokens: Max output tokens (default 1000 for signals, use 2500 for reviews)
        Returns raw LLM response dict (content + usage metadata).
        """
        return await self._query_with_fallback(model, system_prompt, user_content, max_tokens=max_tokens)

    async def _query_with_fallback(
        self, advisor: str, system: str, prompt: str,
        max_tokens: int = 1000,
    ) -> dict:
        """Try primary model, fall back to secondary if primary fails."""
        models = self.MODELS[advisor]
        for model_id in [models["primary"], models["fallback"]]:
            try:
                return await self._call_with_retry(model_id, system, prompt, max_tokens=max_tokens)
            except (httpx.HTTPError, json.JSONDecodeError, KeyError) as exc:
                if model_id == models["fallback"]:
                    raise  # both failed — propagate
                logger.warning(
                    "Primary model %s failed (%s), trying fallback %s",
                    model_id, exc, models["fallback"],
                )
        # unreachable but satisfies type checker
        raise RuntimeError(f"All models failed for {advisor}")  # pragma: no cover

    async def _call_with_retry(
        self, model: str, system: str, prompt: str,
        max_tokens: int = 1000,
    ) -> dict:
        """Call OpenRouter with exponential backoff retry."""
        last_exc: Exception | None = None

        for attempt, delay in enumerate(self._RETRY_DELAYS, start=1):
            try:
                return await self._call_openrouter(model, system, prompt, max_tokens=max_tokens)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429:
                    # Rate limited — back off
                    logger.warning(
                        "Rate limited by OpenRouter (attempt %d/%d). "
                        "Sleeping %ds before retry.",
                        attempt, self._MAX_RETRIES, delay,
                    )
                    await asyncio.sleep(delay)
                    last_exc = exc
                elif exc.response.status_code >= 500:
                    # Server error — retry
                    logger.warning(
                        "OpenRouter server error %d (attempt %d/%d). Retrying in %ds.",
                        exc.response.status_code, attempt, self._MAX_RETRIES, delay,
                    )
                    await asyncio.sleep(delay)
                    last_exc = exc
                else:
                    raise  # 4xx client errors are not retried
            except httpx.TimeoutException as exc:
                logger.warning(
                    "OpenRouter timeout (attempt %d/%d). Retrying in %ds.",
                    attempt, self._MAX_RETRIES, delay,
                )
                await asyncio.sleep(delay)
                last_exc = exc

        raise last_exc or RuntimeError("Max retries exceeded")

    async def _call_openrouter(
        self, model: str, system: str, prompt: str,
        max_tokens: int = 1000,
    ) -> dict:
        """Make a single HTTP call to OpenRouter. Raises on non-2xx or bad JSON."""
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                _OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://freqtrade-ui.app",
                    "X-OpenRouter-Title": "FreqTrade AI Validator",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,  # low temp for consistent, structured output
                    "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()

        elapsed = time.monotonic() - t0
        data = resp.json()

        # Parse content
        raw_content = data["choices"][0]["message"]["content"]
        try:
            content = json.loads(raw_content)
        except json.JSONDecodeError as exc:
            raise json.JSONDecodeError(
                f"OpenRouter returned invalid JSON from {model}: {raw_content[:200]}",
                exc.doc,
                exc.pos,
            ) from exc

        # Extract token usage and compute cost
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", input_tokens + output_tokens)

        cost_table = _COST_PER_1M.get(model, {"input": 0, "output": 0})
        cost_usd = (
            (input_tokens / 1_000_000) * cost_table["input"]
            + (output_tokens / 1_000_000) * cost_table["output"]
        )

        logger.debug(
            "OpenRouter %s: %d tokens in %.1fs → $%.4f",
            model, total_tokens, elapsed, cost_usd,
        )

        return {
            "content": content,
            "tokens_used": total_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost_usd,
            "model_used": model,
            "latency_ms": int(elapsed * 1000),
        }
