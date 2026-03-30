"use client";

import { useState, useMemo } from "react";
import { FREQAI_MODELS, OUTLIER_METHODS, fmtDateTime, fmtPct, profitColor } from "@/lib/experiments";
import Tooltip from "@/components/ui/Tooltip";
import { ChevronDown } from "lucide-react";

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

interface HyperoptOption {
  label: string;
  sampler: string;
  loss: string;
  space: string;
  profitPct: number;
}

interface CurrentlyRunning {
  model: string;
  outlier: string;
  pcaEnabled: boolean;
  noiseEnabled: boolean;
  progress: number;
  status: "running" | "queued";
}

// Mock hyperopt options
const HYPEROPT_OPTIONS: HyperoptOption[] = [
  { label: "CmaEs · SortinoDaily · +15.2% (best)", sampler: "CmaEs", loss: "SortinoDaily", space: "Signals Only", profitPct: 15.2 },
  { label: "TPE · Sharpe · +12.8%", sampler: "TPE", loss: "Sharpe", space: "Signals+Risk", profitPct: 12.8 },
  { label: "GPS · SharpeDaily · +11.5%", sampler: "GPS", loss: "SharpeDaily", space: "Full", profitPct: 11.5 },
];

// Mock results data
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

// Toggle component
function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <label className="relative w-[36px] h-[20px] cursor-pointer inline-block">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
      <span className={`absolute inset-0 rounded-[10px] border transition-all ${checked ? "bg-green/8 border-green" : "bg-bg-3 border-border"}`} />
      <span className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
    </label>
  );
}

