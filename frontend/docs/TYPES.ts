/**
 * TYPES.ts — FreqTrade UI Complete TypeScript Type Definitions
 * Generated from FREQTRADE_REFERENCE.md v2026.2
 *
 * This file contains type definitions for:
 * - All FreqTrade REST API responses (§8, §16)
 * - Configuration structures (§1, §7)
 * - Trade and order objects
 * - Orchestrator API responses (multi-bot management)
 * - Request types for forms and API calls
 */

// ============================================================================
// FREQTRADE API RESPONSES — TRADES & ORDERS (§16)
// ============================================================================

/**
 * Trade object — Complete FreqTrade trade data structure
 * Maps to GET /api/v1/status, GET /api/v1/trades, GET /api/v1/trades/{id}
 */
export interface FTTrade {
  /** Internal trade ID (unique) */
  id: number;

  /** Trading pair (e.g., "BTC/USDT:USDT" for futures, "BTC/USDT" for spot) */
  pair: string;

  /** Trade direction: true if short, false if long */
  is_short: boolean;

  /** Trade mode: "spot" or "futures" */
  trading_mode: "spot" | "futures";

  /** Amount of base currency */
  amount: number;

  /** Stake amount (position size in stake currency) */
  stake_amount: number;

  /** Leverage used (futures only, 1.0 for spot) */
  leverage: number;

  /** Entry price (rate at which trade was opened) */
  open_rate: number;

  /** Exit price (rate at which trade was closed, 0.0 if open) */
  close_rate: number;

  /** Profit as ratio (e.g., 0.05 = 5% profit) */
  close_profit: number | null;

  /** Absolute profit in stake currency */
  close_profit_abs: number | null;

  /** Entry fee percentage */
  fee_open: number;

  /** Exit fee percentage */
  fee_close: number;

  /** Accumulated funding fees (futures only) */
  funding_fees: number;

  /** Entry time as ISO 8601 string */
  open_date: string;

  /** Entry time in UTC as ISO 8601 string */
  open_date_utc: string;

  /** Exit time as ISO 8601 string (null if open) */
  close_date: string | null;

  /** Exit time in UTC as ISO 8601 string (null if open) */
  close_date_utc: string | null;

  /** True if trade is still open */
  is_open: boolean;

  /** Current profit percentage (only set if is_open=true) */
  current_profit: number | null;

  /** Current profit in absolute stake currency (only if is_open=true) */
  current_profit_abs: number | null;

  /** Stop loss price (current, adjusted for trailing stoploss) */
  stop_loss: number | null;

  /** Stop loss as percentage */
  stop_loss_pct: number | null;

  /** Initial stop loss price (at trade entry) */
  initial_stop_loss: number | null;

  /** Initial stop loss as percentage */
  initial_stop_loss_pct: number | null;

  /** Stop loss order ID (if stoploss_on_exchange=true) */
  stoploss_order_id: string | null;

  /** Liquidation price (futures only, null for spot) */
  liquidation_price: number | null;

  /** Margin interest rate (margin trading only) */
  interest_rate: number | null;

  /** User-provided entry tag for analysis */
  enter_tag: string | null;

  /** Exit tag (set when trade exits) */
  exit_tag: string | null;

  /** Reason for exit ("exit_signal", "stoploss", "roi", "sell_signal", etc.) */
  exit_reason: string | null;

  /** Open orders associated with this trade */
  orders: FTOrder[];

  /** Custom data stored via trade.set_custom_data() */
  custom_data?: Record<string, unknown>;
}

/**
 * Order object — Details of exchange orders
 * Part of FTTrade.orders array
 */
export interface FTOrder {
  /** Exchange order ID */
  order_id: string;

  /** Trade ID this order belongs to */
  trade_id: number;

  /** Order side: "buy" or "sell" */
  ft_order_side: "buy" | "sell";

  /** Order type: "market" or "limit" */
  ft_order_type: "market" | "limit";

  /** Order status: "open", "closed", "canceled", "failed", "expired" */
  status: string;

  /** Order creation time as ISO 8601 string */
  order_timestamp: string;

  /** Order fill time as ISO 8601 string (null if not filled) */
  order_filled_date: string | null;

  /** Average fill price */
  average: number | null;

  /** Filled amount */
  filled: number | null;

  /** Remaining amount to fill */
  remaining: number | null;

  /** Order cost (in quote currency) */
  cost: number | null;

  /** Safe accessor for price (handles null values) */
  safe_price: number;

  /** Safe accessor for filled amount (handles null values) */
  safe_filled: number;

  /** Safe accessor for fee in base currency (handles null values) */
  safe_fee_base: number;

  /** Amount after subtracting fees */
  safe_amount_after_fee: number;

