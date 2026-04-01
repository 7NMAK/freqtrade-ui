'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SELECT, LABEL, fmtNum } from '@/lib/design';
import { getExperimentRuns, type ExperimentRun } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface CompareOverlayProps {
  onClose: () => void;
  strategy: string;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

interface MetricRow {
  label: string;
  key: keyof ExperimentRun;
  format: (v: number | null) => string;
  higherBetter: boolean;
}

const METRICS: MetricRow[] = [
  { label: 'Total Trades', key: 'total_trades', format: (v) => v != null ? String(v) : '—', higherBetter: true },
  { label: 'Win Rate', key: 'win_rate', format: (v) => v != null ? `${v.toFixed(1)}%` : '—', higherBetter: true },
  { label: 'Avg Profit per Trade', key: 'profit_mean', format: (v) => v != null ? `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%` : '—', higherBetter: true },
  { label: 'Total Profit %', key: 'profit_pct', format: (v) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—', higherBetter: true },
  { label: 'Max Drawdown', key: 'max_drawdown', format: (v) => v != null ? `-${Math.abs(v).toFixed(2)}%` : '—', higherBetter: false },
  { label: 'Sharpe', key: 'sharpe_ratio', format: (v) => v != null ? fmtNum(v) : '—', higherBetter: true },
  { label: 'Sortino', key: 'sortino_ratio', format: (v) => v != null ? fmtNum(v) : '—', higherBetter: true },
  { label: 'Calmar', key: 'calmar_ratio', format: (v) => v != null ? fmtNum(v) : '—', higherBetter: true },
  { label: 'Avg Duration', key: 'avg_duration', format: (v) => v != null ? String(v) : '—', higherBetter: false },
  { label: 'Profit Factor', key: 'profit_factor', format: (v) => v != null ? fmtNum(v) : '—', higherBetter: true },
];

export default function CompareOverlay({ onClose, strategy, experimentId, onNavigateToTab }: CompareOverlayProps) {
  const toast = useToast();
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [testAId, setTestAId] = useState('');
  const [testBId, setTestBId] = useState('');
  const [loading, setLoading] = useState(true);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Fetch runs
  const fetchRuns = useCallback(async () => {
    if (!experimentId) { setLoading(false); return; }
    try {
      const data = await getExperimentRuns(experimentId, { status: 'completed' });
      if (Array.isArray(data)) setRuns(data);
    } catch (err) {
      toast.error(`Failed to load tests: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [experimentId, toast]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const hasTests = runs.length >= 2;
  const testA = runs.find(r => String(r.id) === testAId);
  const testB = runs.find(r => String(r.id) === testBId);
  const canCompare = testA && testB;

  // Summary
  const summary = useMemo(() => {
    if (!testA || !testB) return null;
    let aBetter = 0;
    let bBetter = 0;
    METRICS.forEach(m => {
      const aVal = (testA[m.key] as number) ?? 0;
      const bVal = (testB[m.key] as number) ?? 0;
      if (m.higherBetter ? aVal > bVal : aVal < bVal) aBetter++;
      else if (m.higherBetter ? bVal > aVal : bVal < aVal) bBetter++;
    });
    return { aBetter, bBetter, tie: METRICS.length - aBetter - bBetter };
  }, [testA, testB]);

  const runLabel = (r: ExperimentRun) =>
    `${r.run_type} #${r.id}${r.sampler ? ` · ${r.sampler}` : ''}${r.loss_function ? ` · ${r.loss_function}` : ''}${r.profit_pct != null ? ` · ${r.profit_pct >= 0 ? '+' : ''}${r.profit_pct.toFixed(1)}%` : ''}`;

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Compare Tests — {strategy}</h2>
        </div>

        {/* Test Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Test A (Baseline)</label>
            <select
              value={testAId}
              onChange={(e) => setTestAId(e.target.value)}
              className={SELECT}
              disabled={!hasTests}
            >
              <option value="">Select test...</option>
              {runs.map((run) => (
                <option key={run.id} value={String(run.id)}>{runLabel(run)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Test B (Comparison)</label>
            <select
              value={testBId}
              onChange={(e) => setTestBId(e.target.value)}
              className={SELECT}
              disabled={!hasTests}
            >
              <option value="">Select test...</option>
              {runs.filter(r => String(r.id) !== testAId).map((run) => (
                <option key={run.id} value={String(run.id)}>{runLabel(run)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin text-2xl text-primary">⟳</div>
        </div>
      )}

      {/* Not enough tests */}
      {!loading && !hasTests && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-sm font-semibold text-muted-foreground mb-[8px]">Not enough tests</div>
          <div className="text-xs text-muted-foreground max-w-xs text-center">
            Need at least 2 completed tests to compare. Run more tests first.
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {!loading && canCompare && (
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-4">
            {/* Summary */}
            {summary && (
              <div className="bg-[rgba(99,102,241,0.06)] border border-primary/20 rounded-card p-4 flex items-center justify-between">
                <div className="text-xs text-foreground">
                  <span className="font-semibold">Test A is better in {summary.aBetter}</span> of {METRICS.length} metrics.{' '}
                  <span className="font-semibold">Test B in {summary.bBetter}</span>.{' '}
                  {summary.tie > 0 && <span className="text-muted-foreground">{summary.tie} tied.</span>}
                </div>
                <button
                  onClick={() => onNavigateToTab?.(5)}
                  className="px-3 py-1 rounded-btn text-[10px] font-semibold border border-primary/30 text-primary hover:bg-primary/10 transition shrink-0"
                >
                  → Verify {summary.aBetter >= summary.bBetter ? 'A' : 'B'}
                </button>
              </div>
            )}

            {/* Comparison Table */}
            <div className="border border-border rounded-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Metric</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                      Test A ({testA.run_type} #{testA.id})
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-16">→</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                      Test B ({testB.run_type} #{testB.id})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => {
                    const aVal = (testA[m.key] as number) ?? null;
                    const bVal = (testB[m.key] as number) ?? null;
                    const aNum = aVal ?? 0;
                    const bNum = bVal ?? 0;
                    const aBetter = m.higherBetter ? aNum > bNum : aNum < bNum;
                    const bBetter = m.higherBetter ? bNum > aNum : bNum < aNum;
                    return (
                      <tr key={m.label} className="border-t border-border">
                        <td className="px-4 py-2.5 text-muted-foreground">{m.label}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${aBetter ? 'text-emerald-400' : ''}`}>
                          {m.format(aVal)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {aBetter ? <span className="text-emerald-400">←</span> : bBetter ? <span className="text-emerald-400">→</span> : <span className="text-muted-foreground">=</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${bBetter ? 'text-emerald-400' : ''}`}>
                          {m.format(bVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for selection */}
      {!loading && hasTests && !canCompare && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-sm font-semibold text-muted-foreground mb-[8px]">Select tests to compare</div>
          <div className="text-xs text-muted-foreground max-w-xs text-center">
            Choose Test A and Test B above to see a side-by-side comparison.
          </div>
        </div>
      )}
    </div>
  );
}
