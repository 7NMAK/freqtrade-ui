"use client";

import { useState, useMemo } from "react";
import { FREQAI_MODELS, OUTLIER_METHODS, fmtPct, profitColor } from "@/lib/experiments";

interface FreqAITabProps {
  strategy: string;
}

interface FreqAIResult {
  id: string;
  model: string;
  outlier: string;
  pcaEnabled: boolean;
  noiseEnabled: boolean;
  trades: number;
  winRate: number;
  profitPct: number;
  maxDD: number;
  sharpe: number;
  sortino: number;
  accuracy: number;
  started: string;
  finished: string;
  duration: string;
  topFeatures: Array<{ name: string; importance: number }>;
}

// ── Design System ────────────────────────────────────────────────────────
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// ── Toggle switch ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-text-1">{label}</span>
      <label className="relative w-[36px] h-[20px] cursor-pointer inline-block flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`absolute inset-0 rounded-[10px] border transition-all ${checked ? "bg-[rgba(34,197,94,0.08)] border-green" : "bg-bg-3 border-border"}`} />
        <span className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
      </label>
    </div>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────

const HYPEROPT_OPTIONS = [
  { label: "CmaEs · SortinoDaily · +15.2% (best)", sampler: "CmaEs", loss: "SortinoDaily", space: "Signals Only", profitPct: 15.2 },
  { label: "TPE · Sharpe · +12.8%", sampler: "TPE", loss: "Sharpe", space: "Signals+Risk", profitPct: 12.8 },
  { label: "GPS · SharpeDaily · +11.5%", sampler: "GPS", loss: "SharpeDaily", space: "Full", profitPct: 11.5 },
];

const MOCK_RESULTS: FreqAIResult[] = Array.from({ length: 128 }, (_, i) => ({
  id: `result-${i}`,
  model: FREQAI_MODELS[i % FREQAI_MODELS.length].label,
  outlier: OUTLIER_METHODS[Math.floor(i / FREQAI_MODELS.length) % OUTLIER_METHODS.length].label,
  pcaEnabled: Math.floor((i / (FREQAI_MODELS.length * OUTLIER_METHODS.length)) % 2) === 0,
  noiseEnabled: (i % 2) === 0,
  trades: Math.floor(Math.random() * 150) + 20,
  winRate: Math.random() * 65 + 35,
  profitPct: Math.random() * 40 - 5,
  maxDD: Math.random() * 20 + 5,
  sharpe: Math.random() * 2 + 0.5,
  sortino: Math.random() * 3 + 1,
  accuracy: Math.random() * 60 + 40,
  started: new Date(Date.now() - Math.random() * 86400000).toISOString(),
  finished: new Date(Date.now() - Math.random() * 86400000 * 0.5).toISOString(),
  duration: `${Math.floor(Math.random() * 120) + 30}m`,
  topFeatures: [
    { name: "RSI", importance: 0.25 },
    { name: "MACD", importance: 0.18 },
    { name: "BB", importance: 0.15 },
    { name: "Volume", importance: 0.12 },
    { name: "ATR", importance: 0.10 },
  ],
}));

