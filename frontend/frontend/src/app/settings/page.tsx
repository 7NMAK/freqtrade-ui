"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import SystemSettingsTab from "@/components/settings/SystemSettingsTab";
import { getBots, botConfig, saveBotConfig, reloadBotConfig, botWhitelist } from "@/lib/api";
import { TOOLTIPS } from "@/lib/tooltips";
import type { Bot, FTShowConfig } from "@/types";

/* ── Types ── */
type TabId = "system" | "core" | "pairlists" | "exchange" | "telegram" | "webhooks" | "producer" | "advanced";

interface SettingsTab {
  id: TabId;
  label: string;
  icon: string;
  ref: string;
}

interface RoiRow {
  time: number;
  roi: number;
}

/** §7 Pairlist filter params — all optional, each filter uses a subset */
interface PairlistFilterParams {
  // AgeFilter
  min_days_listed?: number;
  max_days_listed?: number | string;
  // DelistFilter
  min_days_until_removed?: number;
  // SpreadFilter
  max_spread_ratio?: number;
  // PriceFilter
  low_price_ratio?: number;
  min_price?: number;
  max_price?: number;
  // RangeStabilityFilter
  min_rate_of_change?: number;
  max_rate_of_change?: number;
  lookback_days?: number;
  // VolatilityFilter
  min_volatility?: number;
  max_volatility?: number;
  // OffsetFilter
  offset?: number;
  number_assets?: number;
  // VolumePairList / PerformanceFilter
  trade_back_seconds?: number;
  // ShuffleFilter
  seed?: number | string;
}

interface PairlistFilter {
  name: string;
  enabled: boolean;
  open: boolean;
  params: PairlistFilterParams;
}

interface WebhookEvent {
  name: string;
  enabled: boolean;
  open: boolean;
  payload: string;
}

interface Producer {
  name: string;
  host: string;
  port: number;
  ws_token: string;
  secure: boolean;
}

interface ConfigState {
  // Core
  bot_name: string;
  initial_state: string;
  max_open_trades: number;
  stake_currency: string;
  stake_amount: string;
  tradable_balance_ratio: number;
  available_capital: number;
  fiat_display_currency: string;
  timeframe: string;
  force_entry_enable: string;
  dry_run: boolean;
  cancel_open_orders_on_exit: boolean;
  process_only_new_candles: boolean;
  dry_run_wallet: number;
  minimal_roi: RoiRow[];
  stoploss: number;
  trailing_stop: boolean;
  trailing_stop_positive: number;
  trailing_stop_positive_offset: number;
  trailing_only_offset_is_reached: string;
  use_exit_signal: boolean;
  exit_profit_only: boolean;
  ignore_roi_if_entry_signal: boolean;
  exit_profit_offset: number;
  order_types_entry: string;
  order_types_exit: string;
  order_types_emergency_exit: string;
  order_types_force_exit: string;
  order_types_force_entry: string;
  order_types_stoploss: string;
  stoploss_on_exchange: boolean;
  stoploss_on_exchange_interval: number;
  stoploss_on_exchange_limit_ratio: number;
  order_time_in_force_entry: string;
  order_time_in_force_exit: string;
  unfilledtimeout_entry: number;
  unfilledtimeout_exit: number;
  unfilledtimeout_unit: string;
  exit_timeout_count: number;
  entry_pricing_price_side: string;
  entry_pricing_use_order_book: string;
  entry_pricing_order_book_top: number;
  entry_pricing_price_last_balance: number;
  exit_pricing_price_side: string;
  exit_pricing_use_order_book: string;
  exit_pricing_order_book_top: number;
  position_adjustment_enable: boolean;
  max_entry_position_adjustment: number;
  trading_mode: string;
  margin_mode: string;
  liquidation_buffer: number;

  // Core (additional)
  amend_last_stake_amount: boolean;
  last_stake_amount_min_ratio: number;
  amount_reserve_percent: number;
  ignore_buying_expired_candle_after: number;
  custom_price_max_distance_ratio: number;
  futures_funding_rate: number;
  process_throttle_secs: number;
  heartbeat_interval: number;

  // Exchange
  exchange_name: string;
  exchange_key: string;
  exchange_secret: string;
  exchange_password: string;
  exchange_uid: string;
  pair_whitelist: string[];
  pair_blacklist: string[];
  enable_ws: boolean;
  markets_refresh_interval: number;
  ccxt_config: string;
  skip_open_order_update: boolean;
  unknown_fee_rate: number;
  log_responses: boolean;
  only_from_ccxt: boolean;

  // Pairlists
  pairlist_handler: string;
  pairlist_number_assets: number;
  pairlist_sort_key: string;
  pairlist_min_value: number;
  pairlist_refresh_period: number;
  pairlist_filters: PairlistFilter[];

  // Telegram
  telegram_enabled: boolean;
  telegram_token: string;
  telegram_chat_id: string;
  telegram_notification_entry: boolean;
  telegram_notification_exit: boolean;
  telegram_notification_entry_cancel: boolean;
  telegram_notification_exit_cancel: boolean;
  telegram_notification_entry_fill: boolean;
  telegram_notification_exit_fill: boolean;
  telegram_notification_status: boolean;
  telegram_allow_custom_messages: boolean;
  telegram_balance_dust_level: number;
  telegram_reload: boolean;
  telegram_topic_id: string;
  telegram_authorized_users: string[];
  telegram_keyboard: string;
  telegram_notification_protection_trigger_lock: boolean;
  telegram_notification_protection_trigger_stop: boolean;
  telegram_notification_protection_trigger_global_stop: boolean;
  telegram_notification_show_candle: string;
  telegram_notification_exit_stoploss: boolean;
  telegram_notification_exit_roi: boolean;
  telegram_notification_exit_exit_signal: boolean;
  telegram_notification_exit_force_exit: boolean;
  telegram_notification_exit_trailing_stop_loss: boolean;

  // Webhooks
  webhook_enabled: boolean;
  webhook_url: string;
  webhook_events: WebhookEvent[];
  webhook_format: string;
  webhook_retries: number;
  webhook_retry_delay: number;
  webhook_timeout: number;
  webhook_strategy_msg: string;
  discord_enabled: boolean;
  discord_webhook_url: string;
  discord_entry_payload: string;
  discord_exit_payload: string;
  discord_exit_fill_payload: string;
  discord_status_payload: string;

  // Producer/Consumer
  consumer_enabled: boolean;
  remove_entry_exit_signals: boolean;
  consumer_wait_timeout: number;
  consumer_ping_timeout: number;
  consumer_initial_candle_limit: number;
  consumer_message_size_limit: number;
  producers: Producer[];

  // Advanced
  db_type: string;
  db_url: string;
  verbosity: string;
  logfile: string;
  log_rotate: string;
  log_rotate_bytes: number;
  log_rotate_backup_count: number;
}

/* ── Constants ── */
const TABS: SettingsTab[] = [
  { id: "system", label: "System", icon: "\uD83D\uDC27", ref: "System" },
  { id: "core", label: "Core Trading", icon: "\u2699\uFE0F", ref: "\u00A71" },
  { id: "pairlists", label: "Pairlists", icon: "\uD83D\uDCCB", ref: "\u00A77" },
  { id: "exchange", label: "Exchange", icon: "\uD83C\uDFE6", ref: "\u00A79" },
  { id: "telegram", label: "Telegram", icon: "\uD83D\uDCE8", ref: "\u00A711" },
  { id: "webhooks", label: "Webhooks", icon: "\uD83D\uDD17", ref: "\u00A713" },
  { id: "producer", label: "Producer/Consumer", icon: "\uD83D\uDCE1", ref: "\u00A717" },
  { id: "advanced", label: "Advanced", icon: "\uD83D\uDD27", ref: "\u00A728" },
];

const DEFAULT_FILTERS: PairlistFilter[] = [
  { name: "AgeFilter", enabled: false, open: false, params: { min_days_listed: 10, max_days_listed: "" } },
  { name: "DelistFilter", enabled: false, open: false, params: { min_days_until_removed: 30 } },
  { name: "SpreadFilter", enabled: false, open: false, params: { max_spread_ratio: 0.005 } },
  { name: "PriceFilter", enabled: false, open: false, params: { low_price_ratio: 0.01, min_price: 0.0000001, max_price: 0 } },
  { name: "RangeStabilityFilter", enabled: false, open: false, params: { min_rate_of_change: 0.02, max_rate_of_change: 0, lookback_days: 10 } },
  { name: "VolatilityFilter", enabled: false, open: false, params: { min_volatility: 0.02, max_volatility: 0.75, lookback_days: 14 } },
  { name: "OffsetFilter", enabled: false, open: false, params: { offset: 0, number_assets: 0 } },
  { name: "PerformanceFilter", enabled: false, open: false, params: { trade_back_seconds: 0 } },
  { name: "FullTradesFilter", enabled: false, open: false, params: {} },
  { name: "PrecisionFilter", enabled: false, open: false, params: {} },
  { name: "ShuffleFilter", enabled: false, open: false, params: { seed: "" } },
];

const DEFAULT_WEBHOOK_EVENTS: WebhookEvent[] = [
  { name: "webhookentry", enabled: false, open: false, payload: '{\n  "value1": "Entering {pair}",\n  "value2": "Rate: {open_rate}",\n  "value3": "{enter_tag}"\n}' },
  { name: "webhookentrycancel", enabled: false, open: false, payload: '{\n  "value1": "Entry cancelled for {pair}",\n  "value2": "Order Type: {order_type}"\n}' },
  { name: "webhookentryfill", enabled: false, open: false, payload: '{\n  "value1": "Entry filled for {pair}",\n  "value2": "Rate: {open_rate}",\n  "value3": "Amount: {amount}"\n}' },
  { name: "webhookexit", enabled: false, open: false, payload: '{\n  "value1": "Exiting {pair}",\n  "value2": "Profit: {profit_amount} {stake_currency}",\n  "value3": "{exit_reason}"\n}' },
  { name: "webhookexitcancel", enabled: false, open: false, payload: '{\n  "value1": "Exit cancelled for {pair}",\n  "value2": "Current: {current_rate}"\n}' },
  { name: "webhookexitfill", enabled: false, open: false, payload: '{\n  "value1": "Exit filled for {pair}",\n  "value2": "Profit: {profit_amount} {stake_currency}",\n  "value3": "{exit_reason}"\n}' },
  { name: "webhookstatus", enabled: false, open: false, payload: '{\n  "value1": "Status: Running",\n  "value2": "Unrealized: {unrealized_profit}"\n}' },
];

const webhookVars = [
  { key: "{trade_id}", desc: "Trade ID" },
  { key: "{exchange}", desc: "Exchange name" },
  { key: "{pair}", desc: "Trading pair" },
  { key: "{base_currency}", desc: "Base currency" },
  { key: "{quote_currency}", desc: "Quote currency" },
  { key: "{stake_currency}", desc: "Stake currency" },
  { key: "{amount}", desc: "Trade amount" },
  { key: "{open_rate}", desc: "Entry rate" },
  { key: "{close_rate}", desc: "Exit rate" },
  { key: "{open_date}", desc: "Entry time" },
  { key: "{close_date}", desc: "Exit time" },
  { key: "{profit_amount}", desc: "Profit in stake" },
  { key: "{profit_ratio}", desc: "Profit as ratio" },
  { key: "{stake_amount}", desc: "Stake amount" },
  { key: "{enter_tag}", desc: "Entry tag" },
  { key: "{exit_reason}", desc: "Exit reason" },
  { key: "{direction}", desc: "Trade direction" },
  { key: "{leverage}", desc: "Leverage used" },
  { key: "{order_type}", desc: "Order type" },
  { key: "{current_rate}", desc: "Current rate" },
  { key: "{unrealized_profit}", desc: "Unrealized P&L" },
];

function getDefaultConfig(): ConfigState {
  return {
    bot_name: "",
    initial_state: "stopped",
    max_open_trades: 3,
    stake_currency: "USDT",
    stake_amount: "unlimited",
    tradable_balance_ratio: 0.99,
    available_capital: 0,
    fiat_display_currency: "USD",
    timeframe: "1h",
    force_entry_enable: "false",
    dry_run: true,
    cancel_open_orders_on_exit: true,
    process_only_new_candles: true,
    dry_run_wallet: 1000,
    minimal_roi: [],
    stoploss: -0.10,
    trailing_stop: false,
    trailing_stop_positive: 0,
    trailing_stop_positive_offset: 0,
    trailing_only_offset_is_reached: "false",
    use_exit_signal: true,
    exit_profit_only: false,
    ignore_roi_if_entry_signal: false,
    exit_profit_offset: 0,
    order_types_entry: "limit",
    order_types_exit: "limit",
    order_types_emergency_exit: "market",
    order_types_force_exit: "market",
    order_types_force_entry: "market",
    order_types_stoploss: "market",
    stoploss_on_exchange: false,
    stoploss_on_exchange_interval: 60,
    stoploss_on_exchange_limit_ratio: 0.99,
    order_time_in_force_entry: "GTC",
    order_time_in_force_exit: "GTC",
    unfilledtimeout_entry: 10,
    unfilledtimeout_exit: 30,
    unfilledtimeout_unit: "minutes",
    exit_timeout_count: 0,
    entry_pricing_price_side: "same",
    entry_pricing_use_order_book: "true",
    entry_pricing_order_book_top: 1,
    entry_pricing_price_last_balance: 0,
    exit_pricing_price_side: "same",
    exit_pricing_use_order_book: "true",
    exit_pricing_order_book_top: 1,
    position_adjustment_enable: false,
    max_entry_position_adjustment: -1,
    trading_mode: "futures",
    margin_mode: "isolated",
    liquidation_buffer: 0.05,

    amend_last_stake_amount: false,
    last_stake_amount_min_ratio: 0.5,
    amount_reserve_percent: 0.05,
    ignore_buying_expired_candle_after: 0,
    custom_price_max_distance_ratio: 0.02,
    futures_funding_rate: 0,
    process_throttle_secs: 5,
    heartbeat_interval: 60,

    exchange_name: "binance",
    exchange_key: "",
    exchange_secret: "",
    exchange_password: "",
    exchange_uid: "",
    pair_whitelist: [],
    pair_blacklist: [],
    enable_ws: true,
    markets_refresh_interval: 60,
    ccxt_config: '{\n  "enableRateLimit": true\n}',
    skip_open_order_update: false,
    unknown_fee_rate: 0,
    log_responses: false,
    only_from_ccxt: false,

    pairlist_handler: "VolumePairList",
    pairlist_number_assets: 20,
    pairlist_sort_key: "quoteVolume",
    pairlist_min_value: 0,
    pairlist_refresh_period: 1800,
    pairlist_filters: DEFAULT_FILTERS.map((f) => ({ ...f, params: { ...f.params } })),

    telegram_enabled: false,
    telegram_token: "",
    telegram_chat_id: "",
    telegram_notification_entry: true,
    telegram_notification_exit: true,
    telegram_notification_entry_cancel: true,
    telegram_notification_exit_cancel: true,
    telegram_notification_entry_fill: true,
    telegram_notification_exit_fill: true,
    telegram_notification_status: true,
    telegram_allow_custom_messages: false,
    telegram_balance_dust_level: 0.0,
    telegram_reload: true,
    telegram_topic_id: "",
    telegram_authorized_users: [],
    telegram_keyboard: '[\n  ["/daily", "/profit", "/balance"],\n  ["/status table", "/performance"],\n  ["/count", "/start", "/stop", "/help"]\n]',
    telegram_notification_protection_trigger_lock: true,
    telegram_notification_protection_trigger_stop: true,
    telegram_notification_protection_trigger_global_stop: true,
    telegram_notification_show_candle: "off",
    telegram_notification_exit_stoploss: true,
    telegram_notification_exit_roi: true,
    telegram_notification_exit_exit_signal: true,
    telegram_notification_exit_force_exit: true,
    telegram_notification_exit_trailing_stop_loss: true,

    webhook_enabled: false,
    webhook_url: "",
    webhook_events: DEFAULT_WEBHOOK_EVENTS.map((e) => ({ ...e })),
    webhook_format: "form",
    webhook_retries: 0,
    webhook_retry_delay: 0.1,
    webhook_timeout: 10,
    webhook_strategy_msg: '{\n  "value1": "Strategy notification",\n  "value2": "{msg}"\n}',
    discord_enabled: false,
    discord_webhook_url: "",
    discord_entry_payload: '{\n  "content": "Entering {pair} at {open_rate}"\n}',
    discord_exit_payload: '{\n  "content": "Exiting {pair}, Profit: {profit_amount} {stake_currency}"\n}',
    discord_exit_fill_payload: '{\n  "content": "Exit filled for {pair}"\n}',
    discord_status_payload: '{\n  "content": "Bot status update"\n}',

    consumer_enabled: false,
    remove_entry_exit_signals: false,
    consumer_wait_timeout: 300,
    consumer_ping_timeout: 10,
    consumer_initial_candle_limit: 1500,
    consumer_message_size_limit: 8,
    producers: [],

    db_type: "sqlite",
    db_url: "",
    verbosity: "1",
    logfile: "",
    log_rotate: "true",
    log_rotate_bytes: 10485760,
    log_rotate_backup_count: 5,
  };
}