  /** Order pair */
  pair: string;
}

// ============================================================================
// FREQTRADE API RESPONSES — PROFITABILITY & ANALYSIS
// ============================================================================

/**
 * Overall profit statistics
 * GET /api/v1/profit
 */
export interface FTProfit {
  /** Total trades closed */
  trades: number;

  /** Profitable trades count */
  profitable: number;

  /** Total profit in stake currency */
  profit_closed_coin: number;

  /** Total profit as ratio */
  profit_closed_percent: number;

  /** Current profit in stake currency (open trades) */
  profit_open_coin: number;

  /** Current profit as ratio (open trades) */
  profit_open_percent: number;

  /** All profit (closed + open) in stake currency */
  profit_all_coin: number;

  /** All profit (closed + open) as ratio */
  profit_all_percent: number;

  /** Trade count (open + closed) */
  trade_count: number;

  /** Average duration in seconds */
  avg_duration: number;

  /** Winning trade count (for open trades: by current profit) */
  wins?: number;

  /** Losing trade count */
  losses?: number;

  /** First trade open time */
  first_trade_date: string | null;

  /** First trade open time in UTC */
  first_trade_date_ts: number;

  /** Latest trade close time */
  latest_trade_date: string | null;

  /** Latest trade close time in UTC */
  latest_trade_date_ts: number;
}

/**
 * Account balance information
 * GET /api/v1/balance
 */
export interface FTBalance {
  /** Total balance in all currencies */
  currencies: Array<{
    /** Currency symbol (e.g., "USDT") */
    currency: string;

    /** Amount available for trading */
    available: number;

    /** Amount in open orders (locked) */
    used: number;

    /** Total balance (available + used) */
    total: number;

    /** Wallet balance (if different from total) */
    wallet_balance?: number;

    /** Estimated value in stake currency */
    est_stake?: number;
  }>;

  /** Margin information (if margin trading enabled) */
  margin?: {
    /** Total margin balance */
    total: number;

    /** Available margin balance */
    available: number;

    /** Used margin */
    used: number;

    /** Margin level (ratio) */
    margin_level: number | null;
  };
}

/**
 * Daily profit statistics
 * GET /api/v1/daily
 */
export interface FTDaily {
  /** Date as ISO 8601 string (YYYY-MM-DD) */
  date: string;

  /** Closed trades on this day */
  closed_trades: number;

  /** Profit in stake currency for closed trades */
  abs_profit: number;
}

/**
 * Weekly profit statistics
 * GET /api/v1/weekly
 */
export interface FTWeekly {
  /** Week starting date as ISO 8601 string */
  date: string;

  /** Closed trades this week */
  closed_trades: number;

  /** Profit in stake currency */
  abs_profit: number;
}

/**
 * Monthly profit statistics
 * GET /api/v1/monthly
 */
export interface FTMonthly {
  /** Month as ISO string (YYYY-MM) */
  date: string;

  /** Closed trades this month */
  closed_trades: number;

  /** Profit in stake currency */
  abs_profit: number;
}

/**
 * Per-pair performance statistics
 * GET /api/v1/performance
 */
export interface FTPerformance {
  /** Trading pair */
  pair: string;

  /** Number of trades on this pair */
  trades: number;

  /** Profit in stake currency */
  profit_abs: number;

  /** Profit as ratio */
  profit_ratio: number;
}

/**
 * Entry tag analysis — win rate by entry signal tag
 * GET /api/v1/entries
 */
export interface FTEntry {
  /** Entry tag (from strategy's populate_entry_trend) */
  enter_tag: string;

  /** Number of entries with this tag */
  entries: number;

  /** Successful entries (profitable closes) */
  wins: number;

  /** Failed entries (loss closes) */
  losses: number;

  /** Win ratio (0.0-1.0) */
  winrate: number;
}

/**
 * Exit reason analysis — performance by exit reason
 * GET /api/v1/exits
 */
export interface FTExit {
  /** Exit reason (e.g., "exit_signal", "stoploss", "roi") */
  exit_reason: string;

  /** Number of trades with this exit reason */
  exits: number;

  /** Profitable closes */
  wins: number;

  /** Loss closes */
  losses: number;

  /** Win ratio */
  winrate: number;
}

/**
 * Combined entry + exit tag analysis
 * GET /api/v1/mix_tags
 */
export interface FTMixTag {
  /** Entry tag */
  enter_tag: string;

  /** Exit tag */
  exit_reason: string;

  /** Trade count with this combination */
  trades: number;

  /** Winning trades */
  wins: number;

  /** Losing trades */
  losses: number;

  /** Win ratio */
  winrate: number;
}

/**
 * Trade statistics aggregation
 * GET /api/v1/stats
 */
