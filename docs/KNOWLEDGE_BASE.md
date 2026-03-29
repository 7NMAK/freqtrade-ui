# FreqTrade Platform — Knowledge Base

This is a comprehensive reference guide for all configurable parameters in the FreqTrade Trading Platform UI. Each parameter is documented with its purpose, type, default value (where applicable), and UI location.

This guide is derived from the official FreqTrade documentation (§1–§30) and maps directly to the platform's configuration pages. Use this as your primary reference when configuring trading bots, strategies, and backtesting parameters.

---

## Settings Page

The Settings page is where you configure the core trading parameters that control how your bot behaves. These parameters write directly to FreqTrade's `config.json` file.

### Core Trading

**max_open_trades**
- **Type:** Integer
- **Default:** 3
- **Description:** Maximum number of trades that can be open simultaneously. Set to -1 for unlimited. Controls position sizing and risk exposure.
- **UI Location:** Settings → Core Trading

**stake_currency**
- **Type:** String
- **Default:** USDT
- **Description:** The cryptocurrency used as the base currency for trading. All profits and losses are calculated in this currency (e.g., USDT, EUR, USD).
- **UI Location:** Settings → Core Trading

**stake_amount**
- **Type:** String or Number
- **Default:** unlimited
- **Description:** Amount of stake_currency to use for each trade. Use 'unlimited' to let FreqTrade calculate based on available balance and max_open_trades.
- **UI Location:** Settings → Core Trading

**tradable_balance_ratio**
- **Type:** Float (0.0–1.0)
- **Default:** 0.99
- **Description:** Ratio of total balance available for trading. Default 0.99 keeps 1% as reserve for safety.
- **UI Location:** Settings → Core Trading

**available_capital**
- **Type:** Number
- **Description:** Starting capital for 'unlimited' stake calculation in multi-bot setups. Each bot calculates its own stake from this amount.
- **UI Location:** Settings → Core Trading

**amend_last_stake_amount**
- **Type:** Boolean
- **Default:** false
- **Description:** If enabled, reduces the final trade's stake amount if there isn't enough balance for a full position. Useful for edge cases with multiple open trades.
- **UI Location:** Settings → Core Trading

**last_stake_amount_min_ratio**
- **Type:** Float
- **Description:** Minimum ratio for amended stake amount. If remaining balance is less than stake_amount × this ratio, the trade is skipped.
- **UI Location:** Settings → Core Trading

**amount_reserve_percent**
- **Type:** Float
- **Description:** Reserve percentage of minimum pair stake amount. Ensures enough balance remains for fees and emergencies.
- **UI Location:** Settings → Core Trading

### Timeframe & Display

**timeframe**
- **Type:** String
- **Default:** 1h
- **Description:** Candle interval for the strategy. Common values: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w. All indicators use this timeframe.
- **UI Location:** Settings → Timeframe

**fiat_display_currency**
- **Type:** String
- **Default:** USD
- **Description:** Fiat currency for displaying profit in Telegram and logs (e.g., USD, EUR). Leave empty to disable fiat conversion.
- **UI Location:** Settings → Timeframe & Display

### Dry Run

**dry_run**
- **Type:** Boolean
- **Default:** true
- **Description:** Simulation mode. When enabled, trades are simulated without real orders. Always test with dry_run=true before going live.
- **UI Location:** Settings → Dry Run

**dry_run_wallet**
- **Type:** Number
- **Default:** 1000
- **Description:** Simulated starting wallet balance for dry run mode. Use this to test with different capital levels.
- **UI Location:** Settings → Dry Run

**cancel_open_orders_on_exit**
- **Type:** Boolean
- **Default:** true
- **Description:** Cancel all pending open orders when the bot stops. Prevents leftover orders on the exchange.
- **UI Location:** Settings → Dry Run

**process_only_new_candles**
- **Type:** Boolean
- **Default:** true
- **Description:** Only process trading logic when a new candle arrives. Reduces CPU usage and prevents duplicate signals from being processed multiple times.
- **UI Location:** Settings → Dry Run

### ROI & Stoploss

**minimal_roi**
- **Type:** JSON Object
- **Default:** {"0": 0.10}
- **Description:** Return-On-Investment table. Defines minimum profit thresholds at different trade durations. Format: {minutes: profit_ratio}. Example: {"0": 0.04, "30": 0.02, "60": 0.01} means take 4% profit immediately, but settle for 2% after 30 minutes and 1% after 60 minutes.
- **UI Location:** Settings → ROI & Stoploss

**stoploss**
- **Type:** Float
- **Default:** -0.10
- **Description:** Maximum allowed loss ratio before a trade is closed automatically. Negative value (e.g., -0.10 = 10% loss). Required for every strategy for risk management.
- **UI Location:** Settings → ROI & Stoploss

**trailing_stop**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable trailing stoploss. The stop price follows the price upward, locking in profits as the trade moves in your favor.
- **UI Location:** Settings → ROI & Stoploss

**trailing_stop_positive**
- **Type:** Float
- **Description:** Alternative trailing stop percentage once the trade is profitable. E.g., 0.02 = trail 2% below the highest price reached.
- **UI Location:** Settings → ROI & Stoploss

**trailing_stop_positive_offset**
- **Type:** Float
- **Description:** Minimum profit required before trailing_stop_positive activates. E.g., 0.03 = need 3% profit first before trailing begins.
- **UI Location:** Settings → ROI & Stoploss

**trailing_only_offset_is_reached**
- **Type:** Boolean
- **Default:** false
- **Description:** When enabled, trailing stop only activates after trailing_stop_positive_offset is reached. Before that, the regular stoploss applies.
- **UI Location:** Settings → ROI & Stoploss

