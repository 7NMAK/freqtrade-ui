from CC_EMA21_v5l_v12_50pct import CC_EMA21_v5l_v12_50pct as _Base


class CC_EMA21_v5l_v12_50pct_ep35(_Base):
    """CC_EMA21 v5l/v12 50pct — Hyperopt epoch 35 params.
    IS +18.3% DD 11.4% WR 58.8% | OOS +22.4% DD 2.82% WR 65.8%
    """

    buy_params = {
        "atr_sl_mult": 0.5,
        "buy_pull_tol": 1.002,
        "buy_rsi_high": 56,
        "buy_rsi_low": 39,
    }

    sell_params = {
        "sell_pull_tol": 0.999,
        "sell_rsi_high": 55,
        "sell_rsi_low": 45,
    }
