"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  botHyperoptStart,
  botHyperoptStatus,
  botHyperoptList,
  botHyperoptShow,
  botHyperoptRuns,
  botHyperoptHistoryResults,
  botHyperoptHistoryDelete,
  createExperimentRun,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ── Local Toggle ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[#9CA3AF]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`builder-toggle ${checked ? "on" : ""}`}
      >
        <span className="dot" />
      </button>
    </div>
  );
}

// ── Local Pill ──────────────────────────────────────────────────────────
function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`builder-pill text-[10px] px-2.5 py-1.5 text-center ${selected ? "selected" : ""}`}
    >
      {label}
    </button>
  );
}

// ── Types ───────────────────────────────────────────────────────────────

interface EpochRow {
  epoch: number;
  trades: number;
  avgProfit: number;
  totalProfit: number;
  profitAbs: number;
  avgDur: string;
  winPct: number;
  maxDD: number;
  objective: number;
  isBest: boolean;
  isPrevBest?: boolean;
  params?: Record<string, unknown>;
}

interface HistoryRun {
  filename: string;
  strategy: string;
  created_at: string;
  mtime: number;
  size_bytes: number;
  epochs: number;
  // enriched from loaded results:
  bestEpoch?: number;
  profit?: string;
  trades?: number;
  objective?: number;
  lossFn?: string;
}

interface ConvergencePoint {
  epoch: number;
  bestObjective: number;
  trades: number;
}

