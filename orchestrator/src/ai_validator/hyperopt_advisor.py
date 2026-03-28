"""
Hyperopt Advisor — AI advisory for FreqTrade hyperparameter optimization.

Point 1 (pre-hyperopt):  Suggest parameter ranges, loss function, sampler before running
Point 3 (post-hyperopt): Detect overfitting risks, recommend best result after running

Integrates: LLMGateway, strategy_parser, response_parser, DB storage.
Does NOT modify FreqTrade. Only reads and advises.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .llm_gateway import LLMGateway
from .models import AIHyperoptAnalysis
from .response_parser import parse_pre_hyperopt_response, parse_post_hyperopt_response
from .strategy_parser import parse_strategy_parameters, format_param_ranges
from ..ft_client import FTClient

logger = logging.getLogger(__name__)

# ── System Prompts ─────────────────────────────────────────────────────────────

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
  "recommended_epochs": 200,
  "parameter_suggestions": [
    {
      "param_name": "exact parameter name from strategy",
      "current_range": [0, 100],
      "suggested_range": [10, 50],
      "reasoning": "why narrow/widen this range"
    }
  ],
  "spaces_to_optimize": ["buy", "sell", "roi", "stoploss", "trailing"],
  "spaces_reasoning": "which spaces matter most and why",
  "general_advice": "overall strategy observations",
  "confidence": 0.75,
  "risk_factors": ["list of concerns"]
}"""

POST_HYPEROPT_SYSTEM_PROMPT_V2 = """You are a quantitative trading advisor reviewing FreqTrade
hyperparameter optimization results. Your job: identify overfitting risks and recommend the
parameter set most likely to perform well in LIVE trading (not just backtesting).

CRITICAL: You will also receive BASELINE backtest metrics (run with default parameters).
Compare each result against the baseline. Improvement vs baseline = more believable.
Large improvement vs baseline WITH fewer trades = red flag for overfitting.

Key overfitting indicators:
1. Very few trades (< 50) with very high profit — likely curve-fitted
2. Parameters at extreme ends of their ranges — suggests range should be widened
3. Very high Sharpe (> 5) — suspiciously good, probably overfit
4. Inconsistent performance across sub-periods — not robust
5. Max drawdown near zero — unrealistic, probably overfit
6. Trade duration suspiciously uniform — data snooping
7. Massive improvement vs baseline with same timerange — examine carefully

Your response MUST be valid JSON:
{
  "recommended_result_index": 0,
  "recommended_reasoning": "why this result is best for live trading",
  "overfitting_risk_scores": [
    {
      "result_index": 0,
      "risk_score": 0.3,
      "risk_factors": ["specific concerns"],
      "verdict": "SAFE"
    }
  ],
  "parameter_observations": [
    {"param_name": "name", "observation": "what you noticed"}
  ],
  "general_analysis": "overall assessment comparing all results vs baseline",
  "next_steps": ["what the trader should do next"],
  "confidence": 0.8
}"""


