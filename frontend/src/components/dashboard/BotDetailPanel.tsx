"use client";

import React, { useState } from "react";
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

type DetailTab = "overview" | "trades" | "performance" | "config" | "system";

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
            &times;
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
              { key: "system", label: "System" },
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
      return (
        <div className="space-y-6">
          {perfData && perfData.length > 0 ? (
            <div>
              <div className={sectionTitle}>Per-Pair Performance</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Pair</th>
                      <th className="text-right py-2 font-medium">Trades</th>
                      <th className="text-right py-2 font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfData.map((p) => (
                      <tr key={p.pair} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{p.pair}</td>
                        <td className="py-2 text-right text-muted-foreground">{p.count}</td>
                        <td className={`py-2 text-right font-semibold ${profitColor(p.profit)}`}>
                          {fmtMoney(p.profit)}
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
              <div className={sectionTitle}>Entry Tag Analysis (Top 5)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Tag</th>
                      <th className="text-right py-2 font-medium">Trades</th>
                      <th className="text-right py-2 font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryData.slice(0, 5).map((e) => (
                      <tr key={e.enter_tag ?? "untagged"} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{e.enter_tag ?? "untagged"}</td>
                        <td className="py-2 text-right text-muted-foreground">{e.entries}</td>
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
              <div className={sectionTitle}>Exit Reason Analysis (Top 5)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Reason</th>
                      <th className="text-right py-2 font-medium">Trades</th>
                      <th className="text-right py-2 font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exitData.slice(0, 5).map((e) => (
                      <tr key={e.exit_reason ?? "untagged"} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{e.exit_reason ?? "untagged"}</td>
                        <td className="py-2 text-right text-muted-foreground">{e.exits}</td>
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
                <span className={key}>CPU %</span>
                <span className={val}>{sysinfoData.cpu_pct.length > 0 ? fmt(sysinfoData.cpu_pct[0], 1) : "—"}%</span>
              </div>
              <div className={row}>
                <span className={key}>Memory %</span>
                <span className={val}>{fmt(sysinfoData.ram_pct, 1)}%</span>
              </div>
            </div>
          )}

          {healthData && (
            <div>
              <div className={sectionTitle}>Bot Health</div>
              <div className={row}>
                <span className={key}>Last Process</span>
                <span className={val}>{healthData.last_process ?? "—"}</span>
              </div>
            </div>
          )}

          {logsData && logsData.logs && logsData.logs.length > 0 && (
            <div>
              <div className={sectionTitle}>Recent Logs</div>
              <div className="bg-muted/50 border border-border rounded p-2 max-h-40 overflow-y-auto">
                <div className="font-mono text-[9px] text-muted-foreground space-y-0.5">
                  {logsData.logs.slice(0, 20).map((log, idx) => (
                    <div key={idx}>{typeof log === "string" ? log : JSON.stringify(log)}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
