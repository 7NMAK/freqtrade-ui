/**
 * types/index.ts — FreqTrade UI Complete TypeScript Types
 * All FT field names are EXACT — never invent names.
 * Source: docs/TYPES.ts (verified against FREQTRADE_REFERENCE.md v2026.2)
 */

// ORCHESTRATOR TYPES (our DB)

export type BotStatus = "starting" | "running" | "stopped" | "error" | "killed" | "draining";

export interface Bot {
  id: number;
  name: string;
  api_url: string;
  api_port: number;
  strategy_name: string | null;
  status: BotStatus;
  is_dry_run: boolean;
  is_healthy: boolean;
  consecutive_failures: number;
  container_id: string | null;
  docker_image: string;
  description: string | null;
  is_utility?: boolean;
  ft_mode?: "trade" | "webserver";
  // Architecture V2 fields (optional, for backward compatibility)
  exchange_name?: string;
  exchange_profile_id?: number;
  stake_currency?: string;
  stake_amount?: string;
  max_open_trades?: number;
  timeframe?: string;
  pair_whitelist?: string[];
  pair_blacklist?: string[];
  trading_mode?: string;
  margin_mode?: string;
  strategy_version_id?: number;
}

export type Lifecycle = "draft" | "backtest" | "ai_tested" | "deployable" | "paper" | "live" | "retired";

