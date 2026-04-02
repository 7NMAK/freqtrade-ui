"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { fmt, fmtMoney, profitColor } from "@/lib/format";
import type {
  Bot,
  FTHealth,
  FTTrade,
  FTProfit,
  FTPerformance,
  FTEntry,
  FTExit,
  FTStats,
  FTShowConfig,
  FTSysinfo,
  FTLogsResponse,
  FTLocksResponse,
  FTBalance,
} from "@/types";

type DetailTab = "overview" | "trades" | "performance" | "config" | "backtest" | "hyperopt" | "freqai" | "system";

function fmtDurSec(seconds: number): string {
  if (isNaN(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface BotDetailPanelProps {
  bot: Bot | null;
  isOpen: boolean;
  onClose: () => void;
  // Data
  profit: Partial<FTProfit> | null;
  openTrades: FTTrade[];
  closedTrades: FTTrade[];
  perfData: FTPerformance[];
  entryData: FTEntry[];
  exitData: FTExit[];
  statsData: FTStats | null;
  configData: FTShowConfig | null;
  sysinfoData: FTSysinfo | null;
  logsData: FTLogsResponse | null;
  locksData: FTLocksResponse | null;
  balanceData: FTBalance | null;
  healthData: FTHealth | null;
  // Loading states
  loading: boolean;
  // Action handlers
  onStart: () => void;
  onStop: () => void;
  onDrain: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

// Status Badge helper
function StatusBadge({ status, isDryRun }: { status: string; isDryRun: boolean }) {
  if (status === "draining") {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 uppercase tracking-wide border border-amber-500-500/20 animate-pulse">
        Draining
      </span>
    );
  }
  if (status !== "running") {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide border border-border">
        Stopped
      </span>
    );
  }
  if (isDryRun) {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 uppercase tracking-wide border border-amber-500-500/20">
        Paper
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase tracking-wide border border-emerald-500/20">
      Live
    </span>
  );
}

export default function BotDetailPanel({
  bot,
  isOpen,
  onClose,
  profit,
  openTrades,
  closedTrades,
  perfData,
  entryData,
  exitData,
  statsData,
  configData,
  sysinfoData,
  logsData,
  locksData,
  balanceData,
  healthData,
  loading,
  onStart,
  onStop,
  onDrain,
  onEdit,
  onDelete,
  onDuplicate,
}: BotDetailPanelProps) {
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  if (!bot) return null;

  const isRunning = bot.status === "running";
  const isDraining = bot.status === "draining";

  return (
    <>
      {/* Overlay */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 bg-black/50 z-[500] transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 h-screen w-[560px] max-w-[90vw] bg-card border-l border-border z-[501] transition-[right] duration-300 ease-out flex flex-col overflow-hidden ${
          isOpen ? "right-0" : "-right-[560px]"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center gap-3.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border bg-muted/50 flex items-center justify-center text-muted-foreground text-base transition-all hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-base font-bold text-foreground flex-1 truncate">
            {bot.name}
          </div>
          <StatusBadge status={bot.status} isDryRun={bot.is_dry_run} />
          {/* Action Buttons */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors focus-visible:outline-none border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground h-7 px-3 cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="inline-flex items-center justify-center rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors focus-visible:outline-none border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground h-7 px-3 cursor-pointer"
            >
              Duplicate
            </button>
            {!isRunning && !isDraining && (
              <button
                type="button"
                onClick={onStart}
                className="inline-flex items-center justify-center rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors focus-visible:outline-none border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 h-7 px-3 cursor-pointer"
              >
                Start
              </button>
            )}
            {(isRunning || isDraining) && (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex items-center justify-center rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors focus-visible:outline-none border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 h-7 px-3 cursor-pointer"
              >
                Stop
              </button>
            )}
            {isRunning && !isDraining && (
              <button
                type="button"
                onClick={onDrain}
                className="inline-flex items-center justify-center rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors focus-visible:outline-none border border-amber-500/20 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 h-7 px-3 cursor-pointer"
              >
                Drain
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center justify-center rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors focus-visible:outline-none border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 h-7 px-3 cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-border flex gap-1 overflow-x-auto flex-shrink-0 pt-4 pb-0 items-end">
          {(
            [
              { key: "overview", label: "Overview" },
              { key: "trades", label: "Trades" },
              { key: "performance", label: "Performance" },
              { key: "config", label: "Config" },
              { key: "backtest", label: "Backtest" },
              { key: "hyperopt", label: "Hyperopt" },
              { key: "freqai", label: "FreqAI" },
              { key: "system", label: "System & Log" },
            ] satisfies { key: DetailTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setDetailTab(tab.key)}
              className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border-b-2 ${
                detailTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading details...
            </div>
          ) : (
            <DetailContent
              tab={detailTab}
              bot={bot}
              profit={profit}
              openTrades={openTrades}
              closedTrades={closedTrades}
              perfData={perfData}
              entryData={entryData}
              exitData={exitData}
              statsData={statsData}
              configData={configData}
              sysinfoData={sysinfoData}
              logsData={logsData}
              locksData={locksData}
              balanceData={balanceData}
              healthData={healthData}
            />
          )}
        </div>

        {/* Bottom actions */}
        <div className="px-6 py-4 border-t border-border flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 py-2.5 rounded-md border border-border bg-muted/50 text-muted-foreground text-xs font-medium text-center transition-all hover:bg-muted hover:border-border cursor-pointer"
          >
            Edit Bot Settings
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-md border-none bg-primary text-white text-xs font-semibold text-center transition-all hover:bg-primary-dim cursor-pointer"
          >
            Close Panel
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL CONTENT — renders the active tab
   ═══════════════════════════════════════════════════════════════════════════ */

function DetailContent({
  tab,
  bot,
  profit,
  openTrades,
  closedTrades,
  perfData,
  entryData,
  exitData,
  statsData,
  configData,
  sysinfoData,
  logsData,
  locksData,
  balanceData,
  healthData,
}: {
  tab: DetailTab;
  bot: Bot;
  profit: Partial<FTProfit> | null;
  openTrades: FTTrade[];
  closedTrades: FTTrade[];
  perfData: FTPerformance[];
  entryData: FTEntry[];
  exitData: FTExit[];
  statsData: FTStats | null;
  configData: FTShowConfig | null;
  sysinfoData: FTSysinfo | null;
  logsData: FTLogsResponse | null;
  locksData: FTLocksResponse | null;
  balanceData: FTBalance | null;
  healthData: FTHealth | null;
}) {
  const sectionTitle = "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3";
  const row = "flex justify-between py-2 border-b border-border/40 last:border-b-0";
  const key = "text-xs text-muted-foreground";
  const val = "text-xs font-semibold text-foreground text-right";

  switch (tab) {
    /* ─── Overview ─── */
    case "overview": {
      return (
        <div className="space-y-6">
          {/* Bot Config Info */}
          <div>
            <div className={sectionTitle}>Bot Configuration</div>
            <div className={row}>
              <span className={key}>Exchange</span>
              <span className={val}>{bot.exchange_name ?? "—"}</span>
            </div>
            <div className={row}>
              <span className={key}>Strategy</span>
              <span className={val}>{bot.strategy_name ?? "—"}</span>
            </div>
            {configData && (
              <>
                <div className={row}>
                  <span className={key}>Timeframe</span>
                  <span className={val}>{configData.timeframe ?? "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Trading Mode</span>
                  <span className={val}>{configData.trading_mode ?? "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Margin Mode</span>
                  <span className={val}>{configData.margin_mode ?? "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Stake Currency</span>
                  <span className={val}>{configData.stake_currency ?? "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Stake Amount</span>
                  <span className={val}>{fmt(typeof configData.stake_amount === "number" ? configData.stake_amount : 0, 2)} {configData.stake_currency}</span>
                </div>
                <div className={row}>
                  <span className={key}>Max Open Trades</span>
                  <span className={val}>{configData.max_open_trades ?? "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Dry Run</span>
                  <span className={val}>{configData.dry_run ? "Yes" : "No"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Pairs Count</span>
                  <span className={val}>{configData.pair_whitelist?.length ?? 0}</span>
                </div>
              </>
            )}
          </div>

          {/* P&L Summary */}
          {profit && (
            <div>
              <div className={sectionTitle}>P&L Summary</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/10 border border-border/50 rounded-xl p-3 shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Closed Profit</div>
                  <div className={`text-sm font-black ${profitColor(profit.profit_closed_coin)}`}>
                    {fmtMoney(profit.profit_closed_coin)}
                  </div>
                </div>
                <div className="bg-muted/10 border border-border/50 rounded-xl p-3 shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Total Profit</div>
                  <div className={`text-sm font-black ${profitColor(profit.profit_all_coin)}`}>
                    {fmtMoney(profit.profit_all_coin)}
                  </div>
                </div>
                <div className="bg-muted/10 border border-border/50 rounded-xl p-3 shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Trade Count</div>
                  <div className="text-sm font-black text-foreground">{profit.trade_count}</div>
                </div>
                <div className="bg-muted/10 border border-border/50 rounded-xl p-3 shadow-sm">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Win Rate</div>
                  <div className="text-sm font-black text-foreground">
                    {(profit.winning_trades ?? 0) + (profit.losing_trades ?? 0) > 0
                      ? (((profit.winning_trades ?? 0) / ((profit.winning_trades ?? 0) + (profit.losing_trades ?? 0))) * 100).toFixed(1) + "%"
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {statsData && (
            <div>
              <div className={sectionTitle}>Advanced Stats</div>
              <div className={row}>
                <span className={key}>Profit Factor</span>
                <span className={val}>{fmt(statsData.profit_factor)}</span>
              </div>
              <div className={row}>
                <span className={key}>Max Drawdown</span>
                <span className={`${val} text-rose-500`}>
                  {statsData.max_drawdown != null ? fmt(statsData.max_drawdown * 100, 1) + "%" : "—"}
                </span>
              </div>
              {statsData.sharpe_ratio != null && (
                <div className={row}>
                  <span className={key}>Sharpe Ratio</span>
                  <span className={val}>{fmt(statsData.sharpe_ratio)}</span>
                </div>
              )}
              {statsData.sortino_ratio != null && (
                <div className={row}>
                  <span className={key}>Sortino Ratio</span>
                  <span className={val}>{fmt(statsData.sortino_ratio)}</span>
                </div>
              )}
            </div>
          )}

          {/* Wallet Balance */}
          {balanceData && (
            <div>
              <div className={sectionTitle}>Wallet Balance</div>
              {balanceData.currencies && balanceData.currencies.length > 0 ? (
                balanceData.currencies.slice(0, 5).map((c) => (
                  <div key={c.currency} className={row}>
                    <span className={key}>{c.currency}</span>
                    <span className={val}>{fmt(c.free, 4)} (${fmt(c.est_stake, 2)})</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">No balance data</div>
              )}
            </div>
          )}
        </div>
      );
    }

    /* ─── Trades ─── */
    case "trades": {
      return (
        <div className="space-y-6">
          {/* Open Trades */}
          <div>
            <div className={sectionTitle}>Open Positions ({openTrades.length})</div>
            {openTrades.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">No open trades</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Pair</th>
                      <th className="text-left py-2 font-medium">Side</th>
                      <th className="text-right py-2 font-medium">Entry</th>
                      <th className="text-right py-2 font-medium">Current</th>
                      <th className="text-right py-2 font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openTrades.map((t) => {
                      const pnl = t.current_profit_abs ?? 0;
                      return (
                        <tr key={t.trade_id} className="border-b border-border/30">
                          <td className="py-2 text-foreground font-medium">{t.pair}</td>
                          <td className="py-2">
                            <span className={t.is_short ? "text-rose-500" : "text-emerald-500"}>
                              {t.is_short ? "SHORT" : "LONG"}
                            </span>
                          </td>
                          <td className="py-2 text-right text-foreground">{fmt(t.open_rate, 4)}</td>
                          <td className="py-2 text-right text-foreground">{fmt(t.current_rate, 4)}</td>
                          <td className={`py-2 text-right font-semibold ${profitColor(pnl)}`}>
                            {fmtMoney(pnl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Closed Trades */}
          <div>
            <div className={sectionTitle}>Closed Trades (Last 10)</div>
            {closedTrades.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">No closed trades</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Pair</th>
                      <th className="text-left py-2 font-medium">Side</th>
                      <th className="text-right py-2 font-medium">Entry</th>
                      <th className="text-right py-2 font-medium">Exit</th>
                      <th className="text-right py-2 font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedTrades.slice(0, 10).map((t) => {
                      const pnl = t.close_profit_abs ?? 0;
                      return (
                        <tr key={t.trade_id} className="border-b border-border/30">
                          <td className="py-2 text-foreground font-medium">{t.pair}</td>
                          <td className="py-2">
                            <span className={t.is_short ? "text-rose-500" : "text-emerald-500"}>
                              {t.is_short ? "SHORT" : "LONG"}
                            </span>
                          </td>
                          <td className="py-2 text-right text-foreground">{fmt(t.open_rate, 4)}</td>
                          <td className="py-2 text-right text-foreground">{fmt(t.close_rate, 4)}</td>
                          <td className={`py-2 text-right font-semibold ${profitColor(pnl)}`}>
                            {fmtMoney(pnl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    }

    /* ─── Performance ─── */
    case "performance": {
      // Derive wins/losses from closed trades for enriched performance data
      const enrichedPerf = perfData.map((p) => {
        const pairClosed = closedTrades.filter((t) => t.pair === p.pair);
        const wins = pairClosed.filter((t) => (t.close_profit_abs ?? 0) >= 0).length;
        const losses = pairClosed.filter((t) => (t.close_profit_abs ?? 0) < 0).length;
        const winrate = pairClosed.length > 0 ? wins / pairClosed.length : 0;
        return { ...p, wins, losses, winrate };
      });
      return (
        <div className="space-y-6">
          {enrichedPerf && enrichedPerf.length > 0 ? (
            <div>
              <div className={sectionTitle}>Per-Pair Performance</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Pair</th>
                      <th className="text-right py-2 font-medium">Trades</th>
                      <th className="text-right py-2 font-medium">W</th>
                      <th className="text-right py-2 font-medium">L</th>
                      <th className="text-right py-2 font-medium">WR%</th>
                      <th className="text-right py-2 font-medium">Profit %</th>
                      <th className="text-right py-2 font-medium">Profit $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedPerf.map((p) => (
                      <tr key={p.pair} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{p.pair}</td>
                        <td className="py-2 text-right text-muted-foreground">{p.count}</td>
                        <td className="py-2 text-right text-emerald-500">{p.wins}</td>
                        <td className="py-2 text-right text-rose-500">{p.losses}</td>
                        <td className={`py-2 text-right font-medium ${p.winrate >= 0.6 ? "text-emerald-500" : p.winrate < 0.45 ? "text-rose-500" : "text-foreground"}`}>
                          {fmt(p.winrate * 100, 1)}%
                        </td>
                        <td className={`py-2 text-right font-semibold ${profitColor(p.profit_ratio)}`}>
                          {p.profit_ratio >= 0 ? "+" : ""}{fmt(p.profit_ratio * 100, 1)}%
                        </td>
                        <td className={`py-2 text-right font-semibold ${profitColor(p.profit_abs)}`}>
                          {fmtMoney(p.profit_abs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">No performance data</div>
          )}

          {entryData && entryData.length > 0 && (
            <div>
              <div className={sectionTitle}>Entry Tag Analysis</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Tag</th>
                      <th className="text-right py-2 font-medium">Trades</th>
                      <th className="text-right py-2 font-medium">W</th>
                      <th className="text-right py-2 font-medium">L</th>
                      <th className="text-right py-2 font-medium">WR%</th>
                      <th className="text-right py-2 font-medium">Avg %</th>
                      <th className="text-right py-2 font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryData.map((e) => (
                      <tr key={e.enter_tag ?? "untagged"} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{e.enter_tag ?? "untagged"}</td>
                        <td className="py-2 text-right text-muted-foreground">{e.entries}</td>
                        <td className="py-2 text-right text-emerald-500">{e.wins}</td>
                        <td className="py-2 text-right text-rose-500">{e.losses}</td>
                        <td className={`py-2 text-right font-medium ${e.winrate >= 0.6 ? "text-emerald-500" : e.winrate < 0.45 ? "text-rose-500" : "text-foreground"}`}>
                          {fmt(e.winrate * 100, 1)}%
                        </td>
                        <td className={`py-2 text-right ${profitColor(e.avg_profit)}`}>
                          {e.avg_profit >= 0 ? "+" : ""}{fmt(e.avg_profit, 2)}%
                        </td>
                        <td className={`py-2 text-right font-semibold ${profitColor(e.profit_abs)}`}>
                          {fmtMoney(e.profit_abs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {exitData && exitData.length > 0 && (
            <div>
              <div className={sectionTitle}>Exit Reason Analysis</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Reason</th>
                      <th className="text-right py-2 font-medium">Exits</th>
                      <th className="text-right py-2 font-medium">W</th>
                      <th className="text-right py-2 font-medium">L</th>
                      <th className="text-right py-2 font-medium">WR%</th>
                      <th className="text-right py-2 font-medium">Avg %</th>
                      <th className="text-right py-2 font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exitData.map((e) => (
                      <tr key={e.exit_reason ?? "untagged"} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{e.exit_reason ?? "untagged"}</td>
                        <td className="py-2 text-right text-muted-foreground">{e.exits}</td>
                        <td className="py-2 text-right text-emerald-500">{e.wins}</td>
                        <td className="py-2 text-right text-rose-500">{e.losses}</td>
                        <td className={`py-2 text-right font-medium ${e.winrate >= 0.6 ? "text-emerald-500" : e.winrate < 0.45 ? "text-rose-500" : "text-foreground"}`}>
                          {fmt(e.winrate * 100, 1)}%
                        </td>
                        <td className={`py-2 text-right ${profitColor(e.avg_profit)}`}>
                          {e.avg_profit >= 0 ? "+" : ""}{fmt(e.avg_profit, 2)}%
                        </td>
                        <td className={`py-2 text-right font-semibold ${profitColor(e.profit_abs)}`}>
                          {fmtMoney(e.profit_abs)}
                        </td>
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

    /* ─── Config ─── */
    case "config": {
      return (
        <div className="space-y-6">
          {configData ? (
            <>
              <div>
                <div className={sectionTitle}>Core Config</div>
                <div className={row}>
                  <span className={key}>Exchange</span>
                  <span className={val}>{typeof configData.exchange === "string" ? configData.exchange : "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Timeframe</span>
                  <span className={val}>{configData.timeframe ?? "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Stake Currency</span>
                  <span className={val}>{configData.stake_currency ?? "—"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Dry Run</span>
                  <span className={val}>{configData.dry_run ? "Yes" : "No"}</span>
                </div>
              </div>

              {configData.pair_whitelist && configData.pair_whitelist.length > 0 && (
                <div>
                  <div className={sectionTitle}>Whitelist ({configData.pair_whitelist.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {configData.pair_whitelist.map((p) => (
                      <span key={p} className="text-[9px] px-2 py-0.5 rounded-sm font-medium bg-cyan/8 text-cyan border border-cyan/20">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {locksData && locksData.locks && locksData.locks.length > 0 && (
                <div>
                  <div className={sectionTitle}>Locks ({locksData.locks.length})</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left py-2 font-medium">Pair</th>
                          <th className="text-left py-2 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locksData.locks.map((l) => (
                          <tr key={l.pair} className="border-b border-border/30">
                            <td className="py-2 text-foreground font-medium">{l.pair}</td>
                            <td className="py-2 text-muted-foreground">{l.reason ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">No config data</div>
          )}
        </div>
      );
    }

    /* ─── System ─── */
    case "system": {
      return (
        <div className="space-y-6">
          {sysinfoData && (
            <div>
              <div className={sectionTitle}>System Info</div>
              <div className={row}>
                <span className={key}>CPU % (avg)</span>
                <span className={val}>
                  {sysinfoData.cpu_pct.length > 0
                    ? fmt(sysinfoData.cpu_pct.reduce((a, b) => a + b, 0) / sysinfoData.cpu_pct.length, 1) + "%"
                    : "—"}
                </span>
              </div>
              <div className={row}>
                <span className={key}>CPU cores</span>
                <span className={val}>{sysinfoData.cpu_pct.length || "—"}</span>
              </div>
              <div className={row}>
                <span className={key}>Memory %</span>
                <span className={val}>{fmt(sysinfoData.ram_pct, 1)}%</span>
              </div>
              {sysinfoData.ram_total != null && (
                <div className={row}>
                  <span className={key}>Memory Total</span>
                  <span className={val}>{fmt((sysinfoData.ram_total ?? 0) / (1024 * 1024 * 1024), 1)} GB</span>
                </div>
              )}
            </div>
          )}

          {healthData && (
            <div>
              <div className={sectionTitle}>Bot Health</div>
              <div className={row}>
                <span className={key}>Last Process</span>
                <span className={val}>
                  {healthData.last_process
                    ? (() => {
                        const diff = (Date.now() - new Date(healthData.last_process).getTime()) / 1000;
                        return isNaN(diff) ? healthData.last_process : `${diff.toFixed(1)}s ago`;
                      })()
                    : "—"}
                </span>
              </div>
              <div className={row}>
                <span className={key}>Last Process (loc)</span>
                <span className={val}>{healthData.last_process_loc ?? "—"}</span>
              </div>
            </div>
          )}

          {/* Locks */}
          {locksData && locksData.locks && locksData.locks.length > 0 && (
            <div>
              <div className={sectionTitle}>Active Locks ({locksData.lock_count})</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Pair</th>
                      <th className="text-left py-2 font-medium">Side</th>
                      <th className="text-left py-2 font-medium">Reason</th>
                      <th className="text-right py-2 font-medium">Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locksData.locks.filter(l => l.active).map((l) => (
                      <tr key={l.id} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{l.pair}</td>
                        <td className="py-2 text-muted-foreground">{l.side || "—"}</td>
                        <td className="py-2 text-muted-foreground">{l.reason || "—"}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {l.lock_end_time ? new Date(l.lock_end_time).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {logsData && logsData.logs && logsData.logs.length > 0 && (
            <div>
              <div className={sectionTitle}>Recent Logs ({logsData.log_count} total)</div>
              <div className="bg-muted/50 border border-border rounded p-2 max-h-[300px] overflow-y-auto">
                <div className="font-mono text-[10px] space-y-1">
                  {logsData.logs.slice(-30).map((log, idx) => {
                    // Handle both 4-element and 5-element log tuples
                    const arr = log as string[];
                    let timestamp: string, level: string, message: string;
                    if (arr.length >= 5) {
                      [, , timestamp, level, message] = arr;
                    } else if (arr.length === 4) {
                      [timestamp, , level, message] = arr;
                    } else {
                      timestamp = ""; level = ""; message = arr.join(" ");
                    }
                    const timeStr = timestamp ? timestamp.split(" ").pop()?.slice(0, 8) ?? "" : "";
                    const levelColor =
                      level === "WARNING" || level === "WARN" ? "text-yellow-500" :
                      level === "ERROR" || level === "CRITICAL" ? "text-rose-500" :
                      level === "INFO" ? "text-blue-400" :
                      "text-muted-foreground";
                    return (
                      <div key={idx} className="flex gap-1">
                        <span className="text-muted-foreground/50 shrink-0">{timeStr}</span>
                        <span className={`shrink-0 font-semibold ${levelColor}`}>{level}</span>
                        <span className="text-foreground/80 break-all">{message ?? ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    /* --- Backtest --- */
    case "backtest": {
      // Show stats from profit data as a proxy for latest run performance
      const hasStats = statsData || profit;
      return (
        <div className="space-y-6">
          <div>
            <div className={sectionTitle}>Backtest Summary</div>
            {hasStats ? (
              <>
                <div className="bg-muted/10 border border-border/50 rounded-xl p-4 space-y-1 mb-4">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Latest Performance Snapshot</div>
                  <div className={row}>
                    <span className={key}>Total Trades</span>
                    <span className={val}>{profit?.trade_count ?? statsData?.wins != null ? (statsData?.wins ?? 0) + (statsData?.losses ?? 0) + (statsData?.draws ?? 0) : "—"}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Wins / Losses / Draws</span>
                    <span className={val}>{statsData ? `${statsData.wins} / ${statsData.losses} / ${statsData.draws}` : "—"}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Profit Factor</span>
                    <span className={val}>{statsData?.profit_factor != null ? fmt(statsData.profit_factor) : "—"}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Max Drawdown</span>
                    <span className={`${val} text-rose-500`}>{statsData?.max_drawdown != null ? fmt(statsData.max_drawdown * 100, 2) + "%" : "—"}</span>
                  </div>
                  {statsData?.max_consecutive_wins != null && (
                    <div className={row}>
                      <span className={key}>Max Consecutive Wins</span>
                      <span className={`${val} text-emerald-500`}>{statsData.max_consecutive_wins}</span>
                    </div>
                  )}
                  {statsData?.max_consecutive_losses != null && (
                    <div className={row}>
                      <span className={key}>Max Consecutive Losses</span>
                      <span className={`${val} text-rose-500`}>{statsData.max_consecutive_losses}</span>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground/60 text-center">
                  Run a full backtest from the Backtesting page for detailed timerange analysis.
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <p>No backtest history available for this bot.</p>
                <p className="text-[10px] text-muted-foreground/60">Run a backtest from the Backtesting page to see results here.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    /* --- Hyperopt --- */
    case "hyperopt": {
      // Show rejection/timeout stats from FTStats as hyperopt-relevant metrics
      return (
        <div className="space-y-6">
          <div>
            <div className={sectionTitle}>Hyperopt & Signal Quality</div>
            {statsData ? (
              <>
                <div className="bg-muted/10 border border-border/50 rounded-xl p-4 space-y-1 mb-4">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Signal & Order Metrics</div>
                  <div className={row}>
                    <span className={key}>Rejected Signals</span>
                    <span className={`${val} ${statsData.rejected_signals > 0 ? "text-amber-500" : ""}`}>{statsData.rejected_signals}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Timed Out Entries</span>
                    <span className={val}>{statsData.timedout_entry_orders}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Timed Out Exits</span>
                    <span className={val}>{statsData.timedout_exit_orders}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Cancelled Entries</span>
                    <span className={val}>{statsData.canceled_trade_entries}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Replaced Entry Orders</span>
                    <span className={val}>{statsData.replaced_entry_orders}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Avg Win Duration</span>
                    <span className={val}>{statsData.durations.wins != null ? fmtDurSec(statsData.durations.wins) : "—"}</span>
                  </div>
                  <div className={row}>
                    <span className={key}>Avg Loss Duration</span>
                    <span className={val}>{statsData.durations.losses != null ? fmtDurSec(statsData.durations.losses) : "—"}</span>
                  </div>
                  {statsData.sharpe_ratio != null && (
                    <div className={row}>
                      <span className={key}>Sharpe Ratio</span>
                      <span className={val}>{fmt(statsData.sharpe_ratio)}</span>
                    </div>
                  )}
                  {statsData.sortino_ratio != null && (
                    <div className={row}>
                      <span className={key}>Sortino Ratio</span>
                      <span className={val}>{fmt(statsData.sortino_ratio)}</span>
                    </div>
                  )}
                  {statsData.calmar_ratio != null && (
                    <div className={row}>
                      <span className={key}>Calmar Ratio</span>
                      <span className={val}>{fmt(statsData.calmar_ratio)}</span>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground/60 text-center">
                  Run hyperopt from the Backtesting page to optimize strategy parameters.
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <p>No hyperopt history available for this bot.</p>
                <p className="text-[10px] text-muted-foreground/60">Run hyperopt from the Backtesting page to see optimization results here.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    /* --- FreqAI --- */
    case "freqai": {
      const freqaiConfig = configData?.freqai;
      return (
        <div className="space-y-6">
          <div>
            <div className={sectionTitle}>FreqAI Model Status</div>
            {freqaiConfig ? (
              <>
                <div className={row}>
                  <span className={key}>Enabled</span>
                  <span className={val}>{freqaiConfig.enabled ? "Yes" : "No"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Identifier</span>
                  <span className={val}>{freqaiConfig.identifier ?? "\u2014"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Training Period</span>
                  <span className={val}>{freqaiConfig.train_period_days != null ? `${freqaiConfig.train_period_days} days` : "\u2014"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Backtest Period</span>
                  <span className={val}>{freqaiConfig.backtest_period_days != null ? `${freqaiConfig.backtest_period_days} days` : "\u2014"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Live Retrain</span>
                  <span className={val}>{freqaiConfig.live_retrain_hours != null ? `${freqaiConfig.live_retrain_hours}h` : "\u2014"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Feature Count</span>
                  <span className={val}>{freqaiConfig.feature_parameters?.include_timeframes?.length ?? "\u2014"}</span>
                </div>
                <div className={row}>
                  <span className={key}>Continual Learning</span>
                  <span className={val}>{freqaiConfig.continual_learning ? "Yes" : "No"}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <p>FreqAI is not configured for this bot.</p>
                <p className="text-[10px] text-muted-foreground/60">Enable FreqAI in the bot config to see model information here.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