### Exit Signal Control

**use_exit_signal**
- **Type:** Boolean
- **Default:** true
- **Description:** Use exit signals from the strategy's populate_exit_trend method. If disabled, only ROI and stoploss trigger exits.
- **UI Location:** Settings → Exit Signals

**exit_profit_only**
- **Type:** Boolean
- **Default:** false
- **Description:** Only honor exit signals when the trade is profitable. Prevents selling at a loss due to exit signals.
- **UI Location:** Settings → Exit Signals

**exit_profit_offset**
- **Type:** Float
- **Description:** Minimum profit required before an exit signal is acted upon. E.g., 0.01 = need 1% profit before exit signals matter.
- **UI Location:** Settings → Exit Signals

**ignore_roi_if_entry_signal**
- **Type:** Boolean
- **Default:** false
- **Description:** Don't exit via ROI if an entry signal is still active. Useful for strategies that want to hold during strong trends.
- **UI Location:** Settings → Exit Signals

**ignore_buying_expired_candle_after**
- **Type:** Integer
- **Description:** Number of seconds after which an entry signal is considered expired. Prevents entering on stale signals from previous candles.
- **UI Location:** Settings → Exit Signals

### Order Types

**order_types.entry**
- **Type:** String
- **Options:** market, limit
- **Default:** market
- **Description:** Order type for entries: 'market' (immediate fill at current price) or 'limit' (specific price, may not fill).
- **UI Location:** Settings → Order Types

**order_types.exit**
- **Type:** String
- **Options:** market, limit
- **Default:** market
- **Description:** Order type for exits: 'market' (immediate fill) or 'limit' (specific price).
- **UI Location:** Settings → Order Types

**order_types.stoploss**
- **Type:** String
- **Options:** market, limit
- **Default:** market
- **Description:** Order type for stoploss: 'market' (guaranteed fill) or 'limit' (may not fill during flash crashes, risky).
- **UI Location:** Settings → Order Types

**order_types.emergency_exit**
- **Type:** String
- **Options:** market, limit
- **Default:** market
- **Description:** Fallback exit order type. Used when normal exit fails. Should always be 'market' for safety.
- **UI Location:** Settings → Order Types

**order_types.stoploss_on_exchange**
- **Type:** Boolean
- **Default:** false
- **Description:** Place stoploss orders directly on the exchange. Provides protection even if the bot goes offline. Recommended for safety.
- **UI Location:** Settings → Order Types

**order_types.stoploss_on_exchange_limit_ratio**
- **Type:** Float
- **Description:** For exchange stoploss limit orders: ratio below the stop price. E.g., 0.99 = limit 1% below stop.
- **UI Location:** Settings → Order Types

**order_types.stoploss_on_exchange_interval**
- **Type:** Integer
- **Default:** 60
- **Description:** How often to update the stoploss order on the exchange, in seconds. Lower = more responsive but higher API usage.
- **UI Location:** Settings → Order Types

**order_types.stoploss_price_type**
- **Type:** String
- **Options:** last, mark, index
- **Description:** Price type for stoploss evaluation: 'last' (last trade price), 'mark' (mark price for futures), or 'index' (index price).
- **UI Location:** Settings → Order Types

**order_time_in_force.entry**
- **Type:** String
- **Options:** GTC, FOK, IOC, PO
- **Default:** GTC
- **Description:** Time-in-force for entry orders. GTC=Good Till Cancelled, FOK=Fill or Kill, IOC=Immediate or Cancel, PO=Post Only.
- **UI Location:** Settings → Order Types

**order_time_in_force.exit**
- **Type:** String
- **Options:** GTC, FOK, IOC, PO
- **Default:** GTC
- **Description:** Time-in-force for exit orders. Same options as entry.
- **UI Location:** Settings → Order Types

### Unfilled Timeout

**unfilledtimeout.entry**
- **Type:** Integer
- **Default:** 10
- **Description:** Minutes (or seconds, see unit) before an unfilled entry order is cancelled and the next signal is processed.
- **UI Location:** Settings → Unfilled Timeout

**unfilledtimeout.exit**
- **Type:** Integer
- **Default:** 10
- **Description:** Minutes (or seconds) before an unfilled exit order is cancelled. After exit_timeout_count cancellations, an emergency exit may trigger.
- **UI Location:** Settings → Unfilled Timeout

**unfilledtimeout.unit**
- **Type:** String
- **Options:** minutes, seconds
- **Default:** minutes
- **Description:** Time unit for unfilled timeout: 'minutes' or 'seconds'.
- **UI Location:** Settings → Unfilled Timeout

**unfilledtimeout.exit_timeout_count**
- **Type:** Integer
- **Default:** 0
- **Description:** Number of exit timeout cancellations before triggering an emergency market exit. 0 = never emergency exit.
- **UI Location:** Settings → Unfilled Timeout

### Entry Pricing

**entry_pricing.price_side**
- **Type:** String
- **Options:** ask, bid, same, other
- **Description:** Which side of the orderbook to use for entry price: 'ask' (sell side), 'bid' (buy side), 'same' (follow trade direction), or 'other'.
- **UI Location:** Settings → Entry Pricing

**entry_pricing.use_order_book**
- **Type:** Boolean
- **Default:** false
- **Description:** Use the orderbook for entry pricing instead of the ticker. More accurate for limit orders.
- **UI Location:** Settings → Entry Pricing