export interface FTStats {
  /** Win ratio (0.0-1.0) */
  win_ratio: number;

  /** Best trade profit in percentage */
  best_trade: number;

  /** Worst trade profit in percentage */
  worst_trade: number;

  /** Average profit per trade in percentage */
  avg_profit: number;

  /** Largest winning streak */
  max_win_streak: number;

  /** Largest losing streak */
  max_loss_streak: number;

  /** Sharpe ratio (risk-adjusted return) */
  sharpe_ratio?: number;

  /** Sortino ratio (downside risk) */
  sortino_ratio?: number;

  /** Calmar ratio (return/max drawdown) */
  calmar_ratio?: number;

  /** Maximum drawdown percentage */
  max_drawdown?: number;

  /** Drawdown percentage */
  drawdown?: number;

  /** Maximum drawdown in stake currency */
  max_drawdown_abs?: number;
}

/**
 * Trade count (open and total)
 * GET /api/v1/count
 */
export interface FTCount {
  /** Number of open trades */
  current: number;

  /** Max allowed open trades */
  max: number;
}

// ============================================================================
// FREQTRADE API RESPONSES — DATA & CONFIGURATION
// ============================================================================

/**
 * Current bot configuration
 * GET /api/v1/show_config
 */
export interface FTConfigFull {
  // Core Trading
  max_open_trades: number;
  stake_currency: string;
  stake_amount: number | "unlimited";
  tradable_balance_ratio: number;
  available_capital: number | null;
  amend_last_stake_amount: boolean;
  last_stake_amount_min_ratio: number;
  amount_reserve_percent: number;

  // Timing & Display
  timeframe: string;
  fiat_display_currency: string | null;

  // Dry Run
  dry_run: boolean;
  dry_run_wallet: number | Record<string, number>;
  cancel_open_orders_on_exit: boolean;
  process_only_new_candles: boolean;

  // ROI & Stoploss
  minimal_roi: Record<string, number>;
  stoploss: number;
  trailing_stop: boolean;
  trailing_stop_positive: number | null;
  trailing_stop_positive_offset: number;
  trailing_only_offset_is_reached: boolean;

  // Exit Signal Control
  use_exit_signal: boolean;
  exit_profit_only: boolean;
  exit_profit_offset: number;
  ignore_roi_if_entry_signal: boolean;
  ignore_buying_expired_candle_after: number | null;

  // Order Types
  order_types: {
    entry: "market" | "limit";
    exit: "market" | "limit";
    stoploss: "market" | "limit";
    emergency_exit: "market" | "limit";
    force_exit: "market" | "limit";
    force_entry: "market" | "limit";
    stoploss_on_exchange: boolean;
    stoploss_on_exchange_limit_ratio: number;
    stoploss_on_exchange_interval: number;
    stoploss_price_type: "last" | "mark" | "index";
  };

  order_time_in_force: {
    entry: "GTC" | "FOK" | "IOC" | "PO";
    exit: "GTC" | "FOK" | "IOC" | "PO";
  };

  // Unfilled Timeout
  unfilledtimeout: {
    entry: number;
    exit: number;
    unit: "minutes" | "seconds";
    exit_timeout_count: number;
  };

  // Entry Pricing
  entry_pricing: {
    price_side: "ask" | "bid" | "same" | "other";
    price_last_balance: number;
    use_order_book: boolean;
    order_book_top: number;
    check_depth_of_market: {
      enabled: boolean;
      bids_to_ask_delta: number;
    };
  };

  // Exit Pricing
  exit_pricing: {
    price_side: "ask" | "bid" | "same" | "other";
    price_last_balance: number;
    use_order_book: boolean;
    order_book_top: number;
  };

  // Position Adjustment (DCA)
  position_adjustment_enable: boolean;
  max_dca_multiplier: number;
  max_stake_multiplier: number;

  // Exchange & API
  exchange: {
    name: string;
    key: string;
    secret: string;
    pair_whitelist: string[];
    pair_blacklist: string[];
    ccxt_config?: Record<string, unknown>;
    ccxt_async_config?: Record<string, unknown>;
  };

  // Margin/Futures
  trading_mode: "spot" | "futures" | "margin";
  margin_mode: "isolated" | "cross" | null;
  can_short: boolean;

  // Pairlists & Filters
  pairlists: FTPairlistHandler[];

  // Protections
  protections: FTProtection[];

  // Telegram
  telegram: {
    enabled: boolean;
    token: string;
    chat_id: string;
  } | null;

  // Webhook
  webhook: {
    enabled: boolean;
    url: string;
    buy: string;
    buycancel: string;
    sell: string;
    sellcancel: string;
    emergency_sell: string;
  } | null;

