'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SELECT, LABEL, fmt$, fmtPctRatio } from '@/lib/design';
import {
  getExperimentRuns,
  botBacktestResults,
  type ExperimentRun,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

type AnalysisView = 'enter_tag' | 'exit_reason' | 'trading_list' | 'rejected' | 'indicator' | 'signal';

interface AnalysisOverlayProps {
  onClose: () => void;
  strategy: string;
  experimentId?: number;
  botId?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BacktestData = Record<string, any>;

export default function AnalysisOverlay({ onClose, strategy, experimentId, botId = 2 }: AnalysisOverlayProps) {
  const toast = useToast();
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<AnalysisView>('enter_tag');
  const [btData, setBtData] = useState<BacktestData | null>(null);
  const [btLoading, setBtLoading] = useState(false);

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

  // Load backtest data for selected run
  const loadBacktestData = useCallback(async () => {
    if (!selectedRunId) return;
    setBtLoading(true);
    try {
      // Fetch the backtest results that include enter_tag stats, exit_reason, etc.
      const res = await botBacktestResults(botId);
      if (res?.backtest_result?.strategy) {
        const stratKey = Object.keys(res.backtest_result.strategy)[0];
        if (stratKey) {
          setBtData(res.backtest_result.strategy[stratKey] as BacktestData);
        }
      }
    } catch {
      toast.error('Failed to load analysis data');
    } finally {
      setBtLoading(false);
    }
  }, [selectedRunId, botId, toast]);

  useEffect(() => { loadBacktestData(); }, [loadBacktestData]);

  const views = [
    { key: 'enter_tag' as const, label: 'Enter Tag Stats' },
    { key: 'exit_reason' as const, label: 'Exit Reason Stats' },
    { key: 'trading_list' as const, label: 'Trading List' },
    { key: 'rejected' as const, label: 'Rejected Signals' },
    { key: 'indicator' as const, label: 'Indicator Analysis' },
    { key: 'signal' as const, label: 'Signal Analysis' },
  ];

  const runLabel = (r: ExperimentRun) =>
    `${r.run_type} #${r.id}${r.sampler ? ` · ${r.sampler}` : ''}${r.loss_function ? ` · ${r.loss_function}` : ''}`;

  // ── Extract data from backtest results ───────────────────────────

  const enterTagStats = useMemo(() => {
    if (!btData?.results_per_enter_tag) return [];
    return btData.results_per_enter_tag as Array<{
      key: string; trades: number; profit_mean: number; profit_total: number;
      profit_total_abs: number; duration_avg: string; wins: number; draws: number; losses: number;
    }>;
  }, [btData]);

  const exitReasonStats = useMemo(() => {
    if (!btData?.exit_reason_summary) return [];
    return btData.exit_reason_summary as Array<{
      key?: string; exit_reason?: string; trades: number; profit_mean: number;
      profit_total: number; profit_total_abs: number; wins: number; losses: number;
    }>;
  }, [btData]);

  const trades = useMemo(() => {
    if (!btData?.trades) return [];
    return btData.trades as Array<Record<string, unknown>>;
  }, [btData]);

  const rejectedSignals = useMemo(() => {
    return btData?.rejected_signals as number ?? 0;
  }, [btData]);

  // Pagination for trading list
  const [tradePage, setTradePage] = useState(1);
  const tradesPerPage = 25;
  const totalTradePages = Math.ceil(trades.length / tradesPerPage);
  const pagedTrades = trades.slice((tradePage - 1) * tradesPerPage, tradePage * tradesPerPage);

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Analysis — {strategy}</h2>
        </div>

        {/* Source selector */}
        <div className="flex gap-3 items-end flex-wrap">
          <div className="min-w-[260px]">
            <label className={LABEL}>Select Test</label>
            <select
              value={selectedRunId}
              onChange={(e) => { setSelectedRunId(e.target.value); setTradePage(1); }}
              className={SELECT}
            >
              <option value="">Select a completed test...</option>
              {runs.map((run) => (
                <option key={run.id} value={String(run.id)}>{runLabel(run)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {runs.filter(r => r.status === 'completed').slice(0, 8).map((run) => (
              <label key={run.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-btn text-[10px] border cursor-pointer transition ${
                compareIds.has(String(run.id))
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}>
                <input
                  type="checkbox"
                  checked={compareIds.has(String(run.id))}
                  onChange={(e) => {
                    const next = new Set(compareIds);
                    if (e.target.checked) next.add(String(run.id));
                    else next.delete(String(run.id));
                    setCompareIds(next);
                  }}
                  className="sr-only"
                />
                #{run.id} {run.run_type}
              </label>
            ))}
            {compareIds.size >= 2 && (
              <span className="text-[10px] text-emerald-400 font-semibold">✓ {compareIds.size} selected for compare</span>
            )}
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex gap-1 flex-wrap">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setActiveView(v.key)}
              className={`px-3 py-1.5 rounded-btn text-xs font-semibold border transition ${
                activeView === v.key
                  ? 'bg-primary border-primary text-white'
                  : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {(loading || btLoading) && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin text-2xl text-primary">⟳</div>
        </div>
      )}

      {/* No data */}
      {!loading && !btLoading && (!selectedRunId || !btData) && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="text-sm font-semibold text-muted-foreground mb-2">
            {!selectedRunId ? 'Select a test to analyze' : 'No analysis data available'}
          </div>
          <div className="text-xs text-muted-foreground max-w-xs text-center">
            {!selectedRunId
              ? 'Choose a completed test from the dropdown above.'
              : 'Run a backtest first, then select it here.'}
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !btLoading && selectedRunId && btData && (
        <div className="flex-1 overflow-auto p-6">

          {/* ═══ Enter Tag Stats ═══ */}
          {activeView === 'enter_tag' && (
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-3">Enter Tag Stats</h3>
              {enterTagStats.length > 0 ? (
                <div className="border border-border rounded-card overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="text-left px-3 py-2 font-semibold">Enter Tag</th>
                        <th className="text-right px-3 py-2 font-semibold">Trades</th>
                        <th className="text-right px-3 py-2 font-semibold">Win Rate</th>
                        <th className="text-right px-3 py-2 font-semibold">Avg Profit</th>
                        <th className="text-right px-3 py-2 font-semibold">Total Profit</th>
                        <th className="text-right px-3 py-2 font-semibold">Profit ($)</th>
                        <th className="text-right px-3 py-2 font-semibold">Avg Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enterTagStats.map((tag) => {
                        const wr = tag.trades > 0 ? (tag.wins / tag.trades) * 100 : 0;
                        return (
                          <tr key={tag.key} className="border-t border-border hover:bg-muted/30">
                            <td className="px-3 py-2 font-mono text-foreground">{tag.key}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{tag.trades}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{wr.toFixed(1)}%</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${tag.profit_mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {fmtPctRatio(tag.profit_mean)}
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums ${tag.profit_total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {fmtPctRatio(tag.profit_total)}
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums font-medium ${tag.profit_total_abs >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {fmt$(tag.profit_total_abs)}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{tag.duration_avg}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-6 text-center border border-border rounded-card">
                  No enter tag data available. Ensure your strategy uses enter_tag labels.
                </div>
              )}
            </div>
          )}

          {/* ═══ Exit Reason Stats ═══ */}
          {activeView === 'exit_reason' && (
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-3">Exit Reason Stats</h3>
              {exitReasonStats.length > 0 ? (
                <div className="border border-border rounded-card overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="text-left px-3 py-2 font-semibold">Exit Reason</th>
                        <th className="text-right px-3 py-2 font-semibold">Trades</th>
                        <th className="text-right px-3 py-2 font-semibold">W/L</th>
                        <th className="text-right px-3 py-2 font-semibold">Avg Profit</th>
                        <th className="text-right px-3 py-2 font-semibold">Total Profit</th>
                        <th className="text-right px-3 py-2 font-semibold">Profit ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exitReasonStats.map((r, idx) => (
                        <tr key={idx} className="border-t border-border hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-foreground">{r.exit_reason ?? r.key ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.trades}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.wins}W / {r.losses}L</td>
                          <td className={`px-3 py-2 text-right tabular-nums ${r.profit_mean >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmtPctRatio(r.profit_mean)}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums ${r.profit_total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmtPctRatio(r.profit_total)}
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.profit_total_abs >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmt$(r.profit_total_abs)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-6 text-center border border-border rounded-card">
                  No exit reason data available.
                </div>
              )}
            </div>
          )}

          {/* ═══ Trading List ═══ */}
          {activeView === 'trading_list' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-foreground">
                  Trading List ({trades.length} trades)
                </h3>
                <button
                  onClick={() => {
                    const headers = ['trade_id','pair','is_short','stake_amount','open_rate','close_rate','fee_open','fee_close','close_profit_abs','enter_tag','exit_reason'];
                    const csv = [headers.join(','), ...trades.map(t =>
                      headers.map(h => {
                        const val = (t as Record<string, unknown>)[h];
                        return val != null ? String(val) : '';
                      }).join(',')
                    )].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `trades_${strategy}.csv`;
                    a.click(); URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1 rounded-btn text-[10px] font-semibold border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  📥 Export CSV
                </button>
              </div>
              {trades.length > 0 ? (
                <>
                  <div className="border border-border rounded-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-muted-foreground">
                            <th className="text-left px-2 py-2 font-semibold">#</th>
                            <th className="text-left px-2 py-2 font-semibold">Pair</th>
                            <th className="text-left px-2 py-2 font-semibold">Side</th>
                            <th className="text-right px-2 py-2 font-semibold">Stake ($)</th>
                            <th className="text-right px-2 py-2 font-semibold">Profit%</th>
                            <th className="text-right px-2 py-2 font-semibold">Profit$</th>
                            <th className="text-left px-2 py-2 font-semibold">Open Date</th>
                            <th className="text-left px-2 py-2 font-semibold">Close Date</th>
                            <th className="text-left px-2 py-2 font-semibold">Enter Tag</th>
                            <th className="text-left px-2 py-2 font-semibold">Exit Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedTrades.map((t, idx) => {
                            const profit = Number(t.close_profit ?? t.profit_ratio ?? 0);
                            const profitAbs = Number(t.close_profit_abs ?? t.profit_abs ?? 0);
                            const isShort = Boolean(t.is_short);
                            return (
                              <tr key={idx} className="border-t border-border hover:bg-muted/30">
                                <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{(tradePage - 1) * tradesPerPage + idx + 1}</td>
                                <td className="px-2 py-1.5 font-mono text-foreground">{String(t.pair ?? '—')}</td>
                                <td className="px-2 py-1.5">
                                  <span className={isShort ? 'text-rose-400' : 'text-emerald-400'}>
                                    {isShort ? 'Short' : 'Long'}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums">${Number(t.stake_amount ?? 0).toFixed(2)}</td>
                                <td className={`px-2 py-1.5 text-right tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {fmtPctRatio(profit)}
                                </td>
                                <td className={`px-2 py-1.5 text-right tabular-nums ${profitAbs >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {fmt$(profitAbs)}
                                </td>
                                <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                                  {String(t.open_date ?? '—').replace('T', ' ').substring(0, 16)}
                                </td>
                                <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                                  {String(t.close_date ?? '—').replace('T', ' ').substring(0, 16)}
                                </td>
                                <td className="px-2 py-1.5 text-muted-foreground">{String(t.enter_tag ?? '—')}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{String(t.exit_reason ?? '—')}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {totalTradePages > 1 && (
                      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                        <span className="text-xs text-muted-foreground">
                          Showing {(tradePage - 1) * tradesPerPage + 1}-{Math.min(tradePage * tradesPerPage, trades.length)} of {trades.length}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setTradePage(Math.max(1, tradePage - 1))}
                            disabled={tradePage === 1}
                            className="px-2 py-1 text-xs border border-border rounded-btn bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all"
                          >← Prev</button>
                          <button
                            onClick={() => setTradePage(Math.min(totalTradePages, tradePage + 1))}
                            disabled={tradePage === totalTradePages}
                            className="px-2 py-1 text-xs border border-border rounded-btn bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all"
                          >Next →</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground p-6 text-center border border-border rounded-card">
                  No trade data available. Enable &quot;trades&quot; export in backtest settings.
                </div>
              )}
            </div>
          )}

          {/* ═══ Rejected Signals ═══ */}
          {activeView === 'rejected' && (
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-3">Rejected Signals</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-card border border-border rounded-card p-3 text-center">
                  <div className="text-lg font-bold text-foreground tabular-nums">{trades.length + rejectedSignals}</div>
                  <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Total Signals</div>
                </div>
                <div className="bg-card border border-border rounded-card p-3 text-center">
                  <div className="text-lg font-bold text-emerald-400 tabular-nums">{trades.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Executed</div>
                </div>
                <div className="bg-card border border-border rounded-card p-3 text-center">
                  <div className="text-lg font-bold text-rose-400 tabular-nums">{rejectedSignals}</div>
                  <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Rejected</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground p-4 border border-border rounded-card text-center">
                Detailed rejection reasons require running FT with &quot;--export signals&quot; flag.
                <br />
                Total rejected signals from this backtest: <strong>{rejectedSignals}</strong>
              </div>
            </div>
          )}

          {/* ═══ Indicator Analysis ═══ */}
          {activeView === 'indicator' && (
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-3">Indicator Analysis</h3>
              <div className="text-xs text-muted-foreground p-6 border border-border rounded-card text-center">
                Indicator analysis requires running FT with &quot;--export signals&quot; flag and
                analyzing indicator values at entry/exit points.
                <br /><br />
                This analysis is automatically populated from signal data when available.
                Run a backtest with <code className="text-primary">export: signals</code> to enable.
              </div>
            </div>
          )}

          {/* ═══ Signal Analysis ═══ */}
          {activeView === 'signal' && (
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-3">Signal Analysis</h3>
              {btData && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-card border border-border rounded-card p-3 text-center">
                    <div className="text-lg font-bold text-foreground tabular-nums">{trades.length + rejectedSignals}</div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Total Signals</div>
                  </div>
                  <div className="bg-card border border-border rounded-card p-3 text-center">
                    <div className="text-lg font-bold text-emerald-400 tabular-nums">{trades.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Executed</div>
                  </div>
                  <div className="bg-card border border-border rounded-card p-3 text-center">
                    <div className="text-lg font-bold text-rose-400 tabular-nums">{rejectedSignals}</div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Rejected</div>
                  </div>
                  <div className="bg-card border border-border rounded-card p-3 text-center">
                    <div className="text-lg font-bold text-amber-400 tabular-nums">
                      {btData.timedout_entry_orders ?? 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">Timed Out</div>
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground p-4 border border-border rounded-card text-center">
                Detailed signal analysis requires running FT with &quot;--export signals&quot; flag.
                <br />
                The signal breakdown per enter_tag is available in the &quot;Enter Tag Stats&quot; tab.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
