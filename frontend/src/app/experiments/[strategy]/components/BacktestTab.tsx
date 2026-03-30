"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Tooltip from "@/components/ui/Tooltip";
import { botLogs, botBacktestResults, botBacktestStart, botBacktestDelete, botBacktestHistory } from "@/lib/api";

interface BacktestTabProps {
  strategy: string;
  backtestBotId?: number;
}

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

// ── FT result types (exact FT field names from §5/§8) ───────────────────
interface FTStrategyResult {
  strategy_name: string;
  total_trades: number;
  trade_count_long: number;
  trade_count_short: number;
  profit_total: number;
  profit_total_abs: number;
  profit_mean: number;
  profit_median: number;
  profit_factor: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  expectancy: number;
  expectancy_ratio: number;
  max_drawdown_account: number;
  max_drawdown_abs: number;
  starting_balance: number;
  final_balance: number;
  stake_currency: string;
  backtest_start: string;
  backtest_end: string;
  backtest_days: number;
  timeframe: string;
  timeframe_detail: string | null;
  stoploss: number;
  max_open_trades_setting: number;
  trading_mode: string;
  holding_avg: string;
  backtest_best_day: number;
  backtest_worst_day: number;
  backtest_best_day_abs: number;
  backtest_worst_day_abs: number;
  winning_days: number;
  losing_days: number;
  draw_days: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  cagr: number;
  sqn: number;
  results_per_pair: Array<{ key: string; trades: number; profit_mean: number; profit_total: number; profit_total_abs: number }>;
  exit_reason_summary: Array<{ exit_reason: string; trades: number; profit_mean: number; profit_total: number; profit_total_abs: number; wins: number; losses: number }>;
  periodic_breakdown?: Record<string, Array<{ date: string; trades: number; profit_abs: number }>>;
}

interface HistoryEntry {
  filename: string;
  strategy: string;
  run_id: string;
  backtest_start_time: number;
  timeframe?: string;
  timeframe_detail?: string | null;
  backtest_start_ts?: number;
  backtest_end_ts?: number;
}

// ── Toggle switch ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <label className="relative w-[36px] h-[20px] cursor-pointer inline-block flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`absolute inset-0 rounded-[10px] border transition-all ${checked ? "bg-[rgba(34,197,94,0.08)] border-emerald-500" : "bg-muted border-border"}`} />
        <span className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
      </label>
    </div>
  );
}

// ── Design System ───────────────────────────────────────────────────
const INPUT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground placeholder-text-3 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

