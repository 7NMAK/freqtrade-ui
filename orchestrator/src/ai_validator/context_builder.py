"""
Context Builder — transforms raw FT data into structured LLM prompts.

Prompt size target: ~1000 tokens input (spec §9).
Uses EXACT FT field names: open_rate, current_profit, stake_amount, etc.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Approximate token budget per prompt component
# Total target: ~1000 input tokens
_MAX_CANDLES_IN_PROMPT = 10  # ~300 tokens


class ContextBuilder:
    """
    Builds structured analysis prompts from FT trade data and market context.
    Output is a human-readable string for the LLM — never raw JSON.
    """

    def build_prompt(self, trade: dict[str, Any], context: dict[str, Any]) -> str:
        """
        Build a complete analysis prompt for one trade.

        Args:
            trade: One entry from GET /api/v1/status (FT trade object).
            context: Output of SignalCollector.collect_context().

        Returns:
            Formatted prompt string for Claude / Grok.
        """
        # ── Technical summary ──────────────────────────────────────
        candles_data = context.get("candles", {})
        candles: list[dict] = []

        # Handle both {"data": [...]} and flat list formats
        if isinstance(candles_data, dict):
            raw = candles_data.get("data", [])
            # FT pair_candles returns {"data": [[ts, o, h, l, c, v], ...], "columns": [...]}
            columns = candles_data.get("columns", [])
            if columns and raw and isinstance(raw[0], list):
                candles = [dict(zip(columns, row)) for row in raw]
            elif isinstance(raw, list) and raw and isinstance(raw[0], dict):
                candles = raw
        elif isinstance(candles_data, list):
            candles = candles_data

        candles = candles[-100:] if len(candles) > 100 else candles  # cap at 100

        tech_summary = self._technical_summary(candles)

        # ── Bot performance ───────────────────────────────────────
        profit: dict = context.get("bot_profit", {})
        bot_stats: dict = context.get("bot_stats", {})
        daily: dict = context.get("daily_profit", {})

        closed_count = profit.get("closed_trade_count", 0)
        winning = profit.get("winning_trades", 0)
        win_rate = (winning / max(closed_count, 1)) * 100

        daily_rows = daily.get("data", []) if isinstance(daily, dict) else []
        today_pnl = daily_rows[0].get("abs_profit", 0.0) if daily_rows else 0.0

        max_dd = bot_stats.get("max_drawdown", bot_stats.get("max_drawdown_abs", 0))

        # ── Trade details ─────────────────────────────────────────
        direction = "SHORT" if trade.get("is_short") else "LONG"

        # FreqAI fields (may not be present if FreqAI not enabled)
        do_predict = trade.get("do_predict", trade.get("freqai_do_predict", "N/A"))
        di_value = trade.get("DI_values", trade.get("freqai_di_value", "N/A"))

        last_10 = candles[-_MAX_CANDLES_IN_PROMPT:] if candles else []

        prompt = f"""FREQAI SIGNAL ANALYSIS REQUEST

TRADE DETAILS:
- Pair: {trade.get("pair", "unknown")}
- Direction: {direction}
- Entry Rate (open_rate): {trade.get("open_rate", 0):.6f}
- Current Profit: {trade.get("current_profit", 0):.4f} ({trade.get("current_profit_pct", 0):.2f}%)
- Stake Amount: {trade.get("stake_amount", 0):.4f}
- Entry Tag (enter_tag): {trade.get("enter_tag", "N/A")}
- FreqAI do_predict: {do_predict}
- FreqAI DI_value: {di_value}
- Stoploss current distance: {trade.get("stoploss_current_dist_pct", "N/A")}%

MARKET CONTEXT:
{tech_summary}

LAST {len(last_10)} CANDLES (newest first):
{self._format_candles(last_10)}

BOT PERFORMANCE:
- Win Rate: {win_rate:.1f}% ({winning}/{closed_count} trades)
- Max Drawdown: {max_dd:.2f}%
- Today's P&L: {today_pnl:.4f}

TASK:
Analyze this FreqAI signal. Do you agree with the {direction} direction?
Assess confidence and risk. Consider whether the ML signal aligns with
the current market structure and momentum.

Return ONLY a JSON object with this exact schema:
{{
  "confidence": <float 0.0-1.0>,
  "direction": "<long|short|neutral>",
  "agreement_with_freqai": <bool>,
  "reasoning": "<2-3 sentences max>",
  "risk_factors": ["<factor1>", "<factor2>"],
  "sentiment_assessment": "<very_bearish|bearish|neutral|bullish|very_bullish>",
  "suggested_tp_adjustment": <null or string>,
  "suggested_sl_adjustment": <null or string>,
  "market_regime": "<trending_bullish|trending_bearish|ranging|volatile|breakout>"
}}"""

        return prompt

    def _technical_summary(self, candles: list[dict]) -> str:
        """Compute simple technical summary from OHLCV candles."""
        if not candles:
            return "- No candle data available"

        closes = [self._to_float(c.get("close", c.get("c", 0))) for c in candles]
        volumes = [self._to_float(c.get("volume", c.get("v", 0))) for c in candles]

        current_price = closes[-1] if closes else 0

        # Simple Moving Average approximations
        sma_20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else current_price
        sma_50 = sum(closes[-50:]) / 50 if len(closes) >= 50 else current_price

        price_vs_sma20 = ((current_price - sma_20) / sma_20 * 100) if sma_20 else 0
        ma_signal = "BULLISH" if sma_20 > sma_50 else "BEARISH"

        # Volume trend (compare last candle vs 10-candle average)
        last_10_vols = volumes[-10:] if len(volumes) >= 10 else volumes
        avg_vol = sum(last_10_vols) / len(last_10_vols) if last_10_vols else 1
        last_vol = volumes[-1] if volumes else 0

        if last_vol > avg_vol * 1.2:
            vol_trend = "increasing"
        elif last_vol < avg_vol * 0.8:
            vol_trend = "decreasing"
        else:
            vol_trend = "stable"

        return (
            f"- Current Price: {current_price:.6f}\n"
            f"- Price vs SMA20: {price_vs_sma20:+.2f}%\n"
            f"- SMA20 vs SMA50: {ma_signal}\n"
            f"- Volume Trend: {vol_trend}"
        )

    def _format_candles(self, candles: list[dict]) -> str:
        """Human-readable candle list (newest first) for the prompt."""
        if not candles:
            return "  (no candle data)"

        lines = []
        for c in reversed(candles):
            o = self._to_float(c.get("open", c.get("o", 0)))
            h = self._to_float(c.get("high", c.get("h", 0)))
            lo = self._to_float(c.get("low", c.get("l", 0)))
            cl = self._to_float(c.get("close", c.get("c", 0)))
            vol = self._to_float(c.get("volume", c.get("v", 0)))
            date = c.get("date", c.get("time", "?"))

            chg = ((cl - o) / o * 100) if o else 0
            sign = "+" if chg >= 0 else ""
            lines.append(
                f"  {date}: O={o:.4f} H={h:.4f} L={lo:.4f} C={cl:.4f} "
                f"V={vol:.0f} ({sign}{chg:.2f}%)"
            )
        return "\n".join(lines)

    @staticmethod
    def _to_float(value: Any) -> float:
        """Safely convert a candle value to float."""
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0