  // Producer/Consumer
  external_message_consumer: {
    enabled: boolean;
    producers: Array<{
      name: string;
      host: string;
      port: number;
      ws_token: string;
    }>;
    wait_timeout: number;
    ping_timeout: number;
  } | null;

  // FreqAI
  freqai: FTFreqAIConfig | null;

  // API Server
  api_server: {
    enabled: boolean;
    listen_ip_address: string;
    listen_port: number;
    username: string;
    password: string;
    jwt_secret_key: string;
    CORS_origins?: string[];
  };

  // Logging & Database
  db_url: string;
  initial_state: "running" | "stopped";
  internals: {
    sd_notify: boolean;
  };

  // Advanced
  custom_price_max_distance_ratio: number;
  fee_overhead_percent: number;
  reload_conf: "off" | "load-db-on-reload" | "reload-config" | "reload-all";
  notification_settings?: Record<string, unknown>;
}

/**
 * Pairlist handler configuration
 * Used in config.pairlists array
 */
export type FTPairlistHandler =
  | {
      method: "static";
    }
  | {
      method: "volume";
      number_assets: number;
      sort_key: string;
      min_value: number;
      refresh_period: number;
    }
  | {
      method: "percent_change";
      number_assets: number;
      sort_key: string;
      min_value: number;
      max_value: number;
      refresh_period: number;
    }
  | {
      method: "producer";
      producer_name: string;
    }
  | {
      method: "remote";
      pairlist_url: string;
      refresh_period: number;
      mode: "whitelist" | "blacklist";
      processing_mode: "filter" | "append";
      number_assets: number;
      bearer_token?: string;
      read_timeout: number;
      keep_pairlist_on_failure: boolean;
      save_to_file?: boolean;
    }
  | {
      method: "market_cap";
      number_assets: number;
      max_rank?: number;
      refresh_period: number;
      mode: "whitelist" | "blacklist";
      categories?: string;
    }
  | {
      method: "agefilter";
      min_days_listed: number;
      max_days_listed?: number;
    }
  | {
      method: "delist";
      max_days_from_now?: number;
    }
  | {
      method: "fulltradesfilter";
    }
  | {
      method: "offset";
      offset: number;
      number_assets?: number;
    }
  | {
      method: "performance";
      trade_back_seconds: number;
      min_profit: number;
    }
  | {
      method: "precision";
    }
  | {
      method: "price";
      low_price_ratio: number;
      min_price?: number;
      max_price?: number;
    }
  | {
      method: "shuffle";
      seed?: number;
    }
  | {
      method: "spread";
      max_spread_ratio: number;
    }
  | {
      method: "rangestability";
      min_rate_of_change: number;
      max_rate_of_change: number;
      lookback_days: number;
      refresh_period: number;
    }
  | {
      method: "volatility";
      min_volatility: number;
      max_volatility: number;
      lookback_days: number;
      refresh_period: number;
    };

/**
 * Protection configuration (pairing protections)
 * Used in config.protections array
 */
export type FTProtection =
  | {
      method: "StoplossGuard";
      trade_limit: number;
      lookback_period_candles: number;
      stop_duration_candles: number;
      only_per_pair?: boolean;
      only_per_side?: boolean;
      required_profit?: number;
      unlock_at?: string;
    }
  | {
      method: "MaxDrawdown";
      trade_limit: number;
      lookback_period_candles: number;
      stop_duration_candles: number;
      max_allowed_drawdown: number;
      calculation_mode?: "ratios" | "equity";
      unlock_at?: string;
    }
  | {
      method: "LowProfitPairs";
      trade_limit: number;
      lookback_period_candles: number;
      stop_duration_candles: number;
      required_profit: number;
      only_per_pair?: boolean;
      only_per_side?: boolean;
      unlock_at?: string;
    }
  | {
      method: "CooldownPeriod";
      stop_duration_candles: number;
      only_per_pair?: boolean;
      unlock_at?: string;
    };

/**
 * Current whitelist (trading pairs)
 * GET /api/v1/whitelist
 */
export interface FTWhitelist {
  /** List of tradable pairs */
  whitelist: string[];

  /** Length of whitelist */
  length: number;

  /** Method used to generate whitelist */
  method: string;
}

/**
 * Pair locks/blacklist
 * GET /api/v1/locks
 */
export interface FTLock {
  /** Lock ID */
  id: number;

  /** Locked pair */
  pair: string;

  /** Lock reason */
  reason: string;

  /** Lock active flag */
  active: boolean;

  /** Lock start time */
  lock_timestamp: number;

  /** Lock end time (when it expires) */
  lock_end_timestamp: number;
}

/**
 * Blacklist of pairs
 * GET /api/v1/blacklist
 */