// ── Helpers ──────────────────────────────────────────────────────────
function fmt$(v: number, decimals = 2): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${v.toFixed(decimals)}`;
}
function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}
function fmtNum(v: number, d = 2): string { return v.toFixed(d); }
function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Metric Card ─────────────────────────────────────────────────────
function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const valColor = positive === true ? "text-emerald-400" : positive === false ? "text-rose-400" : "text-foreground";
  return (
    <div className="bg-muted/50 border border-border rounded-lg p-2.5">
      <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${valColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// RESULTS PANEL
// ══════════════════════════════════════════════════════════════════════════
function ResultsPanel({ data }: { data: FTStrategyResult }) {
  const profitPositive = data.profit_total_abs >= 0;
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{data.strategy_name}</div>
          <div className="text-[10px] text-muted-foreground">
            {data.backtest_start} → {data.backtest_end} · {data.timeframe}{data.timeframe_detail ? ` (detail: ${data.timeframe_detail})` : ""} · {data.backtest_days} days
          </div>
        </div>
        <div className={`text-lg font-bold tabular-nums ${profitPositive ? "text-emerald-400" : "text-rose-400"}`}>
          {fmt$(data.profit_total_abs)}
        </div>
      </div>

      {/* Row 1: Core Metrics */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard
          label="Total Profit"
          value={fmt$(data.profit_total_abs)}
          sub={fmtPct(data.profit_total)}
          positive={profitPositive}
        />
        <MetricCard
          label="Trades"
          value={String(data.total_trades)}
          sub={`${data.trade_count_long}L / ${data.trade_count_short}S`}
        />
        <MetricCard
          label="Win Rate"
          value={`${(data.winrate * 100).toFixed(1)}%`}
          sub={`${data.wins}W ${data.losses}L ${data.draws}D`}
          positive={data.winrate > 0.5 ? true : data.winrate < 0.4 ? false : null}
        />
        <MetricCard
          label="Max Drawdown"
          value={fmt$(data.max_drawdown_abs)}
          sub={fmtPct(-data.max_drawdown_account)}
          positive={false}
        />
      </div>

      {/* Row 2: Risk/Return Ratios */}
      <div className="grid grid-cols-5 gap-2">
        <MetricCard label="Sharpe" value={fmtNum(data.sharpe)} positive={data.sharpe > 1 ? true : data.sharpe < 0 ? false : null} />
        <MetricCard label="Sortino" value={fmtNum(data.sortino)} positive={data.sortino > 1 ? true : data.sortino < 0 ? false : null} />
        <MetricCard label="Calmar" value={fmtNum(data.calmar)} positive={data.calmar > 1 ? true : data.calmar < 0 ? false : null} />
        <MetricCard label="Profit Factor" value={fmtNum(data.profit_factor)} positive={data.profit_factor > 1 ? true : data.profit_factor < 1 ? false : null} />
        <MetricCard label="SQN" value={fmtNum(data.sqn)} positive={data.sqn > 2 ? true : data.sqn < 0 ? false : null} />
      </div>

      {/* Row 3: Balance + Extra Stats */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Starting" value={`$${data.starting_balance.toLocaleString()}`} />
        <MetricCard label="Final" value={`$${data.final_balance.toLocaleString()}`} positive={data.final_balance > data.starting_balance} />
        <MetricCard label="Best Day" value={fmt$(data.backtest_best_day_abs)} sub={fmtPct(data.backtest_best_day)} positive={true} />
        <MetricCard label="Worst Day" value={fmt$(data.backtest_worst_day_abs)} sub={fmtPct(data.backtest_worst_day)} positive={false} />
      </div>

      {/* Row 4: Extra */}
      <div className="grid grid-cols-5 gap-2">
        <MetricCard label="CAGR" value={fmtPct(data.cagr)} positive={data.cagr > 0} />
        <MetricCard label="Expectancy" value={fmt$(data.expectancy)} positive={data.expectancy > 0} />
        <MetricCard label="Avg Duration" value={data.holding_avg || "-"} />
        <MetricCard label="Consec. Wins" value={String(data.max_consecutive_wins)} />
        <MetricCard label="Consec. Losses" value={String(data.max_consecutive_losses)} />
      </div>

      {/* ── Results per Pair ── */}
      {data.results_per_pair && data.results_per_pair.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Results per Pair</div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-semibold">Pair</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Trades</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Avg Profit</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Total Profit</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {data.results_per_pair.map((pair) => (
                  <tr key={pair.key} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono text-foreground">{pair.key}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pair.trades}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${pair.profit_mean >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtPct(pair.profit_mean)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${pair.profit_total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtPct(pair.profit_total)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${pair.profit_total_abs >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmt$(pair.profit_total_abs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Exit Reason Summary ── */}
      {data.exit_reason_summary && data.exit_reason_summary.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exit Reasons</div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-semibold">Reason</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Trades</th>
                  <th className="text-right px-3 py-1.5 font-semibold">W/L</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {data.exit_reason_summary.map((r) => (
                  <tr key={r.exit_reason} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono text-foreground">{r.exit_reason}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.trades}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.wins}W / {r.losses}L</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${r.profit_total_abs >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmt$(r.profit_total_abs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORY PANEL
// ══════════════════════════════════════════════════════════════════════════
function HistoryPanel({ entries, currentStrategy, onLoad }: { entries: HistoryEntry[]; currentStrategy: string; onLoad: (entry: HistoryEntry) => void }) {
  // Filter to current strategy, most recent first
  const filtered = entries
    .filter((e) => e.strategy === currentStrategy)
    .sort((a, b) => b.backtest_start_time - a.backtest_start_time);

  if (filtered.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Backtest History ({filtered.length})
      </div>
      <div className="flex flex-col gap-1">
        {filtered.map((entry) => {
          const startTs = entry.backtest_start_ts ? new Date(entry.backtest_start_ts * 1000).toISOString().split("T")[0] : "?";
          const endTs = entry.backtest_end_ts ? new Date(entry.backtest_end_ts * 1000).toISOString().split("T")[0] : "?";
          return (
            <button
              key={`${entry.filename}-${entry.run_id}`}
              onClick={() => onLoad(entry)}
              className="flex items-center gap-3 px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs hover:bg-muted/60 hover:border-primary/30 transition-all text-left group"
            >
              <span className="text-muted-foreground shrink-0">{fmtDate(entry.backtest_start_time)}</span>
              <span className="font-mono text-muted-foreground">{entry.timeframe || "?"}</span>
              <span className="text-muted-foreground truncate flex-1">{startTs} → {endTs}</span>
              <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Load →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function BacktestTab({ strategy, backtestBotId = 2 }: BacktestTabProps) {
  const [testName, setTestName] = useState(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [timeframeOverride, setTimeframeOverride] = useState("Use strategy default");
  const [timeframeDetail, setTimeframeDetail] = useState("Same as timeframe");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [startingCapital, setStartingCapital] = useState("10000");
  const [stakeAmount, setStakeAmount] = useState("100");
  const [feeOverride, setFeeOverride] = useState("");
  const [enableProtections, setEnableProtections] = useState(false);
  const [cacheResults, setCacheResults] = useState(true);
  const [enableFreqAI, setEnableFreqAI] = useState(false);
  const [exportType, setExportType] = useState("none");
  const [breakdownDay, setBreakdownDay] = useState(false);
  const [breakdownWeek, setBreakdownWeek] = useState(false);
  const [breakdownMonth, setBreakdownMonth] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  // ── Log window state ──────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [btProgress, setBtProgress] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Results + History state ────────────────────────────────────────
  const [btResult, setBtResult] = useState<FTStrategyResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const addLog = useCallback((level: string, msg: string) => {
    setLogs((prev) => {
      const next = [...prev, { ts: new Date().toLocaleTimeString(), level, msg }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  // Auto-scroll log window
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Fetch history on mount and after backtest completes
  const fetchHistory = useCallback(async () => {
    try {
      const res = await botBacktestHistory(backtestBotId);
      setHistory(res.results || []);
    } catch {
      // History fetch failed — not critical
    }
  }, [backtestBotId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Extract strategy result from FT's nested response
  const extractResult = useCallback((backtestResult: Record<string, unknown>): FTStrategyResult | null => {
    const strategyMap = backtestResult.strategy as Record<string, FTStrategyResult> | undefined;
    if (!strategyMap) return null;
    // Get first strategy result (there's usually only one)
    const firstKey = Object.keys(strategyMap)[0];
    return firstKey ? strategyMap[firstKey] : null;
  }, []);

  // Poll FT logs + backtest status while running
  useEffect(() => {
    if (!isRunning) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    let lastLogCount = -1; // -1 = skip initial batch (startup logs)
    const poll = async () => {
      try {
        const logRes = await botLogs(backtestBotId, 50);
        if (logRes && logRes.logs) {
          if (lastLogCount === -1) {
            lastLogCount = logRes.logs.length;
          } else {
            const newLogs = logRes.logs.slice(lastLogCount);
            lastLogCount = logRes.logs.length;
            for (const entry of newLogs) {
              const level = entry[3] || "INFO";
              const msg = entry[4] || entry.join(" ");
              addLog(level, msg);
            }
          }
        }
      } catch {
        // Log fetch failed
      }
      try {
        const btRes = await botBacktestResults(backtestBotId);
        if (btRes) {
          const raw = btRes as unknown as Record<string, unknown>;
          const step = (raw.step as string) || "";
          const progress = raw.progress as number | undefined;
          const ftRunning = raw.running as boolean | undefined;
          const ftStatus = (raw.status_msg as string) || "";

          addLog("INFO", `[poll] status=${raw.status} running=${ftRunning} step="${step}" hasResult=${!!raw.backtest_result}`);

          if (ftRunning === false && raw.backtest_result) {
            setBtProgress("\u2713 Backtest complete");
            addLog("INFO", "Extracting results...");
            const result = extractResult(raw.backtest_result as Record<string, unknown>);
            if (result) {
              addLog("INFO", `Result: ${result.strategy_name || "?"} \u2014 ${result.total_trades} trades`);
              setBtResult(result);
            } else {
              addLog("WARNING", `extractResult null. backtest_result keys: ${JSON.stringify(Object.keys(raw.backtest_result as object))}`);
            }
            setIsRunning(false);
            fetchHistory();
          } else if (step === "error" || ftStatus.toLowerCase().includes("error")) {
            setBtProgress("\u2717 Error");
            addLog("ERROR", ftStatus || "Backtest failed");
            setIsRunning(false);
          } else if (step) {
            const pct = progress != null ? ` (${(progress * 100).toFixed(0)}%)` : "";
            setBtProgress(`${step}${pct}`);
          }
        } else {
          addLog("WARNING", "[poll] botBacktestResults returned falsy");
        }
      } catch (pollErr) {
        addLog("ERROR", `[poll] status error: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, backtestBotId, addLog, extractResult, fetchHistory]);

  // Auto-generate description from current settings
  const autoDescription = useMemo(() => {
    const tf = timeframeOverride === "Use strategy default" ? "default TF" : timeframeOverride;
    const parts = [
      `${strategy} backtest`,
      `${startDate} → ${endDate}`,
      tf,
      `${maxOpenTrades} max trades`,
      `$${startingCapital} capital`,
      enableFreqAI ? "FreqAI ON" : null,
      enableProtections ? "Protections ON" : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }, [strategy, startDate, endDate, timeframeOverride, maxOpenTrades, startingCapital, enableFreqAI, enableProtections]);

  const handleStart = async () => {
    setLogs([]);
    setBtProgress("");
    setBtResult(null);
    addLog("INFO", `Starting backtest: ${strategy} — ${startDate} → ${endDate}`);

    const timerange = `${startDate.replace(/-/g, "")}-${endDate.replace(/-/g, "")}`;
    const params: Record<string, unknown> = {
      strategy,
      timerange,
      max_open_trades: parseInt(maxOpenTrades, 10) || 3,
      stake_amount: stakeAmount,
      dry_run_wallet: parseFloat(startingCapital) || 10000,
      enable_protections: enableProtections,
      cache: cacheResults ? "day" : "none",
      export: exportType,
    };

    if (timeframeOverride !== "Use strategy default") params.timeframe = timeframeOverride;
    if (timeframeDetail !== "Same as timeframe") params.timeframe_detail = timeframeDetail;
    if (feeOverride) params.fee = parseFloat(feeOverride) / 100;
    if (enableFreqAI) params.freqaimodel = "LightGBMRegressor";

    const breakdowns: string[] = [];
    if (breakdownDay) breakdowns.push("day");
    if (breakdownWeek) breakdowns.push("week");
    if (breakdownMonth) breakdowns.push("month");
    if (breakdowns.length > 0) params.breakdown = breakdowns.join(" ");

    try {
      addLog("INFO", `POST /api/bots/${backtestBotId}/backtest — timerange=${timerange}`);
      await botBacktestStart(backtestBotId, params);
      addLog("INFO", "Backtest job submitted — polling for results...");
      setIsRunning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Failed to start backtest: ${msg}`);
    }
  };

  const handleStop = async () => {
    try {
      addLog("WARNING", "Aborting backtest...");
      await botBacktestDelete(backtestBotId);
      addLog("WARNING", "Backtest aborted by user");
    } catch {
      addLog("WARNING", "Backtest stop requested (may have already finished)");
    }
    setIsRunning(false);
    setBtProgress("");
  };

  const handleReset = () => {
    setTestName(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
    setStartDate("2024-01-01");
    setEndDate("2025-01-01");
    setTimeframeOverride("Use strategy default");
    setTimeframeDetail("Same as timeframe");
    setMaxOpenTrades("3");
    setStartingCapital("10000");
    setStakeAmount("100");
    setFeeOverride("");
    setEnableProtections(false);
    setCacheResults(true);
    setEnableFreqAI(false);
    setExportType("none");
    setBreakdownDay(false);
    setBreakdownWeek(false);
    setBreakdownMonth(true);
  };

  // Load a past result from history
  const handleLoadHistory = async (entry: HistoryEntry) => {
    addLog("INFO", `Loading result: ${entry.filename}...`);
    try {
      // FT's GET /api/v1/backtest returns the last run result.
      // To load a specific history entry, we use the history result endpoint.
      const res = await botBacktestResults(backtestBotId);
      if (res) {
        const raw = res as unknown as Record<string, unknown>;
        if (raw.backtest_result) {
          const result = extractResult(raw.backtest_result as Record<string, unknown>);
          if (result) {
            setBtResult(result);
            addLog("INFO", `Loaded: ${result.strategy_name} — ${result.total_trades} trades`);
            return;
          }
        }
      }
      addLog("WARNING", "Could not load result — run a new backtest to see results");
    } catch {
      addLog("ERROR", "Failed to load history result");
    }
  };

  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-0 max-w-full">

      {/* ═══════════ LEFT PANEL: FORM ═══════════ */}
      <div className="bg-card border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col gap-[10px]">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">⚙️ Test Configuration</div>

        <div>
          <label className={LABEL}>Test Name</label>
          <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className={INPUT} />
        </div>

        <div>
          <label className={LABEL}>Description</label>
          <div className="w-full px-3 py-[7px] bg-muted/50 border border-border rounded-btn text-xs text-muted-foreground leading-[1.5]">
            {autoDescription}
          </div>
          <div className="text-[9px] text-muted-foreground mt-[2px]">Auto-generated from settings</div>
        </div>

        <div>
          <label className={LABEL}>Strategy</label>
          <input type="text" value={strategy} readOnly className={`${INPUT} bg-muted/50 opacity-70 cursor-default`} />
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Timeframe Override</label>
            <select value={timeframeOverride} onChange={(e) => setTimeframeOverride(e.target.value)} className={SELECT}>
              <option>Use strategy default</option>
              <option>1m</option><option>5m</option><option>15m</option><option>30m</option>
              <option>1h</option><option>4h</option><option>1d</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Timeframe Detail</label>
            <select value={timeframeDetail} onChange={(e) => setTimeframeDetail(e.target.value)} className={SELECT}>
              <option>Same as timeframe</option>
              <option>1m</option><option>5m</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Max Open Trades</label>
            <input type="number" value={maxOpenTrades} onChange={(e) => setMaxOpenTrades(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Starting Capital ($)</label>
            <input type="number" value={startingCapital} onChange={(e) => setStartingCapital(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Stake Amount ($)</label>
            <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Fee Override (%)</label>
            <input type="number" step="0.01" value={feeOverride} onChange={(e) => setFeeOverride(e.target.value)} placeholder="Exchange default" className={INPUT} />
          </div>
        </div>

        <div className="flex flex-col gap-[8px] mt-1">
          <Tooltip content="Enable FT Protections — FT: --enable-protections">
            <div><Toggle checked={enableProtections} onChange={setEnableProtections} label="Enable Protections" /></div>
          </Tooltip>
          <Tooltip content="Cache results to avoid re-computing — FT: --cache">
            <div><Toggle checked={cacheResults} onChange={setCacheResults} label="Cache Results" /></div>
          </Tooltip>
          <Tooltip content="Use FreqAI model predictions in backtest — FT: --freqaimodel">
            <div><Toggle checked={enableFreqAI} onChange={setEnableFreqAI} label="Enable FreqAI" /></div>
          </Tooltip>
        </div>

        <div>
          <label className={LABEL}>Export</label>
          <div className="flex gap-[6px]">
            {["none", "trades", "signals"].map((val) => (
              <label key={val} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-xs cursor-pointer border transition-all select-none ${exportType === val ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-[#2e2e48]"}`}>
                <input type="radio" name="export" value={val} checked={exportType === val} onChange={(e) => setExportType(e.target.value)} className="hidden" />
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL}>Breakdown</label>
          <div className="flex gap-[6px]">
            {([
              { label: "Day", checked: breakdownDay, set: setBreakdownDay },
              { label: "Week", checked: breakdownWeek, set: setBreakdownWeek },
              { label: "Month", checked: breakdownMonth, set: setBreakdownMonth },
            ] as const).map((item) => (
              <span key={item.label} onClick={() => item.set(!item.checked)} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-xs cursor-pointer border transition-all select-none ${item.checked ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-[#2e2e48]"}`}>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-[6px] mt-1">
          <button onClick={handleStart} disabled={isRunning} className="flex-1 h-[32px] rounded-btn text-xs font-semibold border bg-primary border-primary text-white hover:bg-[#5558e6] transition-all disabled:opacity-50">
            {isRunning ? "⏳ Running..." : "▶ Start Backtest"}
          </button>
          <button onClick={handleStop} disabled={!isRunning} className="h-[32px] px-3 rounded-btn text-xs font-semibold border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)] text-rose-500 hover:bg-[rgba(239,68,68,0.15)] transition-all disabled:opacity-50">
            ⏹ Stop
          </button>
          <button onClick={handleReset} className="h-[32px] px-3 rounded-btn text-xs font-semibold border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-all">
            ↻
          </button>
        </div>

        {/* ═══════════ LOG WINDOW ═══════════ */}
        <div className="flex flex-col mt-1 flex-1 min-h-[120px]">
          <div className="flex items-center justify-between mb-[4px]">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px]">Log</span>
            <div className="flex items-center gap-2">
              {btProgress && (
                <span className="text-xs text-primary font-medium">{btProgress}</span>
              )}
              {isRunning && (
                <span className="w-[6px] h-[6px] rounded-full bg-green animate-pulse" />
              )}
              {logs.length > 0 && (
                <button
                  onClick={() => { setLogs([]); setBtProgress(""); }}
                  className="text-[9px] text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 bg-[#0d0d14] border border-border rounded-btn p-2 overflow-y-auto font-mono text-xs leading-[1.6] min-h-[100px] max-h-[220px]">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-xs opacity-50 select-none">
                Logs will appear here when backtest starts...
              </div>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="flex gap-[6px]">
                  <span className="text-muted-foreground shrink-0">{entry.ts}</span>
                  <span className={`shrink-0 w-[38px] ${
                    entry.level === "ERROR" ? "text-rose-500" :
                    entry.level === "WARNING" ? "text-[#f59e0b]" :
                    "text-muted-foreground"
                  }`}>{entry.level.substring(0, 4)}</span>
                  <span className="text-muted-foreground break-all">{entry.msg}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL: RESULTS ═══════════ */}
      <div className="bg-card border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col gap-4 min-h-[400px]">
        {btResult ? (
          <>
            <ResultsPanel data={btResult} />
            <HistoryPanel entries={history} currentStrategy={strategy} onLoad={handleLoadHistory} />
          </>
        ) : (
          <>
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center flex-1 min-h-[200px]">
              <div className="text-[32px] mb-3 opacity-30">📊</div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">No backtest results yet</div>
              <div className="text-xs text-muted-foreground text-center max-w-[280px]">
                Configure your test parameters and click &quot;Start Backtest&quot; to run a real FreqTrade backtest on the server.
              </div>
            </div>
            {/* Still show history even without current result */}
            <HistoryPanel entries={history} currentStrategy={strategy} onLoad={handleLoadHistory} />
          </>
        )}
      </div>
    </div>
  );
}
