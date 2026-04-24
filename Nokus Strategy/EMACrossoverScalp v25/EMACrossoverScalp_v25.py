# KORAK 7 — Position Sizing (v2 winner)
# Tiering po C1 (btc_margin > 3%) + C2 (RSI > 55 LONG / < 45 SHORT)
# 0/2 → 1% stake | 1/2 → 2% stake | 2/2 → 3% stake
# IS: T=766, WR=52.0%, PF=1.96, P&L=+808 USDT (10K), DD=0.29%
# OOS: T=199, WR=49.2%, PF=1.78, P&L=+138 USDT (10K), DD=0.14%
# conf3 OOS: WR=54%, avg profit +47% vs conf2 — tiering validiran
from freqtrade.strategy import IStrategy
from pandas import DataFrame
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib
import pandas as pd

class EMACrossoverScalp_v25(IStrategy):
    INTERFACE_VERSION = 3
    timeframe = "5m"
    startup_candle_count = 200
    can_short = True
    max_open_trades = 1
    process_only_new_candles = True

    minimal_roi = {"0": 999}
    stoploss = -0.02
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = False

    def informative_pairs(self):
        return [("BTC/USDT:USDT", "4h")]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema9"]  = ta.EMA(dataframe, timeperiod=9)
        dataframe["ema21"] = ta.EMA(dataframe, timeperiod=21)
        dataframe["rsi"]   = ta.RSI(dataframe, timeperiod=14)
        dataframe["atr"]   = ta.ATR(dataframe, timeperiod=14)
        dataframe["atr_pct"] = dataframe["atr"] / dataframe["close"] * 100
        dataframe["ema_cross_up"]   = qtpylib.crossed_above(dataframe["ema9"], dataframe["ema21"])
        dataframe["ema_cross_down"] = qtpylib.crossed_below(dataframe["ema9"], dataframe["ema21"])
        btc_4h = self.dp.get_pair_dataframe("BTC/USDT:USDT", "4h")
        if len(btc_4h) > 0:
            btc_4h["btc_sma20"] = ta.SMA(btc_4h["close"], timeperiod=20)
            btc_4h["btc_margin"] = (btc_4h["close"] - btc_4h["btc_sma20"]) / btc_4h["btc_sma20"] * 100
            dataframe = pd.merge_asof(dataframe, btc_4h[["date", "btc_margin"]], on="date", direction="backward")
        else:
            dataframe["btc_margin"] = 0.0
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        base_long  = (dataframe["ema_cross_up"])   & (dataframe["rsi"] > 50) & (dataframe["btc_margin"] > 2.0)  & (dataframe["atr_pct"] < 0.50) & (dataframe["volume"] > 0)
        base_short = (dataframe["ema_cross_down"]) & (dataframe["rsi"] < 50) & (dataframe["btc_margin"] < -2.0) & (dataframe["atr_pct"] < 0.50) & (dataframe["volume"] > 0)

        c1_long  = dataframe["btc_margin"] > 3.0
        c2_long  = dataframe["rsi"] > 55
        c1_short = dataframe["btc_margin"] < -3.0
        c2_short = dataframe["rsi"] < 45

        conf_long  = c1_long.astype(int)  + c2_long.astype(int)
        conf_short = c1_short.astype(int) + c2_short.astype(int)

        # LONG
        dataframe.loc[base_long & (conf_long == 0), "enter_long"] = 1
        dataframe.loc[base_long & (conf_long == 0), "enter_tag"]  = "conf1"
        dataframe.loc[base_long & (conf_long == 1), "enter_long"] = 1
        dataframe.loc[base_long & (conf_long == 1), "enter_tag"]  = "conf2"
        dataframe.loc[base_long & (conf_long == 2), "enter_long"] = 1
        dataframe.loc[base_long & (conf_long == 2), "enter_tag"]  = "conf3"

        # SHORT
        dataframe.loc[base_short & (conf_short == 0), "enter_short"] = 1
        dataframe.loc[base_short & (conf_short == 0), "enter_tag"]   = "conf1"
        dataframe.loc[base_short & (conf_short == 1), "enter_short"] = 1
        dataframe.loc[base_short & (conf_short == 1), "enter_tag"]   = "conf2"
        dataframe.loc[base_short & (conf_short == 2), "enter_short"] = 1
        dataframe.loc[base_short & (conf_short == 2), "enter_tag"]   = "conf3"

        return dataframe

    def custom_stake_amount(self, current_time, current_rate, proposed_stake,
                            min_stake, max_stake, leverage, entry_tag, side, **kwargs):
        try:
            total = self.wallets.get_total_stake_amount()
        except Exception:
            total = proposed_stake

        if entry_tag == "conf3":
            frac = 0.03
        elif entry_tag == "conf2":
            frac = 0.02
        else:
            frac = 0.01

        stake = total * frac
        if min_stake is not None:
            stake = max(stake, min_stake)
        if max_stake is not None:
            stake = min(stake, max_stake)
        return stake

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
