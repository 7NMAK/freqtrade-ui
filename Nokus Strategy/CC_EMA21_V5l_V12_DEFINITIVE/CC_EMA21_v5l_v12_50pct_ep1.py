from CC_EMA21_v5l_v12_50pct import CC_EMA21_v5l_v12_50pct as _Base


class CC_EMA21_v5l_v12_50pct_ep1(_Base):
    """CC_EMA21 v5l/v12 50pct — Hyperopt epoch 1 params.
    IS +16.6% DD 6.5% WR 61.5% | OOS +20.2% DD 1.93% WR 68.6%
    """

    buy_params = {
        "atr_sl_mult": 0.77,
        "buy_pull_tol": 1.011,
        "buy_rsi_high": 58,
        "buy_rsi_low": 39,
    }

    sell_params = {
        "sell_pull_tol": 0.997,
        "sell_rsi_high": 58,
        "sell_rsi_low": 44,
    }
