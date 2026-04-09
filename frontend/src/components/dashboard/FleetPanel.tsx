"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Play, Square, Pause, RefreshCw, XSquare, PlusSquare, ShieldAlert, Zap, GitCompare, Layers, ArrowUpDown } from "lucide-react";
import { fmtMoney, fmt } from "@/lib/format";
import type { Bot, FTProfit } from "@/types";

// Strategies confirmed to have can_short=True (from strategy file audit)
const CAN_SHORT_STRATEGIES = new Set([
  "CC_EMA21_v5l_v9",
  "FAdxSmaStrategy",
  "FReinforcedStrategy",
  "FSampleStrategy",
  "VolatilitySystem",
]);

function botCanShort(bot: Bot): boolean {
  if (bot.can_short != null) return bot.can_short;
  if (bot.strategy_name && CAN_SHORT_STRATEGIES.has(bot.strategy_name)) return true;
  return false;
}

interface FleetPanelProps {
  bots: Bot[];
  botProfits: Record<number, Partial<FTProfit>>;
  sparklines: Record<number, number[]>;
  onBotClick: (botId: number) => void;
  onStart: (botId: number) => void;
  onStop: (botId: number) => void;
  onPause: (botId: number) => void;
  onReload: (botId: number) => void;
  onForceExitAll: (botId: number) => void;
  onStopBuy: (botId: number) => void;
  onSoftKill: (botId: number) => void;
  onHardKill: (botId: number) => void;
}