export interface Strategy {
  id: number;
  name: string;
  lifecycle: Lifecycle;
  bot_instance_id: number | null;
  description: string | null;
  code: string | null;
  exchange: string | null;
  timeframe: string | null;
  builder_state: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type KillType = "SOFT_KILL" | "HARD_KILL";
export type KillTrigger = "MANUAL" | "HEARTBEAT_FAILURE" | "DRAWDOWN_LIMIT";

export interface RiskEvent {
  id: number;
  bot_instance_id: number | null;
  kill_type: KillType;
  trigger: KillTrigger;
  reason: string | null;
  triggered_by: string;
  created_at: string;
}

// FREQTRADE TRADE & ORDER OBJECTS (§16)

/** Order object — part of FTTrade.orders array */
export interface FTOrder {
  order_id: string;
  trade_id: number;
  ft_order_side: "buy" | "sell";
  ft_order_type: "market" | "limit";
  status: string;
  order_timestamp: string;
  order_filled_date: string | null;
  average: number | null;
  filled: number | null;
  remaining: number | null;
  cost: number | null;
  safe_price: number;
  safe_filled: number;
  safe_fee_base: number;
  safe_amount_after_fee: number;
  pair: string;
}

/**
 * Trade object — GET /api/v1/status, GET /api/v1/trades (§16)
 * ALWAYS use these exact field names. Never use: entry_price, exit_price, net_pnl, etc.
 */
export interface FTTrade {
  /** Internal trade ID */
  trade_id: number;
  /** Trading pair e.g. "BTC/USDT:USDT" */
  pair: string;
  /** True if trade is still open */
  is_open: boolean;
  /** True if short trade */
  is_short: boolean;
  /** "spot" or "futures" */
  trading_mode?: "spot" | "futures";
  /** Amount of base currency */
  amount: number;
  /** Stake amount (position size in stake currency) */
  stake_amount: number;
  /** Leverage (1.0 for spot) */
  leverage: number;
  /** Entry price — NEVER use "entry_price" */
  open_rate: number;
  /** Exit price — NEVER use "exit_price" */
  close_rate: number | null;
  /** Current live price (open trades only) */
  current_rate: number;
  /** Profit as ratio (e.g. 0.05 = 5%) */
  close_profit: number | null;
  /** Absolute profit in stake currency — NEVER use "net_pnl" */
  close_profit_abs: number | null;
  /** Current profit % (open trades) — NEVER use "unrealized_pnl" */
  current_profit: number | null;
  /** Current profit absolute (open trades) */
  current_profit_abs: number | null;
  /** Entry fee percentage — NEVER use "entry_fee" */
  fee_open: number;
  /** Exit fee percentage — NEVER use "exit_fee" */
  fee_close: number;
  /** Funding fees (futures) */
  funding_fees?: number;
  /** Entry time ISO 8601 — NEVER use "entry_time" */
  open_date: string;
  open_date_utc?: string;
  /** Exit time ISO 8601 — NEVER use "exit_time" */
  close_date: string | null;
  close_date_utc?: string | null;
  /** Stop loss price */
  stop_loss?: number | null;
  stop_loss_pct?: number | null;
  initial_stop_loss?: number | null;
  initial_stop_loss_pct?: number | null;
  stoploss_order_id?: string | null;
  /** Liquidation price (futures) */
  liquidation_price?: number | null;
  interest_rate?: number | null;
  /** Entry tag from strategy — NEVER use "entry_signal" */
  enter_tag: string | null;
  /** Exit tag */
  exit_tag?: string | null;
  /** Exit reason — NEVER use "exit_signal" */
  exit_reason: string | null;
  /** Open orders */
  orders?: FTOrder[];
  /** Custom data */
  custom_data?: Record<string, unknown>;
  /** Tagged by orchestrator — not from FT API */
  _bot_name?: string;
  _bot_id?: number;
}

// FREQTRADE API RESPONSES — PROFITABILITY (§8)

/** GET /api/v1/profit */
export interface FTProfit {
  /** Total closed trades */
  trades: number;
  /** Profitable closed trades */
  profitable: number;
  /** Closed profit in stake currency */
  profit_closed_coin: number;
  profit_closed_percent: number;
  profit_closed_fiat: number;
  /** Open trades profit */
  profit_open_coin: number;
  profit_open_percent: number;
  profit_open_fiat: number;
  /** All profit (open + closed) */
  profit_all_coin: number;
  profit_all_percent: number;
  profit_all_fiat: number;
  profit_all_percent_mean: number;
  profit_all_percent_sum: number;
  /** Total trade count */
  trade_count: number;
  closed_trade_count: number;
  /** Average duration (seconds or string depending on FT version) */
  avg_duration: number | string;
  first_trade_date: string | null;
  first_trade_date_ts?: number;
  latest_trade_date: string | null;
  latest_trade_date_ts?: number;
  best_pair: string;
  best_rate: number;
  best_pair_profit_ratio?: number;
  winning_trades: number;
  losing_trades: number;
  wins?: number;
  losses?: number;
}

/** GET /api/v1/balance */
export interface FTBalance {
  currencies: Array<{
    currency: string;
    free: number;
    balance: number;
    used: number;
    est_stake: number;
    est_stake_currency?: string;
    is_position?: boolean;
    side?: string;
    leverage?: number;
    is_bot_managed?: boolean;
    wallet_balance?: number;
    init_margin?: number;
    total?: number;
  }>;
  total: number;
  symbol: string;
  value: number;
  stake: string;
  note: string;
  starting_capital?: number;
  starting_capital_ratio?: number;
  starting_capital_fiat?: number;
}

/** GET /api/v1/daily — wrapper response */
export interface FTDailyResponse {
  data: FTDailyItem[];
  stake_currency: string;
}

/** Single day entry */
export interface FTDailyItem {
  date: string;
  abs_profit: number;
  rel_profit: number;
  starting_balance: number;
  profit_factor?: number;
  trade_count: number;
  closed_trades?: number;
}

/** GET /api/v1/weekly */
export interface FTWeeklyResponse {
  data: Array<{
    date: string;
    abs_profit: number;
    rel_profit: number;
    trade_count: number;
  }>;
  stake_currency: string;
}

/** GET /api/v1/monthly */
export interface FTMonthlyResponse {
  data: Array<{
    date: string;
    abs_profit: number;
    rel_profit: number;
    trade_count: number;
  }>;
  stake_currency: string;
}

/** GET /api/v1/performance */
export interface FTPerformance {
  pair: string;
  trades: number;
  /** FT returns profit_abs; we alias to close_profit_abs per CLAUDE.md */
  close_profit_abs: number;
  profit_abs: number;
  profit_ratio: number;
  profit: number;
  count: number;
}

/** GET /api/v1/entries */
export interface FTEntry {
  enter_tag: string;
  entries: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  profit_factor: number;
  profit_ratio: number;
  profit_abs: number;
  avg_profit: number;
}

/** GET /api/v1/exits */
export interface FTExit {
  exit_reason: string;
  exits: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  profit_factor: number;
  profit_ratio: number;
  profit_abs: number;
  avg_profit: number;
}

/** GET /api/v1/mix_tags */
export interface FTMixTag {
  enter_tag: string;
  exit_reason: string;
  trades: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  profit_factor: number;
  profit_ratio: number;
  profit_abs: number;
  avg_profit: number;
}

/** GET /api/v1/stats */
export interface FTStats {
  profit_factor: number;
  trading_volume: number;
  negtrade_account_drawdown: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  winning_profit: number;
  losing_profit: number;
  profit_all_coin: number;
  wins: number;
  losses: number;
  draws: number;
  rejected_signals: number;
  timedout_entry_orders: number;
  timedout_exit_orders: number;
  canceled_trade_entries: number;
  canceled_entry_orders: number;
  replaced_entry_orders: number;
  durations: {
    wins: number | null;
    draws: number | null;
    losses: number | null;
  };
  return_multiples: Record<string, unknown>;
  max_drawdown?: number;
  max_drawdown_abs?: number;
  drawdown?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  calmar_ratio?: number;
}

/** GET /api/v1/count */
export interface FTCount {
  current: number;
  max: number;
  total_stake: number;
}

/** GET /api/v1/health */
export interface FTHealth {
  last_process: string;
  last_process_loc: string;
}

/** GET /api/v1/whitelist */
export interface FTWhitelist {
  whitelist: string[];
  length: number;
  method: string[];
}

/** GET /api/v1/locks */
export interface FTLock {
  id: number;
  active: boolean;
  strategy: string;
  lock_end_time: string;
  lock_end_timestamp: number;
  pair: string;
  reason: string;
  side: string;
}

export interface FTLocksResponse {
  lock_count: number;
  locks: FTLock[];
}

/** GET /api/v1/logs */
export interface FTLogsResponse {
  log_count: number;
  logs: Array<[string, string, string, string, string]>;
}

/** GET /api/v1/version */
export interface FTVersion {
  version: string;
}

/** GET /api/v1/sysinfo */
export interface FTSysinfo {
  cpu_pct: number[];
  ram_pct: number;
  ram_total?: number;
  ram_used?: number;
}

// ── FT Config sub-types (§1, §9, §11, §13, §17 of FREQTRADE_REFERENCE.md) ──

/** §1 — order_types section of config.json */
export interface FTOrderTypes {
  entry?: string;
  exit?: string;
  emergency_exit?: string;
  force_exit?: string;
  force_entry?: string;
  stoploss?: string;
  stoploss_on_exchange?: boolean;
  stoploss_on_exchange_interval?: number;
  stoploss_on_exchange_limit_ratio?: number;
}

/** §1 — order_time_in_force section */
export interface FTOrderTimeInForce {
  entry?: string;
  exit?: string;
}

/** §1 — unfilledtimeout section */
export interface FTUnfilledTimeout {
  entry?: number;
  exit?: number;
  unit?: string;
  exit_timeout_count?: number;
}

/** §1 — entry_pricing / exit_pricing section */
export interface FTPricing {
  price_side?: string;
  use_order_book?: boolean;
  order_book_top?: number;
  price_last_balance?: number;
}

/** §9 — exchange section (full config object form) */
export interface FTExchangeConfig {
  name?: string;
  key?: string;
  secret?: string;
  password?: string;
  uid?: string;
  pair_whitelist?: string[];
  pair_blacklist?: string[];
  enable_ws?: boolean;
  markets_refresh_interval?: number;
  ccxt_config?: Record<string, unknown>;
  skip_open_order_update?: boolean;
  unknown_fee_rate?: number;
  log_responses?: boolean;
  only_from_ccxt?: boolean;
}

/** §11 — telegram.notification_settings.protection_trigger */
export interface FTTelegramProtectionTrigger {
  lock?: string;
  stop?: string;
  global_stop?: string;
}

/** §11 — telegram.notification_settings */
export interface FTTelegramNotificationSettings {
  entry?: string;
  exit?: string;
  entry_cancel?: string;
  exit_cancel?: string;
  entry_fill?: string;
  exit_fill?: string;
  status?: string;
  show_candle?: string;
  protection_trigger?: FTTelegramProtectionTrigger;
  exit_stoploss?: string;
  exit_roi?: string;
  exit_exit_signal?: string;
  exit_force_exit?: string;
  exit_trailing_stop_loss?: string;
}

/** §11 — telegram section */
export interface FTTelegramConfig {
  enabled?: boolean;
  token?: string;
  chat_id?: string;
  allow_custom_messages?: boolean;
  balance_dust_level?: number;
  reload?: boolean;
  topic_id?: string;
  authorized_users?: string[];
  keyboard?: unknown;
  notification_settings?: FTTelegramNotificationSettings;
}

/** §13 — webhook section */
export interface FTWebhookConfig {
  enabled?: boolean;
  url?: string;
  format?: string;
  retries?: number;
  retry_delay?: number;
  timeout?: number;
  webhookstrategy_msg?: unknown;
  // Dynamic event payloads (webhookentry, webhookexit, etc.)
  [eventName: string]: unknown;
}

/** §13 — discord section */
export interface FTDiscordConfig {
  enabled?: boolean;
  webhook_url?: string;
  entry?: unknown;
  exit?: unknown;
  exit_fill?: unknown;
  status?: unknown;
}

/** §17 — external_message_consumer.producers[] entry */
export interface FTProducer {
  name?: string;
  host?: string;
  port?: number;
  ws_token?: string;
  secure?: boolean;
}

/** §17 — external_message_consumer section */
export interface FTExternalMessageConsumer {
  enabled?: boolean;
  remove_entry_exit_signals?: boolean;
  wait_timeout?: number;
  ping_timeout?: number;
  initial_candle_limit?: number;
  message_size_limit?: number;
  producers?: FTProducer[];
}

/** GET /api/v1/show_config — full FreqTrade config response */
export interface FTShowConfig {
  // Core identification
  version: string;
  strategy: string;
  strategy_version: string | null;
  timeframe: string;
  timeframe_ms: number;
  timeframe_secs: number;