export interface FTBlacklist {
  /** Blacklisted pairs */
  blacklist: string[];

  /** Blacklist method/source */
  blacklist_action?: string;

  /** Method used */
  method?: string[];
}

/**
 * Candle data (OHLCV)
 * GET /api/v1/pair_candles
 */
export interface FTPairCandles {
  /** Trading pair */
  pair: string;

  /** Timeframe */
  timeframe: string;

  /** Candle data array */
  data: Array<[number, number, number, number, number, number, string]>; // [time, o, h, l, c, v, symbol]
}

/**
 * Strategy plot configuration
 * GET /api/v1/plot_config
 */
export interface FTPlotConfig {
  /** Indicator plot definitions */
  indicators?: Record<string, any>;

  /** Subplot plot definitions */
  subplots?: Record<string, Record<string, any>>;

  /** Main plot configuration */
  main_plot?: Record<string, any>;
}

/**
 * Strategy file and metadata
 * GET /api/v1/strategy/{name}
 */
export interface FTStrategy {
  /** Strategy name */
  name: string;

  /** Strategy source code */
  code: string;

  /** Buy signals count (historical) */
  buy_signals: number;

  /** Sell signals count (historical) */
  sell_signals: number;
}

/**
 * Bot health and status information
 * GET /api/v1/health
 */
export interface FTHealth {
  /** Overall bot status */
  status: "running" | "stopped" | "paused";

  /** Number of open trades */
  open_trades: number;

  /** Number of closed trades */
  closed_trades: number;

  /** Current profit */
  profit: number;

  /** Is bot in trading mode */
  is_trading: boolean;

  /** Is bot in buying mode */
  buy_enabled: boolean;

  /** Last trade open time */
  trade_statistics?: {
    trade_count: number;
    wins: number;
    losses: number;
    draws: number;
  };
}

/**
 * System information
 * GET /api/v1/sysinfo
 */
export interface FTSysinfo {
  /** Bot version */
  version: string;

  /** Total system memory available */
  available_memory: number;

  /** System uptime in seconds */
  uptime: number;

  /** Database size in bytes */
  database_size?: number;

  /** Strategy path */
  strategy_path?: string;

  /** Number of available strategies */
  strategies?: number;
}

/**
 * Backtest result summary
 * GET /api/v1/backtest
 */
export interface FTBacktest {
  /** Backtest status */
  status: "running" | "stopped" | "success" | "failed";

  /** Progress percentage */
  progress: number;

  /** Start time of backtest */
  backtest_start_time?: number;

  /** End time of backtest */
  backtest_end_time?: number;

  /** Result data when complete */
  result?: {
    results: FTTrade[];
    total_profit: number;
    total_trades: number;
    wins: number;
    losses: number;
    draw_days: number;
    avg_profit: number;
    median_profit: number;
    total_duration: number;
  };

  /** Error message if failed */
  error?: string;
}

/**
 * Backtest history entries
 * GET /api/v1/backtest/history
 */
export interface FTBacktestHistory {
  /** Backtest filename */
  filename: string;

  /** Backtest timestamp */
  timestamp: number;

  /** Backtest result summary */
  result: {
    total_trades: number;
    wins: number;
    losses: number;
    profit_percent: number;
  };
}

/**
 * Log entries
 * GET /api/v1/logs
 */
export interface FTLogs {
  /** Array of log messages */
  logs: Array<{
    /** Log timestamp */
    timestamp: string;

    /** Log level */
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

    /** Log message */
    message: string;
  }>;

  /** Total log count */
  log_count: number;
}

/**
 * FreqAI model list
 * GET /api/v1/freqaimodels
 */
export interface FTFreqAIModels {
  /** Available FreqAI models */
  models: Array<{
    /** Model name */
    name: string;

    /** Model type (regressor/classifier) */
    type: string;

    /** Model library */
    library: string;
  }>;
}

// ============================================================================
// FREQTRADE CONFIGURATION — FreqAI SECTION
// ============================================================================

/**
 * FreqAI complete configuration
 * Maps to config.json freqai section (§24, §25, §26)
 */
export interface FTFreqAIConfig {
  /** Enable FreqAI */
  enabled: boolean;

  /** Unique model identifier */
  identifier: string;

  /** Number of old models to keep */
  purge_old_models: number;

  // Core parameters
  train_period_days: number;
  backtest_period_days: number;
  live_retrain_hours?: number;
  expired_hours?: number;
  continual_learning: boolean;
  activate_tensorboard: boolean;