/* ── Reusable sub-components ── */

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-[38px] h-[20px] rounded-[10px] border cursor-pointer relative transition-all flex-shrink-0 ${
        on ? "bg-primary border-primary" : "bg-muted border-border"
      }`}
    >
      <span
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all ${
          on ? "left-[20px] bg-white" : "left-[2px] bg-text-3"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  desc,
  on,
  onToggle,
}: {
  name?: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs font-semibold text-foreground">{desc}</span>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function FormInput({
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  mono,
  className = "",
}: {
  type?: string;
  value?: string | number;
  onChange?: (val: string) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      step={step}
      min={min}
      max={max}
      className={`w-full bg-muted/50 border border-border rounded-btn px-3.5 py-2.5 text-xs text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground ${
        mono ? "font-mono text-xs" : ""
      } ${className}`}
    />
  );
}

function FormSelect({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (val: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full bg-muted/50 border border-border rounded-btn px-3.5 py-2.5 text-xs text-foreground outline-none transition-colors focus:border-primary cursor-pointer appearance-none bg-no-repeat bg-[right_12px_center] pr-8 ${className}`}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23808098'/%3E%3C/svg%3E")` }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function FormHint({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground mt-1">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-foreground mb-2">{children}</h2>;
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mb-7">{children}</p>;
}

function SubsectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground mb-4.5 flex items-center gap-2">
      <span className="text-sm">{icon}</span>
      {children}
    </h3>
  );
}

function FormDivider() {
  return <hr className="border-t border-border my-6" />;
}