**entry_pricing.order_book_top**
- **Type:** Integer
- **Default:** 1
- **Description:** Which orderbook level to use for entry pricing. 1 = best price, 2 = second best, etc. Higher numbers = deeper into the book.
- **UI Location:** Settings → Entry Pricing

**entry_pricing.check_depth_of_market.enabled**
- **Type:** Boolean
- **Default:** false
- **Description:** Check depth of market (DOM) before entering. Ensures sufficient liquidity exists at your entry price.
- **UI Location:** Settings → Entry Pricing

### Exit Pricing

**exit_pricing.price_side**
- **Type:** String
- **Options:** ask, bid, same, other
- **Description:** Which side of the orderbook to use for exit price: 'ask', 'bid', 'same', or 'other'.
- **UI Location:** Settings → Exit Pricing

**exit_pricing.use_order_book**
- **Type:** Boolean
- **Default:** false
- **Description:** Use the orderbook for exit pricing instead of the ticker.
- **UI Location:** Settings → Exit Pricing

**exit_pricing.order_book_top**
- **Type:** Integer
- **Default:** 1
- **Description:** Which orderbook level to use for exit pricing.
- **UI Location:** Settings → Exit Pricing

### Position Adjustment (DCA)

**position_adjustment_enable**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable Dollar-Cost Averaging (DCA). Allows the strategy to increase or decrease position size via the adjust_trade_position callback.
- **UI Location:** Settings → Position Adjustment

**max_entry_position_adjustment**
- **Type:** Integer
- **Default:** -1
- **Description:** Maximum number of additional entries for DCA. -1 = unlimited. Each additional entry uses the adjust_trade_position callback.
- **UI Location:** Settings → Position Adjustment

### Trading Mode (Futures)

**trading_mode**
- **Type:** String
- **Options:** spot, margin, futures
- **Default:** spot
- **Description:** Trading mode: 'spot' (buy/sell assets), 'margin' (leveraged spot), or 'futures' (perpetual contracts).
- **UI Location:** Settings → Trading Mode

**margin_mode**
- **Type:** String
- **Options:** isolated, cross
- **Default:** isolated
- **Description:** Margin mode for futures: 'isolated' (margin per trade) or 'cross' (shared margin across all trades). Isolated is safer.
- **UI Location:** Settings → Trading Mode

**liquidation_buffer**
- **Type:** Float
- **Default:** 0.05
- **Description:** Buffer between stoploss and liquidation price (5% default). Prevents liquidation by stopping out before the exchange liquidates your position.
- **UI Location:** Settings → Trading Mode

**leverage**
- **Type:** Integer or Float
- **Description:** Trading leverage multiplier. E.g., 10x means your position is 10 times your stake. Higher leverage = higher risk and liquidation danger.
- **UI Location:** Settings → Trading Mode

### Exchange

**exchange.name**
- **Type:** String
- **Options:** binance, bybit, gate, htx, kraken, okx, bingx, bitget, etc.
- **Description:** Exchange to trade on. Must be supported by FreqTrade.
- **UI Location:** Settings → Exchange

**exchange.key**
- **Type:** String (sensitive)
- **Description:** API key for the exchange. Required for live trading. Use trade-only permissions, never withdrawal permissions.
- **UI Location:** Settings → Exchange

**exchange.secret**
- **Type:** String (sensitive)
- **Description:** API secret for the exchange. Keep this secure and never share it. Use environment variables in production.
- **UI Location:** Settings → Exchange

**exchange.pair_whitelist**
- **Type:** Array of Strings
- **Example:** ["BTC/USDT:USDT", "ETH/USDT:USDT"]
- **Description:** List of trading pairs the bot is allowed to trade. Format: 'BASE/QUOTE:SETTLE' for futures (e.g., 'BTC/USDT:USDT'). Spot mode: 'BTC/USDT'.
- **UI Location:** Settings → Exchange

**exchange.pair_blacklist**
- **Type:** Array of Strings
- **Description:** List of pairs to exclude from trading. Takes priority over whitelist. Useful for avoiding illiquid or risky pairs.
- **UI Location:** Settings → Exchange

**exchange.enable_ws**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable WebSocket connections for real-time data. Faster than REST polling but uses more connections.
- **UI Location:** Settings → Exchange

**exchange.markets_refresh_interval**
- **Type:** Integer
- **Default:** 60
- **Description:** How often to refresh market data from the exchange, in minutes. Lower = fresher data but higher API usage.
- **UI Location:** Settings → Exchange

### Bot Identity

**bot_name**
- **Type:** String
- **Default:** FreqTrade
- **Description:** Human-readable name for this bot instance. Shown in Telegram messages, logs, and API responses.
- **UI Location:** Settings → Bot Identity

**initial_state**
- **Type:** String
- **Options:** running, stopped, paused
- **Default:** running
- **Description:** State when the bot starts: 'running' (trade immediately), 'stopped' (wait for manual start), or 'paused'.
- **UI Location:** Settings → Bot Identity

**force_entry_enable**
- **Type:** Boolean
- **Default:** true
- **Description:** Allow manual force-entry via the API/Telegram. When disabled, force-buy/sell commands are rejected.
- **UI Location:** Settings → Bot Identity

### Database & Data

**db_url**
- **Type:** String
- **Default:** sqlite:////freqtrade/user_data/tradesv3.sqlite
- **Description:** SQLAlchemy database URL for trade storage. Default: SQLite in user_data directory. Use PostgreSQL for production multi-bot setups.
- **UI Location:** Settings → Database

**strategy**
- **Type:** String
- **Description:** Strategy class name to use. Must match a Python class in the strategies directory.
- **UI Location:** Settings → Database

