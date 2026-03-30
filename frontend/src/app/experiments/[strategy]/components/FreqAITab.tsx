"use client";

import { useState } from "react";
import { FREQAI_MODELS, OUTLIER_METHODS } from "@/lib/experiments";

interface FreqAITabProps {
  strategy: string;
}

// ── Design System ────────────────────────────────────────────────────────
const INPUT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground placeholder-text-3 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

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

  // Running state
  const [isRunning, setIsRunning] = useState(false);

  const matrixTotal = selectedModels.size * selectedOutliers.size * 2 * 2;

  const handleToggleModel = (v: string) => {
    const s = new Set(selectedModels);
    if (s.has(v)) {
      s.delete(v);
    } else {
      s.add(v);
    }
    setSelectedModels(s);
  };

  const handleToggleOutlier = (v: string) => {
    const s = new Set(selectedOutliers);
    if (s.has(v)) {
      s.delete(v);
    } else {
      s.add(v);
    }
    setSelectedOutliers(s);
  };

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5">
      {/* LEFT PANEL */}
      <div className="space-y-4">
        {/* FreqAI Config */}
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-xs font-semibold text-foreground mb-3">🧠 FreqAI Configuration</div>

          <div className="mb-3">
            <label className={LABEL}>Hyperopt Source</label>
            <select value={selectedHyperopt} onChange={(e) => setSelectedHyperopt(Number(e.target.value))} className={SELECT}>
              <option value="0">No hyperopt results available</option>
            </select>
          </div>

          <div className="mb-3">
            <label className={LABEL}>Test Name Prefix</label>
            <input type="text" value={testNamePrefix} onChange={(e) => setTestNamePrefix(e.target.value)} className={INPUT} />
          </div>

          <div className="mb-3">
            <label className={LABEL}>Description (auto)</label>
            <div className="w-full h-[34px] py-0 px-3 bg-muted/50 border border-border rounded-btn text-xs text-muted-foreground flex items-center truncate">
              {selectedModels.size} models × {selectedOutliers.size} outliers × PCA({pcaEnabled ? "on" : "off"}) × Noise({noiseEnabled ? "on" : "off"}) = {matrixTotal} tests
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
          ℹ️ {selectedModels.size} models × {selectedOutliers.size} outlier × 2 PCA × 2 noise = {matrixTotal} tests
        </div>

        {/* ML Models */}
        <div className="bg-card border border-border rounded-[10px] p-4">
          <label className={LABEL}>ML Models ({FREQAI_MODELS.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {FREQAI_MODELS.map((model) => (
              <button
                key={model.value}
                onClick={() => handleToggleModel(model.value)}
                title={model.tip}
                className={`inline-flex items-center h-[26px] px-2 rounded-btn text-xs font-medium cursor-pointer border transition-all ${
                  selectedModels.has(model.value)
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary"
                    : "bg-muted/50 border-border text-muted-foreground"
                }`}
              >
                {model.label.replace("Regressor", "Reg").replace("Classifier", "Cls")}
              </button>
            ))}
          </div>
        </div>

        {/* Outlier Detection */}
        <div className="bg-card border border-border rounded-[10px] p-4">
          <label className={LABEL}>Outlier Detection ({OUTLIER_METHODS.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {OUTLIER_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => handleToggleOutlier(m.value)}
                title={m.tip}
                className={`inline-flex items-center h-[26px] px-2 rounded-btn text-xs font-medium cursor-pointer border transition-all ${
                  selectedOutliers.has(m.value)
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary"
                    : "bg-muted/50 border-border text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* PCA + Noise toggles */}
        <div className="bg-card border border-border rounded-[10px] p-4 space-y-3">
          <Toggle checked={pcaEnabled} onChange={setPcaEnabled} label="PCA (Dimensionality Reduction)" />
          <Toggle checked={noiseEnabled} onChange={setNoiseEnabled} label="Anti-Overfitting (Noise)" />
        </div>

        {/* Advanced Options — FLAT, no dropdown */}
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-xs font-semibold text-foreground mb-3">⚡ Advanced Options</div>

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
            onClick={() => { setIsRunning(true); }}
            disabled={isRunning || selectedModels.size === 0}
            className="flex-1 h-[34px] rounded-btn text-xs font-medium bg-primary border border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ▶ Run Matrix ({matrixTotal})
          </button>
          <button
            onClick={() => { setIsRunning(true); }}
            disabled={isRunning || selectedModels.size === 0}
            className="flex-1 h-[34px] rounded-btn text-xs font-medium border border-border bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Run Selected
          </button>
          {isRunning && (
            <button
              onClick={() => setIsRunning(false)}
              className="h-[34px] px-3 rounded-btn text-xs font-medium bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-rose-500 hover:bg-[rgba(239,68,68,0.15)] transition-all"
            >
              ⏹
            </button>
          )}
        </div>

        {/* GPU Info */}
        <div className="bg-card border border-border rounded-[10px] px-3 py-2">
          <div className="text-xs text-primary font-semibold">RunPod RTX 4090</div>
          <div className="text-xs text-muted-foreground">~3-6h for {matrixTotal} tests</div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div>
        <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-[32px] mb-3 opacity-30">🧠</div>
          <div className="text-sm font-semibold text-muted-foreground mb-1">No FreqAI results yet</div>
          <div className="text-xs text-muted-foreground text-center max-w-[280px]">
            Configure your ML models and click &quot;Run Matrix&quot; to start real FreqAI training runs.
          </div>
        </div>
      </div>
    </div>
  );
}