class HyperoptAdvisor:
    """
    AI advisory for hyperopt pre-analysis (parameter suggestions) and
    post-analysis (overfitting detection).
    """

    def __init__(
        self,
        gateway: LLMGateway,
        ft_client: FTClient,
        db_session: AsyncSession,
    ) -> None:
        self.gateway = gateway
        self.ft = ft_client
        self.db = db_session

    async def pre_analyze(
        self,
        bot_id: int,
        strategy_name: str,
        pair: str,
        timeframe: str,
    ) -> dict[str, Any]:
        """
        Analyze strategy BEFORE hyperopt.
        Returns merged suggestions from Claude + Grok.
        """
        # 1. Read strategy code from FT bot
        strategy_code = await self._get_strategy_code(strategy_name)

        # 2. Parse parameter definitions
        current_params = parse_strategy_parameters(strategy_code)

        # 3. Fetch recent candles (30 candles for market context)
        candles: list[dict] = []
        try:
            raw = await self.ft.pair_candles(pair, timeframe, 30)
            if isinstance(raw, dict):
                data = raw.get("data", [])
                columns = raw.get("columns", [])
                if columns and data and isinstance(data[0], list):
                    candles = [dict(zip(columns, row)) for row in data]
                elif data and isinstance(data[0], dict):
                    candles = data
        except Exception as exc:
            logger.warning("Could not fetch candles for %s: %s", pair, exc)

        # 4. Build context
        context = _build_pre_hyperopt_context(
            strategy_code=strategy_code,
            pair=pair,
            timeframe=timeframe,
            recent_candles=candles,
            current_params=current_params,
        )

        # 5. Query Claude + Grok in parallel
        claude_raw, grok_raw = await asyncio.gather(
            self.gateway.query("claude", PRE_HYPEROPT_SYSTEM_PROMPT, context),
            self.gateway.query("grok", PRE_HYPEROPT_SYSTEM_PROMPT, context),
            return_exceptions=True,
        )

        # 6. Parse responses
        claude_result: dict = {}
        grok_result: dict = {}
        claude_tokens = 0
        grok_tokens = 0

        if not isinstance(claude_raw, Exception):
            try:
                claude_result = parse_pre_hyperopt_response(claude_raw)
                claude_tokens = claude_raw.get("tokens_used", 0) if isinstance(claude_raw, dict) else 0
            except Exception as exc:
                logger.warning("Failed to parse Claude pre-hyperopt response: %s", exc)

        if not isinstance(grok_raw, Exception):
            try:
                grok_result = parse_pre_hyperopt_response(grok_raw)
                grok_tokens = grok_raw.get("tokens_used", 0) if isinstance(grok_raw, dict) else 0
            except Exception as exc:
                logger.warning("Failed to parse Grok pre-hyperopt response: %s", exc)

        # 7. Merge suggestions
        merged = _merge_pre_hyperopt(claude_result, grok_result, current_params)

        # 8. Store in DB
        analysis = AIHyperoptAnalysis(
            bot_id=bot_id,
            strategy_name=strategy_name,
            pair=pair,
            timeframe=timeframe,
            analysis_type="pre_hyperopt",
            suggested_loss_function=merged.get("recommended_loss_function"),
            suggested_sampler=merged.get("recommended_sampler"),
            suggested_epochs=merged.get("recommended_epochs"),
            suggested_param_ranges=merged.get("parameter_suggestions"),
            suggested_spaces=merged.get("spaces_to_optimize"),
            claude_response=claude_result,
            grok_response=grok_result,
            claude_confidence=claude_result.get("confidence"),
            grok_confidence=grok_result.get("confidence"),
            claude_tokens_used=claude_tokens,
            grok_tokens_used=grok_tokens,
            total_cost_usd=(
                (claude_raw.get("cost_usd", 0.0) if isinstance(claude_raw, dict) else 0.0)
                + (grok_raw.get("cost_usd", 0.0) if isinstance(grok_raw, dict) else 0.0)
            ),
        )
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(analysis)

        merged["analysis_id"] = analysis.id
        return merged

    async def post_analyze(
        self,
        bot_id: int,
        strategy_name: str,
        pair: str,
        timeframe: str,
        hyperopt_results: list[dict[str, Any]],
        epochs_run: int,
        loss_function_used: str,
        timerange: str,
        baseline_profit: float | None = None,
        baseline_trades: int | None = None,
        baseline_sharpe: float | None = None,
        baseline_max_drawdown: float | None = None,
    ) -> dict[str, Any]:
        """
        Analyze hyperopt results AFTER completion.
        Includes baseline comparison (spec §19.19).
        """
        # Build context with baseline included (spec §19.19 — CRITICAL)
        context = _build_post_hyperopt_context(
            strategy_name=strategy_name,
            pair=pair,
            timeframe=timeframe,
            hyperopt_results=hyperopt_results[:10],
            epochs_run=epochs_run,
            loss_function_used=loss_function_used,
            timerange=timerange,
            baseline_profit=baseline_profit,
            baseline_trades=baseline_trades,
            baseline_sharpe=baseline_sharpe,
            baseline_max_drawdown=baseline_max_drawdown,
        )

        # Query both in parallel
        claude_raw, grok_raw = await asyncio.gather(
            self.gateway.query("claude", POST_HYPEROPT_SYSTEM_PROMPT_V2, context),
            self.gateway.query("grok", POST_HYPEROPT_SYSTEM_PROMPT_V2, context),
            return_exceptions=True,
        )

        claude_result: dict = {}
        grok_result: dict = {}
        claude_tokens = 0
        grok_tokens = 0

        if not isinstance(claude_raw, Exception):
            try:
                claude_result = parse_post_hyperopt_response(claude_raw)
                claude_tokens = claude_raw.get("tokens_used", 0) if isinstance(claude_raw, dict) else 0
            except Exception as exc:
                logger.warning("Failed to parse Claude post-hyperopt response: %s", exc)

        if not isinstance(grok_raw, Exception):
            try:
                grok_result = parse_post_hyperopt_response(grok_raw)
                grok_tokens = grok_raw.get("tokens_used", 0) if isinstance(grok_raw, dict) else 0
            except Exception as exc:
                logger.warning("Failed to parse Grok post-hyperopt response: %s", exc)

        merged = _merge_post_hyperopt(claude_result, grok_result)

        # Store in DB
        analysis = AIHyperoptAnalysis(
            bot_id=bot_id,
            strategy_name=strategy_name,
            pair=pair,
            timeframe=timeframe,
            analysis_type="post_hyperopt",
            hyperopt_epochs_run=epochs_run,
            loss_function_used=loss_function_used,
            results_analyzed=len(hyperopt_results[:10]),
            recommended_result_index=merged.get("recommended_result_index"),
            overfitting_scores=merged.get("overfitting_risk_scores"),
            baseline_profit=baseline_profit,
            baseline_trades=baseline_trades,
            baseline_sharpe=baseline_sharpe,
            baseline_max_drawdown=baseline_max_drawdown,
            claude_response=claude_result,
            grok_response=grok_result,
            claude_confidence=claude_result.get("confidence"),
            grok_confidence=grok_result.get("confidence"),
            claude_tokens_used=claude_tokens,
            grok_tokens_used=grok_tokens,
            total_cost_usd=(
                (claude_raw.get("cost_usd", 0.0) if isinstance(claude_raw, dict) else 0.0)
                + (grok_raw.get("cost_usd", 0.0) if isinstance(grok_raw, dict) else 0.0)
            ),
        )
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(analysis)

        merged["analysis_id"] = analysis.id
        return merged

    async def _get_strategy_code(self, strategy_name: str) -> str:
        """Read strategy .py code from FT bot via REST API."""
        try:
            result = await self.ft.strategy(strategy_name)
            code = result.get("code", result.get("strategy", ""))
            if not code:
                raise ValueError(f"Strategy '{strategy_name}' returned empty code")
            return code
        except Exception as exc:
            raise ValueError(f"Could not read strategy '{strategy_name}': {exc}") from exc


