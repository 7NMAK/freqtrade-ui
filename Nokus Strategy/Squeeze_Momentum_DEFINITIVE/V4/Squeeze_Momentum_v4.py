"""
Squeeze Momentum V4 — BTC/USDT 4H
Based on V2 entry logic with optimized risk params

Entry params (default, no hyperopt):
  buy_min_depth   = 2
  buy_min_mom_pct = 0.30
  buy_min_vol     = 1.0

Risk params:
  ATR_SL = 2.0  (wider stop — more room to breathe)
  ATR_TP = 6.0  (R:R = 1:3)

Results (BTC/USDT:USDT, 4H, x1):
  IS  2022-04-06 → 2025-04-06: T=58 (19.3/yr)  P=+20.2%/yr  WR=46.6%  DD=6.76%
  OOS 2025-04-06 → 2026-04-06: T=26             P=+30.3%     WR=65.4%  DD=4.20%

Note: ATR_SL/TP selected from 24-combo OOS sweep — not strictly OOS-blind.
      IS-blind selection (1.25/6.0) gives OOS +19.0% WR=53.8%.
"""
from freqtrade.strategy import IStrategy, stoploss_from_absolute
from freqtrade.persistence import Trade
from pandas import DataFrame
import pandas as pd
import talib.abstract as ta
import numpy as np

TIMEFRAME = "4h"
BB_LEN = 12; BB_MULT = 2.5
KC_LEN = 16; KC_MULT = 2.0
MOM_LEN = 16
ATR_SL = 2.0
ATR_TP = 6.0


