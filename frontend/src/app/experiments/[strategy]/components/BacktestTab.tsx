"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from "react";
import Tooltip from "@/components/ui/Tooltip";
import Toggle from "@/components/ui/Toggle";
import { INPUT, SELECT, LABEL, fmt$, fmtPctRatio, fmtNum } from "@/lib/design";
import { botLogs, botBacktestResults, botBacktestStart, botBacktestDelete, botBacktestHistory, botBacktestHistoryResult, botBacktestHistoryDelete, createExperimentRun } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface BacktestTabProps {
  strategy: string;
  backtestBotId?: number;
  experimentId?: number;
}

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

// ── FT result types (exact FT field names from §5/§8) ───────────────────
interface FTStrategyResult {
  strategy_name: string;
  total_trades: number;
  trade_count_long: number;
  trade_count_short: number;
  profit_total: number;
  profit_total_abs: number;
  profit_mean: number;
  profit_median: number;
  profit_factor: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  expectancy: number;
  expectancy_ratio: number;
  max_drawdown_account: number;
  max_drawdown_abs: number;
  starting_balance: number;
  final_balance: number;
  stake_currency: string;
  backtest_start: string;
  backtest_end: string;
  backtest_days: number;
  timeframe: string;
  timeframe_detail: string | null;
  stoploss: number;
  max_open_trades_setting: number;
  trading_mode: string;
  holding_avg: string;
  backtest_best_day: number;
  backtest_worst_day: number;
  backtest_best_day_abs: number;
  backtest_worst_day_abs: number;
  winning_days: number;
  losing_days: number;
  draw_days: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  cagr: number;
  sqn: number;
  results_per_pair: Array<{ key: string; trades: number; profit_mean: number; profit_total: number; profit_total_abs: number }>;
  exit_reason_summary: Array<{ exit_reason: string; trades: number; profit_mean: number; profit_total: number; profit_total_abs: number; wins: number; losses: number }>;
  periodic_breakdown?: Record<string, Array<{ date: string; trades: number; profit_abs: number }>>;
  trades?: FTTradeEntry[];
}

/** Individual trade in backtest results (exact FT field names per architecture doc) */
interface FTTradeEntry {
  trade_id: number;
  pair: string;
  is_short: boolean;
  stake_amount: number;
  open_rate: number;
  close_rate: number;
  fee_open: number;
  fee_close: number;
  close_profit: number;
  close_profit_abs: number;
  open_date: string;
  close_date: string;
  trade_duration: number; // minutes
  enter_tag: string;
  exit_reason: string;
}

interface HistoryEntry {
  filename: string;
  strategy: string;
  run_id: string;
  backtest_start_time: number;
  timeframe?: string;
  timeframe_detail?: string | null;
  backtest_start_ts?: number;
  backtest_end_ts?: number;
}

// Toggle, INPUT, SELECT, LABEL, fmt$, fmtPctRatio, fmtNum, fmtTimestamp imported from shared modules

/** Format duration in minutes → Xd Xh Xm */
function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return `${days}d ${rem}h`;
}