# ── Context builders ───────────────────────────────────────────────────────────

def _build_pre_hyperopt_context(
    strategy_code: str,
    pair: str,
    timeframe: str,
    recent_candles: list[dict],
    current_params: dict,
    max_strategy_chars: int = 3000,
) -> str:
    """Build prompt context for pre-hyperopt analysis."""
    # Market summary from candles
    regime_summary = _summarize_market(recent_candles)

    param_section = format_param_ranges(current_params) or "No parameters found."

    # Truncate strategy code if too long
    code_excerpt = strategy_code[:max_strategy_chars]
    if len(strategy_code) > max_strategy_chars:
        code_excerpt += f"\n... [truncated to {max_strategy_chars} chars] ..."

    return f"""## Strategy Analysis Request (Pre-Hyperopt)

### Strategy Code:
```python
{code_excerpt}
```

### Trading Pair: {pair}
### Timeframe: {timeframe}

### Current Market Conditions (last {len(recent_candles)} candles):
{regime_summary}

### Current Parameter Ranges (from strategy):
{param_section}

### Available Loss Functions:
1. ShortTradeDurHyperOptLoss    — Minimize trade duration + maximize profit
2. OnlyProfitHyperOptLoss       — Maximize total profit only
3. SharpeHyperOptLoss           — Maximize Sharpe ratio
4. SharpeHyperOptLossDaily      — Sharpe ratio on daily returns
5. SortinoHyperOptLoss          — Maximize Sortino ratio
6. SortinoHyperOptLossDaily     — Sortino on daily returns
7. MaxDrawDownHyperOptLoss      — Minimize max drawdown
8. MaxDrawDownRelativeHyperOptLoss — Minimize relative drawdown
9. CalmarHyperOptLoss           — Maximize Calmar ratio
10. ProfitDrawDownHyperOptLoss  — Balance profit vs drawdown
11. MultiMetricHyperOptLoss     — Composite of multiple metrics

### Available Samplers:
TPESampler, RandomSampler, CmaEsSampler, NSGAIISampler, QMCSampler, MOTPESampler

### Task:
Analyze this strategy and current market conditions.
Suggest optimal parameter ranges, loss function, and sampler.
Explain your reasoning for each suggestion."""