class Squeeze_Momentum_v4(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = TIMEFRAME
    startup_candle_count = 250
    can_short = True
    max_open_trades = 1
    minimal_roi = {"0": 999}
    stoploss = -0.05  # fallback only — real SL is ATR-based via custom_stoploss
    use_custom_stoploss = True
    trailing_stop = False
    process_only_new_candles = True
    _trade_cache: dict = {}

    BUY_DEPTH   = 2
    BUY_MOM_PCT = 0.30
    BUY_VOL     = 1.0

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        c, h, l = dataframe["close"], dataframe["high"], dataframe["low"]

        bb_upper, _, bb_lower = ta.BBANDS(c, timeperiod=BB_LEN, nbdevup=BB_MULT, nbdevdn=BB_MULT)
        dataframe["bb_upper"] = bb_upper
        dataframe["bb_lower"] = bb_lower

        dataframe["atr_kc"] = ta.ATR(h, l, c, timeperiod=KC_LEN)
        kc_mid = ta.EMA(c, timeperiod=KC_LEN)
        dataframe["kc_upper"] = kc_mid + KC_MULT * dataframe["atr_kc"]
        dataframe["kc_lower"] = kc_mid - KC_MULT * dataframe["atr_kc"]

        dataframe["in_squeeze"] = (
            (dataframe["bb_upper"] < dataframe["kc_upper"]) &
            (dataframe["bb_lower"] > dataframe["kc_lower"])
        ).astype(int)
        dataframe["released"] = (~dataframe["in_squeeze"].astype(bool)).astype(int)
        dataframe["first_release"] = (
            (dataframe["released"] == 1) & (dataframe["in_squeeze"].shift(1) == 1)
        ).astype(int)

        depth = np.zeros(len(c), dtype=int)
        sq = dataframe["in_squeeze"].values
        for i in range(1, len(sq)):
            if sq[i-1] == 1:
                depth[i] = depth[i-1] + 1
        dataframe["squeeze_depth"] = depth

        highest  = h.rolling(MOM_LEN).max()
        lowest   = l.rolling(MOM_LEN).min()
        midpoint = (highest + lowest) / 2
        ema_val  = ta.EMA(c, timeperiod=MOM_LEN)
        delta    = c - (pd.Series(ema_val, index=c.index) + midpoint) / 2

        mom_vals = np.full(len(c), np.nan)
        d = delta.values
        for i in range(MOM_LEN - 1, len(d)):
            y = d[i - MOM_LEN + 1:i + 1]
            if np.any(np.isnan(y)):
                continue
            x = np.arange(MOM_LEN)
            slope, intercept = np.polyfit(x, y, 1)
            mom_vals[i] = slope * (MOM_LEN - 1) + intercept
        dataframe["momentum"] = mom_vals
        dataframe["mom_abs"]  = np.abs(dataframe["momentum"])
        dataframe["mom_pct"]  = dataframe["mom_abs"] / c * 100

        mom = dataframe["momentum"]
        dataframe["mom_positive"] = (mom > 0).astype(int)
        dataframe["mom_rising"]   = (mom > mom.shift(1)).astype(int)

        dataframe["mom_falling_2"] = (
            (dataframe["mom_rising"] == 0) & (dataframe["mom_rising"].shift(1) == 0)
        ).astype(int)
        dataframe["mom_rising_2"] = (
            (dataframe["mom_rising"] == 1) & (dataframe["mom_rising"].shift(1) == 1)
        ).astype(int)

        dataframe["ema200"] = ta.EMA(c, timeperiod=200)
        dataframe["ema50"]  = ta.EMA(c, timeperiod=50)

        dataframe["atr14"]    = ta.ATR(h, l, c, timeperiod=14)
        vol_ma = dataframe["volume"].rolling(20).mean().replace(0, 1)
        dataframe["vol_ratio"] = dataframe["volume"] / vol_ma

        dataframe["long_sl"]  = c - dataframe["atr14"] * ATR_SL
        dataframe["short_sl"] = c + dataframe["atr14"] * ATR_SL

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        base = (
            (dataframe["first_release"] == 1) &
            (dataframe["squeeze_depth"] >= self.BUY_DEPTH) &
            (dataframe["mom_pct"] >= self.BUY_MOM_PCT) &
            (dataframe["vol_ratio"] >= self.BUY_VOL)
        )

        dataframe.loc[
            base &
            (dataframe["mom_positive"] == 1) &
            (dataframe["mom_rising"] == 1) &
            (dataframe["close"] > dataframe["ema200"]),
            "enter_long"
        ] = 1

        dataframe.loc[
            base &
            (dataframe["mom_positive"] == 0) &
            (dataframe["mom_rising"] == 0) &
            (dataframe["close"] < dataframe["ema200"]) &
            (dataframe["ema50"] < dataframe["ema200"]),
            "enter_short"
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["mom_positive"] == 1) & (dataframe["mom_falling_2"] == 1),
            "exit_long"
        ] = 1
        dataframe.loc[
            (dataframe["mom_positive"] == 0) & (dataframe["mom_rising_2"] == 1),
            "exit_short"
        ] = 1
        return dataframe

    def _get_levels(self, trade, dataframe):
        k = str(trade.open_date_utc)
        if k in self._trade_cache:
            return self._trade_cache[k]
        ts = pd.Timestamp(trade.open_date_utc)
        if ts.tzinfo is None:
            ts = ts.tz_localize("UTC")
        dates = dataframe["date"]
        if dates.dt.tz is None:
            dates = dates.dt.tz_localize("UTC")
        mask = dates < ts
        if not mask.any():
            return None, None
        row = dataframe[mask].iloc[-1]
        sl = float(row.get("short_sl" if trade.is_short else "long_sl", 0))
        ec = float(row.get("close", 0))
        if sl <= 0 or ec <= 0:
            return None, None
        dist = abs(ec - sl)
        tp = ec - dist * (ATR_TP / ATR_SL) if trade.is_short else ec + dist * (ATR_TP / ATR_SL)
        self._trade_cache[k] = (sl, tp)
        return sl, tp

    def custom_stoploss(self, pair, trade, current_time, current_rate,
                        current_profit, after_fill, **kwargs):
        df, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if df is None or len(df) == 0:
            return self.stoploss
        sl, _ = self._get_levels(trade, df)
        if sl is None:
            return self.stoploss
        return stoploss_from_absolute(sl, current_rate, is_short=trade.is_short)

    def custom_exit(self, pair, trade, current_time, current_rate,
                    current_profit, **kwargs):
        df, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if df is None or len(df) == 0:
            return None
        _, tp = self._get_levels(trade, df)
        if tp is None:
            return None
        if trade.is_short and current_rate <= tp:
            return "tp"
        if not trade.is_short and current_rate >= tp:
            return "tp"
        return None