**strategy_path**
- **Type:** String
- **Description:** Additional directory to search for strategy files, beyond the default user_data/strategies.
- **UI Location:** Settings → Database

**dataformat_ohlcv**
- **Type:** String
- **Options:** feather, json, hdf5
- **Default:** feather
- **Description:** Storage format for OHLCV candle data: 'feather' (fast, default), 'json', or 'hdf5'.
- **UI Location:** Settings → Database

**dataformat_trades**
- **Type:** String
- **Options:** feather, json, hdf5
- **Default:** feather
- **Description:** Storage format for raw trade data: 'feather' (default), 'json', or 'hdf5'.
- **UI Location:** Settings → Database

### Internal Settings

**internals.process_throttle_secs**
- **Type:** Integer
- **Default:** 5
- **Description:** Minimum seconds between processing loops. Higher values reduce CPU/API usage. Set based on your candle timeframe.
- **UI Location:** Settings → Internal

**internals.heartbeat_interval**
- **Type:** Integer
- **Default:** 60
- **Description:** Seconds between heartbeat log messages. 0 to disable. Useful for monitoring bot health.
- **UI Location:** Settings → Internal

### API Server

**api_server.enabled**
- **Type:** Boolean
- **Default:** true
- **Description:** Enable the REST API server. Required for FreqUI and this platform to communicate with the bot.
- **UI Location:** Settings → API Server

**api_server.listen_ip_address**
- **Type:** String
- **Default:** 127.0.0.1
- **Description:** IP address to bind the API server. Use '0.0.0.0' for all interfaces or '127.0.0.1' for localhost only (safer).
- **UI Location:** Settings → API Server

**api_server.listen_port**
- **Type:** Integer
- **Default:** 8080
- **Description:** Port for the API server. Range: 1024-65535. Each bot needs a unique port.
- **UI Location:** Settings → API Server

**api_server.username**
- **Type:** String
- **Description:** Username for API authentication. Required if API server is enabled.
- **UI Location:** Settings → API Server

**api_server.password**
- **Type:** String (sensitive)
- **Description:** Password for API authentication. Use a strong, unique password.
- **UI Location:** Settings → API Server

**api_server.CORS_origins**
- **Type:** Array of Strings
- **Example:** ["http://localhost:3000"]
- **Description:** Allowed CORS origins for the API. Add your frontend URL here for cross-origin requests.
- **UI Location:** Settings → API Server

### Telegram

**telegram.enabled**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable Telegram bot notifications for trade events, status updates, and bot control.
- **UI Location:** Settings → Telegram

**telegram.token**
- **Type:** String (sensitive)
- **Description:** Telegram bot token from @BotFather. Required if Telegram is enabled.
- **UI Location:** Settings → Telegram

**telegram.chat_id**
- **Type:** String
- **Description:** Telegram chat ID for notifications. Use @userinfobot to find your chat ID.
- **UI Location:** Settings → Telegram

**telegram.balance_dust_level**
- **Type:** Float
- **Default:** 0.01
- **Description:** Minimum balance to display in /balance command. Hides dust amounts below this threshold.
- **UI Location:** Settings → Telegram

**telegram.notification_settings**
- **Type:** JSON Object
- **Description:** Per-event notification settings. Control which events trigger messages (entry, exit, entry_cancel, etc.).
- **UI Location:** Settings → Telegram

### Webhooks

**webhook.enabled**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable webhook notifications. Sends HTTP POST requests to your URL on trade events.
- **UI Location:** Settings → Webhooks

**webhook.url**
- **Type:** String
- **Example:** https://your-server.com/webhook
- **Description:** Endpoint URL for webhook notifications. Must be a valid HTTP(S) URL that accepts POST requests.
- **UI Location:** Settings → Webhooks

**webhook.entry**
- **Type:** String (JSON template)
- **Description:** JSON payload template sent when a trade entry is placed. Supports FT variables like {pair}, {stake_amount}.
- **UI Location:** Settings → Webhooks

**webhook.exit**
- **Type:** String (JSON template)
- **Description:** JSON payload template sent when a trade exit is placed. Supports {pair}, {profit_amount}, {profit_ratio}.
- **UI Location:** Settings → Webhooks

### Producer / Consumer (Multi-Bot Signal Sharing)

**external_message_consumer.enabled**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable the external message consumer. Allows this bot to receive signals from producer bots via WebSocket.
- **UI Location:** Settings → Producer/Consumer

**external_message_consumer.producers[].name**
- **Type:** String
- **Description:** Human-readable name for the producer bot. Used for identification in logs.
- **UI Location:** Settings → Producer/Consumer

**external_message_consumer.producers[].host**
- **Type:** String
- **Example:** 127.0.0.1
- **Description:** Hostname or IP of the producer bot's API server.
- **UI Location:** Settings → Producer/Consumer

**external_message_consumer.producers[].port**
- **Type:** Integer
- **Example:** 8080
- **Description:** Port of the producer bot's API server.
- **UI Location:** Settings → Producer/Consumer

**external_message_consumer.producers[].ws_token**
- **Type:** String (sensitive)
- **Description:** WebSocket authentication token for the producer. Must match the producer's api_server.ws_token.
- **UI Location:** Settings → Producer/Consumer

**external_message_consumer.wait_timeout**
- **Type:** Integer
- **Default:** 300
- **Description:** Seconds to wait for WebSocket messages before reconnecting. Default: 300.
- **UI Location:** Settings → Producer/Consumer

**external_message_consumer.remove_entry_exit_signals**
- **Type:** Boolean
- **Default:** false
- **Description:** Strip entry/exit signals from consumed data. Useful when the consumer has its own signal logic.
- **UI Location:** Settings → Producer/Consumer