def _build_post_hyperopt_context(
    strategy_name: str,
    pair: str,
    timeframe: str,
    hyperopt_results: list[dict],
    epochs_run: int,
    loss_function_used: str,
    timerange: str,
    baseline_profit: float | None,
    baseline_trades: int | None,
    baseline_sharpe: float | None,
    baseline_max_drawdown: float | None,
) -> str:
    """Build prompt context for post-hyperopt analysis. ALWAYS includes baseline (§19.19)."""

    # Baseline section (critical per spec §19.19)
    if any(v is not None for v in [baseline_profit, baseline_trades, baseline_sharpe, baseline_max_drawdown]):
        baseline_section = f"""### BASELINE (default parameters — your benchmark):
- Total profit: {f'{baseline_profit:.4f}%' if baseline_profit is not None else 'N/A'}
- Number of trades: {baseline_trades or 'N/A'}
- Sharpe ratio: {f'{baseline_sharpe:.3f}' if baseline_sharpe is not None else 'N/A'}
- Max drawdown: {f'{baseline_max_drawdown:.2f}%' if baseline_max_drawdown is not None else 'N/A'}

IMPORTANT: Compare each hyperopt result vs these baseline metrics.
Large improvement vs baseline = promising (but check for overfitting).
Tiny improvement or worse than baseline = consider longer epoch run."""
    else:
        baseline_section = "### BASELINE: Not provided (consider running a baseline backtest first)"

    # Format individual results
    results_text = []
    for i, r in enumerate(hyperopt_results[:10]):
        results_text.append(f"""
Result #{i + 1} (Epoch {r.get('current_epoch', '?')}):
- Total profit: {r.get('profit_total_pct', r.get('profit_total', 0)):.2f}%
- Trades: {r.get('trade_count', 0)}
- Win rate: {r.get('wins', 0)}/{r.get('trade_count', 0)}
- Avg duration: {r.get('duration_avg', 'N/A')}
- Max drawdown: {r.get('max_drawdown_abs', r.get('max_drawdown', 0)):.2f}%
- Sharpe: {r.get('sharpe', 0):.3f}
- Sortino: {r.get('sortino', 0):.3f}
- Calmar: {r.get('calmar', 0):.3f}
- Loss score: {r.get('loss', 0):.6f}
- Parameters: {', '.join(f'{k}={v}' for k, v in r.get('params_dict', r.get('params', {})).items())}""")

    return f"""## Hyperopt Results Analysis Request

### Strategy: {strategy_name}
### Pair: {pair} | Timeframe: {timeframe}
### Time Range: {timerange}
### Loss Function: {loss_function_used}
### Total Epochs Run: {epochs_run}

{baseline_section}

### Top {len(hyperopt_results[:10])} Hyperopt Results:
{''.join(results_text)}

### Task:
1. Score each result's overfitting risk (0.0 = safe, 1.0 = overfit)
2. Recommend which result to use for live trading
3. Compare each result against the baseline metrics
4. Identify parameters at extreme ends of ranges
5. Flag red flags: too few trades, unrealistic Sharpe, large improvement vs baseline with fewer trades
6. Suggest next steps (more epochs? change loss function? paper trade first? different timerange?)"""


# ── Merge helpers ──────────────────────────────────────────────────────────────

def _merge_pre_hyperopt(
    claude: dict[str, Any],
    grok: dict[str, Any],
    current_params: dict[str, Any],
) -> dict[str, Any]:
    """Merge Claude + Grok pre-hyperopt suggestions."""
    result: dict[str, Any] = {
        "recommended_loss_function": (
            claude.get("recommended_loss_function")
            or grok.get("recommended_loss_function")
            or "SharpeHyperOptLossDaily"
        ),
        "loss_function_reasoning": (
            claude.get("loss_function_reasoning") or grok.get("loss_function_reasoning") or ""
        ),
        "recommended_sampler": (
            claude.get("recommended_sampler")
            or grok.get("recommended_sampler")
            or "TPESampler"
        ),
        "sampler_reasoning": (
            claude.get("sampler_reasoning") or grok.get("sampler_reasoning") or ""
        ),
        "recommended_epochs": min(
            claude.get("recommended_epochs", 500),
            grok.get("recommended_epochs", 500),
        ),
        "spaces_to_optimize": list(
            set(
                claude.get("spaces_to_optimize", ["buy", "sell"])
                + grok.get("spaces_to_optimize", ["buy", "sell"])
            )
        ),
        "parameter_suggestions": [],
        "advisors_agree_on_loss": (
            claude.get("recommended_loss_function") == grok.get("recommended_loss_function")
        ),
        "advisors_agree_on_sampler": (
            claude.get("recommended_sampler") == grok.get("recommended_sampler")
        ),
        "claude_response": {
            "loss": claude.get("loss_function_reasoning", ""),
            "sampler": claude.get("sampler_reasoning", ""),
            "general": claude.get("general_advice", ""),
            "confidence": claude.get("confidence", 0.0),
        },
        "grok_response": {
            "loss": grok.get("loss_function_reasoning", ""),
            "sampler": grok.get("sampler_reasoning", ""),
            "general": grok.get("general_advice", ""),
            "confidence": grok.get("confidence", 0.0),
        },
    }

    # Merge parameter suggestions with tighter range intersection
    claude_params = {p["param_name"]: p for p in claude.get("parameter_suggestions", []) if "param_name" in p}
    grok_params = {p["param_name"]: p for p in grok.get("parameter_suggestions", []) if "param_name" in p}

    for param_name, param_info in current_params.items():
        c = claude_params.get(param_name, {})
        g = grok_params.get(param_name, {})

        if not c and not g:
            continue  # No suggestion for this param

        orig_low = param_info.get("low", 0)
        orig_high = param_info.get("high", 100)

        c_range = c.get("suggested_range", [orig_low, orig_high])
        g_range = g.get("suggested_range", [orig_low, orig_high])

        # Take intersection (tighter range)
        try:
            sug_low = max(float(c_range[0]), float(g_range[0]))
            sug_high = min(float(c_range[1]), float(g_range[1]))
        except (TypeError, IndexError, ValueError):
            sug_low, sug_high = orig_low, orig_high

        # Safety: ensure valid range
        if sug_low >= sug_high:
            sug_low = min(float(c_range[0]), float(g_range[0]))
            sug_high = max(float(c_range[1]), float(g_range[1]))

        result["parameter_suggestions"].append({
            "param_name": param_name,
            "current_range": [orig_low, orig_high],
            "suggested_range": [sug_low, sug_high],
            "claude_reasoning": c.get("reasoning", "No Claude suggestion"),
            "grok_reasoning": g.get("reasoning", "No Grok suggestion"),
        })

    return result