type SortKey = "name" | "pnl" | "winRate" | "drawdown" | "trades";

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return <div className="flex gap-[2px] h-4 items-end">{[0,0,0,0,0].map((_, i) => <div key={i} className="w-1.5 rounded-sm bg-white/10" style={{ height: "30%" }} />)}</div>;
  const max = Math.max(...data.map(Math.abs), 0.01);
  return (
    <div className="flex gap-[2px] h-4 items-end">
      {data.slice(-6).map((v, i) => {
        const pct = Math.max(10, (Math.abs(v) / max) * 100);
        return (
          <div
            key={`sp-${i}`}
            className={`w-1.5 rounded-sm ${v >= 0 ? "bg-up" : "bg-down"}`}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

function getBotMetrics(bot: Bot, profit: Partial<FTProfit> | undefined) {
  const pnl = profit?.profit_closed_coin ?? null;
  const pnlPct = profit?.profit_closed_percent ?? null;
  const trades = profit?.trade_count ?? 0;
  const openTrades = ((profit as Record<string, unknown>)?.current_trade_count as number | undefined) ?? 0;
  const maxOT = bot.max_open_trades ?? null;
  const wins = profit?.winning_trades ?? profit?.wins ?? 0;
  const losses = profit?.losing_trades ?? profit?.losses ?? 0;
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : null;

  const avgDur = profit?.avg_duration;
  const avgDurStr = typeof avgDur === "number"
    ? (avgDur >= 86400
        ? `${Math.floor(avgDur / 86400)}d ${Math.floor((avgDur % 86400) / 3600)}h`
        : avgDur >= 3600
        ? `${(avgDur / 3600).toFixed(1)}h`
        : `${Math.round(avgDur / 60)}m`)
    : typeof avgDur === "string" ? avgDur : "—";

  const maxDd = (profit as Record<string, unknown>)?.max_drawdown as number | undefined;
  const bestPair = profit?.best_pair ?? undefined;
  const bestPairPct = profit?.best_pair_profit_ratio ?? undefined;

  return { pnl, pnlPct, trades, openTrades, maxOT, wins, losses, winRate, avgDurStr, maxDd, bestPair, bestPairPct };
}

export default function FleetPanel({
  bots,
  botProfits,
  sparklines,
  onBotClick,
  onStart,
  onStop,
  onPause,
  onReload,
  onForceExitAll,
  onStopBuy,
  onSoftKill,
  onHardKill,
}: FleetPanelProps) {
  const tradeBots = useMemo(() => bots.filter((b) => !b.is_utility && b.ft_mode !== "webserver"), [bots]);

  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortedBots = useMemo(() => {
    return [...tradeBots].sort((a, b) => {
      const am = getBotMetrics(a, botProfits[a.id]);
      const bm = getBotMetrics(b, botProfits[b.id]);
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "pnl": cmp = (am.pnl ?? -Infinity) - (bm.pnl ?? -Infinity); break;
        case "winRate": cmp = (am.winRate ?? -1) - (bm.winRate ?? -1); break;
        case "drawdown": cmp = (am.maxDd ?? 0) - (bm.maxDd ?? 0); break;
        case "trades": cmp = am.trades - bm.trades; break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [tradeBots, botProfits, sortKey, sortAsc]);

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: "pnl", label: "P&L" },
    { key: "name", label: "Name" },
    { key: "winRate", label: "Win%" },
    { key: "drawdown", label: "DD" },
    { key: "trades", label: "Trades" },
  ];

  return (
    <div className="w-[400px] flex flex-col gap-5 min-w-[400px] shrink-0">
    <div className="flex-1 bg-surface l-bd rounded-md flex flex-col shadow-xl overflow-hidden">
      {/* Header */}
      <div className="h-12 l-b flex items-center justify-between px-5 bg-black/40 shrink-0">
        <span className="section-title flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-muted" /> Fleet Management ({tradeBots.length})
        </span>
        <Link
          href="/dashboard/fleet"
          className="bg-white/10 px-3 py-1 rounded text-[11px] hover:bg-white/20 transition-colors font-medium flex items-center gap-1.5 text-muted hover:text-white"
          title="Open Fleet Management — Compare all bots side by side"
        >
          <GitCompare className="w-3 h-3" />Compare View
        </Link>
      </div>

      {/* Sort toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 l-b bg-black/20">
        <ArrowUpDown className="w-3 h-3 text-muted mr-1" />
        {sortButtons.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer ${
              sortKey === key ? "bg-white/15 text-white" : "text-muted hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {label}
            {sortKey === key && <span className="ml-0.5 text-[8px]">{sortAsc ? "↑" : "↓"}</span>}
          </button>
        ))}
      </div>

      {/* Bot List */}
      <div className="flex-1 overflow-y-auto flex flex-col font-mono text-xs">
        {sortedBots.length === 0 && (
          <div className="p-8 text-center text-sm text-muted">No bots registered.</div>
        )}
        {sortedBots.map((bot, idx) => {
          const { pnl, pnlPct, trades, openTrades, maxOT, winRate, avgDurStr, maxDd, bestPair, bestPairPct } = getBotMetrics(bot, botProfits[bot.id]);

          const isLive = bot.status === "running";
          const isPaused = bot.status === "draining";
          const isStopped = !isLive && !isPaused;
          const isFutures = bot.trading_mode === "futures";
          const isShort = botCanShort(bot);

          // Short display name — strip ft- prefix and -default/-vX suffix
          const displayName = bot.name
            .replace(/^(ft|nk)-/i, "")
            .replace(/-default$/i, "")
            .toUpperCase();

          return (
            <div
              key={bot.id}
              className={`px-4 py-3 l-b hover:bg-white/[0.04] transition-colors group cursor-pointer ${idx % 2 === 1 ? "bg-white/[0.012]" : ""}`}
              onClick={() => onBotClick(bot.id)}
            >
              {/* ── Row 1: Name + P&L ── */}
              <div className="flex items-center gap-2 mb-1.5 min-w-0">
                {/* Status LED */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  isLive ? "bg-up shadow-[0_0_4px_#22c55e]" :
                  isPaused ? "bg-yellow-400" : "bg-white/20"
                }`} />
                {/* Bot name — truncated */}
                <span className={`font-bold uppercase text-[11px] tracking-wide truncate flex-1 min-w-0 ${
                  isLive ? "text-white" : isPaused ? "text-white/60" : "text-white/35"
                }`} title={bot.name}>
                  {displayName}
                </span>
                {/* P&L — right aligned, no-shrink */}
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className={`font-bold text-[13px] ${
                    pnl != null && pnl > 0 ? "text-up" :
                    pnl != null && pnl < 0 ? "text-down" : "text-muted"
                  }`}>
                    {pnl != null ? fmtMoney(pnl) : "—"}
                  </span>
                  {pnlPct != null && (
                    <span className="text-[10px]" style={{ color: pnlPct >= 0 ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)" }}>
                      {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct, 1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* ── Row 2: Badges ── */}
              <div className="flex items-center gap-1 mb-2.5 pl-4">
                {/* Status badge */}
                {isPaused ? (
                  <span className="text-[9px] border border-yellow-500/30 px-1.5 py-[1px] rounded text-yellow-400 font-bold">DRAINING</span>
                ) : isStopped ? (
                  <span className="text-[9px] border border-down/30 px-1.5 py-[1px] rounded text-down font-bold">STOPPED</span>
                ) : bot.is_dry_run ? (
                  <span className="text-[9px] border border-yellow-500/30 px-1.5 py-[1px] rounded text-yellow-400 font-bold">PAPER</span>
                ) : (
                  <span className="text-[9px] border border-white/20 px-1.5 py-[1px] rounded text-white/60 font-bold">LIVE</span>
                )}
                {/* Market badge */}
                {isFutures ? (
                  <span className="text-[9px] border border-blue-500/40 px-1.5 py-[1px] rounded text-blue-400 font-bold">FUT</span>
                ) : (
                  <span className="text-[9px] border border-white/10 px-1.5 py-[1px] rounded text-white/25 font-bold">SPOT</span>
                )}
                {/* Direction badge */}
                {isShort ? (
                  <span className="text-[9px] border border-purple-500/35 px-1.5 py-[1px] rounded text-purple-400 font-bold">L/S</span>
                ) : (
                  <span className="text-[9px] border border-white/10 px-1.5 py-[1px] rounded text-white/25 font-bold">L</span>
                )}
                {/* Exchange */}
                {bot.exchange_name && (
                  <span className="text-[9px] text-white/20 font-bold uppercase ml-0.5">{bot.exchange_name}</span>
                )}
              </div>

              {/* ── Row 3: Stats 2×3 grid ── */}
              <div className="grid grid-cols-2 gap-y-1 text-[11px] mb-2.5 pl-4">
                <div className="flex items-center gap-1">
                  <span className="text-muted">Trades:</span>
                  <span className="text-white/70 font-bold">{trades}</span>
                  {openTrades > 0 && maxOT != null && (
                    <span className="text-muted text-[10px]">Open: {openTrades}/{maxOT}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted">Win:</span>
                  <span className={`font-bold ${winRate != null && winRate < 50 ? "text-down" : winRate != null && winRate >= 50 ? "text-white/80" : "text-muted"}`}>
                    {winRate != null ? `${fmt(winRate, 0)}%` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted">Drawdown:</span>
                  <span className={maxDd != null && maxDd > 0 ? "text-down font-bold" : "text-white/40"}>
                    {maxDd != null ? `-${fmt(maxDd * 100, 1)}%` : "-0.0%"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted">Avg. Dur:</span>
                  <span className="text-white/70">{avgDurStr}</span>
                </div>
                {bestPair && (
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-muted">Best:</span>
                    <span className="text-white/60 truncate">{bestPair}</span>
                    {bestPairPct != null && (
                      <span className="text-up text-[10px]">+{fmt(bestPairPct * 100, 1)}%</span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Row 4: Sparkline + Controls ── */}
              <div className="flex justify-between items-center pl-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <MiniSparkline data={sparklines[bot.id] ?? []} />
                <div className="flex gap-1">
                  <button className="bot-ctrl ctrl-start" title="▶ Start Bot" onClick={(e) => { e.stopPropagation(); onStart(bot.id); }}><Play className="w-3 h-3" /></button>
                  <button className="bot-ctrl ctrl-stop" title="■ Stop Bot" onClick={(e) => { e.stopPropagation(); onStop(bot.id); }}><Square className="w-3 h-3" /></button>
                  <button className="bot-ctrl ctrl-pause" title="⏸ Pause" onClick={(e) => { e.stopPropagation(); onPause(bot.id); }}><Pause className="w-3 h-3" /></button>
                  <button className="bot-ctrl" title="↻ Reload Config" onClick={(e) => { e.stopPropagation(); onReload(bot.id); }}><RefreshCw className="w-3 h-3" /></button>
                  <button className="bot-ctrl ctrl-stop" title="✕ Force Exit All" onClick={(e) => { e.stopPropagation(); onForceExitAll(bot.id); }}><XSquare className="w-3 h-3" /></button>
                  <button className="bot-ctrl" title="⊞ Toggle Stopbuy" onClick={(e) => { e.stopPropagation(); onStopBuy(bot.id); }}><PlusSquare className="w-3 h-3" /></button>
                  <span className="w-px h-3 bg-white/15 mx-0.5 self-center" />
                  <button className="bot-ctrl" style={{ color: "#facc15" }} title="🛡 Soft Kill" onClick={(e) => { e.stopPropagation(); onSoftKill(bot.id); }}><ShieldAlert className="w-3 h-3" /></button>
                  <button className="bot-ctrl ctrl-stop" title="⚡ Hard Kill" onClick={(e) => { e.stopPropagation(); onHardKill(bot.id); }}><Zap className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}