function TagEditor({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 border border-border rounded-btn min-h-[38px] items-center">
      {tags.map((tag, i) => (
        <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted border border-border rounded text-xs text-foreground font-mono">
          {tag}
          <span
            className="text-muted-foreground cursor-pointer text-xs hover:text-rose-500"
            onClick={() => onRemove(i)}
          >
            &times;
          </span>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-none bg-transparent text-foreground text-xs outline-none min-w-[80px] font-mono placeholder:text-muted-foreground"
      />
    </div>
  );
}

/* ── Tab prop type ── */
interface TabProps {
  config: ConfigState;
  update: <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => void;
  botId?: number;
}

/* ─────────────────────────────────────────── */
/* TAB CONTENT: Core Trading (Section 1)      */
/* ─────────────────────────────────────────── */
function CoreTab({ config, update }: TabProps) {
  const toggleBool = (key: keyof ConfigState) => {
    const current = config[key];
    if (typeof current === "boolean") {
      update(key, !current);
    }
  };

  return (
    <div>
      <SectionTitle>Core Trading Configuration</SectionTitle>
      <SectionDesc>Primary trading parameters from config.json -- Section 1 Configuration Parameters</SectionDesc>

      {/* Bot Identity */}
      <SubsectionTitle icon={"\uD83E\uDD16"}>Bot Identity</SubsectionTitle>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.bot_name?.description ?? "Bot Name"} configKey="bot_name"><FormLabel>Bot Name</FormLabel></Tooltip>
          <FormInput value={config.bot_name} onChange={(v) => update("bot_name", v)} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.initial_state?.description ?? "Initial State"} configKey="initial_state"><FormLabel>Initial State</FormLabel></Tooltip>
          <FormSelect
            value={config.initial_state}
            onChange={(v) => update("initial_state", v)}
            options={[
              { value: "running", label: "running" },
              { value: "stopped", label: "stopped" },
            ]}
          />
        </div>
      </div>

      <FormDivider />

      {/* Stake & Trade Limits */}
      <SubsectionTitle icon={"\uD83D\uDCB0"}>Stake & Trade Limits</SubsectionTitle>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.max_open_trades?.description ?? "Max Open Trades"} configKey="max_open_trades"><FormLabel>Max Open Trades</FormLabel></Tooltip>
          <FormInput type="number" value={config.max_open_trades} onChange={(v) => update("max_open_trades", Number(v))} />
          <FormHint>-1 for unlimited</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.stake_currency?.description ?? "Stake Currency"} configKey="stake_currency"><FormLabel>Stake Currency</FormLabel></Tooltip>
          <FormInput value={config.stake_currency} onChange={(v) => update("stake_currency", v)} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.stake_amount?.description ?? "Stake Amount"} configKey="stake_amount"><FormLabel>Stake Amount</FormLabel></Tooltip>
          <FormInput value={config.stake_amount} onChange={(v) => update("stake_amount", v)} />
          <FormHint>Or &quot;unlimited&quot; for dynamic</FormHint>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.tradable_balance_ratio?.description ?? "Tradable Balance Ratio"} configKey="tradable_balance_ratio"><FormLabel>Tradable Balance Ratio</FormLabel></Tooltip>
          <FormInput type="number" value={config.tradable_balance_ratio} onChange={(v) => update("tradable_balance_ratio", Number(v))} step="0.01" min="0" max="1" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.available_capital?.description ?? "Available Capital"} configKey="available_capital"><FormLabel>Available Capital</FormLabel></Tooltip>
          <FormInput type="number" value={config.available_capital} onChange={(v) => update("available_capital", Number(v))} />
          <FormHint>If set, used instead of wallet balance</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.fiat_display_currency?.description ?? "Fiat Display Currency"} configKey="fiat_display_currency"><FormLabel>Fiat Display Currency</FormLabel></Tooltip>
          <FormSelect
            value={config.fiat_display_currency}
            onChange={(v) => update("fiat_display_currency", v)}
            options={[
              { value: "USD", label: "USD" },
              { value: "EUR", label: "EUR" },
              { value: "GBP", label: "GBP" },
              { value: "JPY", label: "JPY" },
              { value: "", label: "None" },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.timeframe?.description ?? "Timeframe"} configKey="timeframe"><FormLabel>Timeframe</FormLabel></Tooltip>
          <FormSelect
            value={config.timeframe}
            onChange={(v) => update("timeframe", v)}
            options={[
              { value: "1m", label: "1m" },
              { value: "5m", label: "5m" },
              { value: "15m", label: "15m" },
              { value: "30m", label: "30m" },
              { value: "1h", label: "1h" },
              { value: "4h", label: "4h" },
              { value: "1d", label: "1d" },
            ]}
          />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.force_entry_enable?.description ?? "Force Entry Enable"} configKey="force_entry_enable"><FormLabel>Force Entry Enable</FormLabel></Tooltip>
          <FormSelect
            value={config.force_entry_enable}
            onChange={(v) => update("force_entry_enable", v)}
            options={[
              { value: "true", label: "true" },
              { value: "false", label: "false" },
            ]}
          />
        </div>
      </div>

      <FormDivider />

      {/* Dry Run */}
      <SubsectionTitle icon={"\uD83E\uDDEA"}>Dry Run</SubsectionTitle>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.dry_run?.description ?? "Simulate trades without real orders"} configKey="dry_run"><ToggleRow name="dry_run" desc="Simulate trades without real orders" on={config.dry_run} onToggle={() => toggleBool("dry_run")} /></Tooltip>
          <Tooltip content={TOOLTIPS.cancel_open_orders_on_exit?.description ?? "Cancel pending orders when bot stops"} configKey="cancel_open_orders_on_exit"><ToggleRow name="cancel_open_orders_on_exit" desc="Cancel pending orders when bot stops" on={config.cancel_open_orders_on_exit} onToggle={() => toggleBool("cancel_open_orders_on_exit")} /></Tooltip>
          <Tooltip content={TOOLTIPS.process_only_new_candles?.description ?? "Only process strategy on new candle data"} configKey="process_only_new_candles"><ToggleRow name="process_only_new_candles" desc="Only process strategy on new candle data" on={config.process_only_new_candles} onToggle={() => toggleBool("process_only_new_candles")} /></Tooltip>
        </CardBody>
      </Card>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.dry_run_wallet?.description ?? "Dry Run Wallet"} configKey="dry_run_wallet"><FormLabel>Dry Run Wallet</FormLabel></Tooltip>
        <FormInput type="number" value={config.dry_run_wallet} onChange={(v) => update("dry_run_wallet", Number(v))} step="100" />
        <FormHint>Simulated wallet balance in stake_currency</FormHint>
      </div>

      <FormDivider />

      {/* Minimal ROI */}
      <Tooltip content={TOOLTIPS.minimal_roi?.description ?? "Minimal ROI"} configKey="minimal_roi"><SubsectionTitle icon={"\uD83D\uDCC9"}>Minimal ROI</SubsectionTitle></Tooltip>
      <Card className="mb-7">
        <CardHeader
          title="ROI Table"
          action={
            <button
              type="button"
              className="text-xs text-primary font-medium hover:text-primary cursor-pointer"
              onClick={() => update("minimal_roi", [...config.minimal_roi, { time: 0, roi: 0 }])}
            >
              + Add Row
            </button>
          }
        />
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left px-3.5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">Time (minutes)</th>
                <th className="text-left px-3.5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">ROI (%)</th>
                <th className="w-8 border-b border-border" />
              </tr>
            </thead>
            <tbody>
              {config.minimal_roi.map((row, i) => (
                <tr key={`roi-${i}`}>
                  <td className="px-3 py-1.5 border-b border-border/40">
                    <input
                      type="number"
                      value={row.time}
                      onChange={(e) => {
                        const next = [...config.minimal_roi];
                        next[i] = { ...next[i], time: Number(e.target.value) };
                        update("minimal_roi", next);
                      }}
                      className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-3 py-1.5 border-b border-border/40">
                    <input
                      type="number"
                      value={row.roi}
                      step="0.01"
                      onChange={(e) => {
                        const next = [...config.minimal_roi];
                        next[i] = { ...next[i], roi: Number(e.target.value) };
                        update("minimal_roi", next);
                      }}
                      className="w-full bg-card border border-border rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-2 py-1.5 border-b border-border/40">
                    <button
                      type="button"
                      className="text-rose-500 text-sm opacity-60 hover:opacity-100 cursor-pointer"
                      onClick={() => update("minimal_roi", config.minimal_roi.filter((_, j) => j !== i))}
                    >
                      &#x2715;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <FormDivider />

      {/* Stoploss & Trailing */}
      <SubsectionTitle icon={"\uD83D\uDED1"}>Stoploss & Trailing</SubsectionTitle>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.stoploss?.description ?? "Stoploss"} configKey="stoploss"><FormLabel>Stoploss</FormLabel></Tooltip>
          <FormInput type="number" value={config.stoploss} onChange={(v) => update("stoploss", Number(v))} step="0.01" max="0" />
          <FormHint>Negative decimal (e.g. -0.10 = 10%)</FormHint>
        </div>
        <div />
      </div>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.trailing_stop?.description ?? "Enable trailing stoploss"} configKey="trailing_stop"><ToggleRow name="trailing_stop" desc="Enable trailing stoploss" on={config.trailing_stop} onToggle={() => toggleBool("trailing_stop")} /></Tooltip>
        </CardBody>
      </Card>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.trailing_stop_positive?.description ?? "Trailing Stop Positive"} configKey="trailing_stop_positive"><FormLabel>Trailing Stop Positive</FormLabel></Tooltip>
          <FormInput type="number" value={config.trailing_stop_positive} onChange={(v) => update("trailing_stop_positive", Number(v))} step="0.01" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.trailing_stop_positive_offset?.description ?? "Trailing Stop Positive Offset"} configKey="trailing_stop_positive_offset"><FormLabel>Trailing Stop Positive Offset</FormLabel></Tooltip>
          <FormInput type="number" value={config.trailing_stop_positive_offset} onChange={(v) => update("trailing_stop_positive_offset", Number(v))} step="0.01" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.trailing_only_offset_is_reached?.description ?? "Trailing Only Offset Is Reached"} configKey="trailing_only_offset_is_reached"><FormLabel>Trailing Only Offset Is Reached</FormLabel></Tooltip>
          <FormSelect
            value={config.trailing_only_offset_is_reached}
            onChange={(v) => update("trailing_only_offset_is_reached", v)}
            options={[
              { value: "true", label: "true" },
              { value: "false", label: "false" },
            ]}
          />
        </div>
      </div>

      <FormDivider />

      {/* Exit Signal Control */}
      <SubsectionTitle icon={"\uD83D\uDEAA"}>Exit Signal Control</SubsectionTitle>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.use_exit_signal?.description ?? "Use strategy exit signals (not just ROI/stoploss)"} configKey="use_exit_signal"><ToggleRow name="use_exit_signal" desc="Use strategy exit signals (not just ROI/stoploss)" on={config.use_exit_signal} onToggle={() => toggleBool("use_exit_signal")} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit_profit_only?.description ?? "Only exit when trade is in profit"} configKey="exit_profit_only"><ToggleRow name="exit_profit_only" desc="Only exit when trade is in profit" on={config.exit_profit_only} onToggle={() => toggleBool("exit_profit_only")} /></Tooltip>
          <Tooltip content={TOOLTIPS.ignore_roi_if_entry_signal?.description ?? "Don't exit via ROI if entry signal is still active"} configKey="ignore_roi_if_entry_signal"><ToggleRow name="ignore_roi_if_entry_signal" desc="Don't exit via ROI if entry signal is still active" on={config.ignore_roi_if_entry_signal} onToggle={() => toggleBool("ignore_roi_if_entry_signal")} /></Tooltip>
        </CardBody>
      </Card>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.exit_profit_offset?.description ?? "Exit Profit Offset"} configKey="exit_profit_offset"><FormLabel>Exit Profit Offset</FormLabel></Tooltip>
        <FormInput type="number" value={config.exit_profit_offset} onChange={(v) => update("exit_profit_offset", Number(v))} step="0.01" className="max-w-[300px]" />
        <FormHint>Minimum profit before exit signal is honoured</FormHint>
      </div>

      <FormDivider />

      {/* Order Types */}
      <Tooltip content={TOOLTIPS.order_types?.description ?? "Order Types"} configKey="order_types"><SubsectionTitle icon={"\uD83D\uDCDD"}>Order Types</SubsectionTitle></Tooltip>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.entry?.description ?? "Entry"} configKey="entry"><FormLabel>Entry</FormLabel></Tooltip>
          <FormSelect value={config.order_types_entry} onChange={(v) => update("order_types_entry", v)} options={[{ value: "limit", label: "limit" }, { value: "market", label: "market" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.exit?.description ?? "Exit"} configKey="exit"><FormLabel>Exit</FormLabel></Tooltip>
          <FormSelect value={config.order_types_exit} onChange={(v) => update("order_types_exit", v)} options={[{ value: "limit", label: "limit" }, { value: "market", label: "market" }]} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.emergency_exit?.description ?? "Emergency Exit"} configKey="emergency_exit"><FormLabel>Emergency Exit</FormLabel></Tooltip>
          <FormSelect value={config.order_types_emergency_exit} onChange={(v) => update("order_types_emergency_exit", v)} options={[{ value: "limit", label: "limit" }, { value: "market", label: "market" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.force_exit?.description ?? "Force Exit"} configKey="force_exit"><FormLabel>Force Exit</FormLabel></Tooltip>
          <FormSelect value={config.order_types_force_exit} onChange={(v) => update("order_types_force_exit", v)} options={[{ value: "limit", label: "limit" }, { value: "market", label: "market" }]} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.force_entry?.description ?? "Force Entry"} configKey="force_entry"><FormLabel>Force Entry</FormLabel></Tooltip>
          <FormSelect value={config.order_types_force_entry} onChange={(v) => update("order_types_force_entry", v)} options={[{ value: "limit", label: "limit" }, { value: "market", label: "market" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.stoploss?.description ?? "Stoploss"} configKey="stoploss"><FormLabel>Stoploss</FormLabel></Tooltip>
          <FormSelect value={config.order_types_stoploss} onChange={(v) => update("order_types_stoploss", v)} options={[{ value: "limit", label: "limit" }, { value: "market", label: "market" }]} />
        </div>
      </div>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.stoploss_on_exchange?.description ?? "Place stoploss order on the exchange"} configKey="stoploss_on_exchange"><ToggleRow name="stoploss_on_exchange" desc="Place stoploss order on the exchange" on={config.stoploss_on_exchange} onToggle={() => toggleBool("stoploss_on_exchange")} /></Tooltip>
        </CardBody>
      </Card>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.stoploss_on_exchange_interval?.description ?? "Stoploss on Exchange Interval"} configKey="stoploss_on_exchange_interval"><FormLabel>Stoploss on Exchange Interval</FormLabel></Tooltip>
          <FormInput type="number" value={config.stoploss_on_exchange_interval} onChange={(v) => update("stoploss_on_exchange_interval", Number(v))} className="max-w-[200px]" />
          <FormHint>Seconds between stoploss order updates</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.stoploss_on_exchange_limit_ratio?.description ?? "Stoploss on Exchange Limit Ratio"} configKey="stoploss_on_exchange_limit_ratio"><FormLabel>Stoploss on Exchange Limit Ratio</FormLabel></Tooltip>
          <FormInput type="number" value={config.stoploss_on_exchange_limit_ratio} onChange={(v) => update("stoploss_on_exchange_limit_ratio", Number(v))} step="0.01" className="max-w-[200px]" />
        </div>
      </div>

      <FormDivider />

      {/* Order Time in Force */}
      <Tooltip content={TOOLTIPS.order_time_in_force?.description ?? "Order Time in Force"} configKey="order_time_in_force"><SubsectionTitle icon={"\u23F1\uFE0F"}>Order Time in Force</SubsectionTitle></Tooltip>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.entry?.description ?? "Entry"} configKey="entry"><FormLabel>Entry</FormLabel></Tooltip>
          <FormSelect value={config.order_time_in_force_entry} onChange={(v) => update("order_time_in_force_entry", v)} options={[{ value: "GTC", label: "GTC" }, { value: "FOK", label: "FOK" }, { value: "IOC", label: "IOC" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.exit?.description ?? "Exit"} configKey="exit"><FormLabel>Exit</FormLabel></Tooltip>
          <FormSelect value={config.order_time_in_force_exit} onChange={(v) => update("order_time_in_force_exit", v)} options={[{ value: "GTC", label: "GTC" }, { value: "FOK", label: "FOK" }, { value: "IOC", label: "IOC" }]} />
        </div>
      </div>

      <FormDivider />

      {/* Unfilled Timeout */}
      <Tooltip content={TOOLTIPS.unfilledtimeout?.description ?? "Unfilled Timeout"} configKey="unfilledtimeout"><SubsectionTitle icon={"\u23F3"}>Unfilled Timeout</SubsectionTitle></Tooltip>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.entry?.description ?? "Entry Timeout"} configKey="entry"><FormLabel>Entry Timeout</FormLabel></Tooltip>
          <FormInput type="number" value={config.unfilledtimeout_entry} onChange={(v) => update("unfilledtimeout_entry", Number(v))} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.exit?.description ?? "Exit Timeout"} configKey="exit"><FormLabel>Exit Timeout</FormLabel></Tooltip>
          <FormInput type="number" value={config.unfilledtimeout_exit} onChange={(v) => update("unfilledtimeout_exit", Number(v))} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.unit?.description ?? "Unit"} configKey="unit"><FormLabel>Unit</FormLabel></Tooltip>
          <FormSelect value={config.unfilledtimeout_unit} onChange={(v) => update("unfilledtimeout_unit", v)} options={[{ value: "minutes", label: "minutes" }, { value: "seconds", label: "seconds" }]} />
        </div>
      </div>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.exit_timeout_count?.description ?? "Exit Timeout Count"} configKey="exit_timeout_count"><FormLabel>Exit Timeout Count</FormLabel></Tooltip>
        <FormInput type="number" value={config.exit_timeout_count} onChange={(v) => update("exit_timeout_count", Number(v))} className="max-w-[200px]" />
        <FormHint>0 = cancel and re-enter, &gt;0 = force exit after N timeouts</FormHint>
      </div>

      <FormDivider />

      {/* Entry Pricing */}
      <Tooltip content={TOOLTIPS.entry_pricing?.description ?? "Entry Pricing"} configKey="entry_pricing"><SubsectionTitle icon={"\uD83D\uDCB2"}>Entry Pricing</SubsectionTitle></Tooltip>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.price_side?.description ?? "Price Side"} configKey="price_side"><FormLabel>Price Side</FormLabel></Tooltip>
          <FormSelect value={config.entry_pricing_price_side} onChange={(v) => update("entry_pricing_price_side", v)} options={[{ value: "same", label: "same" }, { value: "other", label: "other" }, { value: "bid", label: "bid" }, { value: "ask", label: "ask" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.use_order_book?.description ?? "Use Order Book"} configKey="use_order_book"><FormLabel>Use Order Book</FormLabel></Tooltip>
          <FormSelect value={config.entry_pricing_use_order_book} onChange={(v) => update("entry_pricing_use_order_book", v)} options={[{ value: "true", label: "true" }, { value: "false", label: "false" }]} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.order_book_top?.description ?? "Order Book Top"} configKey="order_book_top"><FormLabel>Order Book Top</FormLabel></Tooltip>
          <FormInput type="number" value={config.entry_pricing_order_book_top} onChange={(v) => update("entry_pricing_order_book_top", Number(v))} min="1" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.price_last_balance?.description ?? "Price Last Balance"} configKey="price_last_balance"><FormLabel>Price Last Balance</FormLabel></Tooltip>
          <FormInput type="number" value={config.entry_pricing_price_last_balance} onChange={(v) => update("entry_pricing_price_last_balance", Number(v))} step="0.1" min="0" max="1" />
        </div>
      </div>

      {/* Exit Pricing */}
      <Tooltip content={TOOLTIPS.exit_pricing?.description ?? "Exit Pricing"} configKey="exit_pricing"><SubsectionTitle icon={"\uD83D\uDCB2"}>Exit Pricing</SubsectionTitle></Tooltip>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.price_side?.description ?? "Price Side"} configKey="price_side"><FormLabel>Price Side</FormLabel></Tooltip>
          <FormSelect value={config.exit_pricing_price_side} onChange={(v) => update("exit_pricing_price_side", v)} options={[{ value: "same", label: "same" }, { value: "other", label: "other" }, { value: "bid", label: "bid" }, { value: "ask", label: "ask" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.use_order_book?.description ?? "Use Order Book"} configKey="use_order_book"><FormLabel>Use Order Book</FormLabel></Tooltip>
          <FormSelect value={config.exit_pricing_use_order_book} onChange={(v) => update("exit_pricing_use_order_book", v)} options={[{ value: "true", label: "true" }, { value: "false", label: "false" }]} />
        </div>
      </div>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.order_book_top?.description ?? "Order Book Top"} configKey="order_book_top"><FormLabel>Order Book Top</FormLabel></Tooltip>
        <FormInput type="number" value={config.exit_pricing_order_book_top} onChange={(v) => update("exit_pricing_order_book_top", Number(v))} min="1" className="max-w-[200px]" />
      </div>

      <FormDivider />

      {/* Position Adjustment */}
      <SubsectionTitle icon={"\uD83D\uDD04"}>Position Adjustment</SubsectionTitle>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.position_adjustment_enable?.description ?? "Allow adjusting position size via adjust_trade_position callback"} configKey="position_adjustment_enable"><ToggleRow name="position_adjustment_enable" desc="Allow adjusting position size via adjust_trade_position callback" on={config.position_adjustment_enable} onToggle={() => toggleBool("position_adjustment_enable")} /></Tooltip>
        </CardBody>
      </Card>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.max_entry_position_adjustment?.description ?? "Max Entry Position Adjustment"} configKey="max_entry_position_adjustment"><FormLabel>Max Entry Position Adjustment</FormLabel></Tooltip>
        <FormInput type="number" value={config.max_entry_position_adjustment} onChange={(v) => update("max_entry_position_adjustment", Number(v))} className="max-w-[200px]" />
        <FormHint>-1 = unlimited additional entries</FormHint>
      </div>

      <FormDivider />

      {/* Trading Mode */}
      <SubsectionTitle icon={"\uD83D\uDE80"}>Trading Mode</SubsectionTitle>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.trading_mode?.description ?? "Trading Mode"} configKey="trading_mode"><FormLabel>Trading Mode</FormLabel></Tooltip>
          <FormSelect value={config.trading_mode} onChange={(v) => update("trading_mode", v)} options={[{ value: "spot", label: "spot" }, { value: "futures", label: "futures" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.margin_mode?.description ?? "Margin Mode"} configKey="margin_mode"><FormLabel>Margin Mode</FormLabel></Tooltip>
          <FormSelect value={config.margin_mode} onChange={(v) => update("margin_mode", v)} options={[{ value: "isolated", label: "isolated" }, { value: "cross", label: "cross" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.liquidation_buffer?.description ?? "Liquidation Buffer"} configKey="liquidation_buffer"><FormLabel>Liquidation Buffer</FormLabel></Tooltip>
          <FormInput type="number" value={config.liquidation_buffer} onChange={(v) => update("liquidation_buffer", Number(v))} step="0.01" min="0" max="0.99" />
          <FormHint>Stoploss before liquidation (0.05 = 5%)</FormHint>
        </div>
      </div>

      <FormDivider />

      {/* Advanced Core Params */}
      <SubsectionTitle icon={"\uD83D\uDD27"}>Advanced Core Parameters</SubsectionTitle>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.amend_last_stake_amount?.description ?? "Use remaining balance if insufficient for full stake"} configKey="amend_last_stake_amount"><ToggleRow name="amend_last_stake_amount" desc="Use remaining balance if insufficient for full stake" on={config.amend_last_stake_amount} onToggle={() => toggleBool("amend_last_stake_amount")} /></Tooltip>
        </CardBody>
      </Card>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.last_stake_amount_min_ratio?.description ?? "Last Stake Amount Min Ratio"} configKey="last_stake_amount_min_ratio"><FormLabel>Last Stake Amount Min Ratio</FormLabel></Tooltip>
          <FormInput type="number" value={config.last_stake_amount_min_ratio} onChange={(v) => update("last_stake_amount_min_ratio", Number(v))} step="0.01" min="0" max="1" />
          <FormHint>Min ratio of stake_amount for amended orders</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.amount_reserve_percent?.description ?? "Amount Reserve Percent"} configKey="amount_reserve_percent"><FormLabel>Amount Reserve Percent</FormLabel></Tooltip>
          <FormInput type="number" value={config.amount_reserve_percent} onChange={(v) => update("amount_reserve_percent", Number(v))} step="0.01" min="0" max="0.5" />
          <FormHint>Reserve to account for fees (0.05 = 5%)</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.custom_price_max_distance_ratio?.description ?? "Custom Price Max Distance Ratio"} configKey="custom_price_max_distance_ratio"><FormLabel>Custom Price Max Distance Ratio</FormLabel></Tooltip>
          <FormInput type="number" value={config.custom_price_max_distance_ratio} onChange={(v) => update("custom_price_max_distance_ratio", Number(v))} step="0.001" />
          <FormHint>Max deviation from current price for custom pricing</FormHint>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.ignore_buying_expired_candle_after?.description ?? "Ignore Buying Expired Candle After"} configKey="ignore_buying_expired_candle_after"><FormLabel>Ignore Buying Expired Candle After</FormLabel></Tooltip>
          <FormInput type="number" value={config.ignore_buying_expired_candle_after} onChange={(v) => update("ignore_buying_expired_candle_after", Number(v))} />
          <FormHint>Seconds. 0 = disabled</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.futures_funding_rate?.description ?? "Futures Funding Rate"} configKey="futures_funding_rate"><FormLabel>Futures Funding Rate</FormLabel></Tooltip>
          <FormInput type="number" value={config.futures_funding_rate} onChange={(v) => update("futures_funding_rate", Number(v))} step="0.0001" />
          <FormHint>Override funding rate (0 = use exchange)</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.process_throttle_secs?.description ?? "Process Throttle Secs"} configKey="process_throttle_secs"><FormLabel>Process Throttle Secs</FormLabel></Tooltip>
          <FormInput type="number" value={config.process_throttle_secs} onChange={(v) => update("process_throttle_secs", Number(v))} />
          <FormHint>Min seconds between bot loops</FormHint>
        </div>
      </div>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.heartbeat_interval?.description ?? "Heartbeat Interval"} configKey="heartbeat_interval"><FormLabel>Heartbeat Interval</FormLabel></Tooltip>
        <FormInput type="number" value={config.heartbeat_interval} onChange={(v) => update("heartbeat_interval", Number(v))} className="max-w-[200px]" />
        <FormHint>Seconds between heartbeat log messages (0 = disabled)</FormHint>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* TAB CONTENT: Pairlists (Section 7)         */
