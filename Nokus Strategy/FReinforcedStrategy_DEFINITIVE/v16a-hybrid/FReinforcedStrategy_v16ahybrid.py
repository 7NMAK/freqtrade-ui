# pragma pylint: disable=missing-docstring, invalid-name, pointless-string-statement
# flake8: noqa: F401
# isort: skip_file
from functools import reduce
import numpy as np
import pandas as pd
from pandas import DataFrame
from freqtrade.strategy import IStrategy
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class FReinforcedStrategy(IStrategy):

    INTERFACE_VERSION = 3
    timeframe = "5m"
    minimal_roi = {"0": 999}

    # Hybrid: fixed SL -1.5%, trailing activates at +2%, trails at 1.5%
    stoploss = -0.015
    can_short = True

    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = True

    process_only_new_candles = True
    startup_candle_count: int = 21

    ema_short_period_val = 8
    ema_long_period_val = 21

    def informative_pairs(self):
        return [("BTC/USDT:USDT", "4h")]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:

        dataframe["ema_short_8"] = ta.EMA(dataframe, timeperiod=self.ema_short_period_val)
        dataframe["ema_long_21"] = ta.EMA(dataframe, timeperiod=self.ema_long_period_val)

        btc_4h = self.dp.get_pair_dataframe("BTC/USDT:USDT", "4h")
        btc_4h["btc_sma20"]  = ta.SMA(btc_4h["close"], timeperiod=20)
        btc_4h["btc_margin"] = (btc_4h["close"] - btc_4h["btc_sma20"]) / btc_4h["btc_sma20"] * 100
        dataframe = pd.merge_asof(dataframe, btc_4h[["date", "btc_margin"]], on="date", direction="backward")

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:

        # v16a LONG: btc_margin > 1.0
        dataframe.loc[
            (dataframe["btc_margin"] > 1.0) &
            qtpylib.crossed_above(dataframe["ema_short_8"], dataframe["ema_long_21"]),
            "enter_long",
        ] = 1

        # v16a SHORT: btc_margin < -2.0
        dataframe.loc[
            (dataframe["btc_margin"] < -2.0) &
            qtpylib.crossed_below(dataframe["ema_short_8"], dataframe["ema_long_21"]),
            "enter_short",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
