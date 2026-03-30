/**
 * FreqTrade Parameter Tooltip Database
 * Source: FREQTRADE_REFERENCE.md (§1–§30)
 *
 * Every entry maps to a real FT config key or strategy property.
 * Descriptions are from official FT documentation — nothing invented.
 */

export interface TooltipEntry {
  /** Human-readable explanation */
  description: string;
  /** Dotted config.json path (e.g. "freqai.identifier") */
  configKey?: string;
  /** FT Reference section number */
  section?: string;
}

export const TOOLTIPS: Record<string, TooltipEntry> = {
  // ═══════════════════════════════════════════════════════════════════
  // §1 — CORE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════

  // Core Trading
  max_open_trades: {
    description: "Maximum number of trades that can be open simultaneously. Set to -1 for unlimited.",
    configKey: "max_open_trades",
    section: "§1",
  },
  stake_currency: {
    description: "The cryptocurrency used as the base currency for trading. All profits and losses are calculated in this currency (e.g., USDT).",
    configKey: "stake_currency",
    section: "§1",
  },
  stake_amount: {
    description: "Amount of stake_currency to use for each trade. Use 'unlimited' to let FreqTrade calculate based on available balance and max_open_trades.",
    configKey: "stake_amount",
    section: "§1",
  },
  tradable_balance_ratio: {
    description: "Ratio of the total balance that is available for trading. Default 0.99 keeps 1% as reserve.",
    configKey: "tradable_balance_ratio",
    section: "§1",
  },
  available_capital: {
    description: "Starting capital for 'unlimited' stake calculation in multi-bot setups. Each bot calculates its own stake from this amount.",
    configKey: "available_capital",
    section: "§1",
  },
  amend_last_stake_amount: {
    description: "If enabled, reduces the final trade's stake amount if there isn't enough balance for a full position.",
    configKey: "amend_last_stake_amount",
    section: "§1",
  },
  last_stake_amount_min_ratio: {
    description: "Minimum ratio for amended stake amount. If the remaining balance is less than stake_amount * this ratio, the trade is skipped.",
    configKey: "last_stake_amount_min_ratio",
    section: "§1",
  },
  amount_reserve_percent: {
    description: "Reserve percentage of the minimum pair stake amount. Ensures enough balance for fees.",
    configKey: "amount_reserve_percent",
    section: "§1",
  },

  // Timeframe & Display
  timeframe: {
    description: "Candle interval for the strategy. Common values: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w.",
    configKey: "timeframe",
    section: "§1",
  },
  fiat_display_currency: {
    description: "Fiat currency for displaying profit in Telegram and logs (e.g., USD, EUR). Leave empty to disable.",
    configKey: "fiat_display_currency",
    section: "§1",
  },

  // Dry Run
  dry_run: {
    description: "Simulation mode. When enabled, trades are simulated without real orders. Always test with dry_run=true before going live.",
    configKey: "dry_run",
    section: "§1",
  },
  dry_run_wallet: {
    description: "Simulated starting wallet balance for dry run mode. Default is 1000.",
    configKey: "dry_run_wallet",
    section: "§1",
  },
  cancel_open_orders_on_exit: {
    description: "Cancel all pending open orders when the bot stops. Prevents leftover orders on the exchange.",
    configKey: "cancel_open_orders_on_exit",
    section: "§1",
  },
  process_only_new_candles: {
    description: "Only process trading logic when a new candle arrives. Reduces CPU usage and prevents duplicate signals.",
    configKey: "process_only_new_candles",
    section: "§1",
  },

  // ROI & Stoploss
  minimal_roi: {
    description: "Return-On-Investment table. Defines minimum profit thresholds at different trade durations. Format: {minutes: profit_ratio}. E.g., {\"0\": 0.04, \"30\": 0.02, \"60\": 0.01}.",
    configKey: "minimal_roi",
    section: "§1",
  },
  stoploss: {
    description: "Maximum allowed loss ratio before a trade is closed. Negative value, e.g., -0.10 = 10% loss. Required for every strategy.",
    configKey: "stoploss",
    section: "§1",
  },
  trailing_stop: {
    description: "Enable trailing stoploss. The stop price follows the price upward, locking in profits as the trade moves in your favor.",
    configKey: "trailing_stop",
    section: "§1",
  },
  trailing_stop_positive: {
    description: "Alternative trailing stop percentage once the trade is profitable. E.g., 0.02 = trail 2% below the high.",
    configKey: "trailing_stop_positive",
    section: "§1",
  },
  trailing_stop_positive_offset: {
    description: "Minimum profit required before trailing_stop_positive activates. E.g., 0.03 = need 3% profit first.",
    configKey: "trailing_stop_positive_offset",
    section: "§1",
  },
  trailing_only_offset_is_reached: {
    description: "When enabled, trailing stop only activates after trailing_stop_positive_offset is reached. Before that, the regular stoploss applies.",
    configKey: "trailing_only_offset_is_reached",
    section: "§1",
  },

  // Exit Signal Control
  use_exit_signal: {
    description: "Use exit signals from the strategy's populate_exit_trend method. If disabled, only ROI and stoploss trigger exits.",
    configKey: "use_exit_signal",
    section: "§1",
  },
  exit_profit_only: {
    description: "Only honor exit signals when the trade is profitable. Prevents selling at a loss due to exit signals.",
    configKey: "exit_profit_only",
    section: "§1",
  },
  exit_profit_offset: {
    description: "Minimum profit required before an exit signal is acted upon. E.g., 0.01 = need 1% profit.",
    configKey: "exit_profit_offset",
    section: "§1",
  },
  ignore_roi_if_entry_signal: {
    description: "Don't exit via ROI if an entry signal is still active. Useful for strategies that want to hold during strong trends.",
    configKey: "ignore_roi_if_entry_signal",
    section: "§1",
  },
  ignore_buying_expired_candle_after: {
    description: "Number of seconds after which an entry signal is considered expired. Prevents entering on stale signals.",
    configKey: "ignore_buying_expired_candle_after",
    section: "§1",
  },

  // Order Types
  order_types_entry: {
    description: "Order type for entries: 'market' (immediate fill) or 'limit' (specific price).",
    configKey: "order_types.entry",
    section: "§1",
  },
  order_types_exit: {
    description: "Order type for exits: 'market' (immediate fill) or 'limit' (specific price).",
    configKey: "order_types.exit",
    section: "§1",
  },
  order_types_stoploss: {
    description: "Order type for stoploss: 'market' (guaranteed fill) or 'limit' (may not fill in flash crashes).",
    configKey: "order_types.stoploss",
    section: "§1",
  },
  order_types_emergency_exit: {
    description: "Fallback exit order type. Used when normal exit fails. Default: 'market' for safety.",
    configKey: "order_types.emergency_exit",
    section: "§1",
  },
  stoploss_on_exchange: {
    description: "Place stoploss orders directly on the exchange. Provides protection even if the bot goes offline.",
    configKey: "order_types.stoploss_on_exchange",
    section: "§1",
  },
  stoploss_on_exchange_limit_ratio: {
    description: "For exchange stoploss limit orders: ratio below the stop price. E.g., 0.99 = limit 1% below stop.",
    configKey: "order_types.stoploss_on_exchange_limit_ratio",
    section: "§1",
  },
  stoploss_on_exchange_interval: {
    description: "How often to update the stoploss order on the exchange, in seconds. Default: 60.",
    configKey: "order_types.stoploss_on_exchange_interval",
    section: "§1",
  },
  stoploss_price_type: {
    description: "Price type for stoploss evaluation: 'last' (last trade price), 'mark' (mark price), or 'index' (index price).",
    configKey: "order_types.stoploss_price_type",
    section: "§1",
  },
  order_time_in_force_entry: {
    description: "Time-in-force for entry orders: GTC (Good Till Cancelled), FOK (Fill or Kill), IOC (Immediate or Cancel), PO (Post Only).",
    configKey: "order_time_in_force.entry",
    section: "§1",
  },
  order_time_in_force_exit: {
    description: "Time-in-force for exit orders: GTC, FOK, IOC, or PO.",
    configKey: "order_time_in_force.exit",
    section: "§1",
  },

  // Unfilled Timeout
  unfilledtimeout_entry: {
    description: "Minutes before an unfilled entry order is cancelled and the next signal is processed.",
    configKey: "unfilledtimeout.entry",
    section: "§1",
  },
  unfilledtimeout_exit: {
    description: "Minutes before an unfilled exit order is cancelled. After exit_timeout_count cancellations, an emergency exit is triggered.",
    configKey: "unfilledtimeout.exit",
    section: "§1",
  },
  unfilledtimeout_unit: {
    description: "Time unit for unfilled timeout: 'minutes' or 'seconds'.",
    configKey: "unfilledtimeout.unit",
    section: "§1",
  },
  unfilledtimeout_exit_timeout_count: {
    description: "Number of exit timeout cancellations before triggering an emergency market exit. 0 = never emergency exit.",
    configKey: "unfilledtimeout.exit_timeout_count",
    section: "§1",
  },

  // Entry Pricing
  entry_pricing_price_side: {
    description: "Which side of the orderbook to use for entry price: 'ask', 'bid', 'same' (follow trade direction), or 'other'.",
    configKey: "entry_pricing.price_side",
    section: "§1",
  },
  entry_pricing_use_order_book: {
    description: "Use the orderbook for entry pricing instead of the ticker. More accurate for limit orders.",
    configKey: "entry_pricing.use_order_book",
    section: "§1",
  },
  entry_pricing_order_book_top: {
    description: "Which orderbook level to use for entry pricing. 1 = best price, 2 = second best, etc.",
    configKey: "entry_pricing.order_book_top",
    section: "§1",
  },
  entry_pricing_check_depth_of_market: {
    description: "Check depth of market (DOM) before entering. Ensures sufficient liquidity.",
    configKey: "entry_pricing.check_depth_of_market.enabled",
    section: "§1",
  },

  // Exit Pricing
  exit_pricing_price_side: {
    description: "Which side of the orderbook to use for exit price: 'ask', 'bid', 'same', or 'other'.",
    configKey: "exit_pricing.price_side",
    section: "§1",
  },
  exit_pricing_use_order_book: {
    description: "Use the orderbook for exit pricing instead of the ticker.",
    configKey: "exit_pricing.use_order_book",
    section: "§1",
  },
  exit_pricing_order_book_top: {
    description: "Which orderbook level to use for exit pricing.",
    configKey: "exit_pricing.order_book_top",
    section: "§1",
  },

  // Position Adjustment (DCA)
  position_adjustment_enable: {
    description: "Enable Dollar-Cost Averaging (DCA). Allows the strategy to increase or decrease position size via the adjust_trade_position callback.",
    configKey: "position_adjustment_enable",
    section: "§1",
  },
  max_entry_position_adjustment: {
    description: "Maximum number of additional entries for DCA. -1 = unlimited. Each additional entry uses the adjust_trade_position callback.",
    configKey: "max_entry_position_adjustment",
    section: "§1",
  },

  // Trading Mode (Futures)
  trading_mode: {
    description: "Trading mode: 'spot' (buy/sell assets), 'margin' (leveraged spot), or 'futures' (perpetual contracts).",
    configKey: "trading_mode",
    section: "§1",
  },
  margin_mode: {
    description: "Margin mode for futures: 'isolated' (margin per trade) or 'cross' (shared margin across all trades).",
    configKey: "margin_mode",
    section: "§1",
  },
  liquidation_buffer: {
    description: "Buffer between stoploss and liquidation price. Default 0.05 (5%). Prevents liquidation by stopping out before the exchange liquidates.",
    configKey: "liquidation_buffer",
    section: "§1",
  },

  // Exchange
  exchange_name: {
    description: "Exchange to trade on. Supported: binance, bybit, gate, htx, kraken, okx, bingx, bitget, etc.",
    configKey: "exchange.name",
    section: "§1",
  },
  exchange_key: {
    description: "API key for the exchange. Required for live trading. Use trade-only permissions, never withdrawal.",
    configKey: "exchange.key",
    section: "§1",
  },
  exchange_secret: {
    description: "API secret for the exchange. Keep this secure and never share it.",
    configKey: "exchange.secret",
    section: "§1",
  },
  exchange_pair_whitelist: {
    description: "List of trading pairs the bot is allowed to trade. Format: 'BASE/QUOTE:SETTLE' for futures (e.g., 'BTC/USDT:USDT').",
    configKey: "exchange.pair_whitelist",
    section: "§1",
  },
  exchange_pair_blacklist: {
    description: "List of pairs to exclude from trading. Takes priority over whitelist. Useful for avoiding illiquid or risky pairs.",
    configKey: "exchange.pair_blacklist",
    section: "§1",
  },
  exchange_enable_ws: {
    description: "Enable WebSocket connections for real-time data. Faster than REST polling but uses more connections.",
    configKey: "exchange.enable_ws",
    section: "§1",
  },
  exchange_markets_refresh_interval: {
    description: "How often to refresh market data from the exchange, in minutes. Default: 60.",
    configKey: "exchange.markets_refresh_interval",
    section: "§1",
  },

  // Bot Identity
  bot_name: {
    description: "Human-readable name for this bot instance. Shown in Telegram messages and logs.",
    configKey: "bot_name",
    section: "§1",
  },
  initial_state: {
    description: "State when the bot starts: 'running' (trade immediately), 'stopped' (wait for manual start), or 'paused'.",
    configKey: "initial_state",
    section: "§1",
  },
  force_entry_enable: {
    description: "Allow manual force-entry via the API/Telegram. When disabled, force-buy/sell commands are rejected.",
    configKey: "force_entry_enable",
    section: "§1",
  },

  // Database & Data
  db_url: {
    description: "SQLAlchemy database URL for trade storage. Default: SQLite in user_data directory.",
    configKey: "db_url",
    section: "§1",
  },
  strategy: {
    description: "Strategy class name to use. Must match a Python class in the strategies directory.",
    configKey: "strategy",
    section: "§1",
  },
  strategy_path: {
    description: "Additional directory to search for strategy files, beyond the default user_data/strategies.",
    configKey: "strategy_path",
    section: "§1",
  },
  dataformat_ohlcv: {
    description: "Storage format for OHLCV candle data: 'feather' (fast, default), 'json', or 'hdf5'.",
    configKey: "dataformat_ohlcv",
    section: "§1",
  },
  dataformat_trades: {
    description: "Storage format for raw trade data: 'feather' (default), 'json', or 'hdf5'.",
    configKey: "dataformat_trades",
    section: "§1",
  },

  // Internal
  internals_process_throttle_secs: {
    description: "Minimum seconds between processing loops. Higher values reduce CPU/API usage. Default: 5.",
    configKey: "internals.process_throttle_secs",
    section: "§1",
  },
  internals_heartbeat_interval: {
    description: "Seconds between heartbeat log messages. 0 to disable. Default: 60.",
    configKey: "internals.heartbeat_interval",
    section: "§1",
  },

  // API Server
  api_server_enabled: {
    description: "Enable the REST API server. Required for FreqUI and our platform to communicate with the bot.",
    configKey: "api_server.enabled",
    section: "§1",
  },
  api_server_listen_ip: {
    description: "IP address to bind the API server. Use '0.0.0.0' for all interfaces or '127.0.0.1' for localhost only.",
    configKey: "api_server.listen_ip_address",
    section: "§1",
  },
  api_server_listen_port: {
    description: "Port for the API server. Range: 1024-65535. Each bot needs a unique port.",
    configKey: "api_server.listen_port",
    section: "§1",
  },
  api_server_username: {
    description: "Username for API authentication. Required if API server is enabled.",
    configKey: "api_server.username",
    section: "§1",
  },
  api_server_password: {
    description: "Password for API authentication. Use a strong, unique password.",
    configKey: "api_server.password",
    section: "§1",
  },
  api_server_cors_origins: {
    description: "Allowed CORS origins for the API. Add your frontend URL here for cross-origin requests.",
    configKey: "api_server.CORS_origins",
    section: "§1",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §11 — TELEGRAM
  // ═══════════════════════════════════════════════════════════════════

  telegram_enabled: {
    description: "Enable Telegram bot notifications for trade events, status updates, and bot control.",
    configKey: "telegram.enabled",
    section: "§11",
  },
  telegram_token: {
    description: "Telegram bot token from @BotFather. Required if Telegram is enabled.",
    configKey: "telegram.token",
    section: "§11",
  },
  telegram_chat_id: {
    description: "Telegram chat ID for notifications. Use @userinfobot to find your chat ID.",
    configKey: "telegram.chat_id",
    section: "§11",
  },
  telegram_balance_dust_level: {
    description: "Minimum balance to display in /balance command. Hides dust amounts below this threshold.",
    configKey: "telegram.balance_dust_level",
    section: "§11",
  },
  telegram_notification_settings: {
    description: "Per-event notification settings. Control which events trigger messages (entry, exit, entry_cancel, etc.).",
    configKey: "telegram.notification_settings",
    section: "§11",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §13 — WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════

  webhook_enabled: {
    description: "Enable webhook notifications. Sends HTTP POST requests to your URL on trade events.",
    configKey: "webhook.enabled",
    section: "§13",
  },
  webhook_url: {
    description: "Endpoint URL for webhook notifications. Must be a valid HTTP(S) URL that accepts POST requests.",
    configKey: "webhook.url",
    section: "§13",
  },
  webhook_entry: {
    description: "JSON payload template sent when a trade entry is placed. Supports FT variables like {pair}, {stake_amount}.",
    configKey: "webhook.entry",
    section: "§13",
  },
  webhook_exit: {
    description: "JSON payload template sent when a trade exit is placed. Supports {pair}, {profit_amount}, {profit_ratio}.",
    configKey: "webhook.exit",
    section: "§13",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §17 — PRODUCER / CONSUMER
  // ═══════════════════════════════════════════════════════════════════

  external_message_consumer_enabled: {
    description: "Enable the external message consumer. Allows this bot to receive signals from producer bots via WebSocket.",
    configKey: "external_message_consumer.enabled",
    section: "§17",
  },
  producer_name: {
    description: "Human-readable name for the producer bot. Used for identification in logs.",
    configKey: "external_message_consumer.producers[].name",
    section: "§17",
  },
  producer_host: {
    description: "Hostname or IP of the producer bot's API server.",
    configKey: "external_message_consumer.producers[].host",
    section: "§17",
  },
  producer_port: {
    description: "Port of the producer bot's API server.",
    configKey: "external_message_consumer.producers[].port",
    section: "§17",
  },
  producer_ws_token: {
    description: "WebSocket authentication token for the producer. Must match the producer's api_server.ws_token.",
    configKey: "external_message_consumer.producers[].ws_token",
    section: "§17",
  },
  consumer_wait_timeout: {
    description: "Seconds to wait for WebSocket messages before reconnecting. Default: 300.",
    configKey: "external_message_consumer.wait_timeout",
    section: "§17",
  },
  consumer_remove_entry_exit_signals: {
    description: "Strip entry/exit signals from consumed data. Useful when the consumer has its own signal logic.",
    configKey: "external_message_consumer.remove_entry_exit_signals",
    section: "§17",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §5 — BACKTESTING
  // ═══════════════════════════════════════════════════════════════════

  bt_strategy: {
    description: "Strategy name to backtest. Must be a valid strategy class in the strategies directory.",
    configKey: "--strategy",
    section: "§5",
  },
  bt_strategy_list: {
    description: "Space-separated list of strategies for side-by-side comparison. Results show metrics for each strategy.",
    configKey: "--strategy-list",
    section: "§5",
  },
  bt_timerange: {
    description: "Date range for backtesting. Format: YYYYMMDD-YYYYMMDD. E.g., 20220101-20231231.",
    configKey: "--timerange",
    section: "§5",
  },
  bt_timeframe: {
    description: "Override the strategy's default timeframe for this backtest run.",
    configKey: "--timeframe",
    section: "§5",
  },
  bt_timeframe_detail: {
    description: "Use a smaller timeframe for more accurate entry/exit simulation. E.g., use 1m detail with 1h strategy.",
    configKey: "--timeframe-detail",
    section: "§5",
  },
  bt_export: {
    description: "Export backtest results: 'trades' (trade list), 'signals' (all signals), or 'none'.",
    configKey: "--export",
    section: "§5",
  },
  bt_breakdown: {
    description: "Add periodic breakdown to results: 'day', 'week', and/or 'month'. Shows P&L per period.",
    configKey: "--breakdown",
    section: "§5",
  },
  bt_cache: {
    description: "Cache backtest results. 'day'/'week'/'month' reuses results if data hasn't changed. 'none' = always re-run.",
    configKey: "--cache",
    section: "§5",
  },
  bt_enable_position_stacking: {
    description: "Allow multiple open positions for the same pair. Useful for DCA strategies.",
    configKey: "--eps / --enable-position-stacking",
    section: "§5",
  },
  bt_enable_protections: {
    description: "Enable strategy protections during backtesting. Simulates cooldown periods and max drawdown locks.",
    configKey: "--enable-protections",
    section: "§5",
  },
  bt_dry_run_wallet: {
    description: "Override starting wallet balance for this backtest. Useful for testing different capital levels.",
    configKey: "--dry-run-wallet",
    section: "§5",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §6 — HYPEROPT
  // ═══════════════════════════════════════════════════════════════════

  ho_epochs: {
    description: "Number of optimization iterations. More epochs = better results but longer runtime. Start with 100-500.",
    configKey: "--epochs",
    section: "§6",
  },
  ho_spaces: {
    description: "Which parameter spaces to optimize: buy, sell, roi, stoploss, trailing, protection, trades, or 'default' (buy+sell+roi+stoploss).",
    configKey: "--spaces",
    section: "§6",
  },
  ho_loss: {
    description: "Loss function for optimization. Determines what Hyperopt tries to minimize/maximize.",
    configKey: "--loss",
    section: "§6",
  },
  ho_min_trades: {
    description: "Minimum trades required for a valid Hyperopt result. Low values may overfit to few trades.",
    configKey: "--min-trades",
    section: "§6",
  },
  ho_max_trades: {
    description: "Maximum trades for a valid result. Can filter out overly aggressive parameter sets.",
    configKey: "--max-trades",
    section: "§6",
  },
  ho_jobs: {
    description: "Number of parallel workers for Hyperopt. -1 = use all CPU cores. Higher = faster but more RAM.",
    configKey: "--jobs",
    section: "§6",
  },
  ho_random_state: {
    description: "Random seed for reproducible results. Same seed + same data = same optimization path.",
    configKey: "--random-state",
    section: "§6",
  },
  ho_effort: {
    description: "Search effort multiplier. Higher values explore more of the parameter space. Default: 1.0.",
    configKey: "--effort",
    section: "§6",
  },

  // Loss Functions
  loss_short_trade_dur: {
    description: "Optimizes for short trade duration + maximum profit. Good for scalping strategies.",
    section: "§6",
  },
  loss_only_profit: {
    description: "Optimizes purely for maximum profit. Simple but may lead to high drawdowns.",
    section: "§6",
  },
  loss_sharpe: {
    description: "Optimizes for Sharpe ratio (risk-adjusted returns). Balances profit with consistency.",
    section: "§6",
  },
  loss_sharpe_daily: {
    description: "Daily Sharpe ratio. More stable than per-trade Sharpe for longer backtests.",
    section: "§6",
  },
  loss_sortino: {
    description: "Sortino ratio — like Sharpe but only penalizes downside volatility. Better for asymmetric returns.",
    section: "§6",
  },
  loss_sortino_daily: {
    description: "Daily Sortino ratio. Preferred for strategies with consistent daily performance.",
    section: "§6",
  },
  loss_calmar: {
    description: "Calmar ratio — annualized return divided by maximum drawdown. Good for drawdown-sensitive strategies.",
    section: "§6",
  },
  loss_max_drawdown: {
    description: "Minimizes maximum drawdown while maximizing profit. Good balance for risk-averse strategies.",
    section: "§6",
  },
  loss_profit_drawdown: {
    description: "Balances profit against drawdown with configurable weighting. Flexible risk/reward optimization.",
    section: "§6",
  },
  loss_multi_metric: {
    description: "Multi-metric optimization combining profit, trades, duration, and drawdown. Most comprehensive loss function.",
    section: "§6",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §7 — PAIRLISTS & PROTECTIONS
  // ═══════════════════════════════════════════════════════════════════

  pairlist_static: {
    description: "Static pair list. Uses the pairs defined in exchange.pair_whitelist. Simplest method.",
    configKey: "pairlists[].method: StaticPairList",
    section: "§7",
  },
  pairlist_volume: {
    description: "Select pairs by 24h trading volume. Ensures you trade the most liquid pairs.",
    configKey: "pairlists[].method: VolumePairList",
    section: "§7",
  },
  pairlist_producer: {
    description: "Use pairs from a producer bot. For multi-bot setups where one bot selects pairs for others.",
    configKey: "pairlists[].method: ProducerPairList",
    section: "§7",
  },
  pairlist_remote: {
    description: "Fetch pairs from a remote URL. Useful for external pair selection services.",
    configKey: "pairlists[].method: RemotePairList",
    section: "§7",
  },
  pairlist_market_cap: {
    description: "Select pairs by market capitalization via CoinGecko. Requires CoinGecko API key.",
    configKey: "pairlists[].method: MarketCapPairList",
    section: "§7",
  },

  // Pairlist Filters
  pairfilter_age: {
    description: "Filter pairs by listing age on the exchange. Avoids newly listed, potentially volatile pairs.",
    configKey: "pairlists[].method: AgeFilter",
    section: "§7",
  },
  pairfilter_offset: {
    description: "Skip the first N pairs from the volume list. Useful for avoiding the most popular (crowded) pairs.",
    configKey: "pairlists[].method: OffsetFilter",
    section: "§7",
  },
  pairfilter_performance: {
    description: "Sort pairs by historical trading performance. Prioritizes pairs that have been profitable.",
    configKey: "pairlists[].method: PerformanceFilter",
    section: "§7",
  },
  pairfilter_precision: {
    description: "Filter pairs where price precision would cause issues. Removes pairs with too few decimal places.",
    configKey: "pairlists[].method: PrecisionFilter",
    section: "§7",
  },
  pairfilter_price: {
    description: "Filter pairs by price range. Remove pairs that are too cheap (pump & dump risk) or too expensive.",
    configKey: "pairlists[].method: PriceFilter",
    section: "§7",
  },
  pairfilter_spread: {
    description: "Filter pairs by bid/ask spread. Removes pairs with high spreads that eat into profits.",
    configKey: "pairlists[].method: SpreadFilter",
    section: "§7",
  },
  pairfilter_volatility: {
    description: "Filter pairs by volatility range. Keep only pairs within your strategy's optimal volatility window.",
    configKey: "pairlists[].method: VolatilityFilter",
    section: "§7",
  },

  // Protections
  protection_stoploss_guard: {
    description: "Pause trading after N stoploss events in a time period. Prevents cascading losses during adverse conditions.",
    configKey: "protections[].method: StoplossGuard",
    section: "§7",
  },
  protection_max_drawdown: {
    description: "Pause trading when portfolio drawdown exceeds a threshold. Critical risk management feature.",
    configKey: "protections[].method: MaxDrawdown",
    section: "§7",
  },
  protection_cooldown_period: {
    description: "Cooldown period after a trade closes on a pair. Prevents immediate re-entry after a loss.",
    configKey: "protections[].method: CooldownPeriod",
    section: "§7",
  },
  protection_low_profit_pairs: {
    description: "Lock pairs that have negative profit over a lookback period. Avoids repeatedly losing on bad pairs.",
    configKey: "protections[].method: LowProfitPairs",
    section: "§7",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §24 — FREQAI CORE
  // ═══════════════════════════════════════════════════════════════════

  freqai_identifier: {
    description: "Unique identifier for this FreqAI model. Used to name saved models and track training runs.",
    configKey: "freqai.identifier",
    section: "§24",
  },
  freqai_model_training_parameters: {
    description: "Model-specific training parameters passed directly to the ML library (LightGBM, XGBoost, etc.).",
    configKey: "freqai.model_training_parameters",
    section: "§24",
  },
  freqai_train_period_days: {
    description: "Number of days of data to use for each training window. Larger = more data but slower training.",
    configKey: "freqai.train_period_days",
    section: "§24",
  },
  freqai_backtest_period_days: {
    description: "Number of days between model retraining. Smaller = more frequent updates but more computational cost.",
    configKey: "freqai.backtest_period_days",
    section: "§24",
  },
  freqai_live_retrain_hours: {
    description: "Hours between live model retraining. Controls how often the model adapts to new market conditions.",
    configKey: "freqai.live_retrain_hours",
    section: "§24",
  },
  freqai_expired_hours: {
    description: "Hours after which a model is considered expired and predictions are ignored until retrained.",
    configKey: "freqai.expired_hours",
    section: "§24",
  },
  freqai_continual_learning: {
    description: "Enable continual/incremental learning. The model is updated with new data rather than retrained from scratch.",
    configKey: "freqai.continual_learning",
    section: "§24",
  },
  freqai_activate_tensorboard: {
    description: "Enable TensorBoard logging for model training. Useful for debugging neural network models.",
    configKey: "freqai.activate_tensorboard",
    section: "§24",
  },
  freqai_wait_for_training: {
    description: "Wait for model training to complete on reload before making predictions. Prevents stale predictions.",
    configKey: "freqai.wait_for_training_iteration_on_reload",
    section: "§24",
  },
  freqai_override_exchange_check: {
    description: "Force FreqAI to work on exchanges not officially tested. Use with caution — may cause unexpected behavior.",
    configKey: "freqai.override_exchange_check",
    section: "§24",
  },
  freqai_save_backtest_models: {
    description: "Save models during backtesting. Useful for analysis but uses significant disk space.",
    configKey: "freqai.save_backtest_models",
    section: "§24",
  },
  freqai_write_metrics: {
    description: "Write training metrics to disk for later analysis. Includes loss curves, feature importance, etc.",
    configKey: "freqai.write_metrics_to_disk",
    section: "§24",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §26 — FEATURE PROCESSING
  // ═══════════════════════════════════════════════════════════════════

  freqai_include_timeframes: {
    description: "Additional timeframes to include as features. E.g., ['5m', '1h', '1d'] adds multi-timeframe indicators.",
    configKey: "freqai.feature_parameters.include_timeframes",
    section: "§26",
  },
  freqai_include_corr_pairlist: {
    description: "Correlated pairs to include as features. E.g., ['BTC/USDT', 'ETH/USDT'] adds cross-pair indicators.",
    configKey: "freqai.feature_parameters.include_corr_pairlist",
    section: "§26",
  },
  freqai_include_shifted_candles: {
    description: "Number of shifted (lagged) candles to include as features. Adds temporal context to the model.",
    configKey: "freqai.feature_parameters.include_shifted_candles",
    section: "§26",
  },
  freqai_indicator_periods: {
    description: "Periods for auto-generated indicators. E.g., [10, 20, 50] creates RSI-10, RSI-20, RSI-50 etc.",
    configKey: "freqai.feature_parameters.indicator_periods_candles",
    section: "§26",
  },
  freqai_label_period_candles: {
    description: "Number of future candles used to calculate the training label. Controls the prediction horizon.",
    configKey: "freqai.feature_parameters.label_period_candles",
    section: "§26",
  },
  freqai_test_size: {
    description: "Fraction of training data held out for validation. E.g., 0.33 = 33% for testing. Prevents overfitting.",
    configKey: "freqai.data_split_parameters.test_size",
    section: "§26",
  },

  // Outlier Detection
  freqai_di_threshold: {
    description: "Dissimilarity Index threshold. Points above this are considered outliers and predictions are suppressed.",
    configKey: "freqai.feature_parameters.DI_threshold",
    section: "§26",
  },
  freqai_use_SVM_to_remove_outliers: {
    description: "Use Support Vector Machine to detect and remove outlier data points from training. Improves model quality.",
    configKey: "freqai.feature_parameters.use_SVM_to_remove_outliers",
    section: "§26",
  },
  freqai_use_DBSCAN_to_remove_outliers: {
    description: "Use DBSCAN clustering to detect and remove outlier training data. Alternative to SVM method.",
    configKey: "freqai.feature_parameters.use_DBSCAN_to_remove_outliers",
    section: "§26",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §25 — REINFORCEMENT LEARNING
  // ═══════════════════════════════════════════════════════════════════

  rl_model_type: {
    description: "RL algorithm: PPO, A2C, DQN, SAC, TD3, etc. PPO is recommended for most use cases.",
    configKey: "freqai.rl_config.model_type",
    section: "§25",
  },
  rl_policy_type: {
    description: "Neural network policy: 'MlpPolicy' (simple), 'CnnPolicy' (conv), or 'MultiInputPolicy'.",
    configKey: "freqai.rl_config.policy_type",
    section: "§25",
  },
  rl_train_cycles: {
    description: "Number of training cycles per retrain. More cycles = better convergence but slower training.",
    configKey: "freqai.rl_config.train_cycles",
    section: "§25",
  },
  rl_max_trade_duration_candles: {
    description: "Maximum trade duration in candles for RL. Agent is penalized for holding beyond this.",
    configKey: "freqai.rl_config.max_trade_duration_candles",
    section: "§25",
  },
  rl_add_state_info: {
    description: "Include current trade state (position, profit, duration) as observations for the RL agent.",
    configKey: "freqai.rl_config.add_state_info",
    section: "§25",
  },
  rl_randomize_starting_position: {
    description: "Randomize the starting position in training episodes. Improves generalization.",
    configKey: "freqai.rl_config.randomize_starting_position",
    section: "§25",
  },
  rl_drop_ohlc_from_features: {
    description: "Remove raw OHLC values from features. Forces the model to use indicators instead of raw prices.",
    configKey: "freqai.rl_config.drop_ohlc_from_features",
    section: "§25",
  },
  rl_net_arch: {
    description: "Neural network architecture as list of layer sizes. E.g., [128, 128] = two hidden layers with 128 neurons each.",
    configKey: "freqai.rl_config.net_arch",
    section: "§25",
  },
  rl_cpu_count: {
    description: "Number of CPU cores for RL training. Higher = faster parallel environment simulation.",
    configKey: "freqai.rl_config.cpu_count",
    section: "§25",
  },
  rl_progress_bar: {
    description: "Show a progress bar during RL training. Useful for monitoring long training runs.",
    configKey: "freqai.rl_config.progress_bar",
    section: "§25",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §28 — MULTI-INSTANCE & LOGGING
  // ═══════════════════════════════════════════════════════════════════

  logfile: {
    description: "Path to the log file. E.g., '/freqtrade/user_data/logs/freqtrade.log'. Leave empty for stdout only.",
    configKey: "logfile",
    section: "§28",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §29 — ORDERFLOW
  // ═══════════════════════════════════════════════════════════════════

  orderflow_enabled: {
    description: "Enable orderflow analysis using raw trade data. Provides footprint charts, volume profile, and VWAP.",
    configKey: "exchange.use_public_trades",
    section: "§29",
  },
  orderflow_cache_size: {
    description: "Number of candles of orderflow data to cache. More = better analysis but more memory.",
    configKey: "orderflow.cache_size",
    section: "§29",
  },
  orderflow_max_candles: {
    description: "Maximum candles to calculate orderflow for. Limits processing time on large datasets.",
    configKey: "orderflow.max_candles",
    section: "§29",
  },
  orderflow_scale: {
    description: "Price scale for orderflow aggregation. Controls the granularity of the volume profile.",
    configKey: "orderflow.scale",
    section: "§29",
  },
  orderflow_imbalance_ratio: {
    description: "Threshold ratio for detecting order imbalances. Higher = only flag extreme imbalances.",
    configKey: "orderflow.imbalance_ratio",
    section: "§29",
  },
  orderflow_imbalance_volume: {
    description: "Minimum volume for an imbalance to be considered significant.",
    configKey: "orderflow.imbalance_volume",
    section: "§29",
  },
  orderflow_stacked_imbalance_range: {
    description: "Number of consecutive price levels needed for a stacked imbalance. Indicates strong support/resistance.",
    configKey: "orderflow.stacked_imbalance_range",
    section: "§29",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §2 — STRATEGY PROPERTIES (Builder page)
  // ═══════════════════════════════════════════════════════════════════

  can_short: {
    description: "Enable short selling. When true, the strategy can open short positions in futures/margin mode.",
    configKey: "can_short (strategy property)",
    section: "§2",
  },
  startup_candle_count: {
    description: "Number of initial candles needed before the strategy can generate signals. Set to your longest indicator period.",
    configKey: "startup_candle_count (strategy property)",
    section: "§2",
  },
  use_custom_stoploss: {
    description: "Enable the custom_stoploss() callback for dynamic stoploss logic instead of a fixed value.",
    configKey: "use_custom_stoploss (strategy property)",
    section: "§2",
  },
  plot_config: {
    description: "Configuration for chart plotting in FreqUI. Defines which indicators appear on main and sub charts.",
    configKey: "plot_config (strategy property)",
    section: "§2",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §10 — LEVERAGE / FUTURES (Builder page)
  // ═══════════════════════════════════════════════════════════════════

  leverage: {
    description: "Trading leverage multiplier. E.g., 10x means your position is 10 times your stake. Higher leverage = higher risk.",
    section: "§10",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §12 — DATA DOWNLOAD
  // ═══════════════════════════════════════════════════════════════════

  download_data_pairs: {
    description: "Pairs to download historical data for. Uses exchange.pair_whitelist if not specified.",
    configKey: "--pairs",
    section: "§12",
  },
  download_data_timeframes: {
    description: "Timeframes to download. E.g., '1h 4h 1d'. Downloads each timeframe separately.",
    configKey: "--timeframes",
    section: "§12",
  },
  download_data_timerange: {
    description: "Date range for data download. Format: YYYYMMDD-YYYYMMDD or YYYYMMDD- (open end).",
    configKey: "--timerange",
    section: "§12",
  },
  download_data_exchange: {
    description: "Exchange to download data from. Must match your config or specify explicitly.",
    configKey: "--exchange",
    section: "§12",
  },
  download_data_trading_mode: {
    description: "Download data for: 'spot', 'margin', or 'futures'. Affects which pairs are available.",
    configKey: "--trading-mode",
    section: "§12",
  },
  download_data_convert: {
    description: "Automatically convert downloaded OHLCV data to the format specified in dataformat_ohlcv after download completes.",
    configKey: "--convert",
    section: "§12",
  },
  download_data_parallel: {
    description: "Download data in parallel from the exchange. Disable for sequential/slower downloads when the exchange rate-limits aggressively.",
    configKey: "--no-parallel-download",
    section: "§12",
  },
  use_public_trades: {
    description: "Fetch real-time public trade data from the exchange for orderflow analysis. Enables footprint charts and volume profiling.",
    configKey: "exchange.use_public_trades",
    section: "§29",
  },
  plot_config_main_plot: {
    description: "Indicators and overlays displayed on the main candlestick chart. Defined in the strategy's plot_config property.",
    configKey: "plot_config.main_plot",
    section: "§19",
  },
  plot_config_subplots: {
    description: "Additional subcharts below the main candlestick chart (RSI, MACD, Volume, etc.). Defined in the strategy's plot_config property.",
    configKey: "plot_config.subplots",
    section: "§19",
  },

  // ═══════════════════════════════════════════════════════════════════
  // §21 — LOOKAHEAD ANALYSIS
  // ═══════════════════════════════════════════════════════════════════

  lookahead_analysis: {
    description: "Detect if your strategy accidentally uses future data (lookahead bias). Essential before trusting backtest results.",
    configKey: "freqtrade lookahead-analysis",
    section: "§21",
  },

  // §22 — RECURSIVE ANALYSIS
  recursive_analysis: {
    description: "Detect if your strategy depends on its own previous predictions (recursive bias). Ensures backtest reliability.",
    configKey: "freqtrade recursive-analysis",
    section: "§22",
  },

  // ═══════════════════════════════════════════════════════════════════
  // FEE
  // ═══════════════════════════════════════════════════════════════════

  fee: {
    description: "Override exchange fee ratio for backtesting. E.g., 0.001 = 0.1% per trade. Leave empty to use exchange defaults.",
    configKey: "fee",
    section: "§1",
  },
  futures_funding_rate: {
    description: "Override futures funding rate for backtesting. Set to 0 to ignore funding fees in simulation.",
    configKey: "futures_funding_rate",
    section: "§1",
  },

  // ═══════════════════════════════════════════════════════════════════
  // ADDITIONAL STRATEGY PROPERTIES
  // ═══════════════════════════════════════════════════════════════════

  order_types: {
    description: "Defines order type (market/limit) for entry, exit, stoploss, and emergency exit orders.",
    configKey: "order_types",
    section: "§1",
  },
  order_time_in_force: {
    description: "Time-in-force behavior for entry and exit orders: GTC (Good Till Cancelled), FOK (Fill or Kill), IOC (Immediate or Cancel), PO (Post Only).",
    configKey: "order_time_in_force",
    section: "§1",
  },
  stoploss_on_exchange_price_type: {
    description: "Price type for exchange stoploss evaluation: 'last' (last trade price), 'mark' (mark price for futures), or 'index' (index price for derivatives).",
    configKey: "order_types.stoploss_price_type",
    section: "§1",
  },
  informative_pairs: {
    description: "Additional pairs and timeframes for multi-timeframe analysis or cross-pair indicators. Returned by the populate_informative_pairs() callback.",
    configKey: "informative_pairs",
    section: "§2",
  },
  strategy_version: {
    description: "Version string for tracking strategy iterations. Used for identifying strategy variants in backtests and live trading.",
    configKey: "version",
    section: "§2",
  },
};

/** Helper: get tooltip by key, returns undefined if not found */
export function getTooltip(key: string): TooltipEntry | undefined {
  return TOOLTIPS[key];
}

/** Helper: get description only */
export function getTooltipDesc(key: string): string {
  return TOOLTIPS[key]?.description ?? "";
}