def _merge_post_hyperopt(
    claude: dict[str, Any],
    grok: dict[str, Any],
) -> dict[str, Any]:
    """Merge Claude + Grok post-hyperopt overfitting analysis."""
    if not claude and not grok:
        return {
            "recommended_result_index": 0,
            "advisors_agree": False,
            "overfitting_risk_scores": [],
            "claude_analysis": "",
            "grok_analysis": "",
        }

    c_scores = {s["result_index"]: s for s in claude.get("overfitting_risk_scores", []) if "result_index" in s}
    g_scores = {s["result_index"]: s for s in grok.get("overfitting_risk_scores", []) if "result_index" in s}

    merged_scores = []
    for idx in range(10):
        c = c_scores.get(idx, {})
        g = g_scores.get(idx, {})

        c_risk = float(c.get("risk_score", 0.5))
        g_risk = float(g.get("risk_score", 0.5))
        avg_risk = (c_risk + g_risk) / 2

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
            "claude_verdict": c.get("verdict", "UNKNOWN"),
            "grok_verdict": g.get("verdict", "UNKNOWN"),
            "claude_factors": c.get("risk_factors", []),
            "grok_factors": g.get("risk_factors", []),
        })

    claude_rec = int(claude.get("recommended_result_index", 0))
    grok_rec = int(grok.get("recommended_result_index", 0))

    if claude_rec == grok_rec:
        recommended = claude_rec
    else:
        # Pick the one with lower merged risk score
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
            claude.get("parameter_observations", [])
            + grok.get("parameter_observations", [])
        ),
        "claude_confidence": claude.get("confidence", 0.0),
        "grok_confidence": grok.get("confidence", 0.0),
    }


def _summarize_market(candles: list[dict]) -> str:
    """Simple market regime summary from recent candles."""
    if not candles:
        return "No recent market data available."

    def to_f(v: Any) -> float:
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    closes = [to_f(c.get("close", c.get("c", 0))) for c in candles]
    highs = [to_f(c.get("high", c.get("h", 0))) for c in candles]
    lows = [to_f(c.get("low", c.get("l", 0))) for c in candles]
    volumes = [to_f(c.get("volume", c.get("v", 0))) for c in candles]

    if not closes:
        return "No market data."

    price_change = ((closes[-1] - closes[0]) / closes[0] * 100) if closes[0] else 0
    volatility = max(highs) - min(lows) if highs and lows else 0
    avg_vol = sum(volumes) / len(volumes) if volumes else 0

    if price_change > 10:
        regime = "STRONG_UPTREND"
    elif price_change > 3:
        regime = "MILD_UPTREND"
    elif price_change < -10:
        regime = "STRONG_DOWNTREND"
    elif price_change < -3:
        regime = "MILD_DOWNTREND"
    else:
        regime = "RANGING"

    return (
        f"- Regime: {regime}\n"
        f"- Price change: {price_change:+.2f}%\n"
        f"- Volatility (H-L range): {volatility:.4f}\n"
        f"- Average volume: {avg_vol:,.0f}\n"
        f"- Current price: {closes[-1]:.6f}"
    )