### Exchange-Specific Settings

**fee**
- **Type:** Float
- **Description:** Override exchange fee ratio for backtesting. E.g., 0.001 = 0.1% per trade. Leave empty to use exchange defaults.
- **UI Location:** Settings → Exchange

**futures_funding_rate**
- **Type:** Float
- **Description:** Override futures funding rate for backtesting. Set to 0 to ignore funding fees in simulation.
- **UI Location:** Settings → Exchange

---

## Strategy Builder Page

The Strategy Builder page is where you configure strategy-level properties. These parameters are part of the strategy Python class itself, not the config.json.

### Strategy Properties

**can_short**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable short selling. When true, the strategy can open short positions in futures/margin mode.
- **UI Location:** Strategy Builder → Properties

**startup_candle_count**
- **Type:** Integer
- **Description:** Number of initial candles needed before the strategy can generate signals. Set to your longest indicator period (e.g., if you use RSI-200, set this to 200+).
- **UI Location:** Strategy Builder → Properties

**use_custom_stoploss**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable the custom_stoploss() callback for dynamic stoploss logic instead of a fixed value.
- **UI Location:** Strategy Builder → Properties

**plot_config**
- **Type:** JSON Object
- **Description:** Configuration for chart plotting in FreqUI. Defines which indicators appear on main and sub charts.
- **UI Location:** Strategy Builder → Properties

---

## Backtesting Page

The Backtesting page is where you test strategies on historical data before trading with real money. All parameters here are CLI arguments to `freqtrade backtesting`.

### Basic Backtesting

**--strategy**
- **Type:** String
- **Description:** Strategy name to backtest. Must be a valid strategy class in the strategies directory.
- **UI Location:** Backtesting → Strategy Selection

**--strategy-list**
- **Type:** Space-separated String
- **Example:** "SampleStrategy AnotherStrategy ThirdStrategy"
- **Description:** Space-separated list of strategies for side-by-side comparison. Results show metrics for each strategy.
- **UI Location:** Backtesting → Strategy Selection

**--timerange**
- **Type:** String
- **Format:** YYYYMMDD-YYYYMMDD
- **Example:** 20220101-20231231
- **Description:** Date range for backtesting. E.g., 20220101-20231231 tests from Jan 2022 to Dec 2023.
- **UI Location:** Backtesting → Date Range

**--timeframe**
- **Type:** String
- **Options:** 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
- **Description:** Override the strategy's default timeframe for this backtest run.
- **UI Location:** Backtesting → Advanced

**--timeframe-detail**
- **Type:** String
- **Description:** Use a smaller timeframe for more accurate entry/exit simulation. E.g., use 1m detail with 1h strategy (inner candles).
- **UI Location:** Backtesting → Advanced

### Export & Breakdown

**--export**
- **Type:** String
- **Options:** trades, signals, none
- **Description:** Export backtest results: 'trades' (trade list), 'signals' (all signals), or 'none' (summary only).
- **UI Location:** Backtesting → Export

**--breakdown**
- **Type:** Space-separated String
- **Options:** day, week, month
- **Example:** "day week month"
- **Description:** Add periodic breakdown to results. Shows P&L per day/week/month.
- **UI Location:** Backtesting → Export

### Caching & Optimization

**--cache**
- **Type:** String
- **Options:** day, week, month, none
- **Default:** none
- **Description:** Cache backtest results. 'day'/'week'/'month' reuses results if data hasn't changed. 'none' = always re-run.
- **UI Location:** Backtesting → Advanced

**--eps / --enable-position-stacking**
- **Type:** Boolean
- **Default:** false
- **Description:** Allow multiple open positions for the same pair. Useful for DCA strategies.
- **UI Location:** Backtesting → Advanced

**--enable-protections**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable strategy protections during backtesting. Simulates cooldown periods and max drawdown locks.
- **UI Location:** Backtesting → Advanced

### Wallet & Override

**--dry-run-wallet**
- **Type:** Number
- **Description:** Override starting wallet balance for this backtest. Useful for testing different capital levels.
- **UI Location:** Backtesting → Advanced

---

## Hyperopt Page

The Hyperopt page is where you optimize strategy parameters using machine learning. This automatically finds the best combination of parameters.

### Optimization Epochs

**--epochs**
- **Type:** Integer
- **Default:** 100
- **Description:** Number of optimization iterations. More epochs = better results but longer runtime. Start with 100-500 for quick tests, 1000+ for serious optimization.
- **UI Location:** Hyperopt → Epochs

**--spaces**
- **Type:** Space-separated String
- **Options:** buy, sell, roi, stoploss, trailing, protection, trades, default
- **Default:** default
- **Description:** Which parameter spaces to optimize: buy (entry signals), sell (exit signals), roi, stoploss, trailing (trailing stop), protection, trades (max_open_trades). 'default' = buy+sell+roi+stoploss.
- **UI Location:** Hyperopt → Spaces

### Loss Function

**--loss**
- **Type:** String
- **Options:** See Loss Functions below
- **Default:** SharpDaily
- **Description:** Loss function for optimization. Determines what Hyperopt tries to minimize/maximize. Choose based on your trading goals.
- **UI Location:** Hyperopt → Loss Function

#### Loss Functions Explained

**SharpeDaily**
- **Description:** Daily Sharpe ratio. More stable than per-trade Sharpe for longer backtests. Balances profit with consistency.

**Sortino / SortinDaily**
- **Description:** Sortino ratio — like Sharpe but only penalizes downside volatility. Better for asymmetric returns.

