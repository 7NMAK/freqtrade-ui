"""
CC_EMA21_v5l — CryptoCred EMA21 Pullback Strategy (4H)

Pine Script reference (process_orders_on_close=false):
  IS  (Jan2024-Jun2025): 41 trades | WR 63.41% | +15.08% | DD 3.03%
  OOS (Jul2025-Apr2026): 24 trades | WR 70.83% | +16.18% | DD 1.49%

v9 — trail ratcheting from trade.min_rate/max_rate:

  Pine's trailing stop uses the LOWEST price seen since activation (for shorts)
  and HIGHEST price since activation (for longs) as the ratchet point:
    stop = lowest_since_activation + trail_offset  (SHORT)
    stop = highest_since_activation - trail_offset  (LONG)

  v8 used current_rate (bar HIGH/LOW) which gives a different ratchet level.
  v9 uses trade.min_rate / trade.max_rate which FT tracks automatically.

  Also: on activation bar, return tp_1r ± ATR as the "seed" stop so that
  subsequent calls start from the correct level. If this seed would fire
  on the activation bar's HIGH (for shorts), we fall back to fixed SL.

  Trace for Short Jan28 2025 (Pine exits +0.26%, v8 FT exits -0.68%):
    Signal bar: close=102368.7, sl=104309.9, ATR=1709.6
    risk=1941.2, tp_1r=100427.5, initial_trail=102137.1
    Entry bar (Jan28 20:00): H=102495, L=100235
    - Trail activates on L(100235) < tp_1r(100427.5)
    - Pine (bearish bar: H checked before L): H(102495) vs fixed SL(104310) → no fire
      Then L activates trail, initial stop = tp_1r + ATR = 102137.1
    - FT v9: activation bar → return fixed SL (104310), seed tp_1r+ATR=102137.1

    Jan29 00:00: H=102300, L=101270, trade.min_rate=100235
    - trail_sl = min(trade.min_rate + ATR, initial_trail) = min(101944.6, 102137.1) = 101944.6
    - H(102300) > 101944.6 → EXIT at 101944.6 ✓ (matches Pine 101944.7)

v8 fix (retained):
  1-bar trail activation delay to match Pine's bearish-bar H-before-L evaluation.

v6 fix (retained):
  Fixed entry_atr from signal bar (not current bar ATR).

v4 fix (retained):
  Trail threshold from signal bar CLOSE for tp_1r calculation.
"""

from freqtrade.strategy import IStrategy, stoploss_from_absolute
from freqtrade.persistence import Trade
from pandas import DataFrame
import pandas as pd
import talib.abstract as ta
import numpy as np
from typing import Optional
from datetime import datetime


