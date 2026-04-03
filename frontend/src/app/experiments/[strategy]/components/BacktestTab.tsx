"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { botLogs, botBacktestResults, botBacktestStart, botBacktestDelete, botBacktestHistory, botBacktestHistoryResult, botBacktestHistoryDelete, createExperimentRun } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ── Types ────────────────────────────────────────────────────────────────
interface BacktestTabProps {
  strategy: string;
  backtestBotId?: number;
  experimentId?: number;
}

interface LogEntry { ts: string; level: string; msg: string; }

interface FTStrategyResult {
  strategy_name: string; total_trades: number; trade_count_long: number; trade_count_short: number;
  profit_total: number; profit_total_abs: number; profit_mean: number; profit_median: number;
  profit_factor: number; wins: number; losses: number; draws: number; winrate: number;
  sharpe: number; sortino: number; calmar: number; expectancy: number; expectancy_ratio: number;
  max_drawdown_account: number; max_drawdown_abs: number; starting_balance: number; final_balance: number;
  stake_currency: string; backtest_start: string; backtest_end: string; backtest_days: number;
  timeframe: string; timeframe_detail: string | null; stoploss: number; max_open_trades_setting: number;
  trading_mode: string; holding_avg: string; backtest_best_day: number; backtest_worst_day: number;
  backtest_best_day_abs: number; backtest_worst_day_abs: number; winning_days: number; losing_days: number;
  draw_days: number; max_consecutive_wins: number; max_consecutive_losses: number; cagr: number; sqn: number;
  results_per_pair: Array<{ key: string; trades: number; profit_mean: number; profit_total: number; profit_total_abs: number }>;
  exit_reason_summary: Array<{ exit_reason: string; trades: number; profit_mean: number; profit_total: number; profit_total_abs: number; wins: number; losses: number }>;
  periodic_breakdown?: Record<string, Array<{ date: string; trades: number; profit_abs: number }>>;
  trades?: FTTradeEntry[];
}

interface FTTradeEntry {
  trade_id: number; pair: string; is_short: boolean; stake_amount: number;
  open_rate: number; close_rate: number; fee_open: number; fee_close: number;
  close_profit: number; close_profit_abs: number; open_date: string; close_date: string;
  trade_duration: number; enter_tag: string; exit_reason: string;
}

interface HistoryEntry {
  filename: string; strategy: string; run_id: string; backtest_start_time: number;
  timeframe?: string; timeframe_detail?: string | null; backtest_start_ts?: number; backtest_end_ts?: number;
}


function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return `${days}d ${rem}h`;
}

function fmt$(v: number): string { return `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtPctR(v: number): string { return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`; }
function fmtN(v: number): string { return v.toFixed(2); }

// ── Toggle ──────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className={`builder-toggle ${on ? "on" : ""}`} onClick={onToggle}>
      <div className="dot" />
    </div>
  );
}

