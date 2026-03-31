'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}
import Tooltip from '@/components/ui/Tooltip';
import Toggle from '@/components/ui/Toggle';
import { INPUT, LABEL, fmtPctRatio, fmtNum } from '@/lib/design';
import { useToast } from '@/components/ui/Toast';
import {
  LOSS_FUNCTIONS,
  SAMPLERS,
  SPACE_PRESETS,
  ALL_SPACES,
} from '@/lib/experiments';
import {
  botHyperoptStart,
  botHyperoptStatus,
  botHyperoptList,
  botHyperoptRuns,
  botHyperoptHistoryDelete,
} from '@/lib/api';

interface HyperoptRun {
  filename: string;
  strategy: string;
  created_at: string;
  mtime: number;
  size_bytes: number;
  epochs: number;
}

// ── Types ─────────────────────────────────────────────────────────────
interface HyperoptResult {
  id: number;
  loss: number;
  trades: number;
  winRate: number;
  profitPct: number;
  profitAbs: number;
  maxDrawdown: number;
  sharpe: number;
  sortino: number;
  avgDuration: string;
  sampler: string;
  lossFunction: string;
  spaces: string;
  epochs: number;
  status: 'completed' | 'running' | 'failed';
  startedAt: string;
  params?: Record<string, unknown>;
}

interface BatchJob {
  id: string;
  sampler: string;
  lossFunction: string;
  spaces: string[];
  epochs: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  jobId?: string;
  result?: HyperoptResult;
}

// ── Props ─────────────────────────────────────────────────────────────
interface HyperoptTabProps {
  strategy: string;
  botId?: number;
  onNavigateToTab?: (tab: number) => void;
}