  // Exchange — show_config returns string, raw config returns object
  exchange: string | FTExchangeConfig;

  // Pairs
  pair_whitelist: string[];
  pair_blacklist?: string[];

  // Staking
  stake_currency: string;
  stake_amount: number | string;
  available_capital: number | null;
  tradable_balance_ratio?: number;
  max_open_trades: number;
  fiat_display_currency?: string;

  // ROI & Stoploss
  minimal_roi: Record<string, number>;
  stoploss: number;
  trailing_stop: boolean;
  trailing_stop_positive: number | null;
  trailing_stop_positive_offset: number;
  trailing_only_offset_is_reached: boolean;

  // Exit signals
  use_exit_signal?: boolean;
  exit_profit_only?: boolean;
  ignore_roi_if_entry_signal?: boolean;
  exit_profit_offset?: number;

  // DCA
  position_adjustment_enable?: boolean;
  max_entry_position_adjustment?: number;

  // Dry run
  dry_run: boolean;
  dry_run_wallet?: number;

  // Futures
  trading_mode: "spot" | "futures" | "margin";
  margin_mode: "isolated" | "cross" | null;
  can_short: boolean;
  liquidation_buffer?: number;
  futures_funding_rate?: number;

  // Bot behavior
  bot_name?: string;
  initial_state?: string;
  force_entry_enable?: boolean;
  cancel_open_orders_on_exit?: boolean;
  process_only_new_candles?: boolean;
  process_throttle_secs?: number;
  heartbeat_interval?: number;
  amend_last_stake_amount?: boolean;
  last_stake_amount_min_ratio?: number;
  amount_reserve_percent?: number;
  ignore_buying_expired_candle_after?: number;
  custom_price_max_distance_ratio?: number;

