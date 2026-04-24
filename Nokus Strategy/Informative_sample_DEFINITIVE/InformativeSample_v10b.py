from freqtrade.strategy import IStrategy
from pandas import DataFrame
import pandas as pd
import talib.abstract as ta
from typing import List, Tuple


class InformativeSample_v10b(IStrategy):
    """
    InformativeSample v10b — LONG only, BTC 4H filter, trailing stop
    vs v9c: BTC filter timeframe changed from 1H to 4H.
    Hypothesis: 4H SMA20 changes slower → cleaner macro context → fewer false entries.

    LONG entry: EMA20 > EMA50 AND BTC/USDT:USDT 4H close > SMA20 (4H)
    Exit: trailing stop activates at +2% profit, trails 1.5% below high.
    """

    INTERFACE_VERSION = 3
    timeframe = "5m"
    startup_candle_count = 100
    can_short = False
    max_open_trades = 1

    minimal_roi = {"0": 999}
    stoploss = -0.02
    trailing_stop = True
    trailing_stop_positive = 0.015
    trailing_stop_positive_offset = 0.02
    trailing_only_offset_is_reached = False
    process_only_new_candles = True

    def informative_pairs(self) -> List[Tuple[str, str]]:
        return [("BTC/USDT:USDT", "4h")]

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe["ema20"] = ta.EMA(dataframe["close"], timeperiod=20)
        dataframe["ema50"] = ta.EMA(dataframe["close"], timeperiod=50)

        btc_4h = self.dp.get_pair_dataframe("BTC/USDT:USDT", "4h")
        if len(btc_4h) > 0:
            btc_4h["btc_sma20"] = ta.SMA(btc_4h["close"], timeperiod=20)
            btc_4h["btc_above_sma"] = (btc_4h["close"] > btc_4h["btc_sma20"]).astype(int)

            btc_merge = btc_4h[["date", "btc_above_sma"]].copy()
            dataframe = pd.merge_asof(
                dataframe.sort_values("date"),
                btc_merge.sort_values("date"),
                on="date",
                direction="backward",
            )
            dataframe["btc_above_sma"] = dataframe["btc_above_sma"].fillna(0).astype(int)
        else:
            dataframe["btc_above_sma"] = 0

        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe["ema20"] > dataframe["ema50"]) &
            (dataframe["btc_above_sma"] == 1),
            "enter_long"
        ] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        return dataframe
