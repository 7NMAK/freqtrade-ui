"use client";

import React, { useState } from "react";
import { X, Play, Square, Pause, RefreshCw, PlusCircle, XSquare, PlusSquare, ShieldAlert, Zap } from "lucide-react";
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
  onPause?: () => void;
  onReload?: () => void;
  onForceEnter?: () => void;
  onForceExitAll?: () => void;
  onStopBuy?: () => void;
  onSoftKill?: () => void;
  onHardKill?: () => void;
}

// Status Badge helper — matches ds_bot_drawer.md §30B Mode Badge Variants
function StatusBadge({ status, isDryRun }: { status: string; isDryRun: boolean }) {
  if (status === "draining") {
    return (
      <span className="px-1.5 py-[2px] bg-yellow-400/15 text-yellow-400 border border-yellow-500/25 text-[10px] font-bold rounded">
        PAUSED
      </span>
    );
  }
  if (status !== "running") {
    return (
      <span className="px-1.5 py-[2px] bg-down/15 text-down border border-down/25 text-[10px] font-bold rounded">
        STOPPED
      </span>
    );
  }
  if (isDryRun) {
    return (
      <span className="px-1.5 py-[2px] bg-blue-500/15 text-blue-400 border border-blue-500/25 text-[10px] font-bold rounded">
        DRY
      </span>
    );
  }
  return (
    <span className="px-1.5 py-[2px] bg-up/15 text-up border border-up/25 text-[10px] font-bold rounded">
      LIVE
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
  onPause,
  onReload,
  onForceEnter,
  onForceExitAll,
  onStopBuy,
  onSoftKill,
  onHardKill,
}: BotDetailPanelProps) {
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  if (!bot) return null;

  const isRunning = bot.status === "running";
  const isDraining = bot.status === "draining";

  return (
    <>
      {/* Backdrop — ds_bot_drawer.md §30N */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 z-50 transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Drawer Panel — ds_bot_drawer.md §30A */}
      <div
        className="fixed top-0 bottom-0 right-0 z-[60] flex flex-col overflow-hidden"
        style={{
          width: "min(560px, 90vw)",
          background: "#0C0C0C",
          borderLeft: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.85)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header — ds_bot_drawer.md §30B */}
        <div className="p-4 pb-3 l-b bg-black flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-base font-bold tracking-tight text-white font-mono">{bot.name}</h2>
                <StatusBadge status={bot.status} isDryRun={bot.is_dry_run} />
              </div>
              <p className="text-[11px] text-muted font-mono uppercase tracking-wide">
                Strategy: {bot.strategy_name ?? "N/A"} &middot; {bot.exchange_name ?? "Exchange"} &middot; {isRunning ? "Running" : isDraining ? "Draining" : "Stopped"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white text-muted p-1.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* 9 Action Buttons — ds_bot_drawer.md §30B: .bot-ctrl class, icons w-3.5 h-3.5 */}
          <div className="flex items-center gap-1 flex-wrap">
            <button type="button" onClick={onStart} className="bot-ctrl ctrl-start" title="▶ Start Bot"><Play className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={onStop} className="bot-ctrl ctrl-stop" title="■ Stop Bot"><Square className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={onPause ?? onDrain} className="bot-ctrl ctrl-pause" title="⏸ Pause"><Pause className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={onReload ?? onEdit} className="bot-ctrl" title="↻ Reload Config"><RefreshCw className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={onForceEnter ?? (() => {})} className="bot-ctrl ctrl-start" title="Force open trade"><PlusCircle className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={onForceExitAll ?? (() => {})} className="bot-ctrl ctrl-stop" title="✕ Force Exit All"><XSquare className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={onStopBuy ?? (() => {})} className="bot-ctrl" title="⊞ Toggle Stopbuy"><PlusSquare className="w-3.5 h-3.5" /></button>
            <span className="w-px h-4 bg-white/15 mx-1" />
            <button type="button" onClick={onSoftKill ?? (() => {})} className="bot-ctrl" style={{ color: "#facc15" }} title="🛡 Soft Kill"><ShieldAlert className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={onHardKill ?? (() => {})} className="bot-ctrl ctrl-stop" title="⚡ Hard Kill"><Zap className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Tabs — ds_bot_drawer.md §30C */}
        <div className="l-b flex items-end px-1 bg-black/50 shrink-0 overflow-x-auto gap-0">
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
              className={`h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors ${
                detailTab === tab.key
                  ? "border-b-2 border-up text-white"
                  : "text-muted hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body — ds_bot_drawer.md §30D: p-4 flex flex-col gap-4 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted text-sm">
              Loading details...
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-4">
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
            </div>
          )}
        </div>

        {/* Bottom actions — Edit, Duplicate, Delete, Close */}
        <div className="px-4 py-3 l-t flex gap-2 shrink-0">
          <button type="button" onClick={onEdit} className="flex-1 py-2 rounded l-bd bg-surface text-muted text-[11px] font-medium text-center transition-all hover:bg-white/[0.04] cursor-pointer">Edit</button>
          <button type="button" onClick={onDuplicate} className="flex-1 py-2 rounded l-bd bg-surface text-muted text-[11px] font-medium text-center transition-all hover:bg-white/[0.04] cursor-pointer">Duplicate</button>
          <button type="button" onClick={onDelete} className="py-2 px-4 rounded border border-down/20 bg-down/10 text-down text-[11px] font-medium text-center transition-all hover:bg-down/15 cursor-pointer">Delete</button>
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded bg-white/10 text-white text-[11px] font-semibold text-center transition-all hover:bg-white/20 cursor-pointer">Close</button>
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
  // DS v1.4 §6 section-title + §30E/F stats row tokens
  const sectionTitle = "kpi-label mb-2";
  const row = "flex justify-between py-1.5";
  const key = "text-[12px] font-mono text-muted";
  const val = "text-[12px] font-mono font-bold text-white text-right";

  switch (tab) {
    /* ─── Overview ─── */
    case "overview": {
      const winCount = profit?.winning_trades ?? statsData?.wins ?? 0;
      const lossCount = profit?.losing_trades ?? statsData?.losses ?? 0;
      const totalCount = winCount + lossCount;
      const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : null;
      const openPnl = openTrades.reduce((s, t) => s + (t.current_profit_abs ?? 0), 0);
      // Expectancy
      const expectancy = totalCount > 0 && statsData ? (statsData.profit_all_coin ?? 0) / totalCount : null;

      return (
        <div className="space-y-4">
          {/* KPI Row — 4 columns matching prototype */}
          {/* KPI Cards — ds_bot_drawer.md §30E */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="bg-surface p-3 l-bd rounded">
              <div className="kpi-label">Closed P&L</div>
              <div className={`font-mono font-bold text-lg ${profitColor(profit?.profit_closed_coin)}`}>{fmtMoney(profit?.profit_closed_coin)}</div>
              {profit?.profit_closed_percent != null && <div className={`text-[10px] font-mono mt-0.5 ${profitColor(profit.profit_closed_percent)}`}>{profit.profit_closed_percent >= 0 ? "+" : ""}{fmt(profit.profit_closed_percent, 1)}%</div>}
            </div>
            <div className="bg-surface p-3 l-bd rounded">
              <div className="kpi-label">Open P&L</div>
              <div className={`font-mono font-bold text-lg ${profitColor(openPnl)}`}>{fmtMoney(openPnl)}</div>
              <div className="text-white/35 text-[10px] font-mono mt-0.5">{openTrades.length} position{openTrades.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="bg-surface p-3 l-bd rounded">
              <div className="kpi-label">Win Rate</div>
              <div className="font-mono font-bold text-lg text-white">{winRate != null ? `${fmt(winRate, 1)}%` : "—"}</div>
              <div className="text-white/35 text-[10px] font-mono mt-0.5">{winCount}W / {lossCount}L</div>
            </div>
            <div className="bg-surface p-3 l-bd rounded">
              <div className="kpi-label">Trades</div>
              <div className="font-mono font-bold text-lg text-white">{profit?.trade_count ?? totalCount}</div>
              {statsData?.durations?.wins != null && <div className="text-white/35 text-[10px] font-mono mt-0.5">{fmtDurSec(statsData.durations.wins)} avg hold</div>}
            </div>
          </div>

          {/* 2-column stats grid matching prototype */}
          {/* Stats Grid — ds_bot_drawer.md §30F */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Risk Metrics */}
            <div className="bg-surface p-3 l-bd rounded">
              <div className="kpi-label mb-2">Risk Metrics</div>
              <div className="space-y-1.5 font-mono text-[12px]">
                <div className="flex justify-between"><span className="text-muted">Profit Factor</span><span className={`font-bold ${(statsData?.profit_factor ?? 0) > 1 ? "text-up" : "text-white"}`}>{statsData?.profit_factor != null ? fmt(statsData.profit_factor) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Max Drawdown</span><span className="text-down font-bold">{statsData?.max_drawdown != null ? fmt(statsData.max_drawdown * 100, 1) + "%" : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Sharpe Ratio</span><span className="text-white">{statsData?.sharpe_ratio != null ? fmt(statsData.sharpe_ratio) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Sortino Ratio</span><span className="text-white">{statsData?.sortino_ratio != null ? fmt(statsData.sortino_ratio) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Expectancy</span><span className={profitColor(expectancy)}>{expectancy != null ? fmtMoney(expectancy) : "—"}</span></div>
              </div>
            </div>
            {/* Bot Info */}
            <div className="bg-surface p-3 l-bd rounded">
              <div className="kpi-label mb-2">Bot Info</div>
              <div className="space-y-1.5 font-mono text-[12px]">
                <div className="flex justify-between"><span className="text-muted">Exchange</span><span className="text-white">{bot.exchange_name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Mode</span><span className="text-white">{configData ? `${configData.trading_mode ?? "spot"} · ${configData.margin_mode ?? "—"}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Timeframe</span><span className="text-white">{configData?.timeframe ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Stake</span><span className="text-white">{configData ? `${fmt(typeof configData.stake_amount === "number" ? configData.stake_amount : 0, 0)} ${configData.stake_currency ?? ""}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Max Trades</span><span className="text-white">{configData?.max_open_trades ?? "—"}</span></div>
              </div>
            </div>
          </div>

          {/* Wallet Balance — matching prototype */}
          {/* Wallet — ds_bot_drawer.md §30G */}
          {balanceData && (
            <div className="bg-surface p-3 l-bd rounded">
              <div className="kpi-label mb-2">Wallet Balance</div>
              {balanceData.currencies && balanceData.currencies.filter(c => c.balance > 0 || c.used > 0 || c.est_stake > 0 || c.free > 0).length > 0 ? (
                <div className="grid grid-cols-3 gap-4 font-mono text-[12px]">
                  {balanceData.currencies.filter(c => c.balance > 0 || c.used > 0 || c.est_stake > 0 || c.free > 0).slice(0, 3).map((c) => (
                    <div key={c.currency}>
                      <span className="text-muted block text-[10px] mb-0.5">{c.currency}</span>
                      <span className="text-white font-bold">{fmt(c.balance, c.balance < 1 ? 4 : 2)}</span>
                    </div>
                  ))}
                  {balanceData.total > 0 && (
                    <div>
                      <span className="text-muted block text-[10px] mb-0.5">Total Est.</span>
                      <span className="text-white font-bold">${fmt(balanceData.total, 0)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted text-xs">No balance data</div>
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
            <h3 className={`${sectionTitle} flex items-center gap-2`}>Open Positions <span className="text-muted/30">({openTrades.length})</span></h3>
            {openTrades.length === 0 ? (
              <div className="text-center py-6 text-muted text-xs">No open trades</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] font-mono">
                  <thead className="text-muted text-[11px] uppercase tracking-widest">
                    <tr>
                      <th className="text-left py-1.5 px-1 font-medium">Pair</th>
                      <th className="text-left py-1.5 px-1 font-medium">Side</th>
                      <th className="text-right py-1.5 px-1 font-medium">Lev</th>
                      <th className="text-right py-1.5 px-1 font-medium">Entry</th>
                      <th className="text-right py-1.5 px-1 font-medium">Current</th>
                      <th className="text-right py-1.5 px-1 font-medium">Stake</th>
                      <th className="text-right py-1.5 px-1 font-medium">P&L</th>
                      <th className="text-right py-1.5 px-1 font-medium">P&L %</th>
                      <th className="text-right py-1.5 px-1 font-medium">Duration</th>
                      <th className="text-left py-1.5 px-1 font-medium">Enter Tag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {openTrades.map((t) => {
                      const pnl = t.current_profit_abs ?? 0;
                      const pct = t.current_profit != null ? t.current_profit * 100 : null;
                      const ms = Date.now() - new Date(t.open_date).getTime();
                      const durH = Math.floor(ms / 3600000);
                      const durM = Math.floor((ms % 3600000) / 60000);
                      const durStr = durH > 0 ? `${durH}h${durM.toString().padStart(2, "0")}m` : `${durM}m`;
                      return (
                        <tr key={t.trade_id} className="hover:bg-white/[0.04]">
                          <td className="py-1.5 px-1 text-white font-medium">{t.pair}</td>
                          <td className="py-1.5 px-1"><span className={`${t.is_short ? "bg-down/12 text-down" : "bg-up/12 text-up"} px-1 py-0.5 rounded text-[9px] font-bold`}>{t.is_short ? "SHORT" : "LONG"}</span></td>
                          <td className="py-1.5 px-1 text-right">{t.leverage > 1 ? `${t.leverage}x` : "1x"}</td>
                          <td className="py-1.5 px-1 text-right">{fmt(t.open_rate, t.open_rate < 1 ? 4 : 0)}</td>
                          <td className="py-1.5 px-1 text-right font-medium">{fmt(t.current_rate, t.current_rate < 1 ? 4 : 0)}</td>
                          <td className="py-1.5 px-1 text-right">{fmt(t.stake_amount, 0)}</td>
                          <td className={`py-1.5 px-1 text-right font-bold ${profitColor(pnl)}`}>{fmtMoney(pnl)}</td>
                          <td className={`py-1.5 px-1 text-right ${profitColor(pct)}`}>{pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct, 2)}%` : "—"}</td>
                          <td className="py-1.5 px-1 text-right text-muted">{durStr}</td>
                          <td className="py-1.5 px-1 text-muted">{t.enter_tag ?? "—"}</td>
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
            <h3 className={`${sectionTitle} flex items-center gap-2`}>Closed Trades <span className="text-muted/30">(last 10)</span></h3>
            {closedTrades.length === 0 ? (
              <div className="text-center py-6 text-muted text-xs">No closed trades</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] font-mono">
                  <thead className="text-muted text-[11px] uppercase tracking-widest">
                    <tr>
                      <th className="text-left py-1.5 px-1 font-medium">Pair</th>
                      <th className="text-left py-1.5 px-1 font-medium">Side</th>
                      <th className="text-right py-1.5 px-1 font-medium">Lev</th>
                      <th className="text-right py-1.5 px-1 font-medium">Entry</th>
                      <th className="text-right py-1.5 px-1 font-medium">Exit</th>
                      <th className="text-right py-1.5 px-1 font-medium">Stake</th>
                      <th className="text-right py-1.5 px-1 font-medium">P&L</th>
                      <th className="text-right py-1.5 px-1 font-medium">P&L %</th>
                      <th className="text-right py-1.5 px-1 font-medium">Duration</th>
                      <th className="text-left py-1.5 px-1 font-medium">Enter Tag</th>
                      <th className="text-left py-1.5 px-1 font-medium">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {closedTrades.slice(0, 10).map((t) => {
                      const pnl = t.close_profit_abs ?? 0;
                      const pct = t.close_profit != null ? t.close_profit * 100 : null;
                      const ms = t.close_date ? new Date(t.close_date).getTime() - new Date(t.open_date).getTime() : 0;
                      const durH = Math.floor(ms / 3600000);
                      const durM = Math.floor((ms % 3600000) / 60000);
                      const durStr = ms > 0 ? (durH > 0 ? `${durH}h${durM.toString().padStart(2, "0")}m` : `${durM}m`) : "—";
                      return (
                        <tr key={t.trade_id} className="hover:bg-white/[0.04]">
                          <td className="py-1.5 px-1 text-white font-medium">{t.pair}</td>
                          <td className="py-1.5 px-1"><span className={`${t.is_short ? "text-down" : "text-up"} text-[9px] font-bold`}>{t.is_short ? "SHORT" : "LONG"}</span></td>
                          <td className="py-1.5 px-1 text-right">{t.leverage > 1 ? `${t.leverage}x` : "1x"}</td>
                          <td className="py-1.5 px-1 text-right">{fmt(t.open_rate, t.open_rate < 1 ? 4 : 0)}</td>
                          <td className="py-1.5 px-1 text-right">{fmt(t.close_rate, t.close_rate != null && t.close_rate < 1 ? 4 : 0)}</td>
                          <td className="py-1.5 px-1 text-right">{fmt(t.stake_amount, 0)}</td>
                          <td className={`py-1.5 px-1 text-right font-bold ${profitColor(pnl)}`}>{fmtMoney(pnl)}</td>
                          <td className={`py-1.5 px-1 text-right ${profitColor(pct)}`}>{pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct, 2)}%` : "—"}</td>
                          <td className="py-1.5 px-1 text-right text-muted">{durStr}</td>
                          <td className="py-1.5 px-1 text-muted">{t.enter_tag ?? "—"}</td>
                          <td className="py-1.5 px-1 text-muted">{t.exit_reason ?? "—"}</td>
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
      // Derive best/worst pair, best tag, best exit for KPI summary
      const bestPerf = enrichedPerf.length > 0 ? enrichedPerf.reduce((best, p) => p.profit_abs > best.profit_abs ? p : best, enrichedPerf[0]) : null;
      const worstPerf = enrichedPerf.length > 0 ? enrichedPerf.reduce((worst, p) => p.profit_abs < worst.profit_abs ? p : worst, enrichedPerf[0]) : null;
      const bestEntry = entryData.length > 0 ? entryData.reduce((best, e) => (e.profit_abs ?? 0) > (best.profit_abs ?? 0) ? e : best, entryData[0]) : null;
      const bestExit = exitData.length > 0 ? exitData.reduce((best, e) => (e.profit_abs ?? 0) > (best.profit_abs ?? 0) ? e : best, exitData[0]) : null;

      return (
        <div className="space-y-4">
          {/* KPI Summary — 4 columns matching prototype */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="bg-surface l-bd rounded p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted tracking-wider mb-1">Best Pair</div>
              <div className={`font-mono font-bold text-sm ${profitColor(bestPerf?.profit_abs)}`}>{bestPerf?.pair ?? "—"}</div>
              {bestPerf && <div className={`text-[10px] font-mono ${profitColor(bestPerf.profit_abs)}`}>{fmtMoney(bestPerf.profit_abs)}</div>}
            </div>
            <div className="bg-surface l-bd rounded p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted tracking-wider mb-1">Worst Pair</div>
              <div className={`font-mono font-bold text-sm ${profitColor(worstPerf?.profit_abs)}`}>{worstPerf?.pair ?? "—"}</div>
              {worstPerf && <div className={`text-[10px] font-mono ${profitColor(worstPerf.profit_abs)}`}>{fmtMoney(worstPerf.profit_abs)}</div>}
            </div>
            <div className="bg-surface l-bd rounded p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted tracking-wider mb-1">Best Tag</div>
              <div className={`font-mono font-bold text-sm ${profitColor(bestEntry?.profit_abs)}`}>{bestEntry?.enter_tag ?? "—"}</div>
              {bestEntry && <div className={`text-[10px] font-mono ${profitColor(bestEntry.profit_abs)}`}>{fmtMoney(bestEntry.profit_abs)}</div>}
            </div>
            <div className="bg-surface l-bd rounded p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-muted tracking-wider mb-1">Best Exit</div>
              <div className={`font-mono font-bold text-sm ${profitColor(bestExit?.profit_abs)}`}>{bestExit?.exit_reason ?? "—"}</div>
              {bestExit && <div className={`text-[10px] font-mono ${profitColor(bestExit.profit_abs)}`}>{fmtMoney(bestExit.profit_abs)}</div>}
            </div>
          </div>

          {/* Per-Pair Performance */}
          {enrichedPerf.length > 0 ? (
            <div className="bg-surface l-bd rounded p-3">
              <h3 className={sectionTitle}>Per-Pair Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] font-mono whitespace-nowrap">
                  <thead><tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="text-left px-2 py-1.5 font-semibold">Pair</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Trades</th>
                    <th className="text-right px-2 py-1.5 font-semibold">profit_abs</th>
                    <th className="text-right px-2 py-1.5 font-semibold">profit_ratio</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Win Rate</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border/30">
                    {enrichedPerf.map((p) => (
                      <tr key={p.pair} className="hover:bg-white/[0.04]">
                        <td className="px-2 py-1.5 text-white">{p.pair}</td>
                        <td className="px-2 py-1.5 text-right">{p.count ?? p.trades ?? 0}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${profitColor(p.profit_abs)}`}>{fmtMoney(p.profit_abs)}</td>
                        <td className={`px-2 py-1.5 text-right ${profitColor(p.profit_ratio)}`}>{p.profit_ratio >= 0 ? "+" : ""}{fmt(p.profit_ratio * 100, 2)}%</td>
                        <td className={`px-2 py-1.5 text-right ${p.winrate >= 0.6 ? "text-up" : p.winrate < 0.45 ? "text-down" : "text-white"}`}>{fmt(p.winrate * 100, 1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted text-xs">No performance data</div>
          )}

          {/* Entry / Exit Analysis side by side — matching prototype */}
          {(entryData.length > 0 || exitData.length > 0) && (
            <div className="grid grid-cols-2 gap-2.5">
              {entryData.length > 0 && (
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className={sectionTitle}>Entry Tags</h3>
                  <table className="w-full text-[13px] font-mono whitespace-nowrap">
                    <thead><tr className="text-muted text-[11px] uppercase tracking-widest">
                      <th className="text-left px-2 py-1.5 font-semibold">Tag</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Trades</th>
                      <th className="text-right px-2 py-1.5 font-semibold">WR%</th>
                      <th className="text-right px-2 py-1.5 font-semibold">P&L</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border/30">
                      {entryData.map((e) => (
                        <tr key={e.enter_tag ?? "untagged"} className="hover:bg-white/[0.04]">
                          <td className="px-2 py-1.5 text-white">{e.enter_tag ?? "untagged"}</td>
                          <td className="px-2 py-1.5 text-right">{e.entries ?? 0}</td>
                          <td className={`px-2 py-1.5 text-right ${(e.winrate ?? 0) >= 0.6 ? "text-up" : (e.winrate ?? 0) < 0.45 ? "text-down" : "text-white"}`}>{fmt((e.winrate ?? 0) * 100, 1)}%</td>
                          <td className={`px-2 py-1.5 text-right font-bold ${profitColor(e.profit_abs)}`}>{fmtMoney(e.profit_abs ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {exitData.length > 0 && (
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className={sectionTitle}>Exit Reasons</h3>
                  <table className="w-full text-[13px] font-mono whitespace-nowrap">
                    <thead><tr className="text-muted text-[11px] uppercase tracking-widest">
                      <th className="text-left px-2 py-1.5 font-semibold">Reason</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Exits</th>
                      <th className="text-right px-2 py-1.5 font-semibold">WR%</th>
                      <th className="text-right px-2 py-1.5 font-semibold">P&L</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border/30">
                      {exitData.map((e) => (
                        <tr key={e.exit_reason ?? "untagged"} className="hover:bg-white/[0.04]">
                          <td className="px-2 py-1.5 text-white">{e.exit_reason ?? "untagged"}</td>
                          <td className="px-2 py-1.5 text-right">{e.exits ?? 0}</td>
                          <td className={`px-2 py-1.5 text-right ${(e.winrate ?? 0) >= 0.6 ? "text-up" : (e.winrate ?? 0) < 0.45 ? "text-down" : "text-white"}`}>{fmt((e.winrate ?? 0) * 100, 1)}%</td>
                          <td className={`px-2 py-1.5 text-right font-bold ${profitColor(e.profit_abs)}`}>{fmtMoney(e.profit_abs ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                  <span className={key}>Strategy</span>
                  <span className={val}>{configData.strategy ?? "—"}</span>
                </div>
                {configData.strategy_version && (
                  <div className={row}>
                    <span className={key}>Strategy Version</span>
                    <span className={val}>{configData.strategy_version}</span>
                  </div>
                )}
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
                  <span className={key}>Stake Amount</span>
                  <span className={val}>{fmt(typeof configData.stake_amount === "number" ? configData.stake_amount : 0, 2)} {configData.stake_currency}</span>
                </div>
                {configData.max_open_trades != null && (
                  <div className={row}>
                    <span className={key}>Max Open Trades</span>
                    <span className={val}>{configData.max_open_trades}</span>
                  </div>
                )}
                <div className={row}>
                  <span className={key}>Dry Run</span>
                  <span className={val}>{configData.dry_run ? "Yes" : "No"}</span>
                </div>
                {configData.trading_mode && (
                  <div className={row}>
                    <span className={key}>Trading Mode</span>
                    <span className={val}>{configData.trading_mode}</span>
                  </div>
                )}
                {configData.margin_mode && (
                  <div className={row}>
                    <span className={key}>Margin Mode</span>
                    <span className={val}>{configData.margin_mode}</span>
                  </div>
                )}
                {configData.available_capital != null && (
                  <div className={row}>
                    <span className={key}>Available Capital</span>
                    <span className={val}>{fmt(configData.available_capital, 2)} {configData.stake_currency}</span>
                  </div>
                )}
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
                        <tr className="text-muted l-b">
                          <th className="text-left py-2 font-medium">Pair</th>
                          <th className="text-left py-2 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locksData.locks.map((l) => (
                          <tr key={l.pair} className="border-b border-white/[0.03]">
                            <td className="py-2 text-white font-medium">{l.pair}</td>
                            <td className="py-2 text-muted">{l.reason ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-muted text-xs">No config data</div>
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
                    <tr className="text-muted l-b">
                      <th className="text-left py-2 font-medium">Pair</th>
                      <th className="text-left py-2 font-medium">Side</th>
                      <th className="text-left py-2 font-medium">Reason</th>
                      <th className="text-right py-2 font-medium">Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locksData.locks.filter(l => l.active).map((l) => (
                      <tr key={l.id} className="border-b border-white/[0.03]">
                        <td className="py-2 text-white font-medium">{l.pair}</td>
                        <td className="py-2 text-muted">{l.side || "—"}</td>
                        <td className="py-2 text-muted">{l.reason || "—"}</td>
                        <td className="py-2 text-right text-muted">
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
              <div className="bg-surface l-bd rounded p-2 max-h-[300px] overflow-y-auto">
                <div className="font-mono text-[10px] space-y-1">
                  {logsData.logs.slice(-30).map((log, idx) => {
                    // FT logs format: [id, timestamp, module, level, message]
                    const arr = log as string[];
                    let timestamp: string, level: string, message: string;
                    if (arr.length >= 5) {
                      [, timestamp, , level, message] = arr;
                    } else if (arr.length === 4) {
                      [timestamp, , level, message] = arr;
                    } else {
                      timestamp = ""; level = ""; message = arr.join(" ");
                    }
                    const timeStr = timestamp ? String(timestamp).split(" ").pop()?.slice(0, 8) ?? "" : "";
                    const levelColor =
                      level === "WARNING" || level === "WARN" ? "text-yellow-500" :
                      level === "ERROR" || level === "CRITICAL" ? "text-down" :
                      level === "INFO" ? "text-blue-400" :
                      "text-muted";
                    return (
                      <div key={idx} className="flex gap-1">
                        <span className="text-muted/50 shrink-0">{timeStr}</span>
                        <span className={`shrink-0 font-semibold ${levelColor}`}>{level}</span>
                        <span className="text-white/80 break-all">{message ?? ""}</span>
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
                <div className="bg-surface l-bd rounded p-4 space-y-1 mb-4">
                  <div className="text-[10px] uppercase font-bold text-muted tracking-wider mb-2">Latest Performance Snapshot</div>
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
                    <span className={`${val} text-down`}>{statsData?.max_drawdown != null ? fmt(statsData.max_drawdown * 100, 2) + "%" : "—"}</span>
                  </div>
                  {statsData?.max_consecutive_wins != null && (
                    <div className={row}>
                      <span className={key}>Max Consecutive Wins</span>
                      <span className={`${val} text-up`}>{statsData.max_consecutive_wins}</span>
                    </div>
                  )}
                  {statsData?.max_consecutive_losses != null && (
                    <div className={row}>
                      <span className={key}>Max Consecutive Losses</span>
                      <span className={`${val} text-down`}>{statsData.max_consecutive_losses}</span>
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-muted/60 text-center">
                  Run a full backtest from the Backtesting page for detailed timerange analysis.
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted text-xs space-y-2">
                <p>No backtest history available for this bot.</p>
                <p className="text-[10px] text-muted/60">Run a backtest from the Backtesting page to see results here.</p>
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
                <div className="bg-surface l-bd rounded p-4 space-y-1 mb-4">
                  <div className="text-[10px] uppercase font-bold text-muted tracking-wider mb-2">Signal & Order Metrics</div>
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
                <div className="text-[10px] text-muted/60 text-center">
                  Run hyperopt from the Backtesting page to optimize strategy parameters.
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted text-xs space-y-2">
                <p>No hyperopt history available for this bot.</p>
                <p className="text-[10px] text-muted/60">Run hyperopt from the Backtesting page to see optimization results here.</p>
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
              <div className="text-center py-8 text-muted text-xs space-y-2">
                <p>FreqAI is not configured for this bot.</p>
                <p className="text-[10px] text-muted/60">Enable FreqAI in the bot config to see model information here.</p>
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
