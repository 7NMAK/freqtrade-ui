"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Tooltip from "@/components/ui/Tooltip";
import Toggle from "@/components/ui/Toggle";
import { INPUT, SELECT, LABEL, SECTION_CARD, SECTION_TITLE, METRIC_CARD, BTN_PRIMARY, LAYOUT_2COL } from "@/lib/design";
import { FREQAI_MODELS, OUTLIER_METHODS } from "@/lib/experiments";
import { useToast } from "@/components/ui/Toast";
import {
  botBacktestStart,
  botBacktestResults,
  botBacktestDelete,
  botConfig,
  createExperimentRun,
  getExperimentRuns,
  getExperiments,
  activateStrategyVersion,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────
interface FreqAITabProps {
  strategy: string;
  botId?: number;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

type FreqAIResult = {
  id: number;
  model: string;
  outlier: string;
  pca: boolean;
  noise: boolean;
  status: "pending" | "running" | "completed" | "failed";
  trades: number;
  winRate: number;
  profitPct: number;
  maxDrawdown: number;
  sharpe: number;
  sortino: number;
  startedAt: string;
  finishedAt: string;
  trainingDuration: string;
  featureImportance: string[];
  predictionAccuracy: number;
};

type QueueItem = {
  model: string;
  outlier: string;
  pca: boolean;
  noise: boolean;
  config: Record<string, unknown>;
};

type SortKey = "profitPct" | "sharpe" | "sortino" | "winRate" | "maxDrawdown" | "trades";

// ── Config Generator ──────────────────────────────────────────────────

function buildFreqAIConfig(opts: {
  strategy: string;
  model: string;
  outlier: string;
  pca: boolean;
  noise: boolean;
  btStart: string;
  btEnd: string;
  trainDays: number;
  diThreshold: number;
  svmNu: number;
  weightFactor: number;
  noiseStdDev: number;
  featurePeriod: string;
  labelPeriod: string;
  indicatorPeriods: string;
  bufferTrainData: number;
  shuffleAfterSplit: boolean;
  includeCorrPairs: boolean;
}): Record<string, unknown> {
  const timerange = `${opts.btStart.replace(/-/g, "")}-${opts.btEnd.replace(/-/g, "")}`;
  const indicatorPeriods = opts.indicatorPeriods
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  return {
    strategy: opts.strategy,
    timerange,
    freqaimodel: opts.model,
    freqai: {
      enabled: true,
      purge_old_models: 2,
      train_period_days: opts.trainDays,
      backtest_period_days: 7,
      identifier: `${opts.model}_${opts.outlier}_pca${opts.pca ? 1 : 0}_noise${opts.noise ? 1 : 0}`,
      feature_parameters: {
        include_timeframes: ["5m", "15m", "1h"],
        include_corr_pairlist: opts.includeCorrPairs ? ["BTC/USDT:USDT", "ETH/USDT:USDT"] : [],
        indicator_periods_candles: indicatorPeriods.length > 0 ? indicatorPeriods : [10, 20],
        feature_period_candles: parseInt(opts.featurePeriod, 10) || 20,
        label_period_candles: parseInt(opts.labelPeriod, 10) || 24,
        DI_threshold: opts.outlier === "di" ? opts.diThreshold : 0,
        use_SVM_to_remove_outliers: opts.outlier === "svm",
        svm_params: opts.outlier === "svm" ? { shuffle: false, nu: opts.svmNu } : undefined,
        use_DBSCAN_to_remove_outliers: opts.outlier === "dbscan",
        principal_component_analysis: opts.pca,
        noise_standard_deviation: opts.noise ? opts.noiseStdDev : 0,
        weight_factor: opts.weightFactor,
        buffer_train_data_candles: opts.bufferTrainData,
        shuffle_after_split: opts.shuffleAfterSplit,
      },
      data_split_parameters: {
        test_size: 0.33,
        random_state: 1,
      },
    },
    dry_run_wallet: 10000,
    stake_amount: "unlimited",
    enable_protections: false,
    cache: "none",
    export: "none",
  };
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(1, Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

// ── Log Entry ─────────────────────────────────────────────────────────

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════

export default function FreqAITab({ strategy, botId = 2, experimentId, onNavigateToTab }: FreqAITabProps) {
  const toast = useToast();

  // ── Form State ────────────────────────────────────────────────────
  const [selectedHyperopt, setSelectedHyperopt] = useState(0);
  const [testNamePrefix, setTestNamePrefix] = useState(`freqai_${new Date().toISOString().split("T")[0]}`);
  const [trainStartDate, setTrainStartDate] = useState("2022-01-01");
  const [trainEndDate, setTrainEndDate] = useState("2024-01-01");
  const [backTestStartDate, setBackTestStartDate] = useState("2024-01-01");
  const [backTestEndDate, setBackTestEndDate] = useState("2025-01-01");
  const [featurePeriod, setFeaturePeriod] = useState("20");
  const [labelPeriod, setLabelPeriod] = useState("24");

  // Model matrix
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set(["LightGBMRegressor"]));
  const [selectedOutliers, setSelectedOutliers] = useState<Set<string>>(new Set(["di"]));
  const [pcaEnabled, setPcaEnabled] = useState(true);
  const [noiseEnabled, setNoiseEnabled] = useState(true);

  // Advanced options
  const [diThreshold, setDiThreshold] = useState(1.0);
  const [svmNu, setSvmNu] = useState(0.15);
  const [weightFactor, setWeightFactor] = useState(1.0);
  const [noiseStdDev, setNoiseStdDev] = useState(0.1);
  const [outlierProtectionPct, setOutlierProtectionPct] = useState(30);
  const [bufferTrainData, setBufferTrainData] = useState(0);
  const [shuffleAfterSplit, setShuffleAfterSplit] = useState(false);
  const [reverseTrainTest, setReverseTrainTest] = useState(false);
  const [includeCorrPairs, setIncludeCorrPairs] = useState(false);
  const [indicatorPeriods, setIndicatorPeriods] = useState("10, 20");

  // ── Running State ─────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const RESULTS_KEY = useMemo(() => `freqai_results_${strategy}`, [strategy]);
  const QUEUE_KEY = useMemo(() => `freqai_queue_${strategy}`, [strategy]);
  const [results, setResults] = useState<FreqAIResult[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [currentRunLabel, setCurrentRunLabel] = useState("");
  const [currentRunProgress, setCurrentRunProgress] = useState(0);
  const [runTimes, setRunTimes] = useState<number[]>([]);
  const runStartRef = useRef<number>(0);
  const abortRef = useRef(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // ── Sorting ───────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<SortKey>("sharpe");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Hyperopt options ──────────────────────────────────────────────
  const [hyperoptOptions, setHyperoptOptions] = useState<Array<{ id: number; label: string }>>([]);

  // ── Matrix Calculation ────────────────────────────────────────────
  const matrixTotal = selectedModels.size * selectedOutliers.size
    * (pcaEnabled ? 2 : 1) * (noiseEnabled ? 2 : 1);

  // ── Logging ───────────────────────────────────────────────────────
  const addLog = useCallback((level: string, msg: string) => {
    setLogs((prev) => [...prev.slice(-200), { ts: new Date().toISOString().slice(11, 19), level, msg }]);
  }, []);

  // ── Toggle Handlers ───────────────────────────────────────────────
  const handleToggleModel = (v: string) => {
    const s = new Set(selectedModels);
    if (s.has(v)) s.delete(v);
    else s.add(v);
    setSelectedModels(s);
  };

  const handleToggleOutlier = (v: string) => {
    const s = new Set(selectedOutliers);
    if (s.has(v)) s.delete(v);
    else s.add(v);
    setSelectedOutliers(s);
  };

  // ── Load history from DB on mount (always) ────────────────────────
  useEffect(() => {
    if (!experimentId) return;

    // Always load from DB — single source of truth
    getExperimentRuns(experimentId, { run_type: "freqai", status: "completed" })
      .then((runs) => {
        if (Array.isArray(runs) && runs.length > 0) {
          const mapped: FreqAIResult[] = runs.map((r, i) => {
            let model = "Unknown";
            let outlier = "none";
            let pca = false;
            let noise = false;
            if (r.raw_output) {
              try {
                const raw = JSON.parse(r.raw_output);
                model = raw.model || model;
                outlier = raw.outlier || outlier;
                pca = raw.pca ?? false;
                noise = raw.noise ?? false;
              } catch { /* ignore */ }
            }
            return {
              id: r.id ?? i + 1,
              model,
              outlier,
              pca,
              noise,
              status: "completed" as const,
              trades: r.total_trades ?? 0,
              winRate: r.win_rate ?? 0,
              profitPct: r.profit_pct ?? 0,
              maxDrawdown: r.max_drawdown ?? 0,
              sharpe: r.sharpe_ratio ?? 0,
              sortino: r.sortino_ratio ?? 0,
              startedAt: r.created_at ?? "",
              finishedAt: "",
              trainingDuration: "",
              featureImportance: [],
              predictionAccuracy: 0,
            };
          });
          setResults(mapped);
          addLog("INFO", `Loaded ${mapped.length} FreqAI results from history`);
        }
      })
      .catch((err) => {
        addLog("WARNING", `Failed to load results: ${err}`);
      });

    // Load hyperopt runs for dropdown
    getExperimentRuns(experimentId, { run_type: "hyperopt", status: "completed" })
      .then((runs) => {
        if (Array.isArray(runs) && runs.length > 0) {
          setHyperoptOptions(
            runs.map((r, i) => ({
              id: r.id ?? i,
              label: `Hyperopt #${r.id ?? i + 1} — ${r.profit_pct != null ? `${r.profit_pct.toFixed(2)}%` : "—"}`,
            }))
          );
        }
      })
      .catch(() => {});

    // Resume: check if FT bot has an active backtest (page was closed mid-run)
    botBacktestResults(botId)
      .then((raw) => {
        const r = raw as unknown as Record<string, unknown>;
        if (r.running === true) {
          addLog("INFO", "Detected active backtest — resuming polling...");
          setIsRunning(true);
          setCurrentRunLabel("Resuming previous run...");
          pollUntilDone().then((result) => {
            if (result) {
              addLog("INFO", "Resumed run completed. Results saved on next fresh matrix run.");
              toast.info("Previous FreqAI run completed. Start a new matrix to continue.");
            }
            setIsRunning(false);
            setCurrentRunLabel("");
          });
        }
      })
      .catch(() => { /* no active backtest — normal */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId, botId, addLog, toast]);

  // ── Build Matrix Queue ────────────────────────────────────────────
  const buildQueue = useCallback((): QueueItem[] => {
    const queue: QueueItem[] = [];
    const trainDays = daysBetween(trainStartDate, trainEndDate);

    for (const model of Array.from(selectedModels)) {
      for (const outlier of Array.from(selectedOutliers)) {
        const pcaValues = pcaEnabled ? [true, false] : [pcaEnabled];
        const noiseValues = noiseEnabled ? [true, false] : [noiseEnabled];
        for (const pca of pcaValues) {
          for (const noise of noiseValues) {
            queue.push({
              model,
              outlier,
              pca,
              noise,
              config: buildFreqAIConfig({
                strategy, model, outlier, pca, noise,
                btStart: backTestStartDate,
                btEnd: backTestEndDate,
                trainDays,
                diThreshold, svmNu, weightFactor, noiseStdDev,
                featurePeriod, labelPeriod, indicatorPeriods,
                bufferTrainData, shuffleAfterSplit, includeCorrPairs,
              }),
            });
          }
        }
      }
    }
    return queue;
  }, [
    strategy, selectedModels, selectedOutliers, pcaEnabled, noiseEnabled,
    trainStartDate, trainEndDate, backTestStartDate, backTestEndDate,
    diThreshold, svmNu, weightFactor, noiseStdDev,
    featurePeriod, labelPeriod, indicatorPeriods,
    bufferTrainData, shuffleAfterSplit, includeCorrPairs,
  ]);

  // ── Poll Until Done ───────────────────────────────────────────────
  const pollUntilDone = useCallback(async (): Promise<Record<string, unknown> | null> => {
    const MAX_POLLS = 600; // 30 minutes max
    for (let i = 0; i < MAX_POLLS; i++) {
      if (abortRef.current) return null;
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const raw = (await botBacktestResults(botId)) as unknown as Record<string, unknown>;
        const running = raw.running as boolean | undefined;
        const step = raw.step as string | undefined;
        const progress = raw.progress as number | undefined;

        if (step) {
          const pct = progress != null ? (progress * 100) : 0;
          setCurrentRunProgress(pct);
          setCurrentRunLabel((prev) => {
            // Preserve the [X/Y] prefix, update the step info
            const prefix = prev.match(/^\[\d+\/\d+\]/);
            return `${prefix ? prefix[0] + ' ' : ''}${step} (${pct.toFixed(0)}%)`;
          });
        }

        if (running === false && step && (step === "finished" || step === "done" || (step === "backtest" && progress === 1))) {
          setCurrentRunProgress(100);
          return raw;
        }
        if (step === "error" || (raw.status as string)?.toLowerCase()?.includes("error")) {
          return raw;
        }
      } catch (err) {
        addLog("WARNING", `Poll error: ${err}`);
      }
    }
    addLog("ERROR", "Polling timed out after 30 minutes");
    return null;
  }, [botId, addLog]);

  // ── Parse Result ──────────────────────────────────────────────────
  const parseResult = useCallback((raw: Record<string, unknown>, item: QueueItem, idx: number): FreqAIResult => {
    const br = raw.backtest_result as Record<string, unknown> | undefined;
    let sd: Record<string, unknown> = {};
    if (br) {
      const stratData = (br.strategy as Record<string, Record<string, unknown>>) ?? br;
      sd = (stratData[strategy] ?? stratData[Object.keys(stratData)[0]] ?? {}) as Record<string, unknown>;
    }

    const tt = Number(sd.total_trades ?? 0);
    const wins = Number(sd.wins ?? 0);
    const losses = Number(sd.losses ?? 0);
    const draws = Number(sd.draws ?? 0);
    const total = wins + losses + draws;
    const wr = total > 0 ? (wins / total) * 100 : 0;
    const pt = Number(sd.profit_total ?? 0) * 100;
    const mdd = Number(sd.max_drawdown_account ?? 0) * 100;
    const sh = Number(sd.sharpe ?? 0);
    const so = Number(sd.sortino ?? 0);

    return {
      id: idx + 1,
      model: item.model,
      outlier: item.outlier,
      pca: item.pca,
      noise: item.noise,
      status: tt > 0 || pt !== 0 ? "completed" : "failed",
      trades: tt,
      winRate: wr,
      profitPct: pt,
      maxDrawdown: mdd,
      sharpe: sh,
      sortino: so,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      trainingDuration: "",
      featureImportance: [],
      predictionAccuracy: 0,
    };
  }, [strategy]);

  // NOTE: localStorage persistence is handled inline in setResults calls (line ~458)
  // to guarantee immediate save. No separate useEffect needed.

  // ── Run Matrix ────────────────────────────────────────────────────
  const handleRunMatrix = useCallback(async () => {
    const queue = buildQueue();
    if (queue.length === 0) {
      toast.error("No combinations to run — select at least one model and outlier");
      return;
    }

    // ── Pre-flight: check bot state ──────────────────────────────────
    try {
      const cfg = (await botConfig(botId)) as unknown as Record<string, unknown>;
      const state = (cfg.state as string || "").toLowerCase();
      const runmode = (cfg.runmode as string || "").toLowerCase();
      if (state === "running" && runmode !== "dry_run") {
        toast.error(`Bot #${botId} is live trading (${runmode}). Stop trading before running FreqAI backtests.`);
        addLog("ERROR", `Cannot start — bot is in ${runmode} mode. Backtests are blocked while live trading.`);
        return;
      }
      if (runmode === "live") {
        toast.error(`Bot #${botId} is in LIVE mode. Cannot run backtests.`);
        addLog("ERROR", "Cannot start — bot is in LIVE mode.");
        return;
      }
      addLog("INFO", `Bot #${botId} state=${state}, runmode=${runmode} — OK to backtest`);
    } catch (err) {
      addLog("WARNING", `Could not verify bot state: ${err}. Proceeding anyway...`);
    }

    // ── Pre-flight: check if a backtest is already running ─────────────
    try {
      const btStatus = (await botBacktestResults(botId)) as unknown as Record<string, unknown>;
      if (btStatus.running === true) {
        toast.error("A backtest is already running on this bot. Wait for it to finish or stop it first.");
        addLog("ERROR", "Cannot start — another backtest is already running.");
        return;
      }
    } catch {
      // No backtest running or endpoint not available — safe to proceed
    }

    setIsRunning(true);
    abortRef.current = false;
    setCompletedCount(0);
    setCurrentRunProgress(0);
    setRunTimes([]);
    addLog("INFO", `Starting FreqAI matrix: ${queue.length} combinations for ${strategy}`);
    toast.info(`Starting ${queue.length} FreqAI runs...`);

    // Save queue to localStorage for resume-on-reopen awareness
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify({ total: queue.length, started: Date.now() })); } catch {}

    const startTime = Date.now();

    for (let i = 0; i < queue.length; i++) {
      if (abortRef.current) {
        addLog("INFO", "Matrix run aborted by user");
        break;
      }

      const item = queue[i];
      const label = `${item.model.replace("Regressor", "Reg").replace("Classifier", "Cls")}+${item.outlier}+PCA${item.pca ? "1" : "0"}+N${item.noise ? "1" : "0"}`;
      setCurrentRunLabel(`[${i + 1}/${queue.length}] ${label} — starting...`);
      setCurrentRunProgress(0);
      runStartRef.current = Date.now();
      addLog("INFO", `[${i + 1}/${queue.length}] Starting: ${label}`);

      try {
        // Start the backtest with FreqAI config
        await botBacktestStart(botId, item.config);
        setCurrentRunLabel(`[${i + 1}/${queue.length}] ${label} — training...`);

        // Poll until done
        const raw = await pollUntilDone();
        if (!raw || abortRef.current) {
          addLog("WARNING", `[${i + 1}] ${label} — aborted or timed out`);
          continue;
        }

        // Parse result
        const result = parseResult(raw, item, i);
        // Track run time for ETA
        const runDuration = Date.now() - runStartRef.current;
        setRunTimes((prev) => [...prev, runDuration]);

        setResults((prev) => {
          const next = [...prev, result];
          try { localStorage.setItem(RESULTS_KEY, JSON.stringify(next)); } catch { /* quota */ }
          return next;
        });
        setCompletedCount(i + 1);

        if (result.status === "completed") {
          addLog("INFO", `[${i + 1}] ${label} — ✓ ${result.trades} trades, ${result.profitPct.toFixed(2)}%, sharpe=${result.sharpe.toFixed(2)}`);

          // Record as experiment run (with raw_output so model/outlier survives reload)
          if (experimentId) {
            createExperimentRun(experimentId, {
              run_type: "freqai",
              total_trades: result.trades,
              win_rate: result.winRate,
              profit_pct: result.profitPct,
              max_drawdown: result.maxDrawdown,
              sharpe_ratio: result.sharpe,
              sortino_ratio: result.sortino,
              raw_output: JSON.stringify({ model: result.model, outlier: result.outlier, pca: result.pca, noise: result.noise }),
            }).catch((err) => addLog("WARNING", `Failed to record run: ${err}`));
          }
        } else {
          addLog("WARNING", `[${i + 1}] ${label} — failed or no trades`);
        }

        // Reset backtest state for next run
        try { await botBacktestDelete(botId); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1000)); // Cool-down

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog("ERROR", `[${i + 1}] ${label} — error: ${msg}`);
        toast.error(`Run ${i + 1} failed: ${msg}`);
        // Try to reset for next run
        try { await botBacktestDelete(botId); } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
    setIsRunning(false);
    setCurrentRunLabel("");
    setCurrentRunProgress(0);
    try { localStorage.removeItem(QUEUE_KEY); } catch {}
    addLog("INFO", `Matrix complete: ${queue.length} runs in ~${elapsed}min`);
    toast.success(`FreqAI matrix complete: ${queue.length} runs in ~${elapsed}min`);
  }, [buildQueue, strategy, botId, experimentId, pollUntilDone, parseResult, addLog, toast, RESULTS_KEY, QUEUE_KEY]);

  // ── Stop Handler ──────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    abortRef.current = true;
    try {
      await botBacktestDelete(botId);
      addLog("INFO", "FreqAI matrix stopped");
      toast.info("FreqAI stopped");
    } catch {
      addLog("WARNING", "Failed to abort backtest");
    }
    setIsRunning(false);
    setCurrentRunLabel("");
  }, [botId, addLog, toast]);

  // ── Promote Handler ───────────────────────────────────────────────
  const handlePromote = useCallback(async () => {
    try {
      const res = await getExperiments();
      const data = (res as unknown as { items?: Array<{ strategy_name: string; name: string; strategy_id: number; best_version_id: number | null }> }).items || [];
      const exp = data.find((e) => e.strategy_name === strategy || e.name?.includes(strategy));
      if (exp && exp.best_version_id) {
        await activateStrategyVersion(exp.strategy_id, exp.best_version_id);
        toast.success(`Activated version for ${strategy} ★`);
      } else {
        toast.info("No version to activate yet — run verification first");
      }
    } catch (err) {
      toast.error(`Promote failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [strategy, toast]);

  // ── Sorted Results ────────────────────────────────────────────────
  const sortedResults = useMemo(() => {
    const copy = [...results.filter((r) => r.status === "completed")];
    copy.sort((a, b) => (sortDir === "desc" ? (b[sortBy] ?? 0) - (a[sortBy] ?? 0) : (a[sortBy] ?? 0) - (b[sortBy] ?? 0)));
    return copy;
  }, [results, sortBy, sortDir]);

  const winner = useMemo(() => (sortedResults.length > 0 ? sortedResults[0] : null), [sortedResults]);

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const SortArrow = ({ col }: { col: SortKey }) =>
    sortBy === col ? <span className="ml-0.5 text-primary">{sortDir === "desc" ? "↓" : "↑"}</span> : null;

  // Suppress unused vars that are used by form but not yet wired to backend
  void reverseTrainTest; void setReverseTrainTest;

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className={LAYOUT_2COL}>
      {/* ── LEFT PANEL ────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* FreqAI Config */}
        <div className={SECTION_CARD}>
          <div className={SECTION_TITLE}>🧠 FreqAI Configuration</div>

          <div className="mb-3">
            <label className={LABEL}>Hyperopt Source</label>
            <select value={selectedHyperopt} onChange={(e) => setSelectedHyperopt(Number(e.target.value))} className={SELECT}>
              <option value="0">No hyperopt — use strategy defaults</option>
              {hyperoptOptions.map((h) => (
                <option key={h.id} value={h.id}>{h.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className={LABEL}>Test Name Prefix</label>
            <input type="text" value={testNamePrefix} onChange={(e) => setTestNamePrefix(e.target.value)} className={INPUT} />
          </div>

          <div className="mb-3">
            <label className={LABEL}>Description (auto)</label>
            <div className="w-full h-[34px] py-0 px-3 bg-muted/50 border border-border rounded-btn text-xs text-muted-foreground flex items-center truncate">
              {selectedModels.size} models × {selectedOutliers.size} outliers × PCA({pcaEnabled ? "on/off" : "off"}) × Noise({noiseEnabled ? "on/off" : "off"}) = {matrixTotal} tests
            </div>
          </div>

          {/* Training Timerange */}
          <div className="mb-3">
            <label className={LABEL}>Training Timerange</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={trainStartDate} onChange={(e) => setTrainStartDate(e.target.value)} className={INPUT} />
              <input type="date" value={trainEndDate} onChange={(e) => setTrainEndDate(e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* Backtest Timerange */}
          <div className="mb-3">
            <label className={LABEL}>Backtest Timerange</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={backTestStartDate} onChange={(e) => setBackTestStartDate(e.target.value)} className={INPUT} />
              <input type="date" value={backTestEndDate} onChange={(e) => setBackTestEndDate(e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* Feature + Label periods */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL}>Feature Period</label>
              <input type="number" value={featurePeriod} onChange={(e) => setFeaturePeriod(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Label Period</label>
              <input type="number" value={labelPeriod} onChange={(e) => setLabelPeriod(e.target.value)} className={INPUT} />
            </div>
          </div>
        </div>

        {/* Matrix Info */}
        <div className="bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] rounded-btn px-3 py-2 text-xs text-primary">
          ℹ️ {selectedModels.size} models × {selectedOutliers.size} outlier × {pcaEnabled ? 2 : 1} PCA × {noiseEnabled ? 2 : 1} noise = <strong>{matrixTotal}</strong> tests
        </div>

        {/* ML Models */}
        <div className={SECTION_CARD}>
          <label className={LABEL}>ML Models ({FREQAI_MODELS.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {FREQAI_MODELS.map((model) => (
              <Tooltip key={model.value} content={model.tip}>
                <button
                  onClick={() => handleToggleModel(model.value)}
                  className={`inline-flex items-center h-[26px] px-2 rounded-btn text-xs font-medium cursor-pointer border transition-all ${
                    selectedModels.has(model.value)
                      ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary"
                      : "bg-muted/50 border-border text-muted-foreground"
                  }`}
                >
                  {model.label.replace("Regressor", "Reg").replace("Classifier", "Cls")}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Outlier Detection */}
        <div className={SECTION_CARD}>
          <label className={LABEL}>Outlier Detection ({OUTLIER_METHODS.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {OUTLIER_METHODS.map((m) => (
              <Tooltip key={m.value} content={m.tip}>
                <button
                  onClick={() => handleToggleOutlier(m.value)}
                  className={`inline-flex items-center h-[26px] px-2 rounded-btn text-xs font-medium cursor-pointer border transition-all ${
                    selectedOutliers.has(m.value)
                      ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary"
                      : "bg-muted/50 border-border text-muted-foreground"
                  }`}
                >
                  {m.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* PCA + Noise toggles */}
        <div className={`${SECTION_CARD} space-y-3`}>
          <Toggle checked={pcaEnabled} onChange={setPcaEnabled} label="PCA (Dimensionality Reduction)" />
          <Toggle checked={noiseEnabled} onChange={setNoiseEnabled} label="Anti-Overfitting (Noise)" />
        </div>

        {/* Advanced Options */}
        <div className={SECTION_CARD}>
          <div className={SECTION_TITLE}>⚡ Advanced Options</div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>DI Threshold <span className="font-normal text-muted-foreground ml-1">{diThreshold.toFixed(1)}</span></label>
              <input type="range" min="0" max="2" step="0.1" value={diThreshold} onChange={(e) => setDiThreshold(Number(e.target.value))} className="w-full accent-accent" />
            </div>
            <div>
              <label className={LABEL}>SVM Nu <span className="font-normal text-muted-foreground ml-1">{svmNu.toFixed(2)}</span></label>
              <input type="range" min="0.01" max="0.5" step="0.01" value={svmNu} onChange={(e) => setSvmNu(Number(e.target.value))} className="w-full accent-accent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>Weight Factor <span className="font-normal text-muted-foreground ml-1">{weightFactor.toFixed(1)}</span></label>
              <input type="range" min="0.1" max="5" step="0.1" value={weightFactor} onChange={(e) => setWeightFactor(Number(e.target.value))} className="w-full accent-accent" />
            </div>
            <div>
              <label className={LABEL}>Noise Std Dev <span className="font-normal text-muted-foreground ml-1">{noiseStdDev.toFixed(2)}</span></label>
              <input type="range" min="0" max="0.5" step="0.01" value={noiseStdDev} onChange={(e) => setNoiseStdDev(Number(e.target.value))} className="w-full accent-accent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>Outlier Protection %</label>
              <input type="number" value={outlierProtectionPct} onChange={(e) => setOutlierProtectionPct(Number(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Buffer Train Data</label>
              <input type="number" value={bufferTrainData} onChange={(e) => setBufferTrainData(Number(e.target.value))} className={INPUT} />
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <Toggle checked={shuffleAfterSplit} onChange={setShuffleAfterSplit} label="Shuffle After Split" />
            <Toggle checked={reverseTrainTest} onChange={setReverseTrainTest} label="Reverse Train/Test" />
            <Toggle checked={includeCorrPairs} onChange={setIncludeCorrPairs} label="Include Corr Pairs" />
          </div>

          <div>
            <label className={LABEL}>Indicator Periods</label>
            <input type="text" value={indicatorPeriods} onChange={(e) => setIndicatorPeriods(e.target.value)} placeholder="10, 20, 50" className={INPUT} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleRunMatrix}
            disabled={isRunning || selectedModels.size === 0}
            className={`flex-1 ${BTN_PRIMARY}`}
          >
            ▶ Run Matrix ({matrixTotal})
          </button>
          {isRunning && (
            <button
              onClick={handleStop}
              className="h-[34px] px-3 rounded-btn text-xs font-medium bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-rose-500 hover:bg-[rgba(239,68,68,0.15)] transition-all"
            >
              ⏹ Stop
            </button>
          )}
        </div>

        {/* Bot Info */}
        <div className={`${SECTION_CARD} !py-2`}>
          <div className="text-xs text-primary font-semibold">Bot #{botId} · FreqAI</div>
          <div className="text-xs text-muted-foreground">~{Math.max(1, Math.round(matrixTotal * 15))}min estimated for {matrixTotal} runs</div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Results + Progress ─────────────────── */}
      <div className="space-y-4">

        {/* Progress Display */}
        {isRunning && (
          <div className="bg-card border border-primary/30 rounded-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                FreqAI Batch: {completedCount}/{matrixTotal} completed
              </span>
              {runTimes.length > 0 && (() => {
                const avgMs = runTimes.reduce((a, b) => a + b, 0) / runTimes.length;
                const remainingRuns = matrixTotal - completedCount;
                const etaMin = Math.round((avgMs * remainingRuns) / 60000);
                return <span className="text-[10px] text-muted-foreground">ETA ~{etaMin}min</span>;
              })()}
            </div>
            {/* Batch progress */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-500"
                style={{ width: `${matrixTotal > 0 ? (completedCount / matrixTotal) * 100 : 0}%` }}
              />
            </div>
            {/* Current run progress */}
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${currentRunProgress}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-primary font-medium w-8 text-right">{currentRunProgress.toFixed(0)}%</span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {currentRunLabel}
            </div>
          </div>
        )}

        {/* Winner Banner */}
        {winner && !isRunning && (
          <div className="bg-[rgba(34,197,94,0.06)] border border-emerald-500/20 rounded-card p-4 flex items-center gap-4">
            <span className="text-2xl">🏆</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-emerald-400 mb-0.5">Best FreqAI Result</div>
              <div className="text-xs text-muted-foreground">
                {winner.model} + {winner.outlier} + PCA {winner.pca ? "On" : "Off"} + Noise {winner.noise ? "On" : "Off"}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${winner.profitPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {winner.profitPct >= 0 ? "+" : ""}{winner.profitPct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-muted-foreground">
                Sharpe {winner.sharpe.toFixed(2)} · WR {winner.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => onNavigateToTab?.(5)} className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all">→ Verify</button>
              <button onClick={handlePromote} className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-all">Promote ★</button>
            </div>
          </div>
        )}

        {/* Config Summary + Metric Cards (matches Hyperopt/Backtest layout) */}
        {winner && !isRunning && (() => {
          const profitOk = winner.profitPct >= 0;
          const MC = ({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) => {
            const valColor = positive === true ? "text-emerald-400" : positive === false ? "text-rose-400" : "text-foreground";
            return (
              <div className={METRIC_CARD}>
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
                <div className={`text-sm font-bold tabular-nums ${valColor}`}>{value}</div>
                {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
              </div>
            );
          };
          return (
            <>
              {/* Config Summary Bar */}
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
                  <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Model</div>
                  <div className="text-foreground font-mono truncate">{winner.model}</div>
                </div>
                <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
                  <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Outlier</div>
                  <div className="text-foreground font-mono truncate">{winner.outlier}</div>
                </div>
                <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
                  <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">PCA</div>
                  <div className="text-foreground font-mono">{winner.pca ? "Enabled" : "Disabled"}</div>
                </div>
                <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
                  <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Noise Filter</div>
                  <div className="text-foreground font-mono">{winner.noise ? "Enabled" : "Disabled"}</div>
                </div>
              </div>

              {/* Core Metrics (6-grid — same as BacktestTab Row 1) */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <MC label="Total Trades" value={String(winner.trades)} />
                <MC label="Win Rate" value={`${winner.winRate.toFixed(1)}%`} positive={winner.winRate > 60 ? true : winner.winRate < 40 ? false : null} />
                <MC label="Total Profit" value={`${profitOk ? '+' : ''}${winner.profitPct.toFixed(2)}%`} positive={profitOk} />
                <MC label="Max Drawdown" value={`-${Math.abs(winner.maxDrawdown).toFixed(2)}%`} positive={false} />
                <MC label="Sharpe" value={winner.sharpe.toFixed(2)} positive={winner.sharpe > 1 ? true : winner.sharpe < 0 ? false : null} />
                <MC label="Sortino" value={winner.sortino.toFixed(2)} positive={winner.sortino > 1 ? true : winner.sortino < 0 ? false : null} />
              </div>
            </>
          );
        })()}

        {/* Results Master Table */}
        {sortedResults.length > 0 ? (
          <div className="bg-card border border-border rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">FreqAI Results ({sortedResults.length})</span>
              <button onClick={() => { setResults([]); try { localStorage.removeItem(RESULTS_KEY); } catch {} toast.info("Results cleared"); }} className="text-[10px] text-muted-foreground hover:text-rose-400 transition">Clear All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">#</th>
                    <th className="text-left px-3 py-2 font-semibold">Model</th>
                    <th className="text-left px-3 py-2 font-semibold">Outlier</th>
                    <th className="text-center px-3 py-2 font-semibold">PCA</th>
                    <th className="text-center px-3 py-2 font-semibold">Noise</th>
                    <th onClick={() => handleSort("trades")} className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-foreground">Trades<SortArrow col="trades" /></th>
                    <th onClick={() => handleSort("winRate")} className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-foreground">Win Rate<SortArrow col="winRate" /></th>
                    <th onClick={() => handleSort("profitPct")} className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-foreground">Profit%<SortArrow col="profitPct" /></th>
                    <th onClick={() => handleSort("maxDrawdown")} className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-foreground">Max DD<SortArrow col="maxDrawdown" /></th>
                    <th onClick={() => handleSort("sharpe")} className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-foreground">Sharpe<SortArrow col="sharpe" /></th>
                    <th onClick={() => handleSort("sortino")} className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-foreground">Sortino<SortArrow col="sortino" /></th>
                    <th className="text-right px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r, idx) => (
                    <tr key={r.id} className={`border-t border-border hover:bg-muted/20 ${idx === 0 ? "bg-emerald-500/5" : ""}`}>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{idx === 0 ? "★" : ""}{r.id}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{r.model.replace("Regressor", "Reg").replace("Classifier", "Cls")}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.outlier}</td>
                      <td className="px-3 py-2 text-center">{r.pca ? <span className="text-emerald-400">On</span> : <span className="text-muted-foreground">Off</span>}</td>
                      <td className="px-3 py-2 text-center">{r.noise ? <span className="text-amber-400">On</span> : <span className="text-muted-foreground">Off</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.trades}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.winRate.toFixed(1)}%</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.profitPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {r.profitPct >= 0 ? "+" : ""}{r.profitPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-400">{r.maxDrawdown.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.sharpe.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.sortino.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => onNavigateToTab?.(5)} className="px-1.5 py-0.5 text-[9px] border border-primary/30 text-primary rounded hover:bg-primary/10 transition">→ Verify</button>
                          <button onClick={handlePromote} className="px-1.5 py-0.5 text-[9px] border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/10 transition">Promote</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={`${SECTION_CARD} flex flex-col items-center justify-center min-h-[400px]`}>
            <div className="text-[32px] mb-3 opacity-30">🧠</div>
            <div className="text-sm font-semibold text-muted-foreground mb-1">No FreqAI results yet</div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              Configure your ML models and click &quot;Run Matrix&quot; to start FreqAI training backtests through the bot API.
            </div>
          </div>
        )}

        {/* Log Panel */}
        {logs.length > 0 && (
          <div className="bg-card border border-border rounded-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Logs ({logs.length})</span>
              <button onClick={() => setLogs([])} className="text-[10px] text-muted-foreground hover:text-foreground transition">Clear</button>
            </div>
            <div className="max-h-[200px] overflow-y-auto p-2 font-mono text-[10px] space-y-0.5">
              {logs.map((l, i) => (
                <div key={i} className={`${l.level === "ERROR" ? "text-rose-400" : l.level === "WARNING" ? "text-amber-400" : "text-muted-foreground"}`}>
                  <span className="text-zinc-600">{l.ts}</span> [{l.level}] {l.msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