**Calmar**
- **Description:** Calmar ratio — annualized return divided by maximum drawdown. Good for drawdown-sensitive strategies.

**MaxDrawdown**
- **Description:** Minimizes maximum drawdown while maximizing profit. Good balance for risk-averse strategies.

**ShortTradeDuration**
- **Description:** Optimizes for short trade duration + maximum profit. Good for scalping strategies.

**OnlyProfit**
- **Description:** Optimizes purely for maximum profit. Simple but may lead to high drawdowns.

**ProfitDrawdown**
- **Description:** Balances profit against drawdown with configurable weighting. Flexible risk/reward optimization.

**MultiMetric**
- **Description:** Multi-metric optimization combining profit, trades, duration, and drawdown. Most comprehensive loss function.

### Trade Filtering

**--min-trades**
- **Type:** Integer
- **Default:** 10
- **Description:** Minimum trades required for a valid Hyperopt result. Low values (1-5) may overfit to few trades.
- **UI Location:** Hyperopt → Trade Filtering

**--max-trades**
- **Type:** Integer
- **Description:** Maximum trades for a valid result. Can filter out overly aggressive parameter sets.
- **UI Location:** Hyperopt → Trade Filtering

### Parallel Processing & Reproducibility

**--jobs**
- **Type:** Integer
- **Default:** 1
- **Description:** Number of parallel workers for Hyperopt. -1 = use all CPU cores. Higher = faster but more RAM usage.
- **UI Location:** Hyperopt → Parallel Processing

**--random-state**
- **Type:** Integer
- **Description:** Random seed for reproducible results. Same seed + same data + same strategy = identical optimization path.
- **UI Location:** Hyperopt → Parallel Processing

**--effort**
- **Type:** Float
- **Default:** 1.0
- **Description:** Search effort multiplier. Higher values explore more of the parameter space. 1.0 = standard, 2.0 = 2x exploration.
- **UI Location:** Hyperopt → Parallel Processing

---

## Pairlist Configuration

Pairlists determine which trading pairs your bot trades. Configure these in the Settings → Pairlist section.

### Pairlist Methods

**StaticPairList**
- **Description:** Static pair list. Uses the pairs defined in exchange.pair_whitelist. Simplest method, predictable.
- **UI Location:** Settings → Pairlists

**VolumePairList**
- **Description:** Select pairs by 24h trading volume. Ensures you trade the most liquid pairs. Dynamic and adapts to market changes.
- **UI Location:** Settings → Pairlists

**ProducerPairList**
- **Description:** Use pairs from a producer bot. For multi-bot setups where one bot selects pairs for others.
- **UI Location:** Settings → Pairlists

**RemotePairList**
- **Description:** Fetch pairs from a remote URL. Useful for external pair selection services.
- **UI Location:** Settings → Pairlists

**MarketCapPairList**
- **Description:** Select pairs by market capitalization via CoinGecko. Requires CoinGecko API key.
- **UI Location:** Settings → Pairlists

### Pairlist Filters

**AgeFilter**
- **Description:** Filter pairs by listing age on the exchange. Avoids newly listed, potentially volatile pairs.
- **UI Location:** Settings → Pairlists

**OffsetFilter**
- **Description:** Skip the first N pairs from the volume list. Useful for avoiding the most popular (crowded) pairs.
- **UI Location:** Settings → Pairlists

**PerformanceFilter**
- **Description:** Sort pairs by historical trading performance. Prioritizes pairs that have been profitable.
- **UI Location:** Settings → Pairlists

**PrecisionFilter**
- **Description:** Filter pairs where price precision would cause issues. Removes pairs with too few decimal places.
- **UI Location:** Settings → Pairlists

**PriceFilter**
- **Description:** Filter pairs by price range. Remove pairs that are too cheap (pump & dump risk) or too expensive.
- **UI Location:** Settings → Pairlists

**SpreadFilter**
- **Description:** Filter pairs by bid/ask spread. Removes pairs with high spreads that eat into profits.
- **UI Location:** Settings → Pairlists

**VolatilityFilter**
- **Description:** Filter pairs by volatility range. Keep only pairs within your strategy's optimal volatility window.
- **UI Location:** Settings → Pairlists

---

## Protections

Protections pause trading under risky conditions. Configure these in the Settings → Protections section.

**StoplossGuard**
- **Description:** Pause trading after N stoploss events in a time period. Prevents cascading losses during adverse conditions. Critical risk management.
- **UI Location:** Settings → Protections

**MaxDrawdown**
- **Description:** Pause trading when portfolio drawdown exceeds a threshold. Critical risk management feature.
- **UI Location:** Settings → Protections

**CooldownPeriod**
- **Description:** Cooldown period after a trade closes on a pair. Prevents immediate re-entry after a loss.
- **UI Location:** Settings → Protections

**LowProfitPairs**
- **Description:** Lock pairs that have negative profit over a lookback period. Avoids repeatedly losing on bad pairs.
- **UI Location:** Settings → Protections

---

## FreqAI Page

The FreqAI page is where you configure machine learning models for strategy predictions. These parameters go in the config.json freqai section.

### Core ML Configuration

**freqai.identifier**
- **Type:** String
- **Description:** Unique identifier for this FreqAI model. Used to name saved models and track training runs.
- **UI Location:** FreqAI → Core Config

**freqai.train_period_days**
- **Type:** Integer
- **Description:** Number of days of data to use for each training window. Larger = more data but slower training.
- **UI Location:** FreqAI → Core Config