/* ─────────────────────────────────────────── */
function PairlistsTab({ config, update, botId }: TabProps) {
  const toast = useToast();
  const [testingPairlist, setTestingPairlist] = useState(false);
  const filters = config.pairlist_filters;

  const toggleFilter = (i: number) => {
    const next = [...filters];
    next[i] = { ...next[i], enabled: !next[i].enabled };
    update("pairlist_filters", next);
  };

  const toggleFilterOpen = (i: number) => {
    const next = [...filters];
    next[i] = { ...next[i], open: !next[i].open };
    update("pairlist_filters", next);
  };

  const updateFilterParam = (i: number, param: keyof PairlistFilterParams, value: PairlistFilterParams[typeof param]) => {
    const next = [...filters];
    next[i] = { ...next[i], params: { ...next[i].params, [param]: value } };
    update("pairlist_filters", next);
  };

  return (
    <div>
      <SectionTitle>Pairlist Configuration</SectionTitle>
      <SectionDesc>Configure pairlist handlers and filters -- Section 7 Plugins & Protections (pairlists section)</SectionDesc>

      <SubsectionTitle icon={"\uD83D\uDCCB"}>Primary Handler</SubsectionTitle>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.pairlist_handler?.description ?? "Handler"} configKey="pairlists[0].method"><FormLabel>Handler</FormLabel></Tooltip>
          <FormSelect
            value={config.pairlist_handler}
            onChange={(v) => update("pairlist_handler", v)}
            options={[
              { value: "StaticPairList", label: "StaticPairList" },
              { value: "VolumePairList", label: "VolumePairList" },
              { value: "PercentChangePairList", label: "PercentChangePairList" },
              { value: "ProducerPairList", label: "ProducerPairList" },
              { value: "RemotePairList", label: "RemotePairList" },
              { value: "MarketCapPairList", label: "MarketCapPairList" },
            ]}
          />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.number_assets?.description ?? "Number of Assets"} configKey="number_assets"><FormLabel>Number of Assets</FormLabel></Tooltip>
          <FormInput type="number" value={config.pairlist_number_assets} onChange={(v) => update("pairlist_number_assets", Number(v))} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.sort_key?.description ?? "Sort Key"} configKey="sort_key"><FormLabel>Sort Key</FormLabel></Tooltip>
          <FormSelect value={config.pairlist_sort_key} onChange={(v) => update("pairlist_sort_key", v)} options={[{ value: "quoteVolume", label: "quoteVolume" }, { value: "baseVolume", label: "baseVolume" }]} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.min_value?.description ?? "Min Value"} configKey="min_value"><FormLabel>Min Value</FormLabel></Tooltip>
          <FormInput type="number" value={config.pairlist_min_value} onChange={(v) => update("pairlist_min_value", Number(v))} />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.refresh_period?.description ?? "Refresh Period"} configKey="refresh_period"><FormLabel>Refresh Period</FormLabel></Tooltip>
          <FormInput type="number" value={config.pairlist_refresh_period} onChange={(v) => update("pairlist_refresh_period", Number(v))} />
          <FormHint>Seconds</FormHint>
        </div>
      </div>

      <FormDivider />

      {/* Filter Stack */}
      <SubsectionTitle icon={"\uD83D\uDD0D"}>Filter Stack <span className="text-xs text-muted-foreground font-normal">Drag to reorder</span></SubsectionTitle>

      {filters.map((f, i) => (
        <div key={f.name} className="bg-card border border-border rounded-btn mb-2 overflow-hidden">
          <div
            className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-white/[.01]"
            onClick={() => toggleFilterOpen(i)}
          >
            <Toggle on={f.enabled} onToggle={() => { toggleFilter(i); }} />
            <span className="text-xs font-semibold text-foreground flex-1">{f.name}</span>
            <span className="text-muted-foreground text-sm cursor-grab">{"\u2630"}</span>
          </div>
          {f.open && (
            <div className="px-3.5 pb-3 pt-2 border-t border-border/40">
              {f.name === "AgeFilter" && (
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Tooltip content={TOOLTIPS.min_days_listed?.description ?? "Min Days Listed"} configKey="min_days_listed"><FormLabel>Min Days Listed</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.min_days_listed} onChange={(v) => updateFilterParam(i, "min_days_listed", Number(v))} />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.max_days_listed?.description ?? "Max Days Listed"} configKey="max_days_listed"><FormLabel>Max Days Listed</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.max_days_listed} onChange={(v) => updateFilterParam(i, "max_days_listed", v)} placeholder="" />
                    <FormHint>Leave empty for no max</FormHint>
                  </div>
                </div>
              )}
              {f.name === "DelistFilter" && (
                <div>
                  <Tooltip content={TOOLTIPS.min_days_until_removed?.description ?? "Days Until Delist"} configKey="min_days_until_removed"><FormLabel>Days Until Delist</FormLabel></Tooltip>
                  <FormInput type="number" value={f.params.min_days_until_removed} onChange={(v) => updateFilterParam(i, "min_days_until_removed", Number(v))} />
                </div>
              )}
              {f.name === "SpreadFilter" && (
                <div>
                  <Tooltip content={TOOLTIPS.max_spread_ratio?.description ?? "Max Spread Ratio"} configKey="max_spread_ratio"><FormLabel>Max Spread Ratio</FormLabel></Tooltip>
                  <FormInput type="number" value={f.params.max_spread_ratio} onChange={(v) => updateFilterParam(i, "max_spread_ratio", Number(v))} step="0.001" />
                  <FormHint>0.005 = 0.5% max spread</FormHint>
                </div>
              )}
              {f.name === "PriceFilter" && (
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <Tooltip content={TOOLTIPS.low_price_ratio?.description ?? "Low Price Ratio"} configKey="low_price_ratio"><FormLabel>Low Price Ratio</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.low_price_ratio} onChange={(v) => updateFilterParam(i, "low_price_ratio", Number(v))} step="0.001" />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.min_price?.description ?? "Min Price"} configKey="min_price"><FormLabel>Min Price</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.min_price} onChange={(v) => updateFilterParam(i, "min_price", Number(v))} step="0.00000001" />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.max_price?.description ?? "Max Price"} configKey="max_price"><FormLabel>Max Price</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.max_price} onChange={(v) => updateFilterParam(i, "max_price", Number(v))} />
                    <FormHint>0 = disabled</FormHint>
                  </div>
                </div>
              )}
              {f.name === "RangeStabilityFilter" && (
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <Tooltip content={TOOLTIPS.min_rate_of_change?.description ?? "Min Rate of Change"} configKey="min_rate_of_change"><FormLabel>Min Rate of Change</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.min_rate_of_change} onChange={(v) => updateFilterParam(i, "min_rate_of_change", Number(v))} step="0.01" />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.max_rate_of_change?.description ?? "Max Rate of Change"} configKey="max_rate_of_change"><FormLabel>Max Rate of Change</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.max_rate_of_change} onChange={(v) => updateFilterParam(i, "max_rate_of_change", Number(v))} />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.lookback_days?.description ?? "Lookback Days"} configKey="lookback_days"><FormLabel>Lookback Days</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.lookback_days} onChange={(v) => updateFilterParam(i, "lookback_days", Number(v))} />
                  </div>
                </div>
              )}
              {f.name === "VolatilityFilter" && (
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <Tooltip content={TOOLTIPS.min_volatility?.description ?? "Min Volatility"} configKey="min_volatility"><FormLabel>Min Volatility</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.min_volatility} onChange={(v) => updateFilterParam(i, "min_volatility", Number(v))} step="0.01" />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.max_volatility?.description ?? "Max Volatility"} configKey="max_volatility"><FormLabel>Max Volatility</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.max_volatility} onChange={(v) => updateFilterParam(i, "max_volatility", Number(v))} step="0.01" />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.lookback_days?.description ?? "Lookback Days"} configKey="lookback_days"><FormLabel>Lookback Days</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.lookback_days} onChange={(v) => updateFilterParam(i, "lookback_days", Number(v))} />
                  </div>
                </div>
              )}
              {f.name === "OffsetFilter" && (
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Tooltip content={TOOLTIPS.offset?.description ?? "Offset"} configKey="offset"><FormLabel>Offset</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.offset} onChange={(v) => updateFilterParam(i, "offset", Number(v))} />
                  </div>
                  <div>
                    <Tooltip content={TOOLTIPS.number_assets?.description ?? "Number Assets"} configKey="number_assets"><FormLabel>Number Assets</FormLabel></Tooltip>
                    <FormInput type="number" value={f.params.number_assets} onChange={(v) => updateFilterParam(i, "number_assets", Number(v))} />
                    <FormHint>0 = no limit</FormHint>
                  </div>
                </div>
              )}
              {f.name === "PerformanceFilter" && (
                <div>
                  <Tooltip content={TOOLTIPS.trade_back_seconds?.description ?? "Trade Count Weight"} configKey="trade_back_seconds"><FormLabel>Trade Count Weight</FormLabel></Tooltip>
                  <FormInput type="number" value={f.params.trade_back_seconds} onChange={(v) => updateFilterParam(i, "trade_back_seconds", Number(v))} />
                  <FormHint>Seconds to look back. 0 = all trades</FormHint>
                </div>
              )}
              {f.name === "FullTradesFilter" && (
                <FormHint>Removes pairs that have max_open_trades open positions. No parameters.</FormHint>
              )}
              {f.name === "PrecisionFilter" && (
                <FormHint>Filters pairs where stoploss would be impossible due to price precision. No parameters.</FormHint>
              )}
              {f.name === "ShuffleFilter" && (
                <div>
                  <Tooltip content={TOOLTIPS.seed?.description ?? "Seed"} configKey="seed"><FormLabel>Seed</FormLabel></Tooltip>
                  <FormInput type="number" value={f.params.seed} onChange={(v) => updateFilterParam(i, "seed", v)} placeholder="" />
                  <FormHint>Leave empty for random, set for reproducible</FormHint>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="mt-4">
        <button
          type="button"
          disabled={!botId || testingPairlist}
          onClick={async () => {
            if (!botId) { toast.warning("Select a bot first."); return; }
            setTestingPairlist(true);
            try {
              const result = await botWhitelist(botId);
              const pairs = result.whitelist || [];
              toast.success(`Pairlist returned ${pairs.length} pairs: ${pairs.slice(0, 10).join(", ")}${pairs.length > 10 ? "..." : ""}`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Test pairlist failed.");
            } finally {
              setTestingPairlist(false);
            }
          }}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-btn text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 hover:bg-green/[.18] transition-colors cursor-pointer mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testingPairlist ? "Testing..." : "Test Pairlist"}
        </button>
        <span className="text-xs text-muted-foreground">Runs <code className="text-cyan">freqtrade test-pairlist</code> and shows results</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* TAB CONTENT: Exchange (Section 9)          */
/* ─────────────────────────────────────────── */
function ExchangeTab({ config, update }: TabProps) {
  return (
    <div>
      <SectionTitle>Exchange Configuration</SectionTitle>
      <SectionDesc>Exchange connection and credentials -- Section 9 Exchanges</SectionDesc>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.exchange_name?.description ?? "Exchange"} configKey="exchange.name"><FormLabel>Exchange</FormLabel></Tooltip>
          <FormSelect
            value={config.exchange_name}
            onChange={(v) => update("exchange_name", v)}
            options={[
              { value: "binance", label: "Binance (Spot + Futures)" },
              { value: "bybit", label: "Bybit (Spot + Futures)" },
              { value: "gate", label: "Gate.io (Spot + Futures)" },
              { value: "hyperliquid", label: "Hyperliquid (Futures)" },
              { value: "bitget", label: "Bitget (Spot + Futures)" },
              { value: "okx", label: "OKX (Spot + Futures)" },
              { value: "kraken", label: "Kraken (Spot + Futures)" },
            ]}
          />
        </div>
        <div />
      </div>

      <FormDivider />

      <SubsectionTitle icon={"\uD83D\uDD11"}>API Credentials</SubsectionTitle>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.exchange_key?.description ?? "API Key"} configKey="exchange.key"><FormLabel>API Key</FormLabel></Tooltip>
          <FormInput type="password" value={config.exchange_key} onChange={(v) => update("exchange_key", v)} placeholder="Enter API key" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.exchange_secret?.description ?? "API Secret"} configKey="exchange.secret"><FormLabel>API Secret</FormLabel></Tooltip>
          <FormInput type="password" value={config.exchange_secret} onChange={(v) => update("exchange_secret", v)} placeholder="Enter API secret" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.exchange_password?.description ?? "Password"} configKey="exchange.password"><FormLabel>Password</FormLabel></Tooltip>
          <FormInput type="password" value={config.exchange_password} onChange={(v) => update("exchange_password", v)} placeholder="Exchange passphrase (if required)" />
          <FormHint>Required for some exchanges (e.g., OKX)</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.exchange_uid?.description ?? "UID"} configKey="exchange.uid"><FormLabel>UID</FormLabel></Tooltip>
          <FormInput value={config.exchange_uid} onChange={(v) => update("exchange_uid", v)} placeholder="User ID (if required)" />
        </div>
      </div>

      <FormDivider />

      <Tooltip content={TOOLTIPS.exchange_pair_whitelist?.description ?? "Pair Whitelist"} configKey="exchange.pair_whitelist"><SubsectionTitle icon={"\uD83D\uDCDD"}>Pair Whitelist</SubsectionTitle></Tooltip>
      <TagEditor
        tags={config.pair_whitelist}
        onAdd={(tag) => update("pair_whitelist", [...config.pair_whitelist, tag])}
        onRemove={(i) => update("pair_whitelist", config.pair_whitelist.filter((_, j) => j !== i))}
        placeholder="Add pair..."
      />
      <FormHint>Use exchange pair format. For futures: PAIR:SETTLE (e.g. BTC/USDT:USDT)</FormHint>
      <div className="mb-5" />

      <Tooltip content={TOOLTIPS.exchange_pair_blacklist?.description ?? "Pair Blacklist"} configKey="exchange.pair_blacklist"><SubsectionTitle icon={"\uD83D\uDEAB"}>Pair Blacklist</SubsectionTitle></Tooltip>
      <TagEditor
        tags={config.pair_blacklist}
        onAdd={(tag) => update("pair_blacklist", [...config.pair_blacklist, tag])}
        onRemove={(i) => update("pair_blacklist", config.pair_blacklist.filter((_, j) => j !== i))}
        placeholder="Add pair or regex..."
      />
      <FormHint>Supports regex patterns</FormHint>
      <div className="mb-5" />

      <FormDivider />

      <SubsectionTitle icon={"\uD83D\uDD27"}>Advanced Exchange Settings</SubsectionTitle>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.enable_ws?.description ?? "Enable WebSocket for real-time data (exchange.enable_ws)"} configKey="enable_ws"><ToggleRow name="enable_ws" desc="Enable WebSocket for real-time data" on={config.enable_ws} onToggle={() => update("enable_ws", !config.enable_ws)} /></Tooltip>
          <Tooltip content={TOOLTIPS.skip_open_order_update?.description ?? "Skip updating open orders on startup (exchange.skip_open_order_update)"} configKey="skip_open_order_update"><ToggleRow name="skip_open_order_update" desc="Skip updating open orders on startup" on={config.skip_open_order_update} onToggle={() => update("skip_open_order_update", !config.skip_open_order_update)} /></Tooltip>
          <Tooltip content={TOOLTIPS.log_responses?.description ?? "Log raw exchange API responses for debugging (exchange.log_responses)"} configKey="log_responses"><ToggleRow name="log_responses" desc="Log raw exchange API responses for debugging" on={config.log_responses} onToggle={() => update("log_responses", !config.log_responses)} /></Tooltip>
          <Tooltip content={TOOLTIPS.only_from_ccxt?.description ?? "Only use fee rates from ccxt, not from trades (exchange.only_from_ccxt)"} configKey="only_from_ccxt"><ToggleRow name="only_from_ccxt" desc="Only use fee rates from ccxt, not from trades" on={config.only_from_ccxt} onToggle={() => update("only_from_ccxt", !config.only_from_ccxt)} /></Tooltip>
        </CardBody>
      </Card>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.exchange_markets_refresh_interval?.description ?? "Markets Refresh Interval"} configKey="exchange.markets_refresh_interval"><FormLabel>Markets Refresh Interval</FormLabel></Tooltip>
        <FormInput type="number" value={config.markets_refresh_interval} onChange={(v) => update("markets_refresh_interval", Number(v))} className="max-w-[200px]" />
        <FormHint>Minutes between market data refresh</FormHint>
      </div>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.exchange_unknown_fee_rate?.description ?? "Unknown Fee Rate"} configKey="exchange.unknown_fee_rate"><FormLabel>Unknown Fee Rate</FormLabel></Tooltip>
        <FormInput type="number" value={config.unknown_fee_rate} onChange={(v) => update("unknown_fee_rate", Number(v))} step="0.0001" className="max-w-[200px]" />
        <FormHint>Fallback fee rate when exchange does not report it (0 = disabled)</FormHint>
      </div>

      <div className="mt-5">
        <Tooltip content={TOOLTIPS.exchange_ccxt_config?.description ?? "CCXT Config (Advanced)"} configKey="exchange.ccxt_config"><FormLabel>CCXT Config (Advanced)</FormLabel></Tooltip>
        <textarea
          spellCheck={false}
          value={config.ccxt_config}
          onChange={(e) => update("ccxt_config", e.target.value)}
          className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[120px] resize-y outline-none focus:border-primary"
        />
        <FormHint>Raw ccxt configuration object in JSON. Applied to exchange connection.</FormHint>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* TAB CONTENT: Telegram (Section 11)         */
