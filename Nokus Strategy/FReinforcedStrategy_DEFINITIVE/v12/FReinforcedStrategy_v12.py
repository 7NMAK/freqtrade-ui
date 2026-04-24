# pragma pylint: disable=missing-docstring, invalid-name, pointless-string-statement
# flake8: noqa: F401
# isort: skip_file
from functools import reduce
import numpy as np  # noqa
import pandas as pd  # noqa
from pandas import DataFrame

from freqtrade.strategy import IStrategy

import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class FReinforcedStrategy(IStrategy):

    INTERFACE_VERSION = 3
    timeframe = "5m"
    minimal_roi = {"0": 999}

    stoploss = -0.02
    can_short = True

    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = False

    process_only_new_candles = True
    startup_candle_count: int = 21

    ema_short_period_val = 8
    ema_long_period_val = 21

    def informative_pairs(self):
        return [("BTC/USDT:USDT", "4h")]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:

        dataframe["ema_short_8"]  = ta.EMA(dataframe, timeperiod=self.ema_short_period_val)
        dataframe["ema_long_21"]  = ta.EMA(dataframe, timeperiod=self.ema_long_period_val)

        # BTC 4H macro filter — negative margin for shorts
        btc_4h = self.dp.get_pair_dataframe("BTC/USDT:USDT", "4h")
        btc_4h["btc_sma20"]  = ta.SMA(btc_4h["close"], timeperiod=20)
        btc_4h["btc_margin"] = (btc_4h["close"] - btc_4h["btc_sma20"]) / btc_4h["btc_sma20"] * 100

        dataframe = pd.merge_asof(
            dataframe,
            btc_4h[["date", "btc_margin"]],
            on="date",
            direction="backward",
        )

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        conditions_short = []

        # BTC 4H must be >1% BELOW SMA20
        conditions_short.append(dataframe["btc_margin"] < -1.0)

        conditions_short.append(
            qtpylib.crossed_below(
                dataframe["ema_short_8"],
                dataframe["ema_long_21"],
            )
        )

        dataframe.loc[
            reduce(lambda x, y: x & y, conditions_short),
            "enter_short",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
