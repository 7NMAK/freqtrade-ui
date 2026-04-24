# pragma pylint: disable=missing-docstring, invalid-name, pointless-string-statement
# flake8: noqa: F401
# isort: skip_file
# --- Do not remove these libs ---
from functools import reduce
import numpy as np  # noqa
import pandas as pd  # noqa
from pandas import DataFrame

from freqtrade.strategy import (
    IStrategy,
)

# --------------------------------
# Add your lib to import here
import talib.abstract as ta
import freqtrade.vendor.qtpylib.indicators as qtpylib


class FReinforcedStrategy(IStrategy):

    INTERFACE_VERSION = 3
    timeframe = "5m"
    minimal_roi = {"0": 0.02}

    stoploss = -0.02
    can_short = False

    trailing_stop = False

    process_only_new_candles = True
    startup_candle_count: int = 21

    # Fixed default values
    ema_short_period_val = 8
    ema_long_period_val = 21

    def informative_pairs(self):
        return [("BTC/USDT:USDT", "4h")]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:

        dataframe[f"ema_short_{self.ema_short_period_val}"] = ta.EMA(dataframe, timeperiod=self.ema_short_period_val)
        dataframe[f"ema_long_{self.ema_long_period_val}"] = ta.EMA(dataframe, timeperiod=self.ema_long_period_val)

        # BTC 4H macro filter
        btc_4h = self.dp.get_pair_dataframe("BTC/USDT:USDT", "4h")
        btc_4h["btc_sma20"] = ta.SMA(btc_4h["close"], timeperiod=20)
        btc_4h["btc_above_sma"] = (btc_4h["close"] > btc_4h["btc_sma20"]).astype(int)

        dataframe = pd.merge_asof(
            dataframe,
            btc_4h[["date", "btc_above_sma"]],
            on="date",
            direction="backward",
        )

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        conditions_long = []

        conditions_long.append(dataframe["btc_above_sma"] == 1)

        conditions_long.append(
            qtpylib.crossed_above(
                dataframe[f"ema_short_{self.ema_short_period_val}"],
                dataframe[f"ema_long_{self.ema_long_period_val}"],
            )
        )

        dataframe.loc[
            reduce(lambda x, y: x & y, conditions_long),
            "enter_long",
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        # No exit signal — ROI and SL only
        return dataframe
