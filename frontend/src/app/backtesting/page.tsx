"use client";

import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import { TOOLTIPS } from "@/lib/tooltips";
import { REFRESH_INTERVALS } from "@/lib/constants";
import {
  getBots,
  getStrategy,
  botBacktestStart,
  botBacktestResults,
  botBacktestDelete,
  botBacktestHistory,
  botHyperoptStart,
  botLookaheadAnalysis,
  botRecursiveAnalysis,
  botFtStrategies,
  botPing,
  submitHyperoptPreAnalyze,
  submitHyperoptPostAnalyze,
  submitHyperoptOutcome,
  fetchHyperoptComparison,
  fetchHyperoptComparisonHistory,
} from "@/lib/api";
import type { Bot, FTBacktestResult, FTBacktestStrategyResult, AIHyperoptAnalysis, AIHyperoptComparison } from "@/types";
import { fmtNum } from "@/lib/format";

/* ─── Helper: extract the first strategy result from btResult ─── */
function getStrategyResult(btResult: FTBacktestResult | null): FTBacktestStrategyResult | null {
  if (!btResult?.backtest_result) return null;
  // FT 2026.2: results are nested under backtest_result.strategy.{StrategyName}
  const stratMap = btResult.backtest_result.strategy;
  if (stratMap && typeof stratMap === "object") {
    const keys = Object.keys(stratMap);
    if (keys.length > 0) return stratMap[keys[0]];
  }
  return null;
}

/* ─── Helper: get ALL strategy results for multi-strategy comparison ─── */
function getAllStrategyResults(btResult: FTBacktestResult | null): { name: string; result: FTBacktestStrategyResult }[] {
  if (!btResult?.backtest_result) return [];
  // FT 2026.2: results are nested under backtest_result.strategy.{StrategyName}
  const stratMap = btResult.backtest_result.strategy;
  if (stratMap && typeof stratMap === "object") {
    return Object.entries(stratMap).map(([name, result]) => ({ name, result }));
  }
  return [];
}

/* ─── Helper: profit color (backtesting variant returns "green"/"red"/undefined) ─── */
function profitColorName(n: number | undefined | null): "green" | "red" | undefined {
  if (n == null) return undefined;
  return n >= 0 ? "green" : "red";
}

/* ─── Helper: export btResult as CSV ─── */
function exportResultsCSV(sr: FTBacktestStrategyResult) {
  const rows = sr.results_per_pair || [];
  const header = ["Pair", "Trades", "Win Rate", "Profit Abs", "Profit %", "Duration Avg", "Wins", "Losses"];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [r.key, r.trades, sr.total_trades > 0 ? ((r.wins / r.trades) * 100).toFixed(2) + "%" : "0%",
       (r.profit_total_abs ?? 0).toFixed(2), ((r.profit_total_pct ?? (r.profit_total ?? 0) * 100)).toFixed(2) + "%",
       r.duration_avg, r.wins, r.losses].join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backtest_${sr.strategy_name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Config Constants ─── */

const defaultStrategies = [
  "SampleStrategy",
  "TrendFollowerV3",
  "MeanReversionBTC",
  "ScalpMaster5m",
  "RSIMomentum",
  "EMACloud",
];

const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
const detailTimeframes = ["None", "1m", "5m", "15m"];

const lossFunctions = [
  "ShortTradeDurHyperOptLoss",
  "OnlyProfitHyperOptLoss",
  "SharpeHyperOptLoss",
  "SharpeDailyHyperOptLoss",
  "SortinoHyperOptLoss",
  "SortinoDailyHyperOptLoss",
  "CalmarHyperOptLoss",
  "MaxDrawDownHyperOptLoss",
  "MaxDrawDownRelativeHyperOptLoss",
  "MaxDrawDownPerPairHyperOptLoss",
  "ProfitDrawDownHyperOptLoss",
  "MultiMetricHyperOptLoss",
];

const samplers = [
  { value: "tpe", label: "TPE (Tree-structured Parzen Estimator)", desc: "Bayesian optimization using kernel density estimators. Good default for most strategies." },
  { value: "nsga2", label: "NSGA-II (Multi-objective evolutionary)", desc: "Multi-objective evolutionary algorithm. Best when optimizing multiple conflicting objectives." },
  { value: "gp", label: "GP (Gaussian Process)", desc: "Gaussian Process-based optimization. Works well with small parameter spaces." },
  { value: "cmaes", label: "CMA-ES (Covariance Matrix Adaptation)", desc: "Covariance Matrix Adaptation Evolution Strategy. Good for continuous parameter optimization." },
  { value: "random", label: "Random (Uniform random sampling)", desc: "Uniform random sampling across the parameter space. Useful as a baseline." },
  { value: "qmc", label: "QMC (Quasi-Monte Carlo)", desc: "Quasi-Monte Carlo sampling. Better space coverage than pure random sampling." },
  { value: "motpe", label: "MOTPE (Multi-Objective TPE)", desc: "Multi-Objective Tree-structured Parzen Estimator. Extension of TPE for multi-objective optimization." },
  { value: "nsgaiii", label: "NSGA-III (Reference-point NSGA)", desc: "Reference-point based NSGA. Better for many-objective optimization than NSGA-II." },
  { value: "auto", label: "AutoSampler (Automatic selection)", desc: "Automatically selects the best sampler based on search space characteristics." },
];

const freqaiModels = [
  "None",
  "LightGBMRegressor",
  "XGBoostRegressor",
  "CatboostRegressor",
  "ReinforcementLearner",
  "PyTorchTransformer",
];

const cacheOptions = ["day", "week", "month", "none"];

const hyperoptSpaces = [
  { key: "buy", label: "buy" },
  { key: "sell", label: "sell" },
  { key: "roi", label: "roi" },
  { key: "stoploss", label: "stoploss" },
  { key: "trailing", label: "trailing" },
  { key: "protection", label: "protection" },
  { key: "trades", label: "trades" },
  { key: "default", label: "default" },
];



/* ─── Sub-Components ─── */

function FormLabel({ label }: { label: string }) {
  return (
    <div className="text-[11px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-1.5 flex items-center gap-1.5">
      {label}
    </div>
  );
}

function FormInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full py-2.5 px-3.5 rounded-btn border border-border bg-bg-3 text-text-0 text-[12.5px] font-[inherit] outline-none transition-colors focus:border-accent placeholder:text-text-3 ${className}`}
      {...props}
    />
  );
}

function FormSelect({ children, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full py-2.5 px-3.5 rounded-btn border border-border bg-bg-3 text-text-0 text-[12.5px] font-[inherit] outline-none transition-colors focus:border-accent cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='12'%20height='12'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23808098'%20stroke-width='2'%3E%3Cpath%20d='M6%209l6%206%206-6'/%3E%3C/svg%3E")] bg-no-repeat bg-[position:right_10px_center] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <button
        type="button"
        onClick={onToggle}
        className={`w-9 h-5 rounded-[10px] border cursor-pointer relative transition-all flex-shrink-0 ${
          on ? "bg-green-bg border-green" : "bg-bg-3 border-border"
        }`}
      >
        <span
          className={`absolute w-3.5 h-3.5 rounded-full top-[2px] transition-all ${
            on ? "bg-green left-[18px]" : "bg-text-3 left-[2px]"
          }`}
        />
      </button>
      <span className="text-[11.5px] text-text-1">
        {label}
      </span>
    </div>
  );
}

function CheckboxChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 py-1.5 px-3 rounded-btn border text-[11.5px] cursor-pointer transition-all select-none ${
        active
          ? "border-accent bg-accent-glow text-accent"
          : "border-border bg-bg-3 text-text-2 hover:border-border-hover hover:text-text-1"
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded-[3px] border-[1.5px] flex items-center justify-center text-[9px] transition-all ${
          active ? "border-accent bg-accent text-white" : "border-border"
        }`}
      >
        {active && "\u2713"}
      </span>
      {label}
    </button>
  );
}

