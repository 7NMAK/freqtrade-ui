"use client";

import { useState } from "react";

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

// ── Mock Data ────────────────────────────────────────────────────────
const MOCK_MATRIX: MatrixRow[] = [
  { rank: 1, model: "LightGBM-R", outlier: "DI",  pca: false, noise: true,  profitPct: 52.4,  sharpe: 4.12, maxDD: -1.8,  trades: 156, winPct: 74.2 },
  { rank: 2, model: "XGBoost-R",  outlier: "DI",  pca: false, noise: true,  profitPct: 48.1,  sharpe: 3.84, maxDD: -2.1,  trades: 149, winPct: 71.8 },
  { rank: 3, model: "LightGBM-R", outlier: "DI",  pca: true,  noise: true,  profitPct: 44.6,  sharpe: 3.52, maxDD: -2.4,  trades: 138, winPct: 69.5 },
  { rank: 4, model: "XGBoost-R",  outlier: "DI",  pca: true,  noise: true,  profitPct: 41.2,  sharpe: 3.21, maxDD: -2.7,  trades: 132, winPct: 67.1 },
  { rank: 5, model: "LightGBM-R", outlier: "DI",  pca: false, noise: false, profitPct: 38.9,  sharpe: 2.98, maxDD: -3.1,  trades: 145, winPct: 65.3 },
  { rank: 6, model: "XGBoost-R",  outlier: "DI",  pca: false, noise: false, profitPct: 35.2,  sharpe: 2.64, maxDD: -3.5,  trades: 141, winPct: 63.8 },
  { rank: 7, model: "LightGBM-R", outlier: "DI",  pca: true,  noise: false, profitPct: 28.7,  sharpe: 2.11, maxDD: -4.2,  trades: 127, winPct: 60.2 },
  { rank: 8, model: "XGBoost-R",  outlier: "DI",  pca: true,  noise: false, profitPct: 22.4,  sharpe: 1.78, maxDD: -5.1,  trades: 119, winPct: 57.6 },
];

const MOCK_LOGS = [
  { ts: "14:32:01", level: "INFO", msg: "FreqAI matrix started — 8 runs queued" },
  { ts: "14:32:02", level: "INFO", msg: "[1/8] LightGBM-R · DI · No PCA · Noise — training..." },
  { ts: "14:47:18", level: "INFO", msg: "[1/8] Training complete — 156 trades, +52.4%, sharpe=4.12" },
  { ts: "14:47:19", level: "INFO", msg: "[2/8] XGBoost-R · DI · No PCA · Noise — training..." },
  { ts: "15:01:42", level: "INFO", msg: "[2/8] Training complete — 149 trades, +48.1%, sharpe=3.84" },
  { ts: "15:01:43", level: "INFO", msg: "[3/8] LightGBM-R · DI · PCA · Noise — training..." },
  { ts: "15:14:55", level: "INFO", msg: "[3/8] Training complete — 138 trades, +44.6%, sharpe=3.52" },
  { ts: "15:14:56", level: "INFO", msg: "[4/8] XGBoost-R · DI · PCA · Noise — training..." },
  { ts: "16:44:12", level: "INFO", msg: "[8/8] Training complete — 119 trades, +22.4%, sharpe=1.78" },
  { ts: "16:44:13", level: "INFO", msg: "Matrix complete: 8 runs in ~2h 12m" },
  { ts: "16:44:14", level: "INFO", msg: "Best: LightGBM-R · DI · No PCA · Noise — +52.4%, sharpe=4.12" },
];

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
interface FreqAITabProps {
  strategy?: string;
  botId?: number;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function FreqAITab(_props: FreqAITabProps) {
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
  const pcaMultiplier = usePCA ? 2 : 2; // always test on/off
  const noiseMultiplier = addNoise ? 2 : 2; // always test on/off
  const totalTests = modelCount * outlierCount * pcaMultiplier * noiseMultiplier;

  // Suppress lint
  void sourceHO; void trainStart; void trainEnd; void btStart; void btEnd;
  void featurePeriod; void labelPeriod; void outlierMethod; void diThreshold;

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
                <span className="text-white">~2h 15m</span>
              </div>
            </div>
          </div>

          {/* 8. Run Buttons */}
          <div className="flex gap-1.5 l-t pt-3">
            <button
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', color: '#22c55e' }}
              title="Start FreqAI matrix run"
            >
              ▶ Run Matrix ({totalTests})
            </button>
            <button
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5F5F5' }}
              title="Stop running"
            >
              ⏹ Stop
            </button>
            <button
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
              <span className="text-white">4/8 runs</span>
            </div>
            <div className="mt-1.5 w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-up rounded-full transition-all" style={{ width: '50%' }} />
            </div>
          </div>

          {/* 10. Terminal Output */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted uppercase tracking-widest font-bold">Terminal</span>
              <button className="text-[9px] text-muted hover:text-white transition-colors">Clear</button>
            </div>
            <div className="bg-black/60 rounded-md l-bd p-2 max-h-[200px] overflow-y-auto font-mono text-[10px] leading-[1.7] space-y-px">
              {MOCK_LOGS.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted shrink-0">{log.ts}</span>
                  <span className={
                    log.msg.includes("Best:") ? "text-up font-bold" :
                    log.msg.includes("complete") || log.msg.includes("+") ? "text-up" :
                    "text-muted"
                  }>{log.msg}</span>
                </div>
              ))}
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
              <span className="text-white font-bold text-[13px]">★ LightGBM-R · DI · No PCA · Noise</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded border border-up/25">★ BEST</span>
            </div>
            <button
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', color: '#22c55e' }}
              title="Deploy to live"
            >
              Deploy
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            <div><div className="kpi-label">Profit</div><div className="kpi-value text-up font-bold">+52.4%</div></div>
            <div><div className="kpi-label">Profit $</div><div className="kpi-value text-up font-bold">+$5,240</div></div>
            <div><div className="kpi-label">Trades</div><div className="kpi-value text-white">156</div></div>
            <div><div className="kpi-label">Win Rate</div><div className="kpi-value text-up">74.2%</div></div>
            <div><div className="kpi-label">Sharpe</div><div className="kpi-value text-white">4.12</div></div>
            <div><div className="kpi-label">Max DD</div><div className="kpi-value text-down font-bold">-1.8%</div></div>
            <div><div className="kpi-label">Avg Dur.</div><div className="kpi-value text-muted">3h 45m</div></div>
          </div>
        </div>

        {/* 2. Matrix Results */}
        <h3 className="section-title">Matrix Results</h3>
        <div className="overflow-x-auto">
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
              {MOCK_MATRIX.map((row) => (
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
        </div>
      </div>
    </div>
  );
}