  // Order types & timing (§1)
  order_types?: FTOrderTypes;
  order_time_in_force?: FTOrderTimeInForce;
  unfilledtimeout?: FTUnfilledTimeout;

  // Pricing (§1)
  entry_pricing?: FTPricing;
  exit_pricing?: FTPricing;

  // Protections & Pairlists (§7)
  protections?: FTProtection[];
  pairlists?: Array<{ method: string; [key: string]: unknown }>;

  // Telegram (§11)
  telegram?: FTTelegramConfig;

  // Webhooks (§13)
  webhook?: FTWebhookConfig;
  discord?: FTDiscordConfig;

  // Producer/Consumer (§17)
  external_message_consumer?: FTExternalMessageConsumer;

  // FreqAI (§24, §25, §26)
  freqai?: FTFreqAIConfig;

  // Advanced (§28)
  db_url?: string;
  verbosity?: string;
  logfile?: string;

  // Allow additional unknown fields from the raw FT config
  [key: string]: unknown;
}

/** Protection configuration */
export type FTProtection =
  | {
      method: "StoplossGuard";
      trade_limit: number;
      lookback_period_candles: number;
      stop_duration_candles: number;
      only_per_pair?: boolean;
      only_per_side?: boolean;
      required_profit?: number;
    }
  | {
      method: "MaxDrawdown";
      trade_limit: number;
      lookback_period_candles: number;
      stop_duration_candles: number;
      max_allowed_drawdown: number;
    }
  | {
      method: "LowProfitPairs";
      trade_limit: number;
      lookback_period_candles: number;
      stop_duration_candles: number;
      required_profit: number;
      only_per_pair?: boolean;
    }
  | {
      method: "CooldownPeriod";
      stop_duration_candles: number;
      only_per_pair?: boolean;
    };

/** FreqAI — rl_config.model_reward_parameters (§25) */
export interface FTRLModelRewardParameters {
  [key: string]: unknown;
}

/** FreqAI — rl_config section (§25) */
export interface FTRLConfig {
  model_type?: string;
  policy_type?: string;
  environment?: string;
  train_cycles?: number;
  max_trade_duration_candles?: number;
  max_training_drawdown_pct?: number;
  add_state_info?: boolean;
  cpu_count?: number;
  net_arch?: number[];
  randomize_starting_position?: boolean;
  drop_ohlc_from_features?: boolean;
  progress_bar?: boolean;
  model_reward_parameters?: FTRLModelRewardParameters;
}

/** FreqAI — model_training_parameters.trainer_kwargs (§24) */
export interface FTTrainerKwargs {
  n_epochs?: number;
  batch_size?: number;
  [key: string]: unknown;
}

/** FreqAI — model_training_parameters section (§24) */
export interface FTModelTrainingParameters {
  model_type?: string;
  learning_rate?: number;
  conv_width?: number;
  trainer_kwargs?: FTTrainerKwargs;
  [key: string]: unknown;
}

/** FreqAI — feature_parameters.svm_params (§26) */
export interface FTSVMParams {
  nu?: number;
  [key: string]: unknown;
}

/** FreqAI — feature_parameters section (§26) */
export interface FTFeatureParameters {
  include_time_in_the_row?: boolean;
  label_period_candles?: number;
  include_shifted_candles?: number;
  DI_threshold?: number;
  weight_factor?: number;
  principal_component_analysis?: boolean;
  use_SVM_to_remove_outliers?: boolean;
  use_DBSCAN_to_remove_outliers?: boolean;
  svm_params?: FTSVMParams;
  stratify_training_data?: number;
  indicator_periods_candles?: number[];
  include_timeframes?: string[];
  include_corr_pairlist?: string[];
  shuffle_after_split?: boolean;
  buffer_train_data_candles?: number;
}

/** FreqAI — data_split_parameters section (§26) */
export interface FTDataSplitParameters {
  test_size?: number;
  shuffle?: boolean;
}

/** FreqAI config (inside show_config.freqai) — §24, §25, §26 */
export interface FTFreqAIConfig {
  enabled: boolean;
  identifier: string;
  feature_parameters: FTFeatureParameters;
  data_split_parameters: FTDataSplitParameters;
  model_training_parameters: FTModelTrainingParameters;
  rl_config?: FTRLConfig;
  fit_live_predictions_candles?: number;
  purge_old_models?: boolean | number;
  save_backtest_models?: boolean;
  train_period_days?: number;
  backtest_period_days?: number;
  live_retrain_hours?: number;
  expired_hours?: number;
  continual_learning?: boolean;
  activate_tensorboard?: boolean;
  wait_for_training_iteration_on_reload?: boolean;
  override_exchange_check?: boolean;
  data_kitchen_thread_count?: number;
  noise_standard_deviation?: number;
  weight_factor?: number;
  buffer_train_data_candles?: number;
  outlier_protection_percentage?: number;
  plot_feature_importances?: number;
  write_metrics_to_disk?: boolean;
  reduce_df_footprint?: boolean;
  reverse_train_test_order?: boolean;
  feature_engineering_method?: string;
}

/** Pair candle data — GET /api/v1/pair_candles */
export interface FTPairCandlesResponse {
  pair: string;
  timeframe: string;
  timeframe_ms: number;
  columns: string[];
  data: Array<Array<number | string | null>>;
  length: number;
}

/** Strategy from FT — GET /api/v1/strategy/{name} */
export interface FTStrategy {
  strategy: string;
  code: string;
}

/** Strategies list — GET /api/v1/strategies */
export interface FTStrategiesResponse {
  strategies: string[];
}

/** Per-pair row in backtest results_per_pair */
export interface FTBacktestPairResult {
  key: string;
  trades: number;
  profit_mean: number;
  profit_mean_pct: number;
  profit_sum: number;
  profit_sum_pct: number;
  profit_total_abs: number;
  profit_total: number;
  profit_total_pct: number;
  duration_avg: string;
  wins: number;
  draws: number;
  losses: number;
}

/** Per-enter_tag row in backtest enter_tag_stats */
export interface FTBacktestTagStat {
  key: string;
  trades: number;
  profit_mean: number;
  profit_mean_pct: number;
  profit_sum: number;
  profit_sum_pct: number;
  profit_total_abs: number;
  profit_total: number;
  profit_total_pct: number;
  duration_avg: string;
  wins: number;
  draws: number;
  losses: number;
}

/** Per-period row in backtest periodic_breakdown */
export interface FTBacktestPeriodBreakdown {
  [period: string]: {
    date: string;
    profit_abs: number;
    wins: number;
    draws: number;
    losses: number;
  };
}

/** Strategy-level backtest result (nested under backtest_result.strategy_name) */
export interface FTBacktestStrategyResult {
  trades: Array<Record<string, unknown>>;
  results_per_pair: FTBacktestPairResult[];
  results_per_enter_tag?: FTBacktestTagStat[];
  exit_reason_summary?: FTBacktestTagStat[];
  mix_tag_stats?: FTBacktestTagStat[];
  periodic_breakdown?: Record<string, FTBacktestPeriodBreakdown>;
  left_open_trades: Array<Record<string, unknown>>;
  total_trades: number;
  total_volume: number;
  avg_stake_amount: number;
  profit_mean: number;
  profit_median: number;
  profit_total: number;
  profit_total_abs: number;
  cagr?: number;
  profit_factor?: number;
  backtest_start: string;
  backtest_start_ts: number;
  backtest_end: string;
  backtest_end_ts: number;
  backtest_days: number;
  backtest_run_start_ts: number;
  backtest_run_end_ts?: number;
  trades_per_day: number;
  market_change: number;
  pairlist: string[];
  stake_amount: number | string;
  stake_currency: string;
  stake_currency_decimals: number;
  starting_balance: number;
  final_balance: number;
  rejected_signals: number;
  timedout_entry_orders: number;
  timedout_exit_orders: number;
  canceled_trade_entries: number;
  canceled_entry_orders: number;
  replaced_entry_orders: number;
  max_open_trades: number;
  max_open_trades_setting: number;
  timeframe: string;
  timeframe_detail?: string;
  timerange: string;
  enable_protections: boolean;
  strategy_name: string;
  stoploss: number;
  trailing_stop: boolean;
  trailing_stop_positive?: number;
  trailing_stop_positive_offset?: number;
  trailing_only_offset_is_reached?: boolean;
  use_custom_stoploss: boolean;
  minimal_roi: Record<string, number>;
  use_exit_signal: boolean;
  exit_profit_only: boolean;
  exit_profit_offset: number;
  ignore_roi_if_entry_signal: boolean;
  backtest_best_day: number;
  backtest_worst_day: number;
  backtest_best_day_abs: number;
  backtest_worst_day_abs: number;
  win_rate: number;
  wins: number;
  draws: number;
  losses: number;
  holding_avg: string;
  holding_avg_s?: number;
  winner_holding_avg: string;
  winner_holding_avg_s?: number;
  loser_holding_avg: string;
  loser_holding_avg_s?: number;
  max_drawdown: number;
  max_drawdown_abs: number;
  max_drawdown_low: number;
  max_drawdown_high: number;
  drawdown_start: string;
  drawdown_start_ts: number;
  drawdown_end: string;
  drawdown_end_ts: number;
  max_consecutive_wins?: number;
  max_consecutive_losses?: number;
  sharpe?: number;
  sortino?: number;
  calmar?: number;
}

/** Hyperopt result entry — POST /api/v1/hyperopt-list §6 */
export interface FTHyperoptResult {
  epoch?: number;
  profit_total?: number;
  trades?: number;
  loss?: number;
  loss_function?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Backtest status/result — GET /api/v1/backtest */
export interface FTBacktestResult {
  status: string;
  progress: number;
  running: boolean;
  step: string;
  status_msg?: string;
  /** Strategy-keyed results. Key = strategy name, value = strategy result */
  backtest_result?: Record<string, FTBacktestStrategyResult>;
}

// PORTFOLIO AGGREGATION (Orchestrator)

export interface PortfolioBalance {
  bots: Record<string, FTBalance>;
  total_value: number;
  bot_count: number;
}

export interface PortfolioProfit {
  bots: Record<string, Record<string, unknown>>;
  combined: {
    profit_all_coin: number;
    profit_all_fiat: number;
    profit_closed_coin: number;
    profit_closed_fiat: number;
    trade_count: number;
    closed_trade_count: number;
    winning_trades: number;
    losing_trades: number;
  };
  bot_count: number;
  running_count: number;
  stopped_count: number;
}

export interface PortfolioTrades {
  trades: FTTrade[];
  trade_count: number;
  bot_count: number;
}

// AI VALIDATION LAYER (Orchestrator)

/** Single AI validation record — GET /api/ai/validations */
export interface AIValidation {
  id: number;
  bot_id: number;
  ft_trade_id: number;
  pair: string;
  created_at: string;
  freqai_direction: string;
  freqai_confidence: number;
  claude_direction: string;
  claude_confidence: number;
  claude_reasoning: string | null;
  claude_risk_factors: unknown[];
  claude_sentiment: string | null;
  claude_regime: string | null;
  grok_direction: string;
  grok_confidence: number;
  grok_reasoning: string | null;
  grok_risk_factors: unknown[];
  grok_sentiment: string | null;
  grok_regime: string | null;
  combined_confidence: number;
  agreement_pct: number;
  all_agree: boolean;
  strong_disagree: boolean;
  claude_tokens_used: number;
  grok_tokens_used: number;
  total_cost_usd: number;
}

/** Per-advisor accuracy stats — GET /api/ai/accuracy */
export interface AIAccuracyStats {
  freqai: { correct: number; total: number; pct: number };
  claude: { correct: number; total: number; pct: number };
  grok: { correct: number; total: number; pct: number };
}

/** Rolling accuracy history — GET /api/ai/accuracy/history */
export interface AIAccuracyHistory {
  days: number;
  history: Record<string, Record<string, number>>;
}

/** Agreement rate breakdown — GET /api/ai/agreement-rate */
export interface AIAgreementRate {
  days: number;
  total_validations: number;
  all_agree: number;
  partial_agree: number;
  strong_disagree: number;
  all_agree_pct: number;
  strong_disagree_pct: number;
}

/** Cost breakdown — GET /api/ai/cost */
export interface AICost {
  days: number;
  total_validations: number;
  claude_tokens_used: number;
  grok_tokens_used: number;
  total_cost_usd: number;
  avg_cost_per_validation: number;
  projected_monthly_usd: number;
}

/** AI validator runtime config — GET /api/ai/config */
export interface AIConfig {
  enabled: boolean;
  interval_seconds: number;
  claude_model: string;
  claude_fallback: string;
  grok_model: string;
  grok_fallback: string;
  weight_freqai: number;
  weight_claude: number;
  weight_grok: number;
  max_daily_cost_usd: number;
  max_validations_per_hour: number;
  telegram_notify_disagree: boolean;
  hyperopt_enabled: boolean;
  hyperopt_auto_post_analyze: boolean;
  api_key_configured: boolean;
}

/** Hyperopt AI analysis — GET /api/ai/hyperopt/analyses */
export interface AIHyperoptAnalysis {
  id: number;
  bot_id: number;
  strategy_name: string;
  pair: string;
  timeframe: string;
  analysis_type: "pre_hyperopt" | "post_hyperopt";
  suggested_loss_function: string | null;
  suggested_sampler: string | null;
  suggested_epochs: number | null;
  suggested_param_ranges: unknown;
  suggested_spaces: unknown;
  recommended_result_index: number | null;
  overfitting_scores: Array<{ result_index?: number; risk_score?: number; verdict?: "SAFE" | "CAUTION" | "RISKY" }>;
  claude_confidence: number | null;
  grok_confidence: number | null;
  total_cost_usd: number;
  created_at: string;
  baseline_profit: number | null;
  baseline_trades: number | null;
  baseline_sharpe: number | null;
  baseline_max_drawdown: number | null;
}

/** Hyperopt comparison — GET /api/ai/hyperopt/comparison/{id} */
export interface AIHyperoptComparison {
  analysis_id: number;
  strategy_name: string;
  pair: string;
  timeframe: string;
  baseline: {
    profit: number | null;
    trades: number | null;
    sharpe: number | null;
    max_drawdown: number | null;
  };
  recommended_result_index: number | null;
  overfitting_scores: Array<{ result_index?: number; risk_score?: number; verdict?: "SAFE" | "CAUTION" | "RISKY" }>;
  claude_analysis: Record<string, unknown> | null;
  grok_analysis: Record<string, unknown> | null;
  claude_confidence: number | null;
  grok_confidence: number | null;
  advisors_agree: boolean | null;
}

/** Hyperopt comparison stats — GET /api/ai/hyperopt/comparison/stats */
export interface AIHyperoptComparisonStats {
  followed_ai: {
    count: number;
    avg_paper_result: number | null;
    avg_live_result: number | null;
  };
  ignored_ai: {
    count: number;
    avg_paper_result: number | null;
    avg_live_result: number | null;
  };
}

// ACTIVITY LOG TYPES (orchestrator audit_log table)

export type LogLevel = "info" | "warning" | "error" | "critical";

/** Single activity log entry from audit_log table */
export interface ActivityLog {
  id: number;
  action: string;
  level: LogLevel;
  actor: string;
  bot_id: number | null;
  bot_name: string | null;
  target_type: string | null;
  target_id: number | null;
  target_name: string | null;
  details: string | null;        // JSON string
  created_at: string | null;     // ISO 8601
}

/** Paginated log response from GET /api/logs */
export interface ActivityLogResponse {
  total: number;
  offset: number;
  limit: number;
  logs: ActivityLog[];
}

/** Per-bot log response from GET /api/logs/bot/{botId} */
export interface BotLogResponse extends ActivityLogResponse {
  bot_id: number;
}

// ARCHITECTURE V2 TYPES (Strategy Versioning & Exchange Profiles)

/** Strategy Version — immutable snapshot of strategy at a point in time */
export interface StrategyVersion {
  id: number;
  strategy_id: number;
  version_number: number;
  code: string;
  builder_state?: Record<string, unknown>;
  risk_config?: {
    stoploss?: number;
    roi?: Record<string, number>;
    trailing_stop?: boolean;
    trailing_stop_positive?: number;
    trailing_stop_positive_offset?: number;
    trailing_only_offset_is_reached?: boolean;
    use_custom_stoploss?: boolean;
    protections?: Array<Record<string, unknown>>;
  };
  callbacks?: Record<string, { enabled: boolean; code?: string }>;
  freqai_config?: Record<string, unknown>;
  changelog?: string;
  created_at: string;
}

/** Exchange Profile — reusable credential set for exchange connections */
export interface ExchangeProfile {
  id: number;
  name: string;
  exchange_name: string;
  subaccount?: string;
  created_at: string;
  updated_at: string;
  // Note: API keys are never returned to frontend
}

/** Backtest Result — result from a single backtest run */
export interface BacktestResult {
  id: number;
  strategy_version_id: number;
  exchange_data: string;
  pairs: string[];
  timeframe: string;
  timerange_start: string;
  timerange_end: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  profit_total: number;
  profit_percent: number;
  max_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  sqn: number;
  full_results?: Record<string, unknown>;
  created_at: string;
}