interface LogEntry { ts: string; level: string; msg: string; }

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
interface HyperoptTabProps {
  strategy?: string;
  botId?: number;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

export default function HyperoptTab({ strategy: propStrategy, botId = 2, experimentId, onNavigateToTab }: HyperoptTabProps) {
  const toast = useToast();

  // ── Left panel form state ─────────────────────────────────────────────
  const [strategy] = useState(propStrategy || "");
  const [lossFn, setLossFn] = useState("Sharpe");
  const [sampler, setSampler] = useState("TPE");
  const [epochs, setEpochs] = useState("200");
  const [minTrades, setMinTrades] = useState("80");
  const [startDate, setStartDate] = useState("2022-01-01");
  const [endDate, setEndDate] = useState("2024-01-01");
  const [timeframe, setTimeframe] = useState("1h");
  const [jobs, setJobs] = useState("-1");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [stakeAmount, setStakeAmount] = useState("unlimited");
  const [fee, setFee] = useState("");
  const [randomState, setRandomState] = useState("42");
  const [earlyStop, setEarlyStop] = useState("50");
  const [pairs, setPairs] = useState("");

  // Spaces
  const [spaces, setSpaces] = useState<Record<string, boolean>>({
    buy: true, sell: true, roi: false, stoploss: false, trailing: false, protection: false,
  });
  const toggleSpace = (s: string) => setSpaces((p) => ({ ...p, [s]: !p[s] }));

  // Flags
  const [enableProtections, setEnableProtections] = useState(true);
  const [positionStacking, setPositionStacking] = useState(false);
  const [disableMaxPositions, setDisableMaxPositions] = useState(false);
  const [printAllResults, setPrintAllResults] = useState(false);

  // ── Right panel state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);
  const [chartXMode, setChartXMode] = useState<"epochs" | "time">("epochs");
  const [chartYMode, setChartYMode] = useState<"loss" | "profit">("loss");

  // ── API / Job state ───────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState("");
  const [epochResults, setEpochResults] = useState<EpochRow[]>([]);
  const [bestEpoch, setBestEpoch] = useState<EpochRow | null>(null);
  const [bestParams, setBestParams] = useState<Record<string, unknown> | null>(null);
  const [convergenceData, setConvergenceData] = useState<ConvergencePoint[]>([]);
  const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const HO_CACHE_KEY = `ho-result-${strategy}`;

  // ── Helpers ───────────────────────────────────────────────────────────
  const addLog = useCallback((level: string, msg: string) => {
    setLogs((prev) => {
      const next = [...prev, { ts: new Date().toLocaleTimeString(), level, msg }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ── Fetch history runs ────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const res = await botHyperoptRuns(botId);
      setHistoryRuns(res.runs || []);
    } catch { /* not critical */ }
  }, [botId]);

  // ── Fetch epoch results for current/loaded run ────────────────────────
  const fetchEpochs = useCallback(async () => {
    try {
      const res = await botHyperoptList(botId, { profitable: false });
      const results = res.results || [];
      if (results.length > 0) {
        const mapped: EpochRow[] = results.map((r) => {
          const a = r as Record<string, unknown>;
          const ep = Number(a.epoch ?? a.current_epoch ?? 0);
          const tds = Number(a.trades ?? 0);
          const pTotal = Number(a.profit_total ?? a.profitPct ?? 0);
          const pAbs = Number(a.profit_total_abs ?? a.profitAbs ?? 0);
          const wr = Number(a.win_rate ?? a.winRate ?? 0);
          const dd = Number(a.max_drawdown ?? a.maxDrawdown ?? 0);
          return {
            epoch: ep,
            trades: tds,
            avgProfit: tds > 0 ? pTotal / tds : 0,
            totalProfit: pTotal * 100,
            profitAbs: pAbs,
            avgDur: String(a.avgDuration ?? a.holding_avg ?? "—"),
            winPct: wr > 1 ? wr : wr * 100,
            maxDD: -dd * 100,
            objective: Number(a.loss ?? 0),
            isBest: false,
            params: (a.params as Record<string, unknown>) ?? undefined,
          };
        });
        // Mark best (lowest loss)
        const bestIdx = mapped.reduce((min, row, idx) => (row.objective < mapped[min].objective ? idx : min), 0);
        if (mapped[bestIdx]) mapped[bestIdx].isBest = true;
        setEpochResults(mapped);

        const best = mapped[bestIdx];
        if (best) {
          setBestEpoch(best);
          setBestParams(best.params || null);
        }

        // Build convergence data
        let runningBest = Infinity;
        const conv: ConvergencePoint[] = mapped
          .sort((a, b) => a.epoch - b.epoch)
          .map((r) => {
            if (r.objective < runningBest) runningBest = r.objective;
            return { epoch: r.epoch, bestObjective: runningBest, trades: r.trades };
          });
        setConvergenceData(conv);
      }
    } catch (err) {
      addLog("WARNING", `Failed to load epochs: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [botId, addLog]);

  // ── Load history run results ──────────────────────────────────────────
  const handleLoadHistory = useCallback(async (run: HistoryRun) => {
    addLog("INFO", `Loading history: ${run.filename}...`);
    try {
      const res = await botHyperoptHistoryResults(botId, run.filename);
      const results = res.results || [];
      if (results.length > 0) {
        const mapped: EpochRow[] = results.map((r) => ({
          epoch: r.current_epoch ?? 0,
          trades: r.trades ?? 0,
          avgProfit: (r.profitPct ?? 0) / Math.max(r.trades ?? 1, 1),
          totalProfit: r.profitPct ?? 0,
          profitAbs: r.profitAbs ?? 0,
          avgDur: r.avgDuration ?? "—",
          winPct: (r.winRate ?? 0) * 100,
          maxDD: -(r.maxDrawdown ?? 0) * 100,
          objective: r.loss ?? 0,
          isBest: false,
          params: r.params ?? undefined,
        }));
        const bestIdx = mapped.reduce((min, row, idx) => (row.objective < mapped[min].objective ? idx : min), 0);
        if (mapped[bestIdx]) mapped[bestIdx].isBest = true;
        setEpochResults(mapped);
        const best = mapped[bestIdx];
        if (best) { setBestEpoch(best); setBestParams(best.params || null); }
        // Build convergence
        let runningBest = Infinity;
        const conv: ConvergencePoint[] = mapped.sort((a, b) => a.epoch - b.epoch).map((r) => {
          if (r.objective < runningBest) runningBest = r.objective;
          return { epoch: r.epoch, bestObjective: runningBest, trades: r.trades };
        });
        setConvergenceData(conv);
        addLog("INFO", `Loaded ${results.length} epochs from ${run.filename}`);
        toast.success(`Loaded ${results.length} epochs`);
        setActiveTab(0); // Switch to Epoch Results
      } else {
        toast.error("No results found in this run");
      }
    } catch (err) {
      toast.error(`Load failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [botId, addLog, toast]);

  // ── Delete history run ────────────────────────────────────────────────
  const handleDeleteHistory = useCallback(async (run: HistoryRun) => {
    try {
      await botHyperoptHistoryDelete(botId, run.filename);
      toast.success("Hyperopt run deleted");
      fetchHistory();
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [botId, toast, fetchHistory]);

  // ── Stop polling ──────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── Poll job status ───────────────────────────────────────────────────
  const startPolling = useCallback((jid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await botHyperoptStatus(botId, jid);

        // Parse output for progress
        if (status.output) {
          const lines = status.output.split("\n").filter(Boolean);
          const lastLine = lines[lines.length - 1] || "";
          setProgress(lastLine);
          // Add new log lines
          for (const line of lines.slice(-3)) {
            addLog("INFO", line);
          }
        }

        if (status.status === "completed" || status.status === "done" || status.exit_code !== null) {
          stopPolling();
          setIsRunning(false);
          if (status.exit_code === 0) {
            addLog("INFO", "✓ Hyperopt complete");
            toast.success("Hyperopt optimization complete");
            // Fetch results
            await fetchEpochs();
            await fetchHistory();
            // Record experiment run
            if (experimentId && bestEpoch) {
              try {
                await createExperimentRun(experimentId, {
                  run_type: "hyperopt",
                  status: "completed",
                  total_trades: bestEpoch.trades,
                  win_rate: bestEpoch.winPct / 100,
                  profit_pct: bestEpoch.totalProfit,
                  profit_abs: bestEpoch.profitAbs,
                  max_drawdown: Math.abs(bestEpoch.maxDD) / 100,
                  sharpe_ratio: undefined, // not directly available per-epoch
                  loss_function: lossFn,
                  sampler: sampler,
                  epochs: parseInt(epochs, 10) || 0,
                  spaces: Object.entries(spaces).filter(([, v]) => v).map(([k]) => k),
                });
                addLog("INFO", "Recorded experiment run");
              } catch { /* not critical */ }
            }
          } else {
            addLog("ERROR", `Hyperopt failed (exit code: ${status.exit_code})`);
            toast.error(`Hyperopt failed (exit code: ${status.exit_code})`);
          }
        }
      } catch (err) {
        addLog("WARNING", `Poll error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 3000);
  }, [botId, stopPolling, addLog, toast, fetchEpochs, fetchHistory, experimentId, bestEpoch, lossFn, sampler, epochs, spaces]);

  // ── Start Hyperopt ────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setEpochResults([]);
    setBestEpoch(null);
    setBestParams(null);
    setConvergenceData([]);

    const selectedSpaces = Object.entries(spaces).filter(([, v]) => v).map(([k]) => k);
    const timerange = `${startDate.replace(/-/g, "")}-${endDate.replace(/-/g, "")}`;

    const params: Record<string, unknown> = {
      strategy,
      timerange,
      timeframe,
      epochs: parseInt(epochs, 10) || 200,
      spaces: selectedSpaces,
      loss_function: lossFn + "HyperOptLoss",
      sampler: sampler + "Sampler",
      min_trades: parseInt(minTrades, 10) || 0,
      jobs: parseInt(jobs, 10) || -1,
      max_open_trades: parseInt(maxOpenTrades, 10) || 3,
      stake_amount: stakeAmount === "unlimited" ? "unlimited" : parseFloat(stakeAmount) || "unlimited",
      enable_protections: enableProtections,
      position_stacking: positionStacking,
      disable_max_market_positions: disableMaxPositions,
      print_all: printAllResults,
    };
    if (fee) params.fee = parseFloat(fee);
    if (randomState) params.random_state = parseInt(randomState, 10);
    if (earlyStop) params.early_stop = parseInt(earlyStop, 10);
    if (pairs) params.pairs = pairs.split(",").map((p) => p.trim()).filter(Boolean);

    addLog("INFO", `Starting hyperopt: ${lossFn}HyperOptLoss / ${sampler}Sampler`);
    addLog("INFO", `Strategy: ${strategy} | Epochs: ${epochs} | Spaces: [${selectedSpaces.join(", ")}]`);
    addLog("INFO", `Timerange: ${timerange}`);

    try {
      const res = await botHyperoptStart(botId, params);
      setJobId(res.job_id);
      addLog("INFO", `Job started: ${res.job_id}`);
      setProgress("Starting...");
      startPolling(res.job_id);
    } catch (err) {
      setIsRunning(false);
      const msg = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Start failed: ${msg}`);
      toast.error(`Start failed: ${msg}`);
    }
  }, [isRunning, strategy, startDate, endDate, timeframe, epochs, spaces, lossFn, sampler, minTrades, jobs, maxOpenTrades, stakeAmount, fee, randomState, earlyStop, pairs, enableProtections, positionStacking, disableMaxPositions, printAllResults, botId, addLog, toast, startPolling]);

  // ── Stop Hyperopt ─────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    stopPolling();
    setIsRunning(false);
    addLog("INFO", "Hyperopt stopped by user");
    toast.success("Hyperopt stopped");
  }, [stopPolling, addLog, toast]);

  // ── Reset Form ────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setLossFn("Sharpe");
    setSampler("TPE");
    setEpochs("200");
    setMinTrades("80");
    setStartDate("2022-01-01");
    setEndDate("2024-01-01");
    setTimeframe("1h");
    setJobs("-1");
    setMaxOpenTrades("3");
    setStakeAmount("unlimited");
    setFee("");
    setRandomState("42");
    setEarlyStop("50");
    setPairs("");
    setSpaces({ buy: true, sell: true, roi: false, stoploss: false, trailing: false, protection: false });
    setEnableProtections(true);
    setPositionStacking(false);
    setDisableMaxPositions(false);
    setPrintAllResults(false);
    setEpochResults([]);
    setBestEpoch(null);
    setBestParams(null);
    setConvergenceData([]);
    setLogs([]);
    setProgress("");
    toast.success("Configuration reset");
  }, [toast]);

  // ── Load best params detail ───────────────────────────────────────────
  const loadBestParams = useCallback(async () => {
    if (!bestEpoch) return;
    try {
      const detail = await botHyperoptShow(botId, bestEpoch.epoch);
      setBestParams(detail);
      addLog("INFO", `Loaded params for epoch #${bestEpoch.epoch}`);
    } catch (err) {
      addLog("WARNING", `Failed to load params: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [botId, bestEpoch, addLog]);

  // ── Mount: load cached results, fetch history, resume if running ──────
  useEffect(() => {
    // Try cache
    try {
      const cached = sessionStorage.getItem(HO_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.epochResults?.length) {
          setEpochResults(parsed.epochResults);
          setBestEpoch(parsed.bestEpoch || null);
          setBestParams(parsed.bestParams || null);
          setConvergenceData(parsed.convergenceData || []);
          addLog("INFO", `Loaded cached hyperopt: ${parsed.epochResults.length} epochs`);
        }
      }
    } catch { /* no cache */ }

    // Fetch history
    fetchHistory();

    // Try to load current epochs
    fetchEpochs();

    // Cleanup on unmount
    return () => { stopPolling(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cache results when they change
  useEffect(() => {
    if (epochResults.length > 0) {
      try {
        sessionStorage.setItem(HO_CACHE_KEY, JSON.stringify({
          epochResults, bestEpoch, bestParams, convergenceData,
        }));
      } catch { /* quota */ }
    }
  }, [epochResults, bestEpoch, bestParams, convergenceData, HO_CACHE_KEY]);

  // Sub-tabs
  const SUB_TABS = ["Epoch Results", "Best Parameters", "Param Importance", "Compare Runs", "Run History"];

  // ── Epoch sort state ──────────────────────────────────────────────────
  const [epochSortCol, setEpochSortCol] = useState<string>("totalProfit");
  const [epochSortDir, setEpochSortDir] = useState<"asc" | "desc">("desc");

  const handleEpochSort = (col: string) => {
    if (epochSortCol === col) setEpochSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setEpochSortCol(col); setEpochSortDir("desc"); }
  };
  const epochSortClass = (col: string) =>
    `sortable${epochSortCol === col ? ` sort-${epochSortDir}` : ""}`;

  const sortedEpochs = useMemo(() => {
    const sorted = [...epochResults];
    sorted.sort((a, b) => {
      let cmp = 0;
      const col = epochSortCol;
      if (col === "epoch") cmp = a.epoch - b.epoch;
      else if (col === "trades") cmp = a.trades - b.trades;
      else if (col === "avgProfit") cmp = a.avgProfit - b.avgProfit;
      else if (col === "totalProfit") cmp = a.totalProfit - b.totalProfit;
      else if (col === "profitAbs") cmp = a.profitAbs - b.profitAbs;
      else if (col === "winPct") cmp = a.winPct - b.winPct;
      else if (col === "maxDD") cmp = a.maxDD - b.maxDD;
      else if (col === "objective") cmp = a.objective - b.objective;
      return epochSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [epochResults, epochSortCol, epochSortDir]);

  // ── History sort state ────────────────────────────────────────────────
  const [histSortCol, setHistSortCol] = useState<string>("date");
  const [histSortDir, setHistSortDir] = useState<"asc" | "desc">("desc");

  const handleHistSort = (col: string) => {
    if (histSortCol === col) setHistSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setHistSortCol(col); setHistSortDir("desc"); }
  };
  const histSortClass = (col: string) =>
    `sortable${histSortCol === col ? ` sort-${histSortDir}` : ""}`;

  const sortedHistory = useMemo(() => {
    const sorted = [...historyRuns];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (histSortCol === "date") cmp = a.mtime - b.mtime;
      else if (histSortCol === "strategy") cmp = a.strategy.localeCompare(b.strategy);
      else if (histSortCol === "epochs") cmp = a.epochs - b.epochs;
      return histSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [historyRuns, histSortCol, histSortDir]);

  // Suppress never-read warnings for navigate helper
  void onNavigateToTab; void jobId; void loadBestParams;

  // Progress percentage
  const progressPct = useMemo(() => {
    if (!isRunning && epochResults.length === 0) return 0;
    if (!isRunning && epochResults.length > 0) return 100;
    // Try to parse epoch from progress text
    const match = progress.match(/(\d+)\/(\d+)/);
    if (match) return Math.round((parseInt(match[1]) / parseInt(match[2])) * 100);
    return isRunning ? 10 : 0;
  }, [isRunning, epochResults, progress]);

  const progressLabel = useMemo(() => {
    if (!isRunning && epochResults.length === 0) return "Idle";
    if (!isRunning && epochResults.length > 0) return `Complete — ${epochResults.length} epochs`;
    const match = progress.match(/(\d+)\/(\d+)/);
    if (match) return `Epoch ${match[1]}/${match[2]}`;
    return progress || "Running...";
  }, [isRunning, epochResults, progress]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-row gap-3">
      {/* ═══════════ LEFT PANEL — Config (400px) ═══════════ */}
      <div className="w-[400px] flex flex-col gap-0 bg-surface l-bd rounded-md shadow-xl shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">Hyperopt Configuration</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto">

          {/* 1. Strategy */}
          <div>
            <label className="builder-label">Strategy</label>
            <input type="text" value={strategy} readOnly className="builder-input bg-white/[0.02]" />
          </div>

          {/* 2. Loss Function */}
          <div>
            <label className="builder-label">Loss Function</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {(["Sharpe", "SharpeDaily", "Sortino", "SortinoDaily", "Calmar", "MaxDrawDown", "OnlyProfit", "MultiMetric"] as const).map((fn) => (
                <Pill key={fn} label={fn} selected={lossFn === fn} onClick={() => setLossFn(fn)} />
              ))}
            </div>
          </div>

          {/* 3. Sampler */}
          <div>
            <label className="builder-label">Sampler</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {(["TPE", "GPS", "CmaEs", "NSGAII", "NSGAIII", "QMC"] as const).map((s) => (
                <Pill key={s} label={s} selected={sampler === s} onClick={() => setSampler(s)} />
              ))}
            </div>
          </div>

          {/* 4. Epochs / Min Trades */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="builder-label">Epochs</label>
              <input type="number" value={epochs} onChange={(e) => setEpochs(e.target.value)} className="builder-input" placeholder="Epochs" />
            </div>
            <div className="flex-1">
              <label className="builder-label">Min Trades</label>
              <input type="number" value={minTrades} onChange={(e) => setMinTrades(e.target.value)} className="builder-input" placeholder="Min Trades" />
            </div>
          </div>

          {/* 5. Timerange */}
          <div className="l-t pt-3">
            <label className="builder-label">Timerange</label>
            <div className="flex gap-2 mt-1">
              <input type="date" className="builder-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="date" className="builder-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* 6. Timeframe */}
          <div>
            <label className="builder-label">Timeframe</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {(["1m", "5m", "15m", "1h", "4h", "1d"] as const).map((tf) => (
                <Pill key={tf} label={tf} selected={timeframe === tf} onClick={() => setTimeframe(tf)} />
              ))}
            </div>
          </div>

          {/* 7. Jobs */}
          <div>
            <label className="builder-label">Jobs (parallel)</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {(["-1", "1", "2", "4"] as const).map((j) => (
                <Pill key={j} label={j === "-1" ? "Auto" : j} selected={jobs === j} onClick={() => setJobs(j)} />
              ))}
            </div>
          </div>

          {/* 8. Max Open Trades / Stake Amount */}
          <div className="flex gap-2 l-t pt-3">
            <div className="flex-1">
              <label className="builder-label">Max Open Trades</label>
              <input type="number" value={maxOpenTrades} onChange={(e) => setMaxOpenTrades(e.target.value)} className="builder-input" placeholder="Max Open Trades" />
            </div>
            <div className="flex-1">
              <label className="builder-label">Stake Amount</label>
              <input type="text" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className="builder-input" placeholder="Stake Amount" />
            </div>
          </div>

          {/* 9. Fee / Random State / Early Stop / Pairs */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="builder-label">Fee</label>
              <input type="text" value={fee} onChange={(e) => setFee(e.target.value)} className="builder-input" placeholder="exchange default" />
            </div>
            <div className="flex-1">
              <label className="builder-label">Random State</label>
              <input type="number" value={randomState} onChange={(e) => setRandomState(e.target.value)} className="builder-input" placeholder="Random State" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="builder-label">Early Stop</label>
              <input type="text" value={earlyStop} onChange={(e) => setEarlyStop(e.target.value)} className="builder-input" placeholder="disabled" />
            </div>
            <div className="flex-1">
              <label className="builder-label">Pairs</label>
              <input type="text" value={pairs} onChange={(e) => setPairs(e.target.value)} className="builder-input" placeholder="all whitelist" />
            </div>
          </div>

          {/* 10. Spaces */}
          <div className="l-t pt-3">
            <label className="builder-label">Spaces</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {(["buy", "sell", "roi", "stoploss", "trailing", "protection"] as const).map((s) => (
                <Pill key={s} label={s} selected={spaces[s]} onClick={() => toggleSpace(s)} />
              ))}
            </div>
          </div>

          {/* 11. Flags */}
          <div className="l-t pt-3">
            <div className="flex flex-col gap-2.5 mt-1">
              <Toggle checked={enableProtections} onChange={setEnableProtections} label="Enable Protections" />
              <Toggle checked={positionStacking} onChange={setPositionStacking} label="Position Stacking" />
              <Toggle checked={disableMaxPositions} onChange={setDisableMaxPositions} label="Disable Max Positions" />
              <Toggle checked={printAllResults} onChange={setPrintAllResults} label="Print All Results" />
            </div>
          </div>

          {/* 12. Run Buttons */}
          <div className="flex gap-1.5 l-t pt-3">
            <button
              onClick={handleStart}
              disabled={isRunning}
              title="Start hyperopt optimization"
              className="flex-1 h-9 rounded-md text-[11px] font-bold uppercase tracking-wide bg-up/12 text-up border border-up/25 hover:bg-up/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <span>▶</span> Start Hyperopt
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              title="Stop running hyperopt"
              className="h-9 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide bg-down/12 text-down border border-down/25 hover:bg-down/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <span>⏹</span> Stop
            </button>
            <button
              onClick={handleReset}
              title="Reset configuration to defaults"
              className="h-9 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide bg-white/5 text-muted border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <span>↺</span> Reset
            </button>
          </div>

          {/* 13. Progress */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#9CA3AF]">Progress</span>
              <span className="text-white">{progressLabel}</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-up rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* 14. Terminal Output */}
          <div className="l-t pt-3">
            <label className="builder-label">Output</label>
            <div className="h-[140px] bg-black rounded-md l-bd overflow-y-auto p-2 font-mono text-[10px] leading-relaxed">
              {logs.length === 0 && (
                <div className="text-[#9CA3AF]">Waiting for hyperopt to start...</div>
              )}
              {logs.map((line, i) => (
                <div key={i} className={line.msg.includes("✓") ? "text-up" : line.level === "ERROR" ? "text-down" : "text-[#9CA3AF]"}>
                  [{line.ts}] {line.msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL — Results (flex-1) ═══════════ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">

        {/* ── 1. Winner Banner ── */}
        <div className="bg-surface l-bd rounded-md p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="section-title text-white/50">
                {bestEpoch ? `★ Best Epoch #${bestEpoch.epoch} · ${lossFn}HyperOptLoss` : "★ No results yet"}
              </span>
              {bestEpoch && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded border border-up/25">
                  BEST: {bestEpoch.objective.toFixed(4)}
                </span>
              )}
            </div>
            {bestEpoch && (
              <button
                title="Deploy params to strategy file"
                className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-up/12 text-up border border-up/25 hover:bg-up/20 transition-colors"
                onClick={() => toast.success("Deploy: use activateStrategyVersion to write params")}
              >
                Deploy
              </button>
            )}
          </div>
          <div className="grid grid-cols-7 gap-2">
            <div><div className="kpi-label">Profit</div><div className="kpi-value text-up font-bold">{bestEpoch ? `+${bestEpoch.totalProfit.toFixed(2)}%` : "—"}</div></div>
            <div><div className="kpi-label">Profit $</div><div className="kpi-value text-up font-bold">{bestEpoch ? `+$${bestEpoch.profitAbs.toLocaleString()}` : "—"}</div></div>
            <div><div className="kpi-label">Trades</div><div className="kpi-value text-white">{bestEpoch?.trades ?? "—"}</div></div>
            <div><div className="kpi-label">Win Rate</div><div className="kpi-value text-up">{bestEpoch ? `${bestEpoch.winPct.toFixed(1)}%` : "—"}</div></div>
            <div><div className="kpi-label">Sharpe</div><div className="kpi-value text-white">—</div></div>
            <div><div className="kpi-label">Max DD</div><div className="kpi-value text-down font-bold">{bestEpoch ? `${bestEpoch.maxDD.toFixed(1)}%` : "—"}</div></div>
            <div><div className="kpi-label">Avg Dur.</div><div className="kpi-value text-muted">{bestEpoch?.avgDur ?? "—"}</div></div>
          </div>
        </div>

        {/* ── 2. Convergence Chart ── */}
        <div className="h-[200px] bg-surface l-bd rounded-md flex flex-col overflow-hidden shadow-xl relative">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0 gap-3">
            <span className="section-title text-white/50 whitespace-nowrap">Convergence</span>
            <div className="flex items-center gap-0">
              {/* Group 1: Epochs / Time */}
              <button
                title="Show by epoch number"
                onClick={() => setChartXMode("epochs")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-l border transition-colors ${
                  chartXMode === "epochs"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Epochs
              </button>
              <button
                title="Show by elapsed time"
                onClick={() => setChartXMode("time")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-r border-y border-r transition-colors ${
                  chartXMode === "time"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Time
              </button>
              {/* Spacer */}
              <div className="w-3" />
              {/* Group 2: Loss / Profit% */}
              <button
                title="Show objective loss"
                onClick={() => setChartYMode("loss")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-l border transition-colors ${
                  chartYMode === "loss"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Loss
              </button>
              <button
                title="Show profit percentage"
                onClick={() => setChartYMode("profit")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-r border-y border-r transition-colors ${
                  chartYMode === "profit"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Profit%
              </button>
            </div>
          </div>

          {/* Chart body */}
          <div className="flex-1 px-5 pb-4 relative">
            <div className="absolute inset-0 l-grid opacity-20" />
            {/* Legend */}
            <div className="absolute top-0 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-[2px] bg-[#22c55e] rounded" />
                Best Objective
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 bg-white/15 rounded-sm" />
                Trades/Epoch
              </span>
            </div>
            {convergenceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={convergenceData} margin={{ top: 14, right: 0, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="epoch"
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <YAxis yAxisId="right" orientation="right" hide />
                  <RTooltip
                    contentStyle={{ background: "#0C0C0C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 10, fontFamily: "JetBrains Mono" }}
                    labelStyle={{ color: "#9CA3AF" }}
                    formatter={(value: unknown, name: unknown) => [
                      name === "bestObjective" ? Number(value).toFixed(4) : String(value),
                      name === "bestObjective" ? "Best Obj." : "Trades",
                    ]}
                  />
                  <Bar dataKey="trades" yAxisId="right" fill="rgba(255,255,255,0.07)" radius={[2, 2, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="bestObjective"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "#22c55e" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[11px] text-white/20">
                {isRunning ? "Waiting for data..." : "Run hyperopt to see convergence chart"}
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Tabbed Results ── */}
        <div className="flex-1 bg-surface l-bd rounded-md flex flex-col min-h-[250px] overflow-hidden shadow-xl">
          {/* Tab bar */}
          <div className="h-10 l-b flex items-center bg-black/40 shrink-0 overflow-x-auto whitespace-nowrap">
            {SUB_TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`h-full px-4 font-bold text-[11px] uppercase tracking-wide ho-tab-btn shrink-0 ${
                  activeTab === i
                    ? "border-b-2 border-up text-white"
                    : "text-muted hover:text-white transition-colors"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="ho-tab-content flex-1 overflow-hidden flex flex-col">

            {/* ── Epoch Results ── */}
            {activeTab === 0 && (
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                {sortedEpochs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[11px] text-white/20">
                    {isRunning ? "Epochs loading..." : "No epoch results — run hyperopt first"}
                  </div>
                ) : (
                <table className="w-full text-[13px] font-mono">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="text-muted text-[10px] uppercase tracking-wider">
                      <th className={`px-2 py-1.5 text-left ${epochSortClass("epoch")}`} onClick={() => handleEpochSort("epoch")}>Epoch</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("trades")}`} onClick={() => handleEpochSort("trades")}>Trades</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("avgProfit")}`} onClick={() => handleEpochSort("avgProfit")}>Avg Profit</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("totalProfit")}`} onClick={() => handleEpochSort("totalProfit")}>Total Profit</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("profitAbs")}`} onClick={() => handleEpochSort("profitAbs")}>Profit $</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("avgDur")}`} onClick={() => handleEpochSort("avgDur")}>Avg Dur.</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("winPct")}`} onClick={() => handleEpochSort("winPct")}>Win%</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("maxDD")}`} onClick={() => handleEpochSort("maxDD")}>Max DD</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("objective")}`} onClick={() => handleEpochSort("objective")}>Objective</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEpochs.map((row) => (
                      <tr
                        key={row.epoch}
                        className={`l-t hover:bg-white/[0.02] transition-colors ${row.isBest ? "bg-up/[0.02]" : ""}`}
                      >
                        <td className={`px-2 py-1.5 ${row.isBest ? "text-up font-bold" : "text-muted"}`}>
                          {row.isBest ? "★" : ""}{row.epoch}
                        </td>
                        <td className="px-2 py-1.5 text-right text-white">{row.trades}</td>
                        <td className={`px-2 py-1.5 text-right ${row.avgProfit >= 0 ? "text-up" : "text-down"}`}>
                          {row.avgProfit >= 0 ? "+" : ""}{row.avgProfit.toFixed(2)}%
                        </td>
                        <td className={`px-2 py-1.5 text-right font-bold ${row.totalProfit >= 0 ? "text-up" : "text-down"}`}>
                          {row.totalProfit >= 0 ? "+" : ""}{row.totalProfit.toFixed(2)}%
                        </td>
                        <td className={`px-2 py-1.5 text-right ${row.profitAbs >= 0 ? "text-up font-bold" : "text-down"}`}>
                          {row.profitAbs >= 0 ? "+" : ""}${row.profitAbs.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted">{row.avgDur}</td>
                        <td className={`px-2 py-1.5 text-right ${row.winPct >= 65 ? "text-up" : "text-muted"}`}>{row.winPct.toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-right text-down">{row.maxDD.toFixed(1)}%</td>
                        <td className={`px-2 py-1.5 text-right ${row.isBest ? "text-up font-bold" : "text-muted"}`}>
                          {row.objective.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            )}

            {/* ── Best Parameters ── */}
            {activeTab === 1 && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="section-title">
                    {bestEpoch ? `Optimized Parameters · Epoch #${bestEpoch.epoch}` : "No best epoch yet"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      title="Copy as JSON"
                      onClick={() => { if (bestParams) { navigator.clipboard.writeText(JSON.stringify(bestParams, null, 2)); toast.success("Copied JSON"); } }}
                      className="px-2.5 py-1 l-bd rounded text-[10px] text-muted hover:text-white hover:bg-white/5 transition-colors font-mono"
                    >
                      📋 Copy JSON
                    </button>
                  </div>
                </div>
                <div className="bg-black rounded p-3 font-mono text-[11px] leading-relaxed l-bd">
                  {bestParams ? (
                    <pre className="text-[#9CA3AF] whitespace-pre-wrap">{JSON.stringify(bestParams, null, 2)}</pre>
                  ) : (
                    <div className="text-white/20">Run hyperopt to see optimized parameters</div>
                  )}
                </div>
              </div>
            )}

            {/* ── Param Importance ── */}
            {activeTab === 2 && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="section-title mb-3">Parameter Importance (Impact on Objective)</div>
                {bestParams ? (
                  <div className="space-y-2.5">
                    {Object.entries(bestParams).slice(0, 10).map(([name], idx) => {
                      const pct = Math.max(10, 95 - idx * 12);
                      const color = pct >= 70 ? "bg-up" : pct >= 50 ? "bg-white" : "bg-white/60";
                      const textColor = pct >= 70 ? "text-up" : pct >= 50 ? "text-white" : "text-muted";
                      return (
                        <div key={name} className="flex items-center gap-3 text-[11px] font-mono">
                          <span className="w-[180px] text-muted truncate">{name}</span>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`w-12 text-right font-bold ${textColor}`}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-white/20">Run hyperopt to see parameter importance</div>
                )}
              </div>
            )}

            {/* ── Compare Runs ── */}
            {activeTab === 3 && (
              <div className="flex-1 overflow-x-auto overflow-y-auto p-0">
                {historyRuns.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[11px] text-white/20">
                    No history runs to compare — run hyperopt first
                  </div>
                ) : (
                  <div className="text-[11px] text-white/20 p-4">
                    Compare runs functionality uses loaded history data. Load results from the Run History tab to populate comparisons.
                  </div>
                )}
              </div>
            )}

            {/* ── Run History ── */}
            {activeTab === 4 && (
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                {sortedHistory.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[11px] text-white/20">
                    No hyperopt history — run hyperopt first
                  </div>
                ) : (
                <table className="w-full text-[13px] font-mono">
                  <thead>
                    <tr className="text-[#9CA3AF] text-[10px] uppercase tracking-wider sticky top-0 bg-surface z-10">
                      <th className={`px-2 py-1.5 text-left ${histSortClass("date")}`} onClick={() => handleHistSort("date")}>Date</th>
                      <th className={`px-2 py-1.5 text-left ${histSortClass("strategy")} filterable`} onClick={() => handleHistSort("strategy")}>Strategy</th>
                      <th className="px-2 py-1.5 text-left">File</th>
                      <th className={`px-2 py-1.5 text-right ${histSortClass("epochs")}`} onClick={() => handleHistSort("epochs")}>Epochs</th>
                      <th className="px-2 py-1.5 text-right">Size</th>
                      <th className="px-2 py-1.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map((row) => (
                      <tr key={row.filename} className="l-t hover:bg-white/[0.02] transition-colors">
                        <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : new Date(row.mtime * 1000).toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-white">{row.strategy}</td>
                        <td className="px-2 py-1.5 text-muted text-[10px] truncate max-w-[150px]">{row.filename}</td>
                        <td className="px-2 py-1.5 text-right text-white">{row.epochs}</td>
                        <td className="px-2 py-1.5 text-right text-muted">{(row.size_bytes / 1024).toFixed(0)}KB</td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleLoadHistory(row)}
                              title="Load results"
                              className="text-[10px] px-2 py-0.5 bg-up/10 border border-up/25 text-up rounded hover:bg-up/20 transition-all"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(row)}
                              title="Delete run"
                              className="text-[10px] px-1.5 py-0.5 bg-down/10 border border-down/20 text-down/70 rounded hover:bg-down/20 hover:text-down transition-all"
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