  // Feature parameters
  feature_parameters: {
    include_timeframes: string[];
    include_corr_pairlist: string[];
    include_shifted_candles: number;
    indicator_periods_candles: number[];
    label_period_candles: number;
    fit_live_predictions_candles: number;
    leverage_weights?: number[];

    // Data processing
    weight_factor: number;
    shuffle_after_split: boolean;
    buffer_train_data_candles: number;
    reverse_train_test_order: boolean;
    principal_component_analysis: boolean;
    noise_standard_deviation: number;
    outlier_protection_percentage: number;
    DI_threshold?: number;
    use_SVM_to_remove_outliers: boolean;
    use_DBSCAN_to_remove_outliers: boolean;

    svm_params?: {
      shuffle: boolean;
      nu: number;
    };
  };

  // Data split
  data_split_parameters: {
    test_size: number;
  };

  // Model parameters
  freqaimodel: string;

  // Save/load settings
  save_backtest_models: boolean;
  write_metrics_to_disk: boolean;
  data_kitchen_thread_count?: number;
  wait_for_training_iteration_on_reload: boolean;
  keras: boolean;
  reduce_df_footprint: boolean;
  override_exchange_check: boolean;
  conv_width?: number;

  // Training parameters
  learning_rate?: number;
  model_kwargs?: Record<string, unknown>;
  trainer_kwargs?: {
    n_epochs?: number;
    n_steps?: number;
    batch_size: number;
  };

  // Reinforcement Learning (if applicable)
  rl_config?: FTRLConfig;

  // Custom parameters
  [key: string]: unknown;
}

/**
 * Reinforcement Learning configuration
 * Part of freqai config when using RL models
 */
export interface FTRLConfig {
  /** Training iterations */
  train_cycles: number;

  /** Include profit/position/duration in state */
  add_state_info: boolean;

  /** Maximum candles per trade */
  max_trade_duration_candles: number;

  /** Max drawdown tolerance for training (e.g., 0.05 = 5%) */
  max_training_drawdown_pct: number;

  /** CPU cores for training */
  cpu_count?: number;

  /** RL algorithm ("PPO", "A2C", "DQN") */
  model_type: string;

  /** Network architecture ("MlpPolicy", "CnnPolicy") */
  policy_type: string;

  /** Reward scaling factors */
  model_reward_parameters: {
    /** Profit reward weight */
    profit_factor?: number;

    /** Trade duration reward weight */
    trade_duration?: number;

    /** Win/loss weight */
    winning_trades_factor?: number;

    [key: string]: number | undefined;
  };
}

// ============================================================================
// ORCHESTRATOR API RESPONSES (Multi-bot Management)
// ============================================================================

/**
 * Bot instance managed by orchestrator
 * Created/configured via orchestrator API
 */
export interface ORCHBot {
  /** Unique bot instance ID */
  id: string;

  /** Bot display name */
  name: string;

  /** Bot status: "running" | "stopped" | "error" | "initializing" */
  status: "running" | "stopped" | "error" | "initializing";

  /** Strategy used by this bot */
  strategy: string;

  /** FreqTrade REST API URL (e.g., http://localhost:8081) */
  ft_url: string;

  /** Bot running in dry-run mode (simulation) */
  is_dry_run: boolean;

  /** Docker container name */
  container_name: string;

  /** Bot creation timestamp */
  created_at: string;

  /** Last heartbeat timestamp */
  last_heartbeat: string;

  /** Consecutive failed health checks */
  consecutive_failures: number;

  /** Bot portfolio value in stake currency */
  portfolio_value?: number;

  /** Current profit percentage */
  current_profit?: number;

  /** Open trade count */
  open_trades?: number;

  /** Kill switch status */
  kill_switch_active: boolean;
}

/**
 * Strategy metadata and lifecycle
 * Managed by orchestrator, actual code in FT
 */
export interface ORCHStrategy {
  /** Unique strategy ID */
  id: string;

  /** Strategy name (matches FT strategy file name) */
  name: string;

  /** Lifecycle state */
  lifecycle: "draft" | "backtest" | "paper" | "live" | "retired";

  /** Strategy file path */
  file_path: string;

  /** Associated bot instances using this strategy */
  bot_instances: string[];

  /** Last backtest result (if available) */
  last_backtest_id?: string;

  /** Strategy creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Strategy description/notes */
  description?: string;

  /** Risk level: "low" | "medium" | "high" */
  risk_level?: "low" | "medium" | "high";
}

/**
 * Risk event (kill switch activation)
 * Immutable audit record
 */
export interface ORCHRiskEvent {
  /** Unique event ID */
  id: string;

  /** Kill switch type: "soft" (pause) | "hard" (exit all) */
  kill_type: "soft" | "hard";

  /** What triggered the kill switch */
  trigger:
    | "heartbeat_failure"
    | "max_drawdown"
    | "manual"
    | "profit_target"
    | "loss_limit"
    | "custom";

  /** Human-readable reason */
  reason: string;