/* ─────────────────────────────────────────── */
function TelegramTab({ config, update }: TabProps) {
  return (
    <div>
      <SectionTitle>Telegram Configuration</SectionTitle>
      <SectionDesc>Bot notifications via Telegram -- Section 11 Telegram Commands</SectionDesc>

      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.telegram_enabled?.description ?? "Enable Telegram bot notifications"} configKey="telegram.enabled"><ToggleRow name="telegram.enabled" desc="Enable Telegram bot notifications" on={config.telegram_enabled} onToggle={() => update("telegram_enabled", !config.telegram_enabled)} /></Tooltip>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.telegram_token?.description ?? "Bot Token"} configKey="telegram.token"><FormLabel>Bot Token</FormLabel></Tooltip>
          <FormInput type="password" value={config.telegram_token} onChange={(v) => update("telegram_token", v)} placeholder="Enter Telegram bot token" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.telegram_chat_id?.description ?? "Chat ID"} configKey="telegram.chat_id"><FormLabel>Chat ID</FormLabel></Tooltip>
          <FormInput value={config.telegram_chat_id} onChange={(v) => update("telegram_chat_id", v)} placeholder="Enter chat ID" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.telegram_topic_id?.description ?? "Topic ID"} configKey="telegram.topic_id"><FormLabel>Topic ID</FormLabel></Tooltip>
          <FormInput value={config.telegram_topic_id} onChange={(v) => update("telegram_topic_id", v)} placeholder="Forum topic ID (optional)" />
          <FormHint>For Telegram forum/topic groups</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.telegram_balance_dust_level?.description ?? "Balance Dust Level"} configKey="telegram.balance_dust_level"><FormLabel>Balance Dust Level</FormLabel></Tooltip>
          <FormInput type="number" value={config.telegram_balance_dust_level} onChange={(v) => update("telegram_balance_dust_level", Number(v))} step="0.01" />
          <FormHint>Ignore balances below this value in /balance</FormHint>
        </div>
      </div>

      <Tooltip content={TOOLTIPS.telegram_authorized_users?.description ?? "Authorized Users"} configKey="telegram.authorized_users"><SubsectionTitle icon={"\uD83D\uDC65"}>Authorized Users</SubsectionTitle></Tooltip>
      <TagEditor
        tags={config.telegram_authorized_users}
        onAdd={(tag) => update("telegram_authorized_users", [...config.telegram_authorized_users, tag])}
        onRemove={(i) => update("telegram_authorized_users", config.telegram_authorized_users.filter((_, j) => j !== i))}
        placeholder="Add user ID..."
      />
      <FormHint>Comma-separated Telegram user IDs allowed to control this bot</FormHint>
      <div className="mb-5" />

      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.telegram_reload?.description ?? "Allow /reload_config command via Telegram"} configKey="telegram.reload"><ToggleRow name="telegram.reload" desc="Allow /reload_config command via Telegram" on={config.telegram_reload} onToggle={() => update("telegram_reload", !config.telegram_reload)} /></Tooltip>
        </CardBody>
      </Card>

      <FormDivider />

      <Tooltip content={TOOLTIPS.telegram_notification_settings?.description ?? "Notification Settings"} configKey="telegram.notification_settings"><SubsectionTitle icon={"\uD83D\uDD14"}>Notification Settings</SubsectionTitle></Tooltip>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.entry?.description ?? "Notify on trade entry"} configKey="entry"><ToggleRow name="entry" desc="Notify on trade entry" on={config.telegram_notification_entry} onToggle={() => update("telegram_notification_entry", !config.telegram_notification_entry)} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit?.description ?? "Notify on trade exit"} configKey="exit"><ToggleRow name="exit" desc="Notify on trade exit" on={config.telegram_notification_exit} onToggle={() => update("telegram_notification_exit", !config.telegram_notification_exit)} /></Tooltip>
          <Tooltip content={TOOLTIPS.entry_cancel?.description ?? "Notify when entry order is cancelled"} configKey="entry_cancel"><ToggleRow name="entry_cancel" desc="Notify when entry order is cancelled" on={config.telegram_notification_entry_cancel} onToggle={() => update("telegram_notification_entry_cancel", !config.telegram_notification_entry_cancel)} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit_cancel?.description ?? "Notify when exit order is cancelled"} configKey="exit_cancel"><ToggleRow name="exit_cancel" desc="Notify when exit order is cancelled" on={config.telegram_notification_exit_cancel} onToggle={() => update("telegram_notification_exit_cancel", !config.telegram_notification_exit_cancel)} /></Tooltip>
          <Tooltip content={TOOLTIPS.entry_fill?.description ?? "Notify when entry order is filled"} configKey="entry_fill"><ToggleRow name="entry_fill" desc="Notify when entry order is filled" on={config.telegram_notification_entry_fill} onToggle={() => update("telegram_notification_entry_fill", !config.telegram_notification_entry_fill)} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit_fill?.description ?? "Notify when exit order is filled"} configKey="exit_fill"><ToggleRow name="exit_fill" desc="Notify when exit order is filled" on={config.telegram_notification_exit_fill} onToggle={() => update("telegram_notification_exit_fill", !config.telegram_notification_exit_fill)} /></Tooltip>
          <Tooltip content={TOOLTIPS.status?.description ?? "Periodic status updates"} configKey="status"><ToggleRow name="status" desc="Periodic status updates" on={config.telegram_notification_status} onToggle={() => update("telegram_notification_status", !config.telegram_notification_status)} /></Tooltip>
        </CardBody>
      </Card>

      <FormDivider />

      <Tooltip content={TOOLTIPS.telegram_notification_show_candle?.description ?? "Show Candle"} configKey="notification_settings.show_candle"><SubsectionTitle icon={"\uD83D\uDCCA"}>Show Candle</SubsectionTitle></Tooltip>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.telegram_notification_show_candle?.description ?? "Candle Display in Notifications"} configKey="show_candle"><FormLabel>Candle Display in Notifications</FormLabel></Tooltip>
        <FormSelect
          value={config.telegram_notification_show_candle}
          onChange={(v) => update("telegram_notification_show_candle", v)}
          options={[
            { value: "off", label: "off" },
            { value: "ohlc", label: "ohlc" },
            { value: "close", label: "close" },
          ]}
        />
        <FormHint>Show candle info in entry/exit messages</FormHint>
      </div>

      <FormDivider />

      <Tooltip content={TOOLTIPS.telegram_notification_exit_reasons?.description ?? "Per-Exit-Reason Notifications"} configKey="notification_settings.exit_*"><SubsectionTitle icon={"\uD83D\uDEAA"}>Per-Exit-Reason Notifications</SubsectionTitle></Tooltip>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.exit_stoploss?.description ?? "Notify on exit due to stoploss"} configKey="exit_stoploss"><ToggleRow name="exit_stoploss" desc="Notify on exit due to stoploss" on={config.telegram_notification_exit_stoploss} onToggle={() => update("telegram_notification_exit_stoploss", !config.telegram_notification_exit_stoploss)} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit_roi?.description ?? "Notify on exit due to ROI"} configKey="exit_roi"><ToggleRow name="exit_roi" desc="Notify on exit due to ROI" on={config.telegram_notification_exit_roi} onToggle={() => update("telegram_notification_exit_roi", !config.telegram_notification_exit_roi)} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit_exit_signal?.description ?? "Notify on exit due to exit signal"} configKey="exit_exit_signal"><ToggleRow name="exit_exit_signal" desc="Notify on exit due to exit signal" on={config.telegram_notification_exit_exit_signal} onToggle={() => update("telegram_notification_exit_exit_signal", !config.telegram_notification_exit_exit_signal)} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit_force_exit?.description ?? "Notify on force exit"} configKey="exit_force_exit"><ToggleRow name="exit_force_exit" desc="Notify on force exit" on={config.telegram_notification_exit_force_exit} onToggle={() => update("telegram_notification_exit_force_exit", !config.telegram_notification_exit_force_exit)} /></Tooltip>
          <Tooltip content={TOOLTIPS.exit_trailing_stop_loss?.description ?? "Notify on exit due to trailing stoploss"} configKey="exit_trailing_stop_loss"><ToggleRow name="exit_trailing_stop_loss" desc="Notify on exit due to trailing stoploss" on={config.telegram_notification_exit_trailing_stop_loss} onToggle={() => update("telegram_notification_exit_trailing_stop_loss", !config.telegram_notification_exit_trailing_stop_loss)} /></Tooltip>
        </CardBody>
      </Card>

      <FormDivider />

      <Tooltip content={TOOLTIPS.telegram_notification_protection_trigger?.description ?? "Protection Trigger Notifications"} configKey="notification_settings.protection_trigger"><SubsectionTitle icon={"\uD83D\uDEE1\uFE0F"}>Protection Trigger Notifications</SubsectionTitle></Tooltip>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.telegram_notification_protection_trigger_lock?.description ?? "Notify on pair lock protection trigger"} configKey="protection_trigger.lock"><ToggleRow name="protection_trigger.lock" desc="Notify on pair lock protection trigger" on={config.telegram_notification_protection_trigger_lock} onToggle={() => update("telegram_notification_protection_trigger_lock", !config.telegram_notification_protection_trigger_lock)} /></Tooltip>
          <Tooltip content={TOOLTIPS.telegram_notification_protection_trigger_stop?.description ?? "Notify on stop protection trigger"} configKey="protection_trigger.stop"><ToggleRow name="protection_trigger.stop" desc="Notify on stop protection trigger" on={config.telegram_notification_protection_trigger_stop} onToggle={() => update("telegram_notification_protection_trigger_stop", !config.telegram_notification_protection_trigger_stop)} /></Tooltip>
          <Tooltip content={TOOLTIPS.telegram_notification_protection_trigger_global_stop?.description ?? "Notify on global stop protection trigger"} configKey="protection_trigger.global_stop"><ToggleRow name="protection_trigger.global_stop" desc="Notify on global stop protection trigger" on={config.telegram_notification_protection_trigger_global_stop} onToggle={() => update("telegram_notification_protection_trigger_global_stop", !config.telegram_notification_protection_trigger_global_stop)} /></Tooltip>
        </CardBody>
      </Card>

      <FormDivider />

      <Tooltip content={TOOLTIPS.telegram_keyboard?.description ?? "Custom Keyboard"} configKey="telegram.keyboard"><SubsectionTitle icon={"\u2328\uFE0F"}>Custom Keyboard</SubsectionTitle></Tooltip>
      <textarea
        spellCheck={false}
        value={config.telegram_keyboard}
        onChange={(e) => update("telegram_keyboard", e.target.value)}
        className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[120px] resize-y outline-none focus:border-primary"
      />
      <FormHint>JSON array of arrays defining Telegram keyboard layout</FormHint>
      <div className="mb-5" />

      <Card>
        <CardBody>
          <Tooltip content={TOOLTIPS.telegram_allow_custom_messages?.description ?? "Allow strategy to send custom Telegram messages"} configKey="telegram.allow_custom_messages"><ToggleRow name="telegram.allow_custom_messages" desc="Allow strategy to send custom Telegram messages" on={config.telegram_allow_custom_messages} onToggle={() => update("telegram_allow_custom_messages", !config.telegram_allow_custom_messages)} /></Tooltip>
        </CardBody>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* TAB CONTENT: Webhooks (Section 13)         */