**freqai.backtest_period_days**
- **Type:** Integer
- **Description:** Number of days between model retraining. Smaller = more frequent updates but more computational cost.
- **UI Location:** FreqAI → Core Config

**freqai.live_retrain_hours**
- **Type:** Integer
- **Description:** Hours between live model retraining. Controls how often the model adapts to new market conditions.
- **UI Location:** FreqAI → Core Config

**freqai.expired_hours**
- **Type:** Integer
- **Description:** Hours after which a model is considered expired and predictions are ignored until retrained.
- **UI Location:** FreqAI → Core Config

### Model Training

**freqai.model_training_parameters**
- **Type:** JSON Object
- **Description:** Model-specific training parameters passed directly to the ML library (LightGBM, XGBoost, etc.).
- **UI Location:** FreqAI → Training

**freqai.continual_learning**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable continual/incremental learning. The model is updated with new data rather than retrained from scratch.
- **UI Location:** FreqAI → Training

**freqai.activate_tensorboard**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable TensorBoard logging for model training. Useful for debugging neural network models.
- **UI Location:** FreqAI → Training

**freqai.wait_for_training_iteration_on_reload**
- **Type:** Boolean
- **Default:** false
- **Description:** Wait for model training to complete on reload before making predictions. Prevents stale predictions.
- **UI Location:** FreqAI → Training

### Model Management

**freqai.save_backtest_models**
- **Type:** Boolean
- **Default:** false
- **Description:** Save models during backtesting. Useful for analysis but uses significant disk space.
- **UI Location:** FreqAI → Model Management

**freqai.write_metrics_to_disk**
- **Type:** Boolean
- **Default:** false
- **Description:** Write training metrics to disk for later analysis. Includes loss curves, feature importance, etc.
- **UI Location:** FreqAI → Model Management

**freqai.override_exchange_check**
- **Type:** Boolean
- **Default:** false
- **Description:** Force FreqAI to work on exchanges not officially tested. Use with caution.
- **UI Location:** FreqAI → Model Management

### Feature Processing

**freqai.feature_parameters.include_timeframes**
- **Type:** Array of Strings
- **Example:** ["5m", "1h", "1d"]
- **Description:** Additional timeframes to include as features. Multi-timeframe indicators provide richer context.
- **UI Location:** FreqAI → Features

**freqai.feature_parameters.include_corr_pairlist**
- **Type:** Array of Strings
- **Example:** ["BTC/USDT", "ETH/USDT"]
- **Description:** Correlated pairs to include as features. Cross-pair indicators provide macro context.
- **UI Location:** FreqAI → Features

**freqai.feature_parameters.include_shifted_candles**
- **Type:** Integer
- **Description:** Number of shifted (lagged) candles to include as features. Adds temporal context to the model.
- **UI Location:** FreqAI → Features

**freqai.feature_parameters.indicator_periods_candles**
- **Type:** Array of Integers
- **Example:** [10, 20, 50]
- **Description:** Periods for auto-generated indicators. Creates RSI-10, RSI-20, RSI-50, etc.
- **UI Location:** FreqAI → Features

**freqai.feature_parameters.label_period_candles**
- **Type:** Integer
- **Description:** Number of future candles used to calculate the training label. Controls the prediction horizon.
- **UI Location:** FreqAI → Features

### Data Splitting & Validation

**freqai.data_split_parameters.test_size**
- **Type:** Float (0.0–1.0)
- **Example:** 0.33
- **Description:** Fraction of training data held out for validation. E.g., 0.33 = 33% for testing. Prevents overfitting.
- **UI Location:** FreqAI → Data Splitting

### Outlier Detection

**freqai.feature_parameters.DI_threshold**
- **Type:** Float
- **Description:** Dissimilarity Index threshold. Points above this are considered outliers and predictions are suppressed.
- **UI Location:** FreqAI → Outlier Detection

**freqai.feature_parameters.use_SVM_to_remove_outliers**
- **Type:** Boolean
- **Default:** false
- **Description:** Use Support Vector Machine to detect and remove outlier data points from training. Improves model quality.
- **UI Location:** FreqAI → Outlier Detection

**freqai.feature_parameters.use_DBSCAN_to_remove_outliers**
- **Type:** Boolean
- **Default:** false
- **Description:** Use DBSCAN clustering to detect and remove outlier training data. Alternative to SVM method.
- **UI Location:** FreqAI → Outlier Detection

### Reinforcement Learning

**freqai.rl_config.model_type**
- **Type:** String
- **Options:** PPO, A2C, DQN, SAC, TD3, etc.
- **Default:** PPO
- **Description:** RL algorithm: PPO (Proximal Policy Optimization) is recommended for most use cases.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.policy_type**
- **Type:** String
- **Options:** MlpPolicy, CnnPolicy, MultiInputPolicy
- **Default:** MlpPolicy
- **Description:** Neural network policy: 'MlpPolicy' (simple feedforward), 'CnnPolicy' (convolutional), or 'MultiInputPolicy'.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.train_cycles**
- **Type:** Integer
- **Description:** Number of training cycles per retrain. More cycles = better convergence but slower training.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.max_trade_duration_candles**
- **Type:** Integer
- **Description:** Maximum trade duration in candles for RL. Agent is penalized for holding beyond this.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.add_state_info**
- **Type:** Boolean
- **Default:** false
- **Description:** Include current trade state (position, profit, duration) as observations for the RL agent.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.randomize_starting_position**
- **Type:** Boolean
- **Default:** false
- **Description:** Randomize the starting position in training episodes. Improves generalization.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.drop_ohlc_from_features**
- **Type:** Boolean
- **Default:** false
- **Description:** Remove raw OHLC values from features. Forces the model to use indicators instead of raw prices.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.net_arch**
- **Type:** Array of Integers
- **Example:** [128, 128]
- **Description:** Neural network architecture as list of layer sizes. [128, 128] = two hidden layers with 128 neurons each.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.cpu_count**
- **Type:** Integer
- **Description:** Number of CPU cores for RL training. Higher = faster parallel environment simulation.
- **UI Location:** FreqAI → Reinforcement Learning

