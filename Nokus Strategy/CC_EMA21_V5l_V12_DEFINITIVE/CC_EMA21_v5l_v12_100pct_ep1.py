from CC_EMA21_v5l_v12_100pct import CC_EMA21_v5l_v12_100pct as _Base


class CC_EMA21_v5l_v12_100pct_ep1(_Base):
    """CC_EMA21 v5l/v12 100pct — Hyperopt epoch 1 params.
    IS +35.0% DD 11.5% WR 61.5% | OOS +35.2% DD 3.93% WR 68.6%
    """

    buy_params = {
        "atr_sl_mult": 0.13,
        "buy_pull_tol": 1.012,
        "buy_rsi_high": 57,
        "buy_rsi_low": 41,
    }

    sell_params = {
        "sell_pull_tol": 0.991,
        "sell_rsi_high": 69,
        "sell_rsi_low": 52,
    }
