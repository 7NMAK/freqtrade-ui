'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { INPUT, SELECT, LABEL, BTN_ACTION } from '@/lib/design';
import { getExperimentRuns, type ExperimentRun } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

type SortKey = 'date' | 'profit' | 'sharpe' | 'winRate';
type StatusFilter = 'All' | 'Running' | 'Done' | 'Failed';
type TestType = 'All Types' | 'backtest' | 'hyperopt' | 'freqai' | 'verification' | 'ai_review';

interface AllTestsOverlayProps {
  onClose: () => void;
  strategy: string;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
  onOpenOverlay?: (overlay: string) => void;
}

export default function AllTestsOverlay({ onClose, strategy, experimentId, onNavigateToTab, onOpenOverlay }: AllTestsOverlayProps) {
  const toast = useToast();
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [filterType, setFilterType] = useState<TestType>('All Types');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [promotedId, setPromotedId] = useState<number | null>(null);
  const itemsPerPage = 20;

  // ── Escape key handler ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Fetch runs from API ──────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    if (!experimentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getExperimentRuns(experimentId);
      if (Array.isArray(data)) {
        setRuns(data);
      }
    } catch (err) {
      toast.error(`Failed to load runs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [experimentId, toast]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // ── Filter + Sort ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...runs];

    if (filterType !== 'All Types') {
      result = result.filter((t) => t.run_type === filterType);
    }

    if (filterStatus !== 'All') {
      const statusMap: Record<string, string> = { Running: 'running', Done: 'completed', Failed: 'failed' };
      result = result.filter((t) => t.status === statusMap[filterStatus]);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        (t.sampler?.toLowerCase().includes(q)) ||
        (t.loss_function?.toLowerCase().includes(q)) ||
        (t.run_type?.toLowerCase().includes(q)) ||
        String(t.id).includes(q)
      );
    }

    return result;
  }, [runs, filterType, filterStatus, searchQuery]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'profit':
          return (b.profit_pct ?? 0) - (a.profit_pct ?? 0);
        case 'sharpe':
          return (b.sharpe_ratio ?? 0) - (a.sharpe_ratio ?? 0);
        case 'winRate':
          return (b.win_rate ?? 0) - (a.win_rate ?? 0);
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paged = sorted.slice(start, start + itemsPerPage);

  // ── Type counts ──────────────────────────────────────────────────
  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    runs.forEach((r) => { counts[r.run_type] = (counts[r.run_type] ?? 0) + 1; });
    return counts;
  }, [runs]);

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { running: 0, completed: 0, failed: 0 };
    runs.forEach((r) => { if (r.status in counts) counts[r.status]++; });
    return counts;
  }, [runs]);

  const formatProfit = (v: number | null) => {
    if (v == null) return '—';
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  };

  const profitColor = (v: number | null) => {
    if (v == null) return 'text-muted-foreground';
    return v >= 0 ? 'text-emerald-400' : 'text-rose-400';
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      running: { bg: 'bg-primary/10', text: 'text-primary', label: 'Running' },
      completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Done' },
      failed: { bg: 'bg-rose-500/10', text: 'text-rose-400', label: 'Failed' },
      pending: { bg: 'bg-muted/50', text: 'text-muted-foreground', label: 'Pending' },
      promoted: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Promoted' },
    };
    const cfg = map[status] ?? map.pending;
    return (
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
    );
  };

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      backtest: 'text-blue-400',
      hyperopt: 'text-purple-400',
      freqai: 'text-amber-400',
      verification: 'text-emerald-400',
      ai_review: 'text-cyan-400',
    };
    return (
      <span className={`text-[10px] font-semibold uppercase ${map[type] ?? 'text-muted-foreground'}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Filter bar */}
      <div className="border-b border-border px-[16px] py-[12px] space-y-[12px]">
        <div className="flex gap-[12px] items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className={LABEL}>Search</label>
            <input
              type="text"
              placeholder="Search by sampler, loss function..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className={SELECT}>
              <option value="date">Date</option>
              <option value="profit">Profit</option>
              <option value="sharpe">Sharpe</option>
              <option value="winRate">Win Rate</option>
            </select>
          </div>
        </div>

        {/* Type filters */}
        <div className="flex gap-[8px] flex-wrap">
          {(['All Types', 'backtest', 'hyperopt', 'freqai', 'verification', 'ai_review'] as const).map((type) => {
            const count = type === 'All Types' ? runs.length : (countByType[type] ?? 0);
            return (
              <button
                key={type}
                onClick={() => { setFilterType(type); setCurrentPage(1); }}
                className={`px-[12px] py-[4px] rounded-full text-xs font-semibold uppercase tracking-[0.5px] border transition ${
                  filterType === type
                    ? 'bg-primary border-primary text-white'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'All Types' ? 'All' : type} ({count})
              </button>
            );
          })}
        </div>

        {/* Status filters */}
        <div className="flex gap-[8px]">
          {(['All', 'Running', 'Done', 'Failed'] as const).map((status) => {
            const statusKey = status === 'All' ? '' : status.toLowerCase();
            const count = status === 'All'
              ? runs.length
              : (countByStatus[statusKey === 'done' ? 'completed' : statusKey] ?? 0);
            return (
              <button
                key={status}
                onClick={() => { setFilterStatus(status); setCurrentPage(1); }}
                className={`px-[12px] py-[4px] rounded-full text-xs font-semibold uppercase tracking-[0.5px] border transition ${
                  filterStatus === status
                    ? 'bg-primary border-primary text-white'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {status} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground font-semibold">
          {sorted.length} test{sorted.length !== 1 ? 's' : ''} for {strategy}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin text-2xl text-primary">⟳</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && paged.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-[16px] py-[40px]">
          <div className="text-sm font-semibold text-muted-foreground mb-[8px]">No tests found</div>
          <div className="text-xs text-muted-foreground max-w-xs text-center">
            {runs.length === 0
              ? 'Run a backtest, hyperopt, or FreqAI test first.'
              : 'No tests match your current filters.'}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && paged.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-center w-8">★</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-left">#</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-left">Type</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-left">Sampler</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-left">Loss Fn</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-left">Spaces</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-left">Date</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">Trades</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">Win%</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">Profit%</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">Max DD</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">Sharpe</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">Sortino</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">Status</th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((run) => (
                <React.Fragment key={run.id}>
                <tr
                  onClick={() => setExpandedRow(expandedRow === run.id ? null : run.id)}
                  className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${promotedId === run.id ? 'bg-amber-500/5' : ''} ${expandedRow === run.id ? 'bg-muted/20' : ''}`}
                >
                  <td className="py-[6px] px-[10px] text-center">
                    {promotedId === run.id ? <span className="text-amber-400">★</span> : <span className="text-muted-foreground/30">☆</span>}
                  </td>
                  <td className="py-[6px] px-[10px] text-xs tabular-nums text-muted-foreground">{run.id}</td>
                  <td className="py-[6px] px-[10px]">{typeBadge(run.run_type)}</td>
                  <td className="py-[6px] px-[10px] text-xs font-mono">{run.sampler ?? '—'}</td>
                  <td className="py-[6px] px-[10px] text-xs">{run.loss_function ?? '—'}</td>
                  <td className="py-[6px] px-[10px] text-xs text-muted-foreground">
                    {run.spaces ? run.spaces.join(', ') : '—'}
                  </td>
                  <td className="py-[6px] px-[10px] text-xs text-muted-foreground whitespace-nowrap">
                    {run.created_at ? new Date(run.created_at).toISOString().replace('T', ' ').substring(0, 19) : '—'}
                  </td>
                  <td className="py-[6px] px-[10px] text-xs text-right tabular-nums">{run.total_trades ?? '—'}</td>
                  <td className="py-[6px] px-[10px] text-xs text-right tabular-nums">
                    {run.win_rate != null ? `${run.win_rate.toFixed(1)}%` : '—'}
                  </td>
                  <td className={`py-[6px] px-[10px] text-xs text-right tabular-nums font-medium ${profitColor(run.profit_pct)}`}>
                    {formatProfit(run.profit_pct)}
                  </td>
                  <td className="py-[6px] px-[10px] text-xs text-right tabular-nums text-rose-400">
                    {run.max_drawdown != null ? `-${Math.abs(run.max_drawdown).toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-[6px] px-[10px] text-xs text-right tabular-nums">
                    {run.sharpe_ratio?.toFixed(2) ?? '—'}
                  </td>
                  <td className="py-[6px] px-[10px] text-xs text-right tabular-nums">
                    {run.sortino_ratio?.toFixed(2) ?? '—'}
                  </td>
                  <td className="py-[6px] px-[10px] text-center">{statusBadge(run.status)}</td>
                  <td className="py-[6px] px-[10px] text-center">
                    <span className="text-[10px] text-muted-foreground">{expandedRow === run.id ? '▲' : '▼'}</span>
                  </td>
                </tr>
                {/* Expanded Row (§1120-1125) */}
                {expandedRow === run.id && (
                  <tr className="bg-muted/10">
                    <td colSpan={15} className="px-[16px] py-[10px]">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigateToTab?.(5); onClose(); }}
                          className={`${BTN_ACTION} border-primary/40 text-primary hover:bg-primary/10`}
                        >→ Verify</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPromotedId(run.id); toast.success(`Promoted run #${run.id}`); }}
                          className={`${BTN_ACTION} border-amber-500/40 text-amber-400 hover:bg-amber-500/10`}
                        >Promote ★</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onClose(); onOpenOverlay?.('compare'); }}
                          className={`${BTN_ACTION} border-border text-muted-foreground hover:bg-muted`}
                        >Compare</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onClose(); onOpenOverlay?.('analysis'); }}
                          className={`${BTN_ACTION} border-border text-muted-foreground hover:bg-muted`}
                        >→ Analysis</button>
                        <div className="flex-1" />
                        <div className="text-[10px] text-muted-foreground">
                          Epochs: {run.epochs ?? '—'} · Timerange: {((run as unknown as Record<string, unknown>).timerange as string) ?? '—'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && paged.length > 0 && totalPages > 1 && (
        <div className="border-t border-border px-[16px] py-[12px] flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Showing {start + 1} to {Math.min(start + itemsPerPage, sorted.length)} of {sorted.length}
          </div>
          <div className="flex gap-[8px] items-center">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center h-[34px] px-[14px] rounded-btn text-xs font-medium border border-border bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <div className="flex gap-[4px] items-center">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`inline-flex items-center justify-center h-[34px] w-[34px] rounded-btn text-xs font-medium border transition ${
                      page === currentPage
                        ? 'bg-primary border-primary text-white'
                        : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="text-xs text-muted-foreground">...</span>}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center h-[34px] px-[14px] rounded-btn text-xs font-medium border border-border bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
