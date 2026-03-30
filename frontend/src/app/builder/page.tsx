"use client";

import { Suspense, useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import { createStrategy, getStrategy, getBots, botWhitelist, createStrategyVersion, getStrategyVersions } from "@/lib/api";
import DeployModal from "@/components/builder/DeployModal";
import Tooltip from "@/components/ui/Tooltip";
import { TOOLTIPS } from "@/lib/tooltips";
import type { StrategyVersion } from "@/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ─── Static Options ───────────────────────────────────────────
const exchanges = ["Binance (Futures)", "Hyperliquid", "Bitget (Futures)"];
const timeframes = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"];
const leverageOptions = ["1x (no leverage)", "3x", "5x", "10x", "20x", "50x", "75x", "100x", "125x"];
const marginModes = ["Isolated", "Cross"];
const tradingModes = ["spot", "futures"];

const tradingPairs = [
  { icon: "\u20bf", pair: "BTC/USDT:USDT" },
  { icon: "\u039e", pair: "ETH/USDT:USDT" },
  { icon: "\u25ce", pair: "SOL/USDT:USDT" },
  { icon: "", pair: "DOGE/USDT:USDT" },
  { icon: "", pair: "AVAX/USDT:USDT" },
  { icon: "", pair: "LINK/USDT:USDT" },
  { icon: "", pair: "ARB/USDT:USDT" },
];

const indicatorGroups = [
  {
    label: "Trend",
    items: [
      { icon: "\uD83D\uDCC8", name: "EMA (20)", selected: true },
      { icon: "\uD83D\uDCC8", name: "EMA (50)", selected: true },
      { icon: "\uD83D\uDCC8", name: "SMA", selected: false },
      { icon: "\uD83D\uDCC8", name: "WMA", selected: false },
      { icon: "\uD83D\uDCC8", name: "ADX", selected: true },
      { icon: "\uD83D\uDCC8", name: "Supertrend", selected: false },
      { icon: "\uD83D\uDCC8", name: "Ichimoku", selected: false },
      { icon: "\uD83D\uDCC8", name: "PSAR", selected: false },
    ],
  },
  {
    label: "Momentum",
    items: [
      { icon: "\uD83D\uDD04", name: "RSI (14)", selected: true },
      { icon: "\uD83D\uDD04", name: "MACD", selected: false },
      { icon: "\uD83D\uDD04", name: "Stochastic", selected: false },
      { icon: "\uD83D\uDD04", name: "CCI", selected: false },
      { icon: "\uD83D\uDD04", name: "Williams %R", selected: false },
      { icon: "\uD83D\uDD04", name: "MFI", selected: false },
    ],
  },
  {
    label: "Volatility",
    items: [
      { icon: "\uD83D\uDCCA", name: "Bollinger Bands", selected: false },
      { icon: "\uD83D\uDCCA", name: "ATR (14)", selected: true },
      { icon: "\uD83D\uDCCA", name: "Keltner Channel", selected: false },
      { icon: "\uD83D\uDCCA", name: "Donchian Channel", selected: false },
    ],
  },
  {
    label: "Volume",
    items: [
      { icon: "\uD83D\uDCE6", name: "OBV", selected: false },
      { icon: "\uD83D\uDCE6", name: "VWAP", selected: false },
      { icon: "\uD83D\uDCE6", name: "Volume SMA", selected: false },
      { icon: "\uD83D\uDCE6", name: "CMF", selected: false },
    ],
  },
];

const indicatorChoices = ["EMA (20)", "EMA (50)", "RSI", "ADX", "ATR", "close"];
const operatorChoices = ["crosses above", "crosses below", ">", "<", "="];
const compareChoices = ["EMA (50)", "EMA (20)", "value"];

interface Condition {
  indicator: string;
  operator: string;
  compareType: "indicator" | "value";
  compareIndicator: string;
  compareValue: number;
}

// ── Builder state union types ──
type StoplossTypeOption = "fixed" | "trailing" | "trailing_offset" | "custom_callback" | "on_exchange";
type StoplossExchangePriceType = "last" | "mark" | "index";
type StakePresetOption = "fixed" | "percent" | "kelly";
type StoplossPresetOption = "time_based" | "profit_based" | "atr_based";
type LeveragePresetOption = "fixed" | "dynamic";
type OrderTypeOption = "market" | "limit";
type OrderTifOption = "GTC" | "FOK" | "IOC" | "PO";

/** Serialized builder wizard state (stored in builder_state JSON) */
interface BuilderState {
  leverage?: string;
  marginMode?: string;
  tradingMode?: string;
  liquidationBuffer?: number;
  selectedPairs?: string[];
  indicators?: Record<string, boolean>;
  longConditions?: Condition[];
  shortConditions?: Condition[];
  exitConditions?: Condition[];
  stoploss?: number;
  stakeAmount?: number;
  maxOpenTrades?: number;
  trailingStop?: boolean;
  trailingStopPositive?: number;
  trailingStopPositiveOffset?: number;
  trailingOnlyOffsetIsReached?: boolean;
  roiTable?: Array<{ minutes: number; roi: number }>;
  stoplossGuard?: boolean;
  maxDrawdown?: boolean;
  cooldownPeriod?: boolean;
  stoplossType?: StoplossTypeOption;
  stoplossOnExchange?: boolean;
  enabledCallbacks?: Record<string, boolean>;
  stakePreset?: StakePresetOption;
  stakeFixedAmount?: number;
  stakePercent?: number;
  stoplossPreset?: StoplossPresetOption;
  entryPriceOffset?: number;
  exitPriceOffset?: number;
  dcaLevels?: number;
  dcaMultiplier?: number;
  leveragePreset?: LeveragePresetOption;
  leverageFixedValue?: number;
  startupCandleCount?: number;
  processOnlyNewCandles?: boolean;
  strategyVersion?: string;
  orderTypeEntry?: OrderTypeOption;
  orderTypeExit?: OrderTypeOption;
  orderTypeStoploss?: OrderTypeOption;
  orderTifEntry?: OrderTifOption;
  orderTypeEmergencyExit?: OrderTypeOption;
  orderTypeForceEntry?: OrderTypeOption;
  orderTypeForceExit?: OrderTypeOption;
  orderTifExit?: OrderTifOption;
  informativePairs?: Array<{ pair: string; timeframe: string }>;
  stoplossOnExchangeLimitRatio?: number;
  stoplossOnExchangeInterval?: number;
  stoplossOnExchangePriceType?: StoplossExchangePriceType;
  entryTimeoutMinutes?: number;
  exitTimeoutMinutes?: number;
}

const defaultLongConditions: Condition[] = [
  { indicator: "EMA (20)", operator: ">", compareType: "indicator", compareIndicator: "EMA (50)", compareValue: 0 },
  { indicator: "RSI", operator: "<", compareType: "value", compareIndicator: "", compareValue: 70 },
  { indicator: "ADX", operator: ">", compareType: "value", compareIndicator: "", compareValue: 25 },
];

const defaultShortConditions: Condition[] = [
  { indicator: "EMA (20)", operator: "crosses below", compareType: "indicator", compareIndicator: "EMA (50)", compareValue: 0 },
  { indicator: "RSI", operator: ">", compareType: "value", compareIndicator: "", compareValue: 30 },
];

const defaultExitConditions: Condition[] = [
  { indicator: "EMA (20)", operator: "crosses below", compareType: "indicator", compareIndicator: "EMA (50)", compareValue: 0 },
];

const defaultRoiTable = [
  { minutes: 0, roi: 10 },
  { minutes: 30, roi: 5 },
  { minutes: 60, roi: 2 },
  { minutes: 120, roi: 0 },
];

// ─── Steps Config ────────────────────────────────────────
const steps = [
  { num: 1, label: "Basics" },
  { num: 2, label: "Indicators" },
  { num: 3, label: "Entry" },
  { num: 4, label: "Exit" },
  { num: 5, label: "Risk" },
  { num: 6, label: "Callbacks" },
  { num: 7, label: "Config" },
  { num: 8, label: "Review" },
];

const nextLabels: Record<number, string> = {
  1: "Next: Indicators \u2192",
  2: "Next: Entry \u2192",
  3: "Next: Exit \u2192",
  4: "Next: Risk \u2192",
  5: "Next: Callbacks \u2192",
  6: "Next: Config \u2192",
  7: "Next: Review \u2192",
};

// ─── Indicator → talib mapping ───────────────────────────
const indicatorToColumn: Record<string, string> = {
  "EMA (20)": "ema_20", "EMA (50)": "ema_50", "SMA": "sma",
  "WMA": "wma", "ADX": "adx", "Supertrend": "supertrend",
  "Ichimoku": "ichimoku_conv", "PSAR": "psar",
  "RSI (14)": "rsi", "RSI": "rsi", "MACD": "macd",
  "Stochastic": "stoch_k", "CCI": "cci",
  "Williams %R": "willr", "MFI": "mfi",
  "Bollinger Bands": "bb_mid", "ATR (14)": "atr", "ATR": "atr",
  "Keltner Channel": "kc_mid", "Donchian Channel": "dc_mid",
  "OBV": "obv", "VWAP": "vwap", "Volume SMA": "volume_sma", "CMF": "cmf",
  "close": "close", "value": "value",
};

const indicatorToTalib: Record<string, string> = {
  "EMA (20)":  'df["ema_20"] = ta.EMA(df, timeperiod=20)',
  "EMA (50)":  'df["ema_50"] = ta.EMA(df, timeperiod=50)',
  "SMA":       'df["sma"] = ta.SMA(df, timeperiod=30)',
  "WMA":       'df["wma"] = ta.WMA(df, timeperiod=30)',
  "ADX":       'df["adx"] = ta.ADX(df, timeperiod=14)',
  "Supertrend":'# Supertrend requires custom implementation',
  "Ichimoku":  '# Ichimoku requires custom implementation',
  "PSAR":      'df["psar"] = ta.SAR(df)',
  "RSI (14)":  'df["rsi"] = ta.RSI(df, timeperiod=14)',
  "MACD":      'df["macd"], df["macd_signal"], df["macd_hist"] = ta.MACD(df)',
  "Stochastic":'df["stoch_k"], df["stoch_d"] = ta.STOCH(df)',
  "CCI":       'df["cci"] = ta.CCI(df, timeperiod=14)',
  "Williams %R":'df["willr"] = ta.WILLR(df, timeperiod=14)',
  "MFI":       'df["mfi"] = ta.MFI(df, timeperiod=14)',
  "Bollinger Bands": 'df["bb_upper"], df["bb_mid"], df["bb_lower"] = ta.BBANDS(df, timeperiod=20)',
  "ATR (14)":  'df["atr"] = ta.ATR(df, timeperiod=14)',
  "Keltner Channel": '# Keltner Channel requires custom implementation',
  "Donchian Channel": '# Donchian Channel requires custom implementation',
  "OBV":       'df["obv"] = ta.OBV(df)',
  "VWAP":      '# VWAP requires custom implementation',
  "Volume SMA": 'df["volume_sma"] = ta.SMA(df["volume"], timeperiod=20)',
  "CMF":       '# CMF requires custom implementation',
};

// ─── Callback definitions (§3) ─────────────────────────────
interface CallbackDef {
  key: string;
  name: string;
  description: string;
  hasParams: boolean;
  paramType?: "stake_presets" | "stoploss_presets" | "offset_input" | "time_threshold"
    | "dca_config" | "leverage_presets" | "description_only";
}

const callbackDefs: CallbackDef[] = [
  { key: "bot_start", name: "bot_start", description: "Called once when the bot starts. Use for one-time initialization of models, data, or connections.", hasParams: false, paramType: "description_only" },
  { key: "bot_loop_start", name: "bot_loop_start", description: "Called at the start of every bot iteration (each candle tick). Use for periodic updates like refreshing external data.", hasParams: false, paramType: "description_only" },
  { key: "custom_stake_amount", name: "custom_stake_amount", description: "Customize stake amount per trade. Override the default stake_amount from config on a per-trade basis.", hasParams: true, paramType: "stake_presets" },
  { key: "custom_exit", name: "custom_exit", description: "Custom exit logic evaluated on every candle for open trades. Return a string (exit reason) to exit, or empty string to hold.", hasParams: false, paramType: "description_only" },
  { key: "custom_stoploss", name: "custom_stoploss", description: "Dynamic stoploss that can be adjusted based on trade state, profit, time, or indicators.", hasParams: true, paramType: "stoploss_presets" },
  { key: "custom_roi", name: "custom_roi", description: "Custom ROI table generation. Override minimal_roi dynamically based on trade context.", hasParams: false, paramType: "description_only" },
  { key: "custom_entry_price", name: "custom_entry_price", description: "Customize the entry price for limit orders. Use an offset from current price.", hasParams: true, paramType: "offset_input" },
  { key: "custom_exit_price", name: "custom_exit_price", description: "Customize the exit price for limit orders. Use an offset from current price.", hasParams: true, paramType: "offset_input" },
  { key: "check_entry_timeout", name: "check_entry_timeout", description: "Called when an entry order has not been filled within the unfilledtimeout period. Return True to cancel.", hasParams: true, paramType: "time_threshold" },
  { key: "check_exit_timeout", name: "check_exit_timeout", description: "Called when an exit order has not been filled within the unfilledtimeout period. Return True to cancel.", hasParams: true, paramType: "time_threshold" },
  { key: "confirm_trade_entry", name: "confirm_trade_entry", description: "Called right before placing the entry order. Return False to abort entry. Use for final validation checks.", hasParams: false, paramType: "description_only" },
  { key: "confirm_trade_exit", name: "confirm_trade_exit", description: "Called right before placing the exit order. Return False to abort exit. Use to prevent exits under certain conditions.", hasParams: false, paramType: "description_only" },
  { key: "adjust_trade_position", name: "adjust_trade_position", description: "DCA (Dollar Cost Averaging) / position adjustment. Return a positive stake to increase position, negative to decrease.", hasParams: true, paramType: "dca_config" },
  { key: "adjust_order_price", name: "adjust_order_price", description: "Called for open orders on every iteration. Return the new price to update the order or None to keep it.", hasParams: false, paramType: "description_only" },
  { key: "leverage", name: "leverage", description: "Return the leverage to use for a given trade. Called when opening a new trade in futures mode.", hasParams: true, paramType: "leverage_presets" },
  { key: "order_filled", name: "order_filled", description: "Called when an order is filled. Use for notifications, logging, or adjusting state after fills.", hasParams: false, paramType: "description_only" },
  { key: "adjust_entry_price", name: "adjust_entry_price", description: "Called for open entry orders on every iteration. Return updated entry price or None to cancel.", hasParams: false, paramType: "description_only" },
  { key: "adjust_exit_price", name: "adjust_exit_price", description: "Called for open exit orders on every iteration. Return updated exit price or None to cancel.", hasParams: false, paramType: "description_only" },
  { key: "plot_annotations", name: "plot_annotations", description: "Return plot annotations for visual debugging in FreqUI/plotting. Add custom markers on the chart.", hasParams: false, paramType: "description_only" },
];

// ─── Helpers (module-level, not recreated per render) ────
function conditionToCode(c: Condition): string {
  const left = indicatorToColumn[c.indicator] || c.indicator.toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (c.compareType === "indicator") {
    const right = indicatorToColumn[c.compareIndicator] || c.compareIndicator.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (c.operator === "crosses above") return `(qtpylib.crossed_above(df["${left}"], df["${right}"]))`;
    if (c.operator === "crosses below") return `(qtpylib.crossed_below(df["${left}"], df["${right}"]))`;
    return `(df["${left}"] ${c.operator} df["${right}"])`;
  } else {
    if (c.operator === "crosses above") return `(qtpylib.crossed_above(df["${left}"], ${c.compareValue}))`;
    if (c.operator === "crosses below") return `(qtpylib.crossed_below(df["${left}"], ${c.compareValue}))`;
    return `(df["${left}"] ${c.operator} ${c.compareValue})`;
  }
}

// ─── Toggle Switch sub-component ────────────────────────
function ToggleSwitch({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-9 h-5 rounded-full border cursor-pointer relative transition-all ${
          enabled ? "bg-emerald-500/10 border-emerald-500/50" : "bg-muted border-border"
        }`}
        onClick={onToggle}
      >
        <div
          className={`absolute w-3.5 h-3.5 rounded-full top-[2px] transition-all ${
            enabled ? "bg-green left-[17px]" : "bg-text-3 left-[2px]"
          }`}
        />
      </div>
      {label && <div className="text-xs text-muted-foreground">{label}</div>}
    </div>
  );
}

// ─── Collapsible section sub-component ────────────────────
function CollapsibleSection({ title, description, enabled, onToggle, children, defaultOpen }: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  return (
    <div className={`border rounded-lg transition-all ${enabled ? "border-primary/40 bg-primary/[.04]" : "border-border bg-muted/50"}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>&#9654;</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground font-mono">{title}()</div>
          <div className="text-xs text-muted-foreground leading-snug mt-0.5 truncate">{description}</div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ToggleSwitch enabled={enabled} onToggle={onToggle} />
        </div>
      </div>
      {isOpen && enabled && children && (
        <div className="px-4 pb-3 pt-1 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────
export default function BuilderPageWrapper() {
  return (
    <Suspense fallback={
      <AppShell title="Strategy Builder">
        <div className="flex items-center justify-center h-96">
          <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
        </div>
      </AppShell>
    }>
      <BuilderPage />
    </Suspense>
  );
}

function BuilderPage() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savedStrategyId, setSavedStrategyId] = useState<number | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [showChangelogInput, setShowChangelogInput] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const [manualCodeEdit, setManualCodeEdit] = useState(false);
  const [editableCode, setEditableCode] = useState("");
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [strategyName, setStrategyName] = useState("MyNewStrategy");
  const [description, setDescription] = useState(
    "EMA crossover strategy with RSI filter for BTC perpetual futures."
  );
  const [exchange, setExchange] = useState("Binance (Futures)");
  const [timeframe, setTimeframe] = useState("1h");
  const [leverage, setLeverage] = useState("10x");
  const [marginMode, setMarginMode] = useState("Isolated");
  const [tradingMode, setTradingMode] = useState("futures");
  const [liquidationBuffer, setLiquidationBuffer] = useState(0.05);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(["BTC/USDT:USDT"]);
  const [addPairInput, setAddPairInput] = useState("");
  const [showAddPairInput, setShowAddPairInput] = useState(false);
  const [availablePairs, setAvailablePairs] = useState<{icon: string; pair: string}[]>(tradingPairs);
  const [indicators, setIndicators] = useState(() => {
    const map: Record<string, boolean> = {};
    indicatorGroups.forEach((g) =>
      g.items.forEach((item) => {
        map[item.name] = item.selected;
      })
    );
    return map;
  });
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [longConditions, setLongConditions] = useState<Condition[]>(defaultLongConditions);
  const [shortConditions, setShortConditions] = useState<Condition[]>(defaultShortConditions);
  const [exitConditions, setExitConditions] = useState<Condition[]>(defaultExitConditions);

  // Risk state
  const [stoploss, setStoploss] = useState(-0.035);
  const [stakeAmount, setStakeAmount] = useState(1000);
  const [maxOpenTrades, setMaxOpenTrades] = useState(3);
  const [trailingStop, setTrailingStop] = useState(true);
  const [trailingStopPositive, setTrailingStopPositive] = useState(0.01);
  const [trailingStopPositiveOffset, setTrailingStopPositiveOffset] = useState(0.02);
  const [trailingOnlyOffsetIsReached, setTrailingOnlyOffsetIsReached] = useState(true);
  const [roiTable, setRoiTable] = useState(defaultRoiTable);
  const [stoplossGuard, setStoplossGuard] = useState(true);
  const [maxDrawdown, setMaxDrawdown] = useState(true);
  const [cooldownPeriod, setCooldownPeriod] = useState(true);

  // Additional stoploss types
  const [stoplossType, setStoplossType] = useState<"fixed" | "trailing" | "trailing_offset" | "custom_callback" | "on_exchange">("trailing");
  const [stoplossOnExchange, setStoplossOnExchange] = useState(false);
  const [stoplossOnExchangeLimitRatio, setStoplossOnExchangeLimitRatio] = useState(0.99);
  const [stoplossOnExchangeInterval, setStoplossOnExchangeInterval] = useState(60);
  const [stoplossOnExchangePriceType, setStoplossOnExchangePriceType] = useState<"last" | "mark" | "index">("last");

  // Callback state — which callbacks are enabled
  const [enabledCallbacks, setEnabledCallbacks] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    callbackDefs.forEach((cb) => { map[cb.key] = false; });
    return map;
  });

  // Callback params
  const [stakePreset, setStakePreset] = useState<"fixed" | "percent" | "kelly">("fixed");
  const [stakeFixedAmount, setStakeFixedAmount] = useState(100);
  const [stakePercent, setStakePercent] = useState(10);
  const [stoplossPreset, setStoplossPreset] = useState<"time_based" | "profit_based" | "atr_based">("profit_based");
  const [entryPriceOffset, setEntryPriceOffset] = useState(0.002);
  const [exitPriceOffset, setExitPriceOffset] = useState(0.002);
  const [entryTimeoutMinutes, setEntryTimeoutMinutes] = useState(30);
  const [exitTimeoutMinutes, setExitTimeoutMinutes] = useState(30);
  const [dcaLevels, setDcaLevels] = useState(3);
  const [dcaMultiplier, setDcaMultiplier] = useState(1.5);
  const [leveragePreset, setLeveragePreset] = useState<"fixed" | "dynamic">("fixed");
  const [leverageFixedValue, setLeverageFixedValue] = useState(10);

  // Strategy interface / config state (§2, §14)
  const [startupCandleCount, setStartupCandleCount] = useState(200);
  const [processOnlyNewCandles, setProcessOnlyNewCandles] = useState(true);
  const [strategyVersion, setStrategyVersion] = useState("1");
  const [orderTypeEntry, setOrderTypeEntry] = useState<"market" | "limit">("market");
  const [orderTypeExit, setOrderTypeExit] = useState<"market" | "limit">("market");
  const [orderTypeEmergencyExit, setOrderTypeEmergencyExit] = useState<"market" | "limit">("market");
  const [orderTypeForceEntry, setOrderTypeForceEntry] = useState<"market" | "limit">("market");
  const [orderTypeForceExit, setOrderTypeForceExit] = useState<"market" | "limit">("market");
  const [orderTypeStoploss, setOrderTypeStoploss] = useState<"market" | "limit">("market");
  const [orderTifEntry, setOrderTifEntry] = useState<"GTC" | "FOK" | "IOC" | "PO">("GTC");
  const [orderTifExit, setOrderTifExit] = useState<"GTC" | "FOK" | "IOC" | "PO">("GTC");
  const [informativePairs, setInformativePairs] = useState<{pair: string; timeframe: string}[]>([]);
  const [infoPairInput, setInfoPairInput] = useState("");
  const [infoTfInput, setInfoTfInput] = useState("1h");

  function goStep(n: number) {
    setCurrentStep(n);
  }
  function nextStep() {
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  }
  function prevStep() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  // ─── Fetch whitelist from first bot on mount (M8) ───────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bots = await getBots();
        if (cancelled || !bots || bots.length === 0) return;
        const wl = await botWhitelist(bots[0].id);
        if (cancelled) return;
        if (wl.whitelist && wl.whitelist.length > 0) {
          setAvailablePairs(
            wl.whitelist.map((p: string) => ({ icon: "", pair: p }))
          );
        }
      } catch { /* non-blocking */
        // Fallback to hardcoded tradingPairs — already set as default
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Re-edit: load strategy from URL param ────────────
  useEffect(() => {
    const strategyIdParam = searchParams.get("strategyId");
    if (!strategyIdParam) return;
    const sid = parseInt(strategyIdParam, 10);
    if (isNaN(sid)) return;

    setLoadingStrategy(true);
    getStrategy(sid)
      .then((strat) => {
        setSavedStrategyId(strat.id);
        setStrategyName(strat.name);
        if (strat.description) setDescription(strat.description);
        if (strat.exchange) setExchange(strat.exchange);
        if (strat.timeframe) setTimeframe(strat.timeframe);

        // Try to restore builder_state JSON
        const rawState = strat.builder_state;
        if (rawState && typeof rawState === "string") {
          try {
            const bs: BuilderState = JSON.parse(rawState);
            if (bs.leverage) setLeverage(bs.leverage);
            if (bs.marginMode) setMarginMode(bs.marginMode);
            if (bs.tradingMode) setTradingMode(bs.tradingMode);
            if (bs.liquidationBuffer != null) setLiquidationBuffer(bs.liquidationBuffer);
            if (bs.selectedPairs) setSelectedPairs(bs.selectedPairs);
            if (bs.indicators) setIndicators(bs.indicators);
            if (bs.longConditions) setLongConditions(bs.longConditions);
            if (bs.shortConditions) setShortConditions(bs.shortConditions);
            if (bs.exitConditions) setExitConditions(bs.exitConditions);
            if (bs.stoploss != null) setStoploss(bs.stoploss);
            if (bs.stakeAmount != null) setStakeAmount(bs.stakeAmount);
            if (bs.maxOpenTrades != null) setMaxOpenTrades(bs.maxOpenTrades);
            if (bs.trailingStop != null) setTrailingStop(bs.trailingStop);
            if (bs.trailingStopPositive != null) setTrailingStopPositive(bs.trailingStopPositive);
            if (bs.trailingStopPositiveOffset != null) setTrailingStopPositiveOffset(bs.trailingStopPositiveOffset);
            if (bs.trailingOnlyOffsetIsReached != null) setTrailingOnlyOffsetIsReached(bs.trailingOnlyOffsetIsReached);
            if (bs.roiTable) setRoiTable(bs.roiTable);
            if (bs.stoplossGuard != null) setStoplossGuard(bs.stoplossGuard);
            if (bs.maxDrawdown != null) setMaxDrawdown(bs.maxDrawdown);
            if (bs.cooldownPeriod != null) setCooldownPeriod(bs.cooldownPeriod);
            if (bs.stoplossType) setStoplossType(bs.stoplossType);
            if (bs.stoplossOnExchange != null) setStoplossOnExchange(bs.stoplossOnExchange);
            if (bs.enabledCallbacks) setEnabledCallbacks(bs.enabledCallbacks);
            if (bs.stakePreset) setStakePreset(bs.stakePreset);
            if (bs.stakeFixedAmount != null) setStakeFixedAmount(bs.stakeFixedAmount);
            if (bs.stakePercent != null) setStakePercent(bs.stakePercent);
            if (bs.stoplossPreset) setStoplossPreset(bs.stoplossPreset);
            if (bs.entryPriceOffset != null) setEntryPriceOffset(bs.entryPriceOffset);
            if (bs.exitPriceOffset != null) setExitPriceOffset(bs.exitPriceOffset);
            if (bs.dcaLevels != null) setDcaLevels(bs.dcaLevels);
            if (bs.dcaMultiplier != null) setDcaMultiplier(bs.dcaMultiplier);
            if (bs.leveragePreset) setLeveragePreset(bs.leveragePreset);
            if (bs.leverageFixedValue != null) setLeverageFixedValue(bs.leverageFixedValue);
            if (bs.startupCandleCount != null) setStartupCandleCount(bs.startupCandleCount);
            if (bs.processOnlyNewCandles != null) setProcessOnlyNewCandles(bs.processOnlyNewCandles);
            if (bs.strategyVersion) setStrategyVersion(bs.strategyVersion);
            if (bs.orderTypeEntry) setOrderTypeEntry(bs.orderTypeEntry);
            if (bs.orderTypeExit) setOrderTypeExit(bs.orderTypeExit);
            if (bs.orderTypeStoploss) setOrderTypeStoploss(bs.orderTypeStoploss);
            if (bs.orderTifEntry) setOrderTifEntry(bs.orderTifEntry);
            if (bs.orderTypeEmergencyExit) setOrderTypeEmergencyExit(bs.orderTypeEmergencyExit);
            if (bs.orderTypeForceEntry) setOrderTypeForceEntry(bs.orderTypeForceEntry);
            if (bs.orderTypeForceExit) setOrderTypeForceExit(bs.orderTypeForceExit);
            if (bs.orderTifExit) setOrderTifExit(bs.orderTifExit);
            if (bs.informativePairs) setInformativePairs(bs.informativePairs);
            if (bs.stoplossOnExchangeLimitRatio != null) setStoplossOnExchangeLimitRatio(bs.stoplossOnExchangeLimitRatio);
            if (bs.stoplossOnExchangeInterval != null) setStoplossOnExchangeInterval(bs.stoplossOnExchangeInterval);
            if (bs.stoplossOnExchangePriceType) setStoplossOnExchangePriceType(bs.stoplossOnExchangePriceType);
            if (bs.entryTimeoutMinutes != null) setEntryTimeoutMinutes(bs.entryTimeoutMinutes);
            if (bs.exitTimeoutMinutes != null) setExitTimeoutMinutes(bs.exitTimeoutMinutes);
            toast.success(`Loaded strategy "${strat.name}" into Builder.`);
          } catch { /* non-blocking */
            // builder_state parse failed, fallback to code-only mode
            setEditorMode("code");
            setManualCodeEdit(true);
            toast.warning("Could not restore wizard state. Showing code editor.");
          }
        } else if (strat.code) {
          // No builder_state — code-only mode
          setEditableCode(strat.code);
          setEditorMode("code");
          setManualCodeEdit(true);
          toast.info("No wizard state saved. Showing code editor.");
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load strategy.");
      })
      .finally(() => setLoadingStrategy(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Fetch versions when strategy is loaded ────────────────
  useEffect(() => {
    if (!savedStrategyId) {
      setVersions([]);
      setCurrentVersion(null);
      return;
    }
    (async () => {
      try {
        const versionList = await getStrategyVersions(savedStrategyId);
        setVersions(versionList);
        if (versionList.length > 0) {
          // Set current version to the latest
          const latest = versionList[versionList.length - 1];
          setCurrentVersion(latest.version_number);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load versions.");
      }
    })();
  }, [savedStrategyId, toast]);

  function toggleCallback(key: string) {
    setEnabledCallbacks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ─── Generate strategy code from wizard state ────────────
  const generateStrategyCode = useMemo(() => {
    const className = strategyName.replace(/[^a-zA-Z0-9_]/g, "") || "MyStrategy";
    const needsQtpylib = [...longConditions, ...shortConditions, ...exitConditions].some(
      (c) => c.operator === "crosses above" || c.operator === "crosses below"
    );
    const needsDatetime = enabledCallbacks.check_entry_timeout || enabledCallbacks.check_exit_timeout
      || enabledCallbacks.custom_stoploss;
    const needsTrade = enabledCallbacks.custom_exit || enabledCallbacks.custom_stoploss
      || enabledCallbacks.confirm_trade_entry || enabledCallbacks.confirm_trade_exit
      || enabledCallbacks.adjust_trade_position || enabledCallbacks.order_filled
      || enabledCallbacks.custom_stake_amount || enabledCallbacks.custom_roi;

    // Collect selected indicators
    const selectedIndicatorNames = Object.entries(indicators)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const indicatorLines = selectedIndicatorNames
      .map((name) => indicatorToTalib[name])
      .filter(Boolean)
      .map((line) => `        ${line}`)
      .join("\n");

    // ROI
    const roiEntries = roiTable
      .map((r) => `        "${r.minutes}": ${(r.roi / 100).toFixed(4)}`)
      .join(",\n");

    // Protections
    const protLines: string[] = [];
    if (stoplossGuard) {
      protLines.push(
        '            {"method": "StoplossGuard",\n' +
        '             "lookback_period_candles": 1,\n' +
        '             "trade_limit": 3,\n' +
        '             "stop_duration_candles": 30}'
      );
    }
    if (maxDrawdown) {
      protLines.push(
        '            {"method": "MaxDrawdown",\n' +
        '             "lookback_period_candles": 48,\n' +
        '             "max_allowed_drawdown": 0.05,\n' +
        '             "stop_duration_candles": 12}'
      );
    }
    if (cooldownPeriod) {
      protLines.push(
        '            {"method": "CooldownPeriod",\n' +
        '             "stop_duration_candles": 5}'
      );
    }

    const protectionsBlock = protLines.length > 0
      ? `\n    @property\n    def protections(self):\n        return [\n${protLines.join(",\n")}\n        ]`
      : "";

    // Entry conditions
    const longBlock = longConditions.length > 0
      ? `        # Long entry\n        df.loc[\n            ${longConditions.map(conditionToCode).join(" &\n            ")},\n            "enter_long"\n        ] = 1\n`
      : "";

    const shortBlock = shortConditions.length > 0
      ? `\n        # Short entry\n        df.loc[\n            ${shortConditions.map(conditionToCode).join(" &\n            ")},\n            "enter_short"\n        ] = 1\n`
      : "";

    // Exit conditions
    const exitLongBlock = exitConditions.length > 0
      ? `        # Exit long\n        df.loc[\n            ${exitConditions.map(conditionToCode).join(" &\n            ")},\n            "exit_long"\n        ] = 1\n`
      : "";

    // Stoploss type code
    let trailingBlock = "";
    if (stoplossType === "fixed") {
      trailingBlock = "\n    trailing_stop = False";
    } else if (stoplossType === "trailing") {
      trailingBlock = `\n    # -- Trailing stop --\n    trailing_stop = True\n    trailing_stop_positive = ${trailingStopPositive}\n    trailing_stop_positive_offset = ${trailingStopPositiveOffset}\n    trailing_only_offset_is_reached = ${trailingOnlyOffsetIsReached ? "True" : "False"}`;
    } else if (stoplossType === "trailing_offset") {
      trailingBlock = `\n    # -- Trailing stop with offset --\n    trailing_stop = True\n    trailing_stop_positive = ${trailingStopPositive}\n    trailing_stop_positive_offset = ${trailingStopPositiveOffset}\n    trailing_only_offset_is_reached = True`;
    } else if (stoplossType === "custom_callback") {
      trailingBlock = "\n    trailing_stop = False\n    # Uses custom_stoploss callback (see below)";
    } else if (stoplossType === "on_exchange") {
      trailingBlock = `\n    trailing_stop = False\n    # -- On-exchange stoploss --\n    # Configured via order_types: "stoploss_on_exchange": True`;
    }

    // Leverage value
    const levNum = leverage.replace(/[^0-9]/g, "") || "1";

    const canShort = shortConditions.length > 0;

    // Order types
    const orderTypesBlock = `\n    order_types = {\n        "entry": "${orderTypeEntry}",\n        "exit": "${orderTypeExit}",\n        "emergency_exit": "${orderTypeEmergencyExit}",\n        "force_entry": "${orderTypeForceEntry}",\n        "force_exit": "${orderTypeForceExit}",\n        "stoploss": "${orderTypeStoploss}",\n        "stoploss_on_exchange": ${stoplossOnExchange ? "True" : "False"},${stoplossOnExchange ? `\n        "stoploss_on_exchange_limit_ratio": ${stoplossOnExchangeLimitRatio},\n        "stoploss_on_exchange_interval": ${stoplossOnExchangeInterval},\n        "stoploss_price_type": "${stoplossOnExchangePriceType}",` : ""}\n    }`;

    const orderTifBlock = `\n    order_time_in_force = {\n        "entry": "${orderTifEntry}",\n        "exit": "${orderTifExit}",\n    }`;

    // Informative pairs
    let informativePairsBlock = "";
    if (informativePairs.length > 0) {
      const pairLines = informativePairs.map((ip) => `            ("${ip.pair}", "${ip.timeframe}"),`).join("\n");
      informativePairsBlock = `\n    def informative_pairs(self):\n        return [\n${pairLines}\n        ]\n`;
    }

    // Callbacks code generation
    const callbackBlocks: string[] = [];

    if (enabledCallbacks.bot_start) {
      callbackBlocks.push(`\n    def bot_start(self, **kwargs) -> None:\n        """Called once at bot startup."""\n        pass`);
    }
    if (enabledCallbacks.bot_loop_start) {
      callbackBlocks.push(`\n    def bot_loop_start(self, current_time, **kwargs) -> None:\n        """Called at the start of every bot iteration."""\n        pass`);
    }
    if (enabledCallbacks.custom_stake_amount) {
      let body = "        return self.wallets.get_trade_stake_amount(pair, max_stake)";
      if (stakePreset === "fixed") {
        body = `        return ${stakeFixedAmount}.0`;
      } else if (stakePreset === "percent") {
        body = `        # ${stakePercent}% of available balance\n        return self.wallets.get_free(self.config["stake_currency"]) * ${(stakePercent / 100).toFixed(2)}`;
      } else if (stakePreset === "kelly") {
        body = `        # Kelly criterion placeholder\n        # Implement win_rate and win_loss_ratio calculation\n        win_rate = 0.55\n        win_loss_ratio = 1.5\n        kelly_pct = win_rate - ((1 - win_rate) / win_loss_ratio)\n        kelly_pct = max(0, min(kelly_pct, 0.25))  # Cap at 25%\n        return self.wallets.get_free(self.config["stake_currency"]) * kelly_pct`;
      }
      callbackBlocks.push(`\n    def custom_stake_amount(self, pair: str, current_time, current_rate: float,\n                           proposed_stake: float, min_stake, max_stake: float,\n                           leverage: float, entry_tag, side: str, **kwargs) -> float:\n${body}`);
    }
    if (enabledCallbacks.custom_exit) {
      callbackBlocks.push(`\n    def custom_exit(self, pair: str, trade, current_time,\n                   current_rate: float, current_profit: float,\n                   **kwargs):\n        """Return string reason to exit, or None to hold."""\n        return None`);
    }
    if (enabledCallbacks.custom_stoploss) {
      let body = "        return self.stoploss";
      if (stoplossPreset === "time_based") {
        body = `        # Time-based stoploss: tighten over time\n        trade_duration = (current_time - trade.open_date_utc).total_seconds() / 3600\n        if trade_duration > 24:\n            return -0.01  # 1% after 24h\n        elif trade_duration > 12:\n            return -0.02  # 2% after 12h\n        return -0.05  # 5% initial`;
      } else if (stoplossPreset === "profit_based") {
        body = `        # Profit-based stoploss: lock in profit\n        if current_profit > 0.10:\n            return -0.02  # Lock 8% if 10% profit reached\n        elif current_profit > 0.05:\n            return -0.03  # Lock 2% if 5% profit reached\n        return -0.05  # Default 5% stoploss`;
      } else if (stoplossPreset === "atr_based") {
        body = `        # ATR-based stoploss\n        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)\n        if len(dataframe) > 0:\n            last_candle = dataframe.iloc[-1]\n            if "atr" in last_candle:\n                atr_sl = (last_candle["atr"] / current_rate) * -2\n                return max(atr_sl, -0.10)  # Cap at -10%\n        return -0.05`;
      }
      callbackBlocks.push(`\n    def custom_stoploss(self, pair: str, trade,\n                        current_time, current_rate: float,\n                        current_profit: float, after_fill: bool,\n                        **kwargs) -> float:\n${body}`);
    }
    if (enabledCallbacks.custom_roi) {
      callbackBlocks.push(`\n    def custom_roi(self, pair: str, trade, current_time,\n                   current_profit: float, **kwargs):\n        """Return custom ROI or None to use minimal_roi."""\n        return None`);
    }
    if (enabledCallbacks.custom_entry_price) {
      callbackBlocks.push(`\n    def custom_entry_price(self, pair: str, trade,\n                           current_time, proposed_rate: float,\n                           entry_tag, side: str, **kwargs) -> float:\n        # Offset entry by ${(entryPriceOffset * 100).toFixed(1)}%\n        if side == "long":\n            return proposed_rate * (1 - ${entryPriceOffset})\n        return proposed_rate * (1 + ${entryPriceOffset})`);
    }
    if (enabledCallbacks.custom_exit_price) {
      callbackBlocks.push(`\n    def custom_exit_price(self, pair: str, trade,\n                          current_time, proposed_rate: float,\n                          current_profit: float, exit_tag: str,\n                          **kwargs) -> float:\n        # Offset exit by ${(exitPriceOffset * 100).toFixed(1)}%\n        if trade.is_short:\n            return proposed_rate * (1 - ${exitPriceOffset})\n        return proposed_rate * (1 + ${exitPriceOffset})`);
    }
    if (enabledCallbacks.check_entry_timeout) {
      callbackBlocks.push(`\n    def check_entry_timeout(self, pair: str, trade,\n                            order, current_time, **kwargs) -> bool:\n        # Cancel entry if not filled within ${entryTimeoutMinutes} minutes\n        if (current_time - order.order_date_utc).total_seconds() > ${entryTimeoutMinutes * 60}:\n            return True\n        return False`);
    }
    if (enabledCallbacks.check_exit_timeout) {
      callbackBlocks.push(`\n    def check_exit_timeout(self, pair: str, trade,\n                           order, current_time, **kwargs) -> bool:\n        # Cancel exit if not filled within ${exitTimeoutMinutes} minutes\n        if (current_time - order.order_date_utc).total_seconds() > ${exitTimeoutMinutes * 60}:\n            return True\n        return False`);
    }
    if (enabledCallbacks.confirm_trade_entry) {
      callbackBlocks.push(`\n    def confirm_trade_entry(self, pair: str, order_type: str,\n                            amount: float, rate: float,\n                            time_in_force: str, current_time,\n                            entry_tag, side: str, **kwargs) -> bool:\n        """Return False to abort entry."""\n        return True`);
    }
    if (enabledCallbacks.confirm_trade_exit) {
      callbackBlocks.push(`\n    def confirm_trade_exit(self, pair: str, trade,\n                           order_type: str, amount: float,\n                           rate: float, time_in_force: str,\n                           exit_reason: str, current_time,\n                           **kwargs) -> bool:\n        """Return False to abort exit."""\n        return True`);
    }
    if (enabledCallbacks.adjust_trade_position) {
      callbackBlocks.push(`\n    def adjust_trade_position(self, trade, current_time,\n                              current_rate: float,\n                              current_profit: float,\n                              min_stake, max_stake: float,\n                              current_entry_rate: float,\n                              current_exit_rate: float,\n                              current_entry_profit: float,\n                              current_exit_profit: float,\n                              **kwargs):\n        # DCA: ${dcaLevels} levels, ${dcaMultiplier}x multiplier\n        filled_entries = trade.nr_of_successful_entries\n        if filled_entries >= ${dcaLevels + 1}:\n            return None  # Max DCA levels reached\n        if current_profit < -0.05 * filled_entries:\n            return trade.stake_amount * ${dcaMultiplier}\n        return None`);
    }
    if (enabledCallbacks.adjust_order_price) {
      callbackBlocks.push(`\n    def adjust_order_price(self, trade, order, pair: str,\n                           current_time, proposed_rate: float,\n                           current_order_rate: float,\n                           entry_tag, side: str, **kwargs):\n        """Return new price or None to keep current order price."""\n        return None`);
    }
    if (enabledCallbacks.leverage) {
      let body = `        return ${leverageFixedValue}.0`;
      if (leveragePreset === "dynamic") {
        body = `        # Dynamic leverage based on ATR volatility\n        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)\n        if len(dataframe) > 0:\n            last_candle = dataframe.iloc[-1]\n            if "atr" in last_candle:\n                volatility = last_candle["atr"] / current_rate\n                if volatility > 0.03:\n                    return min(3.0, max_leverage)\n                elif volatility > 0.01:\n                    return min(5.0, max_leverage)\n        return min(${leverageFixedValue}.0, max_leverage)`;
      }
      callbackBlocks.push(`\n    def leverage(self, pair, current_time,\n                current_rate, proposed_leverage,\n                max_leverage, entry_tag,\n                side, **kwargs) -> float:\n${body}`);
    }
    if (enabledCallbacks.order_filled) {
      callbackBlocks.push(`\n    def order_filled(self, pair: str, trade,\n                     order, current_time, **kwargs) -> None:\n        """Called when an order is filled."""\n        pass`);
    }
    if (enabledCallbacks.adjust_entry_price) {
      callbackBlocks.push(`\n    def adjust_entry_price(self, trade, order, pair: str,\n                           current_time, proposed_rate: float,\n                           current_order_rate: float,\n                           entry_tag, side: str, **kwargs) -> float:\n        """Return updated entry price or None to cancel."""\n        return current_order_rate`);
    }
    if (enabledCallbacks.adjust_exit_price) {
      callbackBlocks.push(`\n    def adjust_exit_price(self, trade, order, pair: str,\n                          current_time, proposed_rate: float,\n                          current_order_rate: float,\n                          exit_tag, side: str, **kwargs) -> float:\n        """Return updated exit price or None to cancel."""\n        return current_order_rate`);
    }
    if (enabledCallbacks.plot_annotations) {
      callbackBlocks.push(`\n    def plot_annotations(self, pair: str, df: DataFrame,\n                          **kwargs) -> list:\n        """Return plot annotations for visual debugging."""\n        return []`);
    }

    // Build imports
    const imports = [
      "from freqtrade.strategy import IStrategy",
      "from pandas import DataFrame",
      "import talib.abstract as ta",
    ];
    if (needsQtpylib) imports.push("import freqtrade.vendor.qtpylib.indicators as qtpylib");
    if (needsDatetime) imports.push("from datetime import datetime, timedelta");
    if (needsTrade) imports.push("from freqtrade.persistence import Trade");

    // Build leverage callback — only add the default one if the callback isn't enabled
    const leverageMethodBlock = enabledCallbacks.leverage
      ? "" // Already in callbackBlocks
      : `\n    def leverage(self, pair, current_time,\n                current_rate, proposed_leverage,\n                max_leverage, entry_tag,\n                side, **kwargs) -> float:\n        return ${levNum}.0`;

    const code = `# --- Generated by FreqTrade Strategy Builder ---
# Strategy: ${className}
# Generated: ${new Date().toISOString().slice(0, 10)}

${imports.join("\n")}


class ${className}(IStrategy):
    """
    ${description || "Strategy generated by FreqTrade Strategy Builder."}
    """

    # -- ROI table --
    minimal_roi = {
${roiEntries}
    }

    # -- Stoploss --
    stoploss = ${stoploss}
${trailingBlock}

    # -- Config --
    timeframe = "${timeframe}"
    can_short = ${canShort ? "True" : "False"}
    startup_candle_count = ${startupCandleCount}
    process_only_new_candles = ${processOnlyNewCandles ? "True" : "False"}
${orderTypesBlock}
${orderTifBlock}
${protectionsBlock}
${informativePairsBlock}
    def populate_indicators(self, df: DataFrame,
                             metadata: dict) -> DataFrame:
${indicatorLines || "        pass"}

        return df

    def populate_entry_trend(self, df: DataFrame,
                              metadata: dict) -> DataFrame:
${longBlock}${shortBlock}
        return df

    def populate_exit_trend(self, df: DataFrame,
                             metadata: dict) -> DataFrame:
${exitLongBlock}
        return df
${leverageMethodBlock}${callbackBlocks.join("")}

    @staticmethod
    def version() -> str:
        return "${strategyVersion}"`;

    return code;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    strategyName, description, timeframe, leverage, indicators,
    longConditions, shortConditions, exitConditions,
    stoploss, trailingStop, trailingStopPositive, trailingStopPositiveOffset,
    trailingOnlyOffsetIsReached,
    roiTable, stoplossGuard, maxDrawdown, cooldownPeriod,
    stoplossType, stoplossOnExchange, stoplossOnExchangeLimitRatio,
    stoplossOnExchangeInterval, stoplossOnExchangePriceType,
    enabledCallbacks, stakePreset, stakeFixedAmount, stakePercent,
    stoplossPreset, entryPriceOffset, exitPriceOffset,
    entryTimeoutMinutes, exitTimeoutMinutes,
    dcaLevels, dcaMultiplier, leveragePreset, leverageFixedValue,
    startupCandleCount, processOnlyNewCandles, strategyVersion,
    orderTypeEntry, orderTypeExit, orderTypeEmergencyExit,
    orderTypeForceEntry, orderTypeForceExit, orderTypeStoploss,
    orderTifEntry, orderTifExit, informativePairs, tradingMode,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Add pair handler (C15) ────────────────────────────
  function handleAddPair() {
    const pair = addPairInput.trim().toUpperCase();
    if (!pair) return;
    // Ensure proper format
    const formatted = pair.includes(":") ? pair : pair.includes("/") ? `${pair}:USDT` : `${pair}/USDT:USDT`;
    if (!selectedPairs.includes(formatted)) {
      setSelectedPairs((prev) => [...prev, formatted]);
    }
    // Also add to available pairs if not present
    if (!availablePairs.some((p) => p.pair === formatted)) {
      setAvailablePairs((prev) => [...prev, { icon: "", pair: formatted }]);
    }
    setAddPairInput("");
    setShowAddPairInput(false);
  }

  // ─── Builder state snapshot (for re-edit) ──────────────
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  function getBuilderState(): BuilderState & Record<string, unknown> {
    return {
      strategyName, description, exchange, timeframe, leverage, marginMode, tradingMode,
      liquidationBuffer, selectedPairs, indicators, longConditions, shortConditions, exitConditions,
      stoploss, stakeAmount, maxOpenTrades, trailingStop, trailingStopPositive, trailingStopPositiveOffset,
      trailingOnlyOffsetIsReached, roiTable, stoplossGuard, maxDrawdown, cooldownPeriod,
      stoplossType, stoplossOnExchange, stoplossOnExchangeLimitRatio, stoplossOnExchangeInterval,
      stoplossOnExchangePriceType, enabledCallbacks, stakePreset, stakeFixedAmount, stakePercent,
      stoplossPreset, entryPriceOffset, exitPriceOffset, entryTimeoutMinutes, exitTimeoutMinutes,
      dcaLevels, dcaMultiplier, leveragePreset, leverageFixedValue, startupCandleCount,
      processOnlyNewCandles, strategyVersion, orderTypeEntry, orderTypeExit, orderTypeEmergencyExit,
      orderTypeForceEntry, orderTypeForceExit, orderTypeStoploss, orderTifEntry, orderTifExit,
      informativePairs,
    };
  }

  // ─── Save strategy (V2: creates versions) ────────────────
  const handleSaveStrategy = useCallback(async () => {
    if (!strategyName.trim()) { toast.warning("Strategy name is required."); return; }
    setSaving(true);
    const id = toast.loading(`Saving ${strategyName} to Orchestrator...`);
    const finalCode = manualCodeEdit ? editableCode : generateStrategyCode;
    try {
      const builderState = getBuilderState();
      const riskConfig = {
        stoploss,
        roi: Object.fromEntries(roiTable.map(r => [String(r.minutes), r.roi])),
        trailing_stop: trailingStop,
        trailing_stop_positive: trailingStopPositive,
        trailing_stop_positive_offset: trailingStopPositiveOffset,
        trailing_only_offset_is_reached: trailingOnlyOffsetIsReached,
        use_custom_stoploss: enabledCallbacks.custom_stoploss ?? false,
        protections: [
          ...(stoplossGuard ? [{ method: "StoplossGuard", lookback_period_candles: 24, trade_limit: 4, stop_duration_candles: 12 }] : []),
          ...(cooldownPeriod ? [{ method: "CooldownPeriod", stop_duration_candles: 5 }] : []),
          ...(maxDrawdown ? [{ method: "MaxDrawdownProtection", max_drawdown_percent: 10, lookback_period_minutes: 1440 }] : []),
        ],
      };

      // If new strategy, create base strategy record first
      if (!savedStrategyId) {
        const saveData = {
          name: strategyName,
          description,
          lifecycle: "draft",
        };
        const created = await createStrategy(saveData);
        setSavedStrategyId(created.id);

        // Now create v1
        const versionData = {
          code: finalCode,
          builder_state: builderState,
          risk_config: riskConfig,
          callbacks: enabledCallbacks,
          changelog: "Initial version",
        };
        const newVersion = await createStrategyVersion(created.id, versionData);
        setVersions([newVersion]);
        setCurrentVersion(newVersion.version_number);
        toast.dismiss(id);
        toast.success(`${strategyName} v${newVersion.version_number} saved as DRAFT.`);
      } else {
        // Existing strategy — create new version
        const versionData = {
          code: finalCode,
          builder_state: builderState,
          risk_config: riskConfig,
          callbacks: enabledCallbacks,
          changelog: changelog || "Updated strategy",
        };
        const newVersion = await createStrategyVersion(savedStrategyId, versionData);
        setVersions(prev => [...prev, newVersion]);
        setCurrentVersion(newVersion.version_number);
        setChangelog("");
        setShowChangelogInput(false);
        toast.dismiss(id);
        toast.success(`${strategyName} v${newVersion.version_number} saved. Loading for deployment...`);
      }
    } catch (err) {
      toast.dismiss(id);
      toast.error(
        err instanceof Error ? err.message : "Save failed.",
        { action: { label: "RETRY", onClick: handleSaveStrategy } }
      );
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyName, description, exchange, timeframe, selectedPairs, stoploss, stakeAmount, maxOpenTrades,
     trailingStop, trailingStopPositive, trailingStopPositiveOffset, trailingOnlyOffsetIsReached, roiTable,
     stoplossGuard, maxDrawdown, cooldownPeriod, indicators, longConditions,
     shortConditions, exitConditions, generateStrategyCode, manualCodeEdit, editableCode,
     savedStrategyId, changelog, enabledCallbacks, toast]);

  function togglePair(pair: string) {
    setSelectedPairs((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    );
  }

  function toggleIndicator(name: string) {
    setIndicators((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function addCondition(
    setter: React.Dispatch<React.SetStateAction<Condition[]>>
  ) {
    setter((prev) => [
      ...prev,
      { indicator: "EMA (20)", operator: ">", compareType: "value", compareIndicator: "", compareValue: 0 },
    ]);
  }

  function updateCondition(
    setter: React.Dispatch<React.SetStateAction<Condition[]>>,
    index: number,
    field: keyof Condition,
    value: string | number
  ) {
    setter((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addRoiRow() {
    setRoiTable((prev) => [...prev, { minutes: 0, roi: 0 }]);
  }

  function updateRoi(index: number, field: "minutes" | "roi", value: number) {
    setRoiTable((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addInformativePair() {
    const pair = infoPairInput.trim().toUpperCase();
    if (!pair) return;
    const formatted = pair.includes(":") ? pair : pair.includes("/") ? `${pair}:USDT` : `${pair}/USDT:USDT`;
    setInformativePairs((prev) => [...prev, { pair: formatted, timeframe: infoTfInput }]);
    setInfoPairInput("");
  }

  function removeInformativePair(index: number) {
    setInformativePairs((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Render helpers ──────────────────────────────────────

  function renderConditionBlock(
    conditions: Condition[],
    setter: React.Dispatch<React.SetStateAction<Condition[]>>,
    labelPrefix: string,
    addLabel: string
  ) {
    return (
      <>
        {conditions.map((cond, i) => (
          <div key={`cond-${i}-${cond.indicator}`}>
            {i > 0 && (
              <div className="text-xs font-semibold text-primary text-center py-1">AND</div>
            )}
            <div className="flex items-center gap-2.5 p-3 px-4 bg-muted/50 border border-border rounded-lg flex-wrap">
              <span className="text-xs text-muted-foreground min-w-[30px]">
                {i === 0 ? labelPrefix : "AND"}
              </span>
              <select
                className="px-3 py-2 rounded border border-border bg-muted text-foreground text-xs font-inherit outline-none focus:border-primary"
                value={cond.indicator}
                onChange={(e) => updateCondition(setter, i, "indicator", e.target.value)}
              >
                {indicatorChoices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 rounded border border-border bg-muted text-foreground text-xs font-inherit outline-none focus:border-primary"
                value={cond.operator}
                onChange={(e) => updateCondition(setter, i, "operator", e.target.value)}
              >
                {operatorChoices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {cond.compareType === "indicator" ? (
                <select
                  className="px-3 py-2 rounded border border-border bg-muted text-foreground text-xs font-inherit outline-none focus:border-primary"
                  value={cond.compareIndicator}
                  onChange={(e) => updateCondition(setter, i, "compareIndicator", e.target.value)}
                >
                  {compareChoices.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  className="w-[70px] px-3 py-2 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center"
                  value={cond.compareValue}
                  onChange={(e) => updateCondition(setter, i, "compareValue", Number(e.target.value))}
                />
              )}
            </div>
          </div>
        ))}
        <div
          className="flex items-center gap-1.5 p-2 px-3.5 rounded-lg border border-dashed border-border text-muted-foreground text-xs cursor-pointer hover:border-primary hover:text-primary transition-colors mt-2"
          onClick={() => addCondition(setter)}
        >
          + {addLabel}
        </div>
      </>
    );
  }

  // ─── Callback param renderers ──────────────────────────

  function renderStakeParams() {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Preset</div>
        <div className="flex gap-2">
          {(["fixed", "percent", "kelly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`px-3 py-1.5 rounded text-xs border transition-all ${
                stakePreset === p ? "border-primary bg-primary/[.12] text-primary" : "border-border bg-muted text-muted-foreground hover:border-border-border hover:border-ring"
              }`}
              onClick={() => setStakePreset(p)}
            >
              {p === "fixed" ? "Fixed Amount" : p === "percent" ? "% of Balance" : "Kelly Criterion"}
            </button>
          ))}
        </div>
        {stakePreset === "fixed" && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Amount:</span>
            <input type="number" className="w-24 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center" value={stakeFixedAmount} onChange={(e) => setStakeFixedAmount(Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">USDT</span>
          </div>
        )}
        {stakePreset === "percent" && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Percent:</span>
            <input type="number" className="w-20 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center" value={stakePercent} step={1} min={1} max={100} onChange={(e) => setStakePercent(Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        )}
        {stakePreset === "kelly" && (
          <div className="text-xs text-muted-foreground mt-2 leading-snug">Kelly criterion uses win rate and win/loss ratio to size positions. Default cap: 25% of balance.</div>
        )}
      </div>
    );
  }

  function renderStoplossPresetParams() {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground uppercase font-semibold mb-1">Preset</div>
        <div className="flex gap-2">
          {(["time_based", "profit_based", "atr_based"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`px-3 py-1.5 rounded text-xs border transition-all ${
                stoplossPreset === p ? "border-primary bg-primary/[.12] text-primary" : "border-border bg-muted text-muted-foreground hover:border-border-border hover:border-ring"
              }`}
              onClick={() => setStoplossPreset(p)}
            >
              {p === "time_based" ? "Time-Based" : p === "profit_based" ? "Profit-Based" : "ATR-Based"}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-2 leading-snug">
          {stoplossPreset === "time_based" && "Tightens stoploss over time: 5% initial -> 2% after 12h -> 1% after 24h."}
          {stoplossPreset === "profit_based" && "Locks in profit as it grows: 5% default, then 3% at 5% profit, then 2% at 10% profit."}
          {stoplossPreset === "atr_based" && "Uses ATR indicator to set stoploss at 2x ATR distance, capped at 10%."}
        </div>
      </div>
    );
  }

  function renderOffsetParams(value: number, setter: (v: number) => void, label: string) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}:</span>
        <input type="number" className="w-24 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center" value={value} step={0.001} onChange={(e) => setter(Number(e.target.value))} />
        <span className="text-xs text-muted-foreground">({(value * 100).toFixed(1)}%)</span>
      </div>
    );
  }

  function renderTimeThresholdParams(value: number, setter: (v: number) => void) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Cancel after:</span>
        <input type="number" className="w-20 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center" value={value} step={5} min={1} onChange={(e) => setter(Number(e.target.value))} />
        <span className="text-xs text-muted-foreground">minutes</span>
      </div>
    );
  }

  function renderDcaParams() {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">DCA levels:</span>
            <input type="number" className="w-16 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center" value={dcaLevels} min={1} max={10} onChange={(e) => setDcaLevels(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Multiplier:</span>
            <input type="number" className="w-16 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center" value={dcaMultiplier} step={0.1} min={1} onChange={(e) => setDcaMultiplier(Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">x</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground leading-snug">
          Adds to position when loss exceeds 5% per level. Each DCA order = stake_amount x {dcaMultiplier}x.
        </div>
      </div>
    );
  }

  function renderLeveragePresetParams() {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          {(["fixed", "dynamic"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`px-3 py-1.5 rounded text-xs border transition-all ${
                leveragePreset === p ? "border-primary bg-primary/[.12] text-primary" : "border-border bg-muted text-muted-foreground hover:border-border-border hover:border-ring"
              }`}
              onClick={() => setLeveragePreset(p)}
            >
              {p === "fixed" ? "Fixed" : "Dynamic (ATR-based)"}
            </button>
          ))}
        </div>
        {leveragePreset === "fixed" && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Leverage:</span>
            <input type="number" className="w-16 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center" value={leverageFixedValue} min={1} max={125} onChange={(e) => setLeverageFixedValue(Number(e.target.value))} />
            <span className="text-xs text-muted-foreground">x</span>
          </div>
        )}
        {leveragePreset === "dynamic" && (
          <div className="text-xs text-muted-foreground mt-1 leading-snug">Reduces leverage in high-volatility conditions using ATR. High vol: 3x, medium: 5x, low: {leverageFixedValue}x.</div>
        )}
      </div>
    );
  }

  function renderCallbackParams(cb: CallbackDef) {
    switch (cb.paramType) {
      case "stake_presets": return renderStakeParams();
      case "stoploss_presets": return renderStoplossPresetParams();
      case "offset_input":
        if (cb.key === "custom_entry_price") return renderOffsetParams(entryPriceOffset, setEntryPriceOffset, "Entry offset");
        return renderOffsetParams(exitPriceOffset, setExitPriceOffset, "Exit offset");
      case "time_threshold":
        if (cb.key === "check_entry_timeout") return renderTimeThresholdParams(entryTimeoutMinutes, setEntryTimeoutMinutes);
        return renderTimeThresholdParams(exitTimeoutMinutes, setExitTimeoutMinutes);
      case "dca_config": return renderDcaParams();
      case "leverage_presets": return renderLeveragePresetParams();
      default: return null;
    }
  }

  // ─── Step Panels ─────────────────────────────────────────

  function renderBasics() {
    return (
      <div className="space-y-6">
        {/* Strategy Name */}
        <div>
          <Tooltip content={TOOLTIPS.strategy_name?.description ?? "Name for this strategy"} configKey="strategy_name">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Strategy Name <span className="text-rose-500 text-sm">*</span>
            </label>
          </Tooltip>
          <input
            className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary placeholder:text-muted-foreground"
            type="text"
            placeholder="e.g. TrendFollowerV3"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <Tooltip content={"A brief description of what this strategy does and its approach"} configKey="description">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Description
            </label>
          </Tooltip>
          <textarea
            className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary placeholder:text-muted-foreground resize-y min-h-[60px]"
            placeholder="What does this strategy do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Exchange + Timeframe */}
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <Tooltip content={TOOLTIPS.exchange_name?.description ?? "Exchange to trade on"} configKey="exchange.name">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Exchange
              </label>
            </Tooltip>
            <select
              className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary cursor-pointer appearance-none"
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
            >
              {exchanges.map((ex) => (
                <option key={ex}>{ex}</option>
              ))}
            </select>
          </div>
          <div>
            <Tooltip content={TOOLTIPS.timeframe?.description ?? "Candle timeframe for the strategy"} configKey="timeframe">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Timeframe <span className="text-rose-500 text-sm">*</span>
              </label>
            </Tooltip>
            <select
              className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary cursor-pointer appearance-none"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              {timeframes.map((tf) => (
                <option key={tf}>{tf}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Trading Pairs */}
        <div>
          <Tooltip content={TOOLTIPS.exchange_pair_whitelist?.description ?? "Trading pairs for this strategy"} configKey="exchange.pair_whitelist">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Trading Pairs <span className="text-rose-500 text-sm">*</span>{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">&mdash; click to add</span>
            </label>
          </Tooltip>
          <div className="flex flex-wrap gap-2">
            {availablePairs.map((tp) => {
              const isSelected = selectedPairs.includes(tp.pair);
              return (
                <div
                  key={tp.pair}
                  className={`px-3.5 py-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "border-primary bg-primary/[.12] text-primary"
                      : "border-border bg-muted/50 text-muted-foreground hover:border-border-border hover:border-ring hover:bg-muted"
                  }`}
                  onClick={() => togglePair(tp.pair)}
                >
                  {tp.icon && <span className="text-sm">{tp.icon}</span>}
                  {tp.pair}
                  {isSelected && <span className="text-rose-500 font-bold ml-1">&times;</span>}
                </div>
              );
            })}
            {showAddPairInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  className="px-2.5 py-1.5 rounded border border-primary bg-muted/50 text-foreground text-xs outline-none placeholder:text-muted-foreground w-[140px]"
                  type="text"
                  placeholder="e.g. XRP/USDT:USDT"
                  value={addPairInput}
                  autoFocus
                  onChange={(e) => setAddPairInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddPair();
                    if (e.key === "Escape") { setShowAddPairInput(false); setAddPairInput(""); }
                  }}
                />
                <button
                  type="button"
                  className="px-2.5 py-1.5 rounded bg-primary text-white text-xs font-medium cursor-pointer"
                  onClick={handleAddPair}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 rounded border border-border bg-muted/50 text-muted-foreground text-xs cursor-pointer"
                  onClick={() => { setShowAddPairInput(false); setAddPairInput(""); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                className="px-3.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
                onClick={() => setShowAddPairInput(true)}
              >
                + Add pair
              </div>
            )}
          </div>
        </div>

        {/* Leverage/Futures Section (§10) */}
        <div>
          <Tooltip content={TOOLTIPS.trading_mode?.description ?? "Trading mode and leverage configuration"} configKey="trading_mode">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Trading Mode &amp; Leverage{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">&mdash; &sect;10 Leverage / Futures</span>
            </label>
          </Tooltip>
          <div className="grid grid-cols-3 gap-3.5">
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                <Tooltip
                  content={TOOLTIPS.trading_mode?.description || "Trading mode"}
                  configKey={TOOLTIPS.trading_mode?.configKey}
                >
                  Trading Mode
                </Tooltip>
              </div>
              <select
                className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary cursor-pointer appearance-none"
                value={tradingMode}
                onChange={(e) => setTradingMode(e.target.value)}
              >
                {tradingModes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                <Tooltip
                  content={TOOLTIPS.margin_mode?.description || "Margin mode"}
                  configKey={TOOLTIPS.margin_mode?.configKey}
                >
                  Margin Mode
                </Tooltip>
              </div>
              <select
                className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary cursor-pointer appearance-none"
                value={marginMode}
                onChange={(e) => setMarginMode(e.target.value)}
                disabled={tradingMode === "spot"}
              >
                {marginModes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                <Tooltip
                  content={TOOLTIPS.leverage?.description || "Leverage for futures trading"}
                  configKey={TOOLTIPS.leverage?.configKey}
                >
                  Leverage
                </Tooltip>
              </div>
              <select
                className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary cursor-pointer appearance-none"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                disabled={tradingMode === "spot"}
              >
                {leverageOptions.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          {tradingMode === "futures" && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <Tooltip
                  content={TOOLTIPS.liquidation_buffer?.description || "Buffer to maintain before liquidation"}
                  configKey={TOOLTIPS.liquidation_buffer?.configKey}
                >
                  <div className="text-xs text-muted-foreground">Liquidation Buffer</div>
                </Tooltip>
                <input
                  type="number"
                  className="w-20 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center"
                  value={liquidationBuffer}
                  step={0.01}
                  min={0}
                  max={0.5}
                  onChange={(e) => setLiquidationBuffer(Number(e.target.value))}
                />
                <div className="text-xs text-muted-foreground">({(liquidationBuffer * 100).toFixed(0)}% buffer before liquidation)</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderIndicators() {
    return (
      <div>
        <Tooltip content={"Technical indicators calculated in populate_indicators(). Select the ones your strategy will use for signals."} configKey="populate_indicators">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Select Indicators{" "}
            <span className="font-normal text-muted-foreground normal-case tracking-normal">
              &mdash; these will be calculated in populate_indicators()
            </span>
          </label>
        </Tooltip>
        <input
          className="w-full px-3.5 py-2.5 rounded-md border border-border bg-muted/50 text-foreground text-sm outline-none focus:border-primary placeholder:text-muted-foreground mb-4"
          type="text"
          placeholder="Search indicators... (EMA, RSI, Bollinger, MACD, ATR...)"
          value={indicatorSearch}
          onChange={(e) => setIndicatorSearch(e.target.value)}
        />

        {indicatorGroups.map((group) => {
          const filteredItems = indicatorSearch
            ? group.items.filter((item) =>
                item.name.toLowerCase().includes(indicatorSearch.toLowerCase())
              )
            : group.items;
          if (filteredItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredItems.map((item) => {
                  const isSelected = indicators[item.name];
                  return (
                    <div
                      key={item.name}
                      className={`px-3.5 py-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "border-primary bg-primary/[.12] text-primary"
                          : "border-border bg-muted/50 text-muted-foreground hover:border-border-border hover:border-ring hover:bg-muted"
                      }`}
                      onClick={() => toggleIndicator(item.name)}
                    >
                      <span className="text-sm">{item.icon}</span>
                      {item.name}
                      {isSelected && <span className="text-rose-500 font-bold ml-1">&times;</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderEntry() {
    return (
      <div className="space-y-6">
        {/* Long Entry */}
        <div>
          <Tooltip content={"Conditions that trigger long (buy) entries in populate_entry_trend(). All conditions must be true simultaneously."} configKey="populate_entry_trend">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Long Entry Conditions{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                &mdash; populate_entry_trend() buy signals
              </span>
            </label>
          </Tooltip>
          {renderConditionBlock(longConditions, setLongConditions, "IF", "Add condition")}
        </div>

        {/* Short Entry */}
        <div>
          <Tooltip content={"Conditions that trigger short (sell) entries. Leave empty for long-only strategies. Requires futures trading mode."} configKey="populate_entry_trend">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Short Entry Conditions{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                &mdash; optional, leave empty for long-only
              </span>
            </label>
          </Tooltip>
          {renderConditionBlock(shortConditions, setShortConditions, "IF", "Add condition")}
        </div>
      </div>
    );
  }

  function renderExit() {
    return (
      <div className="space-y-5">
        <div>
          <Tooltip content={"Custom exit signals defined in populate_exit_trend(). Optional — trades can also exit via stoploss, trailing_stop, and minimal_roi."} configKey="populate_exit_trend">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Custom Exit Conditions{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                &mdash; populate_exit_trend() signals (optional &mdash; stoploss/ROI also exits)
              </span>
            </label>
          </Tooltip>
          {renderConditionBlock(exitConditions, setExitConditions, "EXIT IF", "Add exit condition")}
        </div>

        {/* Info box */}
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <span className="text-sm">&#128161;</span> Exit Strategy Note
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            FreqTrade exits trades through multiple mechanisms: custom exit signals (above), stoploss,
            trailing_stop, and minimal_roi (configured in Step 5: Risk). You don&apos;t need custom exit
            signals if your stoploss/ROI config handles exits well. Many profitable strategies rely only
            on stoploss + trailing_stop.
          </div>
        </div>
      </div>
    );
  }

  function renderRisk() {
    return (
      <div className="space-y-5">
        {/* Risk cards grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {/* stoploss */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <span className="text-sm">&#128721;</span>
              <Tooltip
                content={TOOLTIPS.stoploss?.description || "Maximum loss per trade"}
                configKey={TOOLTIPS.stoploss?.configKey}
              >
                Stoploss
              </Tooltip>
            </div>
            <div className="text-xs text-muted-foreground mb-2.5 leading-snug">
              Maximum loss before FT closes the trade. Applied per trade.
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-2.5 py-2 rounded border border-border bg-muted text-foreground text-sm font-mono outline-none focus:border-primary text-center"
                type="number"
                value={stoploss}
                step={0.005}
                onChange={(e) => setStoploss(Number(e.target.value))}
              />
              <div className="text-xs text-muted-foreground min-w-[20px]">({(stoploss * 100).toFixed(1)}%)</div>
            </div>
          </div>

          {/* stake_amount */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <span className="text-sm">&#128207;</span>
              <Tooltip
                content={TOOLTIPS.stake_amount?.description || "Amount per trade"}
                configKey={TOOLTIPS.stake_amount?.configKey}
              >
                Stake Amount
              </Tooltip>
            </div>
            <div className="text-xs text-muted-foreground mb-2.5 leading-snug">
              Amount per trade in quote currency (USDT).
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-2.5 py-2 rounded border border-border bg-muted text-foreground text-sm font-mono outline-none focus:border-primary text-center"
                type="number"
                value={stakeAmount}
                step={100}
                onChange={(e) => setStakeAmount(Number(e.target.value))}
              />
              <div className="text-xs text-muted-foreground min-w-[20px]">USDT</div>
            </div>
          </div>

          {/* max_open_trades */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <span className="text-sm">&#128202;</span>
              <Tooltip
                content={TOOLTIPS.max_open_trades?.description || "Maximum concurrent trades"}
                configKey={TOOLTIPS.max_open_trades?.configKey}
              >
                Max Open Trades
              </Tooltip>
            </div>
            <div className="text-xs text-muted-foreground mb-2.5 leading-snug">
              Maximum concurrent open trades per bot.
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-2.5 py-2 rounded border border-border bg-muted text-foreground text-sm font-mono outline-none focus:border-primary text-center"
                type="number"
                value={maxOpenTrades}
                step={1}
                onChange={(e) => setMaxOpenTrades(Number(e.target.value))}
              />
              <div className="text-xs text-muted-foreground min-w-[20px]">trades</div>
            </div>
          </div>
        </div>

        {/* Stoploss Type Selector (§4) */}
        <div>
          <Tooltip content={TOOLTIPS.stoploss?.description ?? "Choose the stoploss mechanism: fixed, trailing, trailing with offset, custom callback, or on-exchange."} configKey="stoploss">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Stoploss Type{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                &mdash; &sect;4: 6 stoploss types
              </span>
            </label>
          </Tooltip>
          <div className="flex flex-wrap gap-2 mb-3">
            {([
              { value: "fixed" as const, label: "Fixed" },
              { value: "trailing" as const, label: "Trailing" },
              { value: "trailing_offset" as const, label: "Trailing + Offset" },
              { value: "custom_callback" as const, label: "Custom Callback" },
              { value: "on_exchange" as const, label: "On Exchange" },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`px-3.5 py-2 rounded-lg border text-xs transition-all ${
                  stoplossType === opt.value
                    ? "border-primary bg-primary/[.12] text-primary font-semibold"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-border-border hover:border-ring"
                }`}
                onClick={() => setStoplossType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Trailing stop params */}
          {(stoplossType === "trailing" || stoplossType === "trailing_offset") && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  <Tooltip
                    content={TOOLTIPS.trailing_stop_positive?.description || "Profit stoploss distance"}
                    configKey={TOOLTIPS.trailing_stop_positive?.configKey}
                  >
                    Trailing Stop Positive
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 px-2.5 py-2 rounded border border-border bg-muted text-foreground text-sm font-mono outline-none focus:border-primary text-center"
                    type="number" value={trailingStopPositive} step={0.005}
                    onChange={(e) => setTrailingStopPositive(Number(e.target.value))}
                  />
                  <div className="text-xs text-muted-foreground">({(trailingStopPositive * 100).toFixed(0)}%)</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  <Tooltip
                    content={TOOLTIPS.trailing_stop_positive_offset?.description || "Offset for positive trailing stop"}
                    configKey={TOOLTIPS.trailing_stop_positive_offset?.configKey}
                  >
                    Trailing Stop Positive Offset
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 px-2.5 py-2 rounded border border-border bg-muted text-foreground text-sm font-mono outline-none focus:border-primary text-center"
                    type="number" value={trailingStopPositiveOffset} step={0.005}
                    onChange={(e) => setTrailingStopPositiveOffset(Number(e.target.value))}
                  />
                  <div className="text-xs text-muted-foreground">({(trailingStopPositiveOffset * 100).toFixed(0)}%)</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip
                  content={TOOLTIPS.trailing_only_offset_is_reached?.description || "Only use positive stoploss after offset is reached"}
                  configKey={TOOLTIPS.trailing_only_offset_is_reached?.configKey}
                >
                  <ToggleSwitch
                    enabled={trailingOnlyOffsetIsReached}
                    onToggle={() => setTrailingOnlyOffsetIsReached(!trailingOnlyOffsetIsReached)}
                  />
                </Tooltip>
              </div>
            </div>
          )}

          {/* Custom callback info */}
          {stoplossType === "custom_callback" && (
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground leading-relaxed">
                Uses the <span className="font-mono text-primary">custom_stoploss()</span> callback for dynamic stoploss logic.
                Enable it in Step 6: Callbacks and configure the preset there.
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {enabledCallbacks.custom_stoploss ? (
                    <span className="text-emerald-500 font-semibold">custom_stoploss callback is enabled</span>
                  ) : (
                    <span>custom_stoploss callback is disabled</span>
                  )}
                </div>
                <ToggleSwitch
                  enabled={enabledCallbacks.custom_stoploss}
                  onToggle={() => {
                    setEnabledCallbacks((prev) => ({ ...prev, custom_stoploss: !prev.custom_stoploss }));
                  }}
                />
              </div>
            </div>
          )}

          {/* On Exchange stoploss */}
          {stoplossType === "on_exchange" && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
              <Tooltip
                content={TOOLTIPS.stoploss_on_exchange?.description || "Place stoploss order on exchange"}
                configKey={TOOLTIPS.stoploss_on_exchange?.configKey}
              >
                <ToggleSwitch
                  enabled={stoplossOnExchange}
                  onToggle={() => setStoplossOnExchange(!stoplossOnExchange)}
                />
              </Tooltip>
              {stoplossOnExchange && (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      <Tooltip
                        content={TOOLTIPS.stoploss_on_exchange_limit_ratio?.description || "Limit ratio for exchange stoploss"}
                        configKey={TOOLTIPS.stoploss_on_exchange_limit_ratio?.configKey}
                      >
                        Limit Ratio
                      </Tooltip>
                    </div>
                    <input
                      type="number"
                      className="w-24 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center"
                      value={stoplossOnExchangeLimitRatio} step={0.01} min={0.9} max={1}
                      onChange={(e) => setStoplossOnExchangeLimitRatio(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      <Tooltip
                        content={TOOLTIPS.stoploss_on_exchange_interval?.description || "Update interval for exchange stoploss"}
                        configKey={TOOLTIPS.stoploss_on_exchange_interval?.configKey}
                      >
                        Update Interval (seconds)
                      </Tooltip>
                    </div>
                    <input
                      type="number"
                      className="w-24 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center"
                      value={stoplossOnExchangeInterval} step={10} min={10}
                      onChange={(e) => setStoplossOnExchangeInterval(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      <Tooltip
                        content={TOOLTIPS.stoploss_on_exchange_price_type?.description || "Price type for exchange stoploss"}
                        configKey={TOOLTIPS.stoploss_on_exchange_price_type?.configKey}
                      >
                        Price Type
                      </Tooltip>
                    </div>
                    <select
                      className="w-32 px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs outline-none focus:border-primary"
                      value={stoplossOnExchangePriceType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const v = e.target.value;
                        if (v === "last" || v === "mark" || v === "index") setStoplossOnExchangePriceType(v);
                      }}
                    >
                      <option value="last">last</option>
                      <option value="mark">mark</option>
                      <option value="index">index</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* minimal_roi */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <Tooltip
              content={TOOLTIPS.minimal_roi?.description || "Target ROI at different time intervals"}
              configKey={TOOLTIPS.minimal_roi?.configKey}
            >
              Minimal ROI
            </Tooltip>
            {" "}
            <span className="font-normal text-muted-foreground normal-case tracking-normal">
              &mdash; Return targets at minutes elapsed
            </span>
          </label>
          <div className="bg-muted/50 border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                    Minutes
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                    Min ROI (%)
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {roiTable.map((row, i) => (
                  <tr key={`roi-${row.minutes}-${i}`}>
                    <td className="px-3 py-2">
                      <input
                        className="w-full px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center"
                        type="number"
                        value={row.minutes}
                        onChange={(e) => updateRoi(i, "minutes", Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs font-mono outline-none focus:border-primary text-center"
                        type="number"
                        value={row.roi}
                        step={1}
                        onChange={(e) => updateRoi(i, "roi", Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {row.minutes === 0
                        ? `At entry: ${row.roi}%`
                        : `After ${row.minutes >= 60 ? `${row.minutes / 60}h` : `${row.minutes}m`}: ${row.roi}%${row.roi === 0 ? " (any profit)" : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              className="px-3 py-2 text-xs text-primary cursor-pointer hover:bg-muted transition-colors"
              onClick={addRoiRow}
            >
              + Add ROI level
            </div>
          </div>
        </div>

        {/* Protections */}
        <div>
          <Tooltip content={"FreqTrade built-in protections (§7). Per-bot safety mechanisms that pause trading when conditions are met."} configKey="protections">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              FT Protections{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                &mdash; per-bot safety handled by FreqTrade
              </span>
            </label>
          </Tooltip>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {/* StoplossGuard */}
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Tooltip content={TOOLTIPS.protection_stoploss_guard?.description ?? "Pause trading after N stoploss events in a time period"} configKey="protections[].method: StoplossGuard">
                  StoplossGuard
                </Tooltip>
              </div>
              <ToggleSwitch enabled={stoplossGuard} onToggle={() => setStoplossGuard(!stoplossGuard)} label="3 SL in 1h &rarr; lock 30m" />
            </div>

            {/* MaxDrawdown */}
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Tooltip content={TOOLTIPS.protection_max_drawdown?.description ?? "Pause trading when portfolio drawdown exceeds a threshold"} configKey="protections[].method: MaxDrawdown">
                  MaxDrawdown
                </Tooltip>
              </div>
              <ToggleSwitch enabled={maxDrawdown} onToggle={() => setMaxDrawdown(!maxDrawdown)} label="5% DD in 48h &rarr; lock 12h" />
            </div>

            {/* CooldownPeriod */}
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Tooltip content={TOOLTIPS.protection_cooldown_period?.description ?? "Cooldown period after a trade closes on a pair"} configKey="protections[].method: CooldownPeriod">
                  CooldownPeriod
                </Tooltip>
              </div>
              <ToggleSwitch enabled={cooldownPeriod} onToggle={() => setCooldownPeriod(!cooldownPeriod)} label="5 candles cooldown after trade" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCallbacks() {
    const enabledCount = Object.values(enabledCallbacks).filter(Boolean).length;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <Tooltip content={"IStrategy callbacks (§3). Enable callbacks to add custom logic for trade entry, exit, stoploss, position sizing, and more."} configKey="IStrategy callbacks">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Strategy Callbacks{" "}
                <span className="font-normal text-muted-foreground normal-case tracking-normal">
                  &mdash; &sect;3: 19 IStrategy callbacks
                </span>
              </label>
            </Tooltip>
            <div className="text-xs text-muted-foreground mt-1">
              {enabledCount} of 19 callbacks enabled. Each generates code in the strategy file.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2.5 py-1 rounded border border-border bg-muted/50 text-muted-foreground text-xs cursor-pointer hover:text-muted-foreground transition-all"
              onClick={() => {
                const allOff: Record<string, boolean> = {};
                callbackDefs.forEach((cb) => { allOff[cb.key] = false; });
                setEnabledCallbacks(allOff);
              }}
            >
              Disable All
            </button>
          </div>
        </div>

        {callbackDefs.map((cb) => (
          <CollapsibleSection
            key={cb.key}
            title={cb.name}
            description={cb.description}
            enabled={enabledCallbacks[cb.key]}
            onToggle={() => toggleCallback(cb.key)}
          >
            {cb.hasParams ? renderCallbackParams(cb) : (
              <div className="text-xs text-muted-foreground leading-snug">{cb.description}</div>
            )}
          </CollapsibleSection>
        ))}
      </div>
    );
  }

  function renderStrategyConfig() {
    return (
      <div className="space-y-6">
        {/* Strategy Interface (§2) */}
        <div>
          <Tooltip content={"IStrategy class attributes (§2). Core settings that define how the strategy behaves."} configKey="IStrategy">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Strategy Interface{" "}
              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                &mdash; &sect;2 IStrategy class attributes
              </span>
            </label>
          </Tooltip>

          <div className="grid grid-cols-2 gap-4">
            {/* startup_candle_count */}
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs font-semibold text-foreground mb-1">
                <Tooltip
                  content={TOOLTIPS.startup_candle_count?.description || "Candles needed before strategy starts"}
                  configKey={TOOLTIPS.startup_candle_count?.configKey}
                >
                  Startup Candle Count
                </Tooltip>
              </div>
              <div className="text-xs text-muted-foreground mb-2 leading-snug">
                Number of candles needed before the strategy starts generating signals.
              </div>
              <input
                type="number"
                className="w-full px-2.5 py-2 rounded border border-border bg-muted text-foreground text-sm font-mono outline-none focus:border-primary text-center"
                value={startupCandleCount} min={0} step={10}
                onChange={(e) => setStartupCandleCount(Number(e.target.value))}
              />
            </div>

            {/* process_only_new_candles */}
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs font-semibold text-foreground mb-1">
                <Tooltip
                  content={TOOLTIPS.process_only_new_candles?.description || "Only process on new candles"}
                  configKey={TOOLTIPS.process_only_new_candles?.configKey}
                >
                  Process Only New Candles
                </Tooltip>
              </div>
              <div className="text-xs text-muted-foreground mb-2 leading-snug">
                Only process indicators/signals when a new candle appears. Recommended: True.
              </div>
              <Tooltip
                content={TOOLTIPS.process_only_new_candles?.description || "Only process on new candles"}
                configKey={TOOLTIPS.process_only_new_candles?.configKey}
              >
                <ToggleSwitch
                  enabled={processOnlyNewCandles}
                  onToggle={() => setProcessOnlyNewCandles(!processOnlyNewCandles)}
                />
              </Tooltip>
            </div>

            {/* version */}
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs font-semibold text-foreground mb-1">
                <Tooltip
                  content={TOOLTIPS.strategy_version?.description || "Strategy version identifier"}
                  configKey={TOOLTIPS.strategy_version?.configKey}
                >
                  Strategy Version
                </Tooltip>
              </div>
              <div className="text-xs text-muted-foreground mb-2 leading-snug">
                Strategy version string. Used for tracking strategy changes.
              </div>
              <input
                type="text"
                className="w-full px-2.5 py-2 rounded border border-border bg-muted text-foreground text-sm font-mono outline-none focus:border-primary"
                value={strategyVersion}
                onChange={(e) => setStrategyVersion(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
          </div>
        </div>

        {/* Order Types (§2) */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <Tooltip
              content={TOOLTIPS.order_types?.description || "Order types for different order stages"}
              configKey={TOOLTIPS.order_types?.configKey}
            >
              Order Types
            </Tooltip>
            {" "}
            <span className="font-normal text-muted-foreground normal-case tracking-normal">
              &mdash; market or limit for each order type
            </span>
          </label>
          <div className="bg-muted/50 border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">Order Type</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">Value</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: "entry", value: orderTypeEntry, setter: setOrderTypeEntry },
                  { label: "exit", value: orderTypeExit, setter: setOrderTypeExit },
                  { label: "emergency_exit", value: orderTypeEmergencyExit, setter: setOrderTypeEmergencyExit },
                  { label: "force_entry", value: orderTypeForceEntry, setter: setOrderTypeForceEntry },
                  { label: "force_exit", value: orderTypeForceExit, setter: setOrderTypeForceExit },
                  { label: "stoploss", value: orderTypeStoploss, setter: setOrderTypeStoploss },
                ] as const).map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{row.label}</td>
                    <td className="px-3 py-2">
                      <select
                        className="px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs outline-none focus:border-primary"
                        value={row.value}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const v = e.target.value;
                          if (v === "market" || v === "limit") row.setter(v);
                        }}
                      >
                        <option value="market">market</option>
                        <option value="limit">limit</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Time in Force */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <Tooltip
              content={TOOLTIPS.order_time_in_force?.description || "Time in force for orders"}
              configKey={TOOLTIPS.order_time_in_force?.configKey}
            >
              Order Time in Force
            </Tooltip>
            {" "}
            <span className="font-normal text-muted-foreground normal-case tracking-normal">
              &mdash; GTC / FOK / IOC / PO
            </span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Entry</div>
              <select
                className="w-full px-2.5 py-2 rounded border border-border bg-muted text-foreground text-xs outline-none focus:border-primary"
                value={orderTifEntry}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const v = e.target.value;
                  if (v === "GTC" || v === "FOK" || v === "IOC" || v === "PO") setOrderTifEntry(v);
                }}
              >
                <option value="GTC">GTC (Good Till Cancelled)</option>
                <option value="FOK">FOK (Fill or Kill)</option>
                <option value="IOC">IOC (Immediate or Cancel)</option>
                <option value="PO">PO (Post Only)</option>
              </select>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Exit</div>
              <select
                className="w-full px-2.5 py-2 rounded border border-border bg-muted text-foreground text-xs outline-none focus:border-primary"
                value={orderTifExit}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const v = e.target.value;
                  if (v === "GTC" || v === "FOK" || v === "IOC" || v === "PO") setOrderTifExit(v);
                }}
              >
                <option value="GTC">GTC (Good Till Cancelled)</option>
                <option value="FOK">FOK (Fill or Kill)</option>
                <option value="IOC">IOC (Immediate or Cancel)</option>
                <option value="PO">PO (Post Only)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Informative Pairs */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <Tooltip
              content={TOOLTIPS.informative_pairs?.description || "Additional pairs and timeframes for analysis"}
              configKey={TOOLTIPS.informative_pairs?.configKey}
            >
              Informative Pairs
            </Tooltip>
            {" "}
            <span className="font-normal text-muted-foreground normal-case tracking-normal">
              &mdash; additional pairs/timeframes for multi-timeframe analysis
            </span>
          </label>
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            {informativePairs.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {informativePairs.map((ip, i) => (
                  <div key={`info-${i}-${ip.pair}-${ip.timeframe}`} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{ip.pair}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="font-mono text-primary">{ip.timeframe}</span>
                    <button
                      type="button"
                      className="ml-auto text-rose-500 text-xs cursor-pointer hover:underline"
                      onClick={() => removeInformativePair(i)}
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 px-2.5 py-1.5 rounded border border-border bg-muted text-foreground text-xs outline-none focus:border-primary placeholder:text-muted-foreground"
                placeholder="BTC/USDT:USDT"
                value={infoPairInput}
                onChange={(e) => setInfoPairInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addInformativePair(); }}
              />
              <select
                className="px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs outline-none focus:border-primary"
                value={infoTfInput}
                onChange={(e) => setInfoTfInput(e.target.value)}
              >
                {timeframes.map((tf) => (
                  <option key={tf}>{tf}</option>
                ))}
              </select>
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-primary text-white text-xs font-medium cursor-pointer"
                onClick={addInformativePair}
              >
                Add
              </button>
            </div>
            {informativePairs.length === 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                No informative pairs added. Add pairs here for multi-timeframe or cross-pair analysis.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderReview() {
    const selectedIndicators = Object.entries(indicators)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const enabledCallbackNames = Object.entries(enabledCallbacks)
      .filter(([, v]) => v)
      .map(([k]) => k);

    return (
      <div>
        {/* Success banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3.5 mb-5 flex items-center gap-2.5">
          <span className="text-xl">&#9989;</span>
          <div>
            <div className="text-sm font-semibold text-emerald-500">Strategy ready to save</div>
            <div className="text-xs text-muted-foreground">
              Review your configuration below. You can Save as Draft or Save &amp; Backtest immediately.
            </div>
          </div>
        </div>

        {/* Review grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Basics */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">Basics</h4>
            <div className="space-y-1">
              <ReviewRow label="Name" value={strategyName} />
              <ReviewRow label="Exchange" value={exchange} />
              <ReviewRow label="Timeframe" value={timeframe} />
              <ReviewRow label="Pairs" value={selectedPairs.join(", ")} />
              <ReviewRow label="trading_mode" value={tradingMode} />
              <ReviewRow label="margin_mode" value={tradingMode === "futures" ? marginMode.toLowerCase() : "n/a"} />
              <ReviewRow label="Leverage" value={`${leverage}`} />
              <ReviewRow label="Version" value={strategyVersion} />
            </div>
          </div>

          {/* Indicators */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
              Indicators ({selectedIndicators.length})
            </h4>
            <div className="space-y-1">
              {indicatorGroups.map((g) => {
                const active = g.items.filter((item) => indicators[item.name]);
                if (active.length === 0) return null;
                return (
                  <ReviewRow
                    key={g.label}
                    label={g.label}
                    value={active.map((a) => a.name).join(", ")}
                  />
                );
              })}
            </div>
          </div>

          {/* Entry */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">Entry (Long)</h4>
            <div className="space-y-1">
              {longConditions.map((c, i) => (
                <div key={`long-${i}-${c.indicator}`} className="text-xs text-muted-foreground font-mono py-0.5">
                  {i > 0 && "AND "}
                  {c.indicator} {c.operator}{" "}
                  {c.compareType === "indicator" ? c.compareIndicator : c.compareValue}
                </div>
              ))}
            </div>
          </div>

          {/* Risk */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">Risk</h4>
            <div className="space-y-1">
              <ReviewRow label="stoploss" value={`${(stoploss * 100).toFixed(1)}%`} valueColor="text-rose-500" />
              <ReviewRow label="stoploss_type" value={stoplossType} />
              <ReviewRow label="stake_amount" value={`$${stakeAmount.toLocaleString()}`} />
              <ReviewRow label="max_open_trades" value={String(maxOpenTrades)} />
              <ReviewRow
                label="Protections"
                value={`${[stoplossGuard, maxDrawdown, cooldownPeriod].filter(Boolean).length} active`}
              />
            </div>
          </div>

          {/* Callbacks */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
              Callbacks ({enabledCallbackNames.length})
            </h4>
            <div className="space-y-1">
              {enabledCallbackNames.length === 0 ? (
                <div className="text-xs text-muted-foreground">None enabled</div>
              ) : (
                enabledCallbackNames.map((name) => (
                  <div key={name} className="text-xs text-muted-foreground font-mono py-0.5">{name}()</div>
                ))
              )}
            </div>
          </div>

          {/* Config */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">Config</h4>
            <div className="space-y-1">
              <ReviewRow label="startup_candle_count" value={String(startupCandleCount)} />
              <ReviewRow label="process_only_new_candles" value={processOnlyNewCandles ? "True" : "False"} />
              <ReviewRow label="order_types.entry" value={orderTypeEntry} />
              <ReviewRow label="order_types.stoploss" value={orderTypeStoploss} />
              <ReviewRow label="order_tif.entry" value={orderTifEntry} />
              <ReviewRow label="informative_pairs" value={informativePairs.length > 0 ? `${informativePairs.length} pairs` : "none"} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Map step number to render function
  const stepPanels: Record<number, () => React.ReactNode> = {
    1: renderBasics,
    2: renderIndicators,
    3: renderEntry,
    4: renderExit,
    5: renderRisk,
    6: renderCallbacks,
    7: renderStrategyConfig,
    8: renderReview,
  };

  if (loadingStrategy) {
    return (
      <AppShell title="Strategy Builder">
        <div className="flex items-center justify-center h-96">
          <div className="text-sm text-muted-foreground animate-pulse">Loading strategy...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Strategy Builder">
      <div className="flex -m-8 h-[calc(100vh-56px)]">
        {/* Left: Wizard */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          {/* Steps bar */}
          <div className="flex px-6 py-4 border-b border-border bg-card gap-1 flex-shrink-0 items-center overflow-x-auto">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center gap-1">
                {i > 0 && <div className="w-4 h-px bg-border flex-shrink-0" />}
                <div
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium cursor-pointer transition-all whitespace-nowrap ${
                    step.num === currentStep
                      ? "bg-primary/[.12] text-primary font-semibold"
                      : step.num < currentStep
                      ? "text-emerald-500"
                      : "text-muted-foreground hover:text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => goStep(step.num)}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      step.num === currentStep
                        ? "border-primary bg-primary text-white"
                        : step.num < currentStep
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                        : "border-border"
                    }`}
                  >
                    {step.num < currentStep ? "\u2713" : step.num}
                  </div>
                  {step.label}
                </div>
              </div>
            ))}
          </div>

          {/* Wizard body */}
          <div className="flex-1 overflow-y-auto p-7">{stepPanels[currentStep]()}</div>

          {/* Wizard footer */}
          <div className="px-6 py-3.5 border-t border-border bg-card flex-col flex-shrink-0">
            {/* Version selector and changelog */}
            {savedStrategyId && versions.length > 0 && (
              <div className="mb-3 flex items-center gap-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Versions:</label>
                  <div className="flex gap-1">
                    {versions.map(v => (
                      <button
                        key={v.version_number}
                        type="button"
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          currentVersion === v.version_number
                            ? "bg-primary text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/50 border border-border"
                        }`}
                        onClick={() => setCurrentVersion(v.version_number)}
                      >
                        v{v.version_number}
                      </button>
                    ))}
                  </div>
                  {currentVersion && currentVersion < versions[versions.length - 1]?.version_number && (
                    <span className="text-xs text-orange ml-2">Warning: editing old version will create new version</span>
                  )}
                </div>
              </div>
            )}

            {/* Changelog input */}
            {savedStrategyId && !showChangelogInput && (
              <div className="mb-3 pb-3 border-b border-border">
                <button
                  type="button"
                  onClick={() => setShowChangelogInput(true)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  + Add changelog before save
                </button>
              </div>
            )}

            {showChangelogInput && (
              <div className="mb-3 pb-3 border-b border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">What changed?</label>
                <textarea
                  className="w-full px-2.5 py-1.5 rounded border border-border bg-muted/50 text-foreground text-xs outline-none focus:border-primary resize-none"
                  placeholder="e.g., Adjusted stoploss from -10% to -5%"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowChangelogInput(false)}
                    className="text-xs text-muted-foreground hover:text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
            <button
              type="button"
              className={`px-3.5 py-2 rounded-md border border-border bg-muted/50 text-muted-foreground text-xs font-medium cursor-pointer hover:border-border-border hover:border-ring hover:bg-muted transition-all flex items-center gap-1.5 ${
                currentStep === 1 ? "invisible" : ""
              }`}
              onClick={prevStep}
            >
              &larr; Previous
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3.5 py-2 rounded-md border border-border bg-muted/50 text-muted-foreground text-xs font-medium cursor-pointer hover:border-border-border hover:border-ring hover:bg-muted transition-all flex items-center gap-1.5 disabled:opacity-50"
                disabled={saving}
                onClick={handleSaveStrategy}
              >
                {saving ? "Saving..." : "Save as Draft"}
              </button>
              <button
                type="button"
                className="px-3.5 py-2 rounded-md border border-primary/30 bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/20 transition-all flex items-center gap-1.5"
                onClick={async () => {
                  if (!savedStrategyId) {
                    await handleSaveStrategy();
                  }
                  setDeployOpen(true);
                }}
              >
                Deploy to Bot
              </button>
              {currentStep < steps.length ? (
                <button
                  type="button"
                  className="px-4 py-2 rounded-md bg-primary text-white text-xs font-semibold cursor-pointer hover:bg-primary-dim hover:-translate-y-px transition-all flex items-center gap-1.5"
                  onClick={nextStep}
                >
                  {nextLabels[currentStep]}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveStrategy}
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-green text-white text-xs font-semibold cursor-pointer hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save & Backtest \u2192"}
                </button>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Right: Code Panel (Visual preview / Monaco editor) */}
        <div className="w-[420px] flex flex-col bg-card flex-shrink-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex bg-muted rounded p-0.5">
                <button type="button"
                  onClick={() => setEditorMode("visual")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-all ${
                    editorMode === "visual" ? "bg-muted/50 text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground"
                  }`}>
                  Preview
                </button>
                <button type="button"
                  onClick={() => {
                    if (editorMode !== "code" && !manualCodeEdit) {
                      setEditableCode(generateStrategyCode);
                    }
                    setEditorMode("code");
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-all ${
                    editorMode === "code" ? "bg-muted/50 text-foreground shadow-sm" : "text-muted-foreground hover:text-muted-foreground"
                  }`}>
                  Editor
                </button>
              </div>
              <span className="text-xs font-semibold text-foreground">{strategyName}.py</span>
            </div>
            <div className="flex gap-1.5">
              <button type="button"
                className="px-2.5 py-1 rounded border border-border bg-muted/50 text-muted-foreground text-xs cursor-pointer hover:border-border-border hover:border-ring hover:text-muted-foreground transition-all"
                onClick={() => {
                  const code = editorMode === "code" && manualCodeEdit ? editableCode : generateStrategyCode;
                  navigator.clipboard.writeText(code);
                  toast.success("Code copied to clipboard.");
                }}>
                Copy
              </button>
              <button type="button"
                className="px-2.5 py-1 rounded border border-border bg-muted/50 text-muted-foreground text-xs cursor-pointer hover:border-border-border hover:border-ring hover:text-muted-foreground transition-all"
                onClick={() => {
                  const code = editorMode === "code" && manualCodeEdit ? editableCode : generateStrategyCode;
                  const blob = new Blob([code], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${strategyName}.py`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                Download .py
              </button>
            </div>
          </div>

          {manualCodeEdit && editorMode === "visual" && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500-500/20">
              <span className="text-2xs text-amber-500">Code was edited manually. Preview may not reflect all changes.</span>
            </div>
          )}

          {editorMode === "visual" ? (
            <div className="flex-1 overflow-auto p-5 px-6">
              <pre className="font-mono text-[11.5px] leading-[1.7] text-muted-foreground whitespace-pre tab-size-4">
                {generateStrategyCode}
              </pre>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                height="100%"
                language="python"
                theme="vs-dark"
                value={editableCode || generateStrategyCode}
                onChange={(value) => {
                  setEditableCode(value || "");
                  setManualCodeEdit(true);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  readOnly: false,
                }}
              />
            </div>
          )}
        </div>

        {/* Deploy Modal */}
        <DeployModal
          isOpen={deployOpen}
          strategyName={strategyName}
          strategyId={savedStrategyId ?? 0}
          currentVersionId={currentVersion ?? undefined}
          onClose={() => setDeployOpen(false)}
          onSuccess={() => router.push("/strategies")}
        />
      </div>
    </AppShell>
  );
}

// ─── Small Components ────────────────────────────────────

function ReviewRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium font-mono ${valueColor || "text-foreground"}`}>{value}</span>
    </div>
  );
}