// ── Metric Card ─────────────────────────────────────────────────────
function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const valColor = positive === true ? "text-emerald-400" : positive === false ? "text-rose-400" : "text-foreground";
  return (
    <div className="bg-muted/50 border border-border rounded-lg p-2.5">
      <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${valColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// RESULTS PANEL
// ══════════════════════════════════════════════════════════════════════════
function ResultsPanel({ data }: { data: FTStrategyResult }) {
  const profitPositive = data.profit_total_abs >= 0;
  const [tradesPage, setTradesPage] = useState(1);
  const tradesPerPage = 20;
  const trades = useMemo(() => data.trades || [], [data.trades]);

  // Sort state for trade columns
  type TradeSortKey = 'trade_id' | 'pair' | 'close_profit' | 'close_profit_abs' | 'open_date' | 'close_date' | 'trade_duration';
  const [tradeSortBy, setTradeSortBy] = useState<TradeSortKey>('trade_id');
  const [tradeSortDir, setTradeSortDir] = useState<'asc' | 'desc'>('asc');

  const handleTradeSort = (col: TradeSortKey) => {
    if (tradeSortBy === col) {
      setTradeSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setTradeSortBy(col);
      setTradeSortDir('desc');
    }
    setTradesPage(1);
  };
  const TradeSortArrow = ({ col }: { col: TradeSortKey }) =>
    tradeSortBy === col ? <span className="ml-0.5 text-primary">{tradeSortDir === 'desc' ? '↓' : '↑'}</span> : null;

  const sortedTrades = useMemo(() => {
    const copy = [...trades];
    copy.sort((a, b) => {
      const av = a[tradeSortBy] ?? 0;
      const bv = b[tradeSortBy] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') return tradeSortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
      return tradeSortDir === 'desc' ? (Number(bv) - Number(av)) : (Number(av) - Number(bv));
    });
    return copy;
  }, [trades, tradeSortBy, tradeSortDir]);

  const totalPages = Math.ceil(sortedTrades.length / tradesPerPage);
  const pagedTrades = sortedTrades.slice((tradesPage - 1) * tradesPerPage, tradesPage * tradesPerPage);

  // Generate unique test ID from strategy name + date range
  const testId = useMemo(() => {
    const s = data.backtest_start?.replace(/[^0-9]/g, '').slice(0, 8) || '00000000';
    const e = data.backtest_end?.replace(/[^0-9]/g, '').slice(0, 8) || '00000000';
    return `BT-${s}-${e}`;
  }, [data.backtest_start, data.backtest_end]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header with Unique ID */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/10 border border-primary/30 text-primary rounded">{testId}</span>
            <span className="text-sm font-semibold text-foreground">{data.strategy_name}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {data.backtest_start} → {data.backtest_end} · {data.timeframe}{data.timeframe_detail ? ` (detail: ${data.timeframe_detail})` : ""} · {data.backtest_days} days
          </div>
        </div>
        <div className={`text-lg font-bold tabular-nums ${profitPositive ? "text-emerald-400" : "text-rose-400"}`}>
          {fmt$(data.profit_total_abs)}
        </div>
      </div>

      {/* Test Configuration Bar */}
      <div className="grid grid-cols-6 gap-2 text-[10px]">
        <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
          <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Stoploss</div>
          <div className="text-foreground font-mono">{(data.stoploss * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
          <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Max Trades</div>
          <div className="text-foreground font-mono">{data.max_open_trades_setting}</div>
        </div>
        <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
          <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Capital</div>
          <div className="text-foreground font-mono">${data.starting_balance.toLocaleString()}</div>
        </div>
        <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
          <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Mode</div>
          <div className="text-foreground font-mono">{data.trading_mode || 'spot'}</div>
        </div>
        <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
          <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Currency</div>
          <div className="text-foreground font-mono">{data.stake_currency}</div>
        </div>
        <div className="bg-muted/30 border border-border rounded px-2 py-1.5">
          <div className="text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Timeframe</div>
          <div className="text-foreground font-mono">{data.timeframe}{data.timeframe_detail ? ` / ${data.timeframe_detail}` : ''}</div>
        </div>
      </div>

      {/* Row 1: Core Metrics (6-grid per doc) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <MetricCard label="Total Trades" value={String(data.total_trades)} sub={`${data.trade_count_long}L / ${data.trade_count_short}S`} />
        <MetricCard label="Win Rate" value={`${(data.winrate * 100).toFixed(1)}%`} sub={`${data.wins}W ${data.losses}L ${data.draws}D`} positive={data.winrate > 0.6 ? true : data.winrate < 0.4 ? false : null} />
        <MetricCard label="Total Profit" value={fmt$(data.profit_total_abs)} sub={fmtPctRatio(data.profit_total)} positive={profitPositive} />
        <MetricCard label="Max Drawdown" value={`-${(data.max_drawdown_account * 100).toFixed(2)}%`} sub={fmt$(data.max_drawdown_abs)} positive={false} />
        <MetricCard label="Sharpe" value={fmtNum(data.sharpe)} positive={data.sharpe > 1 ? true : data.sharpe < 0 ? false : null} />
        <MetricCard label="Sortino" value={fmtNum(data.sortino)} positive={data.sortino > 1 ? true : data.sortino < 0 ? false : null} />
      </div>

      {/* Row 2: Risk/Return Ratios */}
      <div className="grid grid-cols-5 gap-2">
        <MetricCard label="Calmar" value={fmtNum(data.calmar)} positive={data.calmar > 1 ? true : data.calmar < 0 ? false : null} />
        <MetricCard label="Profit Factor" value={fmtNum(data.profit_factor)} positive={data.profit_factor > 1 ? true : data.profit_factor < 1 ? false : null} />
        <MetricCard label="SQN" value={fmtNum(data.sqn)} positive={data.sqn > 2 ? true : data.sqn < 0 ? false : null} />
        <MetricCard label="Expectancy" value={fmt$(data.expectancy)} positive={data.expectancy > 0} />
        <MetricCard label="CAGR" value={fmtPctRatio(data.cagr)} positive={data.cagr > 0} />
      </div>

      {/* Row 3: Balance + Extra Stats */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Starting" value={`$${data.starting_balance.toLocaleString()}`} />
        <MetricCard label="Final" value={`$${data.final_balance.toLocaleString()}`} positive={data.final_balance > data.starting_balance} />
        <MetricCard label="Best Day" value={fmt$(data.backtest_best_day_abs)} sub={fmtPctRatio(data.backtest_best_day)} positive={true} />
        <MetricCard label="Worst Day" value={fmt$(data.backtest_worst_day_abs)} sub={fmtPctRatio(data.backtest_worst_day)} positive={false} />
      </div>

      {/* Row 4: Extra */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard label="Avg Duration" value={data.holding_avg || "-"} />
        <MetricCard label="Consec. Wins" value={String(data.max_consecutive_wins)} />
        <MetricCard label="Consec. Losses" value={String(data.max_consecutive_losses)} />
        <MetricCard label="Win/Draw/Loss Days" value={`${data.winning_days}/${data.draw_days}/${data.losing_days}`} />
      </div>

      {/* ── Equity Curve ── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Equity Curve</div>
        <div className="border border-border rounded-lg p-3 bg-muted/20 min-h-[160px] flex items-center justify-center">
          {data.periodic_breakdown && Object.keys(data.periodic_breakdown).length > 0 ? (
            <EquityCurve breakdown={data.periodic_breakdown} startingBalance={data.starting_balance} />
          ) : (
            <span className="text-xs text-muted-foreground opacity-50">Equity curve requires periodic breakdown data (enable Month breakdown)</span>
          )}
        </div>
      </div>

      {/* ── Trades Table ── */}
      {trades.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Trades ({trades.length})
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th onClick={() => handleTradeSort('trade_id')} className="text-left px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground transition-colors">#<TradeSortArrow col="trade_id" /></th>
                    <th onClick={() => handleTradeSort('pair')} className="text-left px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground transition-colors">Pair<TradeSortArrow col="pair" /></th>
                    <th className="text-left px-2 py-1.5 font-semibold">Side</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Stake</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Open</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Close</th>
                    <th onClick={() => handleTradeSort('close_profit')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground transition-colors">Profit%<TradeSortArrow col="close_profit" /></th>
                    <th onClick={() => handleTradeSort('close_profit_abs')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground transition-colors">Profit$<TradeSortArrow col="close_profit_abs" /></th>
                    <th onClick={() => handleTradeSort('open_date')} className="text-left px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground transition-colors">Open Date<TradeSortArrow col="open_date" /></th>
                    <th onClick={() => handleTradeSort('close_date')} className="text-left px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground transition-colors">Close Date<TradeSortArrow col="close_date" /></th>
                    <th onClick={() => handleTradeSort('trade_duration')} className="text-right px-2 py-1.5 font-semibold cursor-pointer hover:text-foreground transition-colors">Duration<TradeSortArrow col="trade_duration" /></th>
                    <th className="text-left px-2 py-1.5 font-semibold">Enter Tag</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Exit Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTrades.map((t) => (
                    <tr key={t.trade_id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{t.trade_id}</td>
                      <td className="px-2 py-1.5 font-mono text-foreground">{t.pair}</td>
                      <td className="px-2 py-1.5">
                        <span className={t.is_short ? "text-rose-400" : "text-emerald-400"}>
                          {t.is_short ? "Short" : "Long"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">${t.stake_amount.toFixed(0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{t.open_rate.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{t.close_rate.toFixed(2)}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${t.close_profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {fmtPctRatio(t.close_profit)}
                      </td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${t.close_profit_abs >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {fmt$(t.close_profit_abs)}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                        {t.open_date ? t.open_date.replace("T", " ").substring(0, 16) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                        {t.close_date ? t.close_date.replace("T", " ").substring(0, 16) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtDuration(t.trade_duration)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{t.enter_tag || "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{t.exit_reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  Showing {(tradesPage - 1) * tradesPerPage + 1}-{Math.min(tradesPage * tradesPerPage, trades.length)} of {trades.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTradesPage(Math.max(1, tradesPage - 1))}
                    disabled={tradesPage === 1}
                    className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setTradesPage(Math.min(totalPages, tradesPage + 1))}
                    disabled={tradesPage === totalPages}
                    className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Results per Pair ── */}
      {data.results_per_pair && data.results_per_pair.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Results per Pair</div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-semibold">Pair</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Trades</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Avg Profit</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Total Profit</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {data.results_per_pair.map((pair) => (
                  <tr key={pair.key} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono text-foreground">{pair.key}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pair.trades}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${pair.profit_mean >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtPctRatio(pair.profit_mean)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${pair.profit_total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtPctRatio(pair.profit_total)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${pair.profit_total_abs >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmt$(pair.profit_total_abs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Exit Reason Summary ── */}
      {data.exit_reason_summary && data.exit_reason_summary.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exit Reasons</div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-semibold">Reason</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Trades</th>
                  <th className="text-right px-3 py-1.5 font-semibold">W/L</th>
                  <th className="text-right px-3 py-1.5 font-semibold">Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {data.exit_reason_summary.map((r) => (
                  <tr key={r.exit_reason} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-mono text-foreground">{r.exit_reason}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.trades}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.wins}W / {r.losses}L</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${r.profit_total_abs >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmt$(r.profit_total_abs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// EQUITY CURVE (SVG)
// ══════════════════════════════════════════════════════════════════════════
function EquityCurve({ breakdown, startingBalance }: { breakdown: Record<string, Array<{ date: string; trades: number; profit_abs: number }>>; startingBalance: number }) {
  // Use the first available breakdown (month, week, or day)
  const key = Object.keys(breakdown)[0];
  const data = breakdown[key] || [];
  if (data.length === 0) return <span className="text-xs text-muted-foreground opacity-50">No breakdown data</span>;

  // Build cumulative equity series
  let balance = startingBalance;
  const points = data.map((d) => {
    balance += d.profit_abs;
    return { date: d.date, value: balance };
  });

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values) * 0.98;
  const maxVal = Math.max(...values) * 1.02;
  const range = maxVal - minVal || 1;

  const W = 600;
  const H = 140;
  const padX = 0;
  const padY = 5;

  const linePoints = points.map((p, i) => {
    const x = padX + (i / Math.max(points.length - 1, 1)) * (W - 2 * padX);
    const y = padY + (1 - (p.value - minVal) / range) * (H - 2 * padY);
    return `${x},${y}`;
  }).join(" ");

  // Gradient fill area
  const firstX = padX;
  const lastX = padX + ((points.length - 1) / Math.max(points.length - 1, 1)) * (W - 2 * padX);
  const areaPoints = `${firstX},${H} ${linePoints} ${lastX},${H}`;

  const isPositive = (points[points.length - 1]?.value ?? startingBalance) >= startingBalance;
  const strokeColor = isPositive ? "#22c55e" : "#ef4444";
  const fillId = isPositive ? "eq-grad-green" : "eq-grad-red";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[140px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eq-grad-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="eq-grad-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${fillId})`} />
      <polyline points={linePoints} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORY PANEL
// ══════════════════════════════════════════════════════════════════════════
/** Lazy-loaded summary stats for a history entry */
interface HistoryStats {
  total_trades: number;
  profit_total_abs: number;
  profit_total: number;
  max_drawdown_account: number;
  wins: number;
  losses: number;
  profit_factor: number;
  winrate: number;
}

function HistoryPanel({ entries, currentStrategy, onLoad, onDelete, botId }: {
  entries: HistoryEntry[];
  currentStrategy: string;
  onLoad: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  botId: number;
}) {
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statsCache, setStatsCache] = useState<Map<string, HistoryStats | 'loading' | 'error'>>(new Map());
  const perPage = 10;

  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmId]);

  const filtered = entries
    .filter((e) => e.strategy === currentStrategy)
    .sort((a, b) => b.backtest_start_time - a.backtest_start_time);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    paged.forEach(async (entry) => {
      const key = entry.filename;
      if (statsCache.has(key)) return;
      setStatsCache(prev => new Map(prev).set(key, 'loading'));
      try {
        const data = await botBacktestHistoryResult(botId, entry.filename, entry.strategy);
        const br = (data as Record<string, unknown>).backtest_result ?? data;
        const stratMap = (br as Record<string, unknown>).strategy as Record<string, Record<string, unknown>> | undefined;
        if (stratMap) {
          const fk = Object.keys(stratMap)[0];
          if (fk) {
            const s = stratMap[fk];
            const tt = Number(s.total_trades ?? 0);
            const w = Number(s.wins ?? 0);
            setStatsCache(prev => new Map(prev).set(key, {
              total_trades: tt,
              profit_total_abs: Number(s.profit_total_abs ?? 0),
              profit_total: Number(s.profit_total ?? 0),
              max_drawdown_account: Number(s.max_drawdown_account ?? 0),
              wins: w,
              losses: Number(s.losses ?? 0),
              profit_factor: Number(s.profit_factor ?? 0),
              winrate: Number(s.winrate ?? (tt > 0 ? w / tt : 0)),
            }));
            return;
          }
        }
        setStatsCache(prev => new Map(prev).set(key, 'error'));
      } catch {
        setStatsCache(prev => new Map(prev).set(key, 'error'));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filtered.length, botId]);

  if (filtered.length === 0) return null;
  const totalPages = Math.ceil(filtered.length / perPage);

  const fmtDate = (ts?: number) => {
    if (!ts) return "—";
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toISOString().split("T")[0];
  };

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Backtest History ({filtered.length})
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="text-center px-2 py-2 font-semibold w-[32px]">#</th>
                <th className="text-left px-3 py-2 font-semibold w-[90px]">ID</th>
                <th className="text-left px-3 py-2 font-semibold">Run Date</th>
                <th className="text-left px-3 py-2 font-semibold">Timeframe</th>
                <th className="text-left px-3 py-2 font-semibold">Range</th>
                <th className="text-right px-3 py-2 font-semibold">Trades</th>
                <th className="text-right px-3 py-2 font-semibold">Profit</th>
                <th className="text-right px-3 py-2 font-semibold">Profit %</th>
                <th className="text-right px-3 py-2 font-semibold">Win Rate</th>
                <th className="text-right px-3 py-2 font-semibold">Max DD</th>
                <th className="text-right px-3 py-2 font-semibold">PF</th>
                <th className="text-center px-3 py-2 font-semibold w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((entry, idx) => {
                const runDate = new Date(entry.backtest_start_time * 1000);
                const runStr = `${runDate.getFullYear()}-${String(runDate.getMonth()+1).padStart(2,'0')}-${String(runDate.getDate()).padStart(2,'0')} ${String(runDate.getHours()).padStart(2,'0')}:${String(runDate.getMinutes()).padStart(2,'0')}`;
                const entryKey = `${entry.filename}-${entry.run_id}`;
                const isConfirming = confirmId === entryKey;
                const isExpanded = expandedId === entryKey;
                const stats = statsCache.get(entry.filename);
                const s = (stats && stats !== 'loading' && stats !== 'error') ? stats as HistoryStats : null;
                const btId = `BT-${runDate.getFullYear()}${String(runDate.getMonth()+1).padStart(2,'0')}${String(runDate.getDate()).padStart(2,'0')}-${String(runDate.getHours()).padStart(2,'0')}${String(runDate.getMinutes()).padStart(2,'0')}`;

                return (
                  <Fragment key={entryKey}>
                  <tr className={`border-t border-border hover:bg-muted/30 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/20' : ''}`} onClick={() => setExpandedId(isExpanded ? null : entryKey)}>
                    <td className="px-2 py-2 text-center text-[10px] text-muted-foreground tabular-nums">{(page - 1) * perPage + idx + 1}</td>
                    <td className="px-3 py-2">
                      <span className="text-[9px] font-mono px-1 py-0.5 bg-primary/10 border border-primary/30 text-primary rounded whitespace-nowrap">{btId}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{runStr}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{entry.timeframe || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(entry.backtest_start_ts)} → {fmtDate(entry.backtest_end_ts)}</td>
                    {stats === 'loading' ? (
                      <td colSpan={6} className="px-3 py-2 text-center text-muted-foreground/50 animate-pulse">Loading...</td>
                    ) : s ? (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{s.total_trades}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${s.profit_total_abs >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fmt$(s.profit_total_abs)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${s.profit_total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fmtPctRatio(s.profit_total)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">
                          {(s.winrate * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-400">
                          -{(s.max_drawdown_account * 100).toFixed(1)}%
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${s.profit_factor > 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {s.profit_factor.toFixed(2)}
                        </td>
                      </>
                    ) : (
                      <td colSpan={6} className="px-3 py-2 text-center text-muted-foreground/30">—</td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onLoad(entry); }}
                          className="text-[10px] px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary rounded hover:bg-primary/20 transition-all"
                        >Load</button>
                        {isConfirming ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmId(null); onDelete(entry); }}
                            className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 border border-rose-500/50 text-rose-400 rounded hover:bg-rose-500/30 transition-all animate-pulse"
                          >Confirm?</button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmId(entryKey); }}
                            className="text-[10px] px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400/70 rounded hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                          >Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${entryKey}-expand`} className="bg-muted/10">
                      <td colSpan={12} className="px-4 py-2">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px]">
                          <span className="text-muted-foreground">Strategy: <span className="text-foreground font-mono">{entry.strategy}</span></span>
                          <span className="text-muted-foreground">Timeframe: <span className="text-foreground font-mono">{entry.timeframe || '—'}</span></span>
                          {entry.timeframe_detail && <span className="text-muted-foreground">TF Detail: <span className="text-foreground font-mono">{entry.timeframe_detail}</span></span>}
                          <span className="text-muted-foreground">Range: <span className="text-foreground font-mono">{fmtDate(entry.backtest_start_ts)} → {fmtDate(entry.backtest_end_ts)}</span></span>
                          <span className="text-muted-foreground">File: <span className="text-foreground font-mono text-[9px]">{entry.filename}</span></span>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all">← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2 py-1 text-xs border border-border rounded bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function BacktestTab({ strategy, backtestBotId = 2, experimentId }: BacktestTabProps) {
  const toast = useToast();
  const [testName, setTestName] = useState(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [timeframeOverride, setTimeframeOverride] = useState("Use strategy default");
  const [timeframeDetail, setTimeframeDetail] = useState("None");
  const [maxOpenTrades, setMaxOpenTrades] = useState("");
  const [startingCapital, setStartingCapital] = useState("10000");
  const [stakeAmount, setStakeAmount] = useState("unlimited");
  const [feeOverride, setFeeOverride] = useState("");
  const [enableProtections, setEnableProtections] = useState(false);
  const [cacheResults, setCacheResults] = useState(true);
  const [enableFreqAI, setEnableFreqAI] = useState(false);
  const [exportType, setExportType] = useState("none");
  const [breakdownDay, setBreakdownDay] = useState(false);
  const [breakdownWeek, setBreakdownWeek] = useState(false);
  const [breakdownMonth, setBreakdownMonth] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  // ── Log window state ──────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [btProgress, setBtProgress] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Results + History state ────────────────────────────────────────
  const [btResult, setBtResult] = useState<FTStrategyResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const BT_CACHE_KEY = `bt-result-${strategy}`;

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

  // Fetch history on mount and after backtest completes
  const fetchHistory = useCallback(async () => {
    try {
      const res = await botBacktestHistory(backtestBotId);
      setHistory(res.results || []);
    } catch {
      // History fetch failed — not critical
    }
  }, [backtestBotId]);

  // Delete a backtest history entry
  const handleDeleteHistory = useCallback(async (entry: HistoryEntry) => {
    try {
      await botBacktestHistoryDelete(backtestBotId, entry.filename, entry.strategy);
      toast.success('Backtest deleted');
      // Clear displayed result if it came from the deleted file
      if (btResult) {
        setBtResult(null);
        try { sessionStorage.removeItem(BT_CACHE_KEY); } catch { /* */ }
      }
      fetchHistory();
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [backtestBotId, toast, fetchHistory, btResult, BT_CACHE_KEY]);

  // Auto-load: cache first, then fetch history and auto-load latest
  useEffect(() => {
    // 1. Instant load from cache (with validation)
    let loadedFromCache = false;
    try {
      const cached = sessionStorage.getItem(BT_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as FTStrategyResult;
        // Validate cache: must have trades with close_profit (not NaN from old extraction)
        const firstTrade = parsed?.trades?.[0];
        const cacheValid = parsed?.total_trades && (!firstTrade || (firstTrade.close_profit !== undefined && !isNaN(firstTrade.close_profit)));
        if (cacheValid) {
          setBtResult(parsed);
          addLog('INFO', `Loaded cached result: ${parsed.strategy_name} — ${parsed.total_trades} trades`);
          loadedFromCache = true;
        } else {
          // Stale cache — clear it
          sessionStorage.removeItem(BT_CACHE_KEY);
        }
      }
    } catch { /* no cache */ }
    // 2. Fetch history list, then auto-load latest if we don't have a result
    (async () => {
      try {
        const res = await botBacktestHistory(backtestBotId);
        const entries = res.results || [];
        setHistory(entries);
        // If no cache and we have history, auto-load the most recent entry for this strategy
        if (!loadedFromCache && entries.length > 0) {
          const latest = entries
            .filter((e: HistoryEntry) => e.strategy === strategy)
            .sort((a: HistoryEntry, b: HistoryEntry) => b.backtest_start_time - a.backtest_start_time)[0];
          if (latest) {
            addLog('INFO', `Auto-loading latest: ${latest.filename}...`);
            try {
              const data = await botBacktestHistoryResult(backtestBotId, latest.filename, latest.strategy);
              if (data) {
                const raw = (data as Record<string, unknown>).backtest_result ?? data;
                const result = extractResult(raw as Record<string, unknown>);
                if (result) {
                  setBtResult(result);
                  try { sessionStorage.setItem(BT_CACHE_KEY, JSON.stringify(result)); } catch { /* */ }
                  addLog('INFO', `Loaded: ${result.strategy_name} — ${result.total_trades} trades`);
                }
              }
            } catch (err) {
              addLog('WARNING', `Auto-load failed: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      } catch { /* history fetch failed */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Extract strategy result from FT's nested response
  const extractResult = useCallback((backtestResult: Record<string, unknown>): FTStrategyResult | null => {
    const strategyMap = backtestResult.strategy as Record<string, Record<string, unknown>> | undefined;
    if (!strategyMap) return null;
    const firstKey = Object.keys(strategyMap)[0];
    if (!firstKey) return null;
    const raw = strategyMap[firstKey];

    // Normalize trades: FT uses profit_ratio/profit_abs, we use close_profit/close_profit_abs
    const rawTrades = (raw.trades as Array<Record<string, unknown>>) || [];
    const trades: FTTradeEntry[] = rawTrades.map((t, i) => ({
      trade_id: Number(t.trade_id ?? i + 1),
      pair: String(t.pair ?? ''),
      is_short: Boolean(t.is_short),
      stake_amount: Number(t.stake_amount ?? 0),
      open_rate: Number(t.open_rate ?? 0),
      close_rate: Number(t.close_rate ?? 0),
      fee_open: Number(t.fee_open ?? 0),
      fee_close: Number(t.fee_close ?? 0),
      close_profit: Number(t.profit_ratio ?? t.close_profit ?? 0),
      close_profit_abs: Number(t.profit_abs ?? t.close_profit_abs ?? 0),
      open_date: String(t.open_date ?? ''),
      close_date: String(t.close_date ?? ''),
      trade_duration: Number(t.trade_duration ?? 0),
      enter_tag: String(t.enter_tag ?? ''),
      exit_reason: String(t.exit_reason ?? ''),
    }));

    const wins = Number(raw.wins ?? 0);
    const losses = Number(raw.losses ?? 0);
    const totalTrades = Number(raw.total_trades ?? 0);
    // FT provides winrate directly; fallback to calculation
    const winrate = Number(raw.winrate ?? (totalTrades > 0 ? wins / totalTrades : 0));

    return {
      strategy_name: String(raw.strategy_name ?? firstKey),
      total_trades: totalTrades,
      trade_count_long: Number(raw.trade_count_long ?? 0),
      trade_count_short: Number(raw.trade_count_short ?? 0),
      profit_total: Number(raw.profit_total ?? 0),
      profit_total_abs: Number(raw.profit_total_abs ?? 0),
      profit_mean: Number(raw.profit_mean ?? 0),
      profit_median: Number(raw.profit_median ?? 0),
      profit_factor: Number(raw.profit_factor ?? 0),
      wins,
      losses,
      draws: Number(raw.draws ?? 0),
      winrate,
      sharpe: Number(raw.sharpe ?? raw.sharpe_ratio ?? 0),
      sortino: Number(raw.sortino ?? raw.sortino_ratio ?? 0),
      calmar: Number(raw.calmar ?? raw.calmar_ratio ?? 0),
      expectancy: Number(raw.expectancy ?? 0),
      expectancy_ratio: Number(raw.expectancy_ratio ?? 0),
      max_drawdown_account: Number(raw.max_drawdown_account ?? 0),
      max_drawdown_abs: Number(raw.max_drawdown_abs ?? 0),
      starting_balance: Number(raw.starting_balance ?? 0),
      final_balance: Number(raw.final_balance ?? 0),
      stake_currency: String(raw.stake_currency ?? 'USDT'),
      backtest_start: String(raw.backtest_start ?? ''),
      backtest_end: String(raw.backtest_end ?? ''),
      backtest_days: Number(raw.backtest_days ?? 0),
      timeframe: String(raw.timeframe ?? ''),
      timeframe_detail: raw.timeframe_detail as string | null ?? null,
      stoploss: Number(raw.stoploss ?? 0),
      max_open_trades_setting: Number(raw.max_open_trades_setting ?? raw.max_open_trades ?? 0),
      trading_mode: String(raw.trading_mode ?? ''),
      holding_avg: String(raw.holding_avg ?? raw.holding_avg_s ?? ''),
      backtest_best_day: Number(raw.backtest_best_day ?? 0),
      backtest_worst_day: Number(raw.backtest_worst_day ?? 0),
      backtest_best_day_abs: Number(raw.backtest_best_day_abs ?? 0),
      backtest_worst_day_abs: Number(raw.backtest_worst_day_abs ?? 0),
      winning_days: Number(raw.winning_days ?? 0),
      losing_days: Number(raw.losing_days ?? 0),
      draw_days: Number(raw.draw_days ?? 0),
      max_consecutive_wins: Number(raw.max_consecutive_wins ?? 0),
      max_consecutive_losses: Number(raw.max_consecutive_losses ?? 0),
      cagr: Number(raw.cagr ?? 0),
      sqn: Number(raw.sqn ?? 0),
      results_per_pair: (raw.results_per_pair as FTStrategyResult['results_per_pair']) ?? [],
      exit_reason_summary: (raw.exit_reason_summary as FTStrategyResult['exit_reason_summary']) ?? [],
      periodic_breakdown: (raw.periodic_breakdown as FTStrategyResult['periodic_breakdown']) ?? undefined,
      trades,
    };
  }, []);

  // Poll FT logs + backtest status while running
  useEffect(() => {
    if (!isRunning) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    let lastLogCount = -1; // -1 = skip initial batch (startup logs)
    let notStartedCount = 0; // Track consecutive not_started polls
    const poll = async () => {
      try {
        const logRes = await botLogs(backtestBotId, 50);
        if (logRes && logRes.logs) {
          if (lastLogCount === -1) {
            lastLogCount = logRes.logs.length;
          } else {
            const newLogs = logRes.logs.slice(lastLogCount);
            lastLogCount = logRes.logs.length;
            for (const entry of newLogs) {
              const level = entry[3] || "INFO";
              const msg = entry[4] || entry.join(" ");
              addLog(level, msg);
            }
          }
        }
      } catch {
        // Log fetch failed
      }
      try {
        const btRes = await botBacktestResults(backtestBotId);
        if (btRes) {
          const raw = btRes as unknown as Record<string, unknown>;
          const step = (raw.step as string) || "";
          const progress = raw.progress as number | undefined;
          const ftRunning = raw.running as boolean | undefined;
          const ftStatus = (raw.status_msg as string) || "";

          addLog("INFO", `[poll] status=${raw.status} running=${ftRunning} step="${step}" hasResult=${!!raw.backtest_result}`);

          if (ftRunning === false && raw.backtest_result) {
            setBtProgress("\u2713 Backtest complete");
            addLog("INFO", "Extracting results...");
            const result = extractResult(raw.backtest_result as Record<string, unknown>);
            if (result) {
              addLog("INFO", `Result: ${result.strategy_name || "?"} \u2014 ${result.total_trades} trades`);
              setBtResult(result);
              try { sessionStorage.setItem(BT_CACHE_KEY, JSON.stringify(result)); } catch { /* quota */ }
              // Record as experiment run for metrics tracking
              if (experimentId) {
                createExperimentRun(experimentId, {
                  run_type: "backtest",
                  total_trades: result.total_trades,
                  win_rate: result.winrate != null ? result.winrate * 100 : undefined,
                  profit_pct: result.profit_total != null ? result.profit_total * 100 : undefined,
                  profit_abs: result.profit_total_abs,
                  max_drawdown: result.max_drawdown_account != null ? result.max_drawdown_account * 100 : undefined,
                  sharpe_ratio: result.sharpe,
                  sortino_ratio: result.sortino,
                  calmar_ratio: result.calmar,
                }).catch(err => console.warn("Failed to record experiment run:", err));
              }
            } else {
              addLog("WARNING", `extractResult null. backtest_result keys: ${JSON.stringify(Object.keys(raw.backtest_result as object))}`);
            }
            setIsRunning(false);
            fetchHistory();
          } else if (step === "error" || ftStatus.toLowerCase().includes("error")) {
            setBtProgress("\u2717 Error");
            addLog("ERROR", ftStatus || "Backtest failed");
            setIsRunning(false);
          } else if (raw.status === "not_started" && ftRunning === false) {
            notStartedCount++;
            if (notStartedCount >= 5) {
              addLog("ERROR", `Backtest stuck at 'not_started' for ${notStartedCount * 3}s. The FT bot may not have the strategy "${strategy}" loaded, or the backtest config is invalid. Check: (1) strategy file exists in the bot's container, (2) data is downloaded for the requested timerange.`);
              setBtProgress("\u2717 Failed to start");
              setIsRunning(false);
            }
          } else if (step) {
            notStartedCount = 0; // Reset — backtest is making progress
            const pct = progress != null ? ` (${(progress * 100).toFixed(0)}%)` : "";
            setBtProgress(`${step}${pct}`);
          }
        } else {
          addLog("WARNING", "[poll] botBacktestResults returned falsy");
        }
      } catch (pollErr) {
        addLog("ERROR", `[poll] status error: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, backtestBotId, strategy, experimentId, addLog, extractResult, fetchHistory, BT_CACHE_KEY]);

  // Timerange display (auto-generated from dates)
  const timerangeDisplay = useMemo(() => {
    return `${startDate.replace(/-/g, "")}-${endDate.replace(/-/g, "")}`;
  }, [startDate, endDate]);

  // Auto-generate description from current settings
  const autoDescription = useMemo(() => {
    const tf = timeframeOverride === "Use strategy default" ? "default TF" : timeframeOverride;
    const tfDetail = timeframeDetail !== "None" ? `detail: ${timeframeDetail}` : null;
    const parts = [
      `${strategy} backtest`,
      `${startDate} → ${endDate}`,
      tf,
      tfDetail,
      maxOpenTrades ? `${maxOpenTrades} max trades` : null,
      `$${startingCapital} capital`,
      stakeAmount && stakeAmount !== 'unlimited' ? `stake: $${stakeAmount}` : 'stake: unlimited',
      feeOverride ? `fee: ${feeOverride}%` : null,
      enableFreqAI ? "FreqAI ON" : null,
      enableProtections ? "Protections ON" : "Protections OFF",
    ].filter(Boolean);
    return parts.join(" · ");
  }, [strategy, startDate, endDate, timeframeOverride, timeframeDetail, maxOpenTrades, startingCapital, stakeAmount, feeOverride, enableFreqAI, enableProtections]);

  const handleStart = async () => {
    setLogs([]);
    setBtProgress("");
    setBtResult(null);
    addLog("INFO", `Starting backtest: ${strategy} — ${startDate} → ${endDate}`);
    toast.info("Starting backtest...");

    const timerange = `${startDate.replace(/-/g, "")}-${endDate.replace(/-/g, "")}`;
    const params: Record<string, unknown> = {
      strategy,
      timerange,
      max_open_trades: parseInt(maxOpenTrades, 10) || 3,
      stake_amount: stakeAmount ? (stakeAmount === "unlimited" ? "unlimited" : parseFloat(stakeAmount) || "unlimited") : "unlimited",
      dry_run_wallet: parseFloat(startingCapital) || 10000,
      enable_protections: enableProtections,
      cache: cacheResults ? "day" : "none",
      export: exportType,
    };

    if (timeframeOverride !== "Use strategy default") params.timeframe = timeframeOverride;
    if (timeframeDetail !== "Same as timeframe") params.timeframe_detail = timeframeDetail;
    if (feeOverride) params.fee = parseFloat(feeOverride) / 100;
    if (enableFreqAI) params.freqaimodel = "LightGBMRegressor";

    const breakdowns: string[] = [];
    if (breakdownDay) breakdowns.push("day");
    if (breakdownWeek) breakdowns.push("week");
    if (breakdownMonth) breakdowns.push("month");
    if (breakdowns.length > 0) params.breakdown = breakdowns.join(" ");

    try {
      addLog("INFO", `POST /api/bots/${backtestBotId}/backtest — timerange=${timerange}`);
      await botBacktestStart(backtestBotId, params);
      addLog("INFO", "Backtest job submitted — polling for results...");
      toast.success("Backtest submitted — polling for results");
      setIsRunning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Failed to start backtest: ${msg}`);
      toast.error(`Backtest failed: ${msg}`);
    }
  };

  const handleStop = async () => {
    try {
      addLog("WARNING", "Aborting backtest...");
      await botBacktestDelete(backtestBotId);
      addLog("WARNING", "Backtest aborted by user");
    } catch {
      addLog("WARNING", "Backtest stop requested (may have already finished)");
    }
    setIsRunning(false);
    setBtProgress("");
  };

  const handleReset = () => {
    setTestName(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
    setDescription("");
    setStartDate("2024-01-01");
    setEndDate("2025-01-01");
    setTimeframeOverride("Use strategy default");
    setTimeframeDetail("None");
    setMaxOpenTrades("");
    setStartingCapital("10000");
    setStakeAmount("");
    setFeeOverride("");
    setEnableProtections(false);
    setCacheResults(true);
    setEnableFreqAI(false);
    setExportType("none");
    setBreakdownDay(false);
    setBreakdownWeek(false);
    setBreakdownMonth(true);
  };

  // Load a past result from history
  const handleLoadHistory = async (entry: HistoryEntry) => {
    addLog("INFO", `Loading result: ${entry.filename}...`);
    try {
      // Use the specific history result endpoint with the filename
      const res = await botBacktestHistoryResult(backtestBotId, entry.filename, entry.strategy);
      if (res) {
        const raw = res as Record<string, unknown>;
        // FT returns the result wrapped in backtest_result or directly
        const backtestData = (raw.backtest_result ?? raw) as Record<string, unknown>;
        // If the response has a 'strategy' key, it's the standard FT format
        if (backtestData.strategy) {
          const result = extractResult(backtestData);
          if (result) {
            setBtResult(result);
            try { sessionStorage.setItem(BT_CACHE_KEY, JSON.stringify(result)); } catch { /* quota */ }
            addLog("INFO", `Loaded: ${result.strategy_name} — ${result.total_trades} trades`);
            return;
          }
        }
        // Try treating the whole response as the strategy result directly
        const stratKeys = Object.keys(backtestData);
        if (stratKeys.length > 0) {
          const firstVal = backtestData[stratKeys[0]];
          if (firstVal && typeof firstVal === 'object' && 'total_trades' in (firstVal as object)) {
            setBtResult(firstVal as unknown as FTStrategyResult);
            addLog("INFO", `Loaded: ${stratKeys[0]} — ${(firstVal as { total_trades: number }).total_trades} trades`);
            return;
          }
        }
      }
      addLog("WARNING", "Could not parse result — the backtest data format was unexpected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("ERROR", `Failed to load history result: ${msg}`);
    }
  };

  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-0 max-w-full">

      {/* ═══════════ LEFT PANEL: FORM ═══════════ */}
      <div className="bg-card border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col gap-[10px]">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">⚙️ Test Configuration</div>

        <div>
          <label className={LABEL}>Test Name</label>
          <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className={INPUT} />
        </div>

        <div>
          <label className={LABEL}>Description (optional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={autoDescription} className={INPUT} />
        </div>

        <div>
          <label className={LABEL}>Strategy</label>
          <input type="text" value={strategy} readOnly className={`${INPUT} bg-muted/50 opacity-70 cursor-default`} />
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div>
          <label className={LABEL}>Timerange</label>
          <input type="text" value={timerangeDisplay} readOnly className={`${INPUT} bg-muted/50 opacity-70 cursor-default font-mono`} />
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Timeframe Override</label>
            <select value={timeframeOverride} onChange={(e) => setTimeframeOverride(e.target.value)} className={SELECT}>
              <option>Use strategy default</option>
              <option>1m</option><option>5m</option><option>15m</option><option>30m</option>
              <option>1h</option><option>4h</option><option>1d</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Timeframe Detail</label>
            <select value={timeframeDetail} onChange={(e) => setTimeframeDetail(e.target.value)} className={SELECT}>
              <option>None</option>
              <option>1m</option><option>5m</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Max Open Trades</label>
            <input type="number" value={maxOpenTrades} onChange={(e) => setMaxOpenTrades(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Starting Capital ($)</label>
            <input type="number" value={startingCapital} onChange={(e) => setStartingCapital(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Stake Amount ($)</label>
            <input type="text" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="unlimited" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Fee Override (%)</label>
            <input type="number" step="0.01" value={feeOverride} onChange={(e) => setFeeOverride(e.target.value)} placeholder="Exchange default" className={INPUT} />
          </div>
        </div>

        <div className="flex flex-col gap-[8px] mt-1">
          <Tooltip content="Enable FT Protections — FT: --enable-protections">
            <div><Toggle checked={enableProtections} onChange={setEnableProtections} label="Enable Protections" /></div>
          </Tooltip>
          <Tooltip content="Cache results to avoid re-computing — FT: --cache">
            <div><Toggle checked={cacheResults} onChange={setCacheResults} label="Cache Results" /></div>
          </Tooltip>
          <Tooltip content="Use FreqAI model predictions in backtest — FT: --freqaimodel">
            <div><Toggle checked={enableFreqAI} onChange={setEnableFreqAI} label="Enable FreqAI" /></div>
          </Tooltip>
        </div>

        <div>
          <label className={LABEL}>Export</label>
          <div className="flex gap-[6px]">
            {["none", "trades", "signals"].map((val) => (
              <label key={val} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-xs cursor-pointer border transition-all select-none ${exportType === val ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-[#2e2e48]"}`}>
                <input type="radio" name="export" value={val} checked={exportType === val} onChange={(e) => setExportType(e.target.value)} className="hidden" />
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL}>Breakdown</label>
          <div className="flex gap-[6px]">
            {([
              { label: "Day", checked: breakdownDay, set: setBreakdownDay },
              { label: "Week", checked: breakdownWeek, set: setBreakdownWeek },
              { label: "Month", checked: breakdownMonth, set: setBreakdownMonth },
            ] as const).map((item) => (
              <span key={item.label} onClick={() => item.set(!item.checked)} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-xs cursor-pointer border transition-all select-none ${item.checked ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-[#2e2e48]"}`}>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-[6px] mt-1">
          <button onClick={handleStart} disabled={isRunning} className="flex-1 h-[32px] rounded-btn text-xs font-semibold border bg-primary border-primary text-white hover:bg-[#5558e6] transition-all disabled:opacity-50">
            {isRunning ? "⏳ Running..." : "▶ Start Backtest"}
          </button>
          <button onClick={handleStop} disabled={!isRunning} className="h-[32px] px-3 rounded-btn text-xs font-semibold border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)] text-rose-500 hover:bg-[rgba(239,68,68,0.15)] transition-all disabled:opacity-50">
            ⏹ Stop
          </button>
          <button onClick={handleReset} className="h-[32px] px-3 rounded-btn text-xs font-semibold border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-all">
            ↻
          </button>
        </div>

        {/* ═══════════ LOG WINDOW ═══════════ */}
        <div className="flex flex-col mt-1 flex-1 min-h-[120px]">
          <div className="flex items-center justify-between mb-[4px]">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px]">Log</span>
            <div className="flex items-center gap-2">
              {btProgress && (
                <span className="text-xs text-primary font-medium">{btProgress}</span>
              )}
              {isRunning && (
                <span className="w-[6px] h-[6px] rounded-full bg-green animate-pulse" />
              )}
              {logs.length > 0 && (
                <button
                  onClick={() => { setLogs([]); setBtProgress(""); }}
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
                Logs will appear here when backtest starts...
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

      {/* ═══════════ RIGHT PANEL: RESULTS ═══════════ */}
      <div className="bg-card border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col gap-4 min-h-[400px]">
        {btResult ? (
          <>
            <ResultsPanel data={btResult} />
            <HistoryPanel entries={history} currentStrategy={strategy} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} botId={backtestBotId} />
          </>
        ) : (
          <>
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center flex-1 min-h-[200px]">
              <div className="text-[32px] mb-3 opacity-30">📊</div>
              <div className="text-sm font-semibold text-muted-foreground mb-1">No backtest results yet</div>
              <div className="text-xs text-muted-foreground text-center max-w-[280px]">
                Configure your test parameters and click &quot;Start Backtest&quot; to run a real FreqTrade backtest on the server.
              </div>
            </div>
            {/* Still show history even without current result */}
            <HistoryPanel entries={history} currentStrategy={strategy} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} botId={backtestBotId} />
          </>
        )}
      </div>
    </div>
  );
}