// ── Pill ────────────────────────────────────────────────────────────────
function Pill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`builder-pill text-[10px] px-2.5 py-1.5 text-center ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      {selected && "✓ "}
      {label}
    </button>
  );
}

// (mock data removed — tables are driven by btResult and filteredHistory)

// ══════════════════════════════════════════════════════════════════════════
// BACKTEST TAB
// ══════════════════════════════════════════════════════════════════════════
export default function BacktestTab({ strategy: propStrategy, backtestBotId = 2, experimentId }: BacktestTabProps) {
  const toast = useToast();

  // ── Config state ──────────────────────────────────────────────────────
  const [strategy] = useState(propStrategy);
  const [timerangeStart, setTimerangeStart] = useState("2024-01-01");
  const [timerangeEnd, setTimerangeEnd] = useState("2025-01-01");
  const [timeframe, setTimeframe] = useState("1h");
  const [timeframeDetail, setTimeframeDetail] = useState("None");
  const [startingCapital, setStartingCapital] = useState("10000");
  const [stakeAmount, setStakeAmount] = useState("unlimited");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [fee, setFee] = useState("");
  const [enableProtections, setEnableProtections] = useState(true);
  const [dryRunWallet, setDryRunWallet] = useState(false);
  const [positionStacking, setPositionStacking] = useState(false);
  const [enableShorts, setEnableShorts] = useState(false);
  const [breakdownSelected, setBreakdownSelected] = useState("month");
  const [cache, setCache] = useState("day");

  // ── Sub-tab state ─────────────────────────────────────────────────────
  const [btSubTab, setBtSubTab] = useState<
    "closed" | "per-pair" | "entry-tags" | "exit-reasons" | "history"
  >("closed");

  // ── Chart toggle state ────────────────────────────────────────────────
  const [chartPeriod, setChartPeriod] = useState<"days" | "weeks" | "months">("days");
  const [chartMode, setChartMode] = useState<"abs" | "rel">("abs");

  // ── API / Running state ───────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [btProgress, setBtProgress] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [btResult, setBtResult] = useState<FTStrategyResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const BT_CACHE_KEY = `bt-result-${strategy}`;

  // ── Trades pagination ──────────────────────────────────────────────────
  const [tradesPage, setTradesPage] = useState(1);
  const tradesPerPage = 20;

  const addLog = useCallback((level: string, msg: string) => {
    setLogs((prev) => {
      const next = [...prev, { ts: new Date().toLocaleTimeString(), level, msg }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ── Extract result from FT nested response ─────────────────────────────
  const extractResult = useCallback((backtestResult: Record<string, unknown>): FTStrategyResult | null => {
    const strategyMap = backtestResult.strategy as Record<string, Record<string, unknown>> | undefined;
    if (!strategyMap) return null;
    const firstKey = Object.keys(strategyMap)[0];
    if (!firstKey) return null;
    const raw = strategyMap[firstKey];
    const rawTrades = (raw.trades as Array<Record<string, unknown>>) || [];
    const trades: FTTradeEntry[] = rawTrades.map((t, i) => ({
      trade_id: Number(t.trade_id ?? i + 1), pair: String(t.pair ?? ''), is_short: Boolean(t.is_short),
      stake_amount: Number(t.stake_amount ?? 0), open_rate: Number(t.open_rate ?? 0), close_rate: Number(t.close_rate ?? 0),
      fee_open: Number(t.fee_open ?? 0), fee_close: Number(t.fee_close ?? 0),
      close_profit: Number(t.profit_ratio ?? t.close_profit ?? 0), close_profit_abs: Number(t.profit_abs ?? t.close_profit_abs ?? 0),
      open_date: String(t.open_date ?? ''), close_date: String(t.close_date ?? ''),
      trade_duration: Number(t.trade_duration ?? 0), enter_tag: String(t.enter_tag ?? ''), exit_reason: String(t.exit_reason ?? ''),
    }));
    const wins = Number(raw.wins ?? 0); const losses = Number(raw.losses ?? 0); const totalTrades = Number(raw.total_trades ?? 0);
    const winrate = Number(raw.winrate ?? (totalTrades > 0 ? wins / totalTrades : 0));
    return {
      strategy_name: String(raw.strategy_name ?? firstKey), total_trades: totalTrades,
      trade_count_long: Number(raw.trade_count_long ?? 0), trade_count_short: Number(raw.trade_count_short ?? 0),
      profit_total: Number(raw.profit_total ?? 0), profit_total_abs: Number(raw.profit_total_abs ?? 0),
      profit_mean: Number(raw.profit_mean ?? 0), profit_median: Number(raw.profit_median ?? 0),
      profit_factor: Number(raw.profit_factor ?? 0), wins, losses, draws: Number(raw.draws ?? 0), winrate,
      sharpe: Number(raw.sharpe ?? raw.sharpe_ratio ?? 0), sortino: Number(raw.sortino ?? raw.sortino_ratio ?? 0),
      calmar: Number(raw.calmar ?? raw.calmar_ratio ?? 0), expectancy: Number(raw.expectancy ?? 0),
      expectancy_ratio: Number(raw.expectancy_ratio ?? 0), max_drawdown_account: Number(raw.max_drawdown_account ?? 0),
      max_drawdown_abs: Number(raw.max_drawdown_abs ?? 0), starting_balance: Number(raw.starting_balance ?? 0),
      final_balance: Number(raw.final_balance ?? 0), stake_currency: String(raw.stake_currency ?? 'USDT'),
      backtest_start: String(raw.backtest_start ?? ''), backtest_end: String(raw.backtest_end ?? ''),
      backtest_days: Number(raw.backtest_days ?? 0), timeframe: String(raw.timeframe ?? ''),
      timeframe_detail: raw.timeframe_detail as string | null ?? null, stoploss: Number(raw.stoploss ?? 0),
      max_open_trades_setting: Number(raw.max_open_trades_setting ?? raw.max_open_trades ?? 0),
      trading_mode: String(raw.trading_mode ?? ''), holding_avg: String(raw.holding_avg ?? raw.holding_avg_s ?? ''),
      backtest_best_day: Number(raw.backtest_best_day ?? 0), backtest_worst_day: Number(raw.backtest_worst_day ?? 0),
      backtest_best_day_abs: Number(raw.backtest_best_day_abs ?? 0), backtest_worst_day_abs: Number(raw.backtest_worst_day_abs ?? 0),
      winning_days: Number(raw.winning_days ?? 0), losing_days: Number(raw.losing_days ?? 0), draw_days: Number(raw.draw_days ?? 0),
      max_consecutive_wins: Number(raw.max_consecutive_wins ?? 0), max_consecutive_losses: Number(raw.max_consecutive_losses ?? 0),
      cagr: Number(raw.cagr ?? 0), sqn: Number(raw.sqn ?? 0),
      results_per_pair: (raw.results_per_pair as FTStrategyResult['results_per_pair']) ?? [],
      exit_reason_summary: (raw.exit_reason_summary as FTStrategyResult['exit_reason_summary']) ?? [],
      periodic_breakdown: (raw.periodic_breakdown as FTStrategyResult['periodic_breakdown']) ?? undefined,
      trades,
    };
  }, []);

  // ── Fetch history ──────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try { const res = await botBacktestHistory(backtestBotId); setHistory(res.results || []); } catch { /* not critical */ }
  }, [backtestBotId]);

  // ── Delete history entry ───────────────────────────────────────────────
  const handleDeleteHistory = useCallback(async (entry: HistoryEntry) => {
    try {
      await botBacktestHistoryDelete(backtestBotId, entry.filename, entry.strategy);
      toast.success('Backtest deleted');
      if (btResult) { setBtResult(null); try { sessionStorage.removeItem(BT_CACHE_KEY); } catch { /* */ } }
      fetchHistory();
    } catch (err) { toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`); }
  }, [backtestBotId, toast, fetchHistory, btResult, BT_CACHE_KEY]);

  // ── Mount: load cache → fetch history → auto-load latest → resume ─────
  useEffect(() => {
    let loadedFromCache = false;
    try {
      const cached = sessionStorage.getItem(BT_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as FTStrategyResult;
        const firstTrade = parsed?.trades?.[0];
        const cacheValid = parsed?.total_trades && (!firstTrade || (firstTrade.close_profit !== undefined && !isNaN(firstTrade.close_profit)));
        if (cacheValid) { setBtResult(parsed); addLog('INFO', `Loaded cached result: ${parsed.strategy_name} — ${parsed.total_trades} trades`); loadedFromCache = true; }
        else { sessionStorage.removeItem(BT_CACHE_KEY); }
      }
    } catch { /* no cache */ }
    (async () => {
      try {
        const res = await botBacktestHistory(backtestBotId);
        const entries = res.results || [];
        setHistory(entries);
        if (!loadedFromCache && entries.length > 0) {
          const latest = entries.filter((e: HistoryEntry) => e.strategy === strategy).sort((a: HistoryEntry, b: HistoryEntry) => b.backtest_start_time - a.backtest_start_time)[0];
          if (latest) {
            addLog('INFO', `Auto-loading latest: ${latest.filename}...`);
            try {
              const data = await botBacktestHistoryResult(backtestBotId, latest.filename, latest.strategy);
              if (data) {
                const rawD = (data as Record<string, unknown>).backtest_result ?? data;
                const result = extractResult(rawD as Record<string, unknown>);
                if (result) { setBtResult(result); try { sessionStorage.setItem(BT_CACHE_KEY, JSON.stringify(result)); } catch { /* */ } addLog('INFO', `Loaded: ${result.strategy_name} — ${result.total_trades} trades`); }
              }
            } catch (err) { addLog('WARNING', `Auto-load failed: ${err instanceof Error ? err.message : String(err)}`); }
          }
        }
      } catch { /* history fetch failed */ }
      try {
        const btStatus = await botBacktestResults(backtestBotId);
        const r = btStatus as unknown as Record<string, unknown>;
        if (r.running === true) { addLog('INFO', '🔄 Detected active backtest from previous session — resuming polling...'); setIsRunning(true); setBtProgress('Resuming...'); }
      } catch { /* no active backtest — normal */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll while running ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) { if (pollRef.current) clearInterval(pollRef.current); return; }
    let lastLogCount = -1;
    let notStartedCount = 0;
    const poll = async () => {
      try {
        const logRes = await botLogs(backtestBotId, 50);
        if (logRes?.logs) {
          if (lastLogCount === -1) { lastLogCount = logRes.logs.length; }
          else { const newLogs = logRes.logs.slice(lastLogCount); lastLogCount = logRes.logs.length; for (const entry of newLogs) { addLog(entry[3] || "INFO", entry[4] || entry.join(" ")); } }
        }
      } catch { /* log fetch failed */ }
      try {
        const btRes = await botBacktestResults(backtestBotId);
        if (btRes) {
          const raw = btRes as unknown as Record<string, unknown>;
          const step = (raw.step as string) || ""; const progress = raw.progress as number | undefined;
          const ftRunning = raw.running as boolean | undefined; const ftStatus = (raw.status_msg as string) || "";
          if (ftRunning === false && raw.backtest_result) {
            setBtProgress("✓ Backtest complete"); addLog("INFO", "Extracting results...");
            const result = extractResult(raw.backtest_result as Record<string, unknown>);
            if (result) {
              addLog("INFO", `Result: ${result.strategy_name || "?"} — ${result.total_trades} trades`);
              setBtResult(result); try { sessionStorage.setItem(BT_CACHE_KEY, JSON.stringify(result)); } catch { /* quota */ }
              if (experimentId) {
                createExperimentRun(experimentId, {
                  run_type: "backtest", total_trades: result.total_trades,
                  win_rate: result.winrate != null ? result.winrate * 100 : undefined,
                  profit_pct: result.profit_total != null ? result.profit_total * 100 : undefined,
                  profit_abs: result.profit_total_abs, max_drawdown: result.max_drawdown_account != null ? result.max_drawdown_account * 100 : undefined,
                  sharpe_ratio: result.sharpe, sortino_ratio: result.sortino, calmar_ratio: result.calmar,
                }).catch(() => { /* failed to record */ });
              }
            }
            setIsRunning(false); fetchHistory();
          } else if (step === "error" || ftStatus.toLowerCase().includes("error")) {
            setBtProgress("✗ Error"); addLog("ERROR", ftStatus || "Backtest failed"); setIsRunning(false);
          } else if (raw.status === "not_started" && ftRunning === false) {
            notStartedCount++;
            if (notStartedCount >= 5) { addLog("ERROR", `Backtest stuck at 'not_started'. Check strategy file and data.`); setBtProgress("✗ Failed to start"); setIsRunning(false); }
          } else if (step) {
            notStartedCount = 0;
            const pct = progress != null ? ` (${(progress * 100).toFixed(0)}%)` : "";
            setBtProgress(`${step}${pct}`);
          }
        }
      } catch (pollErr) { addLog("ERROR", `[poll] status error: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`); }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, backtestBotId, strategy, experimentId, addLog, extractResult, fetchHistory, BT_CACHE_KEY]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleStart = async () => {
    setLogs([]); setBtProgress(""); setBtResult(null); setTradesPage(1);
    addLog("INFO", `Starting backtest: ${strategy} — ${timerangeStart} → ${timerangeEnd}`);
    toast.info("Starting backtest...");
    const timerange = `${timerangeStart.replace(/-/g, "")}-${timerangeEnd.replace(/-/g, "")}`;
    const params: Record<string, unknown> = {
      strategy, timerange, max_open_trades: parseInt(maxOpenTrades, 10) || 3,
      stake_amount: stakeAmount === "unlimited" ? "unlimited" : parseFloat(stakeAmount) || "unlimited",
      dry_run_wallet: parseFloat(startingCapital) || 10000, enable_protections: enableProtections, cache,
    };
    if (timeframe !== "1h") params.timeframe = timeframe;
    if (timeframeDetail !== "None") params.timeframe_detail = timeframeDetail;
    if (fee) params.fee = parseFloat(fee) / 100;
    if (breakdownSelected) params.breakdown = breakdownSelected;
    try {
      await botBacktestStart(backtestBotId, params);
      addLog("INFO", "Backtest job submitted — polling for results..."); toast.success("Backtest submitted"); setIsRunning(true);
    } catch (err) { const msg = err instanceof Error ? err.message : String(err); addLog("ERROR", `Failed: ${msg}`); toast.error(`Backtest failed: ${msg}`); }
  };

  const handleStop = async () => {
    try { addLog("WARNING", "Aborting backtest..."); await botBacktestDelete(backtestBotId); addLog("WARNING", "Backtest aborted"); }
    catch { addLog("WARNING", "Stop requested (may have already finished)"); }
    setIsRunning(false); setBtProgress("");
  };

  const handleReset = () => {
    setTimerangeStart("2024-01-01"); setTimerangeEnd("2025-01-01"); setTimeframe("1h"); setTimeframeDetail("None");
    setMaxOpenTrades("3"); setStartingCapital("10000"); setStakeAmount("unlimited"); setFee("");
    setEnableProtections(true); setDryRunWallet(false); setPositionStacking(false); setEnableShorts(false);
    setBreakdownSelected("month"); setCache("day");
  };

  const handleLoadHistory = async (entry: HistoryEntry) => {
    addLog("INFO", `Loading result: ${entry.filename}...`);
    try {
      const res = await botBacktestHistoryResult(backtestBotId, entry.filename, entry.strategy);
      if (res) {
        const raw = res as Record<string, unknown>;
        const backtestData = (raw.backtest_result ?? raw) as Record<string, unknown>;
        if (backtestData.strategy) {
          const result = extractResult(backtestData);
          if (result) { setBtResult(result); try { sessionStorage.setItem(BT_CACHE_KEY, JSON.stringify(result)); } catch { /* */ } addLog("INFO", `Loaded: ${result.strategy_name} — ${result.total_trades} trades`); return; }
        }
      }
      addLog("WARNING", "Could not parse result");
    } catch (err) { addLog("ERROR", `Failed to load: ${err instanceof Error ? err.message : String(err)}`); }
  };

  // ── Computed values from btResult ──────────────────────────────────────
  const r = btResult;
  const profitPositive = r ? r.profit_total_abs >= 0 : true;
  const trades = useMemo(() => r?.trades || [], [r]);
  const sortedTrades = useMemo(() => [...trades].sort((a, b) => b.trade_id - a.trade_id), [trades]);
  const totalTradePages = Math.ceil(sortedTrades.length / tradesPerPage);
  const pagedTrades = sortedTrades.slice((tradesPage - 1) * tradesPerPage, tradesPage * tradesPerPage);

  // Build chart data from periodic_breakdown or trades
  const chartData = useMemo(() => {
    if (r?.periodic_breakdown) {
      const key = Object.keys(r.periodic_breakdown)[0];
      const data = r.periodic_breakdown[key] || [];
      let balance = r.starting_balance;
      return data.map(d => { balance += d.profit_abs; return { month: d.date, profit: Math.round(balance), trades: d.trades }; });
    }
    return [];
  }, [r]);

  // History entries for current strategy
  const filteredHistory = useMemo(() =>
    history.filter(e => e.strategy === strategy).sort((a, b) => b.backtest_start_time - a.backtest_start_time),
  [history, strategy]);

  // Suppress unused vars for flags that are used in UI but not yet in API params
  void dryRunWallet; void positionStacking; void enableShorts; void chartPeriod; void chartMode;

  return (
    <div className="h-full flex flex-row gap-3">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL — Config                                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="w-[400px] flex flex-col gap-0 bg-surface l-bd rounded-md shadow-xl shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">Backtest Configuration</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto">
          {/* 1. Strategy */}
          <div>
            <label className="builder-label">Strategy</label>
            <input
              type="text"
              className="builder-input w-full opacity-70 cursor-default"
              value={strategy}
              readOnly
            />
          </div>

          {/* 2. Timerange */}
          <div>
            <label className="builder-label">Timerange</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="builder-input flex-1"
                value={timerangeStart}
                onChange={(e) => setTimerangeStart(e.target.value)}
              />
              <input
                type="date"
                className="builder-input flex-1"
                value={timerangeEnd}
                onChange={(e) => setTimerangeEnd(e.target.value)}
              />
            </div>
          </div>

          {/* 3. Timeframe / Timeframe Detail */}
          <div>
            <label className="builder-label">Timeframe</label>
            <div className="flex gap-2">
              <select
                className="builder-select flex-1"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                <option>1h</option>
                <option>4h</option>
                <option>15m</option>
                <option>5m</option>
                <option>1d</option>
              </select>
              <select
                className="builder-select flex-1"
                value={timeframeDetail}
                onChange={(e) => setTimeframeDetail(e.target.value)}
              >
                <option>None</option>
                <option>5m</option>
                <option>1m</option>
              </select>
            </div>
          </div>

          {/* 4. Starting Capital / Stake Amount */}
          <div>
            <label className="builder-label">Position</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="builder-input flex-1"
                value={startingCapital}
                onChange={(e) => setStartingCapital(e.target.value)}
              />
              <input
                type="text"
                className="builder-input flex-1"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
            </div>
          </div>

          {/* 5. Max Open Trades / Fee */}
          <div>
            <label className="builder-label">Limits</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="builder-input flex-1"
                value={maxOpenTrades}
                onChange={(e) => setMaxOpenTrades(e.target.value)}
              />
              <input
                type="text"
                className="builder-input flex-1"
                placeholder="exchange default"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
          </div>

          {/* 6. Flags */}
          <div className="l-t pt-3">
            <label className="builder-label">Flags</label>
            <div className="flex flex-col gap-2.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Enable Protections</span>
                <Toggle on={enableProtections} onToggle={() => setEnableProtections(!enableProtections)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Dry Run Wallet</span>
                <Toggle on={dryRunWallet} onToggle={() => setDryRunWallet(!dryRunWallet)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Position Stacking</span>
                <Toggle on={positionStacking} onToggle={() => setPositionStacking(!positionStacking)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Enable Shorts</span>
                <Toggle on={enableShorts} onToggle={() => setEnableShorts(!enableShorts)} />
              </div>
            </div>
          </div>

          {/* 7. Breakdown */}
          <div className="l-t pt-3">
            <label className="builder-label">Breakdown</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {(["day", "week", "month"] as const).map((b) => (
                <Pill
                  key={b}
                  label={b}
                  selected={breakdownSelected === b}
                  onClick={() => setBreakdownSelected(b)}
                />
              ))}
            </div>
          </div>

          {/* 8. Cache */}
          <div className="l-t pt-3">
            <label className="builder-label">Cache</label>
            <select
              className="builder-select w-full"
              value={cache}
              onChange={(e) => setCache(e.target.value)}
            >
              <option>day</option>
              <option>none</option>
              <option>week</option>
              <option>month</option>
            </select>
          </div>

          {/* 9. Strategy Config Preview */}
          <div className="l-t pt-3">
            <label className="builder-label">
              Strategy Config{" "}
              <span className="text-muted text-[8px] normal-case font-normal">
                (read from strategy)
              </span>
            </label>
            <div className="builder-card space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-muted">stoploss</span>
                <span className="text-down font-bold">-0.10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">trailing_stop</span>
                <span className="text-up">true</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">trailing_stop_positive</span>
                <span className="text-white">0.01</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">use_exit_signal</span>
                <span className="text-up">true</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">minimal_roi</span>
                <span className="text-white text-[9px]">
                  {`{"0": 0.05, "30": 0.02, "60": 0.01}`}
                </span>
              </div>
            </div>
          </div>

          {/* 10. Run buttons */}
          <div className="flex gap-1.5 l-t pt-3">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className="flex-1 bg-white text-black hover:bg-white/85 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50"
              title="Start backtesting run"
            >
              {isRunning ? "⏳ Running..." : "▶ Start Backtest"}
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className="px-3 l-bd text-down hover:bg-down/10 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50"
              title="Stop running backtest"
            >
              ⏹ Stop
            </button>
            <button
              onClick={handleReset}
              className="px-3 l-bd text-muted hover:text-white hover:bg-white/5 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors"
              title="Reset configuration to defaults"
            >
              ↺ Reset
            </button>
          </div>

          {/* 11. Progress */}
          <div className="l-t pt-3">
            <div className="flex justify-between text-[11px] font-mono mb-1.5">
              <span className="text-muted">Progress</span>
              <span className="text-white font-bold">
                {btProgress || (r ? `Completed · ${r.total_trades} trades` : 'Ready')}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full">
              <div
                className={`h-full rounded-full transition-all ${isRunning ? 'bg-blue-500 animate-pulse' : 'bg-up'}`}
                style={{ width: isRunning ? '60%' : (r ? '100%' : '0%') }}
              />
            </div>
          </div>

          {/* 12. Terminal Output */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between">
              <label className="builder-label">Terminal Output</label>
              <div className="flex items-center gap-2">
                {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" />}
                {logs.length > 0 && <button onClick={() => { setLogs([]); setBtProgress(''); }} className="text-[9px] text-muted hover:text-white">Clear</button>}
              </div>
            </div>
            <div className="mt-1 bg-black rounded p-3 font-mono text-[10px] text-muted leading-relaxed l-bd max-h-[300px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-muted/50">Logs will appear here when backtest starts...</div>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="flex gap-1.5">
                    <span className="text-muted/60 shrink-0">{entry.ts}</span>
                    <span className={`shrink-0 w-[38px] ${entry.level === 'ERROR' ? 'text-down' : entry.level === 'WARNING' ? 'text-yellow-500' : 'text-muted/60'}`}>{entry.level.substring(0, 4)}</span>
                    <span className="text-muted break-all">{entry.msg}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL — Results                                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">
        {/* 1. Winner Banner */}
        {r ? (
        <div className={`${profitPositive ? 'bg-up/[0.04] border-l-up' : 'bg-down/[0.04] border-l-down'} l-bd rounded-md p-3 shadow-xl border-l-2 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-up/[0.03] rounded-full -translate-y-8 translate-x-8" />
          <div className="flex justify-between items-center mb-2 relative z-10">
            <span className="text-white font-mono text-[12px] font-bold">
              ★ {r.strategy_name} · {r.timeframe} · {r.total_trades} trades
            </span>
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${isRunning ? 'bg-blue-500/12 text-blue-400 border-blue-500/25' : 'bg-up/12 text-up border-up/25'}`}>
                {isRunning ? 'RUNNING' : 'COMPLETED'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-[11px] font-mono relative z-10">
            <div><span className="text-muted block text-[9px]">Profit</span><span className={profitPositive ? 'text-up font-bold' : 'text-down font-bold'}>{fmtPctR(r.profit_total)}</span></div>
            <div><span className="text-muted block text-[9px]">Profit $</span><span className={profitPositive ? 'text-up font-bold' : 'text-down font-bold'}>{fmt$(r.profit_total_abs)}</span></div>
            <div><span className="text-muted block text-[9px]">Trades</span><span className="text-white">{r.total_trades}</span></div>
            <div><span className="text-muted block text-[9px]">Win Rate</span><span className="text-up">{(r.winrate * 100).toFixed(1)}%</span></div>
            <div><span className="text-muted block text-[9px]">Sharpe</span><span className="text-white">{fmtN(r.sharpe)}</span></div>
            <div><span className="text-muted block text-[9px]">Max DD</span><span className="text-down font-bold">-{(r.max_drawdown_account * 100).toFixed(2)}%</span></div>
            <div><span className="text-muted block text-[9px]">Duration</span><span className="text-muted">{r.backtest_days} days</span></div>
          </div>
        </div>
        ) : (
        <div className="bg-surface l-bd rounded-md p-6 flex flex-col items-center justify-center min-h-[80px]">
          <div className="text-[28px] mb-2 opacity-30">📊</div>
          <div className="text-[11px] text-muted">No backtest results yet — configure and start a backtest</div>
        </div>
        )}

        {/* 2. KPI Cards */}
        <div className="grid grid-cols-6 gap-2">
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Total Profit</div>
            <div className={`kpi-value ${profitPositive ? 'text-up' : 'text-down'}`}>{r ? fmt$(r.profit_total_abs) : '—'}</div>
            <div className={`text-[9px] font-mono ${profitPositive ? 'text-up' : 'text-down'}`}>{r ? fmtPctR(r.profit_total) : ''}</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Win Rate</div>
            <div className="kpi-value text-up">{r ? `${(r.winrate * 100).toFixed(1)}%` : '—'}</div>
            <div className="text-[9px] font-mono text-muted">{r ? `${r.wins}W ${r.losses}L` : ''}</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Trades</div>
            <div className="kpi-value">{r ? r.total_trades : '—'}</div>
            <div className="text-[9px] font-mono text-muted">{r ? `${r.trade_count_long}L ${r.trade_count_short}S` : ''}</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Max Drawdown</div>
            <div className="kpi-value text-down">{r ? `-${(r.max_drawdown_account * 100).toFixed(2)}%` : '—'}</div>
            <div className="text-[9px] font-mono text-down">{r ? fmt$(r.max_drawdown_abs) : ''}</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Sharpe Ratio</div>
            <div className="kpi-value">{r ? fmtN(r.sharpe) : '—'}</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Sortino Ratio</div>
            <div className="kpi-value">{r ? fmtN(r.sortino) : '—'}</div>
          </div>
        </div>

        {/* 3. Advanced Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface l-bd rounded p-2.5 space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between"><span className="text-muted">Profit Factor</span><span className={r && r.profit_factor > 1 ? 'text-up' : 'text-down'}>{r ? fmtN(r.profit_factor) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Expectancy</span><span className={r && r.expectancy > 0 ? 'text-up' : 'text-down'}>{r ? fmt$(r.expectancy) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">SQN</span><span className="text-white">{r ? fmtN(r.sqn) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Calmar</span><span className="text-white">{r ? fmtN(r.calmar) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">CAGR</span><span className="text-up">{r ? fmtPctR(r.cagr) : '—'}</span></div>
          </div>
          <div className="bg-surface l-bd rounded p-2.5 space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between"><span className="text-muted">Starting Balance</span><span className="text-white">{r ? `$${r.starting_balance.toLocaleString()}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Final Balance</span><span className={r && r.final_balance > r.starting_balance ? 'text-up font-bold' : 'text-down font-bold'}>{r ? `$${r.final_balance.toLocaleString()}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Best Day</span><span className="text-up">{r ? fmt$(r.backtest_best_day_abs) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Worst Day</span><span className="text-down">{r ? fmt$(r.backtest_worst_day_abs) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted">Avg Duration</span><span className="text-white">{r ? (r.holding_avg || '—') : '—'}</span></div>
          </div>
        </div>

        {/* 4. Profit Over Time Chart */}
        <div className="h-[200px] bg-surface l-bd rounded-md flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 shrink-0 gap-3">
            <span className="section-title text-white/50 whitespace-nowrap">
              Profit Over Time
            </span>
            <div className="flex gap-0 shrink-0">
              {/* Period toggles */}
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase ${
                  chartPeriod === "days"
                    ? "bg-white/10 text-white rounded-l"
                    : "text-muted hover:text-white l-bd border-l-0 transition-colors"
                } ${chartPeriod === "days" ? "" : chartPeriod === "weeks" ? "rounded-l-none" : ""}`}
                onClick={() => setChartPeriod("days")}
              >
                Days
              </button>
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase ${
                  chartPeriod === "weeks"
                    ? "bg-white/10 text-white"
                    : "text-muted hover:text-white l-bd border-l-0 transition-colors"
                }`}
                onClick={() => setChartPeriod("weeks")}
              >
                Weeks
              </button>
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase ${
                  chartPeriod === "months"
                    ? "bg-white/10 text-white rounded-r"
                    : "text-muted hover:text-white l-bd border-l-0 rounded-r transition-colors"
                }`}
                onClick={() => setChartPeriod("months")}
              >
                Months
              </button>

              <div className="w-3" />

              {/* Abs / Rel toggles */}
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-l ${
                  chartMode === "abs"
                    ? "bg-up/15 text-up border border-up/25"
                    : "text-muted l-bd border-l-0 hover:text-white transition-colors"
                }`}
                onClick={() => setChartMode("abs")}
              >
                Abs $
              </button>
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-r ${
                  chartMode === "rel"
                    ? "bg-up/15 text-up border border-up/25"
                    : "text-muted l-bd border-l-0 hover:text-white transition-colors"
                }`}
                onClick={() => setChartMode("rel")}
              >
                Rel %
              </button>
            </div>
          </div>

          {/* Chart body */}
          <div className="flex-1 px-5 pb-4 relative">
            <div className="absolute inset-0 l-grid opacity-20" />
            {/* Legend */}
            <div className="absolute top-0 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10">
              <span className="flex items-center gap-1">
                <span className="w-3 h-[2px] bg-[#22c55e] rounded inline-block" />
                Profit
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2.5 bg-white/15 rounded-sm inline-block" />
                Trade Count
              </span>
            </div>

            {/* Y-axis labels */}
            <div className="absolute left-1 top-0 bottom-4 flex flex-col justify-between text-[9px] font-mono text-white/25">
              <span>14k</span>
              <span>12k</span>
              <span>10k</span>
              <span>8k</span>
            </div>

            {/* Recharts */}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 0, bottom: 0, left: 24 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <RechartsTooltip
                  contentStyle={{
                    background: "#0C0C0C",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  labelStyle={{ color: "#9CA3AF" }}
                  itemStyle={{ color: "#F5F5F5" }}
                />
                <Bar
                  dataKey="trades"
                  fill="rgba(255,255,255,0.15)"
                  radius={[2, 2, 0, 0]}
                  barSize={14}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* X-axis labels */}
            <div className="flex justify-between text-[9px] font-mono text-white/25 mt-1">
              {chartData.map((d) => (
                <span key={d.month}>{d.month}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Master Table */}
        <div className="flex-1 bg-surface l-bd rounded-md flex flex-col min-h-[250px] overflow-hidden">
          {/* Tab bar */}
          <div className="h-10 l-b flex items-center bg-black/40 shrink-0 border-b-2 border-transparent overflow-x-auto whitespace-nowrap">
            {(
              [
                { key: "closed", label: "Closed Trades" },
                { key: "per-pair", label: "Per-Pair" },
                { key: "entry-tags", label: "Entry Tags" },
                { key: "exit-reasons", label: "Exit Reasons" },
                { key: "history", label: "History" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                className={`h-full px-4 font-bold text-[11px] uppercase tracking-wide bt-tab-btn shrink-0 ${
                  btSubTab === tab.key
                    ? "border-b-2 border-up text-white"
                    : "text-muted hover:text-white transition-colors"
                }`}
                onClick={() => setBtSubTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Closed Trades ── */}
          {btSubTab === "closed" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-left">Date</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Pair</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-center">Side</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Entry</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Exit</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Profit%</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Value</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Fee</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-left">Duration</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {pagedTrades.length === 0 ? (
                    <tr><td colSpan={10} className="px-2 py-8 text-center text-muted text-[11px]">No trades to display</td></tr>
                  ) : pagedTrades.map((t) => (
                    <tr
                      key={t.trade_id}
                      className={`hover:bg-white/[0.04] ${t.close_profit >= 0 ? "bg-up/[0.02]" : ""}`}
                    >
                      <td className="px-2 py-1.5">
                        {t.close_profit >= 0 && "★ "}
                        {t.close_date?.slice(0, 16) || '—'}
                      </td>
                      <td className="px-2 py-1.5">{t.pair}</td>
                      <td className="px-2 py-1.5 text-center">
                        {!t.is_short ? (
                          <span className="bg-up/12 text-up px-1 py-0.5 rounded text-[9px] font-bold">
                            LONG
                          </span>
                        ) : (
                          <span className="bg-down/12 text-down px-1 py-0.5 rounded text-[9px] font-bold">
                            SHORT
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {t.open_rate.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {t.close_rate.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${t.close_profit >= 0 ? "text-up" : "text-down"}`}>
                        {fmtPctR(t.close_profit)}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${t.close_profit_abs >= 0 ? "text-up" : "text-down"}`}>
                        {fmt$(t.close_profit_abs)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">
                        ${(t.fee_open + t.fee_close).toFixed(4)}
                      </td>
                      <td className="px-2 py-1.5">{fmtDuration(t.trade_duration)}</td>
                      <td className="px-2 py-1.5 text-muted">{t.exit_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalTradePages > 1 && (
                <div className="flex items-center justify-between px-3 py-1.5 l-t">
                  <span className="text-[10px] text-muted font-mono">Page {tradesPage}/{totalTradePages} ({sortedTrades.length} trades)</span>
                  <div className="flex gap-1">
                    <button disabled={tradesPage <= 1} onClick={() => setTradesPage(p => p - 1)} className="px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white disabled:opacity-30">← Prev</button>
                    <button disabled={tradesPage >= totalTradePages} onClick={() => setTradesPage(p => p + 1)} className="px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white disabled:opacity-30">Next →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Per-Pair ── */}
          {btSubTab === "per-pair" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Pair</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Trades</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-right">profit_abs</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">profit_ratio</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Win Rate</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg Profit</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg Dur.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(r?.results_per_pair || []).map((p, i) => (
                    <tr key={i} className="hover:bg-white/[0.04]">
                      <td className="px-2 py-1.5">{p.key}</td>
                      <td className="px-2 py-1.5 text-right">{p.trades}</td>
                      <td className={`px-2 py-1.5 text-right font-bold ${p.profit_total_abs >= 0 ? "text-up" : "text-down"}`}>
                        {fmt$(p.profit_total_abs)}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${p.profit_total >= 0 ? "text-up" : "text-down"}`}>
                        {fmtPctR(p.profit_total)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">—</td>
                      <td className={`px-2 py-1.5 text-right ${p.profit_mean >= 0 ? "text-up" : "text-down"}`}>
                        {fmtPctR(p.profit_mean)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">—</td>
                    </tr>
                  ))}
                  {(!r?.results_per_pair || r.results_per_pair.length === 0) && (
                    <tr><td colSpan={7} className="px-2 py-8 text-center text-muted text-[11px]">No per-pair data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Entry Tags ── */}
          {btSubTab === "entry-tags" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Tag</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Trades</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg P&L</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-right">Total P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(() => {
                    const tagMap = new Map<string, { count: number; totalProfit: number; totalProfitAbs: number }>();
                    for (const t of trades) {
                      const tag = t.enter_tag || '(none)';
                      const existing = tagMap.get(tag) || { count: 0, totalProfit: 0, totalProfitAbs: 0 };
                      existing.count++; existing.totalProfit += t.close_profit; existing.totalProfitAbs += t.close_profit_abs;
                      tagMap.set(tag, existing);
                    }
                    const entries = Array.from(tagMap.entries()).sort((a, b) => b[1].totalProfitAbs - a[1].totalProfitAbs);
                    if (entries.length === 0) return <tr><td colSpan={4} className="px-2 py-8 text-center text-muted text-[11px]">No entry tag data</td></tr>;
                    return entries.map(([tag, data]) => (
                      <tr key={tag} className="hover:bg-white/[0.04]">
                        <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 bg-blue-500/12 text-blue-400 rounded text-[9px]">{tag}</span></td>
                        <td className="px-2 py-1.5 text-right">{data.count}</td>
                        <td className={`px-2 py-1.5 text-right ${data.totalProfit / data.count >= 0 ? 'text-up' : 'text-down'}`}>{fmtPctR(data.totalProfit / data.count)}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${data.totalProfitAbs >= 0 ? 'text-up' : 'text-down'}`}>{fmt$(data.totalProfitAbs)}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {btSubTab === "exit-reasons" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Reason</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Trades</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Wins</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Losses</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg P&L</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-right">Total P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {(r?.exit_reason_summary || []).map((er, i) => (
                    <tr key={i} className="hover:bg-white/[0.04]">
                      <td className="px-2 py-1.5 text-white">{er.exit_reason}</td>
                      <td className="px-2 py-1.5 text-right">{er.trades}</td>
                      <td className="px-2 py-1.5 text-right text-up">{er.wins}</td>
                      <td className={`px-2 py-1.5 text-right ${er.losses > 0 ? "text-down" : "text-muted"}`}>{er.losses}</td>
                      <td className={`px-2 py-1.5 text-right ${er.profit_mean >= 0 ? "text-up" : "text-down"}`}>{fmtPctR(er.profit_mean)}</td>
                      <td className={`px-2 py-1.5 text-right font-bold ${er.profit_total_abs >= 0 ? "text-up" : "text-down"}`}>{fmt$(er.profit_total_abs)}</td>
                    </tr>
                  ))}
                  {(!r?.exit_reason_summary || r.exit_reason_summary.length === 0) && (
                    <tr><td colSpan={6} className="px-2 py-8 text-center text-muted text-[11px]">No exit reason data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── History ── */}
          {btSubTab === "history" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable font-semibold px-2 py-1.5 text-left">#</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-left">Run Date</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">TF</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-left">Strategy</th>
                    <th className="font-semibold px-2 py-1.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={5} className="px-2 py-8 text-center text-muted text-[11px]">No backtest history</td></tr>
                  ) : filteredHistory.map((h, i) => (
                    <tr key={h.filename} className={`hover:bg-white/[0.04] ${i === 0 ? "bg-up/[0.02]" : ""}`}>
                      <td className={`px-2 py-1.5 ${i === 0 ? "text-up font-bold" : "text-muted"}`}>
                        {i === 0 && "★ "}{i + 1}
                      </td>
                      <td className="px-2 py-1.5 text-muted">
                        {new Date(h.backtest_start_time * 1000).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5">{h.timeframe || '—'}</td>
                      <td className="px-2 py-1.5 text-muted">{h.strategy}</td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleLoadHistory(h)} className="px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white hover:bg-white/5 transition-colors">
                            Load
                          </button>
                          <button onClick={() => handleDeleteHistory(h)} className="px-2 py-0.5 l-bd rounded text-[9px] text-down/60 hover:text-down hover:bg-down/10 transition-colors">
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}