export default function FreqAITab({}: FreqAITabProps) {
  // Form state
  const [selectedHyperopt, setSelectedHyperopt] = useState(0);
  const [testNamePrefix, setTestNamePrefix] = useState(`freqai_${new Date().toISOString().split("T")[0]}`);
  const [trainStartDate, setTrainStartDate] = useState("2022-01-01");
  const [trainEndDate, setTrainEndDate] = useState("2024-01-01");
  const [backTestStartDate, setBackTestStartDate] = useState("2024-01-01");
  const [backTestEndDate, setBackTestEndDate] = useState("2025-01-01");
  const [featurePeriod, setFeaturePeriod] = useState("20");
  const [labelPeriod, setLabelPeriod] = useState("24");

  // Model matrix
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set(FREQAI_MODELS.map((m) => m.value)));
  const [selectedOutliers, setSelectedOutliers] = useState<Set<string>>(new Set(OUTLIER_METHODS.map((m) => m.value)));
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

  // Results
  const [isRunning, setIsRunning] = useState(false);
  const [results] = useState<FreqAIResult[]>(MOCK_RESULTS);
  const [currentlyRunning] = useState([
    { model: "LightGBMRegressor", outlier: "DI", progress: 75, status: "running" as const },
    { model: "XGBoostRegressor", outlier: "SVM", progress: 50, status: "running" as const },
    { model: "CatboostRegressor", outlier: "DBSCAN", progress: 25, status: "running" as const },
    { model: "PyTorchMLPRegressor", outlier: "None", progress: 0, status: "queued" as const },
  ]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const testsPerPage = 20;

  const matrixTotal = useMemo(() => selectedModels.size * selectedOutliers.size * 2 * 2, [selectedModels, selectedOutliers]);

  // Auto-description
  const autoDesc = useMemo(() => {
    return `${selectedModels.size} models × ${selectedOutliers.size} outliers × PCA(${pcaEnabled ? "on" : "off"}) × Noise(${noiseEnabled ? "on" : "off"}) = ${matrixTotal} tests · ${trainStartDate} → ${backTestEndDate}`;
  }, [selectedModels, selectedOutliers, pcaEnabled, noiseEnabled, matrixTotal, trainStartDate, backTestEndDate]);

  const handleToggleModel = (v: string) => {
    const s = new Set(selectedModels);
    if (s.has(v)) { s.delete(v); } else { s.add(v); }
    setSelectedModels(s);
  };
  const handleToggleOutlier = (v: string) => {
    const s = new Set(selectedOutliers);
    if (s.has(v)) { s.delete(v); } else { s.add(v); }
    setSelectedOutliers(s);
  };

  const bestResult = useMemo(() => {
    if (results.length === 0) return null;
    return results.reduce((best, cur) => {
      const bs = best.profitPct * 0.4 + best.sharpe * 0.3 - Math.abs(best.maxDD) * 0.3;
      const cs = cur.profitPct * 0.4 + cur.sharpe * 0.3 - Math.abs(cur.maxDD) * 0.3;
      return cs > bs ? cur : best;
    });
  }, [results]);

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * testsPerPage;
    return results.slice(start, start + testsPerPage);
  }, [results, currentPage]);

  const totalPages = Math.ceil(results.length / testsPerPage);

  // Charts
  const profitChartData = useMemo(() => {
    if (!bestResult) return null;
    const days = Array.from({ length: 50 }, (_, i) => {
      const base = Math.sin(i / 10) * 3;
      const trend = (i / 50) * bestResult.profitPct;
      return Math.max(base + trend + (Math.random() - 0.5), 0);
    });
    const min = Math.min(...days), max = Math.max(...days), range = max - min || 1;
    const pts = days.map((v, i) => `${(i / (days.length - 1)) * 280},${100 - ((v - min) / range) * 100}`).join(" ");
    return pts;
  }, [bestResult]);

  const tradeBarData = useMemo(() => {
    return Array.from({ length: 12 }, () => Math.random() * 10 - 2);
  }, []);

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5">
      {/* LEFT PANEL */}
      <div className="space-y-4">
        {/* FreqAI Config */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[12px] font-semibold text-text-0 mb-3">🧠 FreqAI Configuration</div>

          <div className="mb-3">
            <label className={LABEL}>Hyperopt Source</label>
            <select value={selectedHyperopt} onChange={(e) => setSelectedHyperopt(Number(e.target.value))} className={SELECT}>
              {HYPEROPT_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
            </select>
          </div>

          <div className="mb-3">
            <label className={LABEL}>Test Name Prefix</label>
            <input type="text" value={testNamePrefix} onChange={(e) => setTestNamePrefix(e.target.value)} className={INPUT} />
          </div>

          <div className="mb-3">
            <label className={LABEL}>Description (auto)</label>
            <div className="w-full h-[34px] py-0 px-3 bg-bg-2 border border-border rounded-btn text-[11px] text-text-2 flex items-center truncate">
              {autoDesc}
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
        <div className="bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] rounded-btn px-3 py-2 text-[11px] text-accent">
          ℹ️ {selectedModels.size} models × {selectedOutliers.size} outlier × 2 PCA × 2 noise = {matrixTotal} tests
        </div>

        {/* ML Models */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>ML Models ({FREQAI_MODELS.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {FREQAI_MODELS.map((model) => (
              <button
                key={model.value}
                onClick={() => handleToggleModel(model.value)}
                title={model.tip}
                className={`inline-flex items-center h-[26px] px-2 rounded-btn text-[10px] font-medium cursor-pointer border transition-all ${
                  selectedModels.has(model.value)
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                    : "bg-bg-2 border-border text-text-2"
                }`}
              >
                {model.label.replace("Regressor", "Reg").replace("Classifier", "Cls")}
              </button>
            ))}
          </div>
        </div>

        {/* Outlier Detection */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>Outlier Detection ({OUTLIER_METHODS.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {OUTLIER_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => handleToggleOutlier(m.value)}
                title={m.tip}
                className={`inline-flex items-center h-[26px] px-2 rounded-btn text-[10px] font-medium cursor-pointer border transition-all ${
                  selectedOutliers.has(m.value)
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                    : "bg-bg-2 border-border text-text-2"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* PCA + Noise toggles */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4 space-y-3">
          <Toggle checked={pcaEnabled} onChange={setPcaEnabled} label="PCA (Dimensionality Reduction)" />
          <Toggle checked={noiseEnabled} onChange={setNoiseEnabled} label="Anti-Overfitting (Noise)" />
        </div>

        {/* Advanced Options — FLAT, no dropdown */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[12px] font-semibold text-text-0 mb-3">⚡ Advanced Options</div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>DI Threshold <span className="font-normal text-text-3 ml-1">{diThreshold.toFixed(1)}</span></label>
              <input type="range" min="0" max="2" step="0.1" value={diThreshold} onChange={(e) => setDiThreshold(Number(e.target.value))} className="w-full accent-accent" />
            </div>
            <div>
              <label className={LABEL}>SVM Nu <span className="font-normal text-text-3 ml-1">{svmNu.toFixed(2)}</span></label>
              <input type="range" min="0.01" max="0.5" step="0.01" value={svmNu} onChange={(e) => setSvmNu(Number(e.target.value))} className="w-full accent-accent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>Weight Factor <span className="font-normal text-text-3 ml-1">{weightFactor.toFixed(1)}</span></label>
              <input type="range" min="0.1" max="5" step="0.1" value={weightFactor} onChange={(e) => setWeightFactor(Number(e.target.value))} className="w-full accent-accent" />
            </div>
            <div>
              <label className={LABEL}>Noise Std Dev <span className="font-normal text-text-3 ml-1">{noiseStdDev.toFixed(2)}</span></label>
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
            onClick={() => { setIsRunning(true); setCurrentPage(1); }}
            disabled={isRunning || selectedModels.size === 0}
            className="flex-1 h-[34px] rounded-btn text-[12px] font-medium bg-accent border border-accent text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ▶ Run Matrix ({matrixTotal})
          </button>
          <button
            onClick={() => { setIsRunning(true); setCurrentPage(1); }}
            disabled={isRunning || selectedModels.size === 0}
            className="flex-1 h-[34px] rounded-btn text-[12px] font-medium border border-border bg-bg-2 text-text-1 hover:bg-bg-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Run Selected
          </button>
          {isRunning && (
            <button
              onClick={() => setIsRunning(false)}
              className="h-[34px] px-3 rounded-btn text-[12px] font-medium bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-red hover:bg-[rgba(239,68,68,0.15)] transition-all"
            >
              ⏹
            </button>
          )}
        </div>

        {/* GPU Info */}
        <div className="bg-bg-1 border border-border rounded-[10px] px-3 py-2">
          <div className="text-[11px] text-accent font-semibold">RunPod RTX 4090</div>
          <div className="text-[10px] text-text-3">~3-6h for {matrixTotal} tests</div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="space-y-4">
        {/* Progress */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-semibold text-text-1">FreqAI Batch Progress</span>
            <span className="text-[10px] text-text-3">{results.length}/128 completed</span>
          </div>
          <div className="w-full h-1.5 bg-bg-3 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full w-full transition-all" />
          </div>
          <div className="text-[10px] text-text-2 mt-1">100% complete</div>
        </div>

        {/* Currently Running */}
        {currentlyRunning.length > 0 && (
          <div className="bg-bg-1 border border-border rounded-[10px] p-4">
            <div className={LABEL}>Running (4 parallel)</div>
            <div className="space-y-2">
              {currentlyRunning.map((run, i) => (
                <div key={i} className="bg-bg-2 border border-border rounded-btn p-2">
                  <div className="text-[11px] text-text-1 font-mono mb-1">{run.model.replace("Regressor", "Reg")} + {run.outlier}</div>
                  <div className="h-1 bg-bg-3 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${run.progress}%` }} />
                  </div>
                  <div className="text-[9px] text-text-3 mt-0.5">{run.progress}% {run.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch Preview */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className={LABEL}>Preview (6 of 128)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border">
                  {["#", "Model", "Outlier", "PCA", "Noise", "Status"].map((h) => (
                    <th key={h} className="py-1.5 px-2 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 6).map((r, idx) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-1.5 px-2 text-text-1">{idx + 1}</td>
                    <td className="py-1.5 px-2 text-text-1 font-mono">{r.model.replace("Regressor", "Reg").replace("Classifier", "Cls")}</td>
                    <td className="py-1.5 px-2 text-text-1">{r.outlier}</td>
                    <td className="py-1.5 px-2 text-text-1">{r.pcaEnabled ? "On" : "Off"}</td>
                    <td className="py-1.5 px-2 text-text-1">{r.noiseEnabled ? "On" : "Off"}</td>
                    <td className="py-1.5 px-2">
                      <span className="bg-[rgba(34,197,94,0.08)] text-green border border-[rgba(34,197,94,0.25)] py-px px-1.5 rounded text-[10px]">Pass</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-text-3 mt-1">...122 more rows</div>
        </div>

        {/* Winner Charts */}
        {bestResult && (
          <>
            <div className="bg-bg-1 border border-border rounded-[10px] p-3">
              <div className="text-[12px] font-semibold text-text-0 mb-2">Winner Cumulative Profit</div>
              <svg className="w-full h-[130px]" viewBox="0 0 300 120">
                <defs>
                  <linearGradient id="faiGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                {profitChartData && <polyline points={profitChartData} fill="none" stroke="#6366f1" strokeWidth="2" />}
                {profitChartData && <polyline points={profitChartData} fill="url(#faiGrad)" opacity="0.3" />}
                <line x1="0" y1="100" x2="300" y2="100" stroke="#1e1e30" strokeWidth="1" strokeDasharray="2,2" />
              </svg>
            </div>

            <div className="bg-bg-1 border border-border rounded-[10px] p-3">
              <div className="text-[12px] font-semibold text-text-0 mb-2">Per-Trade Profit Bars</div>
              <svg className="w-full h-[100px]" viewBox="0 0 300 120">
                {tradeBarData.map((trade, i) => {
                  const barW = 280 / tradeBarData.length;
                  const h = Math.abs((trade / Math.max(...tradeBarData.map(Math.abs))) * 50);
                  const y = trade >= 0 ? 60 - h : 60;
                  return <rect key={i} x={10 + i * barW} y={y} width={barW - 2} height={h} fill={trade >= 0 ? "#22c55e" : "#ef4444"} opacity="0.7" rx="2" />;
                })}
                <line x1="10" y1="60" x2="290" y2="60" stroke="#1e1e30" strokeWidth="1" strokeDasharray="2,2" />
              </svg>
            </div>
          </>
        )}

        {/* Master Results Table */}
        <div className="bg-bg-1 border border-border rounded-[10px] overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="text-[12px] font-semibold text-text-0">All Results ({results.length})</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-bg-2 border-b border-border">
                <tr>
                  {["#", "Model", "Outlier", "PCA", "Noise", "Duration", "Trades", "Win%", "Profit%", "Max DD", "Sharpe", "Sortino", "Acc%"].map((h, i) => (
                    <th key={h} className={`py-1.5 px-2 text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap ${i >= 6 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((r, idx) => (
                  <>
                    <tr
                      key={r.id}
                      className={`border-b border-border/50 hover:bg-[rgba(99,102,241,0.03)] cursor-pointer transition-colors ${bestResult?.id === r.id ? "bg-[rgba(99,102,241,0.08)]" : ""}`}
                      onClick={() => setExpandedRowId(expandedRowId === r.id ? null : r.id)}
                    >
                      <td className="py-1.5 px-2 text-text-1">{bestResult?.id === r.id ? "★" : (currentPage - 1) * testsPerPage + idx + 1}</td>
                      <td className="py-1.5 px-2 text-text-0 font-mono">{r.model.replace("Regressor", "Reg").replace("Classifier", "Cls")}</td>
                      <td className="py-1.5 px-2 text-text-1">{r.outlier}</td>
                      <td className="py-1.5 px-2 text-text-1">{r.pcaEnabled ? "On" : "Off"}</td>
                      <td className="py-1.5 px-2 text-text-1">{r.noiseEnabled ? "On" : "Off"}</td>
                      <td className="py-1.5 px-2 text-text-2">{r.duration}</td>
                      <td className="py-1.5 px-2 text-right text-text-1">{r.trades}</td>
                      <td className="py-1.5 px-2 text-right text-text-1">{r.winRate.toFixed(1)}%</td>
                      <td className={`py-1.5 px-2 text-right font-semibold ${profitColor(r.profitPct)}`}>{fmtPct(r.profitPct)}</td>
                      <td className="py-1.5 px-2 text-right text-red">{r.maxDD.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-text-1">{r.sharpe.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right text-text-1">{r.sortino.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right text-text-1">{r.accuracy.toFixed(1)}%</td>
                    </tr>

                    {expandedRowId === r.id && (
                      <tr key={`exp-${r.id}`} className="border-b border-border/50 bg-bg-3">
                        <td colSpan={13} className="px-4 py-3">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-[11px] font-semibold text-text-0 mb-2">Model Configuration</div>
                              <div className="space-y-1 text-[10px]">
                                {[
                                  ["Model", r.model], ["Outlier", r.outlier],
                                  ["PCA", r.pcaEnabled ? "On" : "Off"], ["Noise", r.noiseEnabled ? "On" : "Off"],
                                  ["Feature Period", featurePeriod], ["Label Period", labelPeriod],
                                ].map(([k, v]) => (
                                  <div key={k}><span className="text-text-2">{k}:</span> <span className="text-text-1">{v}</span></div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-text-0 mb-2">Top Features</div>
                              <div className="space-y-1.5">
                                {r.topFeatures.map((f, fi) => (
                                  <div key={fi} className="flex items-center gap-2">
                                    <div className="text-[10px] text-text-2 w-10">{f.name}</div>
                                    <div className="flex-1 h-1 bg-bg-2 rounded-full overflow-hidden">
                                      <div className="h-full bg-accent" style={{ width: `${f.importance * 100}%` }} />
                                    </div>
                                    <div className="text-[10px] text-text-2 w-8 text-right">{(f.importance * 100).toFixed(0)}%</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {["Promote", "Verify", "Analysis", "Compare"].map((a) => (
                                <button key={a} className={`h-[30px] px-3 rounded-btn text-[11px] font-medium border transition-all ${a === "Promote" ? "bg-accent border-accent text-white hover:bg-[#5558e6]" : "bg-bg-1 border-border text-text-0 hover:bg-bg-2"}`}>
                                  {a}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {results.length > testsPerPage && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[10px] text-text-2">
              <div>
                {Math.min((currentPage - 1) * testsPerPage + 1, results.length)}-{Math.min(currentPage * testsPerPage, results.length)} of {results.length}
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="h-[26px] px-2 rounded-btn text-[11px] border border-border bg-bg-3 text-text-0 disabled:opacity-50 transition-all">Prev</button>
                <span className="h-[26px] px-2 flex items-center text-[11px] text-text-1">{currentPage}/{totalPages}</span>
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="h-[26px] px-2 rounded-btn text-[11px] border border-border bg-bg-3 text-text-0 disabled:opacity-50 transition-all">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
