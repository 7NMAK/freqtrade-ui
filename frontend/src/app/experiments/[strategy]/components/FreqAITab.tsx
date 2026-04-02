"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  botBacktestStart,
  botBacktestResults,
  botLogs,
  createExperimentRun,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ── Local Toggle ────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <div className={`builder-toggle ${on ? 'on' : ''}`} onClick={onToggle}><div className="dot" /></div>;
}

// ── Types ────────────────────────────────────────────────────────────
interface MatrixRow {
  rank: number;
  model: string;
  outlier: string;
  pca: boolean;
  noise: boolean;
  profitPct: number;
  sharpe: number;
  maxDD: number;
  trades: number;
  winPct: number;
}

interface LogEntry { ts: string; level: string; msg: string; }

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
interface FreqAITabProps {
  strategy?: string;
  botId?: number;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

export default function FreqAITab({ strategy: propStrategy, botId = 2, experimentId, onNavigateToTab }: FreqAITabProps) {
  const toast = useToast();

  // ── Form State ──────────────────────────────────────────────────
  const [sourceHO, setSourceHO] = useState("ho147");
  const [trainStart, setTrainStart] = useState("2022-01-01");
  const [trainEnd, setTrainEnd] = useState("2023-06-30");
  const [btStart, setBtStart] = useState("2023-07-01");
  const [btEnd, setBtEnd] = useState("2024-01-01");
  const [featurePeriod, setFeaturePeriod] = useState(20);
  const [labelPeriod, setLabelPeriod] = useState(24);

  // ML Models
  const [lgbmRegressor, setLgbmRegressor] = useState(true);
  const [xgbRegressor, setXgbRegressor] = useState(true);
  const [catRegressor, setCatRegressor] = useState(false);
  const [lgbmClassifier, setLgbmClassifier] = useState(false);

  // Outlier Detection
  const [outlierMethod, setOutlierMethod] = useState("DI");
  const [diThreshold, setDiThreshold] = useState("0.9");
  const [usePCA, setUsePCA] = useState(false);
  const [addNoise, setAddNoise] = useState(true);
  const [corrPairs, setCorrPairs] = useState(true);

  // Derived
  const modelCount = [lgbmRegressor, xgbRegressor, catRegressor, lgbmClassifier].filter(Boolean).length;
  const outlierCount = outlierMethod !== "None" ? 1 : 1;
  const pcaMultiplier = 2; // always test on/off
  const noiseMultiplier = 2; // always test on/off
  const totalTests = modelCount * outlierCount * pcaMultiplier * noiseMultiplier;

  // ── API / Job state ──────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [matrixResults, setMatrixResults] = useState<MatrixRow[]>([]);
  const [bestResult, setBestResult] = useState<MatrixRow | null>(null);
  const [completedRuns, setCompletedRuns] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────
  const addLog = useCallback((level: string, msg: string) => {
    setLogs((prev) => {
      const next = [...prev, { ts: new Date().toLocaleTimeString(), level, msg }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── Extract FreqAI matrix from backtest result ────────────────────
  const extractMatrixFromResult = useCallback((data: Record<string, unknown>) => {
    const strategyMap = data.strategy as Record<string, Record<string, unknown>> | undefined;
    if (!strategyMap) return;
    const results: MatrixRow[] = [];
    let rank = 1;
    for (const [, raw] of Object.entries(strategyMap)) {
      const profitPct = Number(raw.profit_total ?? 0) * 100;
      const sharpe = Number(raw.sharpe ?? raw.sharpe_ratio ?? 0);
      const maxDD = -Number(raw.max_drawdown_account ?? 0) * 100;
      const trades = Number(raw.total_trades ?? 0);
      const wins = Number(raw.wins ?? 0);
      const winPct = trades > 0 ? (wins / trades) * 100 : 0;
      // Try to infer model/outlier/pca/noise from strategy name or metadata
      const name = String(raw.strategy_name ?? "");
      results.push({
        rank: rank++,
        model: name || `Run ${rank - 1}`,
        outlier: outlierMethod,
        pca: usePCA,
        noise: addNoise,
        profitPct,
        sharpe,
        maxDD,
        trades,
        winPct,
      });
    }
    // Sort by profit descending, re-rank
    results.sort((a, b) => b.profitPct - a.profitPct);
    results.forEach((r, i) => { r.rank = i + 1; });
    setMatrixResults(results);
    if (results.length > 0) setBestResult(results[0]);
  }, [outlierMethod, usePCA, addNoise]);

  // ── Poll backtest results for FreqAI ──────────────────────────────
  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        // Poll logs
        try {
          const logRes = await botLogs(botId, 20);
          const logArr = (logRes as unknown as { logs?: string[] }).logs || [];
          if (logArr.length > 0) {
            const lastLine = logArr[logArr.length - 1];
            if (lastLine) addLog("INFO", lastLine);
          }
        } catch { /* logs not critical */ }

        // Poll backtest status
        const btStatus = await botBacktestResults(botId);
        const r = btStatus as unknown as Record<string, unknown>;

        if (r.running === true) {
          const pct = Number(r.progress ?? 0);
          if (pct > 0) setCompletedRuns(Math.floor(pct * totalTests));
        } else if (r.running === false && r.strategy) {
          // Completed
          stopPolling();
          setIsRunning(false);
          extractMatrixFromResult(r);
          addLog("INFO", "✓ FreqAI matrix complete");
          toast.success("FreqAI matrix complete");
          setCompletedRuns(totalTests);

          // Record experiment run
          if (experimentId && matrixResults.length > 0) {
            const best = matrixResults[0];
            try {
              await createExperimentRun(experimentId, {
                run_type: "freqai",
                status: "completed",
                total_trades: best.trades,
                win_rate: best.winPct / 100,
                profit_pct: best.profitPct,
                max_drawdown: Math.abs(best.maxDD) / 100,
                sharpe_ratio: best.sharpe,
              });
              addLog("INFO", "Recorded experiment run");
            } catch { /* not critical */ }
          }
        }
      } catch (err) {
        addLog("WARNING", `Poll error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 5000);
  }, [botId, stopPolling, addLog, toast, totalTests, extractMatrixFromResult, experimentId, matrixResults]);

  // ── Start Matrix ──────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setMatrixResults([]);
    setBestResult(null);
    setCompletedRuns(0);

    const models: string[] = [];
    if (lgbmRegressor) models.push("LightGBMRegressor");
    if (xgbRegressor) models.push("XGBoostRegressor");
    if (catRegressor) models.push("CatboostRegressor");
    if (lgbmClassifier) models.push("LightGBMClassifier");

    const timerange = `${trainStart.replace(/-/g, "")}-${btEnd.replace(/-/g, "")}`;

    addLog("INFO", `FreqAI matrix started — ${totalTests} runs queued`);
    addLog("INFO", `Models: [${models.join(", ")}]`);
    addLog("INFO", `Outlier: ${outlierMethod}, PCA: ${usePCA ? "On" : "Off"}, Noise: ${addNoise ? "Yes" : "No"}`);

    try {
      const params: Record<string, unknown> = {
        strategy: propStrategy,
        timerange,
        freqai: true,
        freqai_models: models,
        freqai_outlier: outlierMethod,
        freqai_pca: usePCA,
        freqai_noise: addNoise,
        freqai_feature_period: featurePeriod,
        freqai_label_period: labelPeriod,
        freqai_di_threshold: parseFloat(diThreshold),
        freqai_corr_pairs: corrPairs,
      };

      await botBacktestStart(botId, params);
      addLog("INFO", "Job started — polling for results...");
      startPolling();
    } catch (err) {
      setIsRunning(false);
      const msg = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Start failed: ${msg}`);
      toast.error(`Start failed: ${msg}`);
    }
  }, [isRunning, propStrategy, trainStart, btEnd, totalTests, lgbmRegressor, xgbRegressor, catRegressor, lgbmClassifier, outlierMethod, usePCA, addNoise, featurePeriod, labelPeriod, diThreshold, corrPairs, botId, addLog, toast, startPolling]);

  // ── Stop ──────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    stopPolling();
    setIsRunning(false);
    addLog("INFO", "FreqAI matrix stopped by user");
    toast.success("FreqAI stopped");
  }, [stopPolling, addLog, toast]);

  // ── Reset ─────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSourceHO("ho147");
    setTrainStart("2022-01-01");
    setTrainEnd("2023-06-30");
    setBtStart("2023-07-01");
    setBtEnd("2024-01-01");
    setFeaturePeriod(20);
    setLabelPeriod(24);
    setLgbmRegressor(true);
    setXgbRegressor(true);
    setCatRegressor(false);
    setLgbmClassifier(false);
    setOutlierMethod("DI");
    setDiThreshold("0.9");
    setUsePCA(false);
    setAddNoise(true);
    setCorrPairs(true);
    setMatrixResults([]);
    setBestResult(null);
    setLogs([]);
    setCompletedRuns(0);
    toast.success("Configuration reset");
  }, [toast]);

  // ── Deploy Best ───────────────────────────────────────────────────
  const handleDeploy = useCallback(() => {
    if (!bestResult) return;
    toast.success(`Deploy: ${bestResult.model} — use activateStrategyVersion to write params`);
    if (onNavigateToTab) onNavigateToTab(5); // Go to validation
  }, [bestResult, toast, onNavigateToTab]);

  // Cleanup
  useEffect(() => { return () => { stopPolling(); }; }, [stopPolling]);

  // Progress
  const progressPct = totalTests > 0 ? Math.round((completedRuns / totalTests) * 100) : 0;
  const progressLabel = isRunning
    ? `${completedRuns}/${totalTests} runs`
    : matrixResults.length > 0
      ? `Complete — ${matrixResults.length} runs`
      : "Idle";

  return (
    <div className="h-full flex flex-row gap-3">
      {/* ══════════ LEFT PANEL — CONFIG ══════════ */}
      <div className="w-[400px] flex flex-col gap-0 bg-surface l-bd rounded-md shadow-xl shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">FreqAI Configuration</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto">
          {/* 1. Source HO Epoch */}
          <div>
            <label className="builder-label">Source HO Epoch</label>
            <select className="builder-select w-full" value={sourceHO} onChange={(e) => setSourceHO(e.target.value)}>
              <option value="ho147">HO #147 — Sharpe — +42.12%</option>
              <option value="ho92">HO #92 — Sortino — +38.40%</option>
            </select>
          </div>

          {/* 2. Training Period */}
          <div>
            <label className="builder-label">Training Period</label>
            <div className="flex gap-2">
              <input type="date" className="builder-input" value={trainStart} onChange={(e) => setTrainStart(e.target.value)} />
              <input type="date" className="builder-input" value={trainEnd} onChange={(e) => setTrainEnd(e.target.value)} />
            </div>
          </div>

          {/* 3. Backtest Period */}
          <div>
            <label className="builder-label">Backtest Period</label>
            <div className="flex gap-2">
              <input type="date" className="builder-input" value={btStart} onChange={(e) => setBtStart(e.target.value)} />
              <input type="date" className="builder-input" value={btEnd} onChange={(e) => setBtEnd(e.target.value)} />
            </div>
          </div>

          {/* 4. Periods */}
          <div>
            <label className="builder-label">Periods</label>
            <div className="flex gap-2">
              <input type="number" className="builder-input" value={featurePeriod} onChange={(e) => setFeaturePeriod(Number(e.target.value))} />
              <input type="number" className="builder-input" value={labelPeriod} onChange={(e) => setLabelPeriod(Number(e.target.value))} />
            </div>
          </div>

          {/* 5. ML Models */}
          <div className="l-t pt-3">
            <label className="builder-label">ML Models</label>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">LightGBM-Regressor</span>
                <Toggle on={lgbmRegressor} onToggle={() => setLgbmRegressor(!lgbmRegressor)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">XGBoost-Regressor</span>
                <Toggle on={xgbRegressor} onToggle={() => setXgbRegressor(!xgbRegressor)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">CatBoost-Regressor</span>
                <Toggle on={catRegressor} onToggle={() => setCatRegressor(!catRegressor)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">LightGBM-Classifier</span>
                <Toggle on={lgbmClassifier} onToggle={() => setLgbmClassifier(!lgbmClassifier)} />
              </div>
            </div>
          </div>

          {/* 6. Outlier Detection */}
          <div className="l-t pt-3">
            <label className="builder-label">Outlier Detection</label>
            <div className="flex gap-2 mb-2">
              <select className="builder-select" value={outlierMethod} onChange={(e) => setOutlierMethod(e.target.value)}>
                <option value="DI">DI</option>
                <option value="SVM">SVM</option>
                <option value="None">None</option>
              </select>
              <input type="number" className="builder-input" value={diThreshold} step="0.1" onChange={(e) => setDiThreshold(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2.5 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">Use PCA</span>
                <Toggle on={usePCA} onToggle={() => setUsePCA(!usePCA)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">Add Noise</span>
                <Toggle on={addNoise} onToggle={() => setAddNoise(!addNoise)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">Correlated Pairs</span>
                <Toggle on={corrPairs} onToggle={() => setCorrPairs(!corrPairs)} />
              </div>
            </div>
          </div>

          {/* 7. Matrix Calculation */}
          <div className="l-t pt-3">
            <div className="mt-1 builder-card space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-1.5 py-0.5 bg-[#60a5fa]/10 border border-[#60a5fa]/25 rounded text-[10px]"><span className="text-[#60a5fa]">ℹ</span></span>
                <span className="text-[#60a5fa]">
                  <span className="text-white font-bold">{modelCount}</span> models × <span className="text-white font-bold">{outlierCount}</span> outlier × <span className="text-white font-bold">{pcaMultiplier}</span> PCA × <span className="text-white font-bold">{noiseMultiplier}</span> noise = <span className="text-up font-bold">{totalTests} tests</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Est. Time</span>
                <span className="text-white">~{Math.ceil(totalTests * 15 / 60)}h {(totalTests * 15) % 60}m</span>
              </div>
            </div>
          </div>

          {/* 8. Run Buttons */}
          <div className="flex gap-1.5 l-t pt-3">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up disabled:opacity-40"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', color: '#22c55e' }}
              title="Start FreqAI matrix run"
            >
              ▶ Run Matrix ({totalTests})
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5F5F5' }}
              title="Stop running"
            >
              ⏹ Stop
            </button>
            <button
              onClick={handleReset}
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5F5F5' }}
              title="Reset configuration to defaults"
            >
              ↺ Reset
            </button>
          </div>

          {/* 9. Progress */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-muted">Progress</span>
              <span className="text-white">{progressLabel}</span>
            </div>
            <div className="mt-1.5 w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-up rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* 10. Terminal Output */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted uppercase tracking-widest font-bold">Terminal</span>
              <button onClick={() => setLogs([])} className="text-[9px] text-muted hover:text-white transition-colors">Clear</button>
            </div>
            <div className="bg-black/60 rounded-md l-bd p-2 max-h-[200px] overflow-y-auto font-mono text-[10px] leading-[1.7] space-y-px">
              {logs.length === 0 && (
                <div className="text-muted">Waiting for FreqAI matrix to start...</div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted shrink-0">{log.ts}</span>
                  <span className={
                    log.msg.includes("Best:") ? "text-up font-bold" :
                    log.msg.includes("✓") || log.msg.includes("complete") ? "text-up" :
                    log.level === "ERROR" ? "text-down" :
                    "text-muted"
                  }>{log.msg}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT PANEL — RESULTS ══════════ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">
        {/* 1. Winner Banner */}
        <div className="bg-up/[0.04] border border-up/15 rounded-md p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-[13px]">
                {bestResult ? `★ ${bestResult.model} · ${bestResult.outlier} · ${bestResult.pca ? "PCA" : "No PCA"} · ${bestResult.noise ? "Noise" : "No Noise"}` : "★ No results yet"}
              </span>
              {bestResult && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded border border-up/25">★ BEST</span>
              )}
            </div>
            {bestResult && (
              <button
                onClick={handleDeploy}
                className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', color: '#22c55e' }}
                title="Deploy to live"
              >
                Deploy
              </button>
            )}
          </div>
          <div className="grid grid-cols-7 gap-2">
            <div><div className="kpi-label">Profit</div><div className="kpi-value text-up font-bold">{bestResult ? `+${bestResult.profitPct.toFixed(1)}%` : "—"}</div></div>
            <div><div className="kpi-label">Profit $</div><div className="kpi-value text-up font-bold">{bestResult ? `+$${(bestResult.profitPct * 100).toLocaleString()}` : "—"}</div></div>
            <div><div className="kpi-label">Trades</div><div className="kpi-value text-white">{bestResult?.trades ?? "—"}</div></div>
            <div><div className="kpi-label">Win Rate</div><div className="kpi-value text-up">{bestResult ? `${bestResult.winPct.toFixed(1)}%` : "—"}</div></div>
            <div><div className="kpi-label">Sharpe</div><div className="kpi-value text-white">{bestResult ? bestResult.sharpe.toFixed(2) : "—"}</div></div>
            <div><div className="kpi-label">Max DD</div><div className="kpi-value text-down font-bold">{bestResult ? `${bestResult.maxDD.toFixed(1)}%` : "—"}</div></div>
            <div><div className="kpi-label">Avg Dur.</div><div className="kpi-value text-muted">—</div></div>
          </div>
        </div>

        {/* 2. Matrix Results */}
        <h3 className="section-title">Matrix Results</h3>
        <div className="overflow-x-auto">
          {matrixResults.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-[11px] text-white/20">
              {isRunning ? "Running FreqAI matrix..." : "Run FreqAI matrix to see results"}
            </div>
          ) : (
          <table className="w-full text-[13px] font-mono whitespace-nowrap">
            <thead>
              <tr className="text-muted text-[11px] uppercase tracking-widest">
                <th className="sortable sort-desc px-2 py-1.5 text-left sticky top-0 bg-surface z-10">★</th>
                <th className="sortable filterable px-2 py-1.5 text-left sticky top-0 bg-surface z-10">Model</th>
                <th className="sortable filterable px-2 py-1.5 text-left sticky top-0 bg-surface z-10">Outlier</th>
                <th className="sortable filterable px-2 py-1.5 text-left sticky top-0 bg-surface z-10">PCA</th>
                <th className="sortable filterable px-2 py-1.5 text-left sticky top-0 bg-surface z-10">Noise</th>
                <th className="sortable sort-desc px-2 py-1.5 text-right sticky top-0 bg-surface z-10">profit_%</th>
                <th className="sortable px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Sharpe</th>
                <th className="sortable px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Max DD</th>
                <th className="sortable px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Trades</th>
                <th className="sortable px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Win%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {matrixResults.map((row) => (
                <tr key={row.rank} className={`hover:bg-white/[0.04] ${row.rank === 1 ? 'bg-up/[0.02]' : ''}`}>
                  <td className={`px-2 py-1.5 ${row.rank === 1 ? 'text-up font-bold' : 'text-muted'}`}>
                    {row.rank === 1 ? '★1' : row.rank}
                  </td>
                  <td className="px-2 py-1.5">{row.model}</td>
                  <td className="px-2 py-1.5 text-muted">{row.outlier}</td>
                  <td className={`px-2 py-1.5 ${row.pca ? 'text-up' : 'text-muted'}`}>{row.pca ? 'On' : 'Off'}</td>
                  <td className={`px-2 py-1.5 ${row.noise ? 'text-up' : 'text-muted'}`}>{row.noise ? 'Yes' : 'No'}</td>
                  <td className={`px-2 py-1.5 text-right ${row.profitPct >= 0 ? 'text-up font-bold' : 'text-down font-bold'}`}>{row.profitPct >= 0 ? '+' : ''}{row.profitPct.toFixed(1)}%</td>
                  <td className={`px-2 py-1.5 text-right ${row.sharpe < 0 ? 'text-down' : ''}`}>{row.sharpe.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right text-down">{row.maxDD.toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right">{row.trades}</td>
                  <td className="px-2 py-1.5 text-right">{row.winPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
