'use client';

import { useState, useCallback, useEffect } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import { INPUT, SELECT, LABEL } from '@/lib/design';
import { useToast } from '@/components/ui/Toast';
import {
  botLookaheadAnalysis,
  botRecursiveAnalysis,
  botBacktestStart,
  botBacktestResults,
  getExperimentRuns,
  getExperiments,
  launchPaperBot,
} from '@/lib/api';
import { VERIFICATION_CRITERIA } from '@/lib/experiments';

// ── Types ─────────────────────────────────────────────────────────────
interface VerificationResult {
  training: { profitPct: number; winRate: number; maxDD: number; sharpe: number; trades: number };
  oos: { profitPct: number; winRate: number; maxDD: number; sharpe: number; trades: number };
  verdict: 'PASS' | 'FAIL';
  reasons: string[];
}

interface AnalysisResult {
  status: 'PASS' | 'FAIL' | 'WARNING';
  issues: Array<{ indicator: string; severity: string; description: string }>;
  output: string;
}

// ── Props ─────────────────────────────────────────────────────────────
interface ValidationTabProps {
  strategy: string;
  botId?: number;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

export default function ValidationTab({
  strategy,
  botId = 2,
  experimentId,
  onNavigateToTab,
}: ValidationTabProps) {
  const toast = useToast();
  const [launching, setLaunching] = useState(false);

  // ── Source data — from API ────────────────────────────────────────
  const [sourceRuns, setSourceRuns] = useState<Array<{
    id: number;
    name: string;
    run_type: string;
    sampler: string | null;
    loss_function: string | null;
    profit_pct: number | null;
    win_rate: number | null;
    max_drawdown: number | null;
    spaces: string[] | null;
  }>>([]);
  const [sourceLoaded, setSourceLoaded] = useState(false);

  // ── Verification form ────────────────────────────────────────────
  const [selectedRunId, setSelectedRunId] = useState('');
  const [verificationName, setVerificationName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-01-01');

  // ── Running state ────────────────────────────────────────────────
  const [isRunningVerification, setIsRunningVerification] = useState(false);
  const [isRunningLookahead, setIsRunningLookahead] = useState(false);
  const [isRunningRecursive, setIsRunningRecursive] = useState(false);

  // ── Results ──────────────────────────────────────────────────────
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [lookaheadResult, setLookaheadResult] = useState<AnalysisResult | null>(null);
  const [recursiveResult, setRecursiveResult] = useState<AnalysisResult | null>(null);

  // ── Load source runs from API ────────────────────────────────────
  const loadSourceRuns = useCallback(async () => {
    if (!experimentId) return;
    try {
      const runs = await getExperimentRuns(experimentId, { status: 'completed' });
      if (Array.isArray(runs)) {
        setSourceRuns(runs.map((r) => ({
          id: r.id,
          name: `${r.run_type} #${r.id}${r.sampler ? ` · ${r.sampler}` : ''}${r.loss_function ? ` · ${r.loss_function}` : ''}${r.profit_pct != null ? ` · ${r.profit_pct >= 0 ? '+' : ''}${r.profit_pct.toFixed(1)}%` : ''}`,
          run_type: r.run_type,
          sampler: r.sampler,
          loss_function: r.loss_function,
          profit_pct: r.profit_pct,
          win_rate: r.win_rate,
          max_drawdown: r.max_drawdown,
          spaces: r.spaces,
        })));
        setSourceLoaded(true);
      }
    } catch {
      toast.error('Failed to load experiment runs');
    }
  }, [experimentId, toast]);

  // Load on mount
  useEffect(() => { loadSourceRuns(); }, [loadSourceRuns]);

  // ── Verification Backtest ────────────────────────────────────────
  const handleRunVerification = async () => {
    if (!selectedRunId) {
      toast.error('Select a source test first');
      return;
    }

    setIsRunningVerification(true);
    setVerificationResult(null);
    toast.info('Starting verification backtest...');

    const timerange = `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;

    try {
      // Run a backtest with the same strategy on OOS data
      await botBacktestStart(botId, {
        strategy,
        timerange,
        export: 'trades',
      });

      // Poll for results
      const pollInterval = setInterval(async () => {
        try {
          const res = await botBacktestResults(botId);
          if (res && !res.running && res.backtest_result?.strategy) {
            clearInterval(pollInterval);
            
            // Extract OOS results
            const stratKey = Object.keys(res.backtest_result.strategy)[0];
            const oos = res.backtest_result.strategy[stratKey];
            
            // Get source run data for comparison
            const sourceRun = sourceRuns.find(r => String(r.id) === selectedRunId);
            
            if (oos && sourceRun) {
              const trainingProfit = sourceRun.profit_pct ?? 0;
              const oosProfit = (oos.profit_total ?? 0) * 100;
              const trainingWR = sourceRun.win_rate ?? 0;
              const oosWR = (oos.win_rate ?? 0) * 100;
              const trainingDD = Math.abs(sourceRun.max_drawdown ?? 0);
              const oosDD = Math.abs(oos.max_drawdown_account ?? 0) * 100;

              // Apply VERIFICATION_CRITERIA thresholds
              const reasons: string[] = [];
              
              const profitDrop = trainingProfit > 0 ? ((trainingProfit - oosProfit) / trainingProfit) * 100 : 0;
              if (profitDrop > VERIFICATION_CRITERIA.profit_drop_max) {
                reasons.push(`Profit dropped ${profitDrop.toFixed(0)}% (max allowed: ${VERIFICATION_CRITERIA.profit_drop_max}%)`);
              }

              const ddIncrease = trainingDD > 0 ? ((oosDD - trainingDD) / trainingDD) * 100 : 0;
              if (ddIncrease > VERIFICATION_CRITERIA.dd_increase_max) {
                reasons.push(`Drawdown increased ${ddIncrease.toFixed(0)}% (max allowed: ${VERIFICATION_CRITERIA.dd_increase_max}%)`);
              }

              const wrDrop = trainingWR - oosWR;
              if (wrDrop > VERIFICATION_CRITERIA.winrate_drop_max) {
                reasons.push(`Win rate dropped ${wrDrop.toFixed(1)}pp (max allowed: ${VERIFICATION_CRITERIA.winrate_drop_max}pp)`);
              }

              const verdict = reasons.length === 0 ? 'PASS' : 'FAIL';

              setVerificationResult({
                training: {
                  profitPct: trainingProfit,
                  winRate: trainingWR,
                  maxDD: trainingDD,
                  sharpe: 0, // Would need training sharpe from source
                  trades: 0,
                },
                oos: {
                  profitPct: oosProfit,
                  winRate: oosWR,
                  maxDD: oosDD,
                  sharpe: oos.sharpe ?? 0,
                  trades: oos.total_trades ?? 0,
                },
                verdict,
                reasons,
              });

              toast[verdict === 'PASS' ? 'success' : 'error'](`Verification: ${verdict}`);
            }
            setIsRunningVerification(false);
          }
        } catch {
          // Still running, keep polling
        }
      }, 3000);

      // Cleanup after 10 min max
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isRunningVerification) {
          setIsRunningVerification(false);
          toast.error('Verification timed out');
        }
      }, 600000);
    } catch (err) {
      setIsRunningVerification(false);
      toast.error(`Verification failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Lookahead Analysis ───────────────────────────────────────────
  const handleRunLookahead = async () => {
    setIsRunningLookahead(true);
    setLookaheadResult(null);
    toast.info('Starting lookahead analysis...');

    try {
      const res = await botLookaheadAnalysis(botId, {
        strategy,
        timerange: `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`,
      });

      // Parse the response
      const result = res as Record<string, unknown>;
      const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const hasIssues = output.toLowerCase().includes('fail') || output.toLowerCase().includes('leak') || output.toLowerCase().includes('bias');

      setLookaheadResult({
        status: hasIssues ? 'FAIL' : 'PASS',
        issues: [],
        output,
      });

      toast[hasIssues ? 'error' : 'success'](`Lookahead: ${hasIssues ? 'Issues found' : 'PASS'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLookaheadResult({
        status: 'FAIL',
        issues: [{ indicator: 'error', severity: 'critical', description: msg }],
        output: msg,
      });
      toast.error(`Lookahead analysis failed: ${msg}`);
    } finally {
      setIsRunningLookahead(false);
    }
  };

  // ── Recursive Analysis ───────────────────────────────────────────
  const handleRunRecursive = async () => {
    setIsRunningRecursive(true);
    setRecursiveResult(null);
    toast.info('Starting recursive analysis...');

    try {
      const res = await botRecursiveAnalysis(botId, {
        strategy,
        timerange: `${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`,
      });

      const result = res as Record<string, unknown>;
      const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const hasIssues = output.toLowerCase().includes('fail') || output.toLowerCase().includes('recursive') || output.toLowerCase().includes('cycle');

      setRecursiveResult({
        status: hasIssues ? 'FAIL' : 'PASS',
        issues: [],
        output,
      });

      toast[hasIssues ? 'error' : 'success'](`Recursive: ${hasIssues ? 'Issues found' : 'PASS'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRecursiveResult({
        status: 'FAIL',
        issues: [{ indicator: 'error', severity: 'critical', description: msg }],
        output: msg,
      });
      toast.error(`Recursive analysis failed: ${msg}`);
    } finally {
      setIsRunningRecursive(false);
    }
  };

  // ── All checks passed? ───────────────────────────────────────────
  const allPassed =
    verificationResult?.verdict === 'PASS' &&
    lookaheadResult?.status === 'PASS' &&
    recursiveResult?.status === 'PASS';

  return (
    <div className="space-y-4 pb-12">
      {/* ===== SECTION 1: VERIFICATION BACKTEST ===== */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-foreground">1. Verification Backtest (Out-of-Sample)</span>
        </div>

        <div className="space-y-3 mb-4">
          {/* Source Test */}
          <div>
            <label className={LABEL}>Source Test</label>
            <select
              value={selectedRunId}
              onChange={(e) => {
                setSelectedRunId(e.target.value);
                const run = sourceRuns.find(r => String(r.id) === e.target.value);
                if (run) {
                  setVerificationName(`OOS verify ${run.run_type} #${run.id}`);
                }
              }}
              className={SELECT}
            >
              <option value="">Select a completed test...</option>
              {sourceRuns.map((run) => (
                <option key={run.id} value={String(run.id)}>
                  {run.name}
                </option>
              ))}
            </select>
            {!sourceLoaded && experimentId && (
              <button onClick={loadSourceRuns} className="text-[10px] text-primary mt-1 hover:underline">
                Load tests from experiment
              </button>
            )}
            {!experimentId && (
              <p className="text-[10px] text-muted-foreground mt-1">
                No experiment context — navigate here from a specific experiment
              </p>
            )}
          </div>

          {/* Verification Name */}
          <div>
            <label className={LABEL}>Verification Name</label>
            <input
              type="text"
              value={verificationName}
              onChange={(e) => setVerificationName(e.target.value)}
              placeholder="Auto-generated from source test"
              className={INPUT}
            />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL}>Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this verification..."
              className={INPUT}
            />
          </div>

          {/* Date Range */}
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

          {/* Warning Box */}
          <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] rounded-btn px-3 py-2">
            <div className="flex gap-2">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-amber-500">Use a DIFFERENT time period from training!</strong>
                <br />
                <Tooltip content="Out-of-sample validation tests performance on data the strategy never saw during optimization. Must use a different date range.">
                  <span className="hover:underline cursor-help">Training period</span>
                </Tooltip>
                {' must not overlap with verification period.'}
              </div>
            </div>
          </div>

          {/* Verification Criteria */}
          <div className="bg-muted/50 border border-border rounded-btn p-3">
            <div className={`${LABEL} mb-2`}>Pass/Fail Thresholds</div>
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-1 px-2 text-muted-foreground">Max profit drop</td>
                  <td className="py-1 px-2 text-right font-mono text-amber-400">{VERIFICATION_CRITERIA.profit_drop_max}%</td>
                </tr>
                <tr>
                  <td className="py-1 px-2 text-muted-foreground">Max drawdown increase</td>
                  <td className="py-1 px-2 text-right font-mono text-amber-400">{VERIFICATION_CRITERIA.dd_increase_max}%</td>
                </tr>
                <tr>
                  <td className="py-1 px-2 text-muted-foreground">Max win rate drop</td>
                  <td className="py-1 px-2 text-right font-mono text-amber-400">{VERIFICATION_CRITERIA.winrate_drop_max}pp</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunVerification}
            disabled={isRunningVerification || !selectedRunId}
            className="w-full h-[34px] inline-flex items-center justify-center gap-[6px] px-[14px] rounded-btn text-xs font-medium border bg-primary border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunningVerification ? (
              <>
                <div className="animate-spin text-sm">⟳</div>
                Running Verification Backtest...
              </>
            ) : (
              <>▶ Run Verification Backtest</>
            )}
          </button>
        </div>

        {/* ===== VERIFICATION RESULTS ===== */}
        {!verificationResult ? (
          <div className="border-t border-border pt-4 mt-4">
            <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[200px]">
              <div className="text-[32px] mb-3 opacity-30">✓</div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">No verification yet</div>
              <div className="text-xs text-muted-foreground text-center max-w-[280px]">
                Select a source test and click &quot;Run Verification Backtest&quot; to test on new data.
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-border pt-4 mt-4 space-y-4">
            {/* Verdict Banner */}
            <div className={`rounded-card p-4 border ${
              verificationResult.verdict === 'PASS'
                ? 'bg-emerald-500/8 border-emerald-500/20'
                : 'bg-rose-500/8 border-rose-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{verificationResult.verdict === 'PASS' ? '✅' : '❌'}</span>
                <div>
                  <div className={`text-sm font-bold ${verificationResult.verdict === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {verificationResult.verdict}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {verificationResult.verdict === 'PASS'
                      ? 'Strategy passed out-of-sample validation'
                      : `${verificationResult.reasons.length} criteria failed`}
                  </div>
                </div>
              </div>
              {verificationResult.reasons.length > 0 && (
                <div className="mt-3 space-y-1">
                  {verificationResult.reasons.map((reason, i) => (
                    <div key={i} className="text-xs text-rose-400 flex gap-1.5">
                      <span>•</span> {reason}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Side-by-side Comparison Table */}
            <div className="border border-border rounded-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Metric</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Training (IS)</th>
                    <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Verification (OOS)</th>
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: 'Profit %', training: verificationResult.training.profitPct, oos: verificationResult.oos.profitPct, fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, higherBetter: true },
                    { label: 'Win Rate', training: verificationResult.training.winRate, oos: verificationResult.oos.winRate, fmt: (v: number) => `${v.toFixed(1)}%`, higherBetter: true },
                    { label: 'Max Drawdown', training: verificationResult.training.maxDD, oos: verificationResult.oos.maxDD, fmt: (v: number) => `-${v.toFixed(2)}%`, higherBetter: false },
                    { label: 'Sharpe', training: verificationResult.training.sharpe, oos: verificationResult.oos.sharpe, fmt: (v: number) => v.toFixed(2), higherBetter: true },
                    { label: 'Trades', training: verificationResult.training.trades, oos: verificationResult.oos.trades, fmt: (v: number) => String(v), higherBetter: true },
                  ] as const).map((row) => {
                    const delta = row.oos - row.training;
                    const better = row.higherBetter ? delta >= 0 : delta <= 0;
                    return (
                      <tr key={row.label} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.fmt(row.training)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{row.fmt(row.oos)}</td>
                        <td className={`px-3 py-2 text-center font-medium ${better ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            {verificationResult.verdict === 'PASS' && (
              <div className="flex gap-2">
                <button
                  disabled={launching}
                  onClick={async () => {
                    if (!confirm(`Launch paper trading bot for ${strategy}?\n\nThis will create a new Docker container and start paper trading immediately.`)) return;
                    setLaunching(true);
                    try {
                      const res = await getExperiments();
                      const exp = (res.items || []).find((e: { strategy_name?: string; name?: string }) => e.strategy_name === strategy || e.name === strategy);
                      const versionId = exp?.best_version_id || undefined;
                      const result = await launchPaperBot({
                        strategy_name: strategy,
                        strategy_version_id: versionId,
                        pair_whitelist: ['BTC/USDT:USDT'],
                        description: `Paper test from validation — ${strategy}${versionId ? ` v${versionId}` : ''}`,
                      });
                      toast.success(`🚀 ${result.message}`);
                    } catch (err) {
                      toast.error(`Launch failed: ${err instanceof Error ? err.message : String(err)}`);
                    } finally {
                      setLaunching(false);
                    }
                  }}
                  className="flex-1 h-[34px] inline-flex items-center justify-center gap-[6px] rounded-btn text-xs font-medium border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  {launching ? '⏳ Launching...' : '🚀 Launch Paper Trading'}
                </button>
              </div>
            )}
            {verificationResult.verdict === 'FAIL' && (
              <div className="flex gap-2">
                <button
                  onClick={() => onNavigateToTab?.(2)} // Back to Hyperopt
                  className="flex-1 h-[34px] inline-flex items-center justify-center gap-[6px] rounded-btn text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  ← Choose a different test
                </button>
                <button
                  onClick={() => { setVerificationResult(null); toast.info('Reset dates and re-run verification'); }}
                  className="flex-1 h-[34px] inline-flex items-center justify-center gap-[6px] rounded-btn text-xs font-medium border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  🔄 Re-run with different period
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== SECTION 2: LOOKAHEAD ANALYSIS ===== */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-foreground">
            2. Lookahead Analysis{' '}
            <Tooltip content="§21: Checks if strategy uses future data for decisions">
              <span className="text-muted-foreground text-xs cursor-help">(§21)</span>
            </Tooltip>
          </span>
          {lookaheadResult && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              lookaheadResult.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {lookaheadResult.status}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Checks if strategy &apos;cheats&apos; by using future data for decisions. Scans all entry and exit signals to ensure they only use data available AT the moment of the signal.
        </p>

        <button
          onClick={handleRunLookahead}
          disabled={isRunningLookahead}
          className="h-[34px] inline-flex items-center gap-[6px] px-[14px] rounded-btn text-xs font-medium border bg-primary border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          {isRunningLookahead ? (
            <>
              <div className="animate-spin text-sm">⟳</div>
              Running Lookahead Analysis...
            </>
          ) : (
            <>▶ Run Lookahead Analysis</>
          )}
        </button>

        {lookaheadResult ? (
          <div className="space-y-3">
            {lookaheadResult.issues.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left px-3 py-1.5 font-semibold">Indicator</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Severity</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookaheadResult.issues.map((issue, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{issue.indicator}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            issue.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>{issue.severity}</span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{issue.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {lookaheadResult.output && (
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Raw Output</summary>
                <pre className="mt-2 p-3 bg-muted/30 border border-border rounded-lg overflow-auto text-[10px] max-h-[300px] text-muted-foreground whitespace-pre-wrap">
                  {lookaheadResult.output}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[150px]">
            <div className="text-[32px] mb-3 opacity-30">⚡</div>
            <div className="text-sm font-semibold text-muted-foreground mb-1">No lookahead analysis yet</div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              Click &quot;Run Lookahead Analysis&quot; to check for future data leakage.
            </div>
          </div>
        )}
      </div>

      {/* ===== SECTION 3: RECURSIVE ANALYSIS ===== */}
      <div className="bg-card border border-border rounded-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-foreground">
            3. Recursive Analysis{' '}
            <Tooltip content="§22: Checks for circular indicator dependencies">
              <span className="text-muted-foreground text-xs cursor-help">(§22)</span>
            </Tooltip>
          </span>
          {recursiveResult && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              recursiveResult.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              {recursiveResult.status}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Checks if indicators depend on each other in a loop. If indicator A depends on B and B depends on A, that creates unstable signals that can break in live trading.
        </p>

        <button
          onClick={handleRunRecursive}
          disabled={isRunningRecursive}
          className="h-[34px] inline-flex items-center gap-[6px] px-[14px] rounded-btn text-xs font-medium border bg-primary border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          {isRunningRecursive ? (
            <>
              <div className="animate-spin text-sm">⟳</div>
              Running Recursive Analysis...
            </>
          ) : (
            <>▶ Run Recursive Analysis</>
          )}
        </button>

        {recursiveResult ? (
          <div className="space-y-3">
            {recursiveResult.issues.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left px-3 py-1.5 font-semibold">Indicator</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Severity</th>
                      <th className="text-left px-3 py-1.5 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recursiveResult.issues.map((issue, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{issue.indicator}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            issue.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>{issue.severity}</span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{issue.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {recursiveResult.output && (
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Raw Output</summary>
                <pre className="mt-2 p-3 bg-muted/30 border border-border rounded-lg overflow-auto text-[10px] max-h-[300px] text-muted-foreground whitespace-pre-wrap">
                  {recursiveResult.output}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[150px]">
            <div className="text-[32px] mb-3 opacity-30">🔄</div>
            <div className="text-sm font-semibold text-muted-foreground mb-1">No recursive analysis yet</div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              Click &quot;Run Recursive Analysis&quot; to check for circular indicator dependencies.
            </div>
          </div>
        )}
      </div>

      {/* ===== OVERALL VERDICT ===== */}
      {(verificationResult || lookaheadResult || recursiveResult) && (
        <div className={`rounded-card p-4 border ${
          allPassed
            ? 'bg-emerald-500/6 border-emerald-500/20'
            : 'bg-amber-500/6 border-amber-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{allPassed ? '🎯' : '⚠️'}</span>
            <div>
              <div className={`text-xs font-bold ${allPassed ? 'text-emerald-400' : 'text-amber-400'}`}>
                {allPassed ? 'All Validations Passed' : 'Validations Incomplete'}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Verification: {verificationResult ? verificationResult.verdict : 'Not run'} · 
                Lookahead: {lookaheadResult ? lookaheadResult.status : 'Not run'} · 
                Recursive: {recursiveResult ? recursiveResult.status : 'Not run'}
              </div>
            </div>
            {allPassed && (
              <button
                disabled={launching}
                onClick={async () => {
                  if (!confirm(`Launch paper trading for ${strategy}? This creates a new Docker container.`)) return;
                  setLaunching(true);
                  try {
                    const res = await getExperiments();
                    const exp = (res.items || []).find((e: { strategy_name?: string; name?: string }) => e.strategy_name === strategy || e.name === strategy);
                    const versionId = exp?.best_version_id || undefined;
                    const result = await launchPaperBot({
                      strategy_name: strategy,
                      strategy_version_id: versionId,
                      pair_whitelist: ['BTC/USDT:USDT'],
                    });
                    toast.success(`🚀 ${result.message}`);
                  } catch (err) {
                    toast.error(`Launch failed: ${err instanceof Error ? err.message : String(err)}`);
                  } finally {
                    setLaunching(false);
                  }
                }}
                className="ml-auto px-3 py-1.5 rounded-btn text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {launching ? '⏳ Launching...' : '🚀 Launch Paper Trading'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
