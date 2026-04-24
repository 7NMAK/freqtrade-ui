# Supertrend v14 — v12b + BTC 1D SMA200 bull filter
# Base: v12b (ADX 20-25 + ST m=4,p=8 trailing stop)
# PROMENA: LONG only when BTC close > 1D SMA200 (bull market confirmation)
from datetime import datetime
import numpy as np
import pandas as pd
import talib.abstract as ta
from freqtrade.strategy import IStrategy, merge_informative_pair
from pandas import DataFrame


class Supertrend_v14(IStrategy):

    INTERFACE_VERSION: int = 3
    timeframe = '1h'
    can_short: bool = False

    minimal_roi = {"0": 99}
    stoploss = -0.30
    trailing_stop = False
    use_custom_stoploss = True

    process_only_new_candles = True
    startup_candle_count: int = 199

    def informative_pairs(self):
        return [("BTC/USDT:USDT", "1d")]

    def supertrend(self, dataframe: pd.DataFrame, multiplier, period):
        df = dataframe.copy()
        high = df['high'].values
        low = df['low'].values
        close = df['close'].values
        length = len(df)

        tr = ta.TRANGE(df['high'], df['low'], df['close'])
        atr = pd.Series(tr).rolling(period).mean().to_numpy()

        basic_ub = (high + low) / 2 + multiplier * atr
        basic_lb = (high + low) / 2 - multiplier * atr

        final_ub = np.zeros(length)
        final_lb = np.zeros(length)

        for i in range(period, length):
            final_ub[i] = basic_ub[i] if basic_ub[i] < final_ub[i-1] or close[i-1] > final_ub[i-1] else final_ub[i-1]
            final_lb[i] = basic_lb[i] if basic_lb[i] > final_lb[i-1] or close[i-1] < final_lb[i-1] else final_lb[i-1]

        st = np.zeros(length)
        for i in range(period, length):
            if st[i-1] == final_ub[i-1]:
                st[i] = final_ub[i] if close[i] <= final_ub[i] else final_lb[i]
            elif st[i-1] == final_lb[i-1]:
                st[i] = final_lb[i] if close[i] >= final_lb[i] else final_ub[i]

        stx = np.where(st > 0, np.where(close < st, 'down', 'up'), None)
        result = pd.DataFrame({'ST': st, 'STX': stx}, index=df.index)
        result.fillna(0, inplace=True)
        return result

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        res_b1 = self.supertrend(dataframe, multiplier=4, period=8)
        dataframe['st_buy_1'] = res_b1['STX']
        dataframe['st_buy_1_val'] = res_b1['ST']

        res_b2 = self.supertrend(dataframe, multiplier=7, period=9)
        dataframe['st_buy_2'] = res_b2['STX']

        res_b3 = self.supertrend(dataframe, multiplier=1, period=8)
        dataframe['st_buy_3'] = res_b3['STX']

        res_s1 = self.supertrend(dataframe, multiplier=1, period=16)
        dataframe['st_sell_1'] = res_s1['STX']

        res_s2 = self.supertrend(dataframe, multiplier=3, period=18)
        dataframe['st_sell_2'] = res_s2['STX']

        res_s3 = self.supertrend(dataframe, multiplier=6, period=18)
        dataframe['st_sell_3'] = res_s3['STX']

        # ADX / DMI
        dataframe['adx'] = ta.ADX(dataframe, timeperiod=14)
        dataframe['plus_di'] = ta.PLUS_DI(dataframe, timeperiod=14)
        dataframe['minus_di'] = ta.MINUS_DI(dataframe, timeperiod=14)

        # BTC 1D SMA200 bull filter
        btc_1d = self.dp.get_pair_dataframe("BTC/USDT:USDT", "1d")
        btc_1d['sma200'] = ta.SMA(btc_1d, timeperiod=200)
        btc_1d['above_sma200'] = (btc_1d['close'] > btc_1d['sma200']).astype(int)
        dataframe = merge_informative_pair(
            dataframe, btc_1d[['date', 'above_sma200']],
            self.timeframe, '1d', ffill=True
        )

        return dataframe

    def custom_stoploss(self, pair: str, trade: 'Trade', current_time: datetime,
                        current_rate: float, current_profit: float, **kwargs) -> float:
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe is None or len(dataframe) == 0:
            return -0.30

        last_candle = dataframe.iloc[-1]
        st_val = last_candle.get('st_buy_1_val', None)

        if st_val is None or st_val == 0:
            return -0.30

        sl_ratio = (st_val - current_rate) / current_rate
        if sl_ratio >= 0:
            return -0.30
        return max(sl_ratio, -0.30)

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['st_buy_1'] == 'up') &
            (dataframe['st_buy_2'] == 'up') &
            (dataframe['st_buy_3'] == 'up') &
            (dataframe['adx'] > 20) &
            (dataframe['adx'] < 25) &
            (dataframe['plus_di'] > dataframe['minus_di']) &
            (dataframe['above_sma200_1d'].shift(1) == 1) &
            (dataframe['volume'] > 0),
            'enter_long'
        ] = 1
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        dataframe.loc[
            (dataframe['st_sell_1'] == 'down') &
            (dataframe['st_sell_2'] == 'down') &
            (dataframe['st_sell_3'] == 'down') &
            (dataframe['volume'] > 0),
            'exit_long'
        ] = 1
        return dataframe