/* ─────────────────────────────────────────── */
function WebhooksTab({ config, update }: TabProps) {
  const events = config.webhook_events;

  const toggleEvent = (i: number, field: "enabled" | "open") => {
    const next = [...events];
    next[i] = { ...next[i], [field]: !next[i][field] };
    update("webhook_events", next);
  };

  const updatePayload = (i: number, payload: string) => {
    const next = [...events];
    next[i] = { ...next[i], payload };
    update("webhook_events", next);
  };

  return (
    <div>
      <SectionTitle>Webhook Configuration</SectionTitle>
      <SectionDesc>HTTP webhook notifications per event -- Section 13 Webhook Config</SectionDesc>

      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.webhook_enabled?.description ?? "Enable webhook notifications"} configKey="webhook.enabled"><ToggleRow name="webhook.enabled" desc="Enable webhook notifications" on={config.webhook_enabled} onToggle={() => update("webhook_enabled", !config.webhook_enabled)} /></Tooltip>
        </CardBody>
      </Card>

      <div className="mb-6">
        <Tooltip content={TOOLTIPS.webhook_url?.description ?? "Webhook URL"} configKey="webhook.url"><FormLabel>Webhook URL</FormLabel></Tooltip>
        <FormInput type="url" value={config.webhook_url} onChange={(v) => update("webhook_url", v)} placeholder="https://..." />
      </div>

      <div className="grid grid-cols-4 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.webhook_format?.description ?? "Format"} configKey="webhook.format"><FormLabel>Format</FormLabel></Tooltip>
          <FormSelect
            value={config.webhook_format}
            onChange={(v) => update("webhook_format", v)}
            options={[
              { value: "form", label: "form" },
              { value: "json", label: "json" },
              { value: "raw", label: "raw" },
            ]}
          />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.webhook_retries?.description ?? "Retries"} configKey="webhook.retries"><FormLabel>Retries</FormLabel></Tooltip>
          <FormInput type="number" value={config.webhook_retries} onChange={(v) => update("webhook_retries", Number(v))} min="0" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.webhook_retry_delay?.description ?? "Retry Delay"} configKey="webhook.retry_delay"><FormLabel>Retry Delay</FormLabel></Tooltip>
          <FormInput type="number" value={config.webhook_retry_delay} onChange={(v) => update("webhook_retry_delay", Number(v))} step="0.1" />
          <FormHint>Seconds</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.webhook_timeout?.description ?? "Timeout"} configKey="webhook.timeout"><FormLabel>Timeout</FormLabel></Tooltip>
          <FormInput type="number" value={config.webhook_timeout} onChange={(v) => update("webhook_timeout", Number(v))} />
          <FormHint>Seconds</FormHint>
        </div>
      </div>

      <FormDivider />

      <Tooltip content={TOOLTIPS.webhook_webhookstrategy_msg?.description ?? "Strategy Message Payload"} configKey="webhook.webhookstrategy_msg"><SubsectionTitle icon={"\uD83D\uDCE7"}>Strategy Message Payload</SubsectionTitle></Tooltip>
      <textarea
        spellCheck={false}
        value={config.webhook_strategy_msg}
        onChange={(e) => update("webhook_strategy_msg", e.target.value)}
        className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[100px] resize-y outline-none focus:border-primary mb-6"
      />

      <FormDivider />

      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div>
          <SubsectionTitle icon={"\uD83D\uDCE4"}>Event Payloads</SubsectionTitle>

          {events.map((evt, i) => (
            <div key={evt.name} className="bg-card border border-border rounded-btn mb-2 overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[.01]"
                onClick={() => toggleEvent(i, "open")}
              >
                <Toggle on={evt.enabled} onToggle={() => toggleEvent(i, "enabled")} />
                <span className="text-xs font-semibold text-foreground flex-1">{evt.name}</span>
                <span className="text-muted-foreground text-xs">{evt.open ? "\u25BC" : "\u25B6"}</span>
              </div>
              {evt.open && (
                <div className="px-3.5 pb-3 pt-2 border-t border-border/40">
                  <textarea
                    spellCheck={false}
                    value={evt.payload}
                    onChange={(e) => updatePayload(i, e.target.value)}
                    className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[100px] resize-y outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Variable Reference */}
        <div>
          <SubsectionTitle icon={"\uD83D\uDCD6"}>Available Variables</SubsectionTitle>
          <div className="bg-card border border-border rounded-btn p-3 max-h-[300px] overflow-y-auto">
            {webhookVars.map((v) => (
              <div key={v.key} className="flex items-baseline gap-2 py-1 border-b border-border/30 last:border-b-0">
                <span className="font-mono text-xs text-cyan whitespace-nowrap">{v.key}</span>
                <span className="text-xs text-muted-foreground">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FormDivider />

      {/* Discord Section */}
      <Tooltip content={TOOLTIPS.discord_enabled?.description ?? "Discord Integration"} configKey="discord"><SubsectionTitle icon={"\uD83D\uDCAC"}>Discord Integration</SubsectionTitle></Tooltip>
      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.discord_enabled_enabled?.description ?? "Enable Discord webhook notifications"} configKey="discord.enabled"><ToggleRow name="discord.enabled" desc="Enable Discord webhook notifications" on={config.discord_enabled} onToggle={() => update("discord_enabled", !config.discord_enabled)} /></Tooltip>
        </CardBody>
      </Card>
      <div className="mb-6">
        <Tooltip content={TOOLTIPS.discord_enabled_webhook_url?.description ?? "Discord Webhook URL"} configKey="discord.webhook_url"><FormLabel>Discord Webhook URL</FormLabel></Tooltip>
        <FormInput type="url" value={config.discord_webhook_url} onChange={(v) => update("discord_webhook_url", v)} placeholder="https://discord.com/api/webhooks/..." />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.discord_enabled_entry?.description ?? "Entry Payload"} configKey="discord.entry"><FormLabel>Entry Payload</FormLabel></Tooltip>
          <textarea
            spellCheck={false}
            value={config.discord_entry_payload}
            onChange={(e) => update("discord_entry_payload", e.target.value)}
            className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[80px] resize-y outline-none focus:border-primary"
          />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.discord_enabled_exit?.description ?? "Exit Payload"} configKey="discord.exit"><FormLabel>Exit Payload</FormLabel></Tooltip>
          <textarea
            spellCheck={false}
            value={config.discord_exit_payload}
            onChange={(e) => update("discord_exit_payload", e.target.value)}
            className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[80px] resize-y outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.discord_enabled_exit_fill?.description ?? "Exit Fill Payload"} configKey="discord.exit_fill"><FormLabel>Exit Fill Payload</FormLabel></Tooltip>
          <textarea
            spellCheck={false}
            value={config.discord_exit_fill_payload}
            onChange={(e) => update("discord_exit_fill_payload", e.target.value)}
            className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[80px] resize-y outline-none focus:border-primary"
          />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.discord_enabled_status?.description ?? "Status Payload"} configKey="discord.status"><FormLabel>Status Payload</FormLabel></Tooltip>
          <textarea
            spellCheck={false}
            value={config.discord_status_payload}
            onChange={(e) => update("discord_status_payload", e.target.value)}
            className="w-full bg-card border border-border rounded-btn p-3 font-mono text-xs text-cyan leading-relaxed min-h-[80px] resize-y outline-none focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* TAB CONTENT: Producer/Consumer (Section 17) */
/* ─────────────────────────────────────────── */
function ProducerTab({ config, update }: TabProps) {
  const updateProducer = (i: number, field: keyof Producer, value: string | number | boolean) => {
    const next = [...config.producers];
    next[i] = { ...next[i], [field]: value };
    update("producers", next);
  };

  const removeProducer = (i: number) => {
    update("producers", config.producers.filter((_, j) => j !== i));
  };

  const addProducer = () => {
    update("producers", [...config.producers, { name: "", host: "", port: 8080, ws_token: "", secure: false }]);
  };

  return (
    <div>
      <SectionTitle>Producer / Consumer Mode</SectionTitle>
      <SectionDesc>Multi-bot signal sharing via WebSocket -- Section 17 Producer/Consumer Mode</SectionDesc>

      <Card className="mb-6">
        <CardBody>
          <Tooltip content={TOOLTIPS.producer_enabled?.description ?? "Enable this bot as a signal consumer"} configKey="external_message_consumer.enabled"><ToggleRow name="external_message_consumer.enabled" desc="Enable this bot as a signal consumer" on={config.consumer_enabled} onToggle={() => update("consumer_enabled", !config.consumer_enabled)} /></Tooltip>
          <Tooltip content={TOOLTIPS.remove_entry_exit_signals?.description ?? "Remove local entry/exit signals and only use producer signals"} configKey="remove_entry_exit_signals"><ToggleRow name="remove_entry_exit_signals" desc="Remove local entry/exit signals and only use producer signals" on={config.remove_entry_exit_signals} onToggle={() => update("remove_entry_exit_signals", !config.remove_entry_exit_signals)} /></Tooltip>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.producer_wait_timeout?.description ?? "Wait Timeout"} configKey="external_message_consumer.wait_timeout"><FormLabel>Wait Timeout</FormLabel></Tooltip>
          <FormInput type="number" value={config.consumer_wait_timeout} onChange={(v) => update("consumer_wait_timeout", Number(v))} />
          <FormHint>Seconds to wait for data from producers</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.producer_ping_timeout?.description ?? "Ping Timeout"} configKey="external_message_consumer.ping_timeout"><FormLabel>Ping Timeout</FormLabel></Tooltip>
          <FormInput type="number" value={config.consumer_ping_timeout} onChange={(v) => update("consumer_ping_timeout", Number(v))} />
          <FormHint>Seconds for WebSocket ping timeout</FormHint>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.producer_initial_candle_limit?.description ?? "Initial Candle Limit"} configKey="external_message_consumer.initial_candle_limit"><FormLabel>Initial Candle Limit</FormLabel></Tooltip>
          <FormInput type="number" value={config.consumer_initial_candle_limit} onChange={(v) => update("consumer_initial_candle_limit", Number(v))} />
          <FormHint>Number of candles to request on initial connection</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.producer_message_size_limit?.description ?? "Message Size Limit"} configKey="external_message_consumer.message_size_limit"><FormLabel>Message Size Limit</FormLabel></Tooltip>
          <FormInput type="number" value={config.consumer_message_size_limit} onChange={(v) => update("consumer_message_size_limit", Number(v))} />
          <FormHint>Max message size in MB</FormHint>
        </div>
      </div>

      <FormDivider />

      <Tooltip content={TOOLTIPS.producer_producers?.description ?? "Producers"} configKey="external_message_consumer.producers"><SubsectionTitle icon={"\uD83D\uDCE1"}>Producers</SubsectionTitle></Tooltip>

      {config.producers.map((p, i) => (
        <div key={`producer-${p.name || i}`} className="bg-card border border-border rounded-btn p-4 mb-2">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-foreground">Producer #{i + 1}</span>
            <button
              type="button"
              className="text-rose-500 text-sm cursor-pointer"
              onClick={() => removeProducer(i)}
            >
              &times; Remove
            </button>
          </div>
          <div className="grid grid-cols-2 gap-5 mb-2">
            <div>
              <Tooltip content={TOOLTIPS.name?.description ?? "Name"} configKey="name"><FormLabel>Name</FormLabel></Tooltip>
              <FormInput value={p.name} onChange={(v) => updateProducer(i, "name", v)} placeholder="e.g. default" />
            </div>
            <div>
              <Tooltip content={TOOLTIPS.host?.description ?? "Host"} configKey="host"><FormLabel>Host</FormLabel></Tooltip>
              <FormInput value={p.host} onChange={(v) => updateProducer(i, "host", v)} placeholder="e.g. 127.0.0.1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 mb-2">
            <div>
              <Tooltip content={TOOLTIPS.port?.description ?? "Port"} configKey="port"><FormLabel>Port</FormLabel></Tooltip>
              <FormInput type="number" value={p.port} onChange={(v) => updateProducer(i, "port", Number(v))} />
            </div>
            <div>
              <Tooltip content={TOOLTIPS.ws_token?.description ?? "WS Token"} configKey="ws_token"><FormLabel>WS Token</FormLabel></Tooltip>
              <FormInput type="password" value={p.ws_token} onChange={(v) => updateProducer(i, "ws_token", v)} placeholder="Enter WS token" />
            </div>
          </div>
          <div className="pt-1">
            <Tooltip content={TOOLTIPS.secure?.description ?? "Use TLS/WSS for this producer connection"} configKey="secure"><ToggleRow name="secure" desc="Use TLS/WSS for this producer connection" on={p.secure} onToggle={() => updateProducer(i, "secure", !p.secure)} /></Tooltip>
          </div>
        </div>
      ))}

      <div className="mt-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-btn text-xs font-semibold bg-transparent border border-border text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors cursor-pointer"
          onClick={addProducer}
        >
          + Add Producer
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* TAB CONTENT: Advanced (Section 28)         */
/* ─────────────────────────────────────────── */
function AdvancedTab({ config, update }: TabProps) {
  return (
    <div>
      <SectionTitle>Advanced Settings</SectionTitle>
      <SectionDesc>Database, logging, and multi-instance config -- Section 28 Multi-instance + Logging</SectionDesc>

      {/* Database */}
      <SubsectionTitle icon={"\uD83D\uDCBE"}>Database</SubsectionTitle>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.db_url?.description ?? "Database Type"} configKey="db_url"><FormLabel>Database Type</FormLabel></Tooltip>
          <FormSelect
            value={config.db_type}
            onChange={(v) => update("db_type", v)}
            options={[
              { value: "sqlite", label: "SQLite (default)" },
              { value: "postgresql", label: "PostgreSQL" },
              { value: "mariadb", label: "MariaDB" },
            ]}
          />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.db_url?.description ?? "Connection String"} configKey="db_url"><FormLabel>Connection String</FormLabel></Tooltip>
          <FormInput value={config.db_url} onChange={(v) => update("db_url", v)} mono />
          <FormHint>SQLite: sqlite:///path, PG: postgresql://user:pass@host/db</FormHint>
        </div>
      </div>

      <FormDivider />

      {/* Logging */}
      <SubsectionTitle icon={"\uD83D\uDCC4"}>Logging</SubsectionTitle>
      <div className="grid grid-cols-3 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.verbosity?.description ?? "Log Level"} configKey="verbosity"><FormLabel>Log Level</FormLabel></Tooltip>
          <FormSelect
            value={config.verbosity}
            onChange={(v) => update("verbosity", v)}
            options={[
              { value: "0", label: "ERROR (0)" },
              { value: "1", label: "INFO (1 - default)" },
              { value: "2", label: "DEBUG (2)" },
              { value: "3", label: "TRACE (3)" },
            ]}
          />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.logfile?.description ?? "Log File"} configKey="logfile"><FormLabel>Log File</FormLabel></Tooltip>
          <FormInput value={config.logfile} onChange={(v) => update("logfile", v)} mono placeholder="/freqtrade/user_data/logs/freqtrade.log" />
        </div>
        <div>
          <Tooltip content={TOOLTIPS.log_rotate?.description ?? "Log Rotate"} configKey="log_rotate"><FormLabel>Log Rotate</FormLabel></Tooltip>
          <FormSelect value={config.log_rotate} onChange={(v) => update("log_rotate", v)} options={[{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }]} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-7">
        <div>
          <Tooltip content={TOOLTIPS.log_rotate_bytes?.description ?? "Log Rotate Bytes"} configKey="log_rotate_bytes"><FormLabel>Log Rotate Bytes</FormLabel></Tooltip>
          <FormInput type="number" value={config.log_rotate_bytes} onChange={(v) => update("log_rotate_bytes", Number(v))} />
          <FormHint>Max log file size before rotation (bytes). Default: 10MB</FormHint>
        </div>
        <div>
          <Tooltip content={TOOLTIPS.log_rotate_backup_count?.description ?? "Log Rotate Backup Count"} configKey="log_rotate_backup_count"><FormLabel>Log Rotate Backup Count</FormLabel></Tooltip>
          <FormInput type="number" value={config.log_rotate_backup_count} onChange={(v) => update("log_rotate_backup_count", Number(v))} />
          <FormHint>Number of rotated log files to keep</FormHint>
        </div>
      </div>

      <FormDivider />

      {/* Multi-Instance Info */}
      <SubsectionTitle icon={"\uD83D\uDCE6"}>Multi-Instance Info</SubsectionTitle>
      <Card>
        <CardBody>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Each FreqTrade instance runs in its own Docker container with a separate config, database, and API port.
            The orchestrator manages multiple instances via the REST API.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "API Listen IP", param: "api_server.listen_ip_address", detail: "Default: 127.0.0.1" },
              { label: "API Listen Port", param: "api_server.listen_port", detail: "Default: 8080" },
              { label: "API Username", param: "api_server.username", detail: "Required for auth" },
              { label: "API Password", param: "api_server.password", detail: "Required for auth" },
            ].map((item) => (
              <div key={item.param} className="bg-card border border-border rounded-btn p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{item.label}</div>
                <div className="text-xs text-foreground font-mono">{item.param}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* MAIN PAGE                                   */
/* ─────────────────────────────────────────── */
export default function SettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [config, setConfig] = useState<ConfigState>(getDefaultConfig);

  const updateConfig = useCallback(<K extends keyof ConfigState>(key: K, value: ConfigState[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  // Load bot list on mount
  useEffect(() => {
    getBots()
      .then((list) => {
        setBots(list);
        if (list.length > 0) setSelectedBotId(String(list[0].id));
      })
      .catch((err) => { toast.error(err instanceof Error ? err.message : "Failed to load bots."); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function populateFromApi(data: FTShowConfig) {
    const c = getDefaultConfig();

    // Core fields
    if (data.bot_name != null) c.bot_name = String(data.bot_name);
    if (data.initial_state != null) c.initial_state = String(data.initial_state);
    if (data.max_open_trades != null) c.max_open_trades = Number(data.max_open_trades);
    if (data.stake_currency != null) c.stake_currency = String(data.stake_currency);
    if (data.stake_amount != null) c.stake_amount = String(data.stake_amount);
    if (data.tradable_balance_ratio != null) c.tradable_balance_ratio = Number(data.tradable_balance_ratio);
    if (data.available_capital != null) c.available_capital = Number(data.available_capital);
    if (data.fiat_display_currency != null) c.fiat_display_currency = String(data.fiat_display_currency);
    if (data.timeframe != null) c.timeframe = String(data.timeframe);
    if (data.force_entry_enable != null) c.force_entry_enable = String(data.force_entry_enable);
    if (data.dry_run != null) c.dry_run = Boolean(data.dry_run);
    if (data.cancel_open_orders_on_exit != null) c.cancel_open_orders_on_exit = Boolean(data.cancel_open_orders_on_exit);
    if (data.process_only_new_candles != null) c.process_only_new_candles = Boolean(data.process_only_new_candles);
    if (data.dry_run_wallet != null) c.dry_run_wallet = Number(data.dry_run_wallet);
    if (data.stoploss != null) c.stoploss = Number(data.stoploss);
    if (data.trailing_stop != null) c.trailing_stop = Boolean(data.trailing_stop);
    if (data.trailing_stop_positive != null) c.trailing_stop_positive = Number(data.trailing_stop_positive);
    if (data.trailing_stop_positive_offset != null) c.trailing_stop_positive_offset = Number(data.trailing_stop_positive_offset);
    if (data.trailing_only_offset_is_reached != null) c.trailing_only_offset_is_reached = String(data.trailing_only_offset_is_reached);
    if (data.use_exit_signal != null) c.use_exit_signal = Boolean(data.use_exit_signal);
    if (data.exit_profit_only != null) c.exit_profit_only = Boolean(data.exit_profit_only);
    if (data.ignore_roi_if_entry_signal != null) c.ignore_roi_if_entry_signal = Boolean(data.ignore_roi_if_entry_signal);
    if (data.exit_profit_offset != null) c.exit_profit_offset = Number(data.exit_profit_offset);
    if (data.position_adjustment_enable != null) c.position_adjustment_enable = Boolean(data.position_adjustment_enable);
    if (data.max_entry_position_adjustment != null) c.max_entry_position_adjustment = Number(data.max_entry_position_adjustment);
    if (data.trading_mode != null) c.trading_mode = String(data.trading_mode);
    if (data.margin_mode != null) c.margin_mode = String(data.margin_mode);
    if (data.liquidation_buffer != null) c.liquidation_buffer = Number(data.liquidation_buffer);
    if (data.amend_last_stake_amount != null) c.amend_last_stake_amount = Boolean(data.amend_last_stake_amount);
    if (data.last_stake_amount_min_ratio != null) c.last_stake_amount_min_ratio = Number(data.last_stake_amount_min_ratio);
    if (data.amount_reserve_percent != null) c.amount_reserve_percent = Number(data.amount_reserve_percent);
    if (data.ignore_buying_expired_candle_after != null) c.ignore_buying_expired_candle_after = Number(data.ignore_buying_expired_candle_after);
    if (data.custom_price_max_distance_ratio != null) c.custom_price_max_distance_ratio = Number(data.custom_price_max_distance_ratio);
    if (data.futures_funding_rate != null) c.futures_funding_rate = Number(data.futures_funding_rate);
    if (data.process_throttle_secs != null) c.process_throttle_secs = Number(data.process_throttle_secs);
    if (data.heartbeat_interval != null) c.heartbeat_interval = Number(data.heartbeat_interval);

    // Minimal ROI
    if (data.minimal_roi && typeof data.minimal_roi === "object") {
      c.minimal_roi = Object.entries(data.minimal_roi).map(([time, roi]) => ({
        time: Number(time),
        roi: Number(roi),
      }));
    }

    // Order types — typed via FTOrderTypes
    if (data.order_types) {
      const ot = data.order_types;
      if (ot.entry) c.order_types_entry = String(ot.entry);
      if (ot.exit) c.order_types_exit = String(ot.exit);
      if (ot.emergency_exit) c.order_types_emergency_exit = String(ot.emergency_exit);
      if (ot.force_exit) c.order_types_force_exit = String(ot.force_exit);
      if (ot.force_entry) c.order_types_force_entry = String(ot.force_entry);
      if (ot.stoploss) c.order_types_stoploss = String(ot.stoploss);
      if (ot.stoploss_on_exchange != null) c.stoploss_on_exchange = Boolean(ot.stoploss_on_exchange);
      if (ot.stoploss_on_exchange_interval != null) c.stoploss_on_exchange_interval = Number(ot.stoploss_on_exchange_interval);
      if (ot.stoploss_on_exchange_limit_ratio != null) c.stoploss_on_exchange_limit_ratio = Number(ot.stoploss_on_exchange_limit_ratio);
    }

    // Order time in force — typed via FTOrderTimeInForce
    if (data.order_time_in_force) {
      const otif = data.order_time_in_force;
      if (otif.entry) c.order_time_in_force_entry = String(otif.entry);
      if (otif.exit) c.order_time_in_force_exit = String(otif.exit);
    }

    // Unfilled timeout — typed via FTUnfilledTimeout
    if (data.unfilledtimeout) {
      const uft = data.unfilledtimeout;
      if (uft.entry != null) c.unfilledtimeout_entry = Number(uft.entry);
      if (uft.exit != null) c.unfilledtimeout_exit = Number(uft.exit);
      if (uft.unit) c.unfilledtimeout_unit = String(uft.unit);
      if (uft.exit_timeout_count != null) c.exit_timeout_count = Number(uft.exit_timeout_count);
    }

    // Entry/exit pricing — typed via FTPricing
    if (data.entry_pricing) {
      const ep = data.entry_pricing;
      if (ep.price_side) c.entry_pricing_price_side = String(ep.price_side);
      if (ep.use_order_book != null) c.entry_pricing_use_order_book = String(ep.use_order_book);
      if (ep.order_book_top != null) c.entry_pricing_order_book_top = Number(ep.order_book_top);
      if (ep.price_last_balance != null) c.entry_pricing_price_last_balance = Number(ep.price_last_balance);
    }
    if (data.exit_pricing) {
      const xp = data.exit_pricing;
      if (xp.price_side) c.exit_pricing_price_side = String(xp.price_side);
      if (xp.use_order_book != null) c.exit_pricing_use_order_book = String(xp.use_order_book);
      if (xp.order_book_top != null) c.exit_pricing_order_book_top = Number(xp.order_book_top);
    }

    // Exchange — typed as string | FTExchangeConfig
    if (data.exchange) {
      if (typeof data.exchange === "string") {
        c.exchange_name = data.exchange;
      } else if (typeof data.exchange === "object") {
        const ex = data.exchange;
        if (ex.name) c.exchange_name = String(ex.name);
        if (ex.key) c.exchange_key = String(ex.key);
        if (ex.secret) c.exchange_secret = String(ex.secret);
        if (ex.password) c.exchange_password = String(ex.password);
        if (ex.uid) c.exchange_uid = String(ex.uid);
        if (Array.isArray(ex.pair_whitelist)) c.pair_whitelist = ex.pair_whitelist;
        if (Array.isArray(ex.pair_blacklist)) c.pair_blacklist = ex.pair_blacklist;
        if (ex.enable_ws != null) c.enable_ws = Boolean(ex.enable_ws);
        if (ex.markets_refresh_interval != null) c.markets_refresh_interval = Number(ex.markets_refresh_interval);
        if (ex.ccxt_config) {
          try {
            c.ccxt_config = JSON.stringify(ex.ccxt_config, null, 2);
          } catch { /* non-blocking */
            // keep default
          }
        }
        if (ex.skip_open_order_update != null) c.skip_open_order_update = Boolean(ex.skip_open_order_update);
        if (ex.unknown_fee_rate != null) c.unknown_fee_rate = Number(ex.unknown_fee_rate);
        if (ex.log_responses != null) c.log_responses = Boolean(ex.log_responses);
        if (ex.only_from_ccxt != null) c.only_from_ccxt = Boolean(ex.only_from_ccxt);
      }
    }
    // FTShowConfig returns pair_whitelist at top level too
    if (Array.isArray(data.pair_whitelist) && c.pair_whitelist.length === 0) {
      c.pair_whitelist = data.pair_whitelist;
    }

    // Pairlists — typed via pairlists?: Array<{ method: string; [key: string]: unknown }>
    if (Array.isArray(data.pairlists) && data.pairlists.length > 0) {
      const primary = data.pairlists[0];
      if (primary.method) c.pairlist_handler = String(primary.method);
      if (primary.number_assets != null) c.pairlist_number_assets = Number(primary.number_assets);
      if (primary.sort_key) c.pairlist_sort_key = String(primary.sort_key);
      if (primary.min_value != null) c.pairlist_min_value = Number(primary.min_value);
      if (primary.refresh_period != null) c.pairlist_refresh_period = Number(primary.refresh_period);

      // Map remaining pairlists entries to filters
      const filterEntries = data.pairlists.slice(1);
      const enabledNames = new Set(filterEntries.map((f) => String(f.method)));
      c.pairlist_filters = c.pairlist_filters.map((f) => {
        const match = filterEntries.find((fe) => String(fe.method) === f.name);
        if (match) {
          const { method: _method, ...params } = match; // eslint-disable-line @typescript-eslint/no-unused-vars
          return { ...f, enabled: true, params: { ...f.params, ...params } };
        }
        return { ...f, enabled: enabledNames.has(f.name) };
      });
    }

    // Telegram — typed via FTTelegramConfig
    if (data.telegram) {
      const tg = data.telegram;
      if (tg.enabled != null) c.telegram_enabled = Boolean(tg.enabled);
      if (tg.token) c.telegram_token = String(tg.token);
      if (tg.chat_id) c.telegram_chat_id = String(tg.chat_id);
      if (tg.allow_custom_messages != null) c.telegram_allow_custom_messages = Boolean(tg.allow_custom_messages);
      if (tg.balance_dust_level != null) c.telegram_balance_dust_level = Number(tg.balance_dust_level);
      if (tg.reload != null) c.telegram_reload = Boolean(tg.reload);
      if (tg.topic_id != null) c.telegram_topic_id = String(tg.topic_id);
      if (Array.isArray(tg.authorized_users)) c.telegram_authorized_users = tg.authorized_users.map(String);
      if (tg.keyboard) {
        try {
          c.telegram_keyboard = JSON.stringify(tg.keyboard, null, 2);
        } catch { /* non-blocking */
          // keep default
        }
      }
      if (tg.notification_settings) {
        const ns = tg.notification_settings;
        if (ns.entry != null) c.telegram_notification_entry = ns.entry !== "off";
        if (ns.exit != null) c.telegram_notification_exit = ns.exit !== "off";
        if (ns.entry_cancel != null) c.telegram_notification_entry_cancel = ns.entry_cancel !== "off";
        if (ns.exit_cancel != null) c.telegram_notification_exit_cancel = ns.exit_cancel !== "off";
        if (ns.entry_fill != null) c.telegram_notification_entry_fill = ns.entry_fill !== "off";
        if (ns.exit_fill != null) c.telegram_notification_exit_fill = ns.exit_fill !== "off";
        if (ns.status != null) c.telegram_notification_status = ns.status !== "off";
        if (ns.show_candle != null) c.telegram_notification_show_candle = String(ns.show_candle);
        if (ns.protection_trigger) {
          const pt = ns.protection_trigger;
          if (pt.lock != null) c.telegram_notification_protection_trigger_lock = pt.lock !== "off";
          if (pt.stop != null) c.telegram_notification_protection_trigger_stop = pt.stop !== "off";
          if (pt.global_stop != null) c.telegram_notification_protection_trigger_global_stop = pt.global_stop !== "off";
        }
        // Per-exit-reason notifications
        if (ns.exit_stoploss != null) c.telegram_notification_exit_stoploss = ns.exit_stoploss !== "off";
        if (ns.exit_roi != null) c.telegram_notification_exit_roi = ns.exit_roi !== "off";
        if (ns.exit_exit_signal != null) c.telegram_notification_exit_exit_signal = ns.exit_exit_signal !== "off";
        if (ns.exit_force_exit != null) c.telegram_notification_exit_force_exit = ns.exit_force_exit !== "off";
        if (ns.exit_trailing_stop_loss != null) c.telegram_notification_exit_trailing_stop_loss = ns.exit_trailing_stop_loss !== "off";
      }
    }

    // Webhooks — typed via FTWebhookConfig
    if (data.webhook) {
      const wh = data.webhook;
      if (wh.enabled != null) c.webhook_enabled = Boolean(wh.enabled);
      if (wh.url) c.webhook_url = String(wh.url);
      if (wh.format) c.webhook_format = String(wh.format);
      if (wh.retries != null) c.webhook_retries = Number(wh.retries);
      if (wh.retry_delay != null) c.webhook_retry_delay = Number(wh.retry_delay);
      if (wh.timeout != null) c.webhook_timeout = Number(wh.timeout);
      if (wh.webhookstrategy_msg) {
        try {
          c.webhook_strategy_msg = JSON.stringify(wh.webhookstrategy_msg, null, 2);
        } catch { /* non-blocking */
          // keep default
        }
      }
      // Map webhook event payloads from config (dynamic keys via index signature on FTWebhookConfig)
      c.webhook_events = c.webhook_events.map((evt) => {
        const payload = wh[evt.name];
        if (payload) {
          try {
            return { ...evt, enabled: true, payload: JSON.stringify(payload, null, 2) };
          } catch { /* non-blocking */
            return { ...evt, enabled: true };
          }
        }
        return evt;
      });
    }

    // Discord — typed via FTDiscordConfig
    if (data.discord) {
      const dc = data.discord;
      if (dc.enabled != null) c.discord_enabled = Boolean(dc.enabled);
      if (dc.webhook_url) c.discord_webhook_url = String(dc.webhook_url);
      if (dc.entry) { try { c.discord_entry_payload = JSON.stringify(dc.entry, null, 2); } catch { /* keep default */ } }
      if (dc.exit) { try { c.discord_exit_payload = JSON.stringify(dc.exit, null, 2); } catch { /* keep default */ } }
      if (dc.exit_fill) { try { c.discord_exit_fill_payload = JSON.stringify(dc.exit_fill, null, 2); } catch { /* keep default */ } }
      if (dc.status) { try { c.discord_status_payload = JSON.stringify(dc.status, null, 2); } catch { /* keep default */ } }
    }

    // Producer/Consumer — typed via FTExternalMessageConsumer
    if (data.external_message_consumer) {
      const emc = data.external_message_consumer;
      if (emc.enabled != null) c.consumer_enabled = Boolean(emc.enabled);
      if (emc.remove_entry_exit_signals != null) c.remove_entry_exit_signals = Boolean(emc.remove_entry_exit_signals);
      if (emc.wait_timeout != null) c.consumer_wait_timeout = Number(emc.wait_timeout);
      if (emc.ping_timeout != null) c.consumer_ping_timeout = Number(emc.ping_timeout);
      if (emc.initial_candle_limit != null) c.consumer_initial_candle_limit = Number(emc.initial_candle_limit);
      if (emc.message_size_limit != null) c.consumer_message_size_limit = Number(emc.message_size_limit);
      if (Array.isArray(emc.producers)) {
        c.producers = emc.producers.map((p) => ({
          name: String(p.name || ""),
          host: String(p.host || ""),
          port: Number(p.port ?? 8080),
          ws_token: String(p.ws_token || ""),
          secure: Boolean(p.secure),
        }));
      }
    }

    // Advanced — typed on FTShowConfig
    if (data.db_url) {
      const dbUrl = data.db_url;
      c.db_url = dbUrl;
      if (dbUrl.startsWith("postgresql")) c.db_type = "postgresql";
      else if (dbUrl.startsWith("mysql") || dbUrl.startsWith("mariadb")) c.db_type = "mariadb";
      else c.db_type = "sqlite";
    }
    if (data.verbosity != null) c.verbosity = String(data.verbosity);
    if (data.logfile) c.logfile = String(data.logfile);

    return c;
  }

  function buildConfigPayload(c: ConfigState): Record<string, unknown> {
    // Build a config.json-shaped object from our flat state
    const roiObj: Record<string, number> = {};
    for (const row of c.minimal_roi) {
      roiObj[String(row.time)] = row.roi;
    }

    // Build pairlists array
    const pairlists: Array<Record<string, unknown>> = [
      {
        method: c.pairlist_handler,
        number_assets: c.pairlist_number_assets,
        sort_key: c.pairlist_sort_key,
        min_value: c.pairlist_min_value,
        refresh_period: c.pairlist_refresh_period,
      },
    ];
    for (const f of c.pairlist_filters) {
      if (f.enabled) {
        pairlists.push({ method: f.name, ...f.params });
      }
    }

    // Build webhook events
    const webhookPayload: Record<string, unknown> = {
      enabled: c.webhook_enabled,
      url: c.webhook_url,
      format: c.webhook_format,
      retries: c.webhook_retries,
      retry_delay: c.webhook_retry_delay,
      timeout: c.webhook_timeout,
    };
    for (const evt of c.webhook_events) {
      if (evt.enabled) {
        try { webhookPayload[evt.name] = JSON.parse(evt.payload); } catch { /* parse fallback */ webhookPayload[evt.name] = evt.payload; }
      }
    }
    if (c.webhook_strategy_msg) {
      try { webhookPayload.webhookstrategy_msg = JSON.parse(c.webhook_strategy_msg); } catch { /* parse fallback */ webhookPayload.webhookstrategy_msg = c.webhook_strategy_msg; }
    }

    // Build notification_settings for telegram
    const notifToValue = (on: boolean) => (on ? "on" : "off");

    let ccxtConfig: unknown = {};
    try { ccxtConfig = JSON.parse(c.ccxt_config); } catch { /* parse failed — skip */ }

    return {
      bot_name: c.bot_name,
      initial_state: c.initial_state,
      max_open_trades: c.max_open_trades,
      stake_currency: c.stake_currency,
      stake_amount: c.stake_amount === "unlimited" ? "unlimited" : Number(c.stake_amount),
      tradable_balance_ratio: c.tradable_balance_ratio,
      available_capital: c.available_capital ?? undefined,
      fiat_display_currency: c.fiat_display_currency ?? undefined,
      timeframe: c.timeframe,
      force_entry_enable: c.force_entry_enable === "true",
      dry_run: c.dry_run,
      cancel_open_orders_on_exit: c.cancel_open_orders_on_exit,
      process_only_new_candles: c.process_only_new_candles,
      dry_run_wallet: c.dry_run_wallet,
      minimal_roi: roiObj,
      stoploss: c.stoploss,
      trailing_stop: c.trailing_stop,
      trailing_stop_positive: c.trailing_stop_positive ?? undefined,
      trailing_stop_positive_offset: c.trailing_stop_positive_offset,
      trailing_only_offset_is_reached: c.trailing_only_offset_is_reached === "true",
      use_exit_signal: c.use_exit_signal,
      exit_profit_only: c.exit_profit_only,
      ignore_roi_if_entry_signal: c.ignore_roi_if_entry_signal,
      exit_profit_offset: c.exit_profit_offset,
      position_adjustment_enable: c.position_adjustment_enable,
      max_entry_position_adjustment: c.max_entry_position_adjustment,
      trading_mode: c.trading_mode,
      margin_mode: c.margin_mode,
      liquidation_buffer: c.liquidation_buffer,
      amend_last_stake_amount: c.amend_last_stake_amount,
      last_stake_amount_min_ratio: c.last_stake_amount_min_ratio,
      amount_reserve_percent: c.amount_reserve_percent,
      ignore_buying_expired_candle_after: c.ignore_buying_expired_candle_after ?? undefined,
      custom_price_max_distance_ratio: c.custom_price_max_distance_ratio,
      futures_funding_rate: c.futures_funding_rate ?? undefined,
      process_throttle_secs: c.process_throttle_secs,
      heartbeat_interval: c.heartbeat_interval,
      order_types: {
        entry: c.order_types_entry,
        exit: c.order_types_exit,
        emergency_exit: c.order_types_emergency_exit,
        force_exit: c.order_types_force_exit,
        force_entry: c.order_types_force_entry,
        stoploss: c.order_types_stoploss,
        stoploss_on_exchange: c.stoploss_on_exchange,
        stoploss_on_exchange_interval: c.stoploss_on_exchange_interval,
        stoploss_on_exchange_limit_ratio: c.stoploss_on_exchange_limit_ratio,
      },
      order_time_in_force: {
        entry: c.order_time_in_force_entry,
        exit: c.order_time_in_force_exit,
      },
      unfilledtimeout: {
        entry: c.unfilledtimeout_entry,
        exit: c.unfilledtimeout_exit,
        unit: c.unfilledtimeout_unit,
        exit_timeout_count: c.exit_timeout_count,
      },
      entry_pricing: {
        price_side: c.entry_pricing_price_side,
        use_order_book: c.entry_pricing_use_order_book === "true",
        order_book_top: c.entry_pricing_order_book_top,
        price_last_balance: c.entry_pricing_price_last_balance,
      },
      exit_pricing: {
        price_side: c.exit_pricing_price_side,
        use_order_book: c.exit_pricing_use_order_book === "true",
        order_book_top: c.exit_pricing_order_book_top,
      },
      exchange: {
        name: c.exchange_name,
        ...(c.exchange_key ? { key: c.exchange_key } : {}),
        ...(c.exchange_secret ? { secret: c.exchange_secret } : {}),
        ...(c.exchange_password ? { password: c.exchange_password } : {}),
        ...(c.exchange_uid ? { uid: c.exchange_uid } : {}),
        pair_whitelist: c.pair_whitelist,
        pair_blacklist: c.pair_blacklist,
        enable_ws: c.enable_ws,
        markets_refresh_interval: c.markets_refresh_interval,
        ccxt_config: ccxtConfig,
        skip_open_order_update: c.skip_open_order_update,
        unknown_fee_rate: c.unknown_fee_rate ?? undefined,
        log_responses: c.log_responses,
        only_from_ccxt: c.only_from_ccxt,
      },
      pairlists,
      telegram: {
        enabled: c.telegram_enabled,
        token: c.telegram_token,
        chat_id: c.telegram_chat_id,
        allow_custom_messages: c.telegram_allow_custom_messages,
        balance_dust_level: c.telegram_balance_dust_level || undefined,
        reload: c.telegram_reload,
        ...(c.telegram_topic_id ? { topic_id: c.telegram_topic_id } : {}),
        ...(c.telegram_authorized_users.length > 0 ? { authorized_users: c.telegram_authorized_users } : {}),
        ...(() => { try { return { keyboard: JSON.parse(c.telegram_keyboard) }; } catch { /* parse failed */ return {}; } })(),
        notification_settings: {
          entry: notifToValue(c.telegram_notification_entry),
          exit: notifToValue(c.telegram_notification_exit),
          entry_cancel: notifToValue(c.telegram_notification_entry_cancel),
          exit_cancel: notifToValue(c.telegram_notification_exit_cancel),
          entry_fill: notifToValue(c.telegram_notification_entry_fill),
          exit_fill: notifToValue(c.telegram_notification_exit_fill),
          status: notifToValue(c.telegram_notification_status),
          show_candle: c.telegram_notification_show_candle,
          protection_trigger: {
            lock: notifToValue(c.telegram_notification_protection_trigger_lock),
            stop: notifToValue(c.telegram_notification_protection_trigger_stop),
            global_stop: notifToValue(c.telegram_notification_protection_trigger_global_stop),
          },
          exit_stoploss: notifToValue(c.telegram_notification_exit_stoploss),
          exit_roi: notifToValue(c.telegram_notification_exit_roi),
          exit_exit_signal: notifToValue(c.telegram_notification_exit_exit_signal),
          exit_force_exit: notifToValue(c.telegram_notification_exit_force_exit),
          exit_trailing_stop_loss: notifToValue(c.telegram_notification_exit_trailing_stop_loss),
        },
      },
      webhook: webhookPayload,
      ...(c.discord_enabled ? {
        discord: {
          enabled: c.discord_enabled,
          webhook_url: c.discord_webhook_url,
          ...(() => { try { return { entry: JSON.parse(c.discord_entry_payload) }; } catch { /* parse failed */ return {}; } })(),
          ...(() => { try { return { exit: JSON.parse(c.discord_exit_payload) }; } catch { /* parse failed */ return {}; } })(),
          ...(() => { try { return { exit_fill: JSON.parse(c.discord_exit_fill_payload) }; } catch { /* parse failed */ return {}; } })(),
          ...(() => { try { return { status: JSON.parse(c.discord_status_payload) }; } catch { /* parse failed */ return {}; } })(),
        },
      } : {}),
      external_message_consumer: {
        enabled: c.consumer_enabled,
        remove_entry_exit_signals: c.remove_entry_exit_signals,
        wait_timeout: c.consumer_wait_timeout,
        ping_timeout: c.consumer_ping_timeout,
        initial_candle_limit: c.consumer_initial_candle_limit,
        message_size_limit: c.consumer_message_size_limit,
        producers: c.producers,
      },
      ...(c.db_url ? { db_url: c.db_url } : {}),
    };
  }

  async function handleLoadConfig() {
    if (!selectedBotId) {
      toast.warning("Select a bot first.");
      return;
    }
    setLoadingConfig(true);
    const id = toast.loading("Loading config...");
    try {
      const data = await botConfig(parseInt(selectedBotId, 10));
      const populated = populateFromApi(data);
      setConfig(populated);
      toast.dismiss(id);
      toast.success("Config loaded. Form fields updated.");
      setHasChanges(false);
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoadingConfig(false);
    }
  }

  async function handleSaveConfig() {
    if (!selectedBotId) {
      toast.warning("Select a bot first.");
      return;
    }
    setSaving(true);
    const id = toast.loading("Saving configuration...");
    try {
      const payload = buildConfigPayload(config);
      await saveBotConfig(parseInt(selectedBotId, 10), payload);
      await reloadBotConfig(parseInt(selectedBotId, 10));
      toast.dismiss(id);
      toast.success("Configuration saved and bot config reloaded.");
      setHasChanges(false);
    } catch (err) {
      toast.dismiss(id);
      toast.error(
        err instanceof Error ? `Save failed: ${err.message}` : "Save failed.",
        { action: { label: "RETRY", onClick: handleSaveConfig } }
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setConfig(getDefaultConfig());
    setHasChanges(false);
  }

  const tabContent: Record<TabId, React.ReactNode> = {
    system: <SystemSettingsTab />,
    core: <CoreTab config={config} update={updateConfig} />,
    pairlists: <PairlistsTab config={config} update={updateConfig} botId={selectedBotId ? parseInt(selectedBotId, 10) : undefined} />,
    exchange: <ExchangeTab config={config} update={updateConfig} />,
    telegram: <TelegramTab config={config} update={updateConfig} />,
    webhooks: <WebhooksTab config={config} update={updateConfig} />,
    producer: <ProducerTab config={config} update={updateConfig} />,
    advanced: <AdvancedTab config={config} update={updateConfig} />,
  };

  return (
    <AppShell title="Settings">
      {/* Bot selector bar — hidden on System tab */}
      {activeTab !== "system" && (
        <div className="flex items-center gap-3 mb-4 p-4 bg-muted/50 border border-border rounded-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Target Bot</span>
          <select
            value={selectedBotId}
            onChange={(e) => { setSelectedBotId(e.target.value); setHasChanges(false); }}
            className="bg-card border border-border rounded-btn px-3.5 py-2 text-xs text-muted-foreground outline-none focus:border-primary cursor-pointer min-w-[200px]"
          >
            <option value="">Select bot...</option>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name} ({bot.is_dry_run ? "PAPER" : "LIVE"})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLoadConfig}
            disabled={loadingConfig || !selectedBotId}
            className="px-4 py-2 text-xs font-semibold rounded-btn border border-border bg-muted text-muted-foreground hover:border-border-border hover:border-ring hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loadingConfig ? "Loading..." : "Load Config"}
          </button>
          <span className="text-xs text-muted-foreground ml-2">
            Changes you make are written to the bot&apos;s config.json via the Orchestrator API.
          </span>
        </div>
      )}

      <div className="flex h-[calc(100vh-var(--header-h,56px)-120px)] -mx-8 -mt-2">
        {/* Vertical Tab Bar */}
        <div className="w-[200px] bg-card border-r border-border flex-shrink-0 py-4 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-5 py-2.5 cursor-pointer transition-all text-xs font-medium border-l-[3px] ${
                activeTab === tab.id
                  ? "bg-primary/[.12] text-primary border-l-accent"
                  : "text-muted-foreground border-l-transparent hover:bg-muted hover:text-muted-foreground"
              }`}
            >
              <span className="text-sm w-[18px] text-center">{tab.icon}</span>
              <span className="flex-1 text-left">{tab.label}</span>
              <span className="text-[9px] text-muted-foreground font-mono ml-auto">{tab.ref}</span>
            </button>
          ))}
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 px-9 py-7">
            {tabContent[activeTab]}
          </div>

          {/* Sticky Save Bar — hidden on System tab */}
          {activeTab !== "system" && (
            <div className="sticky bottom-0 bg-card border-t border-border px-8 py-3.5 flex items-center justify-between z-10">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {hasChanges && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber" />
                    Unsaved changes
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-btn text-xs font-semibold bg-transparent border border-border text-muted-foreground hover:bg-muted hover:text-muted-foreground transition-colors cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saving || !selectedBotId}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-btn text-xs font-semibold bg-primary border border-primary text-white hover:bg-primary-dim transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
