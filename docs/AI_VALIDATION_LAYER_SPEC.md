# AI Validation Layer — Complete Technical Specification

**Version:** 1.0
**Date:** 2026-03-28
**Author:** Novakus
**Status:** READY FOR IMPLEMENTATION

---

## Table of Contents

1. [Purpose & Philosophy](#1-purpose--philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Flow — Step by Step](#3-data-flow--step-by-step)
4. [OpenRouter Integration](#4-openrouter-integration)
5. [Orchestrator Module: `ai_validator/`](#5-orchestrator-module-ai_validator)
6. [Database Schema](#6-database-schema)
7. [API Endpoints](#7-api-endpoints)
8. [Frontend: AI Insights Page](#8-frontend-ai-insights-page)
9. [Prompt Engineering](#9-prompt-engineering)
10. [Sentiment Data Sources](#10-sentiment-data-sources)
11. [Scoring & Comparison System](#11-scoring--comparison-system)
12. [Configuration](#12-configuration)
13. [Error Handling & Fallbacks](#13-error-handling--fallbacks)
14. [Performance & Cost Management](#14-performance--cost-management)
15. [Security](#15-security)
16. [Testing Plan](#16-testing-plan)
17. [Implementation Phases](#17-implementation-phases)
18. [File Structure](#18-file-structure)
19. [Hyperopt Integration](#19-hyperopt-integration)

---

## 1. Purpose & Philosophy

### What This Is

An advisory layer that sits ON TOP of FreqAI. FreqAI does its job (ML predictions using LightGBM/XGBoost/PyTorch). After FreqAI produces a signal, this layer sends the signal + market context to Claude and Grok via OpenRouter API. They return a second opinion with confidence score and reasoning.

### What This Is NOT

- NOT a replacement for FreqAI's ML models
- NOT a trading decision maker (FreqTrade still decides all trades)
- NOT a modification to any FreqTrade code
- NOT real-time (runs after FreqAI produces signals, not during)

### Core Rule

**FreqTrade is the brain. FreqAI is the ML engine. Claude and Grok are advisors.**

The AI Validation Layer NEVER:
- Modifies FreqAI predictions
- Places, cancels, or changes trades
- Overrides stoploss or ROI settings
- Writes to FreqTrade's config.json

The AI Validation Layer ONLY:
- Reads FreqAI signals (via FT REST API)
- Reads market data (via FT REST API)
- Sends context to Claude/Grok (via OpenRouter)
- Stores their opinions (in orchestrator DB)
- Displays comparison (in frontend)

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                      │
│  AI Insights Page: signal comparison table, confidence        │
│  gauges, agreement rate chart, historical accuracy tracker    │
├──────────────────────────────────────────────────────────────┤
│                  ORCHESTRATOR (FastAPI)                        │
│  ai_validator/ module:                                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │ Signal      │  │ Context      │  │ LLM Gateway      │     │
│  │ Collector   │→ │ Builder      │→ │ (OpenRouter)      │     │
│  │ (FT API)    │  │ (OHLCV+news) │  │ Claude + Grok    │     │
│  └────────────┘  └──────────────┘  └────────┬─────────┘     │
│                                              │               │
│  ┌──────────────────┐  ┌───────────────────┐│               │
│  │ Response Parser   │← │ Score Calculator  ││               │
│  │ (structured JSON) │  │ (comparison)      │←               │
│  └────────┬─────────┘  └───────────────────┘                │
│           ↓                                                   │
│  ┌──────────────────┐                                        │
│  │ PostgreSQL        │                                        │
│  │ ai_validations    │                                        │
│  │ ai_sentiment_log  │                                        │
│  │ ai_accuracy       │                                        │
│  └──────────────────┘                                        │
├──────────────────────────────────────────────────────────────┤
│              FreqTrade + FreqAI (UNMODIFIED)                  │
│  ML predictions → REST API → signals available               │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow — Step by Step

### Trigger

The AI Validation Layer runs on a **polling loop** (configurable, default: every new candle close, matching the bot's timeframe). It does NOT hook into FreqTrade internals.

### Sequence

```
1. POLL: Orchestrator calls GET /api/v1/status on each running bot
   → Gets list of open trades with: pair, is_short, open_rate, current_profit,
     stake_amount, enter_tag, stoploss_current_dist, open_date

2. DETECT: Compare with previous poll. New trade? Changed signal? FreqAI retrained?
   → If new trade or significant change detected → trigger validation

3. COLLECT CONTEXT:
   a) GET /api/v1/pair_candles?pair=BTC/USDT:USDT&timeframe=1h&limit=100
      → Last 100 candles of OHLCV data
   b) GET /api/v1/profit
      → Current bot performance (win rate, drawdown, total profit)
   c) GET /api/v1/performance
      → Per-pair performance history
   d) FreqAI metadata (if available):
      → do_predict value (confidence: -2 to 2)
      → DI_values (dissimilarity index)
      → Model identifier and age

4. BUILD PROMPT: Construct structured prompt with all context (see §9)

5. SEND TO OPENROUTER: Two parallel API calls
   a) POST https://openrouter.ai/api/v1/chat/completions
      model: "anthropic/claude-sonnet-4-5"
      → Claude's analysis
   b) POST https://openrouter.ai/api/v1/chat/completions
      model: "x-ai/grok-4.1-fast"
      → Grok's analysis

6. PARSE RESPONSES: Extract structured JSON from both responses
   → confidence_score (0.0 to 1.0)
   → direction_agreement (agree/disagree/neutral)
   → reasoning (text explanation)
   → risk_factors (list of concerns)
   → suggested_adjustments (optional hints)

7. CALCULATE COMBINED SCORE:
   → Weighted average: FreqAI weight + Claude weight + Grok weight
   → Agreement metric: how many of the 3 agree on direction

8. STORE: Insert into ai_validations table

9. NOTIFY: If significant disagreement (FreqAI says BUY, both LLMs say SELL):
   → Send Telegram notification (if configured)
   → Flag in Dashboard with warning icon

10. TRACK ACCURACY: When trade closes:
    → Compare actual result with each advisor's prediction
    → Update running accuracy score per advisor
```

---

## 4. OpenRouter Integration

### API Details

```
Base URL: https://openrouter.ai/api/v1
Auth: Authorization: Bearer <OPENROUTER_API_KEY>
Format: OpenAI-compatible chat completions
```

### Model Selection

| Advisor | Model ID | Cost (input/output per 1M tokens) | Why |
|---------|----------|-------------------------------------|-----|
| Claude | `anthropic/claude-sonnet-4-5` | ~$3 / $15 | Strong reasoning, structured output |
| Grok | `x-ai/grok-4.1-fast` | ~$0.20 / $0.50 | Fast, cheap, good for high-frequency |

Fallback models (if primary unavailable):
- Claude fallback: `anthropic/claude-haiku-4-5-20251001` ($0.25 / $1.25)
- Grok fallback: `x-ai/grok-3-mini-fast` (cheapest available)

### Request Format

```python
import httpx

async def query_openrouter(model: str, prompt: str, system: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
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
                "temperature": 0.3,  # Low temp for consistent analysis
                "max_tokens": 1000,
                "response_format": {"type": "json_object"},
            },
        )
        response.raise_for_status()
        data = response.json()
        return json.loads(data["choices"][0]["message"]["content"])
```

### Expected Response JSON

Both Claude and Grok must return this exact schema:

```json
{
  "confidence": 0.72,
  "direction": "long",
  "agreement_with_freqai": true,
  "reasoning": "BTC showing strong momentum above 20 EMA with increasing volume. RSI at 62 suggests room to run. However, approaching major resistance at 70k. FreqAI's long signal aligns with technical picture.",
  "risk_factors": [
    "FED rate decision in 18 hours",
    "RSI approaching overbought at 70",
    "Low weekend liquidity expected"
  ],
  "sentiment_assessment": "moderately_bullish",
  "suggested_tp_adjustment": null,
  "suggested_sl_adjustment": null,
  "market_regime": "trending_bullish"
}
```

---

## 5. Orchestrator Module: `ai_validator/`

### File Structure

```
orchestrator/src/ai_validator/
├── __init__.py
├── config.py          # AI validator settings
├── collector.py       # Signal + context collection from FT API
├── context_builder.py # Builds structured prompt from raw data
├── llm_gateway.py     # OpenRouter API client (Claude + Grok)
├── response_parser.py # Parse and validate LLM JSON responses
├── scorer.py          # Combined score calculation + agreement
├── tracker.py         # Accuracy tracking when trades close
├── scheduler.py       # Polling loop / trigger management
└── models.py          # SQLAlchemy models for ai_validations table
```

### Module Descriptions

#### `collector.py` — Signal Collector

Reads from FreqTrade REST API via the existing `FTClient`:

```python
from src.ft_client import FTClient

class SignalCollector:
    """Collects FreqAI signals and market context from FT bots."""

    def __init__(self, ft_client: FTClient):
        self.ft = ft_client
        self._previous_trades: dict[int, set[int]] = {}  # bot_id -> trade_ids

    async def detect_new_signals(self, bot_id: int) -> list[dict]:
        """Compare current open trades with previous snapshot.
        Returns list of new or changed trades that need validation."""
        current = await self.ft.status()  # GET /api/v1/status
        current_ids = {t["trade_id"] for t in current}
        prev_ids = self._previous_trades.get(bot_id, set())

        new_trades = [t for t in current if t["trade_id"] not in prev_ids]
        self._previous_trades[bot_id] = current_ids
        return new_trades

    async def collect_context(self, bot_id: int, pair: str, timeframe: str) -> dict:
        """Gather all context needed for LLM analysis."""
        candles = await self.ft.pair_candles(pair, timeframe, limit=100)
        profit = await self.ft.profit()
        performance = await self.ft.performance()
        stats = await self.ft.stats()
        daily = await self.ft.daily(30)

        return {
            "pair": pair,
            "timeframe": timeframe,
            "candles": candles,          # Last 100 OHLCV candles
            "bot_profit": profit,         # Overall bot performance
            "pair_performance": performance,  # Per-pair stats
            "bot_stats": stats,           # Max drawdown, trade count
            "daily_profit": daily,        # Last 30 days P&L
        }
```

#### `context_builder.py` — Prompt Builder

Transforms raw FT data into a structured prompt:

```python
class ContextBuilder:
    """Builds structured analysis prompt from FT data."""

    def build_prompt(self, trade: dict, context: dict) -> str:
        # Extract key metrics from candles
        candles = context["candles"]["data"]
        last_10 = candles[-10:]  # Last 10 candles for immediate context

        # Calculate simple technical summary
        closes = [c["close"] for c in candles]
        current_price = closes[-1]
        sma_20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else current_price
        sma_50 = sum(closes[-50:]) / 50 if len(closes) >= 50 else current_price
        price_vs_sma20 = ((current_price - sma_20) / sma_20) * 100

        # Recent volume trend
        volumes = [c["volume"] for c in last_10]
        avg_vol = sum(volumes) / len(volumes)
        vol_trend = "increasing" if volumes[-1] > avg_vol * 1.2 else "decreasing" if volumes[-1] < avg_vol * 0.8 else "stable"

        # Bot performance context
        profit = context["bot_profit"]
        win_rate = profit.get("winning_trades", 0) / max(profit.get("closed_trade_count", 1), 1) * 100

        return f"""
FREQAI SIGNAL ANALYSIS REQUEST

TRADE DETAILS:
- Pair: {trade["pair"]}
- Direction: {"SHORT" if trade.get("is_short") else "LONG"}
- Entry Rate (open_rate): {trade["open_rate"]}
- Current Profit: {trade.get("current_profit", 0):.4f}
- Stake Amount: {trade["stake_amount"]}
- Entry Tag: {trade.get("enter_tag", "N/A")}
- FreqAI do_predict: {trade.get("do_predict", "N/A")}
- FreqAI DI_value: {trade.get("DI_values", "N/A")}

MARKET CONTEXT:
- Current Price: {current_price}
- Price vs SMA20: {price_vs_sma20:+.2f}%
- SMA20 vs SMA50: {"BULLISH" if sma_20 > sma_50 else "BEARISH"}
- Volume Trend: {vol_trend}
- Timeframe: {context["timeframe"]}

LAST 10 CANDLES (newest first):
{self._format_candles(last_10)}

BOT PERFORMANCE:
- Win Rate: {win_rate:.1f}%
- Total Trades: {profit.get("closed_trade_count", 0)}
- Max Drawdown: {context["bot_stats"].get("max_drawdown", 0):.2f}%
- Today's P&L: {context["daily_profit"]["data"][0]["abs_profit"] if context["daily_profit"]["data"] else 0:.4f}

TASK:
Analyze this FreqAI signal. Do you agree with the {
    "SHORT" if trade.get("is_short") else "LONG"
} direction? Assess confidence and risk.

Return JSON with this exact schema:
{{
  "confidence": <float 0.0-1.0>,
  "direction": "<long|short|neutral>",
  "agreement_with_freqai": <bool>,
  "reasoning": "<2-3 sentences>",
  "risk_factors": ["<factor1>", "<factor2>"],
  "sentiment_assessment": "<very_bearish|bearish|neutral|bullish|very_bullish>",
  "suggested_tp_adjustment": <null or string>,
  "suggested_sl_adjustment": <null or string>,
  "market_regime": "<trending_bullish|trending_bearish|ranging|volatile|breakout>"
}}
"""

    def _format_candles(self, candles: list) -> str:
        lines = []
        for c in reversed(candles):
            change = ((c["close"] - c["open"]) / c["open"]) * 100
            lines.append(
                f"  {c['date']}: O={c['open']:.2f} H={c['high']:.2f} "
                f"L={c['low']:.2f} C={c['close']:.2f} V={c['volume']:.0f} "
                f"({'+'if change>=0 else ''}{change:.2f}%)"
            )
        return "\n".join(lines)
```

#### `llm_gateway.py` — OpenRouter Client

```python
import asyncio
import httpx
import json
from datetime import datetime

class LLMGateway:
    """Sends prompts to Claude and Grok via OpenRouter, returns parsed responses."""

    MODELS = {
        "claude": {
            "primary": "anthropic/claude-sonnet-4-5",
            "fallback": "anthropic/claude-haiku-4-5-20251001",
        },
        "grok": {
            "primary": "x-ai/grok-4.1-fast",
            "fallback": "x-ai/grok-3-mini-fast",
        },
    }

    SYSTEM_PROMPT = (
        "You are a cryptocurrency trading analyst. You receive FreqAI ML model signals "
        "and market data. Your job is to provide a second opinion — agree or disagree "
        "with the signal, assess confidence, and identify risks. "
        "Always respond with valid JSON matching the requested schema. "
        "Be concise and specific. Reference actual data points in your reasoning."
    )

    def __init__(self, api_key: str, timeout: float = 30.0):
        self.api_key = api_key
        self.timeout = timeout

    async def validate_signal(self, prompt: str) -> dict:
        """Send prompt to both Claude and Grok in parallel.
        Returns: {"claude": {...}, "grok": {...}, "timestamp": "..."}
        """
        claude_task = self._query("claude", prompt)
        grok_task = self._query("grok", prompt)

        results = await asyncio.gather(claude_task, grok_task, return_exceptions=True)

        response = {"timestamp": datetime.utcnow().isoformat()}

        for name, result in zip(["claude", "grok"], results):
            if isinstance(result, Exception):
                response[name] = {
                    "error": str(result),
                    "confidence": 0.0,
                    "direction": "neutral",
                    "agreement_with_freqai": None,
                    "reasoning": f"Failed to get response: {result}",
                    "risk_factors": [],
                    "sentiment_assessment": "neutral",
                    "market_regime": "unknown",
                }
            else:
                response[name] = result

        return response

    async def _query(self, advisor: str, prompt: str) -> dict:
        """Query a single advisor with fallback."""
        models = self.MODELS[advisor]
        for model_id in [models["primary"], models["fallback"]]:
            try:
                return await self._call_openrouter(model_id, prompt)
            except Exception:
                if model_id == models["fallback"]:
                    raise  # Both failed
                continue  # Try fallback

    async def _call_openrouter(self, model: str, prompt: str) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://freqtrade-ui.app",
                    "X-OpenRouter-Title": "FreqTrade AI Validator",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
```

#### `scorer.py` — Score Calculator

```python
class ScoreCalculator:
    """Calculates combined confidence and agreement metrics."""

    DEFAULT_WEIGHTS = {
        "freqai": 0.50,    # FreqAI ML model gets 50% weight
        "claude": 0.30,    # Claude gets 30%
        "grok": 0.20,      # Grok gets 20%
    }

    def calculate(
        self,
        freqai_signal: dict,
        claude_response: dict,
        grok_response: dict,
        weights: dict | None = None,
    ) -> dict:
        w = weights or self.DEFAULT_WEIGHTS

        # Normalize FreqAI confidence
        # do_predict: 2=high confidence, 1=ok, 0=uncertain, -1/-2=outlier
        do_predict = freqai_signal.get("do_predict", 1)
        freqai_confidence = max(0.0, min(1.0, (do_predict + 2) / 4))

        claude_conf = claude_response.get("confidence", 0.0)
        grok_conf = grok_response.get("confidence", 0.0)

        # Direction mapping
        freqai_dir = "short" if freqai_signal.get("is_short") else "long"
        claude_dir = claude_response.get("direction", "neutral")
        grok_dir = grok_response.get("direction", "neutral")

        # Combined confidence (weighted average)
        combined_confidence = (
            freqai_confidence * w["freqai"]
            + claude_conf * w["claude"]
            + grok_conf * w["grok"]
        )

        # Agreement score: how many agree on direction
        directions = [freqai_dir, claude_dir, grok_dir]
        agreement_count = max(directions.count("long"), directions.count("short"))
        agreement_pct = agreement_count / 3

        # Disagreement flag
        all_agree = claude_dir == freqai_dir and grok_dir == freqai_dir
        strong_disagree = (
            claude_response.get("agreement_with_freqai") is False
            and grok_response.get("agreement_with_freqai") is False
        )

        return {
            "freqai_confidence": round(freqai_confidence, 3),
            "claude_confidence": round(claude_conf, 3),
            "grok_confidence": round(grok_conf, 3),
            "combined_confidence": round(combined_confidence, 3),
            "freqai_direction": freqai_dir,
            "claude_direction": claude_dir,
            "grok_direction": grok_dir,
            "agreement_pct": round(agreement_pct, 3),
            "all_agree": all_agree,
            "strong_disagree": strong_disagree,
            "claude_reasoning": claude_response.get("reasoning", ""),
            "grok_reasoning": grok_response.get("reasoning", ""),
            "claude_risk_factors": claude_response.get("risk_factors", []),
            "grok_risk_factors": grok_response.get("risk_factors", []),
            "claude_sentiment": claude_response.get("sentiment_assessment", "neutral"),
            "grok_sentiment": grok_response.get("sentiment_assessment", "neutral"),
            "claude_regime": claude_response.get("market_regime", "unknown"),
            "grok_regime": grok_response.get("market_regime", "unknown"),
        }
```

#### `tracker.py` — Accuracy Tracker

```python
class AccuracyTracker:
    """When a trade closes, compare each advisor's prediction with actual result."""

    async def record_outcome(self, db: AsyncSession, trade_id: int, actual_result: dict):
        """Called when a trade closes. Updates accuracy records."""
        # Find the validation record for this trade
        validation = await db.execute(
            select(AIValidation).where(AIValidation.ft_trade_id == trade_id)
        )
        val = validation.scalar_one_or_none()
        if not val:
            return  # Trade wasn't validated by AI layer

        actual_profit = actual_result.get("close_profit_abs", 0)
        actual_direction = "short" if actual_result.get("is_short") else "long"
        was_profitable = actual_profit > 0

        # Score each advisor
        for advisor in ["freqai", "claude", "grok"]:
            predicted_dir = getattr(val, f"{advisor}_direction")
            confidence = getattr(val, f"{advisor}_confidence")

            direction_correct = predicted_dir == actual_direction
            # If advisor agreed with direction AND trade was profitable = correct
            # If advisor disagreed AND trade lost = also correct (warned us)
            was_correct = (direction_correct and was_profitable) or (
                not direction_correct and not was_profitable
            )

            accuracy_record = AIAccuracy(
                validation_id=val.id,
                advisor=advisor,
                predicted_direction=predicted_dir,
                predicted_confidence=confidence,
                actual_profit=actual_profit,
                was_profitable=was_profitable,
                was_correct=was_correct,
            )
            db.add(accuracy_record)

        await db.commit()
```

#### `scheduler.py` — Polling Loop

```python
class AIValidationScheduler:
    """Runs validation checks on a configurable interval."""

    def __init__(
        self,
        collector: SignalCollector,
        context_builder: ContextBuilder,
        gateway: LLMGateway,
        scorer: ScoreCalculator,
        tracker: AccuracyTracker,
        db_session_factory,
        interval_seconds: int = 60,
    ):
        self.collector = collector
        self.context_builder = context_builder
        self.gateway = gateway
        self.scorer = scorer
        self.tracker = tracker
        self.db_factory = db_session_factory
        self.interval = interval_seconds
        self._running = False

    async def start(self):
        """Start the polling loop."""
        self._running = True
        while self._running:
            try:
                await self._check_all_bots()
            except Exception as e:
                logger.error(f"AI validation cycle failed: {e}")
            await asyncio.sleep(self.interval)

    async def stop(self):
        self._running = False

    async def _check_all_bots(self):
        async with self.db_factory() as db:
            # Get all running bots
            bots = await db.execute(
                select(BotInstance).where(
                    BotInstance.status == BotStatus.RUNNING,
                    BotInstance.is_deleted.is_(False),
                )
            )
            for bot in bots.scalars():
                ft = FTClient(bot.api_url, bot.api_username, bot.api_password)
                new_signals = await self.collector.detect_new_signals(bot.id)
                for trade in new_signals:
                    await self._validate_trade(db, bot, ft, trade)

    async def _validate_trade(self, db, bot, ft, trade):
        # 1. Collect context
        context = await self.collector.collect_context(
            bot.id, trade["pair"], bot.timeframe or "1h"
        )

        # 2. Build prompt
        prompt = self.context_builder.build_prompt(trade, context)

        # 3. Query Claude + Grok in parallel
        responses = await self.gateway.validate_signal(prompt)

        # 4. Calculate scores
        scores = self.scorer.calculate(trade, responses["claude"], responses["grok"])

        # 5. Store
        validation = AIValidation(
            bot_id=bot.id,
            ft_trade_id=trade["trade_id"],
            pair=trade["pair"],
            freqai_direction=scores["freqai_direction"],
            freqai_confidence=scores["freqai_confidence"],
            claude_direction=scores["claude_direction"],
            claude_confidence=scores["claude_confidence"],
            claude_reasoning=scores["claude_reasoning"],
            claude_risk_factors=scores["claude_risk_factors"],
            claude_sentiment=scores["claude_sentiment"],
            claude_regime=scores["claude_regime"],
            grok_direction=scores["grok_direction"],
            grok_confidence=scores["grok_confidence"],
            grok_reasoning=scores["grok_reasoning"],
            grok_risk_factors=scores["grok_risk_factors"],
            grok_sentiment=scores["grok_sentiment"],
            grok_regime=scores["grok_regime"],
            combined_confidence=scores["combined_confidence"],
            agreement_pct=scores["agreement_pct"],
            all_agree=scores["all_agree"],
            strong_disagree=scores["strong_disagree"],
        )
        db.add(validation)
        await db.commit()

        # 6. Alert on strong disagreement
        if scores["strong_disagree"]:
            logger.warning(
                f"STRONG DISAGREE: {trade['pair']} — FreqAI says "
                f"{scores['freqai_direction']}, both Claude and Grok disagree!"
            )
            # TODO: Send Telegram notification
```

---

## 6. Database Schema

### New Tables (add to orchestrator DB — PostgreSQL)

```sql
-- AI signal validations
CREATE TABLE ai_validations (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bot_instances(id),
    ft_trade_id INTEGER NOT NULL,
    pair VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- FreqAI signal
    freqai_direction VARCHAR(10) NOT NULL,  -- 'long' | 'short'
    freqai_confidence FLOAT NOT NULL,        -- 0.0-1.0 (normalized do_predict)

    -- Claude response
    claude_direction VARCHAR(10) NOT NULL,
    claude_confidence FLOAT NOT NULL,
    claude_reasoning TEXT,
    claude_risk_factors JSONB DEFAULT '[]',
    claude_sentiment VARCHAR(20),
    claude_regime VARCHAR(30),

    -- Grok response
    grok_direction VARCHAR(10) NOT NULL,
    grok_confidence FLOAT NOT NULL,
    grok_reasoning TEXT,
    grok_risk_factors JSONB DEFAULT '[]',
    grok_sentiment VARCHAR(20),
    grok_regime VARCHAR(30),

    -- Combined scores
    combined_confidence FLOAT NOT NULL,
    agreement_pct FLOAT NOT NULL,
    all_agree BOOLEAN NOT NULL DEFAULT FALSE,
    strong_disagree BOOLEAN NOT NULL DEFAULT FALSE,

    -- Cost tracking
    claude_tokens_used INTEGER DEFAULT 0,
    grok_tokens_used INTEGER DEFAULT 0,
    total_cost_usd FLOAT DEFAULT 0.0
);

-- Accuracy tracking (filled when trade closes)
CREATE TABLE ai_accuracy (
    id SERIAL PRIMARY KEY,
    validation_id INTEGER NOT NULL REFERENCES ai_validations(id),
    advisor VARCHAR(10) NOT NULL,            -- 'freqai' | 'claude' | 'grok'
    predicted_direction VARCHAR(10) NOT NULL,
    predicted_confidence FLOAT NOT NULL,
    actual_profit FLOAT NOT NULL,
    was_profitable BOOLEAN NOT NULL,
    was_correct BOOLEAN NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_validations_bot ON ai_validations(bot_id, created_at DESC);
CREATE INDEX idx_ai_validations_pair ON ai_validations(pair, created_at DESC);
CREATE INDEX idx_ai_validations_disagree ON ai_validations(strong_disagree) WHERE strong_disagree = TRUE;
CREATE INDEX idx_ai_accuracy_advisor ON ai_accuracy(advisor, was_correct);
```

---

## 7. API Endpoints

### New Orchestrator Endpoints

```
GET  /api/ai/validations?bot_id=1&limit=50
     → List recent AI validations for a bot (paginated)

GET  /api/ai/validations/{ft_trade_id}
     → Get validation for specific trade

GET  /api/ai/accuracy
     → Accuracy stats per advisor: { "freqai": {"correct": 45, "total": 60, "pct": 75.0}, ... }

GET  /api/ai/accuracy/history?days=30
     → Rolling accuracy over time (for chart)

GET  /api/ai/agreement-rate?days=30
     → How often all 3 agree / 2 agree / all disagree

GET  /api/ai/cost?days=30
     → API cost breakdown: tokens used, USD spent per advisor

POST /api/ai/validate-now/{bot_id}
     → Manually trigger validation for all open trades on a bot

GET  /api/ai/config
     → Current AI validator configuration

PATCH /api/ai/config
     → Update config (weights, models, interval, enabled)
```

---

## 8. Frontend: AI Insights Page

### New Page: `/ai-insights`

This becomes the 9th page in our UI (after Risk).

#### Widgets (mapped to API endpoints):

```
AI-1:  Advisor Agreement Gauge — 3 circles (FreqAI/Claude/Grok) showing current
       direction for each open trade. Green = agree, Red = disagree.
       Source: GET /api/ai/validations?bot_id=X&limit=10

AI-2:  Combined Confidence Score — Large number (0-100%) with color scale.
       Source: combined_confidence from latest validation

AI-3:  Signal Comparison Table — One row per open trade:
       | Pair | FreqAI | Claude | Grok | Combined | Agreement | Alert |
       Source: GET /api/ai/validations

AI-4:  Advisor Reasoning Panel — Click a row in AI-3, see Claude's reasoning
       + Grok's reasoning side by side. Risk factors listed below.
       Source: claude_reasoning, grok_reasoning from validation

AI-5:  Accuracy Leaderboard — Bar chart: FreqAI vs Claude vs Grok accuracy %
       Source: GET /api/ai/accuracy

AI-6:  Rolling Accuracy Chart — Line chart (30 days): 3 lines showing each
       advisor's accuracy over time.
       Source: GET /api/ai/accuracy/history?days=30

AI-7:  Agreement Rate Pie — Pie chart: "All 3 agree" vs "2 agree" vs "All disagree"
       Source: GET /api/ai/agreement-rate

AI-8:  Market Regime Display — Badge showing Claude's and Grok's regime assessment
       (trending_bullish, ranging, volatile, etc.)
       Source: claude_regime, grok_regime from latest validation

AI-9:  Risk Factor Aggregator — Combined unique risk factors from both advisors.
       Sorted by frequency (if same risk mentioned by both = higher priority).
       Source: claude_risk_factors + grok_risk_factors

AI-10: Sentiment Gauge — 5-point scale from very_bearish to very_bullish.
       Shows Claude and Grok sentiment side by side.
       Source: claude_sentiment, grok_sentiment

AI-11: API Cost Tracker — Monthly spend, tokens used, cost per validation.
       Source: GET /api/ai/cost

AI-12: Manual Validate Button — Trigger validation on demand.
       Source: POST /api/ai/validate-now/{bot_id}

AI-13: Configuration Panel — Adjust weights, models, interval, enable/disable.
       Source: GET/PATCH /api/ai/config
```

#### Dashboard Integration

Add to existing Dashboard page:
- **D-24**: Small "AI Agreement" badge next to each open trade row
  - Green checkmark = all 3 agree
  - Yellow warning = 2 agree, 1 disagrees
  - Red alert = strong disagreement (both LLMs disagree with FreqAI)

---

## 9. Prompt Engineering

### System Prompt (shared by both Claude and Grok)

```
You are a cryptocurrency trading analyst working alongside a FreqAI ML model.
FreqAI uses LightGBM/XGBoost/PyTorch to analyze OHLCV data and technical indicators.
It has generated a trading signal. Your job is to provide a SECOND OPINION.

RULES:
1. Analyze the provided market data objectively
2. Consider factors the ML model might miss: macro events, market structure, liquidity
3. Be specific — reference actual price levels, percentages, and data points
4. If you agree with FreqAI, explain why the signal is strong
5. If you disagree, explain what FreqAI might be missing
6. Always return valid JSON matching the requested schema exactly
7. Keep reasoning to 2-3 sentences maximum
8. Confidence 0.0 = no confidence, 1.0 = absolute certainty
9. Never hallucinate data — only reference what is provided in the prompt

MARKET REGIMES:
- trending_bullish: Clear uptrend, higher highs/lows
- trending_bearish: Clear downtrend, lower highs/lows
- ranging: Price oscillating in a defined range
- volatile: Large candles, no clear direction
- breakout: Price breaking out of a range or pattern
```

### Prompt Size Management

To control costs, the prompt is capped at ~2000 tokens:
- Last 10 candles (not 100) — ~400 tokens
- Summary statistics instead of raw data — ~200 tokens
- Trade details — ~150 tokens
- Instructions + schema — ~250 tokens
- Total: ~1000 tokens input per request

At Grok 4.1 Fast pricing ($0.20/1M input): ~$0.0002 per validation (0.02 cents).
At Claude Sonnet pricing ($3/1M input): ~$0.003 per validation (0.3 cents).
Combined per validation: ~$0.0032 (~0.32 cents).
At 50 validations/day: ~$0.16/day, ~$4.80/month.

---

## 10. Sentiment Data Sources

### Phase 1 (implemented in this spec): Price-Only Analysis

Both LLMs analyze OHLCV data and technical structure. No external news feed.
This is sufficient because LLMs have training data knowledge about macro patterns.

### Phase 2 (future): News + Social Sentiment

Add external data to the prompt:
- CryptoPanic API (free tier: 5 req/min) — aggregated crypto news
- CoinGecko API (free) — market cap changes, trending coins
- Fear & Greed Index (free) — single sentiment number

These would be fetched by a `sentiment_fetcher.py` module and appended to the prompt context.

### Phase 3 (future): X/Twitter Integration

If Grok API supports it natively (xAI has X access), use Grok specifically for social sentiment while Claude focuses on technical + fundamental analysis.

---

## 11. Scoring & Comparison System

### Weight Configuration

```json
{
  "weights": {
    "freqai": 0.50,
    "claude": 0.30,
    "grok": 0.20
  },
  "adaptive_weights": false
}
```

When `adaptive_weights` is enabled (Phase 2), weights auto-adjust based on rolling 30-day accuracy:
- If Claude has 80% accuracy and Grok has 60%, Claude's weight increases
- FreqAI always has minimum 40% weight (it's the trading engine)
- Recalculated daily

### Agreement Thresholds

| Scenario | Alert Level | Action |
|----------|-------------|--------|
| All 3 agree | NONE | Green badge on trade |
| 2 agree, 1 neutral | LOW | Yellow badge |
| 2 agree, 1 disagrees | MEDIUM | Orange badge + log |
| Both LLMs disagree with FreqAI | HIGH | Red badge + Telegram notification |
| All 3 disagree on direction | CRITICAL | Red alert + prominent warning |

---

## 12. Configuration

### New Environment Variables

Add to `.env.example`:

```bash
# ── AI Validation Layer ──────────────────────────────
# OpenRouter API key (get from https://openrouter.ai/keys)
AI_OPENROUTER_API_KEY=sk-or-v1-CHANGE_ME

# Enable/disable the AI validation layer
AI_VALIDATION_ENABLED=true

# Polling interval (seconds) — how often to check for new signals
AI_VALIDATION_INTERVAL=60

# Models (OpenRouter model IDs)
AI_CLAUDE_MODEL=anthropic/claude-sonnet-4-5
AI_CLAUDE_FALLBACK=anthropic/claude-haiku-4-5-20251001
AI_GROK_MODEL=x-ai/grok-4.1-fast
AI_GROK_FALLBACK=x-ai/grok-3-mini-fast

# Weights (must sum to 1.0)
AI_WEIGHT_FREQAI=0.50
AI_WEIGHT_CLAUDE=0.30
AI_WEIGHT_GROK=0.20

# Cost controls
AI_MAX_DAILY_COST_USD=5.00
AI_MAX_VALIDATIONS_PER_HOUR=30

# Telegram notification on strong disagreement
AI_TELEGRAM_NOTIFY_DISAGREE=true
```

### Orchestrator Config (config.py addition)

```python
# AI Validation Layer
ai_openrouter_api_key: str = ""  # Required if AI enabled
ai_validation_enabled: bool = False
ai_validation_interval: int = 60
ai_claude_model: str = "anthropic/claude-sonnet-4-5"
ai_claude_fallback: str = "anthropic/claude-haiku-4-5-20251001"
ai_grok_model: str = "x-ai/grok-4.1-fast"
ai_grok_fallback: str = "x-ai/grok-3-mini-fast"
ai_weight_freqai: float = 0.50
ai_weight_claude: float = 0.30
ai_weight_grok: float = 0.20
ai_max_daily_cost_usd: float = 5.00
ai_max_validations_per_hour: int = 30
ai_telegram_notify_disagree: bool = True
```

---

## 13. Error Handling & Fallbacks

| Scenario | Handling |
|----------|----------|
| OpenRouter API down | Log error, skip validation, retry next cycle |
| Claude model unavailable | Use fallback model (Haiku) |
| Grok model unavailable | Use fallback model (Grok 3 Mini) |
| Both models fail | Store validation with error flags, show "AI Unavailable" in UI |
| Invalid JSON response | Retry once with explicit "Return ONLY valid JSON" appended |
| Rate limit hit | Exponential backoff (2s, 4s, 8s, max 60s) |
| Daily cost limit reached | Disable validations until midnight UTC, log warning |
| Hourly validation limit | Queue excess, process next hour |
| FT API unreachable | Skip AI validation (kill switch already handles this) |
| Token expired on FT | Re-authenticate via FTClient._login() (already implemented) |

---

## 14. Performance & Cost Management

### Token Budget Per Validation

| Component | Input Tokens | Output Tokens |
|-----------|-------------|---------------|
| System prompt | ~200 | — |
| Trade context | ~400 | — |
| Candle data (10 candles) | ~300 | — |
| Bot stats | ~100 | — |
| Response | — | ~300 |
| **Total per advisor** | **~1000** | **~300** |

### Monthly Cost Estimates

| Scenario | Validations/Day | Claude Cost | Grok Cost | Total/Month |
|----------|----------------|-------------|-----------|-------------|
| Low frequency | 10 | $0.90 | $0.06 | $0.96 |
| Medium | 50 | $4.50 | $0.30 | $4.80 |
| High (5 bots) | 200 | $18.00 | $1.20 | $19.20 |
| Max (10 bots, aggressive) | 500 | $45.00 | $3.00 | $48.00 |

### Optimization Strategies

1. **Batch similar pairs**: If multiple bots trade BTC/USDT, validate once and share results
2. **Skip redundant**: Don't re-validate if trade hasn't changed and last validation < 5 min ago
3. **Cheaper for confirmations**: If FreqAI confidence is very high (do_predict=2), use only Grok (cheapest) for quick confirmation
4. **Cache regime**: Market regime assessment is valid for ~1h, don't re-query every time

---

## 15. Security

- OpenRouter API key stored in `.env` ONLY (never in code, never in git)
- API key passed via environment variable, loaded by Pydantic Settings
- No trading permissions: AI layer has NO access to FT's trade endpoints (forceenter, forceexit)
- Read-only FT access: only status, candles, profit, performance endpoints
- Rate limiting on /api/ai/* endpoints (same as other orchestrator endpoints)
- Cost limit enforced server-side (not just frontend)
- Audit log entry for every manual validation trigger

---

## 16. Testing Plan

### Unit Tests

```
test_context_builder.py
  - test_build_prompt_long_trade
  - test_build_prompt_short_trade
  - test_format_candles
  - test_prompt_under_2000_tokens

test_scorer.py
  - test_all_agree
  - test_strong_disagree
  - test_combined_confidence_weighted
  - test_freqai_do_predict_normalization
  - test_custom_weights

test_response_parser.py
  - test_valid_json_response
  - test_invalid_json_retry
  - test_missing_fields_defaults

test_tracker.py
  - test_profitable_trade_correct_prediction
  - test_losing_trade_disagreement_was_correct
  - test_no_validation_record_skipped
```

### Integration Tests

```
test_llm_gateway_integration.py
  - test_claude_responds_valid_json (live API call, skip in CI)
  - test_grok_responds_valid_json
  - test_parallel_query_both_advisors
  - test_fallback_on_primary_failure

test_scheduler_integration.py
  - test_full_cycle_new_trade_detected
  - test_no_new_trades_no_validation
  - test_cost_limit_blocks_validation
```

### E2E Test

```
1. Start FT bot in dry_run with FreqAI enabled
2. Wait for FreqAI to generate a signal
3. AI validator detects new trade
4. Sends to Claude + Grok
5. Stores validation in DB
6. Frontend displays results
7. Trade closes
8. Accuracy tracker records outcome
9. Accuracy stats update
```

---

## 17. Implementation Phases

### Phase A: Core Infrastructure (Week 1)
- [ ] Database migration: ai_validations + ai_accuracy tables
- [ ] Config additions (config.py + .env.example)
- [ ] LLM Gateway (OpenRouter client with fallback)
- [ ] Response parser with JSON validation
- [ ] Unit tests for gateway and parser

### Phase B: Signal Collection + Scoring (Week 1-2)
- [ ] Signal collector (detect new trades from FT API)
- [ ] Context builder (structured prompt from FT data)
- [ ] Score calculator (weighted confidence + agreement)
- [ ] Accuracy tracker (record outcomes on trade close)
- [ ] Unit tests for collector, builder, scorer, tracker

### Phase C: Scheduler + API (Week 2)
- [ ] Polling scheduler (configurable interval)
- [ ] REST API endpoints (7 endpoints)
- [ ] Cost tracking and daily limit enforcement
- [ ] Integration tests

### Phase D: Frontend Page (Week 2-3)
- [ ] AI Insights page (13 widgets)
- [ ] Dashboard integration (D-24 agreement badge)
- [ ] Configuration panel in Settings
- [ ] Responsive design

### Phase E: Notifications + Polish (Week 3)
- [ ] Telegram notification on strong disagreement
- [ ] Adaptive weights (auto-adjust based on accuracy)
- [ ] Cost optimization (batching, caching)
- [ ] E2E testing
- [ ] Documentation update (CLAUDE.md, PAGE_SPECS.md)

### Phase F: Hyperopt AI Integration (Week 4-5)
- [ ] Strategy parameter parser (strategy_parser.py)
- [ ] Pre-hyperopt advisor (hyperopt_advisor.py — pre_analyze)
- [ ] Post-hyperopt overfitting detector (hyperopt_advisor.py — post_analyze)
- [ ] Database migration: ai_hyperopt_analyses + ai_hyperopt_outcomes tables
- [ ] API endpoints: /api/ai/hyperopt/* (5 endpoints)
- [ ] Frontend: HO-1 "AI Suggest" button on Backtesting page
- [ ] Frontend: HO-2 Pre-hyperopt suggestions panel
- [ ] Frontend: HO-3 Post-hyperopt overfitting badges on results table
- [ ] Frontend: HO-4 Suggestion accuracy tracker
- [ ] Outcome tracking + user feedback loop
- [ ] Integration tests for hyperopt AI flow
- [ ] Cost monitoring for hyperopt-specific queries

---

## 18. File Structure

### New Files to Create

```
orchestrator/src/ai_validator/
├── __init__.py
├── config.py
├── collector.py
├── context_builder.py
├── llm_gateway.py
├── response_parser.py
├── scorer.py
├── tracker.py
├── scheduler.py
└── models.py

orchestrator/src/api/ai.py              # API routes for /api/ai/*
orchestrator/alembic/versions/002_ai_validation_tables.py  # Migration

frontend/src/app/ai-insights/page.tsx    # New page
frontend/src/lib/api.ts                  # Add ai_* API functions

docs/AI_VALIDATION_LAYER_SPEC.md         # This file
docs/PAGE_SPECS.md                       # Add AI-1 through AI-13 widgets
```

### Modified Files

```
orchestrator/src/config.py               # Add AI config fields
orchestrator/src/main.py                 # Register AI scheduler + routes
orchestrator/requirements.txt            # Add httpx (if not already)
.env.example                             # Add AI_* variables
CLAUDE.md                                # Update architecture diagram + Phase 4
frontend/src/app/dashboard/page.tsx      # Add D-24 AI agreement badge
frontend/src/components/layout/AppShell.tsx  # Add AI Insights nav item
```

---

## 19. Hyperopt Integration

### 19.1 Overview

FreqTrade's Hyperopt (§6) performs hyperparameter optimization by testing thousands of parameter combinations against historical data. It supports 12 loss functions, 6 samplers, and can optimize buy/sell signals, ROI tables, stoploss, and trailing stoploss.

The AI Validation Layer integrates with Hyperopt at **three distinct points**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYPEROPT AI INTEGRATION                      │
│                                                                 │
│  POINT 1: PRE-HYPEROPT                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────┐    │
│  │ Strategy Code │───▶│ Claude/Grok  │───▶│ Suggested      │    │
│  │ + Market Data │    │ Analysis     │    │ Parameter      │    │
│  │ + Pair Info   │    │              │    │ Ranges +       │    │
│  └──────────────┘    └──────────────┘    │ Loss Function  │    │
│                                          │ + Sampler       │    │
│                                          └───────┬────────┘    │
│                                                  │             │
│  POINT 2: HYPEROPT EXECUTION (FreqTrade — no changes)          │
│  ┌──────────────────────────────────────────────┐│             │
│  │ freqtrade hyperopt --epochs N                ││             │
│  │   --spaces buy sell roi stoploss trailing    ││             │
│  │   --hyperopt-loss <ai_suggested_loss>        │◀             │
│  │   --random-state-method <ai_suggested>       │              │
│  └──────────────────┬───────────────────────────┘              │
│                     │                                          │
│  POINT 3: POST-HYPEROPT                                        │
│  ┌──────────────┐   │  ┌──────────────┐    ┌──────────────┐   │
│  │ Top 10       │◀──┘  │ Claude/Grok  │───▶│ Overfitting  │   │
│  │ Results      │──────▶│ Review       │    │ Risk Score   │   │
│  │ + Equity     │       │              │    │ + Best Pick  │   │
│  └──────────────┘       └──────────────┘    │ + Reasoning  │   │
│                                             └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 19.2 Point 1: Pre-Hyperopt — Smart Parameter Range Suggestions

**When:** Before user clicks "Run Hyperopt" on the Backtesting page.
**What:** Claude and Grok analyze the strategy code + recent market data and suggest:
- Optimal parameter ranges (narrower = faster optimization)
- Which loss function to use (out of 12 available)
- Which sampler to use (out of 6 available)
- Recommended number of epochs

**Why this matters:** Blind hyperopt over all possible ranges with 1000 epochs can take hours. LLMs can narrow the search space intelligently, reducing epochs to 200-400 while finding better results.

#### FT Hyperopt Loss Functions (§6)

```
1.  ShortTradeDurHyperOptLoss    — Minimize trade duration + maximize profit
2.  OnlyProfitHyperOptLoss       — Maximize total profit only
3.  SharpeHyperOptLoss           — Maximize Sharpe ratio
4.  SharpeHyperOptLossDaily      — Sharpe ratio on daily returns
5.  SortinoHyperOptLoss          — Maximize Sortino ratio
6.  SortinoHyperOptLossDaily     — Sortino on daily returns
7.  MaxDrawDownHyperOptLoss      — Minimize max drawdown
8.  MaxDrawDownRelativeHyperOptLoss — Minimize relative drawdown
9.  CalmarHyperOptLoss           — Maximize Calmar ratio
10. ProfitDrawDownHyperOptLoss   — Balance profit vs drawdown
11. MultiMetricHyperOptLoss      — Composite of multiple metrics
12. Custom loss functions         — User-defined (advanced)
```

#### FT Hyperopt Samplers (§6)

```
1. TPESampler          — Tree-structured Parzen Estimator (default, best for most)
2. RandomSampler       — Random search (baseline)
3. CmaEsSampler        — CMA Evolution Strategy (continuous params)
4. NSGAIISampler       — Multi-objective optimization
5. QMCSampler          — Quasi-Monte Carlo (better coverage)
6. MOTPESampler        — Multi-objective TPE
```

#### Pre-Hyperopt Prompt

```python
PRE_HYPEROPT_SYSTEM_PROMPT = """You are a quantitative trading advisor analyzing a FreqTrade strategy
before hyperparameter optimization. Your goal is to suggest smart parameter ranges that will
help hyperopt find better results faster.

You have access to:
- The strategy source code with its parameter definitions
- Recent market data (last 30 days: open/high/low/close/volume)
- The trading pair and timeframe
- Available loss functions and samplers

Your response MUST be valid JSON with this exact structure:
{
  "recommended_loss_function": "one of the 12 FT loss functions",
  "loss_function_reasoning": "why this loss function suits this strategy/market",
  "recommended_sampler": "one of the 6 FT samplers",
  "sampler_reasoning": "why this sampler is best here",
  "recommended_epochs": 200-1000,
  "parameter_suggestions": [
    {
      "param_name": "exact FT parameter name from strategy",
      "current_range": [low, high],
      "suggested_range": [low, high],
      "reasoning": "why narrow/widen this range"
    }
  ],
  "spaces_to_optimize": ["buy", "sell", "roi", "stoploss", "trailing"],
  "spaces_reasoning": "which spaces matter most and why",
  "general_advice": "overall strategy observations",
  "confidence": 0.0-1.0,
  "risk_factors": ["list of concerns"]
}"""
```

#### Pre-Hyperopt Context Builder

```python
# orchestrator/src/ai_validator/hyperopt_advisor.py

async def build_pre_hyperopt_context(
    strategy_code: str,
    pair: str,
    timeframe: str,
    recent_candles: list[dict],  # last 30 days OHLCV
    current_param_ranges: dict,  # from strategy file IntParameter/DecimalParameter definitions
    available_data_range: str,   # e.g., "2022-01-01 to 2026-03-28"
) -> str:
    """Build prompt context for pre-hyperopt LLM analysis."""

    # Summarize market conditions from candles
    closes = [c["close"] for c in recent_candles]
    highs = [c["high"] for c in recent_candles]
    lows = [c["low"] for c in recent_candles]

    price_change_pct = ((closes[-1] - closes[0]) / closes[0]) * 100
    volatility = max(highs) - min(lows)
    avg_volume = sum(c["volume"] for c in recent_candles) / len(recent_candles)

    # Detect market regime
    if price_change_pct > 10:
        regime = "STRONG_UPTREND"
    elif price_change_pct > 3:
        regime = "MILD_UPTREND"
    elif price_change_pct < -10:
        regime = "STRONG_DOWNTREND"
    elif price_change_pct < -3:
        regime = "MILD_DOWNTREND"
    else:
        regime = "RANGING"

    context = f"""## Strategy Analysis Request (Pre-Hyperopt)

### Strategy Code:
```python
{strategy_code[:3000]}  # Truncate if very long
```

### Trading Pair: {pair}
### Timeframe: {timeframe}
### Data Available: {available_data_range}

### Current Market Conditions (last 30 days):
- Regime: {regime}
- Price change: {price_change_pct:+.2f}%
- Volatility (high-low range): {volatility:.2f}
- Average daily volume: {avg_volume:,.0f}
- Current price: {closes[-1]:.2f}

### Current Parameter Ranges (from strategy):
{_format_param_ranges(current_param_ranges)}

### Available Loss Functions:
1. ShortTradeDurHyperOptLoss
2. OnlyProfitHyperOptLoss
3. SharpeHyperOptLoss / SharpeHyperOptLossDaily
4. SortinoHyperOptLoss / SortinoHyperOptLossDaily
5. MaxDrawDownHyperOptLoss / MaxDrawDownRelativeHyperOptLoss
6. CalmarHyperOptLoss
7. ProfitDrawDownHyperOptLoss
8. MultiMetricHyperOptLoss

### Available Samplers:
TPESampler, RandomSampler, CmaEsSampler, NSGAIISampler, QMCSampler, MOTPESampler

### Task:
Analyze this strategy and current market conditions.
Suggest optimal parameter ranges, loss function, and sampler.
Explain your reasoning for each suggestion.
"""
    return context


def _format_param_ranges(params: dict) -> str:
    """Format parameter ranges for prompt."""
    lines = []
    for name, info in params.items():
        param_type = info.get("type", "unknown")
        low = info.get("low", "?")
        high = info.get("high", "?")
        default = info.get("default", "?")
        lines.append(f"- {name} ({param_type}): range [{low}, {high}], default={default}")
    return "\n".join(lines) if lines else "No explicit parameter ranges found."
```

#### Strategy Parameter Parser

```python
# orchestrator/src/ai_validator/strategy_parser.py

import re

def parse_strategy_parameters(strategy_code: str) -> dict:
    """Extract IntParameter/DecimalParameter/CategoricalParameter from strategy code.

    This reads the actual .py strategy file and finds FT parameter definitions.
    Uses FT's exact parameter types: IntParameter, DecimalParameter, CategoricalParameter,
    BooleanParameter (§2, §14).
    """
    params = {}

    # Match IntParameter("name", low, high, default=X, space="buy")
    int_pattern = r'(\w+)\s*=\s*IntParameter\s*\(\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*default\s*=\s*(\d+))?(?:,\s*space\s*=\s*["\'](\w+)["\'])?\s*\)'
    for match in re.finditer(int_pattern, strategy_code):
        name, low, high, default, space = match.groups()
        params[name] = {
            "type": "IntParameter",
            "low": int(low),
            "high": int(high),
            "default": int(default) if default else None,
            "space": space or "buy",
        }

    # Match DecimalParameter("name", low, high, default=X, decimals=N, space="buy")
    dec_pattern = r'(\w+)\s*=\s*DecimalParameter\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*default\s*=\s*([\d.]+))?(?:,\s*decimals\s*=\s*(\d+))?(?:,\s*space\s*=\s*["\'](\w+)["\'])?\s*\)'
    for match in re.finditer(dec_pattern, strategy_code):
        name, low, high, default, decimals, space = match.groups()
        params[name] = {
            "type": "DecimalParameter",
            "low": float(low),
            "high": float(high),
            "default": float(default) if default else None,
            "decimals": int(decimals) if decimals else 3,
            "space": space or "buy",
        }

    # Match CategoricalParameter([...], default=X, space="buy")
    cat_pattern = r'(\w+)\s*=\s*CategoricalParameter\s*\(\s*\[(.*?)\]\s*(?:,\s*default\s*=\s*(.*?))?(?:,\s*space\s*=\s*["\'](\w+)["\'])?\s*\)'
    for match in re.finditer(cat_pattern, strategy_code):
        name, options, default, space = match.groups()
        params[name] = {
            "type": "CategoricalParameter",
            "options": [o.strip().strip("'\"") for o in options.split(",")],
            "default": default.strip().strip("'\"") if default else None,
            "space": space or "buy",
        }

    return params
```

### 19.3 Point 3: Post-Hyperopt — Overfitting Detection & Result Analysis

**When:** After hyperopt completes (user sees results table on Backtesting page).
**What:** Top N results (default: top 10) are sent to Claude and Grok. They analyze:
- Overfitting risk per parameter set
- Which result is most likely to perform well in live trading
- Red flags (suspiciously high profit, too few trades, extreme parameters)
- Comparison of Sharpe/Sortino/Calmar across results

**Why this matters:** Hyperopt's best result by score is often overfit. Traders spend hours manually reviewing results. Claude/Grok can do this analysis in seconds and catch patterns humans miss.

#### Post-Hyperopt Prompt

```python
POST_HYPEROPT_SYSTEM_PROMPT = """You are a quantitative trading advisor reviewing hyperparameter
optimization results from FreqTrade. Your job is to identify overfitting risks and recommend
which parameter set is most likely to perform well in LIVE trading (not just backtesting).

Key overfitting indicators to check:
1. Very few trades (< 50) with very high profit — likely curve-fitted
2. Parameters at extreme ends of their ranges — suggests range should be widened
3. Very high Sharpe (> 5) — suspiciously good, probably overfit
4. Inconsistent performance across sub-periods — not robust
5. Max drawdown near zero — unrealistic, probably overfit
6. Trade duration suspiciously uniform — data snooping

Your response MUST be valid JSON:
{
  "recommended_result_index": 0-9,
  "recommended_reasoning": "why this result is best for live trading",
  "overfitting_risk_scores": [
    {
      "result_index": 0,
      "risk_score": 0.0-1.0,
      "risk_factors": ["specific concerns"],
      "verdict": "SAFE | CAUTION | LIKELY_OVERFIT | DANGEROUS"
    }
  ],
  "parameter_observations": [
    {
      "param_name": "name",
      "observation": "what you noticed about this parameter's optimized value"
    }
  ],
  "general_analysis": "overall assessment of these hyperopt results",
  "next_steps": ["what the trader should do next"],
  "confidence": 0.0-1.0
}"""
```

#### Post-Hyperopt Context Builder

```python
async def build_post_hyperopt_context(
    strategy_name: str,
    pair: str,
    timeframe: str,
    hyperopt_results: list[dict],  # Top 10 from FT hyperopt
    epochs_run: int,
    loss_function_used: str,
    timerange: str,  # e.g., "20220101-20260328"
) -> str:
    """Build prompt context for post-hyperopt LLM analysis."""

    results_table = []
    for i, r in enumerate(hyperopt_results[:10]):
        results_table.append(f"""
### Result #{i + 1} (Epoch {r.get('current_epoch', '?')})
- Total profit: {r.get('profit_total', 0):.4f} ({r.get('profit_total_pct', 0):.2f}%)
- Profit per trade: {r.get('profit_mean', 0):.4f} ({r.get('profit_mean_pct', 0):.2f}%)
- Number of trades: {r.get('trade_count', 0)}
- Win rate: {r.get('wins', 0)}/{r.get('trade_count', 0)} ({r.get('win_rate', 0):.1f}%)
- Average duration: {r.get('duration_avg', 'unknown')}
- Max drawdown: {r.get('max_drawdown', 0):.2f}%
- Sharpe ratio: {r.get('sharpe', 0):.3f}
- Sortino ratio: {r.get('sortino', 0):.3f}
- Calmar ratio: {r.get('calmar', 0):.3f}
- Loss function score: {r.get('loss', 0):.6f}
- Parameters: {_format_result_params(r.get('params_dict', {}))}
""")

    context = f"""## Hyperopt Results Analysis Request

### Strategy: {strategy_name}
### Pair: {pair} | Timeframe: {timeframe}
### Time Range: {timerange}
### Loss Function: {loss_function_used}
### Total Epochs: {epochs_run}

### Top 10 Results:
{''.join(results_table)}

### Task:
1. Score each result's overfitting risk (0.0 = safe, 1.0 = overfit)
2. Recommend which result to use for live trading
3. Identify parameter values at extreme ends
4. Flag any red flags (too few trades, unrealistic Sharpe, etc.)
5. Suggest next steps (run more epochs? change loss function? paper trade first?)
"""
    return context


def _format_result_params(params: dict) -> str:
    """Format hyperopt result parameters."""
    return ", ".join(f"{k}={v}" for k, v in params.items())
```

### 19.4 Database Schema — Hyperopt AI Tables

```sql
-- AI analysis of hyperopt runs (linked to existing backtesting flow)
CREATE TABLE ai_hyperopt_analyses (
    id SERIAL PRIMARY KEY,
    bot_id INTEGER NOT NULL REFERENCES bot_instances(id),
    strategy_name VARCHAR(100) NOT NULL,
    pair VARCHAR(30) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    analysis_type VARCHAR(20) NOT NULL,  -- 'pre_hyperopt' | 'post_hyperopt'

    -- Pre-hyperopt suggestions
    suggested_loss_function VARCHAR(60),
    suggested_sampler VARCHAR(30),
    suggested_epochs INTEGER,
    suggested_param_ranges JSONB,    -- {param_name: {low, high, reasoning}}
    suggested_spaces JSONB,          -- ["buy", "sell", "roi", "stoploss"]

    -- Post-hyperopt analysis
    hyperopt_epochs_run INTEGER,
    loss_function_used VARCHAR(60),
    results_analyzed INTEGER,        -- how many results sent to LLMs
    recommended_result_index INTEGER,
    overfitting_scores JSONB,        -- [{index, risk_score, verdict, factors}]

    -- LLM responses
    claude_response JSONB NOT NULL DEFAULT '{}',
    grok_response JSONB NOT NULL DEFAULT '{}',
    claude_confidence FLOAT,
    grok_confidence FLOAT,

    -- Meta
    claude_tokens_used INTEGER DEFAULT 0,
    grok_tokens_used INTEGER DEFAULT 0,
    total_cost_usd FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track whether AI suggestions led to better results
CREATE TABLE ai_hyperopt_outcomes (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES ai_hyperopt_analyses(id),
    used_ai_suggestion BOOLEAN NOT NULL,  -- did user follow the suggestion?
    final_params JSONB,                    -- what they actually used
    paper_trade_result FLOAT,              -- profit if paper traded
    live_trade_result FLOAT,               -- profit if live traded (filled later)
    user_feedback VARCHAR(20),             -- 'helpful' | 'neutral' | 'wrong'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hyperopt_analyses_bot ON ai_hyperopt_analyses(bot_id, created_at DESC);
CREATE INDEX idx_hyperopt_analyses_type ON ai_hyperopt_analyses(analysis_type);
CREATE INDEX idx_hyperopt_outcomes_suggestion ON ai_hyperopt_outcomes(used_ai_suggestion);
```

### 19.5 API Endpoints — Hyperopt AI

```
POST /api/ai/hyperopt/pre-analyze
     Body: { bot_id, strategy_name, pair, timeframe }
     → Reads strategy file, fetches recent candles, queries Claude+Grok
     → Returns: suggested ranges, loss function, sampler, epochs
     → Used: Backtesting page, before user clicks "Run Hyperopt"

POST /api/ai/hyperopt/post-analyze
     Body: { bot_id, strategy_name, pair, timeframe, results: [...top10] }
     → Sends top 10 hyperopt results to Claude+Grok for review
     → Returns: overfitting scores, recommended result, reasoning
     → Used: Backtesting page, after hyperopt completes

GET  /api/ai/hyperopt/analyses?bot_id=1&limit=20
     → List past AI hyperopt analyses for a bot (paginated)

GET  /api/ai/hyperopt/analyses/{id}
     → Get specific analysis with full LLM reasoning

POST /api/ai/hyperopt/outcome
     Body: { analysis_id, used_ai_suggestion, final_params, user_feedback }
     → Track whether user followed AI suggestion and result
     → Used: feedback loop for improving AI advice quality
```

### 19.6 Frontend Integration — Backtesting Page

#### New Widgets on Backtesting Page:

```
HO-1: "AI Suggest" Button — Next to the "Run Hyperopt" button.
      Triggers POST /api/ai/hyperopt/pre-analyze.
      Shows loading spinner while Claude+Grok analyze.

HO-2: Pre-Hyperopt Suggestions Panel — Expandable panel that appears after HO-1:
      - Recommended loss function (with reasoning tooltip)
      - Recommended sampler (with reasoning tooltip)
      - Recommended epochs
      - Parameter range suggestions table:
        | Parameter | Current Range | Suggested Range | Reasoning |
      - "Apply Suggestions" button that auto-fills the hyperopt form
      - "Ignore" button to proceed with manual settings
      - Agreement indicator: Claude vs Grok (do they agree on loss function?)

HO-3: Post-Hyperopt AI Review — Auto-triggered when hyperopt results appear:
      - Overfitting risk gauge per result row (green/yellow/red)
      - "AI Recommended" badge on the safest result
      - Expandable reasoning panel (Claude vs Grok side-by-side)
      - Parameter observations list
      - Next steps recommendations

HO-4: AI Suggestion Accuracy — Small stats card (bottom of page):
      - "AI suggestions followed: X/Y times"
      - "Outcomes when followed: +Z% avg" vs "Outcomes when ignored: +W% avg"
      - Source: GET /api/ai/hyperopt/analyses with outcome joins
```

#### User Flow:

```
1. User opens Backtesting page, selects strategy, pair, timeframe
2. User clicks "AI Suggest" (HO-1)
3. System reads strategy file → parses parameters → fetches 30 days candles
4. Sends to Claude + Grok in parallel via OpenRouter
5. HO-2 panel appears with suggestions
6. User clicks "Apply Suggestions" or adjusts manually
7. User clicks "Run Hyperopt" (standard FT hyperopt runs, no modifications)
8. Results appear in table
9. System auto-sends top 10 to Claude + Grok (POST /api/ai/hyperopt/post-analyze)
10. HO-3 overlay appears on results: overfitting badges, recommended result
11. User selects result, applies to strategy
12. (Optional) User gives feedback via thumbs up/down → stored in ai_hyperopt_outcomes
```

### 19.7 Orchestrator Module

```python
# orchestrator/src/ai_validator/hyperopt_advisor.py

import asyncio
import logging
from datetime import datetime, timedelta

from .llm_gateway import LLMGateway
from .response_parser import parse_llm_response
from .strategy_parser import parse_strategy_parameters
from ..ft_client import FTClient
from ..database import get_session

logger = logging.getLogger(__name__)


class HyperoptAdvisor:
    """AI advisory layer for FreqTrade hyperopt optimization."""

    def __init__(self, gateway: LLMGateway, ft_client: FTClient):
        self.gateway = gateway
        self.ft = ft_client

    async def pre_analyze(
        self,
        bot_id: int,
        strategy_name: str,
        pair: str,
        timeframe: str,
    ) -> dict:
        """Analyze strategy before hyperopt run.
        Returns suggested parameter ranges, loss function, and sampler.
        """
        # 1. Read strategy source code from FT bot
        strategy_code = await self.ft.get_strategy_source(bot_id, strategy_name)
        if not strategy_code:
            raise ValueError(f"Strategy '{strategy_name}' not found on bot {bot_id}")

        # 2. Parse parameter definitions from code
        current_params = parse_strategy_parameters(strategy_code)

        # 3. Fetch recent candles for market context
        candles = await self.ft.get_pair_candles(
            bot_id, pair, timeframe, limit=30  # last 30 candles
        )

        # 4. Get available data range
        data_range = await self.ft.get_available_pairs(bot_id)
        pair_info = next((p for p in data_range if p["pair"] == pair), {})
        available_range = f"{pair_info.get('start', 'unknown')} to {pair_info.get('end', 'unknown')}"

        # 5. Build context
        context = await build_pre_hyperopt_context(
            strategy_code=strategy_code,
            pair=pair,
            timeframe=timeframe,
            recent_candles=candles,
            current_param_ranges=current_params,
            available_data_range=available_range,
        )

        # 6. Query Claude + Grok in parallel
        claude_task = self.gateway.query(
            model="claude",
            system_prompt=PRE_HYPEROPT_SYSTEM_PROMPT,
            user_content=context,
        )
        grok_task = self.gateway.query(
            model="grok",
            system_prompt=PRE_HYPEROPT_SYSTEM_PROMPT,
            user_content=context,
        )

        claude_raw, grok_raw = await asyncio.gather(
            claude_task, grok_task, return_exceptions=True
        )

        # 7. Parse responses
        claude_result = parse_llm_response(claude_raw) if not isinstance(claude_raw, Exception) else {}
        grok_result = parse_llm_response(grok_raw) if not isinstance(grok_raw, Exception) else {}

        # 8. Merge suggestions (prefer agreement, flag disagreements)
        merged = self._merge_pre_hyperopt(claude_result, grok_result, current_params)

        # 9. Store in DB
        async with get_session() as session:
            analysis = AIHyperoptAnalysis(
                bot_id=bot_id,
                strategy_name=strategy_name,
                pair=pair,
                timeframe=timeframe,
                analysis_type="pre_hyperopt",
                suggested_loss_function=merged["recommended_loss_function"],
                suggested_sampler=merged["recommended_sampler"],
                suggested_epochs=merged["recommended_epochs"],
                suggested_param_ranges=merged["parameter_suggestions"],
                suggested_spaces=merged["spaces_to_optimize"],
                claude_response=claude_result,
                grok_response=grok_result,
                claude_confidence=claude_result.get("confidence", 0),
                grok_confidence=grok_result.get("confidence", 0),
                claude_tokens_used=claude_raw.get("usage", {}).get("total_tokens", 0) if isinstance(claude_raw, dict) else 0,
                grok_tokens_used=grok_raw.get("usage", {}).get("total_tokens", 0) if isinstance(grok_raw, dict) else 0,
            )
            session.add(analysis)
            await session.commit()

        return merged

    async def post_analyze(
        self,
        bot_id: int,
        strategy_name: str,
        pair: str,
        timeframe: str,
        hyperopt_results: list[dict],
        epochs_run: int,
        loss_function_used: str,
        timerange: str,
    ) -> dict:
        """Analyze hyperopt results for overfitting risks.
        Returns overfitting scores and recommended result.
        """
        context = await build_post_hyperopt_context(
            strategy_name=strategy_name,
            pair=pair,
            timeframe=timeframe,
            hyperopt_results=hyperopt_results[:10],
            epochs_run=epochs_run,
            loss_function_used=loss_function_used,
            timerange=timerange,
        )

        # Query both in parallel
        claude_raw, grok_raw = await asyncio.gather(
            self.gateway.query("claude", POST_HYPEROPT_SYSTEM_PROMPT, context),
            self.gateway.query("grok", POST_HYPEROPT_SYSTEM_PROMPT, context),
            return_exceptions=True,
        )

        claude_result = parse_llm_response(claude_raw) if not isinstance(claude_raw, Exception) else {}
        grok_result = parse_llm_response(grok_raw) if not isinstance(grok_raw, Exception) else {}

        merged = self._merge_post_hyperopt(claude_result, grok_result)

        # Store in DB
        async with get_session() as session:
            analysis = AIHyperoptAnalysis(
                bot_id=bot_id,
                strategy_name=strategy_name,
                pair=pair,
                timeframe=timeframe,
                analysis_type="post_hyperopt",
                hyperopt_epochs_run=epochs_run,
                loss_function_used=loss_function_used,
                results_analyzed=len(hyperopt_results[:10]),
                recommended_result_index=merged["recommended_result_index"],
                overfitting_scores=merged["overfitting_risk_scores"],
                claude_response=claude_result,
                grok_response=grok_result,
                claude_confidence=claude_result.get("confidence", 0),
                grok_confidence=grok_result.get("confidence", 0),
            )
            session.add(analysis)
            await session.commit()

        return merged

    def _merge_pre_hyperopt(
        self, claude: dict, grok: dict, current_params: dict
    ) -> dict:
        """Merge Claude and Grok pre-hyperopt suggestions.
        When they agree: high confidence. When they disagree: show both.
        """
        result = {
            "recommended_loss_function": claude.get("recommended_loss_function",
                grok.get("recommended_loss_function", "SharpeHyperOptLossDaily")),
            "recommended_sampler": claude.get("recommended_sampler",
                grok.get("recommended_sampler", "TPESampler")),
            "recommended_epochs": min(
                claude.get("recommended_epochs", 500),
                grok.get("recommended_epochs", 500)
            ),
            "spaces_to_optimize": list(set(
                claude.get("spaces_to_optimize", ["buy", "sell"]) +
                grok.get("spaces_to_optimize", ["buy", "sell"])
            )),
            "parameter_suggestions": [],
            "advisors_agree_on_loss": (
                claude.get("recommended_loss_function") == grok.get("recommended_loss_function")
            ),
            "advisors_agree_on_sampler": (
                claude.get("recommended_sampler") == grok.get("recommended_sampler")
            ),
            "claude_reasoning": {
                "loss": claude.get("loss_function_reasoning", ""),
                "sampler": claude.get("sampler_reasoning", ""),
                "general": claude.get("general_advice", ""),
            },
            "grok_reasoning": {
                "loss": grok.get("loss_function_reasoning", ""),
                "sampler": grok.get("sampler_reasoning", ""),
                "general": grok.get("general_advice", ""),
            },
        }

        # Merge parameter suggestions — use intersection of narrowed ranges
        claude_params = {p["param_name"]: p for p in claude.get("parameter_suggestions", [])}
        grok_params = {p["param_name"]: p for p in grok.get("parameter_suggestions", [])}

        for param_name in current_params:
            claude_s = claude_params.get(param_name, {})
            grok_s = grok_params.get(param_name, {})

            if claude_s or grok_s:
                # Take the tighter of the two suggested ranges
                c_range = claude_s.get("suggested_range", [current_params[param_name].get("low"), current_params[param_name].get("high")])
                g_range = grok_s.get("suggested_range", [current_params[param_name].get("low"), current_params[param_name].get("high")])

                suggested_low = max(c_range[0], g_range[0]) if c_range and g_range else c_range[0] if c_range else g_range[0]
                suggested_high = min(c_range[1], g_range[1]) if c_range and g_range else c_range[1] if c_range else g_range[1]

                # Safety: don't let suggested range be invalid
                if suggested_low >= suggested_high:
                    suggested_low = min(c_range[0], g_range[0])
                    suggested_high = max(c_range[1], g_range[1])

                result["parameter_suggestions"].append({
                    "param_name": param_name,
                    "current_range": [current_params[param_name].get("low"), current_params[param_name].get("high")],
                    "suggested_range": [suggested_low, suggested_high],
                    "claude_reasoning": claude_s.get("reasoning", "No suggestion"),
                    "grok_reasoning": grok_s.get("reasoning", "No suggestion"),
                })

        return result

    def _merge_post_hyperopt(self, claude: dict, grok: dict) -> dict:
        """Merge Claude and Grok post-hyperopt analyses."""
        # Average overfitting scores
        c_scores = {s["result_index"]: s for s in claude.get("overfitting_risk_scores", [])}
        g_scores = {s["result_index"]: s for s in grok.get("overfitting_risk_scores", [])}

        merged_scores = []
        for idx in range(10):
            c = c_scores.get(idx, {})
            g = g_scores.get(idx, {})
            avg_risk = (c.get("risk_score", 0.5) + g.get("risk_score", 0.5)) / 2

            # Determine verdict from average
            if avg_risk < 0.25:
                verdict = "SAFE"
            elif avg_risk < 0.50:
                verdict = "CAUTION"
            elif avg_risk < 0.75:
                verdict = "LIKELY_OVERFIT"
            else:
                verdict = "DANGEROUS"

            merged_scores.append({
                "result_index": idx,
                "risk_score": round(avg_risk, 3),
                "verdict": verdict,
                "claude_factors": c.get("risk_factors", []),
                "grok_factors": g.get("risk_factors", []),
            })

        # Recommend the result with lowest risk that both agree on
        claude_rec = claude.get("recommended_result_index", 0)
        grok_rec = grok.get("recommended_result_index", 0)

        if claude_rec == grok_rec:
            recommended = claude_rec
        else:
            # Pick the one with lower overfitting risk
            c_risk = merged_scores[claude_rec]["risk_score"] if claude_rec < len(merged_scores) else 1.0
            g_risk = merged_scores[grok_rec]["risk_score"] if grok_rec < len(merged_scores) else 1.0
            recommended = claude_rec if c_risk <= g_risk else grok_rec

        return {
            "recommended_result_index": recommended,
            "advisors_agree": claude_rec == grok_rec,
            "claude_recommendation": claude_rec,
            "grok_recommendation": grok_rec,
            "overfitting_risk_scores": merged_scores,
            "claude_analysis": claude.get("general_analysis", ""),
            "grok_analysis": grok.get("general_analysis", ""),
            "claude_next_steps": claude.get("next_steps", []),
            "grok_next_steps": grok.get("next_steps", []),
            "parameter_observations": (
                claude.get("parameter_observations", []) +
                grok.get("parameter_observations", [])
            ),
        }
```

### 19.8 Cost Estimates — Hyperopt AI

```
Pre-Hyperopt Analysis:
  - Prompt size: ~3000 tokens (strategy code + market data + instructions)
  - Response size: ~800 tokens
  - Claude Sonnet: (3000 × $3 + 800 × $15) / 1M = $0.021
  - Grok Fast: (3000 × $0.20 + 800 × $0.50) / 1M = $0.001
  - Total per pre-analysis: ~$0.022
  - Frequency: 1-5 per day (manual trigger only)
  - Monthly estimate: ~$3.30 (at 5/day)

Post-Hyperopt Analysis:
  - Prompt size: ~5000 tokens (10 results with full metrics)
  - Response size: ~1200 tokens
  - Claude Sonnet: (5000 × $3 + 1200 × $15) / 1M = $0.033
  - Grok Fast: (5000 × $0.20 + 1200 × $0.50) / 1M = $0.002
  - Total per post-analysis: ~$0.035
  - Frequency: same as pre (each hyperopt run)
  - Monthly estimate: ~$5.25 (at 5/day)

Combined monthly: ~$8.55 (at 5 hyperopt runs per day — heavy usage)
Typical monthly: ~$2.50 (1-2 runs per day, normal usage)
```

### 19.9 Configuration — Hyperopt AI

```bash
# .env additions
AI_HYPEROPT_ENABLED=true
AI_HYPEROPT_AUTO_POST_ANALYZE=true     # Auto-trigger post-analysis when results arrive
AI_HYPEROPT_TOP_N_RESULTS=10           # How many results to send to LLMs
AI_HYPEROPT_MAX_STRATEGY_TOKENS=3000   # Truncate strategy code if longer
```

```python
# config.py additions
ai_hyperopt_enabled: bool = True
ai_hyperopt_auto_post_analyze: bool = True
ai_hyperopt_top_n_results: int = 10
ai_hyperopt_max_strategy_tokens: int = 3000
```

### 19.10 Updated File Structure

```
orchestrator/src/ai_validator/
├── __init__.py
├── config.py
├── collector.py          # Signal collection (existing)
├── context_builder.py    # Trade context (existing)
├── llm_gateway.py        # OpenRouter client (existing)
├── response_parser.py    # JSON parsing (existing)
├── scorer.py             # Weighted scoring (existing)
├── tracker.py            # Accuracy tracking (existing)
├── scheduler.py          # Polling scheduler (existing)
├── models.py             # SQLAlchemy models (existing)
├── hyperopt_advisor.py   # NEW — pre/post hyperopt analysis
└── strategy_parser.py    # NEW — parse strategy parameter definitions

orchestrator/src/api/
├── ai.py                 # Existing AI validation routes
└── ai_hyperopt.py        # NEW — /api/ai/hyperopt/* routes

orchestrator/alembic/versions/
├── 002_ai_validation_tables.py    # Existing
└── 003_ai_hyperopt_tables.py      # NEW — hyperopt AI tables

frontend/src/app/backtesting/
└── page.tsx              # MODIFIED — add HO-1 through HO-8 widgets
```

### 19.11 Phase-by-Phase Comparison Framework

#### Philosophy

The user must NEVER guess what came from where. Every result is shown with its source clearly labeled. The flow is:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  COMPARISON DISPLAY ARCHITECTURE                        │
│                                                                         │
│  TAB 1: "Raw Hyperopt"          ← What FreqTrade found (no AI)         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Standard FT results table: top N by loss function score       │     │
│  │ Columns: Epoch | Profit | Trades | WinRate | Sharpe | DD     │     │
│  │ This is EXACTLY what FT shows — zero modifications           │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  TAB 2: "Claude Analysis"       ← Claude's opinion on each result      │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Same results + Claude overlay:                                │     │
│  │ Columns: ...same... | Overfit Risk | Verdict | Reasoning      │     │
│  │ Claude's recommended result highlighted in green              │     │
│  │ Claude's rejected results highlighted in red                  │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  TAB 3: "Grok Analysis"         ← Grok's opinion on each result       │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Same results + Grok overlay:                                  │     │
│  │ Columns: ...same... | Overfit Risk | Verdict | Reasoning      │     │
│  │ Grok's recommended result highlighted in green                │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  TAB 4: "Comparison" (DEFAULT)  ← All three side by side              │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Merged view with agreement indicators:                        │     │
│  │ Columns: Epoch | Profit | Trades | WinRate | Sharpe | DD |   │     │
│  │          FT Rank | Claude Verdict | Grok Verdict | Agreement │     │
│  │                                                                │     │
│  │ Agreement column:                                              │     │
│  │   🟢 ALL AGREE    = FT top pick + Claude SAFE + Grok SAFE    │     │
│  │   🟡 PARTIAL      = 2 of 3 agree                              │     │
│  │   🔴 DISAGREE     = each has different recommendation         │     │
│  │                                                                │     │
│  │ Bottom panel: "Why they disagree" — side-by-side reasoning    │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  PANEL: "Pre-Hyperopt Suggestions Comparison"                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ What Claude suggested vs What Grok suggested vs What you used │     │
│  │ | Setting        | Claude Said | Grok Said  | You Used    |  │     │
│  │ | Loss Function  | Sortino     | Sharpe     | Sharpe      |  │     │
│  │ | Sampler        | TPE         | TPE        | TPE         |  │     │
│  │ | Epochs         | 300         | 500        | 400         |  │     │
│  │ | buy_rsi range  | [15, 35]    | [10, 40]   | [15, 35]    |  │     │
│  │                                                                │     │
│  │ Verdict: "You followed Claude's suggestion for loss function  │     │
│  │ and ranges. Grok agreed on sampler but wanted wider ranges."  │     │
│  └────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Updated Frontend Widgets (Backtesting Page)

```
HO-1: "AI Suggest" Button (unchanged — triggers pre-analysis)

HO-2: Pre-Hyperopt Suggestions Panel (unchanged — shows suggestions)

HO-3: Results Tab View — 4 tabs showing results from different perspectives:
      Tab "Raw Hyperopt": Standard FT results table, no AI data
      Tab "Claude Analysis": Results + Claude's overfit scores + reasoning
      Tab "Grok Analysis": Results + Grok's overfit scores + reasoning
      Tab "Comparison" (default): Merged view with agreement column
      Source: GET /api/ai/hyperopt/analyses/{id}

HO-4: Agreement Summary Card — Top of results area:
      "Claude and Grok AGREE on result #3 as safest (overfit risk: 0.12)"
      OR "Claude recommends #3, Grok recommends #5 — see reasoning below"
      Source: advisors_agree + recommended fields from post-analysis

HO-5: Pre vs Post Comparison — Did AI suggestions improve results?
      Table showing:
      | Metric           | Without AI | With AI Suggestions | Delta   |
      | Best Sharpe      | 2.31       | 3.15                | +0.84   |
      | Avg Overfit Risk | N/A        | 0.23                | —       |
      | Epochs Needed    | 1000       | 400                 | -600    |
      | Time Saved       | N/A        | ~60%                | —       |
      Source: Compare current run with last non-AI run for same strategy

HO-6: Advisor Reasoning Side-by-Side — Expandable panel per result:
      Left column: Claude's reasoning (why this result is safe/risky)
      Right column: Grok's reasoning (same result, different perspective)
      Bottom: Parameter observations from both, merged + deduplicated
      Source: claude_response, grok_response from analysis

HO-7: Historical Accuracy — "How often was AI right?"
      Line chart over time:
      - Line 1: "User followed AI suggestion" → outcome (profit %)
      - Line 2: "User ignored AI suggestion" → outcome (profit %)
      - Line 3: "AI agreement rate" (% of times Claude + Grok agreed)
      Source: GET /api/ai/hyperopt/comparison/history

HO-8: Parameter Heatmap — For the current strategy:
      Grid showing: each parameter × each result
      Color = how far from center of suggested range
      Green = within AI-suggested range
      Yellow = at edge of suggested range
      Red = outside suggested range
      Source: suggested_param_ranges + actual result params
```

### 19.12 Comparison API Endpoints

```
GET  /api/ai/hyperopt/comparison/{analysis_id}
     → Full comparison data for one hyperopt run:
     {
       "raw_results": [...],           // FT hyperopt results as-is
       "claude_analysis": {
         "recommended_index": 3,
         "overfit_scores": [...],
         "reasoning": "...",
         "confidence": 0.82
       },
       "grok_analysis": {
         "recommended_index": 3,
         "overfit_scores": [...],
         "reasoning": "...",
         "confidence": 0.78
       },
       "agreement": {
         "both_agree": true,
         "agreed_index": 3,
         "agreement_pct": 100,
         "disagreement_details": null
       },
       "pre_suggestions": {            // What AI suggested before hyperopt
         "claude": { "loss": "...", "sampler": "...", "ranges": {...} },
         "grok": { "loss": "...", "sampler": "...", "ranges": {...} },
         "user_used": { "loss": "...", "sampler": "...", "ranges": {...} }
       }
     }

GET  /api/ai/hyperopt/comparison/history?strategy=X&days=90
     → Historical comparison data for accuracy tracking:
     [
       {
         "date": "2026-03-15",
         "followed_ai": true,
         "ai_agreed": true,
         "ai_recommended_index": 3,
         "user_chose_index": 3,
         "paper_result_pct": 4.2,
         "live_result_pct": null,
         "overfit_risk_was": 0.15,
         "claude_confidence": 0.82,
         "grok_confidence": 0.78
       },
       ...
     ]

GET  /api/ai/hyperopt/comparison/stats?strategy=X
     → Aggregate stats:
     {
       "total_runs": 45,
       "ai_followed_count": 32,
       "ai_ignored_count": 13,
       "avg_profit_when_followed": 3.8,
       "avg_profit_when_ignored": 1.2,
       "ai_agreement_rate": 0.71,
       "claude_accuracy": 0.76,
       "grok_accuracy": 0.69,
       "both_correct_rate": 0.64,
       "best_advisor": "claude",
       "avg_overfit_risk_flagged": 0.34
     }
```

### 19.13 Comparison Database Additions

```sql
-- Track what the user actually chose vs what AI recommended
ALTER TABLE ai_hyperopt_outcomes ADD COLUMN
    ai_recommended_index INTEGER,           -- what AI said to pick
    user_chosen_index INTEGER,              -- what user actually picked
    followed_ai BOOLEAN GENERATED ALWAYS AS (ai_recommended_index = user_chosen_index) STORED,
    pre_analysis_id INTEGER REFERENCES ai_hyperopt_analyses(id),  -- link to pre-hyperopt suggestions
    hyperopt_settings_used JSONB,           -- loss function, sampler, epochs actually used
    matched_ai_loss_suggestion BOOLEAN,     -- did user use AI's suggested loss function?
    matched_ai_sampler_suggestion BOOLEAN,  -- did user use AI's suggested sampler?
    matched_ai_ranges FLOAT;               -- % of params within AI suggested ranges (0.0-1.0)

-- View for quick comparison stats
CREATE VIEW ai_hyperopt_comparison_stats AS
SELECT
    strategy_name,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE o.followed_ai = TRUE) as ai_followed,
    COUNT(*) FILTER (WHERE o.followed_ai = FALSE) as ai_ignored,
    AVG(o.paper_trade_result) FILTER (WHERE o.followed_ai = TRUE) as avg_profit_followed,
    AVG(o.paper_trade_result) FILTER (WHERE o.followed_ai = FALSE) as avg_profit_ignored,
    AVG(a.claude_confidence) as avg_claude_confidence,
    AVG(a.grok_confidence) as avg_grok_confidence,
    COUNT(*) FILTER (WHERE
        (a.claude_response->>'recommended_result_index')::int =
        (a.grok_response->>'recommended_result_index')::int
    ) * 100.0 / NULLIF(COUNT(*), 0) as agreement_rate_pct
FROM ai_hyperopt_analyses a
JOIN ai_hyperopt_outcomes o ON o.analysis_id = a.id
WHERE a.analysis_type = 'post_hyperopt'
GROUP BY strategy_name;
```

### 19.14 AI Insights Page — Hyperopt Comparison Section

New section on the existing AI Insights page (`/ai-insights`):

```
AI-14: Hyperopt AI Performance Card — Summary metrics:
       "AI suggestions followed: 32/45 (71%)"
       "Avg profit when followed: +3.8% | When ignored: +1.2%"
       "AI agreement rate: 71% (Claude + Grok agree)"
       Source: GET /api/ai/hyperopt/comparison/stats

AI-15: Hyperopt Advisor Accuracy Chart — Bar chart:
       Three bars: Claude accuracy %, Grok accuracy %, Both agree %
       Stacked by: "Correctly flagged overfit" + "Correctly identified safe"
       Source: GET /api/ai/hyperopt/comparison/stats

AI-16: Follow vs Ignore Profit Chart — Line chart over time:
       Line 1 (green): Cumulative profit when user followed AI
       Line 2 (red): Cumulative profit when user ignored AI
       Clear visual of whether AI advice adds value
       Source: GET /api/ai/hyperopt/comparison/history

AI-17: Recent Hyperopt Analyses Table:
       | Date | Strategy | Pair | AI Agreed? | Followed? | Overfit Risk | Outcome |
       Click row → opens full comparison view (HO-3 tab view)
       Source: GET /api/ai/hyperopt/analyses

AI-18: Parameter Range Effectiveness — Scatter plot:
       X axis: % of params within AI suggested range
       Y axis: Actual profit outcome
       Shows correlation: tighter adherence to AI ranges → better results?
       Source: matched_ai_ranges from outcomes + profit data
```

### 19.15 Complete User Flow with Comparison

```
FULL FLOW — Hyperopt with AI Comparison:

1. USER: Opens Backtesting page, selects strategy "MyRSIStrategy",
   pair BTC/USDT:USDT, timeframe 1h

2. USER: Clicks "AI Suggest" button (HO-1)
   SYSTEM: Reads strategy file → parses IntParameter/DecimalParameter
   SYSTEM: Fetches 30 days of candles from FT API
   SYSTEM: Sends to Claude + Grok in parallel

3. UI: HO-2 panel appears with TWO COLUMNS:
   ┌──────────────────┬──────────────────┐
   │  CLAUDE SUGGESTS  │  GROK SUGGESTS   │
   ├──────────────────┼──────────────────┤
   │ Loss: Sortino     │ Loss: Sharpe     │
   │ Sampler: TPE      │ Sampler: TPE     │
   │ Epochs: 300       │ Epochs: 500      │
   │ buy_rsi: [15, 35] │ buy_rsi: [10,40] │
   │ sell_rsi: [65, 85]│ sell_rsi: [70,90]│
   │ Confidence: 82%   │ Confidence: 78%  │
   └──────────────────┴──────────────────┘
   Middle column: "MERGED" (intersection of ranges)
   Button: "Apply Claude" | "Apply Grok" | "Apply Merged" | "Ignore"

4. USER: Clicks "Apply Merged" (or manually adjusts)
   SYSTEM: Auto-fills hyperopt form with merged suggestions
   SYSTEM: Records what user chose in hyperopt_settings_used

5. USER: Clicks "Run Hyperopt"
   SYSTEM: Standard FT hyperopt runs (CLI: freqtrade hyperopt ...)
   UI: Progress bar with epoch counter

6. HYPEROPT COMPLETES: Results table appears

7. UI: TAB VIEW (HO-3) — 4 tabs:

   TAB "Raw Hyperopt" (auto-selected first):
   ┌───────┬─────────┬────────┬─────────┬────────┬───────┐
   │ Epoch │ Profit  │ Trades │ WinRate │ Sharpe │  DD   │
   ├───────┼─────────┼────────┼─────────┼────────┼───────┤
   │  142  │ +12.3%  │   87   │  63.2%  │  2.41  │ -8.2% │
   │  289  │ +11.1%  │  124   │  59.7%  │  2.18  │ -6.1% │
   │  ... (8 more results)                                │
   └──────────────────────────────────────────────────────┘

   SYSTEM: Auto-sends top 10 to Claude + Grok (POST /api/ai/hyperopt/post-analyze)
   UI: Shows "Analyzing with AI..." spinner on other tabs

8. AI ANALYSIS COMPLETE — other tabs populate:

   TAB "Claude Analysis":
   ┌───────┬─────────┬────────┬─────────┬───────┬────────────────┬──────────────┐
   │ Epoch │ Profit  │ Trades │ WinRate │  DD   │ Overfit Risk   │ Verdict      │
   ├───────┼─────────┼────────┼─────────┼───────┼────────────────┼──────────────┤
   │  142  │ +12.3%  │   87   │  63.2%  │ -8.2% │ ████░░░ 0.61  │ ⚠ LIKELY_OVR │
   │  289  │ +11.1%  │  124   │  59.7%  │ -6.1% │ ██░░░░░ 0.18  │ ✅ SAFE       │ ← RECOMMENDED
   │  ... (8 more with scores)                                                   │
   └─────────────────────────────────────────────────────────────────────────────┘
   📝 Claude: "Result #1 has only 87 trades with 12.3% profit — suspiciously
   high per-trade. Result #2 has 124 trades with more consistent distribution.
   RSI parameters in #1 are at extreme range edges (buy_rsi=10), suggesting
   curve-fitting. Result #2's parameters are centered. Recommend #2."

   TAB "Grok Analysis":
   (Same format, Grok's independent scores and reasoning)

   TAB "Comparison" (DEFAULT after AI completes):
   ┌───────┬─────────┬────────┬───────┬───────────┬─────────────┬─────────────┬───────────┐
   │ Epoch │ Profit  │ Trades │ Sharpe│ FT Rank   │ Claude      │ Grok        │ Agreement │
   ├───────┼─────────┼────────┼───────┼───────────┼─────────────┼─────────────┼───────────┤
   │  142  │ +12.3%  │   87   │ 2.41  │ #1        │ ⚠ OVERFIT   │ ⚠ OVERFIT   │ 🟢 AGREE  │
   │  289  │ +11.1%  │  124   │ 2.18  │ #2        │ ✅ SAFE      │ ✅ SAFE      │ 🟢 AGREE  │
   │  401  │ +9.8%   │  156   │ 1.95  │ #3        │ ✅ SAFE      │ ⚠ CAUTION   │ 🟡 PARTIAL│
   │  ... (remaining results)                                                              │
   └───────────────────────────────────────────────────────────────────────────────────────┘

   HO-4: "✅ Claude and Grok AGREE: Result #2 (Epoch 289) is safest for live trading.
          Overfit risk: 0.18 (Claude) / 0.21 (Grok). 124 trades, Sharpe 2.18."

   HO-6: Side-by-side reasoning panel (expandable per result row)

9. USER: Selects result #2, clicks "Apply to Strategy"
   SYSTEM: Records user_chosen_index = 1 (0-indexed), followed_ai = true
   SYSTEM: Records matched_ai_ranges = 0.85 (85% of params within AI range)

10. USER: (Later) Clicks thumbs up/down
    SYSTEM: Stores user_feedback in ai_hyperopt_outcomes

11. OVER TIME: HO-7 chart builds up, showing whether AI advice
    actually correlated with better outcomes

```

### 19.16 Pre-Hyperopt Suggestion Comparison Detail

When the user gets pre-hyperopt suggestions, they see a full comparison table — not just a summary. This lets them make an informed choice about which advisor to follow:

```python
# Response format for GET /api/ai/hyperopt/comparison/{analysis_id}
# when analysis_type == "pre_hyperopt"

{
  "analysis_type": "pre_hyperopt",
  "strategy_name": "MyRSIStrategy",
  "pair": "BTC/USDT:USDT",
  "timeframe": "1h",

  "market_context": {
    "regime": "MILD_UPTREND",
    "price_change_30d_pct": 5.2,
    "volatility": 3200.50,
    "current_price": 68450.00
  },

  "comparison": {
    "loss_function": {
      "claude": {"value": "SortinoHyperOptLossDaily", "reasoning": "Sortino penalizes downside volatility more than Sharpe, better for trending markets where you want to capture upside without penalizing upward volatility."},
      "grok": {"value": "SharpeHyperOptLossDaily", "reasoning": "Sharpe is more general-purpose and works well in mild trends. Sortino can overfit to one-sided moves."},
      "agree": false,
      "merged": "SortinoHyperOptLossDaily"  // Higher confidence advisor wins
    },
    "sampler": {
      "claude": {"value": "TPESampler", "reasoning": "TPE is most efficient for strategies with < 10 parameters. Converges faster than random."},
      "grok": {"value": "TPESampler", "reasoning": "Default TPE is best unless you have many objectives. Strategy has 6 params, TPE handles this well."},
      "agree": true,
      "merged": "TPESampler"
    },
    "epochs": {
      "claude": {"value": 300, "reasoning": "6 parameters, TPE sampler — 300 epochs gives 50x coverage per param. Diminishing returns after."},
      "grok": {"value": 500, "reasoning": "More epochs never hurts with TPE. 500 gives better convergence guarantee."},
      "agree": false,
      "merged": 400  // Average when they disagree
    },
    "parameters": [
      {
        "name": "buy_rsi",
        "type": "IntParameter",
        "current_range": [5, 50],
        "claude": {"range": [15, 35], "reasoning": "RSI below 15 is extremely oversold and rare in BTC. Above 35 isn't really oversold. Narrowing saves ~60% of search space."},
        "grok": {"range": [10, 40], "reasoning": "Keep slightly wider than Claude suggests. BTC can hit RSI 10 during flash crashes — worth capturing."},
        "merged_range": [15, 35],  // Intersection
        "agree": false,
        "range_overlap_pct": 80.0
      },
      {
        "name": "sell_rsi",
        "type": "IntParameter",
        "current_range": [50, 95],
        "claude": {"range": [65, 85], "reasoning": "RSI above 85 is rare and usually means a rapid spike that reverses too fast for position exit."},
        "grok": {"range": [70, 90], "reasoning": "BTC often sustains high RSI in bull runs. 70-90 captures the sweet spot."},
        "merged_range": [70, 85],  // Intersection
        "agree": false,
        "range_overlap_pct": 75.0
      }
    ],
    "spaces": {
      "claude": {"value": ["buy", "sell", "stoploss"], "reasoning": "ROI table optimization tends to overfit. Focus on entry/exit signals and stoploss."},
      "grok": {"value": ["buy", "sell", "roi", "stoploss"], "reasoning": "Include ROI — it helps set profit targets that work with the strategy's RSI logic."},
      "agree": false,
      "merged": ["buy", "sell", "stoploss"]  // Conservative: only spaces both agree on, plus any either flagged as critical
    }
  },

  "overall": {
    "claude_confidence": 0.82,
    "grok_confidence": 0.78,
    "agreement_rate": 0.40,  // 2 out of 5 categories agree (sampler + none of the params)
    "summary": "Advisors agree on sampler (TPE) but disagree on loss function and parameter ranges. Claude is more conservative (narrower ranges, fewer epochs, exclude ROI optimization). Grok prefers wider exploration."
  }
}
```

### 19.17 Outcome-Based Learning

Over time the system tracks whether following AI advice leads to better results. This creates a feedback loop:

```python
# orchestrator/src/ai_validator/hyperopt_learner.py

class HyperoptLearner:
    """Tracks outcomes of AI hyperopt suggestions to improve future advice.

    NOT modifying FreqTrade or FreqAI. This only:
    1. Records whether user followed suggestion
    2. Records actual profit outcome
    3. Computes which advisor (Claude/Grok) gives better hyperopt advice
    4. Adjusts display weights for pre-hyperopt suggestions
    """

    async def compute_advisor_accuracy(self, strategy_name: str | None = None) -> dict:
        """Compute which advisor gives better hyperopt advice.

        Returns accuracy stats that inform the UI on which advisor's
        suggestions to highlight or weight higher.
        """
        async with get_session() as session:
            query = select(AIHyperoptOutcome).join(AIHyperoptAnalysis)
            if strategy_name:
                query = query.where(AIHyperoptAnalysis.strategy_name == strategy_name)
            query = query.where(AIHyperoptOutcome.paper_trade_result.isnot(None))

            outcomes = (await session.execute(query)).scalars().all()

        if not outcomes:
            return {"enough_data": False, "min_runs_needed": 10}

        followed = [o for o in outcomes if o.followed_ai]
        ignored = [o for o in outcomes if not o.followed_ai]

        return {
            "enough_data": len(outcomes) >= 10,
            "total_runs": len(outcomes),
            "followed_count": len(followed),
            "ignored_count": len(ignored),
            "avg_profit_followed": (
                sum(o.paper_trade_result for o in followed) / len(followed)
                if followed else 0
            ),
            "avg_profit_ignored": (
                sum(o.paper_trade_result for o in ignored) / len(ignored)
                if ignored else 0
            ),
            "ai_adds_value": (
                (sum(o.paper_trade_result for o in followed) / len(followed)) >
                (sum(o.paper_trade_result for o in ignored) / len(ignored))
                if followed and ignored else None
            ),
            "recommendation": self._generate_recommendation(followed, ignored),
        }

    def _generate_recommendation(self, followed: list, ignored: list) -> str:
        if not followed or not ignored:
            return "Not enough data yet. Need at least 5 runs with AI and 5 without."
        avg_f = sum(o.paper_trade_result for o in followed) / len(followed)
        avg_i = sum(o.paper_trade_result for o in ignored) / len(ignored)
        if avg_f > avg_i * 1.2:  # 20% better
            return "AI suggestions are significantly improving outcomes. Keep following them."
        elif avg_f > avg_i:
            return "AI suggestions show slight improvement. More data needed."
        elif avg_i > avg_f * 1.2:
            return "Your manual parameter selection is outperforming AI suggestions. Consider using AI as reference only."
        else:
            return "No significant difference between AI-guided and manual optimization."
```

### 19.18 Updated Phase F Implementation Plan

```
Phase F: Hyperopt AI Integration (Week 4-5)

Week 4:
  Day 1-2:
  - [ ] strategy_parser.py — parse IntParameter/DecimalParameter from .py files
  - [ ] hyperopt_advisor.py — pre_analyze() with prompt + context builder
  - [ ] Unit tests for parser (various strategy formats)

  Day 3-4:
  - [ ] hyperopt_advisor.py — post_analyze() with overfitting detection
  - [ ] Merge logic (_merge_pre_hyperopt, _merge_post_hyperopt)
  - [ ] DB migration: ai_hyperopt_analyses + ai_hyperopt_outcomes
  - [ ] Unit tests for merge logic and scoring

  Day 5:
  - [ ] API endpoints: ai_hyperopt.py (5 endpoints)
  - [ ] Comparison endpoint with full response format
  - [ ] Integration test: pre-analyze → hyperopt → post-analyze flow

Week 5:
  Day 1-2:
  - [ ] Frontend: HO-1 "AI Suggest" button
  - [ ] Frontend: HO-2 Pre-hyperopt comparison panel (Claude vs Grok columns)
  - [ ] Frontend: HO-3 Results tab view (4 tabs: Raw/Claude/Grok/Comparison)

  Day 3-4:
  - [ ] Frontend: HO-4 Agreement summary card
  - [ ] Frontend: HO-5 Pre vs Post comparison table
  - [ ] Frontend: HO-6 Side-by-side reasoning panel
  - [ ] Frontend: HO-7 Historical accuracy chart
  - [ ] Frontend: HO-8 Parameter heatmap

  Day 5:
  - [ ] AI Insights page: AI-14 through AI-18 widgets
  - [ ] Outcome tracking + user feedback (thumbs up/down)
  - [ ] hyperopt_learner.py — accuracy computation
  - [ ] Comparison API endpoints (history, stats)
  - [ ] E2E test: full flow with comparison views
  - [ ] Cost monitoring for hyperopt-specific queries
```

### 19.19 Backtest as Base Analysis Layer (4-Way Comparison)

#### Philosophy

Backtest is the **baseline truth**. Without it, hyperopt results and AI opinions have no context. The comparison flow must always be:

```
BACKTEST (base) → HYPEROPT (optimization) → CLAUDE (review) → GROK (review)
```

Every analysis starts with: "How much did hyperopt improve over the base backtest? And do Claude/Grok think those improvements are real or overfit?"

#### The 4 Analysis Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4-WAY ANALYSIS PIPELINE                                  │
│                                                                             │
│  LAYER 1: BACKTEST (FT §5)                        ← THE BASELINE           │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ Strategy with DEFAULT parameters → freqtrade backtesting          │     │
│  │ Result: profit, trades, Sharpe, Sortino, max_drawdown             │     │
│  │ This is what the strategy does WITHOUT any optimization           │     │
│  │ ALWAYS runs first. Everything else is measured against this.      │     │
│  └──────────────────────────────┬─────────────────────────────────────┘     │
│                                 │                                           │
│  LAYER 2: HYPEROPT (FT §6)     │                  ← THE OPTIMIZATION       │
│  ┌──────────────────────────────▼─────────────────────────────────────┐     │
│  │ Same strategy, optimized parameters → freqtrade hyperopt          │     │
│  │ Result: top 10 parameter sets with metrics                        │     │
│  │ Improvement vs baseline: "Hyperopt #2 is +45% better than base"   │     │
│  └──────────────────────────────┬─────────────────────────────────────┘     │
│                                 │                                           │
│  LAYER 3: CLAUDE REVIEW         │                  ← AI SECOND OPINION      │
│  ┌──────────────────────────────▼─────────────────────────────────────┐     │
│  │ Receives: base backtest metrics + hyperopt results                │     │
│  │ Analyzes: is the improvement real or overfit?                     │     │
│  │ Returns: overfitting risk, recommended result, reasoning          │     │
│  │ Key question: "Is the 45% improvement genuine?"                   │     │
│  └──────────────────────────────┬─────────────────────────────────────┘     │
│                                 │                                           │
│  LAYER 4: GROK REVIEW           │                  ← AI THIRD OPINION       │
│  ┌──────────────────────────────▼─────────────────────────────────────┐     │
│  │ Same inputs as Claude, independent analysis                       │     │
│  │ Different perspective — catches things Claude might miss          │     │
│  │ Returns: same structure, different reasoning                      │     │
│  └──────────────────────────────┬─────────────────────────────────────┘     │
│                                 │                                           │
│  COMPARISON ENGINE               │                  ← AGGREGATE             │
│  ┌──────────────────────────────▼─────────────────────────────────────┐     │
│  │ All 4 layers displayed together:                                  │     │
│  │ "Base profit: +5.2% → Hyperopt best: +12.3% (+136% improvement)  │     │
│  │  Claude: LIKELY OVERFIT (0.61) → Grok: LIKELY OVERFIT (0.58)     │     │
│  │  Claude safe pick: #2 (+11.1%, risk 0.18)                        │     │
│  │  Grok safe pick: #2 (+11.1%, risk 0.21)                          │     │
│  │  CONSENSUS: Use result #2, +113% over baseline, low overfit risk"│     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Updated Flow: Backtest Runs First

```
COMPLETE USER FLOW WITH 4-WAY ANALYSIS:

1. USER: Selects strategy, pair, timeframe on Backtesting page

2. STEP 1 — BASELINE BACKTEST:
   USER: Clicks "Run Backtest" (standard FT backtest with DEFAULT params)
   SYSTEM: freqtrade backtesting --strategy MyRSIStrategy --timerange 20220101-
   RESULT: Baseline metrics stored:
     - base_profit: +5.2%
     - base_trades: 210
     - base_sharpe: 1.15
     - base_sortino: 1.42
     - base_max_drawdown: -14.3%
     - base_win_rate: 52.4%
   UI: Shows baseline results in "Backtest Results" section

3. STEP 2 — AI PRE-HYPEROPT:
   USER: Clicks "AI Suggest" (HO-1)
   SYSTEM: Sends strategy + market data + BASELINE METRICS to Claude/Grok
   KEY: Claude/Grok now see the baseline, so they can say:
     "Your base Sharpe is 1.15. A realistic hyperopt target is 1.8-2.5.
      If hyperopt gives you Sharpe > 4.0, it's probably overfit."
   UI: Shows pre-hyperopt suggestions (HO-2)

4. STEP 3 — HYPEROPT:
   USER: Clicks "Run Hyperopt" (with or without AI suggestions applied)
   SYSTEM: Standard FT hyperopt runs
   RESULT: Top 10 results

5. STEP 4 — AI POST-HYPEROPT + 4-WAY COMPARISON:
   SYSTEM: Sends to Claude/Grok: baseline metrics + top 10 hyperopt results
   PROMPT INCLUDES: "The baseline (default params) achieved +5.2% profit,
   Sharpe 1.15, 210 trades. Analyze whether the hyperopt improvements
   are realistic relative to this baseline."

6. UI: 4-WAY COMPARISON VIEW (HO-3 updated to 5 tabs):
   Tab "Baseline":     Raw backtest results with default params
   Tab "Hyperopt":     Top 10 optimized results
   Tab "Claude":       Hyperopt results + Claude's analysis vs baseline
   Tab "Grok":         Hyperopt results + Grok's analysis vs baseline
   Tab "Comparison":   All 4 sources side by side
```

#### Updated Comparison Tab Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  4-WAY COMPARISON VIEW                                                      │
│                                                                              │
│  BASELINE METRICS (always visible at top):                                   │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │ 📊 Baseline: +5.2% profit | 210 trades | Sharpe 1.15 | DD -14.3% │      │
│  └────────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  HYPEROPT RESULTS vs BASELINE:                                               │
│  ┌──────┬─────────┬────────┬────────┬────────┬──────────┬──────┬──────┬────┐│
│  │Result│ Profit  │vs Base │ Trades │ Sharpe │ vs Base  │Claude│ Grok │Agr ││
│  ├──────┼─────────┼────────┼────────┼────────┼──────────┼──────┼──────┼────┤│
│  │  #1  │ +12.3%  │+136%   │   87   │  2.41  │ +110%    │⚠ OVR│⚠ OVR│ 🟢 ││
│  │  #2  │ +11.1%  │+113%   │  124   │  2.18  │  +90%    │✅ OK │✅ OK │ 🟢 ││
│  │  #3  │ +9.8%   │ +88%   │  156   │  1.95  │  +70%    │✅ OK │⚠ CAU│ 🟡 ││
│  │  #4  │ +9.1%   │ +75%   │  143   │  1.87  │  +63%    │✅ OK │✅ OK │ 🟢 ││
│  │ ...  │         │        │        │        │          │      │      │    ││
│  └──────┴─────────┴────────┴────────┴────────┴──────────┴──────┴──────┴────┘│
│                                                                              │
│  KEY INSIGHT PANEL:                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │ 📋 SUMMARY:                                                       │      │
│  │ • Hyperopt improved profit by +75% to +136% over baseline         │      │
│  │ • Result #1 shows largest improvement but BOTH AI advisors        │      │
│  │   flag it as overfit (87 trades vs 210 baseline — suspicious)     │      │
│  │ • Result #2 is recommended: +113% improvement with low risk       │      │
│  │   (124 trades, reasonable Sharpe improvement)                     │      │
│  │ • Results #3-#4 are also safe but offer less improvement          │      │
│  │                                                                    │      │
│  │ 🎯 RECOMMENDATION:                                                │      │
│  │ "Apply Result #2. It maintains a healthy trade count (124 vs 210  │      │
│  │  baseline) while doubling your Sharpe ratio. Both Claude and Grok │      │
│  │  agree this result is unlikely to be overfit."                    │      │
│  └────────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  IMPROVEMENT CHART (visual):                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │   Profit:   Base ████████████ +5.2%                               │      │
│  │             #2   █████████████████████████ +11.1% (+113%)         │      │
│  │                                                                    │      │
│  │   Sharpe:   Base ████████████ 1.15                                │      │
│  │             #2   ██████████████████████ 2.18 (+90%)               │      │
│  │                                                                    │      │
│  │   Trades:   Base █████████████████████████ 210                    │      │
│  │             #2   ███████████████ 124 (-41%) ← expected with opt   │      │
│  │                                                                    │      │
│  │   Drawdown: Base ██████████████████ -14.3%                        │      │
│  │             #2   ████████████ -6.1% (+57% less DD)                │      │
│  └────────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Updated Post-Hyperopt Prompt (Includes Baseline)

```python
POST_HYPEROPT_SYSTEM_PROMPT_V2 = """You are a quantitative trading advisor reviewing hyperparameter
optimization results from FreqTrade. You are given BOTH the baseline backtest results (strategy
with default parameters) AND the hyperopt-optimized results.

Your job is to:
1. Compare each hyperopt result against the BASELINE (not just against each other)
2. Judge whether improvements over baseline are realistic or overfit
3. Flag results where the improvement is suspiciously large relative to the change in parameters

KEY OVERFITTING RULES:
- If a result has FEWER trades than baseline but MUCH higher profit → suspicious
- If Sharpe jumped more than 3x from baseline → almost certainly overfit
- If max drawdown dropped to near zero → unrealistic
- If parameters moved to extreme edges → curve-fitting
- If profit improved > 200% over baseline → requires extraordinary justification
- Trade count should stay within 40-120% of baseline trade count for similar timeranges

Your response MUST be valid JSON:
{
  "baseline_comparison": {
    "baseline_profit_pct": float,
    "baseline_sharpe": float,
    "baseline_trades": int,
    "baseline_max_dd": float,
    "realistic_improvement_range": "expected % improvement over baseline"
  },
  "recommended_result_index": 0-9,
  "recommended_reasoning": "why, specifically citing baseline comparison",
  "overfitting_risk_scores": [
    {
      "result_index": 0,
      "risk_score": 0.0-1.0,
      "improvement_vs_baseline_pct": float,
      "trade_count_ratio": float,   // result_trades / baseline_trades
      "sharpe_ratio_change": float,  // result_sharpe / baseline_sharpe
      "risk_factors": ["specific concerns relative to baseline"],
      "verdict": "SAFE | CAUTION | LIKELY_OVERFIT | DANGEROUS"
    }
  ],
  "parameter_observations": [...],
  "general_analysis": "overall, referencing baseline context",
  "next_steps": ["what to do next"],
  "confidence": 0.0-1.0
}"""
```

#### Updated Post-Hyperopt Context (Includes Baseline)

```python
async def build_post_hyperopt_context_v2(
    strategy_name: str,
    pair: str,
    timeframe: str,
    baseline_result: dict,        # Backtest with DEFAULT params
    hyperopt_results: list[dict], # Top 10 from hyperopt
    epochs_run: int,
    loss_function_used: str,
    timerange: str,
) -> str:
    """Build context that includes baseline for comparison."""

    context = f"""## Hyperopt Results Analysis (vs Baseline)

### Strategy: {strategy_name}
### Pair: {pair} | Timeframe: {timeframe}
### Time Range: {timerange}
### Loss Function: {loss_function_used}
### Total Epochs: {epochs_run}

### ⭐ BASELINE BACKTEST (Default Parameters — This is the reference point):
- Profit: {baseline_result.get('profit_total_pct', 0):.2f}%
- Number of trades: {baseline_result.get('trade_count', 0)}
- Win rate: {baseline_result.get('win_rate', 0):.1f}%
- Average trade duration: {baseline_result.get('duration_avg', 'unknown')}
- Max drawdown: {baseline_result.get('max_drawdown', 0):.2f}%
- Sharpe ratio: {baseline_result.get('sharpe', 0):.3f}
- Sortino ratio: {baseline_result.get('sortino', 0):.3f}
- Calmar ratio: {baseline_result.get('calmar', 0):.3f}

### Hyperopt Results (compare each against baseline above):
"""
    for i, r in enumerate(hyperopt_results[:10]):
        profit = r.get('profit_total_pct', 0)
        base_profit = baseline_result.get('profit_total_pct', 0.01)
        improvement = ((profit - base_profit) / abs(base_profit)) * 100 if base_profit else 0

        context += f"""
#### Result #{i + 1} (Epoch {r.get('current_epoch', '?')}) — {improvement:+.0f}% vs baseline
- Profit: {profit:.2f}% (baseline: {base_profit:.2f}%)
- Trades: {r.get('trade_count', 0)} (baseline: {baseline_result.get('trade_count', 0)})
- Win rate: {r.get('win_rate', 0):.1f}%
- Max drawdown: {r.get('max_drawdown', 0):.2f}%
- Sharpe: {r.get('sharpe', 0):.3f} (baseline: {baseline_result.get('sharpe', 0):.3f})
- Sortino: {r.get('sortino', 0):.3f}
- Parameters: {_format_result_params(r.get('params_dict', {}))}
"""

    context += """
### Task:
1. Compare each result against the BASELINE metrics above
2. Score overfitting risk (0.0 = safe, 1.0 = overfit)
3. Flag results where improvement seems unrealistic relative to baseline
4. Recommend which result to use for live trading
5. Explain your reasoning with specific baseline comparisons
"""
    return context
```

#### Database: Store Baseline Reference

```sql
-- Add baseline reference to hyperopt analysis
ALTER TABLE ai_hyperopt_analyses ADD COLUMN
    baseline_profit_pct FLOAT,              -- backtest profit with default params
    baseline_trades INTEGER,                 -- backtest trade count
    baseline_sharpe FLOAT,                   -- backtest Sharpe ratio
    baseline_sortino FLOAT,                  -- backtest Sortino ratio
    baseline_max_drawdown FLOAT,             -- backtest max drawdown
    baseline_win_rate FLOAT,                 -- backtest win rate
    baseline_result JSONB;                   -- full backtest result object

-- Store per-result improvement vs baseline
ALTER TABLE ai_hyperopt_analyses ADD COLUMN
    improvement_vs_baseline JSONB;           -- [{index, profit_delta_pct, sharpe_delta, trade_ratio}]
```

#### API: Baseline in Comparison Response

```
GET  /api/ai/hyperopt/comparison/{analysis_id}
     → Now includes baseline:
     {
       "baseline": {
         "profit_pct": 5.2,
         "trades": 210,
         "sharpe": 1.15,
         "sortino": 1.42,
         "max_drawdown": -14.3,
         "win_rate": 52.4
       },
       "hyperopt_results": [...],
       "improvements_vs_baseline": [
         {"index": 0, "profit_delta": "+136%", "sharpe_delta": "+110%", "trade_ratio": 0.41},
         {"index": 1, "profit_delta": "+113%", "sharpe_delta": "+90%", "trade_ratio": 0.59},
         ...
       ],
       "claude_analysis": {...},
       "grok_analysis": {...},
       "comparison": {...}
     }
```

#### Frontend: Baseline Banner Widget

```
HO-9: Baseline Results Banner — Always visible at top of results section:
      Shows: "📊 BASELINE: +5.2% | 210 trades | Sharpe 1.15 | DD -14.3%"
      With subtitle: "This is your strategy's performance with default parameters.
      All hyperopt results below are measured against this baseline."
      Color-coded: neutral gray background (it's the reference, not a judgment)
      Source: baseline_result from analysis

HO-10: Improvement Bar Chart — Visual bars showing each result's improvement:
       Horizontal bar chart, one bar per hyperopt result:
       Bar length = % improvement over baseline for selected metric
       Dropdown: switch between Profit / Sharpe / Sortino / Drawdown improvement
       Results flagged by AI are shown with hatched pattern
       Source: improvements_vs_baseline from comparison endpoint
```

### 19.20 Updated Widget Summary (Complete List)

```
BACKTESTING PAGE WIDGETS (HO-1 through HO-10):

HO-1:  "AI Suggest" button                    — Pre-hyperopt trigger
HO-2:  Pre-hyperopt suggestions panel          — Claude vs Grok column comparison
HO-3:  Results tab view (5 tabs)               — Baseline/Hyperopt/Claude/Grok/Comparison
HO-4:  Agreement summary card                  — Quick consensus indicator
HO-5:  Pre vs Post comparison table            — Did AI suggestions help?
HO-6:  Side-by-side reasoning panel            — Expandable per result
HO-7:  Historical accuracy chart               — Follow AI vs ignore AI over time
HO-8:  Parameter heatmap                       — Params vs AI suggested ranges
HO-9:  Baseline results banner                 — Always-visible reference metrics
HO-10: Improvement bar chart                   — Visual improvement vs baseline

AI INSIGHTS PAGE WIDGETS (AI-14 through AI-18):

AI-14: Hyperopt AI performance card            — Follow rate + outcome stats
AI-15: Hyperopt advisor accuracy chart         — Claude vs Grok accuracy bars
AI-16: Follow vs ignore profit chart           — Cumulative profit comparison
AI-17: Recent hyperopt analyses table          — History with clickthrough
AI-18: Parameter range effectiveness scatter   — Adherence to AI ranges vs profit
```