function RadioChip({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-1.5 py-1.5 px-3 rounded-btn border text-[11.5px] cursor-pointer transition-all ${
        active
          ? "border-accent bg-accent-glow text-accent"
          : "border-border bg-bg-3 text-text-2 hover:border-border-hover hover:text-text-1"
      }`}
    >
      <span
        className={`w-3 h-3 rounded-full border-[1.5px] flex items-center justify-center transition-all ${
          active ? "border-accent" : "border-border"
        }`}
      >
        {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
      </span>
      {label}
    </button>
  );
}

function TagInput({ tags, placeholder, onChange }: { tags: string[]; placeholder: string; onChange?: (tags: string[]) => void }) {
  const [items, setItems] = useState(tags);
  const [inputValue, setInputValue] = useState("");

  function addTag(value: string) {
    const v = value.trim();
    if (!v || items.includes(v)) return;
    const newTags = [...items, v];
    setItems(newTags);
    onChange?.(newTags);
    setInputValue("");
  }

  function removeTag(tag: string) {
    const newTags = items.filter((x) => x !== tag);
    setItems(newTags);
    onChange?.(newTags);
  }

  return (
    <div className="flex flex-wrap gap-1.5 py-2 px-3 border border-border rounded-btn bg-bg-3 min-h-[36px] items-center cursor-text focus-within:border-accent">
      {items.map((t) => (
        <span key={t} className="flex items-center gap-1 py-0.5 px-2 rounded bg-accent-glow text-accent text-[11px] font-medium">
          {t}
          <span className="cursor-pointer text-xs opacity-60 hover:opacity-100" onClick={() => removeTag(t)}>
            x
          </span>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(inputValue);
          }
          if (e.key === "Backspace" && !inputValue && items.length > 0) {
            removeTag(items[items.length - 1]);
          }
        }}
        placeholder={items.length === 0 ? placeholder : placeholder}
        className="border-none bg-transparent text-text-0 text-xs outline-none flex-1 min-w-[80px] font-[inherit] placeholder:text-text-3"
      />
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant: "pass" | "fail" | "warn" | "info" }) {
  const colors = {
    pass: "bg-green-bg text-green border-green/20",
    fail: "bg-red-bg text-red border-red/20",
    warn: "bg-amber-bg text-amber border-amber/20",
    info: "bg-accent-glow text-accent border-accent/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 py-0.5 px-2 rounded text-[10px] font-semibold uppercase tracking-[0.3px] border ${colors[variant]}`}>
      {label}
    </span>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: "green" | "red" | "amber" }) {
  const colorClass = color === "green" ? "text-green" : color === "red" ? "text-red" : color === "amber" ? "text-amber" : "text-text-0";
  return (
    <div className="bg-bg-1 border border-border rounded-lg p-3.5">
      <div className="text-[10px] text-text-3 uppercase tracking-[0.4px] mb-1">{label}</div>
      <div className={`text-lg font-bold tracking-tight ${colorClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-text-3 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─── Main Page ─── */

export default function BacktestingPage() {
  return (
    <Suspense fallback={
      <AppShell title="Backtesting">
        <div className="flex items-center justify-center h-96">
          <div className="text-sm text-text-3 animate-pulse">Loading...</div>
        </div>
      </AppShell>
    }>
      <BacktestingInner />
    </Suspense>
  );
}

function BacktestingInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const qsStrategyId = useMemo(() => searchParams.get("strategyId"), [searchParams]);
  const [mainTab, setMainTab] = useState<"backtest" | "hyperopt" | "validation">("backtest");
  const [exportMode, setExportMode] = useState("trades");
  const [breakdownChecks, setBreakdownChecks] = useState({ day: true, week: false, month: true });
  const [protections, setProtections] = useState(true);
  const [selectedSpaces, setSelectedSpaces] = useState(new Set(["buy", "sell", "roi", "stoploss"]));
  const [analyzePerEpoch, setAnalyzePerEpoch] = useState(false);
  const [disableParamExport, setDisableParamExport] = useState(false);
  const [sampler, setSampler] = useState("tpe");
  const [effort, setEffort] = useState(50);
  const [analysisTab, setAnalysisTab] = useState(0);
  const [breakdownTab, setBreakdownTab] = useState<"day" | "month">("day");
  const [showRejected, setShowRejected] = useState(false);
  const [showAllBreakdown, setShowAllBreakdown] = useState(false);

  // API state
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [ftStrategies, setFtStrategies] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [btResult, setBtResult] = useState<FTBacktestResult | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState(defaultStrategies[0]);

  // Controlled backtest params
  const [btTimeframe, setBtTimeframe] = useState("1h");
  const [btTimeframeDetail, setBtTimeframeDetail] = useState("None");
  const [btTimerangeStart, setBtTimerangeStart] = useState("2024-01-01");
  const [btTimerangeEnd, setBtTimerangeEnd] = useState(new Date().toISOString().slice(0, 10));
  const [btStartingBalance, setBtStartingBalance] = useState("1000");
  const [btStakeAmount, setBtStakeAmount] = useState("unlimited");
  const [btMaxOpenTrades, setBtMaxOpenTrades] = useState("-1");
  const [btFreqaiModel, setBtFreqaiModel] = useState("None");
  const [btStrategyList, setBtStrategyList] = useState<string[]>([]);
  const [btPairOverride, setBtPairOverride] = useState<string[]>([]);
  const [selectedCompareStrategy, setSelectedCompareStrategy] = useState<string | null>(null);
  const [valStrategy, setValStrategy] = useState("");
  const [btFeeOverride, setBtFeeOverride] = useState("");
  const [selectedLoss, setSelectedLoss] = useState("MaxDrawDownRelativeHyperOptLoss");
  const [btCache, setBtCache] = useState("none");
  const [hoEpochs, setHoEpochs] = useState("500");
  const [hoMinTrades, setHoMinTrades] = useState("20");
  const [hoWorkers, setHoWorkers] = useState("-1");

  // New backtest args
  const [btEnablePositionStacking, setBtEnablePositionStacking] = useState(false);
  const [btNotes, setBtNotes] = useState("");
  const [btEnableDynamicPairlist, setBtEnableDynamicPairlist] = useState(false);

  // Analysis controls (§30)
  const [analysisEnterReasons, setAnalysisEnterReasons] = useState<string[]>([]);
  const [analysisExitReasons, setAnalysisExitReasons] = useState<string[]>([]);
  const [analysisIndicators, setAnalysisIndicators] = useState<string[]>([]);
  const [analysisRejectedSignals, setAnalysisRejectedSignals] = useState(false);

  // Backtest history
  const [btHistory, setBtHistory] = useState<Array<{ filename: string; strategy: string; run_id: string; backtest_start_time: number }>>([]);
  const [btHistoryLoading, setBtHistoryLoading] = useState(false);

  // AI Hyperopt analysis state
  const [aiPreAnalysis, setAiPreAnalysis] = useState<AIHyperoptAnalysis | null>(null);
  const [aiPostAnalysis, setAiPostAnalysis] = useState<AIHyperoptAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Hyperopt comparison / outcome state
  const [hyperoptComparison, setHyperoptComparison] = useState<AIHyperoptComparison | null>(null);
  const [comparisonHistory, setComparisonHistory] = useState<Array<{ id: number; strategy_name: string; pair: string; timeframe: string; recommended_result_index: number | null; claude_confidence: number | null; grok_confidence: number | null; created_at: string | null }>>([]);
  const [comparisonHistoryLoading, setComparisonHistoryLoading] = useState(false);
  const [outcomeFeedback, setOutcomeFeedback] = useState<"helpful" | "neutral" | "wrong" | null>(null);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);

  // Load bots on mount — include utility bots, prefer backtest worker
  useEffect(() => {
    getBots(true).then((list) => {
      setBots(list);
      if (list.length > 0) {
        // Prefer a webserver-mode bot for backtesting (dedicated backtest worker)
        const btBot = list.find((b) => b.ft_mode === "webserver") ?? list.find((b) => b.name === "ft-backtest");
        setSelectedBotId(String(btBot ? btBot.id : list[0].id));
      }
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load bots.");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load FT strategies when bot changes
  useEffect(() => {
    if (!selectedBotId) return;
    const botId = parseInt(selectedBotId, 10);
    botFtStrategies(botId)
      .then((r) => setFtStrategies(r.strategies))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load strategies from bot.");
      });
  }, [selectedBotId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select strategy from query param (e.g. from Strategies page "Run Backtest" button)
  useEffect(() => {
    if (!qsStrategyId) return;
    const stratId = parseInt(qsStrategyId, 10);
    if (isNaN(stratId)) return;
    getStrategy(stratId)
      .then((strat) => {
        if (strat.name) {
          setSelectedStrategy(strat.name);
        }
      })
      .catch(() => {
        // Strategy not found in orchestrator — ignore silently
      });
  }, [qsStrategyId]);

  // Poll backtest results (with cleanup on unmount + race-safe)
  const pollResults = useCallback(async (botId: number, intervalMs = REFRESH_INTERVALS.BACKTEST_POLL, maxAttempts = 60) => {
    // Cancel any previous poll before starting a new one
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    let attempts = 0;
    let cancelled = false;
    return new Promise<FTBacktestResult>((resolve, reject) => {
      const interval = setInterval(async () => {
        if (cancelled) return;
        attempts++;
        try {
          const r = await botBacktestResults(botId);
          if (cancelled) return; // Check again after async gap
          setBtResult(r);
          if (!r.running) {
            clearInterval(interval);
            if (pollIntervalRef.current === interval) pollIntervalRef.current = null;
            resolve(r);
          }
        } catch (e) {
          if (cancelled) return;
          clearInterval(interval);
          if (pollIntervalRef.current === interval) pollIntervalRef.current = null;
          reject(e);
        }
        if (attempts >= maxAttempts && !cancelled) {
          clearInterval(interval);
          if (pollIntervalRef.current === interval) pollIntervalRef.current = null;
          reject(new Error("Backtest timed out"));
        }
      }, intervalMs);
      // Store ref — if a new poll starts, it will clear this one via the guard above
      pollIntervalRef.current = interval;
      // Return cancel handle for cleanup
      const origInterval = interval;
      // Attach a cancel mechanism to the promise for unmount cleanup
      void Object.assign(new Promise(() => {}), {
        cancel: () => { cancelled = true; clearInterval(origInterval); },
      });
    });
  }, []);

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  async function preflight(botId: number): Promise<string | null> {
    // 1. Check bot exists and is registered
    const bot = bots.find((b) => b.id === botId);
    if (!bot) return "Backtest engine not found. Please check system configuration.";

    // 2. Check bot status in orchestrator (skip for webserver-mode bots — they don't need to be "running" in trade sense)
    if (bot.ft_mode !== "webserver") {
      if (bot.status === "killed") return "Backtest engine was stopped. Go to Dashboard to restart it.";
      if (bot.status === "stopped") return "Backtest engine is stopped. Go to Dashboard to start it first.";
      if (bot.status === "error") return "Backtest engine is in ERROR state. Check Dashboard for details.";
      if (bot.status === "starting") return "Backtest engine is still starting. Wait a moment and retry.";
    }

    // 3. Connectivity check — ping works in both trade and webserver mode
    try {
      await botPing(botId);
    } catch {
      return "Backtest engine is not responding. FreqTrade may be down or unreachable.";
    }

    // 4. Check if a backtest is already running
    try {
      const prev = await botBacktestResults(botId);
      if (prev.running) return "ABORT_PREVIOUS";
    } catch {
      // No previous backtest state — fine, proceed
    }

    return null;
  }

  async function handleRunBacktest() {
    if (!selectedBotId) { toast.warning("Backtest engine not available. Please check that FreqTrade is running."); return; }
    setRunning(true);
    const id = toast.loading("Pre-flight checks...");
    try {
      const botId = parseInt(selectedBotId, 10);

      // Pre-flight diagnostics — exact error, not guesses
      const issue = await preflight(botId);
      if (issue && issue !== "ABORT_PREVIOUS") {
        toast.dismiss(id);
        toast.error(issue);
        setRunning(false);
        return;
      }
      // Always clear previous backtest to avoid cached results
      toast.update(id, { message: "Clearing previous results...", type: "loading" });
      try { await botBacktestDelete(botId); } catch { /* no previous backtest — fine */ }
      await new Promise<void>((resolve) => { const t = globalThis.setTimeout(() => resolve(), 500); void t; });

      setShowAllBreakdown(false);
      toast.update(id, { message: "Starting backtest...", type: "loading" });
      const timerange = btTimerangeStart && btTimerangeEnd
        ? `${btTimerangeStart.replace(/-/g, "")}${btTimerangeEnd ? "-" + btTimerangeEnd.replace(/-/g, "") : ""}`
        : undefined;
      const params: Record<string, unknown> = {
        strategy: selectedStrategy,
        enable_protections: protections,
        timeframe: btTimeframe,
        export: exportMode,
        breakdown: Object.entries(breakdownChecks).filter(([, v]) => v).map(([k]) => k),
      };
      if (timerange) params.timerange = timerange;
      if (btTimeframeDetail !== "None") params.timeframe_detail = btTimeframeDetail;
      if (btStartingBalance) params.dry_run_wallet = parseFloat(btStartingBalance);
      if (btStakeAmount !== "unlimited") params.stake_amount = parseFloat(btStakeAmount);
      if (btMaxOpenTrades !== "-1") params.max_open_trades = parseInt(btMaxOpenTrades, 10);
      if (btFreqaiModel !== "None") params.freqaimodel = btFreqaiModel;
      if (btCache !== "none") params.cache = btCache;
      if (btStrategyList.length > 0) params.strategy_list = btStrategyList;
      if (btPairOverride.length > 0) params.pairs = btPairOverride;
      if (btFeeOverride) params.fee = parseFloat(btFeeOverride);
      if (btEnablePositionStacking) params.enable_position_stacking = true;
      if (btNotes) params.notes = btNotes;
      if (btEnableDynamicPairlist) params.enable_dynamic_pairlist = true;

      await botBacktestStart(botId, params);
      toast.update(id, { message: `Backtest running — ${selectedStrategy}...`, type: "loading" });
      const result = await pollResults(botId);
      toast.dismiss(id);
      if (result.status === "error") {
        const msg = result.status_msg || "Backtest failed with unknown error.";
        toast.error(msg);
      } else if (result.backtest_result?.strategy && Object.keys(result.backtest_result.strategy).length > 0) {
        toast.success("Backtest complete!");
      } else if (!result.running) {
        toast.warning("Backtest finished but produced no results. Check your strategy and timerange.");
      } else {
        toast.error("Backtest ended with unknown status.");
      }
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Backtest failed.",
        { action: { label: "RETRY", onClick: handleRunBacktest } });
    } finally {
      setRunning(false);
    }
  }

  async function handleRunHyperopt() {
    if (!selectedBotId) { toast.warning("Backtest engine not available. Please check that FreqTrade is running."); return; }
    setRunning(true);
    const id = toast.loading("Starting hyperopt...");
    try {
      const botId = parseInt(selectedBotId, 10);
      await botHyperoptStart(botId, {
        strategy: selectedStrategy,
        epochs: parseInt(hoEpochs, 10) || 500,
        spaces: Array.from(selectedSpaces),
        sampler,
        effort,
        min_trades: parseInt(hoMinTrades, 10) || 20,
        jobs: parseInt(hoWorkers, 10) || -1,
        hyperopt_loss: selectedLoss,
      });
      toast.dismiss(id);
      toast.success("Hyperopt started. Results will appear when complete.");
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Hyperopt failed.",
        { action: { label: "RETRY", onClick: handleRunHyperopt } });
    } finally {
      setRunning(false);
    }
  }

  async function handleAIPreAnalyze() {
    if (!selectedBotId) { toast.warning("Backtest engine not available. Please check that FreqTrade is running."); return; }
    setAiAnalyzing(true);
    const id = toast.loading("AI Pre-Analysis running...");
    try {
      const botId = parseInt(selectedBotId, 10);
      const result = await submitHyperoptPreAnalyze({
        bot_id: botId,
        strategy_name: selectedStrategy,
        pair: "BTC/USDT:USDT",
        timeframe: btTimeframe,
      });
      setAiPreAnalysis(result);
      toast.dismiss(id);
      toast.success("AI Pre-Analysis complete. See suggestions below.");
      // Auto-apply suggested loss function if available
      if (result.suggested_loss_function) {
        setSelectedLoss(result.suggested_loss_function);
      }
      if (result.suggested_epochs) {
        setHoEpochs(String(result.suggested_epochs));
      }
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "AI Pre-Analysis failed.");
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function handleAIPostAnalyze() {
    if (!selectedBotId) { toast.warning("Backtest engine not available. Please check that FreqTrade is running."); return; }
    const sr = getStrategyResult(btResult);
    if (!sr) { toast.warning("Run hyperopt/backtest first to get results."); return; }
    setAiAnalyzing(true);
    const id = toast.loading("AI Post-Analysis running...");
    try {
      const botId = parseInt(selectedBotId, 10);
      const result = await submitHyperoptPostAnalyze({
        bot_id: botId,
        strategy_name: selectedStrategy,
        pair: "BTC/USDT:USDT",
        timeframe: btTimeframe,
        results: sr.results_per_pair.slice(0, 10).map((r) => ({
          key: r.key,
          trades: r.trades,
          profit_total_abs: r.profit_total_abs,
          profit_total_pct: r.profit_total_pct,
          duration_avg: r.duration_avg,
          wins: r.wins,
          losses: r.losses,
        })),
        epochs_run: parseInt(hoEpochs, 10) || 500,
        loss_function_used: selectedLoss,
        timerange: `${btTimerangeStart.replace(/-/g, "")}-${btTimerangeEnd.replace(/-/g, "")}`,
        baseline_profit: sr.profit_total_abs,
        baseline_trades: sr.total_trades,
        baseline_sharpe: sr.sharpe ?? undefined,
        baseline_max_drawdown: sr.max_drawdown_account ?? sr.max_drawdown ?? undefined,
      });
      setAiPostAnalysis(result);
      toast.dismiss(id);
      toast.success("AI Post-Analysis complete. See overfitting review below.");
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "AI Post-Analysis failed.");
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function handleViewComparison(analysisId: number) {
    try {
      const comp = await fetchHyperoptComparison(analysisId);
      setHyperoptComparison(comp);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load comparison");
    }
  }

  async function handleSubmitOutcome(analysisId: number) {
    if (!outcomeFeedback) return;
    setOutcomeSubmitting(true);
    try {
      await submitHyperoptOutcome({
        analysis_id: analysisId,
        used_ai_suggestion: outcomeFeedback === "helpful",
        user_feedback: outcomeFeedback,
      });
      toast.success("Feedback submitted.");
      setOutcomeFeedback(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setOutcomeSubmitting(false);
    }
  }

  async function loadComparisonHistory() {
    if (!selectedBotId) return;
    setComparisonHistoryLoading(true);
    try {
      const result = await fetchHyperoptComparisonHistory({ botId: parseInt(selectedBotId, 10), limit: 20 });
      setComparisonHistory(result.comparisons);
    } catch { /* non-blocking */ }
    finally { setComparisonHistoryLoading(false); }
  }

  async function handleLookaheadAnalysis() {
    if (!selectedBotId) { toast.warning("Backtest engine not available. Please check that FreqTrade is running."); return; }
    const id = toast.loading("Running lookahead analysis...");
    try {
      const botId = parseInt(selectedBotId, 10);
      await botLookaheadAnalysis(botId, { strategy: selectedStrategy, timerange: "" });
      toast.dismiss(id);
      toast.success("Lookahead analysis complete.");
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Lookahead analysis failed.");
    }
  }

  async function handleRecursiveAnalysis() {
    if (!selectedBotId) { toast.warning("Backtest engine not available. Please check that FreqTrade is running."); return; }
    const id = toast.loading("Running recursive analysis...");
    try {
      const botId = parseInt(selectedBotId, 10);
      await botRecursiveAnalysis(botId, { strategy: selectedStrategy });
      toast.dismiss(id);
      toast.success("Recursive analysis complete.");
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Recursive analysis failed.");
    }
  }

  // btResult used in results section below

  const toggleSpace = (key: string) => {
    const next = new Set(selectedSpaces);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedSpaces(next);
  };

  const toggleBreakdown = (key: keyof typeof breakdownChecks) => {
    setBreakdownChecks((p) => ({ ...p, [key]: !p[key] }));
  };

  const analysisGroups = [
    "0: by enter_tag",
    "1: profit by tag",
    "2: enter+exit",
    "3: pair+tag",
    "4: pair+enter+exit",
    "5: by exit_tag",
  ];

  const currentSampler = samplers.find((s) => s.value === sampler);

  function handleResetBacktest() {
    setSelectedStrategy(ftStrategies[0] || defaultStrategies[0]);
    setBtTimeframe("1h");
    setBtTimeframeDetail("None");
    setBtTimerangeStart("2024-01-01");
    setBtTimerangeEnd(new Date().toISOString().slice(0, 10));
    setBtStartingBalance("1000");
    setBtStakeAmount("unlimited");
    setBtMaxOpenTrades("-1");
    setBtFeeOverride("");
    setBtFreqaiModel("None");
    setBtCache("none");
    setBtPairOverride([]);
    setBtStrategyList([]);
    setProtections(true);
    setExportMode("trades");
    setBreakdownChecks({ day: true, week: false, month: true });
    setBtResult(null);
    setBtEnablePositionStacking(false);
    setBtNotes("");
    setBtEnableDynamicPairlist(false);
  }

  function handleResetHyperopt() {
    setSelectedStrategy(ftStrategies[0] || defaultStrategies[0]);
    setHoEpochs("500");
    setSelectedSpaces(new Set(["buy", "sell", "roi", "stoploss"]));
    setSelectedLoss("MaxDrawDownRelativeHyperOptLoss");
    setSampler("tpe");
    setEffort(50);
    setHoMinTrades("20");
    setHoWorkers("-1");
    setAnalyzePerEpoch(false);
    setDisableParamExport(false);
  }

  return (
    <AppShell title="Backtesting">
      <div className="grid grid-cols-[380px_1fr] gap-5">
        {/* ════════ LEFT COLUMN: CONFIGURATION ════════ */}
        <div className="flex flex-col gap-4">
          <Card>
            {/* Tab Selector */}
            <div className="flex gap-0.5 px-[18px] bg-bg-1 border-b border-border">
          {/* Bot selector hidden — auto-selects ft-backtest worker internally */}
              {(["backtest", "hyperopt", "validation"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setMainTab(tab)}
                  className={`py-2.5 px-4 text-[11.5px] font-medium cursor-pointer border-b-2 transition-all capitalize ${
                    mainTab === tab
                      ? "text-accent border-accent font-semibold"
                      : "text-text-3 border-transparent hover:text-text-1"
                  }`}
                >
                  {tab === "backtest" ? "Backtest" : tab === "hyperopt" ? "Hyperopt" : "Validation"}
                </button>
              ))}
            </div>

            {/* ──── BACKTEST TAB ──── */}
            {mainTab === "backtest" && (
              <CardBody>
                {/* Strategy */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.bt_strategy?.description ?? "Select strategy"} configKey="--strategy">
                    <FormLabel label="Strategy" />
                  </Tooltip>
                  <FormSelect
                    value={selectedStrategy}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedStrategy(e.target.value)}
                  >
                    {(ftStrategies.length > 0 ? ftStrategies : defaultStrategies).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </FormSelect>
                </div>

                {/* Multi-strategy compare */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.bt_strategy_list?.description ?? "List of strategies"} configKey="--strategy-list">
                    <FormLabel label="Multi-Strategy Compare" />
                  </Tooltip>
                  <TagInput tags={btStrategyList} placeholder="Add strategy..." onChange={(tags) => setBtStrategyList(tags)} />
                </div>

                <hr className="border-t border-border my-4" />

                {/* Timeframe + Detail */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_timeframe?.description ?? "Backtest timeframe"} configKey="--timeframe">
                      <FormLabel label="Timeframe" />
                    </Tooltip>
                    <FormSelect
                      value={btTimeframe}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBtTimeframe(e.target.value)}
                    >
                      {timeframes.map((tf) => (
                        <option key={tf} value={tf}>
                          {tf === "1h" ? "1h (default)" : tf}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_timeframe_detail?.description ?? "Detail timeframe"} configKey="--timeframe-detail">
                      <FormLabel label="Detail Timeframe" />
                    </Tooltip>
                    <FormSelect
                      value={btTimeframeDetail}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBtTimeframeDetail(e.target.value)}
                    >
                      {detailTimeframes.map((tf) => (
                        <option key={tf}>{tf}</option>
                      ))}
                    </FormSelect>
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_timerange?.description ?? "Date range for backtest"} configKey="--timerange">
                      <FormLabel label="Start Date" />
                    </Tooltip>
                    <FormInput
                      type="date"
                      value={btTimerangeStart}
                      onChange={(e) => setBtTimerangeStart(e.target.value)}
                    />
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_timerange?.description ?? "End date for the backtest time range"} configKey="--timerange">
                      <FormLabel label="End Date" />
                    </Tooltip>
                    <FormInput
                      type="date"
                      value={btTimerangeEnd}
                      onChange={(e) => setBtTimerangeEnd(e.target.value)}
                    />
                  </div>
                </div>

                <hr className="border-t border-border my-4" />

                {/* Export + Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_export?.description ?? "Export mode"} configKey="--export">
                      <FormLabel label="Export Mode" />
                    </Tooltip>
                    <div className="flex flex-col gap-1.5">
                      {["trades", "signals", "none"].map((mode) => (
                        <RadioChip key={mode} label={mode} active={exportMode === mode} onSelect={() => setExportMode(mode)} />
                      ))}
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_breakdown?.description ?? "Breakdown by time period"} configKey="--breakdown">
                      <FormLabel label="Breakdown" />
                    </Tooltip>
                    <div className="flex flex-col gap-1.5">
                      {(["day", "week", "month"] as const).map((key) => (
                        <CheckboxChip
                          key={key}
                          label={key}
                          active={breakdownChecks[key]}
                          onToggle={() => toggleBreakdown(key)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <hr className="border-t border-border my-4" />

                {/* Protections Toggle */}
                <Tooltip content={TOOLTIPS.bt_enable_protections?.description ?? "Enable protections"} configKey="--enable-protections">
                  <Toggle on={protections} onToggle={() => setProtections(!protections)} label="Enable Protections" />
                </Tooltip>

                <hr className="border-t border-border my-4" />

                {/* Starting Balance / Stake / Max Trades / Fee */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_dry_run_wallet?.description ?? "Starting wallet balance"} configKey="--dry-run-wallet">
                      <FormLabel label="Starting Balance" />
                    </Tooltip>
                    <FormInput
                      type="number"
                      value={btStartingBalance}
                      onChange={(e) => setBtStartingBalance(e.target.value)}
                      step={100}
                    />
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.stake_amount?.description ?? "Amount per trade in stake currency"} configKey="stake_amount">
                      <FormLabel label="Stake Amount" />
                    </Tooltip>
                    <FormInput
                      type="text"
                      value={btStakeAmount}
                      onChange={(e) => setBtStakeAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.max_open_trades?.description ?? "Maximum simultaneous open trades"} configKey="max_open_trades">
                      <FormLabel label="Max Open Trades" />
                    </Tooltip>
                    <FormInput
                      type="number"
                      value={btMaxOpenTrades}
                      onChange={(e) => setBtMaxOpenTrades(e.target.value)}
                      min={-1}
                      step={1}
                    />
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.fee?.description ?? "Override exchange fee ratio for backtesting"} configKey="fee">
                      <FormLabel label="Fee Override" />
                    </Tooltip>
                    <FormInput type="number" placeholder="e.g. 0.001" step={0.0001} value={btFeeOverride} onChange={(e) => setBtFeeOverride(e.target.value)} />
                  </div>
                </div>

                <hr className="border-t border-border my-4" />

                {/* Pair Override */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.exchange_pair_whitelist?.description ?? "Override pairs for this backtest run"} configKey="--pairs">
                    <FormLabel label="Pair Override" />
                  </Tooltip>
                  <TagInput tags={btPairOverride} placeholder="Add pair..." onChange={(tags) => setBtPairOverride(tags)} />
                </div>

                {/* FreqAI Model + Cache */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={"FreqAI model to use for backtesting. Select 'None' if not using FreqAI."} configKey="freqai.model">
                      <FormLabel label="FreqAI Model" />
                    </Tooltip>
                    <FormSelect
                      value={btFreqaiModel}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBtFreqaiModel(e.target.value)}
                    >
                      {freqaiModels.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.bt_cache?.description ?? "Cache strategy data"} configKey="--cache">
                      <FormLabel label="Cache" />
                    </Tooltip>
                    <FormSelect
                      value={btCache}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBtCache(e.target.value)}
                    >
                      {cacheOptions.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </FormSelect>
                  </div>
                </div>

                <hr className="border-t border-border my-4" />

                {/* New: Position Stacking + Dynamic Pairlist */}
                <Tooltip content={TOOLTIPS.bt_enable_position_stacking?.description ?? "Enable position stacking"} configKey="--eps">
                  <Toggle on={btEnablePositionStacking} onToggle={() => setBtEnablePositionStacking(!btEnablePositionStacking)} label="Enable Position Stacking" />
                </Tooltip>
                <Tooltip content={"Enable dynamic pairlist evaluation during backtest. Uses pairlist handlers to dynamically select pairs."} configKey="--enable-dynamic-pairlist">
                  <Toggle on={btEnableDynamicPairlist} onToggle={() => setBtEnableDynamicPairlist(!btEnableDynamicPairlist)} label="Enable Dynamic Pairlist" />
                </Tooltip>

                {/* Notes */}
                <div className="mb-3.5 mt-2">
                  <Tooltip content={"Optional notes to tag this backtest run for future reference"} configKey="notes">
                    <FormLabel label="Notes" />
                  </Tooltip>
                  <FormInput type="text" value={btNotes} onChange={(e) => setBtNotes(e.target.value)} placeholder="Optional notes for this backtest run" />
                </div>

                {/* Run Backtest Button */}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    disabled={running || !selectedBotId}
                    onClick={handleRunBacktest}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-btn border-none bg-accent text-white text-xs font-semibold cursor-pointer transition-all hover:bg-accent-dim hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {running ? "Running..." : "▶ Run Backtest"}
                  </button>
                  <button type="button" onClick={handleResetBacktest} className="py-2 px-3.5 rounded-btn border border-border bg-bg-2 text-text-1 text-xs font-medium cursor-pointer transition-all hover:border-border-hover hover:bg-bg-3">
                    Reset
                  </button>
                </div>
              </CardBody>
            )}

            {/* ──── HYPEROPT TAB ──── */}
            {mainTab === "hyperopt" && (
              <CardBody>
                {/* Epochs */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.ho_epochs?.description ?? "Number of hyperopt epochs"} configKey="--epochs">
                    <FormLabel label="Epochs" />
                  </Tooltip>
                  <FormInput
                    type="number"
                    value={hoEpochs}
                    onChange={(e) => setHoEpochs(e.target.value)}
                    min={1}
                    step={100}
                  />
                </div>

                {/* Spaces */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.ho_spaces?.description ?? "Parameter spaces to optimize"} configKey="--spaces">
                    <FormLabel label="Spaces" />
                  </Tooltip>
                  <div className="flex flex-wrap gap-2">
                    {hyperoptSpaces.map((s) => (
                      <CheckboxChip
                        key={s.key}
                        label={s.label}
                        active={selectedSpaces.has(s.key)}
                        onToggle={() => toggleSpace(s.key)}
                      />
                    ))}
                  </div>
                </div>

                <hr className="border-t border-border my-4" />

                {/* Loss Function */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.ho_loss?.description ?? "Loss function to optimize"} configKey="--hyperopt-loss">
                    <FormLabel label="Loss Function" />
                  </Tooltip>
                  <FormSelect value={selectedLoss} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLoss(e.target.value)}>
                    {lossFunctions.map((lf) => (
                      <option key={lf}>{lf}</option>
                    ))}
                  </FormSelect>
                </div>

                {/* Sampler */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.ho_spaces?.description ?? "Optimization algorithm"} configKey="--hyperopt-sampler">
                    <FormLabel label="Sampler" />
                  </Tooltip>
                  <FormSelect value={sampler} onChange={(e) => setSampler(e.target.value)}>
                    {samplers.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </FormSelect>
                  {currentSampler && (
                    <div className="text-[10px] text-text-3 mt-1 leading-snug">{currentSampler.desc}</div>
                  )}
                </div>

                <hr className="border-t border-border my-4" />

                {/* Min/Max Trades */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.ho_min_trades?.description ?? "Minimum trades to allow"} configKey="--min-trades">
                      <FormLabel label="Min Trades" />
                    </Tooltip>
                    <FormInput
                      type="number"
                      value={hoMinTrades}
                      onChange={(e) => setHoMinTrades(e.target.value)}
                      min={0}
                    />
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.ho_max_trades?.description ?? "Maximum trades to allow"} configKey="--max-trades">
                      <FormLabel label="Max Trades" />
                    </Tooltip>
                    <FormInput type="number" placeholder="No limit" />
                  </div>
                </div>

                {/* Random State + Workers */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.ho_random_state?.description ?? "Random seed for reproducibility"} configKey="--random-state">
                      <FormLabel label="Random State (Seed)" />
                    </Tooltip>
                    <FormInput type="number" placeholder="Random" />
                  </div>
                  <div className="mb-3.5">
                    <Tooltip content={TOOLTIPS.ho_jobs?.description ?? "Number of parallel jobs"} configKey="-j">
                      <FormLabel label="Workers" />
                    </Tooltip>
                    <FormSelect
                      value={hoWorkers}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setHoWorkers(e.target.value)}
                    >
                      <option value="-1">-1 (All CPUs)</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="4">4</option>
                    </FormSelect>
                  </div>
                </div>

                {/* Search Effort Slider */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.ho_effort?.description ?? "Search effort level"} configKey="--effort">
                    <FormLabel label="Search Effort" />
                  </Tooltip>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={effort}
                      onChange={(e) => setEffort(Number(e.target.value))}
                      className="flex-1 appearance-none h-1 bg-bg-3 rounded outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg-0"
                    />
                    <span className="text-xs font-semibold text-text-0 min-w-[32px] text-center font-mono">
                      {effort}%
                    </span>
                  </div>
                </div>

                {/* Early Stop */}
                <div className="mb-3.5">
                  <Tooltip content={"Stop hyperopt early if no improvement after N epochs. Saves time on stale optimization runs."} configKey="--early-stop">
                    <FormLabel label="Early Stop" />
                  </Tooltip>
                  <FormInput type="number" defaultValue={50} placeholder="Epochs without improvement" />
                </div>

                <hr className="border-t border-border my-4" />

                {/* Toggles */}
                <Tooltip content={"Analyze results after each epoch"} configKey="--analyze-per-epoch">
                  <Toggle on={analyzePerEpoch} onToggle={() => setAnalyzePerEpoch(!analyzePerEpoch)} label="Analyze per epoch" />
                </Tooltip>
                <Tooltip content={"Skip exporting final parameters"} configKey="--disable-param-export">
                  <Toggle on={disableParamExport} onToggle={() => setDisableParamExport(!disableParamExport)} label="Disable param export" />
                </Tooltip>

                {/* Run Hyperopt Button */}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    disabled={running || !selectedBotId}
                    onClick={handleRunHyperopt}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-btn border-none bg-amber text-black text-xs font-semibold cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {running ? "Running..." : "⚙ Run Hyperopt"}
                  </button>
                  <button type="button" onClick={handleResetHyperopt} className="py-2 px-3.5 rounded-btn border border-border bg-bg-2 text-text-1 text-xs font-medium cursor-pointer transition-all hover:border-border-hover hover:bg-bg-3">
                    Reset
                  </button>
                </div>

                {/* ── AI Hyperopt Advisory ── */}
                <hr className="border-t border-border my-4" />
                <div className="text-[10px] font-semibold text-accent uppercase tracking-wider mb-2">
                  AI Hyperopt Advisory
                </div>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    disabled={aiAnalyzing || !selectedBotId}
                    onClick={handleAIPreAnalyze}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-btn border border-accent/30 bg-accent/10 text-accent text-xs font-semibold cursor-pointer transition-all hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiAnalyzing ? "Analyzing..." : "AI Pre-Analysis"}
                  </button>
                  <button
                    type="button"
                    disabled={aiAnalyzing || !selectedBotId || !btResult}
                    onClick={handleAIPostAnalyze}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-btn border border-amber/30 bg-amber/10 text-amber text-xs font-semibold cursor-pointer transition-all hover:bg-amber/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiAnalyzing ? "Analyzing..." : "AI Post-Analysis"}
                  </button>
                </div>

                {/* Pre-Analysis Results */}
                {aiPreAnalysis && (
                  <div className="mb-3 p-3 rounded-lg border border-accent/20 bg-accent/[0.04]">
                    <div className="text-[10px] font-bold text-accent uppercase mb-2">
                      Pre-Analysis Suggestions
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {aiPreAnalysis.suggested_loss_function && (
                        <>
                          <span className="text-text-3">Loss Function:</span>
                          <span className="text-text-0 font-mono">{aiPreAnalysis.suggested_loss_function}</span>
                        </>
                      )}
                      {aiPreAnalysis.suggested_sampler && (
                        <>
                          <span className="text-text-3">Sampler:</span>
                          <span className="text-text-0 font-mono">{aiPreAnalysis.suggested_sampler}</span>
                        </>
                      )}
                      {aiPreAnalysis.suggested_epochs != null && (
                        <>
                          <span className="text-text-3">Epochs:</span>
                          <span className="text-text-0 font-mono">{aiPreAnalysis.suggested_epochs}</span>
                        </>
                      )}
                      {aiPreAnalysis.claude_confidence != null && (
                        <>
                          <span className="text-text-3">Claude Confidence:</span>
                          <span className="text-green font-semibold">{(aiPreAnalysis.claude_confidence * 100).toFixed(1)}%</span>
                        </>
                      )}
                      {aiPreAnalysis.grok_confidence != null && (
                        <>
                          <span className="text-text-3">Grok Confidence:</span>
                          <span className="text-amber font-semibold">{(aiPreAnalysis.grok_confidence * 100).toFixed(1)}%</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-text-3 mt-1.5">
                      Cost: ${(aiPreAnalysis.total_cost_usd ?? 0).toFixed(4)}
                    </div>
                  </div>
                )}

                {/* Post-Analysis Results */}
                {aiPostAnalysis && (
                  <div className="p-3 rounded-lg border border-amber/20 bg-amber/[0.04]">
                    <div className="text-[10px] font-bold text-amber uppercase mb-2">
                      Post-Analysis: Overfitting Review
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {aiPostAnalysis.recommended_result_index != null && (
                        <>
                          <span className="text-text-3">Recommended Result:</span>
                          <span className="text-text-0 font-bold">#{aiPostAnalysis.recommended_result_index + 1}</span>
                        </>
                      )}
                      {aiPostAnalysis.claude_confidence != null && (
                        <>
                          <span className="text-text-3">Claude Confidence:</span>
                          <span className="text-green font-semibold">{(aiPostAnalysis.claude_confidence * 100).toFixed(1)}%</span>
                        </>
                      )}
                      {aiPostAnalysis.grok_confidence != null && (
                        <>
                          <span className="text-text-3">Grok Confidence:</span>
                          <span className="text-amber font-semibold">{(aiPostAnalysis.grok_confidence * 100).toFixed(1)}%</span>
                        </>
                      )}
                      {aiPostAnalysis.baseline_profit != null && (
                        <>
                          <span className="text-text-3">Baseline Profit:</span>
                          <span className={`font-semibold ${(aiPostAnalysis.baseline_profit ?? 0) >= 0 ? "text-green" : "text-red"}`}>
                            {fmtNum(aiPostAnalysis.baseline_profit)}
                          </span>
                        </>
                      )}
                    </div>
                    {Array.isArray(aiPostAnalysis.overfitting_scores) && aiPostAnalysis.overfitting_scores.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] text-text-3">Overfitting Scores: </span>
                        <span className="text-[10px] font-mono text-text-0">
                          {aiPostAnalysis.overfitting_scores.map((s, i) => {
                            const score = typeof s === "object" && s !== null ? s.risk_score : s;
                            const verdict = typeof s === "object" && s !== null ? s.verdict : "";
                            const verdictColor = verdict === "SAFE" ? "text-green" : verdict === "CAUTION" ? "text-amber" : "text-red";
                            return (
                              <span key={`of-${s.result_index ?? i}`}>
                                {i > 0 && ", "}
                                #{i + 1}: {typeof score === "number" ? score.toFixed(2) : String(score)}
                                {verdict && <span className={`ml-0.5 ${verdictColor}`}>({verdict})</span>}
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    )}
                    <div className="text-[10px] text-text-3 mt-1.5">
                      Cost: ${(aiPostAnalysis.total_cost_usd ?? 0).toFixed(4)}
                    </div>
                  </div>
                )}

                {/* Section A: AI Comparison View */}
                {aiPostAnalysis && (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-text-0">AI Comparison</div>
                      <button type="button" onClick={() => handleViewComparison(aiPostAnalysis.id)}
                        className="text-[10px] px-2 py-1 rounded border border-accent/30 text-accent hover:bg-accent/10 cursor-pointer transition-all">
                        View Comparison
                      </button>
                    </div>
                    {hyperoptComparison && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-bg-1 border border-border rounded-lg p-3">
                          <div className="text-2xs text-text-3 uppercase mb-1">Baseline</div>
                          <div className="text-text-0">Profit: {hyperoptComparison.baseline.profit != null ? `${(hyperoptComparison.baseline.profit * 100).toFixed(2)}%` : "\u2014"}</div>
                          <div className="text-text-2">Sharpe: {hyperoptComparison.baseline.sharpe?.toFixed(2) ?? "\u2014"}</div>
                          <div className="text-text-2">Max DD: {hyperoptComparison.baseline.max_drawdown != null ? `${(hyperoptComparison.baseline.max_drawdown * 100).toFixed(1)}%` : "\u2014"}</div>
                        </div>
                        <div className="bg-bg-1 border border-accent/20 rounded-lg p-3">
                          <div className="text-2xs text-accent uppercase mb-1">AI Recommended (#{hyperoptComparison.recommended_result_index ?? "?"})</div>
                          <div className="text-text-0">Claude: {hyperoptComparison.claude_confidence != null ? `${(hyperoptComparison.claude_confidence * 100).toFixed(0)}%` : "\u2014"}</div>
                          <div className="text-text-0">Grok: {hyperoptComparison.grok_confidence != null ? `${(hyperoptComparison.grok_confidence * 100).toFixed(0)}%` : "\u2014"}</div>
                          <div className={hyperoptComparison.advisors_agree ? "text-green" : "text-amber"}>{hyperoptComparison.advisors_agree ? "Advisors Agree" : "Advisors Disagree"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Section B: Outcome Feedback */}
                {aiPostAnalysis && (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="text-xs font-semibold text-text-0 mb-2">Was this recommendation helpful?</div>
                    <div className="flex gap-2 items-center">
                      {(["helpful", "neutral", "wrong"] as const).map((fb) => (
                        <button key={fb} type="button"
                          onClick={() => setOutcomeFeedback(outcomeFeedback === fb ? null : fb)}
                          className={`px-3 py-1.5 text-xs rounded border cursor-pointer transition-all ${
                            outcomeFeedback === fb
                              ? fb === "helpful" ? "border-green/40 bg-green-bg text-green" : fb === "wrong" ? "border-red/40 bg-red-bg text-red" : "border-amber/40 bg-amber-bg text-amber"
                              : "border-border text-text-2 hover:bg-bg-3"
                          }`}>
                          {fb === "helpful" ? "Helpful" : fb === "neutral" ? "Neutral" : "Wrong"}
                        </button>
                      ))}
                      <button type="button" disabled={!outcomeFeedback || outcomeSubmitting}
                        onClick={() => handleSubmitOutcome(aiPostAnalysis.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-accent text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all ml-2">
                        {outcomeSubmitting ? "Submitting..." : "Submit Feedback"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Section C: Comparison History */}
                <Card className="mt-4">
                  <CardHeader title="AI Comparison History" icon="history"
                    action={<button type="button" onClick={loadComparisonHistory}
                      className="text-xs text-accent cursor-pointer font-medium">{comparisonHistoryLoading ? "Loading..." : "Load History"}</button>} />
                  {comparisonHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-border text-text-3">
                          <th className="text-left py-2 px-3 font-medium">Strategy</th>
                          <th className="text-left py-2 px-3 font-medium">Pair</th>
                          <th className="text-left py-2 px-3 font-medium">TF</th>
                          <th className="text-right py-2 px-3 font-medium">Rec. #</th>
                          <th className="text-right py-2 px-3 font-medium">Claude</th>
                          <th className="text-right py-2 px-3 font-medium">Grok</th>
                          <th className="text-left py-2 px-3 font-medium">Date</th>
                        </tr></thead>
                        <tbody>{comparisonHistory.map((c) => (
                          <tr key={c.id} className="border-b border-border/30 hover:bg-bg-3 transition-colors cursor-pointer"
                            onClick={() => handleViewComparison(c.id)}>
                            <td className="py-2 px-3 text-text-0 font-medium">{c.strategy_name}</td>
                            <td className="py-2 px-3 text-text-2">{c.pair}</td>
                            <td className="py-2 px-3 text-text-2">{c.timeframe}</td>
                            <td className="py-2 px-3 text-right text-text-0">#{c.recommended_result_index ?? "\u2014"}</td>
                            <td className="py-2 px-3 text-right text-text-0">{c.claude_confidence != null ? `${(c.claude_confidence * 100).toFixed(0)}%` : "\u2014"}</td>
                            <td className="py-2 px-3 text-right text-text-0">{c.grok_confidence != null ? `${(c.grok_confidence * 100).toFixed(0)}%` : "\u2014"}</td>
                            <td className="py-2 px-3 text-text-3">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "\u2014"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : (
                    <CardBody><div className="py-4 text-center text-sm text-text-3">Click &quot;Load History&quot; to see past AI comparisons</div></CardBody>
                  )}
                </Card>
              </CardBody>
            )}

            {/* ──── VALIDATION TAB ──── */}
            {mainTab === "validation" && (
              <CardBody>
                {/* Strategy */}
                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.bt_strategy?.description ?? "Strategy to validate"} configKey="--strategy">
                    <FormLabel label="Strategy" />
                  </Tooltip>
                  <FormSelect
                    value={valStrategy}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setValStrategy(e.target.value)}
                  >
                    {(ftStrategies.length > 0 ? ftStrategies : defaultStrategies).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </FormSelect>
                </div>

                <div className="mb-3.5">
                  <Tooltip content={TOOLTIPS.bt_timeframe?.description ?? "Timeframe for validation analysis"} configKey="--timeframe">
                    <FormLabel label="Timeframe" />
                  </Tooltip>
                  <FormSelect defaultValue="1h">
                    <option>1h</option>
                    <option>5m</option>
                    <option>15m</option>
                  </FormSelect>
                </div>

                <hr className="border-t border-border my-4" />

                {/* Analysis Controls (§30) */}
                <div className="text-[11px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-2.5">
                  Analysis Filters
                </div>

                <div className="mb-3.5">
                  <Tooltip content={"Filter analysis by specific entry reasons (enter_tag values). Leave empty for all."} configKey="--enter-reason-list">
                    <FormLabel label="Enter Reason List" />
                  </Tooltip>
                  <TagInput tags={analysisEnterReasons} placeholder="Add enter reason..." onChange={(tags) => setAnalysisEnterReasons(tags)} />
                </div>
                <div className="mb-3.5">
                  <Tooltip content={"Filter analysis by specific exit reasons (exit_reason values). Leave empty for all."} configKey="--exit-reason-list">
                    <FormLabel label="Exit Reason List" />
                  </Tooltip>
                  <TagInput tags={analysisExitReasons} placeholder="Add exit reason..." onChange={(tags) => setAnalysisExitReasons(tags)} />
                </div>
                <div className="mb-3.5">
                  <Tooltip content={"Filter analysis by specific indicators. Shows how indicator values correlate with trade outcomes."} configKey="--indicator-list">
                    <FormLabel label="Indicator List" />
                  </Tooltip>
                  <TagInput tags={analysisIndicators} placeholder="Add indicator..." onChange={(tags) => setAnalysisIndicators(tags)} />
                </div>
                <Tooltip content={"Show rejected signals in analysis"} configKey="--rejected-signals">
                  <Toggle on={analysisRejectedSignals} onToggle={() => setAnalysisRejectedSignals(!analysisRejectedSignals)} label="Rejected Signals" />
                </Tooltip>

                <div className="mt-3 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      const sr = getStrategyResult(btResult);
                      if (!sr) { toast.warning("Run a backtest first."); return; }
                      exportResultsCSV(sr);
                      toast.success("Analysis CSV exported.");
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-btn border border-border bg-bg-2 text-text-1 text-xs font-medium cursor-pointer transition-all hover:border-border-hover hover:bg-bg-3"
                  >
                    📥 Export Analysis CSV
                  </button>
                </div>

                <hr className="border-t border-border my-4" />

                {/* Action Buttons */}
                <div className="flex gap-2 mb-5">
                  <button
                    type="button"
                    onClick={handleLookaheadAnalysis}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-btn border-none bg-accent text-white text-xs font-semibold cursor-pointer transition-all hover:bg-accent-dim hover:-translate-y-px"
                  >
                    🔍 Lookahead Analysis
                  </button>
                  <button
                    type="button"
                    onClick={handleRecursiveAnalysis}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-btn border border-border bg-bg-2 text-text-1 text-xs font-medium cursor-pointer transition-all hover:border-border-hover hover:bg-bg-3"
                  >
                    🔄 Recursive Analysis
                  </button>
                </div>

                <hr className="border-t border-border my-4" />

                {/* Lookahead Analysis Results */}
                <div className="text-[11px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-2.5">
                  Lookahead Analysis Results
                </div>
                <div className="text-center py-4 text-text-3 text-xs">
                  Run Lookahead Analysis above to see results.
                </div>

                <hr className="border-t border-border my-4" />

                {/* Recursive Analysis Results */}
                <div className="text-[11px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-2.5">
                  Recursive Analysis Results
                </div>
                <div className="text-center py-4 text-text-3 text-xs">
                  Run Recursive Analysis above to see results.
                </div>
              </CardBody>
            )}
          </Card>
        </div>

        {/* ════════ RIGHT COLUMN: RESULTS ════════ */}
        <div className="flex flex-col gap-4">
          {(() => {
            const allResults = getAllStrategyResults(btResult);
            const isMultiStrategy = allResults.length > 1;
            const sr = isMultiStrategy && selectedCompareStrategy
              ? allResults.find((r) => r.name === selectedCompareStrategy)?.result ?? getStrategyResult(btResult)
              : getStrategyResult(btResult);

            /* ── No results yet ── */
            if (!btResult || !sr) {
              return (
                <>
                  {/* Show progress if backtest is running */}
                  {btResult && btResult.running && (
                    <Card>
                      <CardHeader
                        title="Backtest Progress"
                        icon="&#9881;"
                        action={<span className="text-[11px] text-amber font-semibold">{btResult.step || "Running..."}</span>}
                      />
                      <CardBody>
                        <div className="flex justify-between text-[11px] text-text-2 mb-1">
                          <span>{selectedStrategy}</span>
                          <span>{Math.round((btResult.progress ?? 0) * 100)}%</span>
                        </div>
                        <div className="h-1 bg-bg-3 rounded overflow-hidden my-3">
                          <div
                            className="h-full bg-gradient-to-r from-accent to-purple rounded transition-all"
                            style={{ width: `${Math.round((btResult.progress ?? 0) * 100)}%` }}
                          />
                        </div>
                      </CardBody>
                    </Card>
                  )}

                  {/* Empty state */}
                  <div className="grid grid-cols-4 gap-3.5">
                    <StatBox label="Total Trades" value={"\u2014"} />
                    <StatBox label="Win Rate" value={"\u2014"} />
                    <StatBox label="Total Profit" value={"\u2014"} />
                    <StatBox label="Max Drawdown" value={"\u2014"} />
                  </div>
                  <div className="grid grid-cols-3 gap-3.5">
                    <StatBox label="Sharpe Ratio" value={"\u2014"} />
                    <StatBox label="Sortino Ratio" value={"\u2014"} />
                    <StatBox label="Calmar Ratio" value={"\u2014"} />
                  </div>
                  <Card>
                    <CardBody>
                      <div className="text-center py-8 text-text-3 text-sm">
                        Run a backtest to see results
                      </div>
                    </CardBody>
                  </Card>
                </>
              );
            }

            /* ── We have results ── */
            const winRate = sr.total_trades > 0 ? ((sr.wins ?? 0) / sr.total_trades) * 100 : 0;
            const profitPct = (sr.profit_total ?? 0) * 100;
            // FT 2026.2: max_drawdown is null, use max_drawdown_account instead
            const ddPct = (sr.max_drawdown_account ?? sr.max_drawdown ?? 0) * 100;
            const stakeCurrency = sr.stake_currency || "USDT";
            const pairRows = sr.results_per_pair || [];
            // Separate TOTAL row (FT includes a TOTAL row with key "TOTAL")
            const pairDataRows = pairRows.filter((r) => r.key !== "TOTAL");
            const totalRow = pairRows.find((r) => r.key === "TOTAL");
            const enterTagStats = sr.results_per_enter_tag || [];
            const exitReasonStats = sr.exit_reason_summary || [];
            const mixTagStats = sr.mix_tag_stats || [];
            // Choose analysis data based on analysisTab
            const analysisTabData = analysisTab === 0 ? enterTagStats
              : analysisTab === 5 ? exitReasonStats
              : analysisTab === 2 ? mixTagStats
              : enterTagStats; // default fallback

            // Period breakdown from FT — FT 2026.2 returns arrays, not dicts
            const periodicBreakdown = sr.periodic_breakdown;
            const rawBreakdown = periodicBreakdown ? periodicBreakdown[breakdownTab] : null;
            const breakdownEntries: Array<{ date: string; profit_abs: number; wins: number; draws: number; losses: number; trades?: number }> =
              Array.isArray(rawBreakdown) ? rawBreakdown
              : rawBreakdown && typeof rawBreakdown === "object" ? Object.values(rawBreakdown)
              : [];

            // Runtime
            const runtimeSecs = sr.backtest_run_end_ts && sr.backtest_run_start_ts
              ? ((sr.backtest_run_end_ts - sr.backtest_run_start_ts) / 1000).toFixed(1)
              : null;

            return (
              <>
                {/* Live result badge */}
                <div className="flex items-center gap-2 px-3 py-2 bg-green-bg border border-green/25 rounded-card text-[11px] text-green font-semibold">
                  Live result: {sr.strategy_name} &mdash; {sr.total_trades} trades &mdash; {sr.timerange}
                </div>

                {/* Multi-Strategy Comparison Table */}
                {isMultiStrategy && (
                  <Card>
                    <CardHeader title="Strategy Comparison" icon="&#9878;" action={<span className="text-[10px] text-text-3">{allResults.length} strategies</span>} />
                    <CardBody>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-text-3 uppercase tracking-wider text-[10px]">
                              <th className="pb-2 pr-3">Strategy</th>
                              <th className="pb-2 pr-3 text-right">Trades</th>
                              <th className="pb-2 pr-3 text-right">Profit %</th>
                              <th className="pb-2 pr-3 text-right">Profit Abs</th>
                              <th className="pb-2 pr-3 text-right">Win Rate</th>
                              <th className="pb-2 pr-3 text-right">Sharpe</th>
                              <th className="pb-2 pr-3 text-right">Max DD</th>
                              <th className="pb-2 text-right">Avg Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allResults.map(({ name, result: r }) => {
                              const wr = r.total_trades > 0 ? (r.wins / r.total_trades) * 100 : 0;
                              const isSelected = selectedCompareStrategy === name;
                              return (
                                <tr
                                  key={name}
                                  onClick={() => setSelectedCompareStrategy(name)}
                                  className={[
                                    "cursor-pointer transition-colors border-t border-border/40",
                                    isSelected ? "bg-accent-glow" : "hover:bg-bg-3",
                                  ].join(" ")}
                                >
                                  <td className={`py-2 pr-3 font-medium ${isSelected ? "text-accent" : "text-text-0"}`}>{name}</td>
                                  <td className="py-2 pr-3 text-right text-text-1">{r.total_trades}</td>
                                  <td className={`py-2 pr-3 text-right font-semibold ${(r.profit_total ?? 0) >= 0 ? "text-green" : "text-red"}`}>
                                    {((r.profit_total ?? 0) * 100).toFixed(2)}%
                                  </td>
                                  <td className={`py-2 pr-3 text-right ${(r.profit_total_abs ?? 0) >= 0 ? "text-green" : "text-red"}`}>
                                    {(r.profit_total_abs ?? 0).toFixed(2)} {r.stake_currency ?? ""}
                                  </td>
                                  <td className="py-2 pr-3 text-right text-text-1">{wr.toFixed(1)}%</td>
                                  <td className="py-2 pr-3 text-right text-text-1">{r.sharpe?.toFixed(2) ?? "\u2014"}</td>
                                  <td className="py-2 pr-3 text-right text-red">{((r.max_drawdown_account ?? r.max_drawdown ?? 0) * 100).toFixed(2)}%</td>
                                  <td className="py-2 text-right text-text-2">{r.holding_avg ?? "\u2014"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-[10px] text-text-3">Click a strategy row to see its detailed results below.</p>
                    </CardBody>
                  </Card>
                )}

                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-3.5">
                  <StatBox
                    label="Total Trades"
                    value={String(sr.total_trades)}
                    sub={`Win: ${sr.wins} / Loss: ${sr.losses}${sr.draws ? ` / Draw: ${sr.draws}` : ""}`}
                  />
                  <StatBox
                    label="Win Rate"
                    value={`${winRate.toFixed(2)}%`}
                    sub={`Avg duration: ${sr.holding_avg}`}
                    color={winRate >= 50 ? "green" : "red"}
                  />
                  <StatBox
                    label="Total Profit"
                    value={`${fmtNum(sr.profit_total_abs)} ${stakeCurrency}`}
                    sub={`${fmtNum(profitPct)}% on wallet`}
                    color={profitColorName(sr.profit_total_abs)}
                  />
                  <StatBox
                    label="Max Drawdown"
                    value={`${fmtNum(-Math.abs(ddPct))}%`}
                    sub={`${fmtNum(-Math.abs(sr.max_drawdown_abs))} ${stakeCurrency} abs`}
                    color="red"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3.5">
                  <StatBox
                    label="Sharpe Ratio"
                    value={sr.sharpe != null ? sr.sharpe.toFixed(2) : "\u2014"}
                    color={sr.sharpe != null ? (sr.sharpe >= 1 ? "green" : sr.sharpe >= 0 ? "amber" : "red") : undefined}
                  />
                  <StatBox
                    label="Sortino Ratio"
                    value={sr.sortino != null ? sr.sortino.toFixed(2) : "\u2014"}
                    color={sr.sortino != null ? (sr.sortino >= 1 ? "green" : sr.sortino >= 0 ? "amber" : "red") : undefined}
                  />
                  <StatBox
                    label="Calmar Ratio"
                    value={sr.calmar != null ? sr.calmar.toFixed(2) : "\u2014"}
                    color={sr.calmar != null ? (sr.calmar >= 1 ? "green" : sr.calmar >= 0 ? "amber" : "red") : undefined}
                  />
                </div>

                {/* Progress bar */}
                <Card>
                  <CardHeader
                    title="Backtest Progress"
                    icon="&#9881;"
                    action={<span className="text-[11px] text-green font-semibold">Complete</span>}
                  />
                  <CardBody>
                    <div className="flex justify-between text-[11px] text-text-2 mb-1">
                      <span>{sr.strategy_name} / {sr.pairlist?.join(", ") ?? "all pairs"}</span>
                      <span>{sr.total_trades} trades processed</span>
                    </div>
                    <div className="h-1 bg-bg-3 rounded overflow-hidden my-3">
                      <div className="h-full bg-gradient-to-r from-accent to-purple rounded w-full transition-all" />
                    </div>
                    <div className="text-[10px] text-text-3 mt-1">
                      {runtimeSecs ? `Completed in ${runtimeSecs}s` : "Completed"} &mdash; timerange: {sr.timerange}
                    </div>
                  </CardBody>
                </Card>

                {/* Pair Results Table */}
                <Card>
                  <CardHeader
                    title="Pair Results"
                    icon="&#128202;"
                    action={
                      <button
                        type="button"
                        onClick={() => exportResultsCSV(sr)}
                        className="text-[11px] text-accent cursor-pointer font-medium hover:text-accent-dim bg-transparent border-none"
                      >
                        Export CSV
                      </button>
                    }
                  />
                  <CardBody className="p-0 overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {["Pair", "Trades", "Win Rate", "close_profit_abs", "Profit %", "Wins", "Losses", "Avg Duration"].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pairDataRows.map((r) => {
                          const wr = r.trades > 0 ? (r.wins / r.trades) * 100 : 0;
                          return (
                            <tr key={r.key} className="hover:bg-bg-3 transition-colors">
                              <td className="px-4 py-3 text-xs font-semibold text-text-0">{r.key}</td>
                              <td className="px-4 py-3 text-xs">{r.trades}</td>
                              <td className={`px-4 py-3 text-xs font-semibold ${wr >= 50 ? "text-green" : "text-red"}`}>{wr.toFixed(2)}%</td>
                              <td className={`px-4 py-3 text-xs font-semibold ${(r.profit_total_abs ?? 0) >= 0 ? "text-green" : "text-red"}`}>{fmtNum(r.profit_total_abs)}</td>
                              <td className={`px-4 py-3 text-xs font-semibold ${(r.profit_total_pct ?? 0) >= 0 ? "text-green" : "text-red"}`}>{fmtNum(r.profit_total_pct)}%</td>
                              <td className="px-4 py-3 text-xs text-green">{r.wins}</td>
                              <td className="px-4 py-3 text-xs text-red">{r.losses}</td>
                              <td className="px-4 py-3 text-xs text-text-2">{r.duration_avg}</td>
                            </tr>
                          );
                        })}
                        {/* TOTAL row */}
                        {totalRow && (
                          <tr className="bg-bg-3 font-semibold">
                            <td className="px-4 py-3 text-xs text-accent">TOTAL</td>
                            <td className="px-4 py-3 text-xs text-text-0">{totalRow.trades}</td>
                            <td className={`px-4 py-3 text-xs font-semibold ${winRate >= 50 ? "text-green" : "text-red"}`}>{winRate.toFixed(2)}%</td>
                            <td className={`px-4 py-3 text-xs font-semibold ${(totalRow.profit_total_abs ?? 0) >= 0 ? "text-green" : "text-red"}`}>{fmtNum(totalRow.profit_total_abs)}</td>
                            <td className={`px-4 py-3 text-xs font-semibold ${(totalRow.profit_total_pct ?? 0) >= 0 ? "text-green" : "text-red"}`}>{fmtNum(totalRow.profit_total_pct)}%</td>
                            <td className="px-4 py-3 text-xs text-green">{totalRow.wins}</td>
                            <td className="px-4 py-3 text-xs text-red">{totalRow.losses}</td>
                            <td className="px-4 py-3 text-xs text-text-2">{totalRow.duration_avg}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>

                {/* Trade Analysis */}
                <Card>
                  <CardHeader
                    title="Trade Analysis"
                    icon="&#128200;"
                    action={
                      <div className="flex items-center gap-2">
                        <Toggle on={showRejected} onToggle={() => setShowRejected(!showRejected)} label="Show rejected" />
                      </div>
                    }
                  />
                  {/* Analysis group tabs */}
                  <div className="flex gap-1 px-[18px] py-3 flex-wrap">
                    {analysisGroups.map((g, i) => (
                      <button
                        type="button"
                        key={g}
                        onClick={() => setAnalysisTab(i)}
                        className={`py-1.5 px-3 rounded-full text-[10.5px] font-medium cursor-pointer transition-all border ${
                          analysisTab === i
                            ? "bg-accent-glow text-accent border-accent/20"
                            : "text-text-3 border-transparent hover:text-text-1 hover:bg-bg-3"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <CardBody className="p-0 overflow-x-auto">
                    {analysisTabData.length === 0 ? (
                      <div className="text-center py-6 text-text-3 text-xs">
                        No tag analysis data available for this backtest.
                      </div>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            {["Tag", "Trades", "Win Rate", "close_profit_abs", "Avg Profit %", "Avg Duration"].map((h) => (
                              <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysisTabData.map((r) => {
                            const wr = r.trades > 0 ? (r.wins / r.trades) * 100 : 0;
                            return (
                              <tr key={r.key} className="hover:bg-bg-3 transition-colors">
                                <td className="px-4 py-3 text-xs">
                                  <Badge label={r.key} variant="info" />
                                </td>
                                <td className="px-4 py-3 text-xs">{r.trades}</td>
                                <td className={`px-4 py-3 text-xs font-semibold ${wr >= 50 ? "text-green" : "text-red"}`}>{wr.toFixed(2)}%</td>
                                <td className={`px-4 py-3 text-xs font-semibold ${(r.profit_total_abs ?? 0) >= 0 ? "text-green" : "text-red"}`}>{fmtNum(r.profit_total_abs)}</td>
                                <td className={`px-4 py-3 text-xs font-semibold ${(r.profit_mean_pct ?? 0) >= 0 ? "text-green" : "text-red"}`}>{fmtNum(r.profit_mean_pct)}%</td>
                                <td className="px-4 py-3 text-xs text-text-2">{r.duration_avg}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </CardBody>
                </Card>

                {/* Period Breakdown */}
                <Card>
                  <CardHeader title="Period Breakdown" icon="&#128197;" />
                  <div className="flex gap-0.5 px-[18px] bg-bg-2 border-b border-border">
                    {(["day", "month"] as const).map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        onClick={() => setBreakdownTab(tab)}
                        className={`py-2.5 px-4 text-[11.5px] font-medium cursor-pointer border-b-2 transition-all capitalize ${
                          breakdownTab === tab
                            ? "text-accent border-accent font-semibold"
                            : "text-text-3 border-transparent hover:text-text-1"
                        }`}
                      >
                        {tab === "day" ? "Day" : "Month"}
                      </button>
                    ))}
                  </div>
                  <CardBody className="p-0 overflow-x-auto">
                    {breakdownEntries.length === 0 ? (
                      <div className="text-center py-6 text-text-3 text-xs">
                        No breakdown data. Enable --breakdown {breakdownTab} in your backtest config.
                      </div>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            {["Period", "Profit Abs", "Wins", "Losses", "Draws"].map((h) => (
                              <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {breakdownEntries.slice(0, showAllBreakdown ? undefined : 20).map((entry, i) => {
                            return (
                              <tr key={entry.date || i} className="hover:bg-bg-3 transition-colors">
                                <td className="px-4 py-3 text-xs font-medium text-text-0">{entry.date}</td>
                                <td className={`px-4 py-3 text-xs font-semibold ${(entry.profit_abs ?? 0) >= 0 ? "text-green" : "text-red"}`}>{fmtNum(entry.profit_abs)}</td>
                                <td className="px-4 py-3 text-xs text-green">{entry.wins}</td>
                                <td className="px-4 py-3 text-xs text-red">{entry.losses}</td>
                                <td className="px-4 py-3 text-xs text-text-2">{entry.draws}</td>
                              </tr>
                            );
                          })}
                          {breakdownEntries.length > 20 && !showAllBreakdown && (
                            <tr>
                              <td colSpan={5} className="px-4 py-3 text-center">
                                <button type="button" onClick={() => setShowAllBreakdown(true)} className="text-accent text-[11px] font-medium hover:underline cursor-pointer">
                                  Show all {breakdownEntries.length} rows
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </CardBody>
                </Card>

                {/* Run Summary (replaces hardcoded history) */}
                <Card>
                  <CardHeader title="Current Run" icon="&#128336;" />
                  <CardBody className="p-0">
                    <div className="flex items-center gap-4 px-4 py-3 bg-accent/[0.04]">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 bg-accent-glow text-accent">
                        {"\u25B6"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-text-0 whitespace-nowrap overflow-hidden text-ellipsis">
                          {sr.strategy_name} &mdash; {sr.pairlist?.slice(0, 3).join(", ")}{(sr.pairlist?.length ?? 0) > 3 ? ` +${(sr.pairlist?.length ?? 0) - 3}` : ""}
                        </div>
                        <div className="text-[10px] text-text-3 mt-0.5">
                          Backtest &bull; {sr.timeframe} &bull; {sr.timerange}{runtimeSecs ? ` \u2022 ${runtimeSecs}s` : ""}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-[13px] font-bold ${(sr.profit_total_abs ?? 0) >= 0 ? "text-green" : "text-red"}`}>
                          {fmtNum(sr.profit_total_abs)}
                        </div>
                        <div className="text-[10px] text-text-3">{sr.total_trades} trades</div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </>
            );
          })()}

          {/* ── Backtest History ── */}
          <Card>
            <CardHeader
              title="Backtest History"
              icon="&#128218;"
              action={
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedBotId) return;
                    setBtHistoryLoading(true);
                    try {
                      const r = await botBacktestHistory(parseInt(selectedBotId, 10));
                      setBtHistory(r.results);
                    } catch { /* non-blocking */
                      setBtHistory([]);
                    } finally {
                      setBtHistoryLoading(false);
                    }
                  }}
                  className="text-[11px] text-accent cursor-pointer font-medium hover:text-accent-dim bg-transparent border-none"
                >
                  {btHistoryLoading ? "Loading..." : btHistory.length > 0 ? "Refresh" : "Load History"}
                </button>
              }
            />
            <CardBody className="p-0 overflow-x-auto">
              {btHistoryLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : btHistory.length === 0 ? (
                <div className="text-center py-6 text-text-3 text-xs">
                  {selectedBotId ? "Click Load History to see past backtest runs." : "Select a bot first."}
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["Strategy", "Run ID", "Start Time", "File"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {btHistory.map((entry) => (
                      <tr key={entry.run_id} className="hover:bg-bg-3 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold text-text-0">{entry.strategy}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-text-2">{entry.run_id.slice(0, 12)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-text-2">
                          {entry.backtest_start_time
                            ? new Date(entry.backtest_start_time * 1000).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-text-3 max-w-[200px] truncate">{entry.filename}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
