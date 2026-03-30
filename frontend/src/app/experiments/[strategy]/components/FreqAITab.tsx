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

const generateMockResults = (): FreqAIResult[] => {
  const models = ["LightGBMRegressor", "XGBoostRegressor", "CatboostRegressor", "PyTorchMLPRegressor", "ReinforcementLearner"];
  const outliers = ["None", "DI", "SVM", "DBSCAN"];
  const pca = [false, true];
  const noise = [false, true];

  const results: FreqAIResult[] = [];
  let idx = 1;

  for (const model of models) {
    for (const outlier of outliers) {
      for (const pcaVal of pca) {
        for (const noiseVal of noise) {
          const baseProfit = Math.random() * 20 - 2;
          const modifier = Math.random() * 5;
          const profitPct = baseProfit + (pcaVal ? 1 : 0) + (noiseVal ? -0.5 : 0) + modifier;

          results.push({
            id: `freqai_${idx}`,
            model,
            outlier,
            pcaEnabled: pcaVal,
            noiseEnabled: noiseVal,
            trades: Math.floor(Math.random() * 50) + 20,
            winRate: Math.random() * 40 + 45,
            profitPct,
            maxDD: -(Math.random() * 15 + 5),
            sharpe: Math.random() * 1.5 + 0.5,
            sortino: Math.random() * 2 + 0.8,
            accuracy: Math.random() * 35 + 50,
            started: `2024-03-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")} ${String(Math.floor(Math.random() * 24)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00`,
            finished: `2024-03-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")} ${String(Math.floor(Math.random() * 24)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00`,
            duration: `${Math.floor(Math.random() * 180) + 20}m`,
            topFeatures: [
              { name: "RSI_14", importance: 0.28 },
              { name: "MACD", importance: 0.22 },
              { name: "BB_Upper", importance: 0.18 },
              { name: "ATR_14", importance: 0.15 },
              { name: "Volume_SMA", importance: 0.17 },
            ],
          });
          idx++;
        }
      }
    }
  }

  // Shuffle results
  return results.sort(() => Math.random() - 0.5);
};

const MOCK_HYPEROPT_OPTIONS: HyperoptOption[] = [
  { label: "CmaEs · SortinoDaily · Signals Only · +15.2%", sampler: "CmaEs", loss: "SortinoDaily", space: "Signals Only", profitPct: 15.2 },
  { label: "TPE · Sharpe · Signals+Risk · +12.8%", sampler: "TPE", loss: "Sharpe", space: "Signals+Risk", profitPct: 12.8 },
  { label: "GPS · SharpeDaily · Full · +11.5%", sampler: "GPS", loss: "SharpeDaily", space: "Full", profitPct: 11.5 },
];

const getSpeedBadge = (speed: string): string => {
  const badges: Record<string, string> = {
    Fast: "⚡",
    Medium: "⚡⚡",
    Slow: "⚡⚡⚡",
  };
  return badges[speed] || "";
};