export default function FreqAITab({}: FreqAITabProps) {
  // Left panel form state
  const [selectedHyperopt, setSelectedHyperopt] = useState(0);
  const [testNamePrefix, setTestNamePrefix] = useState(`freqai_${new Date().toISOString().split("T")[0]}`);
  const [description, setDescription] = useState("Auto-generated from settings. Click to edit.");
  const [trainStartDate, setTrainStartDate] = useState("2022-01-01");
  const [trainEndDate, setTrainEndDate] = useState("2024-01-01");
  const [backTestStartDate, setBackTestStartDate] = useState("2024-01-01");
  const [backTestEndDate, setBackTestEndDate] = useState("2025-01-01");
  const [featurePeriod, setFeaturePeriod] = useState("20");
  const [labelPeriod, setLabelPeriod] = useState("24");

  // Model matrix selection
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    new Set(FREQAI_MODELS.map((m) => m.value))
  );
  const [selectedOutliers, setSelectedOutliers] = useState<Set<string>>(
    new Set(OUTLIER_METHODS.map((m) => m.value))
  );
  const [pcaEnabled, setPcaEnabled] = useState(true);
  const [noiseEnabled, setNoiseEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced options
  const [diThreshold, setDiThreshold] = useState(1.0);
  const [svmNu, setSvmNu] = useState(0.15);
  const [weightFactor, setWeightFactor] = useState(1.0);
  const [noiseStdDev, setNoiseStdDev] = useState(0.1);
  const [outlierProtectionPct, setOutlierProtectionPct] = useState(30);
  const [shuffleAfterSplit, setShuffleAfterSplit] = useState(false);
  const [bufferTrainData, setBufferTrainData] = useState(0);
  const [reverseTrainTest, setReverseTrainTest] = useState(false);
  const [includeCorrPairs, setIncludeCorrPairs] = useState(false);
  const [indicatorPeriods, setIndicatorPeriods] = useState("10, 20");

  // Right panel results state
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<FreqAIResult[]>(MOCK_RESULTS);
  const [currentlyRunning, setCurrentlyRunning] = useState<CurrentlyRunning[]>([
    { model: "LightGBMRegressor", outlier: "DI", pcaEnabled: true, noiseEnabled: true, progress: 75, status: "running" },
    { model: "XGBoostRegressor", outlier: "SVM", pcaEnabled: true, noiseEnabled: false, progress: 50, status: "running" },
    { model: "CatboostRegressor", outlier: "DBSCAN", pcaEnabled: false, noiseEnabled: true, progress: 25, status: "running" },
    { model: "PyTorchMLPRegressor", outlier: "None", pcaEnabled: false, noiseEnabled: false, progress: 0, status: "queued" },
  ]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month">("month");

  const testsPerPage = 20;

  // Calculate matrix total
  const matrixTotal = useMemo(() => {
    return selectedModels.size * selectedOutliers.size * 2 * 2;
  }, [selectedModels, selectedOutliers]);

  const handleToggleModel = (modelValue: string) => {
    const newSet = new Set(selectedModels);
    if (newSet.has(modelValue)) {
      newSet.delete(modelValue);
    } else {
      newSet.add(modelValue);
    }
    setSelectedModels(newSet);
  };

  const handleToggleOutlier = (outlierValue: string) => {
    const newSet = new Set(selectedOutliers);
    if (newSet.has(outlierValue)) {
      newSet.delete(outlierValue);
    } else {
      newSet.add(outlierValue);
    }
    setSelectedOutliers(newSet);
  };

  const handleRunFullMatrix = async () => {
    setIsRunning(true);
    setCurrentPage(1);
    setExpandedRowId(null);
  };

  const handleRunSelected = async () => {
    setIsRunning(true);
    setCurrentPage(1);
    setExpandedRowId(null);
  };

  const handleStopAll = () => {
    setIsRunning(false);
    setCurrentlyRunning([]);
  };

  const bestResult = useMemo(() => {
    if (results.length === 0) return null;
    return results.reduce((best, current) => {
      const bestScore = best.profitPct * 0.4 + best.sharpe * 0.3 - Math.abs(best.maxDD) * 0.3;
      const currentScore = current.profitPct * 0.4 + current.sharpe * 0.3 - Math.abs(current.maxDD) * 0.3;
      return currentScore > bestScore ? current : best;
    });
  }, [results]);

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * testsPerPage;
    return results.slice(start, start + testsPerPage);
  }, [results, currentPage]);

  const totalPages = Math.ceil(results.length / testsPerPage);

  const generateCumulativeProfitChart = () => {
    if (!bestResult) return null;
    const days = Array.from({ length: 50 }, (_, i) => i);
    const data = days.map((d) => {
      const base = Math.sin(d / 10) * 3;
      const trend = (d / 50) * bestResult.profitPct;
      const noise = (Math.random() - 0.5) * 1;
      return Math.max(base + trend + noise, 0);
    });

    const minY = Math.min(...data);
    const maxY = Math.max(...data);
    const range = maxY - minY || 1;
    const points = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * 280;
        const y = 100 - ((v - minY) / range) * 100;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg className="w-full h-32" viewBox="0 0 300 120" style={{ background: "linear-gradient(180deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0) 100%)" }}>
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#6366f1", stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: "#6366f1", stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" />
        <polyline points={points} fill="url(#grad1)" opacity="0.3" />
        <line x1="0" y1="100" x2="300" y2="100" stroke="#1e1e30" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
    );
  };

  const generatePerTradeChart = () => {
    if (!bestResult) return null;
    const trades = Array.from({ length: 12 }, () => Math.random() * 10 - 2);
    const minVal = Math.min(...trades);
    const maxVal = Math.max(...trades);
    const range = maxVal - minVal || 1;

    const barWidth = 280 / trades.length;
    return (
      <svg className="w-full h-32" viewBox="0 0 300 120">
        {trades.map((trade, i) => {
          const isPositive = trade >= 0;
          const baselineY = 60;
          const height = Math.abs((trade / range) * 100);
          const y = isPositive ? baselineY - height : baselineY;
          const color = isPositive ? "#22c55e" : "#ef4444";
          return (
            <rect
              key={i}
              x={10 + i * barWidth}
              y={y}
              width={barWidth - 2}
              height={height}
              fill={color}
              opacity="0.7"
              rx="2"
            />
          );
        })}
        <line x1="10" y1="60" x2="290" y2="60" stroke="#1e1e30" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5">
      {/* LEFT PANEL ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-bg-1 border border-border rounded-card p-4 flex flex-col gap-4 h-fit sticky top-4">
        {/* Title */}
        <div className="text-[13px] font-semibold text-text-0">FreqAI Configuration</div>

        {/* Hyperopt Source */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Hyperopt Source
          </label>
          <select
            value={selectedHyperopt}
            onChange={(e) => setSelectedHyperopt(Number(e.target.value))}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          >
            {HYPEROPT_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Test Name Prefix */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Test Name Prefix
          </label>
          <input
            type="text"
            value={testNamePrefix}
            onChange={(e) => setTestNamePrefix(e.target.value)}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          />
        </div>

        {/* Description (auto-generated box) */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Description
          </label>
          <div className="bg-bg-2 border border-border rounded-btn px-3 py-2 text-[11px] text-text-1">
            {description}
          </div>
          <div className="text-[10px] text-text-3 mt-[3px]">
            Auto-generated from settings. Click to edit.
          </div>
        </div>

        {/* Training Timerange */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Training Timerange
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={trainStartDate}
              onChange={(e) => setTrainStartDate(e.target.value)}
              className="flex-1 py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
            />
            <input
              type="date"
              value={trainEndDate}
              onChange={(e) => setTrainEndDate(e.target.value)}
              className="flex-1 py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
            />
          </div>
        </div>

        {/* Backtest Timerange */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Backtest Timerange
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={backTestStartDate}
              onChange={(e) => setBackTestStartDate(e.target.value)}
              className="flex-1 py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
            />
            <input
              type="date"
              value={backTestEndDate}
              onChange={(e) => setBackTestEndDate(e.target.value)}
              className="flex-1 py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
            />
          </div>
        </div>

        {/* Feature Period */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Feature Period (candles)
          </label>
          <input
            type="number"
            value={featurePeriod}
            onChange={(e) => setFeaturePeriod(e.target.value)}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          />
        </div>

        {/* Label Period */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Label Period (candles)
          </label>
          <input
            type="number"
            value={labelPeriod}
            onChange={(e) => setLabelPeriod(e.target.value)}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          />
        </div>

        {/* Matrix Calculation Info Box */}
        <div className="bg-bg-2 border border-border rounded-btn px-3 py-2 text-[11px] text-text-2">
          {selectedModels.size} models × {selectedOutliers.size} outlier × 2 PCA × 2 noise = {matrixTotal} tests
        </div>

        {/* ML Models (8) */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            ML Models (8)
          </label>
          <div className="flex flex-wrap gap-2">
            {FREQAI_MODELS.map((model) => (
              <button
                key={model.value}
                onClick={() => handleToggleModel(model.value)}
                title={model.tip}
                className={`inline-flex items-center gap-1 py-[5px] px-3 rounded-btn text-[11px] cursor-pointer border transition-all select-none ${
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

        {/* Outlier Detection (4) */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Outlier Detection (4)
          </label>
          <div className="flex flex-wrap gap-2">
            {OUTLIER_METHODS.map((method) => (
              <button
                key={method.value}
                onClick={() => handleToggleOutlier(method.value)}
                title={method.tip}
                className={`inline-flex items-center gap-1 py-[5px] px-3 rounded-btn text-[11px] cursor-pointer border transition-all select-none ${
                  selectedOutliers.has(method.value)
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                    : "bg-bg-2 border-border text-text-2"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensionality Reduction (2) */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Dimensionality Reduction
          </label>
          <div className="flex flex-wrap gap-2">
            {["Off", "On"].map((label, i) => (
              <button
                key={i}
                onClick={() => setPcaEnabled(i === 1)}
                className={`inline-flex items-center gap-1 py-[5px] px-3 rounded-btn text-[11px] cursor-pointer border transition-all select-none ${
                  (i === 0 && !pcaEnabled) || (i === 1 && pcaEnabled)
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                    : "bg-bg-2 border-border text-text-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Anti-Overfitting (2) */}
        <div>
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
            Anti-Overfitting
          </label>
          <div className="flex flex-wrap gap-2">
            {["Off", "On"].map((label, i) => (
              <button
                key={i}
                onClick={() => setNoiseEnabled(i === 1)}
                className={`inline-flex items-center gap-1 py-[5px] px-3 rounded-btn text-[11px] cursor-pointer border transition-all select-none ${
                  (i === 0 && !noiseEnabled) || (i === 1 && noiseEnabled)
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                    : "bg-bg-2 border-border text-text-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options */}
        <details className="group">
          <summary className="flex items-center gap-2 text-accent text-[11px] cursor-pointer font-semibold hover:text-accent/80 transition-colors list-none">
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            Advanced Options
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {/* DI Threshold */}
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                DI Threshold
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={diThreshold}
                onChange={(e) => setDiThreshold(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[10px] text-text-3 mt-[3px]">{diThreshold.toFixed(1)}</div>
            </div>

            {/* SVM Nu */}
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                SVM Nu
              </label>
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={svmNu}
                onChange={(e) => setSvmNu(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[10px] text-text-3 mt-[3px]">{svmNu.toFixed(2)}</div>
            </div>

            {/* Weight Factor */}
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Weight Factor
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={weightFactor}
                onChange={(e) => setWeightFactor(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[10px] text-text-3 mt-[3px]">{weightFactor.toFixed(1)}</div>
            </div>

            {/* Noise Std Dev */}
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Noise Std Dev
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={noiseStdDev}
                onChange={(e) => setNoiseStdDev(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[10px] text-text-3 mt-[3px]">{noiseStdDev.toFixed(2)}</div>
            </div>

            {/* Outlier Protection % */}
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Outlier Protection %
              </label>
              <input
                type="number"
                value={outlierProtectionPct}
                onChange={(e) => setOutlierProtectionPct(Number(e.target.value))}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
            </div>

            {/* Buffer Train Data */}
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Buffer Train Data
              </label>
              <input
                type="number"
                value={bufferTrainData}
                onChange={(e) => setBufferTrainData(Number(e.target.value))}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
            </div>

            {/* Shuffle After Split */}
            <div className="flex items-center gap-2">
              <Toggle checked={shuffleAfterSplit} onChange={setShuffleAfterSplit} />
              <span className="text-[11px] text-text-2">Shuffle After Split</span>
            </div>

            {/* Reverse Train/Test */}
            <div className="flex items-center gap-2">
              <Toggle checked={reverseTrainTest} onChange={setReverseTrainTest} />
              <span className="text-[11px] text-text-2">Reverse Train/Test</span>
            </div>

            {/* Include Corr Pairs */}
            <div className="flex items-center gap-2 col-span-2">
              <Toggle checked={includeCorrPairs} onChange={setIncludeCorrPairs} />
              <span className="text-[11px] text-text-2">Include Corr Pairs</span>
            </div>

            {/* Indicator Periods */}
            <div className="col-span-2">
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Indicator Periods
              </label>
              <input
                type="text"
                value={indicatorPeriods}
                onChange={(e) => setIndicatorPeriods(e.target.value)}
                placeholder="10, 20, 50"
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
            </div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-4 border-t border-border">
          <button
            onClick={handleRunFullMatrix}
            disabled={isRunning || selectedModels.size === 0 || selectedOutliers.size === 0}
            className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border w-full justify-center bg-accent border-accent text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ▶ Run Full Matrix ({matrixTotal} tests)
          </button>
          <button
            onClick={handleRunSelected}
            disabled={isRunning || selectedModels.size === 0 || selectedOutliers.size === 0}
            className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border w-full justify-center bg-bg-2 border-border text-text-0 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Selected
          </button>
          {isRunning && (
            <button
              onClick={handleStopAll}
              className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border w-full justify-center bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)] text-red hover:bg-[rgba(239,68,68,0.12)] transition-colors"
            >
              ⊗ Stop All
            </button>
          )}
        </div>

        {/* GPU Server Stat Box */}
        <div className="bg-bg-1 border border-border rounded-card p-[14px]">
          <div className="text-[11px] text-accent font-semibold mb-[2px]">RunPod RTX 4090</div>
          <div className="text-[10px] text-text-3">~3-6h for {matrixTotal} tests</div>
        </div>
      </div>

      {/* RIGHT PANEL ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-bg-1 border border-border rounded-card p-4 flex flex-col gap-4">
        {/* Title */}
        <div className="text-[13px] font-semibold text-text-0">📊 Results & Monitoring</div>

        {/* Progress Stat Box */}
        {isRunning || results.length > 0 ? (
          <div className="bg-bg-1 border border-border rounded-card p-[14px]">
            <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-2">FreqAI Batch Progress</div>
            <div className="flex items-baseline gap-2 mb-3">
              <div className="text-[18px] font-semibold text-text-0">{results.length}/128</div>
              <div className="text-[11px] text-text-2">Completed (100%)</div>
            </div>
            <div className="h-[8px] bg-bg-3 rounded-[4px] overflow-hidden">
              <div className="h-full bg-accent rounded-[4px]" style={{ width: "100%" }} />
            </div>
          </div>
        ) : null}

        {/* Currently Running */}
        {currentlyRunning.length > 0 && (
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-2">Running (4 parallel)</div>
            <div className="space-y-2">
              {currentlyRunning.map((run, i) => (
                <div key={i} className="bg-bg-2 border border-border rounded-btn p-3">
                  <div className="text-[11px] text-text-1 mb-2 font-mono">
                    {run.model} + {run.outlier}
                  </div>
                  <div className="h-[8px] bg-bg-3 rounded-[4px] overflow-hidden">
                    <div className="h-full bg-accent rounded-[4px]" style={{ width: `${run.progress}%` }} />
                  </div>
                  <div className="text-[10px] text-text-3 mt-1">
                    {run.progress}% {run.status === "queued" ? "queued" : "running"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch Preview */}
        {results.length > 0 ? (
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-2">Preview (6 of 128)</div>
            <div className="bg-bg-2 border border-border rounded-btn overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">#</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Model</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Outlier</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">PCA</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Noise</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 6).map((result, idx) => (
                    <tr key={result.id} className="border-b border-border/50">
                      <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{idx + 1}</td>
                      <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 font-mono">{result.model.replace("Regressor", "Reg").replace("Classifier", "Cls")}</td>
                      <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{result.outlier}</td>
                      <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{result.pcaEnabled ? "On" : "Off"}</td>
                      <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{result.noiseEnabled ? "On" : "Off"}</td>
                      <td className="py-2 px-[10px] border-b border-border/50 text-[11px]">
                        <span className="bg-[rgba(34,197,94,0.08)] text-green border border-[rgba(34,197,94,0.25)] py-[2px] px-2 rounded text-[10px]">Pass</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-text-3 mt-2">...122 more rows</div>
          </div>
        ) : null}

        {/* Winner Cumulative Profit Chart */}
        {bestResult && results.length > 0 ? (
          <div className="bg-bg-2 border border-border rounded-btn p-3">
            <div className="text-[11px] font-semibold text-text-0 mb-3">Winner Cumulative Profit</div>
            {generateCumulativeProfitChart()}
          </div>
        ) : null}

        {/* Per-Trade Profit Bars */}
        {bestResult && results.length > 0 ? (
          <div className="bg-bg-2 border border-border rounded-btn p-3">
            <div className="text-[11px] font-semibold text-text-0 mb-3">Per-Trade Profit Bars</div>
            {generatePerTradeChart()}
          </div>
        ) : null}

        {/* Master Results Table */}
        {results.length > 0 ? (
          <div className="bg-bg-2 border border-border rounded-btn p-3 flex-1 flex flex-col min-h-0">
            <div className="text-[11px] font-semibold text-text-0 mb-3">All Results (128)</div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">#</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Model</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Outlier</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">PCA</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Noise</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Started</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Finished</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">Duration</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-right">Trades</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-right">Win%</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-right">Profit%</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-right">Max DD</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-right">Sharpe</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-right">Sortino</th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-right">Acc%</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.map((result, idx) => (
                    <tbody key={result.id}>
                      <tr
                        className={`border-b border-border/50 hover:bg-bg-3 cursor-pointer transition-colors ${
                          bestResult?.id === result.id ? "bg-[rgba(99,102,241,0.08)]" : ""
                        }`}
                        onClick={() => setExpandedRowId(expandedRowId === result.id ? null : result.id)}
                      >
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">
                          {bestResult?.id === result.id ? "★" : idx + 1}
                        </td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-0 font-mono">
                          {result.model.replace("Regressor", "Reg").replace("Classifier", "Cls")}
                        </td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{result.outlier}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{result.pcaEnabled ? "On" : "Off"}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{result.noiseEnabled ? "On" : "Off"}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-2">{fmtDateTime(result.started)}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-2">{fmtDateTime(result.finished)}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{result.duration}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 text-right">{result.trades}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 text-right">{result.winRate.toFixed(1)}%</td>
                        <td className={`py-2 px-[10px] border-b border-border/50 text-[11px] text-right font-semibold ${profitColor(result.profitPct)}`}>
                          {fmtPct(result.profitPct)}
                        </td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-red text-right">{result.maxDD.toFixed(1)}%</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 text-right">{result.sharpe.toFixed(2)}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 text-right">{result.sortino.toFixed(2)}</td>
                        <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 text-right">{result.accuracy.toFixed(1)}%</td>
                      </tr>

                      {/* Expanded Row */}
                      {expandedRowId === result.id && (
                        <tr className="border-b border-border/50 bg-bg-3">
                          <td colSpan={15} className="px-4 py-4">
                            <div className="grid grid-cols-3 gap-6">
                              {/* Model Configuration */}
                              <div>
                                <div className="text-[11px] font-semibold text-text-0 mb-3">Model Configuration</div>
                                <div className="space-y-[6px] text-[10px]">
                                  <div>
                                    <span className="text-text-2">Model:</span>{" "}
                                    <span className="text-text-1">{result.model}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-2">Outlier:</span>{" "}
                                    <span className="text-text-1">{result.outlier}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-2">PCA:</span>{" "}
                                    <span className="text-text-1">{result.pcaEnabled ? "On" : "Off"}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-2">Noise:</span>{" "}
                                    <span className="text-text-1">{result.noiseEnabled ? "On" : "Off"}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-2">Feature Period:</span>{" "}
                                    <span className="text-text-1">{featurePeriod}</span>
                                  </div>
                                  <div>
                                    <span className="text-text-2">Label Period:</span>{" "}
                                    <span className="text-text-1">{labelPeriod}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Top Features */}
                              <div>
                                <div className="text-[11px] font-semibold text-text-0 mb-3">Top Features</div>
                                <div className="space-y-2">
                                  {result.topFeatures.map((feature, fi) => (
                                    <div key={fi} className="flex items-center gap-2">
                                      <div className="text-[10px] text-text-2 w-10">{feature.name}</div>
                                      <div className="flex-1 h-[6px] bg-bg-2 rounded-[3px] overflow-hidden">
                                        <div className="h-full bg-accent" style={{ width: `${feature.importance * 100}%` }} />
                                      </div>
                                      <div className="text-[10px] text-text-2 w-8 text-right">
                                        {(feature.importance * 100).toFixed(0)}%
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-col gap-2 justify-start">
                                <button className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-accent border-accent text-white hover:bg-[#5558e6] transition-colors">
                                  Promote
                                </button>
                                <button className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-bg-1 border-border text-text-0 hover:bg-bg-2 transition-colors">
                                  Verify
                                </button>
                                <button className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-bg-1 border-border text-text-0 hover:bg-bg-2 transition-colors">
                                  Analysis
                                </button>
                                <button className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-bg-1 border-border text-text-0 hover:bg-bg-2 transition-colors">
                                  Compare
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {results.length > testsPerPage && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[10px] text-text-2">
                <div>
                  Showing {Math.min((currentPage - 1) * testsPerPage + 1, results.length)}-
                  {Math.min(currentPage * testsPerPage, results.length)} of {results.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-bg-3 border-border text-text-0 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <div className="inline-flex items-center gap-[6px] py-[6px] px-[14px] text-[12px] text-text-1">
                    {currentPage} / {totalPages}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-bg-3 border-border text-text-0 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-text-2 flex-1">
            <div className="text-[11px]">No results yet. Click "Run Full Matrix" to start.</div>
          </div>
        )}
      </div>
    </div>
  );
}
