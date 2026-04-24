from CC_EMA21_v5l_v12_100pct import CC_EMA21_v5l_v12_100pct as _Base


class CC_EMA21_v5l_v12_100pct_ep35(_Base):
    """CC_EMA21 v5l/v12 100pct — Hyperopt epoch 35 params.
    IS +35.0% DD 11.5% WR 61.5% (identican rezultat kao ep1 za 100pct)
    """

    buy_params = {
        "atr_sl_mult": 0.74,
        "buy_pull_tol": 1.009,
        "buy_rsi_high": 64,
        "buy_rsi_low": 29,
    }

    sell_params = {
        "sell_pull_tol": 0.988,
        "sell_rsi_high": 72,
        "sell_rsi_low": 47,
    }