export default function FreqAITab({}: FreqAITabProps) {
  // Form state - left panel
  const [selectedHyperopt, setSelectedHyperopt] = useState(0);
  const [testNamePrefix, setTestNamePrefix] = useState(`freqai ${new Date().toISOString().split("T")[0]}`);
  const [description, setDescription] = useState("");
  const [trainStartDate, setTrainStartDate] = useState("2024-01-01");
  const [trainEndDate, setTrainEndDate] = useState("2024-06-30");
  const [backTestStartDate, setBackTestStartDate] = useState("2024-07-01");
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
  const [svmNu, setSvmNu] = useState(0.1);
  const [weightFactor, setWeightFactor] = useState(1.0);
  const [noiseStdDev, setNoiseStdDev] = useState(0.1);
  const [outlierProtectionPct, setOutlierProtectionPct] = useState(30);
  const [shuffleAfterSplit, setShuffleAfterSplit] = useState(false);
  const [bufferTrainData, setBufferTrainData] = useState(0);
  const [reverseTrainTest, setReverseTrainTest] = useState(false);
  const [includeCorrPairs, setIncludeCorrPairs] = useState(false);
  const [indicatorPeriods, setIndicatorPeriods] = useState("10, 20");

  // Results state - right panel
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<FreqAIResult[]>([]);
  const [currentlyRunning, setCurrentlyRunning] = useState<CurrentlyRunning[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month">("month");

  const testsPerPage = 20;

  // Calculate matrix total
  const matrixTotal = useMemo(() => {
    return selectedModels.size * selectedOutliers.size * 2 * 2; // 2 PCA × 2 Noise
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

    // Simulate running
    const mockRunning: CurrentlyRunning[] = [
      { model: "LightGBMRegressor", outlier: "DI", pcaEnabled: false, noiseEnabled: true, progress: 75, status: "running" },
      { model: "XGBoostRegressor", outlier: "SVM", pcaEnabled: true, noiseEnabled: false, progress: 50, status: "running" },
      { model: "CatboostRegressor", outlier: "DBSCAN", pcaEnabled: true, noiseEnabled: true, progress: 25, status: "running" },
      { model: "PyTorchMLPRegressor", outlier: "None", pcaEnabled: false, noiseEnabled: false, progress: 0, status: "queued" },
    ];
    setCurrentlyRunning(mockRunning);

    // Simulate completion
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const mockResults = generateMockResults();
    setResults(mockResults);
    setCurrentlyRunning([]);
    setIsRunning(false);
  };

  const handleRunSelected = async () => {
    setIsRunning(true);
    setCurrentPage(1);
    setExpandedRowId(null);

    const mockRunning: CurrentlyRunning[] = [
      { model: "LightGBMRegressor", outlier: "DI", pcaEnabled: true, noiseEnabled: true, progress: 50, status: "running" },
      { model: "XGBoostRegressor", outlier: "None", pcaEnabled: false, noiseEnabled: false, progress: 0, status: "queued" },
    ];
    setCurrentlyRunning(mockRunning);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const mockResults = generateMockResults().slice(0, matrixTotal);
    setResults(mockResults);
    setCurrentlyRunning([]);
    setIsRunning(false);
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
    <div className="flex gap-4 bg-bg-1 border border-border rounded-lg p-6">
      {/* LEFT PANEL - FORM */}
      <div className="w-[380px] flex flex-col gap-6 border-r border-border pr-6">
        {/* Hyperopt Source Selection */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block">
            <Tooltip content="Select which hyperopt run to use as the base for model training">Hyperopt Source</Tooltip>
          </label>
          <select
            value={selectedHyperopt}
            onChange={(e) => setSelectedHyperopt(Number(e.target.value))}
            className="w-full bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
          >
            {MOCK_HYPEROPT_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="mt-2 p-2 bg-bg-2 rounded text-xs text-text-2 border border-border">
            <div className="font-mono">Sampler: {MOCK_HYPEROPT_OPTIONS[selectedHyperopt].sampler}</div>
            <div className="font-mono">Loss: {MOCK_HYPEROPT_OPTIONS[selectedHyperopt].loss}</div>
            <div className="font-mono">Space: {MOCK_HYPEROPT_OPTIONS[selectedHyperopt].space}</div>
          </div>
        </div>

        {/* Test Name Prefix */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block">
            <Tooltip content="Prefix for all FreqAI test runs">Test Name Prefix</Tooltip>
          </label>
          <input
            type="text"
            value={testNamePrefix}
            onChange={(e) => setTestNamePrefix(e.target.value)}
            className="w-full bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block">
            <Tooltip content="Optional notes about this FreqAI experiment">Description</Tooltip>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent resize-none h-16"
            placeholder="Optional notes..."
          />
        </div>

        {/* Training Timerange */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block">
            <Tooltip content="Date range for training data">Training Timerange</Tooltip>
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={trainStartDate}
              onChange={(e) => setTrainStartDate(e.target.value)}
              className="flex-1 bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
            <input
              type="date"
              value={trainEndDate}
              onChange={(e) => setTrainEndDate(e.target.value)}
              className="flex-1 bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Backtest Timerange */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block">
            <Tooltip content="Date range for backtesting (must be after training period)">Backtest Timerange</Tooltip>
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={backTestStartDate}
              onChange={(e) => setBackTestStartDate(e.target.value)}
              className="flex-1 bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
            <input
              type="date"
              value={backTestEndDate}
              onChange={(e) => setBackTestEndDate(e.target.value)}
              className="flex-1 bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Feature & Label Period */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-text-0 mb-2 block">
              <Tooltip content="Lookback period for feature calculation">Feature Period</Tooltip>
            </label>
            <input
              type="number"
              value={featurePeriod}
              onChange={(e) => setFeaturePeriod(e.target.value)}
              className="w-full bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-0 mb-2 block">
              <Tooltip content="Lookback period for label generation">Label Period</Tooltip>
            </label>
            <input
              type="number"
              value={labelPeriod}
              onChange={(e) => setLabelPeriod(e.target.value)}
              className="w-full bg-bg-2 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Model Selection Grid */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block">
            <Tooltip content="Select which ML models to test (8 models max)">Models (8)</Tooltip>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FREQAI_MODELS.map((model) => (
              <button
                key={model.value}
                onClick={() => handleToggleModel(model.value)}
                className={`p-2 rounded border transition-colors text-xs text-center ${
                  selectedModels.has(model.value)
                    ? "bg-accent border-accent text-bg-0"
                    : "bg-bg-2 border-border text-text-1 hover:border-accent/50"
                }`}
                title={model.tip}
              >
                <div className="font-semibold">{model.label}</div>
                <div className="text-xs opacity-75">{getSpeedBadge(model.speed)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Outlier Methods */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block">
            <Tooltip content="Select outlier detection methods (4 available)">Outlier Methods (4)</Tooltip>
          </label>
          <div className="flex flex-wrap gap-2">
            {OUTLIER_METHODS.map((method) => (
              <button
                key={method.value}
                onClick={() => handleToggleOutlier(method.value)}
                className={`px-3 py-1 rounded border transition-colors text-xs ${
                  selectedOutliers.has(method.value)
                    ? "bg-accent border-accent text-bg-0"
                    : "bg-bg-2 border-border text-text-1 hover:border-accent/50"
                }`}
                title={method.tip}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* PCA Toggle */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block flex items-center gap-2">
            <input
              type="checkbox"
              checked={pcaEnabled}
              onChange={(e) => setPcaEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg-2 cursor-pointer"
            />
            <Tooltip content="Principal Component Analysis - reduces feature dimensionality">PCA</Tooltip>
          </label>
        </div>

        {/* Noise Toggle */}
        <div>
          <label className="text-xs font-semibold text-text-0 mb-2 block flex items-center gap-2">
            <input
              type="checkbox"
              checked={noiseEnabled}
              onChange={(e) => setNoiseEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-bg-2 cursor-pointer"
            />
            <Tooltip content="Add Gaussian noise to training data for robustness">Noise</Tooltip>
          </label>
        </div>

        {/* Matrix Calculation Display */}
        <div className="p-3 bg-bg-2 rounded border border-accent/30 text-xs text-text-1">
          <div className="font-mono">
            {selectedModels.size} models × {selectedOutliers.size} outlier × 2 PCA × 2 noise = {matrixTotal} tests
          </div>
        </div>

        {/* Advanced Options */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-accent text-xs font-semibold hover:text-accent/80 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-3 p-3 bg-bg-2 rounded border border-border/50">
            {/* DI Threshold */}
            <div>
              <label className="text-xs font-semibold text-text-0 mb-1 block">
                <Tooltip content="Dissimilarity Index threshold for outlier detection">DI Threshold</Tooltip>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={diThreshold}
                onChange={(e) => setDiThreshold(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-text-2 mt-1">{diThreshold.toFixed(1)}</div>
            </div>

            {/* SVM nu */}
            <div>
              <label className="text-xs font-semibold text-text-0 mb-1 block">
                <Tooltip content="SVM nu parameter (0-1)">SVM nu</Tooltip>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={svmNu}
                onChange={(e) => setSvmNu(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-text-2 mt-1">{svmNu.toFixed(2)}</div>
            </div>

            {/* Weight Factor */}
            <div>
              <label className="text-xs font-semibold text-text-0 mb-1 block">
                <Tooltip content="Weight factor for recent trades">Weight Factor</Tooltip>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={weightFactor}
                onChange={(e) => setWeightFactor(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-text-2 mt-1">{weightFactor.toFixed(1)}</div>
            </div>

            {/* Noise Std Dev */}
            <div>
              <label className="text-xs font-semibold text-text-0 mb-1 block">
                <Tooltip content="Standard deviation of Gaussian noise">Noise Std Dev</Tooltip>
              </label>
              <input
                type="number"
                value={noiseStdDev}
                onChange={(e) => setNoiseStdDev(Number(e.target.value))}
                step="0.01"
                className="w-full bg-bg-3 border border-border rounded px-2 py-1 text-xs text-text-0"
              />
            </div>

            {/* Outlier Protection % */}
            <div>
              <label className="text-xs font-semibold text-text-0 mb-1 block">
                <Tooltip content="Percentage of data to protect as outliers">Outlier Protection %</Tooltip>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={outlierProtectionPct}
                onChange={(e) => setOutlierProtectionPct(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-text-2 mt-1">{outlierProtectionPct}%</div>
            </div>

            {/* Shuffle After Split */}
            <label className="flex items-center gap-2 text-xs text-text-0">
              <input
                type="checkbox"
                checked={shuffleAfterSplit}
                onChange={(e) => setShuffleAfterSplit(e.target.checked)}
                className="w-3 h-3"
              />
              <Tooltip content="Shuffle data after train/test split">Shuffle After Split</Tooltip>
            </label>

            {/* Buffer Train Data */}
            <div>
              <label className="text-xs font-semibold text-text-0 mb-1 block">
                <Tooltip content="Buffer period for training data">Buffer Train Data</Tooltip>
              </label>
              <input
                type="number"
                value={bufferTrainData}
                onChange={(e) => setBufferTrainData(Number(e.target.value))}
                className="w-full bg-bg-3 border border-border rounded px-2 py-1 text-xs text-text-0"
              />
            </div>

            {/* Reverse Train/Test */}
            <label className="flex items-center gap-2 text-xs text-text-0">
              <input
                type="checkbox"
                checked={reverseTrainTest}
                onChange={(e) => setReverseTrainTest(e.target.checked)}
                className="w-3 h-3"
              />
              <Tooltip content="Reverse train and test periods">Reverse Train/Test</Tooltip>
            </label>

            {/* Include Corr Pairs */}
            <label className="flex items-center gap-2 text-xs text-text-0">
              <input
                type="checkbox"
                checked={includeCorrPairs}
                onChange={(e) => setIncludeCorrPairs(e.target.checked)}
                className="w-3 h-3"
              />
              <Tooltip content="Include correlated pairs in training">Include Corr Pairs</Tooltip>
            </label>

            {/* Indicator Periods */}
            <div>
              <label className="text-xs font-semibold text-text-0 mb-1 block">
                <Tooltip content="Comma-separated indicator periods">Indicator Periods</Tooltip>
              </label>
              <input
                type="text"
                value={indicatorPeriods}
                onChange={(e) => setIndicatorPeriods(e.target.value)}
                className="w-full bg-bg-3 border border-border rounded px-2 py-1 text-xs text-text-0"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-4 border-t border-border">
          <button
            onClick={handleRunFullMatrix}
            disabled={isRunning || selectedModels.size === 0 || selectedOutliers.size === 0}
            className="w-full bg-accent text-bg-0 px-4 py-2 rounded text-xs font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Full Matrix ({matrixTotal} tests)
          </button>
          <button
            onClick={handleRunSelected}
            disabled={isRunning || selectedModels.size === 0 || selectedOutliers.size === 0}
            className="w-full bg-bg-2 border border-border text-text-0 px-4 py-2 rounded text-xs font-semibold hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Run Selected
          </button>
          {isRunning && (
            <button
              onClick={handleStopAll}
              className="w-full bg-red/20 border border-red/50 text-red px-4 py-2 rounded text-xs font-semibold hover:bg-red/30 transition-colors"
            >
              Stop All
            </button>
          )}
        </div>

        {/* Server Info Box */}
        <div className="p-3 bg-bg-2 rounded border border-border/50 text-xs text-text-2 space-y-1">
          <div className="font-semibold text-text-1">GPU Server: RunPod RTX 4090</div>
          <div>Est. time: ~3-6 hours for full matrix</div>
          <div>Auto-managed: starts when you click Run</div>
        </div>
      </div>

      {/* RIGHT PANEL - RESULTS */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Progress Section */}
        {isRunning && (
          <div className="p-4 bg-bg-2 rounded border border-border">
            <div className="text-xs font-semibold text-text-0 mb-2">FreqAI Batch Progress</div>
            <div className="w-full bg-bg-3 rounded-full h-2 mb-2">
              <div className="bg-accent h-2 rounded-full" style={{ width: `${(currentlyRunning.length > 0 ? 0 : 100)}%` }} />
            </div>
            <div className="text-xs text-text-2 mb-3">
              {results.length} / {matrixTotal}
            </div>

            {/* Currently Running */}
            {currentlyRunning.length > 0 && (
              <div className="space-y-2 mt-3">
                <div className="text-xs font-semibold text-text-0">Currently Running (4 parallel)</div>
                {currentlyRunning.map((run, i) => (
                  <div key={i} className="p-2 bg-bg-3 rounded border border-border/50">
                    <div className="text-xs text-text-1 mb-1">
                      {run.model} + {run.outlier} + {run.pcaEnabled ? "PCA" : "No PCA"} {run.noiseEnabled ? "+ Noise" : ""}
                    </div>
                    <div className="w-full bg-bg-0 rounded-full h-1.5">
                      <div
                        className="bg-accent h-1.5 rounded-full transition-all"
                        style={{ width: `${run.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-text-2 mt-1">
                      {run.progress}% {run.status === "queued" ? "queued" : "running"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Winner Banner */}
        {bestResult && results.length > 0 && (
          <div className="p-4 bg-amber/20 border border-amber/50 rounded space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="font-semibold text-text-0">
                Best: {bestResult.model} · {bestResult.outlier} · {bestResult.pcaEnabled ? "PCA On" : "PCA Off"}
              </span>
            </div>
            <div className="text-xs text-text-1">
              <div>{fmtPct(bestResult.profitPct)}, Sharpe {bestResult.sharpe.toFixed(2)}, DD {bestResult.maxDD.toFixed(1)}%, Acc {bestResult.accuracy.toFixed(1)}%</div>
            </div>
            <div className="flex gap-2 mt-2">
              <button className="px-3 py-1 text-xs bg-bg-0 text-text-0 rounded hover:bg-text-3 transition-colors font-semibold">
                ★ Promote
              </button>
              <button className="px-3 py-1 text-xs bg-bg-0 text-text-0 rounded hover:bg-text-3 transition-colors font-semibold">
                → Verify
              </button>
            </div>
          </div>
        )}

        {/* Winner Cumulative Profit Chart */}
        {bestResult && results.length > 0 && (
          <div className="p-4 bg-bg-2 rounded border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-text-0">Winner Cumulative Profit</div>
              <div className="flex gap-1">
                {(["day", "week", "month"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setChartPeriod(period)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      chartPeriod === period
                        ? "bg-accent text-bg-0"
                        : "bg-bg-3 text-text-2 hover:text-text-1"
                    }`}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {generateCumulativeProfitChart()}
          </div>
        )}

        {/* Per-Trade Profit Bars */}
        {bestResult && results.length > 0 && (
          <div className="p-4 bg-bg-2 rounded border border-border">
            <div className="text-xs font-semibold text-text-0 mb-3">Per-Trade Profit Bars</div>
            {generatePerTradeChart()}
          </div>
        )}

        {/* Master Results Table */}
        <div className="p-4 bg-bg-2 rounded border border-border flex-1 flex flex-col">
          <div className="text-xs font-semibold text-text-0 mb-3">Results Table ({results.length} total)</div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-text-1 font-semibold w-8">#</th>
                  <th className="text-left px-2 py-2 text-text-1 font-semibold">Model</th>
                  <th className="text-left px-2 py-2 text-text-1 font-semibold">Outlier</th>
                  <th className="text-left px-2 py-2 text-text-1 font-semibold">PCA</th>
                  <th className="text-left px-2 py-2 text-text-1 font-semibold">Noise</th>
                  <th className="text-left px-2 py-2 text-text-1 font-semibold">Started</th>
                  <th className="text-left px-2 py-2 text-text-1 font-semibold">Finished</th>
                  <th className="text-left px-2 py-2 text-text-1 font-semibold">Duration</th>
                  <th className="text-right px-2 py-2 text-text-1 font-semibold">Trades</th>
                  <th className="text-right px-2 py-2 text-text-1 font-semibold">Win%</th>
                  <th className="text-right px-2 py-2 text-text-1 font-semibold">Profit%</th>
                  <th className="text-right px-2 py-2 text-text-1 font-semibold">Max DD</th>
                  <th className="text-right px-2 py-2 text-text-1 font-semibold">Sharpe</th>
                  <th className="text-right px-2 py-2 text-text-1 font-semibold">Sortino</th>
                  <th className="text-right px-2 py-2 text-text-1 font-semibold">Acc%</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((result, idx) => (
                  <tbody key={result.id}>
                    <tr
                      className="border-b border-border/50 hover:bg-bg-3 cursor-pointer transition-colors"
                      onClick={() => setExpandedRowId(expandedRowId === result.id ? null : result.id)}
                    >
                      <td className="px-2 py-2 text-text-2">
                        {bestResult?.id === result.id ? "★" : idx + 1}
                      </td>
                      <td className="px-2 py-2 text-text-0 font-mono">{result.model}</td>
                      <td className="px-2 py-2 text-text-1">{result.outlier}</td>
                      <td className="px-2 py-2 text-text-1">{result.pcaEnabled ? "On" : "Off"}</td>
                      <td className="px-2 py-2 text-text-1">{result.noiseEnabled ? "On" : "Off"}</td>
                      <td className="px-2 py-2 text-text-2 text-xs">{fmtDateTime(result.started)}</td>
                      <td className="px-2 py-2 text-text-2 text-xs">{fmtDateTime(result.finished)}</td>
                      <td className="px-2 py-2 text-text-1">{result.duration}</td>
                      <td className="px-2 py-2 text-right text-text-1">{result.trades}</td>
                      <td className="px-2 py-2 text-right text-text-1">{result.winRate.toFixed(1)}%</td>
                      <td className={`px-2 py-2 text-right font-semibold ${profitColor(result.profitPct)}`}>
                        {fmtPct(result.profitPct)}
                      </td>
                      <td className="px-2 py-2 text-right text-red">{result.maxDD.toFixed(1)}%</td>
                      <td className="px-2 py-2 text-right text-text-1">{result.sharpe.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right text-text-1">{result.sortino.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right text-text-1">{result.accuracy.toFixed(1)}%</td>
                    </tr>

                    {/* Expanded Row */}
                    {expandedRowId === result.id && (
                      <tr className="border-b border-border/50 bg-bg-3">
                        <td colSpan={15} className="px-4 py-4">
                          <div className="grid grid-cols-3 gap-6">
                            {/* Left: Model Configuration */}
                            <div>
                              <div className="text-xs font-semibold text-text-0 mb-2">Model Configuration</div>
                              <div className="space-y-1 text-xs text-text-2">
                                <div>
                                  <span className="text-text-1">Model:</span> {result.model}
                                </div>
                                <div>
                                  <span className="text-text-1">Outlier:</span> {result.outlier}
                                </div>
                                <div>
                                  <span className="text-text-1">PCA:</span> {result.pcaEnabled ? "On" : "Off"}
                                </div>
                                <div>
                                  <span className="text-text-1">Noise:</span> {result.noiseEnabled ? "On" : "Off"}
                                </div>
                                <div>
                                  <span className="text-text-1">Feature Period:</span> {featurePeriod}
                                </div>
                                <div>
                                  <span className="text-text-1">Label Period:</span> {labelPeriod}
                                </div>
                              </div>
                            </div>

                            {/* Middle: Top Features */}
                            <div>
                              <div className="text-xs font-semibold text-text-0 mb-2">Top Features</div>
                              <div className="space-y-1">
                                {result.topFeatures.map((feature, fi) => (
                                  <div key={fi} className="flex items-center gap-2">
                                    <div className="text-xs text-text-2 w-16">{feature.name}</div>
                                    <div className="flex-1 bg-bg-2 rounded h-1.5 overflow-hidden">
                                      <div
                                        className="bg-accent h-1.5"
                                        style={{ width: `${feature.importance * 100}%` }}
                                      />
                                    </div>
                                    <div className="text-xs text-text-2 w-10">{(feature.importance * 100).toFixed(0)}%</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Right: Action Buttons */}
                            <div className="flex flex-col gap-2 justify-center">
                              <button className="px-3 py-1 text-xs bg-accent text-bg-0 rounded hover:bg-accent/90 transition-colors font-semibold">
                                Promote
                              </button>
                              <button className="px-3 py-1 text-xs bg-bg-0 text-text-0 border border-border rounded hover:bg-bg-2 transition-colors font-semibold">
                                Verify
                              </button>
                              <button className="px-3 py-1 text-xs bg-bg-0 text-text-0 border border-border rounded hover:bg-bg-2 transition-colors font-semibold">
                                Analysis
                              </button>
                              <button className="px-3 py-1 text-xs bg-bg-0 text-text-0 border border-border rounded hover:bg-bg-2 transition-colors font-semibold">
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
          {results.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border text-xs text-text-2">
              <div>
                Showing {Math.min((currentPage - 1) * testsPerPage + 1, results.length)}-
                {Math.min(currentPage * testsPerPage, results.length)} of {results.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-bg-3 border border-border rounded hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <div className="px-3 py-1 text-text-1">
                  {currentPage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-bg-3 border border-border rounded hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {results.length === 0 && !isRunning && (
            <div className="flex items-center justify-center py-8 text-text-2">
              <div className="text-xs">No results yet. Click &quot;Run Full Matrix&quot; to start.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