**freqai.rl_config.progress_bar**
- **Type:** Boolean
- **Default:** true
- **Description:** Show a progress bar during RL training. Useful for monitoring long training runs.
- **UI Location:** FreqAI → Reinforcement Learning

---

## Analytics Page

The Analytics page displays trade performance, indicators, and order flow data.

### Orderflow Analysis

**exchange.use_public_trades**
- **Type:** Boolean
- **Default:** false
- **Description:** Enable orderflow analysis using raw trade data. Provides footprint charts, volume profile, and VWAP.
- **UI Location:** Analytics → Orderflow

**orderflow.cache_size**
- **Type:** Integer
- **Description:** Number of candles of orderflow data to cache. More = better analysis but more memory usage.
- **UI Location:** Analytics → Orderflow

**orderflow.max_candles**
- **Type:** Integer
- **Description:** Maximum candles to calculate orderflow for. Limits processing time on large datasets.
- **UI Location:** Analytics → Orderflow

**orderflow.scale**
- **Type:** Float
- **Description:** Price scale for orderflow aggregation. Controls the granularity of the volume profile.
- **UI Location:** Analytics → Orderflow

**orderflow.imbalance_ratio**
- **Type:** Float
- **Description:** Threshold ratio for detecting order imbalances. Higher = only flag extreme imbalances.
- **UI Location:** Analytics → Orderflow

**orderflow.imbalance_volume**
- **Type:** Float
- **Description:** Minimum volume for an imbalance to be considered significant.
- **UI Location:** Analytics → Orderflow

**orderflow.stacked_imbalance_range**
- **Type:** Integer
- **Description:** Number of consecutive price levels needed for a stacked imbalance. Indicates strong support/resistance.
- **UI Location:** Analytics → Orderflow

---

## Data Management Page

The Data Management page handles downloading historical data and other utilities.

### Download Data Parameters

**--pairs**
- **Type:** Space-separated String
- **Example:** "BTC/USDT:USDT ETH/USDT:USDT"
- **Description:** Pairs to download historical data for. Uses exchange.pair_whitelist if not specified.
- **UI Location:** Data Management → Download

**--timeframes**
- **Type:** Space-separated String
- **Example:** "1h 4h 1d"
- **Description:** Timeframes to download. Downloads each timeframe separately.
- **UI Location:** Data Management → Download

**--timerange**
- **Type:** String
- **Format:** YYYYMMDD-YYYYMMDD or YYYYMMDD-
- **Example:** 20220101-20240101
- **Description:** Date range for data download. Leave end open with just a dash for ongoing to today.
- **UI Location:** Data Management → Download

**--exchange**
- **Type:** String
- **Description:** Exchange to download data from. Must match your config or specify explicitly.
- **UI Location:** Data Management → Download

**--trading-mode**
- **Type:** String
- **Options:** spot, margin, futures
- **Description:** Download data for: 'spot', 'margin', or 'futures'. Affects which pairs are available.
- **UI Location:** Data Management → Download

---

## System & Logging

**logfile**
- **Type:** String
- **Default:** /freqtrade/user_data/logs/freqtrade.log
- **Description:** Path to the log file. Leave empty for stdout only. Include this for debugging and monitoring.
- **UI Location:** Settings → Logging

---

## Quick Reference: Common Configuration Profiles

### Conservative (Low Risk)
- max_open_trades: 1-2
- stoploss: -0.05 (5% max loss)
- trailing_stop: true
- trailing_stop_positive: 0.01
- leverage: 1 (no leverage)
- initial_state: stopped (start manually)

### Moderate (Balanced Risk)
- max_open_trades: 3-5
- stoploss: -0.10 (10% max loss)
- trailing_stop: true
- leverage: 2-3x
- max_drawdown protection: enabled

### Aggressive (High Risk)
- max_open_trades: 10+
- stoploss: -0.20 (20% max loss)
- trailing_stop: false
- leverage: 5-10x
- dry_run: required before going live

### DCA (Dollar Cost Averaging)
- position_adjustment_enable: true
- max_entry_position_adjustment: 3-5
- stake_amount: calculated per adjustment
- max_open_trades: limits final position size

---

## Troubleshooting Tips

**"No trades generated"**
- Check startup_candle_count matches your longest indicator period
- Verify entry/exit signal generation in populate_entry_trend / populate_exit_trend
- Use process_only_new_candles: false to test more frequently
- Enable verbose logging in your strategy

**"Too many losses"**
- Lower stoploss (more aggressive stop, e.g., -0.05)
- Enable protections (StoplossGuard, MaxDrawdown)
- Reduce leverage or position size
- Backtest with different market conditions

**"Slow backtests"**
- Reduce startup_candle_count if safe
- Use cache: day/week/month
- Disable detailed output and export
- Reduce timeframe-detail usage

**"Models not retraining"**
- Check freqai.live_retrain_hours vs. backtest_period_days
- Verify training data is available and fresh
- Monitor logs for training errors
- Ensure disk space for model files

---

End of Knowledge Base. For more information, consult FREQTRADE_REFERENCE.md or the official FreqTrade documentation.