  /** Bot instance that triggered (null if system-wide) */
  bot_instance_id: string | null;

  /** User/system that triggered it */
  triggered_by: string;

  /** Event timestamp */
  created_at: string;

  /** Soft kill: timestamp when ban expires (null if never) */
  ban_until?: string | null;

  /** Impact: trades closed, orders canceled, etc. */
  impact?: {
    trades_closed: number;
    orders_canceled: number;
  };
}

/**
 * Cross-bot portfolio aggregation
 * Sums balance from all bot instances
 */
export interface ORCHPortfolioBalance {
  /** Total balance across all bots */
  total_stake_currency: number;

  /** Breakdown by currency */
  currencies: Array<{
    currency: string;
    total: number;
    available: number;
    used: number;
  }>;

  /** Breakdown by bot */
  by_bot: Array<{
    bot_id: string;
    bot_name: string;
    stake_currency: number;
    currencies: Array<{
      currency: string;
      total: number;
    }>;
  }>;

  /** Aggregated timestamp */
  timestamp: string;
}

/**
 * Background job (backtest, hyperopt, etc.)
 */
export interface ORCHJob {
  /** Unique job ID */
  id: string;

  /** Job type: "backtest" | "hyperopt" | "download-data" */
  type: "backtest" | "hyperopt" | "download-data";

  /** Job status: "pending" | "running" | "completed" | "failed" */
  status: "pending" | "running" | "completed" | "failed";

  /** Progress percentage (0-100) */
  progress: number;

  /** Bot instance running this job */
  bot_instance_id: string;

  /** Job start time */
  started_at: string;

  /** Job completion time */
  completed_at?: string;

  /** Result data (varies by job type) */
  result?: Record<string, unknown>;

  /** Error message if failed */
  error?: string;
}

/**
 * Orchestrator health status
 */
export interface ORCHHealth {
  /** Orchestrator status */
  status: "healthy" | "degraded" | "unhealthy";

  /** Number of healthy bots */
  healthy_bots: number;

  /** Number of unhealthy bots */
  unhealthy_bots: number;

  /** Orchestrator uptime in seconds */
  uptime: number;

  /** Database connection status */
  database: "connected" | "disconnected";

  /** Redis connection status */
  redis: "connected" | "disconnected";

  /** Last health check timestamp */
  last_check: string;
}

/**
 * Immutable audit log entry
 * All changes to orchestrator state
 */
export interface ORCHAuditLog {
  /** Log entry ID */
  id: string;

  /** Action type: "bot_created" | "bot_started" | "kill_switch" | etc. */
  action: string;

  /** Resource type affected: "bot" | "strategy" | "portfolio" */
  resource_type: string;

  /** Resource ID affected */
  resource_id: string;

  /** Actor (user, system, API) */
  actor: string;

  /** Change details */
  details: Record<string, unknown>;

  /** Timestamp */
  timestamp: string;

  /** IP address (if applicable) */
  ip_address?: string;
}

// ============================================================================
// REQUEST TYPES — FORMS & API CALLS
// ============================================================================

/**
 * Backtest request parameters
 * Maps to POST /api/v1/backtest
 */
export interface BacktestRequest {
  /** Strategy to backtest */
  strategy: string;

  /** Timeframe (1m, 5m, 15m, 1h, 4h, 1d, etc.) */
  timeframe: string;

  /** Start date (YYYY-MM-DD) */
  from: string;

  /** End date (YYYY-MM-DD) */
  to: string;

  /** Maximum open trades */
  max_open_trades?: number;

  /** Stake amount */
  stake_amount?: number | "unlimited";

  /** Enable position adjustment (DCA) */
  enable_position_adjustment?: boolean;

  /** Max position multiplier */
  max_dca_multiplier?: number;

  /** Enable dry run */
  dry_run?: boolean;

  /** Trading pairs to backtest */
  pairs?: string[];
}

/**
 * Hyperopt optimization request
 * Maps to POST /api/v1/backtest with hyperopt parameters
 */
export interface HyperoptRequest {
  /** Strategy to hyperopt */
  strategy: string;

  /** Number of epochs (optimization iterations) */
  epochs: number;

  /** Loss function: "sharpe", "sortino", "calmar", "max_profit", etc. */
  loss: string;

  /** Sampler: "tpe", "random", "grid", etc. */
  sampler?: string;

  /** Start date */
  from: string;

  /** End date */
  to: string;

  /** Spaces to optimize: "roi", "stoploss", "trailing", "buy", "sell" */
  spaces?: string[];

  /** Random seed for reproducibility */
  random_state?: number;

  /** Enable position adjustment optimization */
  enable_position_adjustment?: boolean;

  /** Max position multiplier */
  max_dca_multiplier?: number;