class CC_EMA21_v5l_v9(IStrategy):

    INTERFACE_VERSION = 3
    timeframe = "4h"
    startup_candle_count = 100
    can_short = True
    max_open_trades = 1

    minimal_roi = {"0": 999}
    stoploss = -0.15
    use_custom_stoploss = True
    trailing_stop = False
    process_only_new_candles = True

    # Cache entry data per trade: key=str(open_date_utc), value=(sl_price, entry_atr, entry_close)
    _entry_cache: dict = {}
    # Activation bar timestamp and initial trail stop level
    _trail_activated_at: dict = {}
    _trail_initial_stop: dict = {}

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema21"] = ta.EMA(dataframe["close"], timeperiod=21)
        dataframe["ema50"] = ta.EMA(dataframe["close"], timeperiod=50)
        dataframe["rsi"] = ta.RSI(dataframe["close"], timeperiod=14)
        dataframe["atr14"] = ta.ATR(dataframe["high"], dataframe["low"],
                                     dataframe["close"], timeperiod=14)

        dataframe["ema_slope"] = dataframe["ema21"] - dataframe["ema21"].shift(8)

        dataframe["uptrend"] = (
            (dataframe["close"] > dataframe["ema21"]) &
            (dataframe["ema_slope"] > 0)
        ).astype(int)
        dataframe["downtrend"] = (
            (dataframe["close"] < dataframe["ema21"]) &
            (dataframe["ema_slope"] < 0)
        ).astype(int)

        dataframe["pull_bull"] = (
            (dataframe["low"] <= dataframe["ema21"] * 1.004) &
            (dataframe["close"] > dataframe["ema21"])
        ).astype(int)
        dataframe["pull_bear"] = (
            (dataframe["high"] >= dataframe["ema21"] * 0.996) &
            (dataframe["close"] < dataframe["ema21"])
        ).astype(int)

        dataframe["rsi_buy"] = (
            (dataframe["rsi"] >= 35) & (dataframe["rsi"] <= 55)
        ).astype(int)
        dataframe["rsi_sell"] = (
            (dataframe["rsi"] >= 45) & (dataframe["rsi"] <= 65)
        ).astype(int)

        body = (dataframe["close"] - dataframe["open"]).abs()
        total_range = dataframe["high"] - dataframe["low"]
        lower_wick = dataframe[["open", "close"]].min(axis=1) - dataframe["low"]
        upper_wick = dataframe["high"] - dataframe[["open", "close"]].max(axis=1)
        safe_range = total_range.replace(0, np.nan)

        bull_engulfing = (
            (dataframe["close"] > dataframe["open"]) &
            (dataframe["close"].shift(1) < dataframe["open"].shift(1)) &
            (dataframe["close"] > dataframe["open"].shift(1)) &
            (dataframe["open"] <= dataframe["close"].shift(1))
        )
        hammer = (
            (lower_wick / safe_range > 0.45) &
            (upper_wick / safe_range < 0.25)
        )
        bullish_pin = (
            (dataframe["close"] > dataframe["open"]) &
            (lower_wick > 1.5 * body)
        )
        dataframe["rev_bull"] = (bull_engulfing | hammer | bullish_pin).astype(int)

        bear_engulfing = (
            (dataframe["close"] < dataframe["open"]) &
            (dataframe["close"].shift(1) > dataframe["open"].shift(1)) &
            (dataframe["close"] < dataframe["open"].shift(1)) &
            (dataframe["open"] >= dataframe["close"].shift(1))
        )
        shooting_star = (
            (upper_wick / safe_range > 0.45) &
            (lower_wick / safe_range < 0.25)
        )
        bearish_pin = (
            (dataframe["close"] < dataframe["open"]) &
            (upper_wick > 1.5 * body)
        )
        dataframe["rev_bear"] = (bear_engulfing | shooting_star | bearish_pin).astype(int)

        dataframe["ema21_above_50"] = (dataframe["ema21"] > dataframe["ema50"]).astype(int)
        dataframe["ema21_below_50"] = (dataframe["ema21"] < dataframe["ema50"]).astype(int)

        dataframe["not_wednesday"] = (dataframe["date"].dt.dayofweek != 2).astype(int)
        dataframe["not_w5"] = (dataframe["date"].dt.day <= 28).astype(int)

        dataframe["swing_low"] = dataframe["low"].rolling(10).min()
        dataframe["swing_high"] = dataframe["high"].rolling(10).max()
        dataframe["long_sl"] = dataframe["swing_low"] - dataframe["atr14"] * 0.3
        dataframe["short_sl"] = dataframe["swing_high"] + dataframe["atr14"] * 0.3

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["uptrend"] == 1) &
            (dataframe["pull_bull"] == 1) &
            (dataframe["rsi_buy"] == 1) &
            (dataframe["rev_bull"] == 1) &
            (dataframe["ema21_above_50"] == 1) &
            (dataframe["not_wednesday"] == 1) &
            (dataframe["not_w5"] == 1),
            "enter_long"
        ] = 1

        dataframe.loc[
            (dataframe["downtrend"] == 1) &
            (dataframe["pull_bear"] == 1) &
            (dataframe["rsi_sell"] == 1) &
            (dataframe["rev_bear"] == 1) &
            (dataframe["ema21_below_50"] == 1) &
            (dataframe["not_wednesday"] == 1) &
            (dataframe["not_w5"] == 1),
            "enter_short"
        ] = 1

        return dataframe

    def _get_entry_data(self, trade: Trade, dataframe: DataFrame):
        cache_key = str(trade.open_date_utc)
        if cache_key in self._entry_cache:
            return self._entry_cache[cache_key]

        open_ts = pd.Timestamp(trade.open_date_utc)
        if open_ts.tzinfo is None:
            open_ts = open_ts.tz_localize("UTC")

        df_dates = dataframe["date"]
        if df_dates.dt.tz is None:
            df_dates = df_dates.dt.tz_localize("UTC")

        entry_mask = df_dates < open_ts
        if not entry_mask.any():
            result = (None, None, None)
            self._entry_cache[cache_key] = result
            return result

        entry_row = dataframe[entry_mask].iloc[-1]

        sl_price = float(entry_row.get("short_sl" if trade.is_short else "long_sl", 0))
        atr = float(entry_row.get("atr14", 0))
        entry_close = float(entry_row.get("close", 0))

        if sl_price > 0 and atr > 0 and entry_close > 0:
            if trade.is_short:
                if abs(sl_price - entry_close) / entry_close > 0.20:
                    sl_price = entry_close + atr * 2
            else:
                if abs(entry_close - sl_price) / entry_close > 0.20:
                    sl_price = entry_close - atr * 2

        result = (sl_price, atr, entry_close)
        self._entry_cache[cache_key] = result
        return result

    def custom_stoploss(self, pair: str, trade: Trade, current_time: datetime,
                        current_rate: float, current_profit: float,
                        after_fill: bool, **kwargs) -> Optional[float]:

        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if len(dataframe) == 0:
            return self.stoploss

        sl_price, entry_atr, entry_close = self._get_entry_data(trade, dataframe)

        if sl_price is None or sl_price <= 0 or entry_close is None or entry_close <= 0:
            return self.stoploss
        if entry_atr is None or entry_atr <= 0:
            return self.stoploss

        cache_key = str(trade.open_date_utc)
        activated_at = self._trail_activated_at.get(cache_key)
        trail_ready = activated_at is not None and current_time > activated_at

        if trade.is_short:
            risk = sl_price - entry_close
            if risk <= 0:
                return self.stoploss

            tp_1r = entry_close - risk

            if current_rate <= tp_1r:
                if activated_at is None:
                    # First activation: record time and seed initial trail stop
                    self._trail_activated_at[cache_key] = current_time
                    initial_trail = tp_1r + entry_atr
                    self._trail_initial_stop[cache_key] = initial_trail
                    # Return fixed SL for this bar (1-bar delay, matches Pine
                    # bearish-bar H-before-L evaluation order)
                    return stoploss_from_absolute(sl_price, current_rate, is_short=True)
                elif not trail_ready:
                    # Same bar as activation — keep fixed SL
                    return stoploss_from_absolute(sl_price, current_rate, is_short=True)
                else:
                    # Trail active: ratchet from lowest price seen (matches Pine)
                    initial_trail = self._trail_initial_stop.get(cache_key, tp_1r + entry_atr)
                    trail_sl = trade.min_rate + entry_atr
                    trail_sl = min(trail_sl, initial_trail)  # never go above initial
                    if trade.stop_loss and trade.stop_loss > 0:
                        trail_sl = min(trail_sl, trade.stop_loss)  # never let stop rise
                    return stoploss_from_absolute(trail_sl, current_rate, is_short=True)

            elif trail_ready:
                # Trail active, price above tp_1r: stop holds at lowest ratchet
                initial_trail = self._trail_initial_stop.get(cache_key, tp_1r + entry_atr)
                trail_sl = trade.min_rate + entry_atr
                trail_sl = min(trail_sl, initial_trail)
                if trade.stop_loss and trade.stop_loss > 0:
                    trail_sl = min(trail_sl, trade.stop_loss)
                return stoploss_from_absolute(trail_sl, current_rate, is_short=True)

            return stoploss_from_absolute(sl_price, current_rate, is_short=True)

        else:
            risk = entry_close - sl_price
            if risk <= 0:
                return self.stoploss

            tp_1r = entry_close + risk

            if current_rate >= tp_1r:
                if activated_at is None:
                    # First activation: record time and seed initial trail stop
                    self._trail_activated_at[cache_key] = current_time
                    initial_trail = tp_1r - entry_atr
                    self._trail_initial_stop[cache_key] = initial_trail
                    # Return fixed SL for this bar (1-bar delay, matches Pine
                    # bullish-bar L-before-H evaluation order)
                    return stoploss_from_absolute(sl_price, current_rate, is_short=False)
                elif not trail_ready:
                    # Same bar as activation — keep fixed SL
                    return stoploss_from_absolute(sl_price, current_rate, is_short=False)
                else:
                    # Trail active: ratchet from highest price seen (matches Pine)
                    initial_trail = self._trail_initial_stop.get(cache_key, tp_1r - entry_atr)
                    trail_sl = trade.max_rate - entry_atr
                    trail_sl = max(trail_sl, initial_trail)  # never go below initial
                    if trade.stop_loss and trade.stop_loss > 0:
                        trail_sl = max(trail_sl, trade.stop_loss)  # never let stop fall
                    return stoploss_from_absolute(trail_sl, current_rate, is_short=False)

            elif trail_ready:
                # Trail active, price below tp_1r: stop holds at highest ratchet
                initial_trail = self._trail_initial_stop.get(cache_key, tp_1r - entry_atr)
                trail_sl = trade.max_rate - entry_atr
                trail_sl = max(trail_sl, initial_trail)
                if trade.stop_loss and trade.stop_loss > 0:
                    trail_sl = max(trail_sl, trade.stop_loss)
                return stoploss_from_absolute(trail_sl, current_rate, is_short=False)

            return stoploss_from_absolute(sl_price, current_rate, is_short=False)

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