export default function HyperoptTab({ strategy, botId = 2, onNavigateToTab }: HyperoptTabProps) {
  const toast = useToast();

  // ── Form State ───────────────────────────────────────────────────
  const [testName, setTestName] = useState(`${strategy} hyperopt ${new Date().toISOString().split('T')[0]}`);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');
  const [epochs, setEpochs] = useState(100);

  // Spaces
  const [selectedPreset, setSelectedPreset] = useState<string>('signals');
  const [customSpaces, setCustomSpaces] = useState<string[]>(['buy', 'sell']);

  // Loss functions (multi-select for batch)
  const [selectedLossFunctions, setSelectedLossFunctions] = useState<string[]>([LOSS_FUNCTIONS[0].value]);

  // Samplers (multi-select for batch)
  const [selectedSamplers, setSelectedSamplers] = useState<string[]>([SAMPLERS[0].value]);

  // Advanced
  const [minTrades, setMinTrades] = useState('');
  const [maxTrades, setMaxTrades] = useState('');
  const [randomState, setRandomState] = useState('');
  const [jobs, setJobs] = useState('-1');
  const [effort, setEffort] = useState(1.0);
  const [earlyStop, setEarlyStop] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Running State ────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── History State ─────────────────────────────────────────────
  const [hoRuns, setHoRuns] = useState<HyperoptRun[]>([]);
  const [hoConfirmDelete, setHoConfirmDelete] = useState<string | null>(null);
  const CACHE_KEY = `ho-results-${strategy}`;

  // ── Log State ───────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hoProgress, setHoProgress] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

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

  // ── Results ──────────────────────────────────────────────────────
  const [results, setResults] = useState<HyperoptResult[]>([]);
  const [sortBy, setSortBy] = useState<'profitPct' | 'sharpe' | 'sortino' | 'winRate' | 'maxDrawdown'>('profitPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [resultsPage, setResultsPage] = useState(1);
  const [hoPage, setHoPage] = useState(1);
  const resultsPerPage = 20;
  const hoPerPage = 10;

  // ── Preset handling ──────────────────────────────────────────────
  const handlePresetChange = useCallback((presetKey: string) => {
    setSelectedPreset(presetKey);
    const preset = SPACE_PRESETS.find((p) => p.key === presetKey);
    if (preset) {
      setCustomSpaces([...preset.spaces]);
      setEpochs(preset.epochs);
    }
  }, []);

  const toggleSpace = useCallback((space: string) => {
    setSelectedPreset('custom');
    setCustomSpaces((prev) =>
      prev.includes(space) ? prev.filter((s) => s !== space) : [...prev, space]
    );
  }, []);

  const toggleLossFunction = useCallback((lf: string) => {
    setSelectedLossFunctions((prev) =>
      prev.includes(lf) ? prev.filter((s) => s !== lf) : [...prev, lf]
    );
  }, []);

  const toggleSampler = useCallback((s: string) => {
    setSelectedSamplers((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }, []);

  // ── Batch Calculation ────────────────────────────────────────────
  const totalBatchRuns = selectedLossFunctions.length * selectedSamplers.length;

  const mapApiResults = useCallback((data: { results: unknown[] }): HyperoptResult[] => {
    return data.results.map((rawItem, i) => {
      const r = rawItem as Record<string, unknown>;
      // total_profit is a ratio (-0.107 = -10.7%), profit_pct is USDT abs amount
      const totalProfitRatio = Number(r.total_profit ?? 0);
      const profitPctStr = String(r.profit_pct ?? '0').replace(/[,%]/g, '');
      return {
        id: Number(r.epoch ?? i + 1),
        loss: Number(r.objective ?? 0),
        trades: Number(r.trades ?? 0),
        winRate: 0,
        profitPct: totalProfitRatio * 100,    // Convert ratio to percentage
        profitAbs: Number(profitPctStr),       // USDT absolute amount
        maxDrawdown: Number(r.max_drawdown_pct ?? 0),  // Already in % (e.g. 28.2)
        sharpe: 0,
        sortino: 0,
        avgDuration: String(r.avg_duration ?? '—'),
        sampler: '—',
        lossFunction: '—',
        spaces: '—',
        epochs: Number(r.epoch ?? 0),
        status: 'completed' as const,
        startedAt: '',
        params: (r.params as Record<string, unknown>) ?? undefined,
      };
    });
  }, []);

  // ── Fetch existing results from API ──────────────────────────────
  const fetchResults = useCallback(async () => {
    try {
      const data = await botHyperoptList(botId, { profitable: false });
      if (data?.results && data.results.length > 0) {
        const mapped = mapApiResults(data);
        setResults(mapped);
        // Cache to sessionStorage
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(mapped)); } catch { /* quota */ }
        addLog('INFO', `Loaded ${mapped.length} hyperopt epochs from history`);
      }
    } catch {
      // No results yet — that's fine
    }
  }, [botId, addLog, mapApiResults, CACHE_KEY]);

  // ── Fetch hyperopt runs (history) ────────────────────────────────
  const fetchRuns = useCallback(async () => {
    try {
      const data = await botHyperoptRuns(botId);
      if (data?.runs) {
        // Filter to current strategy
        const filtered = data.runs.filter(r => r.strategy === strategy || r.strategy === `_HO_${strategy}`);
        setHoRuns(filtered);
      }
    } catch { /* no runs */ }
  }, [botId, strategy]);

  // ── Delete a hyperopt run ────────────────────────────────────────
  const handleDeleteRun = useCallback(async (filename: string) => {
    try {
      await botHyperoptHistoryDelete(botId, filename);
      toast.success('Hyperopt run deleted');
      addLog('INFO', `Deleted hyperopt run: ${filename}`);
      // Clear results and cache since the source file is gone
      setResults([]);
      try { sessionStorage.removeItem(CACHE_KEY); } catch { /* */ }
      fetchRuns();
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [botId, toast, addLog, fetchRuns, CACHE_KEY]);

  // Auto-reset confirm after 3s
  useEffect(() => {
    if (!hoConfirmDelete) return;
    const t = setTimeout(() => setHoConfirmDelete(null), 3000);
    return () => clearTimeout(t);
  }, [hoConfirmDelete]);

  // ── Mount: load from cache first, then fetch from API ───────────
  useEffect(() => {
    // 1. Instant load from cache
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as HyperoptResult[];
        if (parsed.length > 0) {
          setResults(parsed);
          addLog('INFO', `Loaded ${parsed.length} epochs from cache`);
        }
      }
    } catch { /* no cache */ }
    // 2. Fetch fresh data in background
    fetchResults();
    fetchRuns();
  }, [CACHE_KEY, fetchResults, fetchRuns, addLog]);

  // ── Run Single Hyperopt ──────────────────────────────────────────
  const handleRunSingle = async () => {
    if (selectedLossFunctions.length === 0 || selectedSamplers.length === 0) {
      toast.error('Select at least one loss function and one sampler');
      return;
    }

    const timerange = `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;
    const lf = selectedLossFunctions[0];
    const sampler = selectedSamplers[0];

    setLogs([]);
    setHoProgress("");
    setIsRunning(true);
    const samplerLabel = SAMPLERS.find(s => s.value === sampler)?.label ?? sampler;
    const lfLabel = LOSS_FUNCTIONS.find(l => l.value === lf)?.label ?? lf;
    addLog('INFO', `Starting hyperopt: ${samplerLabel} × ${lfLabel}`);
    addLog('INFO', `Strategy: ${strategy} | Epochs: ${epochs} | Spaces: [${customSpaces.join(', ')}]`);
    addLog('INFO', `Timerange: ${timerange}`);
    toast.info(`Starting hyperopt: ${samplerLabel} × ${lfLabel}`);

    try {
      const params: Record<string, unknown> = {
        strategy,
        timerange,
        epochs,
        spaces: customSpaces,
        loss: lf,
        sampler,
      };
      if (minTrades) params.min_trades = Number(minTrades);
      if (maxTrades) params.max_trades = Number(maxTrades);
      if (randomState) params.random_state = Number(randomState);
      if (jobs) params.jobs = Number(jobs);
      if (effort !== 1.0) params.effort = effort;
      if (earlyStop) params.early_stop = true;

      addLog('INFO', `POST /api/bots/${botId}/hyperopt`);
      const res = await botHyperoptStart(botId, params);
      const jobId = res?.job_id;
      addLog('INFO', `Hyperopt job submitted — jobId=${jobId ?? 'N/A'}`);
      setHoProgress('running');

      if (jobId) {
        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const status = await botHyperoptStatus(botId, jobId);
            addLog('INFO', `[poll] status=${status.status}`);
            if (status.status === 'completed' || status.status === 'failed') {
              clearInterval(pollInterval);
              setIsRunning(false);
              if (status.status === 'completed') {
                setHoProgress('✓ Completed');
                addLog('INFO', 'Hyperopt completed successfully');
                // Extract result from job status
                const p = (status.parsed ?? {}) as Record<string, unknown>;
                const output = status.output || '';
                // Parse key metrics from the "Best result:" line in output
                const bestMatch = output.match(/(\d+)\/\d+:\s+(\d+)\s+trades\..*?Avg profit\s+([\d.-]+)%.*?Total profit\s+([\d.-]+)\s+\w+\s+\(\s*([\d.-]+)%\).*?Avg duration\s+([\w:]+).*?Objective:\s+([\d.-]+)/);
                const newResult: HyperoptResult = {
                  id: results.length + 1,
                  loss: Number(p.objective ?? 0),
                  trades: bestMatch ? Number(bestMatch[2]) : Number(p.total_trades ?? 0),
                  winRate: bestMatch ? 100 : Number(p.win_rate ?? 0), // If all wins
                  profitPct: bestMatch ? Number(bestMatch[5]) : Number(p.profit_pct ?? 0),
                  profitAbs: bestMatch ? Number(bestMatch[4]) : Number(p.profit_abs ?? 0),
                  maxDrawdown: Number(p.max_drawdown ?? 0),
                  sharpe: 0,
                  sortino: 0,
                  avgDuration: bestMatch ? bestMatch[6] : String(p.avg_duration ?? '—'),
                  sampler: samplerLabel,
                  lossFunction: lfLabel,
                  spaces: customSpaces.join(', '),
                  epochs,
                  status: 'completed',
                  startedAt: new Date().toISOString(),
                  params: (p.params as Record<string, unknown>) ?? undefined,
                };
                // Parse win/draw/loss from output: "28/0/0 Wins/Draws/Losses"
                const wdlMatch = output.match(/(\d+)\/(\d+)\/(\d+)\s+Wins\/Draws\/Losses/);
                if (wdlMatch) {
                  const wins = Number(wdlMatch[1]);
                  const total = wins + Number(wdlMatch[2]) + Number(wdlMatch[3]);
                  newResult.winRate = total > 0 ? (wins / total) * 100 : 0;
                }
                if (bestMatch) {
                  addLog('INFO', `Best: epoch ${bestMatch[1]} — ${bestMatch[2]} trades, ${bestMatch[5]}% profit, objective ${bestMatch[7]}`);
                }
                setResults(prev => [...prev, newResult]);
                toast.success('Hyperopt completed');
              } else {
                setHoProgress('✗ Failed');
                const errMsg = status.output?.substring(0, 200) || 'Unknown error';
                addLog('ERROR', `Hyperopt failed: ${errMsg}`);
                toast.error(`Hyperopt failed: ${errMsg}`);
              }
            }
          } catch (pollErr) {
            clearInterval(pollInterval);
            setIsRunning(false);
            setHoProgress('✗ Lost connection');
            addLog('ERROR', `Lost connection to hyperopt job: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`);
            toast.error('Lost connection to hyperopt job');
          }
        }, 5000);
        pollRef.current = pollInterval;
      }
    } catch (err) {
      setIsRunning(false);
      setHoProgress('✗ Failed to start');
      const msg = err instanceof Error ? err.message : String(err);
      addLog('ERROR', `Failed to start hyperopt: ${msg}`);
      toast.error(`Failed to start hyperopt: ${msg}`);
    }
  };

  // ── Run Batch ────────────────────────────────────────────────────
  const handleRunBatch = async () => {
    if (selectedLossFunctions.length === 0 || selectedSamplers.length === 0) {
      toast.error('Select at least one loss function and one sampler');
      return;
    }

    const timerange = `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;

    // Build batch queue
    const batchQueue: BatchJob[] = [];
    for (const sampler of selectedSamplers) {
      for (const lf of selectedLossFunctions) {
        batchQueue.push({
          id: `${sampler}-${lf}`,
          sampler,
          lossFunction: lf,
          spaces: [...customSpaces],
          epochs,
          status: 'pending',
        });
      }
    }

    setBatchJobs(batchQueue);
    setIsRunning(true);
    setCompletedCount(0);
    setLogs([]);
    setHoProgress('batch running');
    addLog('INFO', `Starting batch: ${batchQueue.length} hyperopt runs`);
    addLog('INFO', `Timerange: ${timerange} | Epochs: ${epochs} | Spaces: [${customSpaces.join(', ')}]`);
    toast.info(`Starting batch: ${batchQueue.length} hyperopt runs`);

    // Run sequentially to avoid overloading the server
    for (let i = 0; i < batchQueue.length; i++) {
      const job = batchQueue[i];
      const samplerLabel = SAMPLERS.find(s => s.value === job.sampler)?.label ?? job.sampler;
      const lfLabel = LOSS_FUNCTIONS.find(l => l.value === job.lossFunction)?.label ?? job.lossFunction;
      addLog('INFO', `[batch ${i + 1}/${batchQueue.length}] Starting: ${samplerLabel} × ${lfLabel}`);
      setBatchJobs((prev) => prev.map((j) =>
        j.id === job.id ? { ...j, status: 'running' } : j
      ));

      try {
        const params: Record<string, unknown> = {
          strategy,
          timerange,
          epochs: job.epochs,
          spaces: job.spaces,
          loss: job.lossFunction,
          sampler: job.sampler,
        };
        if (minTrades) params.min_trades = Number(minTrades);
        if (jobs) params.jobs = Number(jobs);

        const res = await botHyperoptStart(botId, params);
        const jobId = res?.job_id;
        addLog('INFO', `[batch ${i + 1}] Job submitted — jobId=${jobId ?? 'N/A'}`);

        if (jobId) {
          // Poll this individual job until done
          let done = false;
          while (!done) {
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const status = await botHyperoptStatus(botId, jobId);
              addLog('INFO', `[batch ${i + 1}] poll: status=${status.status}`);
              if (status.status === 'completed' || status.status === 'failed') {
                done = true;
                const ok = status.status === 'completed';
                addLog(ok ? 'INFO' : 'ERROR', `[batch ${i + 1}] ${ok ? 'Completed' : 'Failed'}: ${samplerLabel} × ${lfLabel}`);
                setBatchJobs((prev) => prev.map((j) =>
                  j.id === job.id
                    ? { ...j, status: ok ? 'completed' : 'failed', jobId }
                    : j
                ));
                setCompletedCount((c) => c + 1);
              }
            } catch (pollErr) {
              done = true;
              addLog('ERROR', `[batch ${i + 1}] Poll error: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`);
              setBatchJobs((prev) => prev.map((j) =>
                j.id === job.id ? { ...j, status: 'failed' } : j
              ));
              setCompletedCount((c) => c + 1);
            }
          }
        }
      } catch (err) {
        addLog('ERROR', `[batch ${i + 1}] Start failed: ${err instanceof Error ? err.message : String(err)}`);
        setBatchJobs((prev) => prev.map((j) =>
          j.id === job.id ? { ...j, status: 'failed' } : j
        ));
        setCompletedCount((c) => c + 1);
      }
    }

    setIsRunning(false);
    setHoProgress('✓ Batch complete');
    addLog('INFO', `Batch complete: ${batchQueue.length} runs finished`);
    toast.success(`Batch complete: ${batchQueue.length} runs finished`);
    fetchResults();
  };

  // ── Stop ─────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsRunning(false);
    setHoProgress('');
    addLog('WARNING', 'Hyperopt stopped by user');
    toast.info('Hyperopt stopped');
  }, [toast, addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Sorted Results ───────────────────────────────────────────────
  const sortedResults = useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
    return copy;
  }, [results, sortBy, sortDir]);

  // ── Winner ───────────────────────────────────────────────────────
  const winner = useMemo(() => {
    if (results.length === 0) return null;
    return [...results].sort((a, b) => b.profitPct - a.profitPct)[0];
  }, [results]);

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const SortArrow = ({ col }: { col: typeof sortBy }) =>
    sortBy === col ? <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span> : null;

  return (
    <div className="flex gap-6 pb-12">
      {/* ══════════════ LEFT PANEL: FORM (380px) ══════════════ */}
      <div className="w-[380px] flex-shrink-0 space-y-4">
        {/* Basic Config */}
        <div className="bg-card border border-border rounded-card p-4">
          <h3 className="text-xs font-semibold text-foreground mb-4">Hyperopt Configuration</h3>
          <div className="space-y-3">
            <div>
              <label className={LABEL}>Test Name</label>
              <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Description (optional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Auto-generated if empty" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Strategy</label>
              <input type="text" value={strategy} readOnly className={`${INPUT} bg-muted/50 cursor-default opacity-70`} />
            </div>
            <div>
              <label className={LABEL}>Epochs</label>
              <input type="number" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
              </div>
            </div>
          </div>
        </div>

        {/* Space Presets */}
        <div className="bg-card border border-border rounded-card p-4">
          <h3 className="text-xs font-semibold text-foreground mb-3">Optimization Spaces</h3>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SPACE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePresetChange(preset.key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                  selectedPreset === preset.key
                    ? 'bg-primary border-primary text-white'
                    : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                {preset.label} ({preset.epochs}ep)
              </button>
            ))}
          </div>

          {/* Individual spaces */}
          <div className="flex flex-wrap gap-1.5">
            {ALL_SPACES.map((space) => (
              <Tooltip key={space.value} content={space.tip}>
                <button
                  onClick={() => toggleSpace(space.value)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all ${
                    customSpaces.includes(space.value)
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {space.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Loss Functions */}
        <div className="bg-card border border-border rounded-card p-4">
          <h3 className="text-xs font-semibold text-foreground mb-3">
            Loss Functions ({selectedLossFunctions.length}/{LOSS_FUNCTIONS.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {LOSS_FUNCTIONS.map((lf) => (
              <Tooltip key={lf.value} content={lf.tip}>
                <button
                  onClick={() => toggleLossFunction(lf.value)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                    selectedLossFunctions.includes(lf.value)
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {lf.label}
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setSelectedLossFunctions(LOSS_FUNCTIONS.map(l => l.value))} className="text-[10px] text-primary hover:underline">Select All</button>
            <button onClick={() => setSelectedLossFunctions([])} className="text-[10px] text-muted-foreground hover:underline">Clear</button>
          </div>
        </div>

        {/* Samplers */}
        <div className="bg-card border border-border rounded-card p-4">
          <h3 className="text-xs font-semibold text-foreground mb-3">
            Samplers ({selectedSamplers.length}/{SAMPLERS.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLERS.map((s) => (
              <Tooltip key={s.value} content={s.tip}>
                <button
                  onClick={() => toggleSampler(s.value)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                    selectedSamplers.includes(s.value)
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'bg-transparent border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {s.label}
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setSelectedSamplers(SAMPLERS.map(s => s.value))} className="text-[10px] text-primary hover:underline">Select All</button>
            <button onClick={() => setSelectedSamplers([])} className="text-[10px] text-muted-foreground hover:underline">Clear</button>
          </div>
        </div>

        {/* Batch Info */}
        <div className="bg-[rgba(99,102,241,0.06)] border border-primary/20 rounded-card p-3">
          <div className="text-xs text-foreground font-semibold mb-1">
            Batch: {totalBatchRuns} run{totalBatchRuns !== 1 ? 's' : ''}
          </div>
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            {selectedSamplers.length} sampler{selectedSamplers.length !== 1 ? 's' : ''} × {selectedLossFunctions.length} loss fn{selectedLossFunctions.length !== 1 ? 's' : ''} × {epochs} epochs
            <br />
            Spaces: [{customSpaces.join(', ')}]
          </div>
        </div>

        {/* Advanced */}
        <div className="bg-card border border-border rounded-card p-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-foreground flex items-center gap-1 w-full"
          >
            Advanced Options <span className="text-muted-foreground">{showAdvanced ? '▾' : '▸'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Min Trades</label>
                  <input type="number" value={minTrades} onChange={(e) => setMinTrades(e.target.value)} placeholder="No min" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Max Trades</label>
                  <input type="number" value={maxTrades} onChange={(e) => setMaxTrades(e.target.value)} placeholder="No max" className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Random State</label>
                  <input type="number" value={randomState} onChange={(e) => setRandomState(e.target.value)} placeholder="Random" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Jobs (CPU)</label>
                  <input type="number" value={jobs} onChange={(e) => setJobs(e.target.value)} className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Effort ({effort.toFixed(1)})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={effort}
                  onChange={(e) => setEffort(Number(e.target.value))}
                  className="w-full accent-primary h-1"
                />
              </div>
              <Toggle checked={earlyStop} onChange={setEarlyStop} label="Early Stop" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {totalBatchRuns > 1 ? (
            <button
              onClick={handleRunBatch}
              disabled={isRunning || selectedLossFunctions.length === 0 || selectedSamplers.length === 0}
              className="w-full h-[34px] inline-flex items-center justify-center gap-[6px] rounded-btn text-xs font-medium border bg-primary border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <>
                  <div className="animate-spin">⟳</div>
                  Running {completedCount}/{totalBatchRuns}...
                </>
              ) : (
                <>▶ Run Batch ({totalBatchRuns} runs)</>
              )}
            </button>
          ) : (
            <button
              onClick={handleRunSingle}
              disabled={isRunning || selectedLossFunctions.length === 0 || selectedSamplers.length === 0}
              className="w-full h-[34px] inline-flex items-center justify-center gap-[6px] rounded-btn text-xs font-medium border bg-primary border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <>
                  <div className="animate-spin">⟳</div>
                  Running Hyperopt...
                </>
              ) : (
                <>▶ Run Single Hyperopt</>
              )}
            </button>
          )}

          {isRunning && (
            <button
              onClick={handleStop}
              className="w-full h-[34px] inline-flex items-center justify-center gap-[6px] rounded-btn text-xs font-medium border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-colors"
            type="button"
            >
              ■ Stop
            </button>
          )}
        </div>

        {/* ═══════════ LOG WINDOW ═══════════ */}
        <div className="flex flex-col mt-2 flex-1 min-h-[120px]">
          <div className="flex items-center justify-between mb-[4px]">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px]">Log</span>
            <div className="flex items-center gap-2">
              {hoProgress && (
                <span className="text-xs text-primary font-medium">{hoProgress}</span>
              )}
              {isRunning && (
                <span className="w-[6px] h-[6px] rounded-full bg-green animate-pulse" />
              )}
              {logs.length > 0 && (
                <button
                  onClick={() => { setLogs([]); setHoProgress(""); }}
                  type="button"
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
                Logs will appear here when hyperopt starts...
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

      {/* ══════════════ RIGHT PANEL: RESULTS ══════════════ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Batch Progress (only when running batch) */}
        {isRunning && batchJobs.length > 0 && (
          <div className="bg-card border border-border rounded-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">Batch Progress</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {completedCount}/{batchJobs.length} ({Math.round((completedCount / batchJobs.length) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mb-3">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${(completedCount / batchJobs.length) * 100}%` }}
              />
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {batchJobs.map((job) => {
                const samplerLabel = SAMPLERS.find(s => s.value === job.sampler)?.label ?? job.sampler;
                const lfLabel = LOSS_FUNCTIONS.find(l => l.value === job.lossFunction)?.label ?? job.lossFunction;
                return (
                  <div key={job.id} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      job.status === 'completed' ? 'bg-emerald-500' :
                      job.status === 'running' ? 'bg-primary animate-pulse' :
                      job.status === 'failed' ? 'bg-rose-500' :
                      'bg-muted-foreground/30'
                    }`} />
                    <span className="text-muted-foreground truncate">
                      {samplerLabel} × {lfLabel}
                    </span>
                    <span className={`ml-auto shrink-0 font-medium ${
                      job.status === 'completed' ? 'text-emerald-400' :
                      job.status === 'running' ? 'text-primary' :
                      job.status === 'failed' ? 'text-rose-400' :
                      'text-muted-foreground'
                    }`}>{job.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Winner Banner */}
        {winner && !isRunning && (
          <div className="bg-[rgba(34,197,94,0.06)] border border-emerald-500/20 rounded-card p-4 flex items-center gap-4">
            <span className="text-2xl">🏆</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-emerald-400 mb-0.5">Best Result</div>
              <div className="text-xs text-muted-foreground">
                {winner.sampler} × {winner.lossFunction} — {winner.spaces}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${winner.profitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmtPctRatio(winner.profitPct / 100)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Sharpe {fmtNum(winner.sharpe)} · WR {winner.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => onNavigateToTab?.(5)}
                className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all"
              >
                → Verify
              </button>
              <button onClick={() => toast.success('Best hyperopt promoted to active version ★')} className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-all">
                Promote ★
              </button>
            </div>
          </div>
        )}

        {/* Results Master Table */}

        {/* Optimized Parameters Display (§432-436) */}
        {winner && winner.params && Object.keys(winner.params).length > 0 && !isRunning && (
          <div className="bg-card border border-border rounded-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground">Optimized Parameters</span>
              <span className="text-[10px] text-muted-foreground">
                {winner.sampler} × {winner.lossFunction}
              </span>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Parameter</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(winner.params).map(([key, value]) => (
                    <tr key={key} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-mono text-foreground">{key}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-primary font-medium">
                        {typeof value === 'number' ? value.toFixed(4).replace(/\.?0+$/, '') : String(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sortedResults.length > 0 ? (() => {
          const totalResPages = Math.ceil(sortedResults.length / resultsPerPage);
          const pagedResults = sortedResults.slice((resultsPage - 1) * resultsPerPage, resultsPage * resultsPerPage);
          return (
          <div className="bg-card border border-border rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Hyperopt Results ({sortedResults.length})
              </span>
              <button
                onClick={fetchResults}
                className="text-[10px] text-primary hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">#</th>
                    <th className="text-left px-3 py-2 font-semibold">Sampler</th>
                    <th className="text-left px-3 py-2 font-semibold">Loss Function</th>
                    <th className="text-left px-3 py-2 font-semibold">Spaces</th>
                    <th className="text-right px-3 py-2 font-semibold">Epochs</th>
                    <th className="text-right px-3 py-2 font-semibold">Trades</th>
                    <th className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-primary select-none" onClick={() => handleSort('winRate')}>
                      Win% <SortArrow col="winRate" />
                    </th>
                    <th className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-primary select-none" onClick={() => handleSort('profitPct')}>
                      Profit% <SortArrow col="profitPct" />
                    </th>
                    <th className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-primary select-none" onClick={() => handleSort('maxDrawdown')}>
                      Max DD <SortArrow col="maxDrawdown" />
                    </th>
                    <th className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-primary select-none" onClick={() => handleSort('sharpe')}>
                      Sharpe <SortArrow col="sharpe" />
                    </th>
                    <th className="text-right px-3 py-2 font-semibold cursor-pointer hover:text-primary select-none" onClick={() => handleSort('sortino')}>
                      Sortino <SortArrow col="sortino" />
                    </th>
                    <th className="text-right px-3 py-2 font-semibold">Avg Duration</th>
                    <th className="text-center px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedResults.map((r, idx) => {
                    const isWinner = winner?.id === r.id;
                    const globalIdx = (resultsPage - 1) * resultsPerPage + idx;
                    return (
                      <tr
                        key={r.id}
                        className={`border-t border-border hover:bg-muted/30 ${isWinner ? 'bg-emerald-500/5' : ''}`}
                      >
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {isWinner ? <span className="text-amber-400">★</span> : globalIdx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono">{r.sampler}</td>
                        <td className="px-3 py-2">{r.lossFunction}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.spaces}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.epochs}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.trades}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.winRate.toFixed(1)}%</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.profitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {r.profitPct >= 0 ? '+' : ''}{r.profitPct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-400">
                          -{Math.abs(r.maxDrawdown).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.sharpe)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.sortino)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{r.avgDuration}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => onNavigateToTab?.(5)}
                              className="px-1.5 py-0.5 text-[9px] border border-primary/30 text-primary rounded hover:bg-primary/10 transition"
                            >
                              → Verify
                            </button>
                            <button
                              onClick={() => onNavigateToTab?.(3)}
                              className="px-1.5 py-0.5 text-[9px] border border-amber-500/30 text-amber-400 rounded hover:bg-amber-500/10 transition"
                            >
                              → FreqAI
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalResPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  Showing {(resultsPage - 1) * resultsPerPage + 1}-{Math.min(resultsPage * resultsPerPage, sortedResults.length)} of {sortedResults.length}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setResultsPage(p => Math.max(1, p - 1))} disabled={resultsPage === 1}
                    className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all">← Prev</button>
                  <button onClick={() => setResultsPage(p => Math.min(totalResPages, p + 1))} disabled={resultsPage === totalResPages}
                    className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all">Next →</button>
                </div>
              </div>
            )}
          </div>
          );
        })() : (
          <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[200px]">
            <div className="text-[32px] mb-3 opacity-30">⚡</div>
            <div className="text-sm font-semibold text-muted-foreground mb-1">No hyperopt results yet</div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              Configure loss functions, samplers, and spaces, then click &quot;Run&quot; to start hyperparameter optimization.
            </div>
          </div>
        )}

        {/* ── Hyperopt History ── */}
        {hoRuns.length > 0 && (() => {
          const totalHoPages = Math.ceil(hoRuns.length / hoPerPage);
          const pagedHoRuns = hoRuns.slice((hoPage - 1) * hoPerPage, hoPage * hoPerPage);
          return (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Hyperopt History ({hoRuns.length})
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left px-3 py-2 font-semibold">Run Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Strategy</th>
                      <th className="text-right px-3 py-2 font-semibold">Epochs</th>
                      <th className="text-right px-3 py-2 font-semibold">Size</th>
                      <th className="text-center px-3 py-2 font-semibold w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHoRuns.map((run) => {
                      const isConfirming = hoConfirmDelete === run.filename;
                      const runDate = new Date(run.mtime * 1000);
                      const runStr = `${runDate.getFullYear()}-${String(runDate.getMonth()+1).padStart(2,'0')}-${String(runDate.getDate()).padStart(2,'0')} ${String(runDate.getHours()).padStart(2,'0')}:${String(runDate.getMinutes()).padStart(2,'0')}`;
                      const sizeKb = (run.size_bytes / 1024).toFixed(0);
                      return (
                        <tr key={run.filename} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{runStr}</td>
                          <td className="px-3 py-2 font-mono text-foreground">{run.strategy}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{run.epochs}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{sizeKb} KB</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={fetchResults}
                                className="text-[10px] px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary rounded hover:bg-primary/20 transition-all"
                              >Load</button>
                              {isConfirming ? (
                                <button
                                  onClick={() => { setHoConfirmDelete(null); handleDeleteRun(run.filename); }}
                                  className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded hover:bg-rose-500/30 transition-all animate-pulse"
                                >Confirm?</button>
                              ) : (
                                <button
                                  onClick={() => setHoConfirmDelete(run.filename)}
                                  className="text-[10px] px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400/70 rounded hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                                >Delete</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalHoPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground">
                    Showing {(hoPage - 1) * hoPerPage + 1}-{Math.min(hoPage * hoPerPage, hoRuns.length)} of {hoRuns.length}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setHoPage(p => Math.max(1, p - 1))} disabled={hoPage === 1}
                      className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all">← Prev</button>
                    <button onClick={() => setHoPage(p => Math.min(totalHoPages, p + 1))} disabled={hoPage === totalHoPages}
                      className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all">Next →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