  /** Number of parallel jobs */
  n_jobs?: number;
}

/**
 * Download historical data request
 * Maps to freqtrade download-data CLI
 */
export interface DownloadDataRequest {
  /** Trading pairs to download */
  pairs: string[];

  /** Timeframes (1m, 5m, 1h, 1d, etc.) */
  timeframes: string[];

  /** Start date (YYYY-MM-DD) */
  from: string;

  /** End date (YYYY-MM-DD) */
  to: string;

  /** Exchange to download from */
  exchange: string;

  /** Data type: "ohlcv" (candles) | "trades" (public trades) | "mark" | "funding_rate" */
  data_type?: "ohlcv" | "trades" | "mark" | "funding_rate";

  /** Trading mode: "spot" | "futures" */
  trading_mode?: "spot" | "futures";

  /** Overwrite existing data */
  overwrite?: boolean;
}

/**
 * Strategy creation/update request
 * Used in strategy builder UI
 */
export interface StrategyCreateRequest {
  /** Strategy name (filename without .py) */
  name: string;

  /** Strategy source code */
  code: string;

  /** Based on (template/parent strategy) */
  based_on?: string;

  /** Strategy description */
  description?: string;
}

/**
 * Bot instance creation request
 * Used to create new FreqTrade bot container
 */
export interface BotCreateRequest {
  /** Bot name */
  name: string;

  /** Strategy to use */
  strategy: string;

  /** Stake currency (USDT, BTC, etc.) */
  stake_currency: string;

  /** Initial stake amount */
  stake_amount: number;

  /** Dry run mode */
  is_dry_run: boolean;

  /** Max open trades */
  max_open_trades: number;

  /** Exchange configuration */
  exchange: {
    name: string;
    key: string;
    secret: string;
    password?: string;
  };

  /** Config overrides */
  config_overrides?: Partial<FTConfigFull>;
}

/**
 * Configuration update request
 * Maps to PATCH /api/v1/show_config
 */
export interface ConfigUpdateRequest {
  /** Field path to update (dot notation: "telegram.enabled") */
  path: string;

  /** New value */
  value: unknown;

  /** Require bot restart */
  require_reload?: boolean;
}

/**
 * Kill switch request
 * Maps to POST /api/v1/stop (soft kill) or POST /api/v1/forceexit (hard kill)
 */
export interface KillSwitchRequest {
  /** Kill switch type: "soft" (pause trading) | "hard" (exit all trades) */
  type: "soft" | "hard";

  /** Reason for kill switch */
  reason: string;

  /** Ban duration in minutes (soft kill only) */
  ban_minutes?: number;

  /** Bot instance to kill (null = all bots) */
  bot_instance_id?: string | null;
}

/**
 * Force entry request
 * Maps to POST /api/v1/forceenter
 */
export interface ForceEntryRequest {
  /** Trading pair */
  pair: string;

  /** "long" or "short" (short requires can_short: true) */
  side?: "long" | "short";

  /** Entry price (null = current market) */
  rate?: number;

  /** Stake amount (null = config default) */
  stake_amount?: number;

  /** Entry tag for analysis */
  enter_tag?: string;
}

/**
 * Force exit request
 * Maps to POST /api/v1/forceexit
 */
export interface ForceExitRequest {
  /** Trade ID to close */
  tradeid: string;

  /** Force exit reason */
  exitreason?: string;

  /** Order type: "market" or "limit" */
  ordertype?: "market" | "limit";
}

// ============================================================================
// WEBSOCKET MESSAGES (Real-time updates)
// ============================================================================

/**
 * WebSocket message from FreqTrade
 * Received via GET /api/v1/message/ws?token={ws_token}
 */
export interface FTWebSocketMessage {
  /** Message type */
  type:
    | "trade"
    | "profit"
    | "balance"
    | "whitelist"
    | "blacklist"
    | "status"
    | "rpc_call";

  /** Message data */
  data: Record<string, unknown>;

  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Paginated response wrapper
 * Used for GET /api/v1/trades with pagination
 */
export interface PaginatedResponse<T> {
  /** Current page items */
  data: T[];

  /** Total item count */
  total: number;

  /** Current page number */
  page: number;

  /** Items per page */
  limit: number;

  /** Total pages */
  pages: number;
}

/**
 * API error response
 * Standard error format from FreqTrade REST API
 */
export interface APIError {
  /** Error message */
  message: string;

  /** Error code (optional) */
  code?: string;

  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Generic API response wrapper
 */
export interface APIResponse<T> {
  /** Response success flag */
  success: boolean;

  /** Response data */
  data?: T;

  /** Error information (if success=false) */
  error?: APIError;

  /** Response timestamp */
  timestamp: string;
}
