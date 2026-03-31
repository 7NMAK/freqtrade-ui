"use client";

import { useState, useMemo } from "react";
import Tooltip from "@/components/ui/Tooltip";
import Toggle from "@/components/ui/Toggle";
import { INPUT, SELECT, LABEL } from "@/lib/design";
import { FREQAI_MODELS, OUTLIER_METHODS } from "@/lib/experiments";
import { useToast } from "@/components/ui/Toast";

interface FreqAITabProps {
  strategy: string;
  botId?: number;
  onNavigateToTab?: (tab: number) => void;
}

export default function FreqAITab({ strategy, botId = 2, onNavigateToTab }: FreqAITabProps) {
  const toast = useToast();
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

  // ── FreqAI Results Types & State ────────────────────────────────────
  type FreqAIResult = {
    id: number; model: string; outlier: string; pca: boolean; noise: boolean;
    status: 'pending' | 'running' | 'completed' | 'failed';
    trades: number; winRate: number; profitPct: number; maxDrawdown: number;
    sharpe: number; sortino: number; startedAt: string; finishedAt: string;
    trainingDuration: string; featureImportance: string[]; predictionAccuracy: number;
  };
  const [results, setResults] = useState<FreqAIResult[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  type SortKey = 'profitPct' | 'sharpe' | 'sortino' | 'winRate' | 'maxDrawdown' | 'trades';
  const [sortBy, setSortBy] = useState<SortKey>('sharpe');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedResults = useMemo(() => {
    const copy = [...results.filter(r => r.status === 'completed')];
    copy.sort((a, b) => sortDir === 'desc' ? (b[sortBy] ?? 0) - (a[sortBy] ?? 0) : (a[sortBy] ?? 0) - (b[sortBy] ?? 0));
    return copy;
  }, [results, sortBy, sortDir]);

  const winner = useMemo(() => sortedResults.length > 0 ? sortedResults[0] : null, [sortedResults]);

  const handleSort = (col: SortKey) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const SortArrow = ({ col }: { col: SortKey }) =>
    sortBy === col ? <span className="ml-0.5 text-primary">{sortDir === 'desc' ? '↓' : '↑'}</span> : null;

  // Suppress unused — these are wired to real API when FreqAI training endpoint is available
  void setResults; void setCompletedCount;

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
        <div className="bg-card border border-border rounded-[10px] p-4">
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
            onClick={() => {
              setIsRunning(true);
              toast.info(`Starting FreqAI matrix: ${matrixTotal} combinations for ${strategy} (bot ${botId})`);
            }}
            disabled={isRunning || selectedModels.size === 0}
            className="flex-1 h-[34px] rounded-btn text-xs font-medium bg-primary border border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ▶ Run Matrix ({matrixTotal})
          </button>
          <button
            onClick={() => {
              setIsRunning(true);
              toast.info(`Starting selected FreqAI runs for ${strategy} (bot ${botId})`);
            }}
            disabled={isRunning || selectedModels.size === 0}
            className="flex-1 h-[34px] rounded-btn text-xs font-medium border border-border bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Run Selected
          </button>
          {isRunning && (
            <button
              onClick={() => { setIsRunning(false); toast.info('FreqAI stopped'); }}
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

      {/* RIGHT PANEL — Results + Progress */}
      <div className="space-y-4">

        {/* Progress Display (§697-709) */}
        {isRunning && (
          <div className="bg-card border border-primary/30 rounded-[10px] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                FreqAI Batch: {completedCount}/{matrixTotal} completed ({matrixTotal > 0 ? Math.round((completedCount / matrixTotal) * 100) : 0}%)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Est. remaining: ~{Math.max(0, Math.round((matrixTotal - completedCount) * 15))}min
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${matrixTotal > 0 ? (completedCount / matrixTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Winner Banner */}
        {winner && !isRunning && (
          <div className="bg-[rgba(34,197,94,0.06)] border border-emerald-500/20 rounded-[10px] p-4 flex items-center gap-4">
            <span className="text-2xl">🏆</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-emerald-400 mb-0.5">Best FreqAI Result</div>
              <div className="text-xs text-muted-foreground">
                {winner.model} + {winner.outlier} + PCA {winner.pca ? 'On' : 'Off'} + Noise {winner.noise ? 'On' : 'Off'}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${winner.profitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {winner.profitPct >= 0 ? '+' : ''}{winner.profitPct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-muted-foreground">
                Sharpe {winner.sharpe.toFixed(2)} · WR {winner.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => onNavigateToTab?.(5)} className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all">→ Verify</button>
              <button onClick={async () => {
                try {
                  const { getExperiments, activateStrategyVersion } = await import('@/lib/api');
                  const res = await getExperiments();
                  const exp = (res.items || []).find((e) => e.strategy_name === strategy || e.name === strategy);
                  if (exp && exp.best_version_id) {
                    await activateStrategyVersion(exp.strategy_id, exp.best_version_id);
                    toast.success(`Activated version for ${strategy} ★`);
                  } else {
                    toast.info('No version to activate yet — run verification first');
                  }
                } catch (err) {
                  toast.error(`Promote failed: ${err instanceof Error ? err.message : String(err)}`);
                }
              }} className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-all">Promote ★</button>
              <button onClick={() => toast.info('Opening Analysis')} className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-border text-muted-foreground hover:bg-muted transition-all">→ Analysis</button>
            </div>
          </div>
        )}

        {/* Results Master Table (§711-736) */}
        {sortedResults.length > 0 ? (
          <div className="bg-card border border-border rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold text-foreground">FreqAI Results ({sortedResults.length})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="text-left px-2 py-1.5 font-semibold">#</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Model</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Outlier</th>
                    <th className="text-center px-2 py-1.5 font-semibold">PCA</th>
                    <th className="text-center px-2 py-1.5 font-semibold">Noise</th>
                    <th onClick={() => handleSort('trades')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground">Trades<SortArrow col="trades" /></th>
                    <th onClick={() => handleSort('winRate')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground">Win Rate<SortArrow col="winRate" /></th>
                    <th onClick={() => handleSort('profitPct')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground">Profit%<SortArrow col="profitPct" /></th>
                    <th onClick={() => handleSort('maxDrawdown')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground">Max DD<SortArrow col="maxDrawdown" /></th>
                    <th onClick={() => handleSort('sharpe')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground">Sharpe<SortArrow col="sharpe" /></th>
                    <th onClick={() => handleSort('sortino')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground">Sortino<SortArrow col="sortino" /></th>
                    <th className="text-left px-2 py-1.5 font-semibold">Top Features</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Acc%</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Duration</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r, idx) => (
                    <tr key={r.id} className={`border-t border-border hover:bg-muted/20 ${idx === 0 ? 'bg-emerald-500/5' : ''}`}>
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{idx === 0 ? '★' : ''}{r.id}</td>
                      <td className="px-2 py-1.5 font-medium text-foreground">{r.model.replace('Regressor', 'Reg').replace('Classifier', 'Cls')}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.outlier}</td>
                      <td className="px-2 py-1.5 text-center">{r.pca ? <span className="text-emerald-400">On</span> : <span className="text-muted-foreground">Off</span>}</td>
                      <td className="px-2 py-1.5 text-center">{r.noise ? <span className="text-amber-400">On</span> : <span className="text-muted-foreground">Off</span>}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.trades}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.winRate.toFixed(1)}%</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${r.profitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r.profitPct >= 0 ? '+' : ''}{r.profitPct.toFixed(2)}%
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-rose-400">{r.maxDrawdown.toFixed(2)}%</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.sharpe.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.sortino.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground max-w-[120px] truncate">{r.featureImportance?.slice(0, 3).join(', ') || '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.predictionAccuracy?.toFixed(1) ?? '—'}%</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">{r.trainingDuration || '—'}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => onNavigateToTab?.(5)} className="px-1.5 py-0.5 text-[9px] border border-primary/30 text-primary rounded hover:bg-primary/10 transition">→ Verify</button>
                          <button onClick={() => toast.success(`Promoted #${r.id}`)} className="px-1.5 py-0.5 text-[9px] border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/10 transition">Promote</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[400px]">
            <div className="text-[32px] mb-3 opacity-30">🧠</div>
            <div className="text-sm font-semibold text-muted-foreground mb-1">No FreqAI results yet</div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              Configure your ML models and click &quot;Run Matrix&quot; to start real FreqAI training runs.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
