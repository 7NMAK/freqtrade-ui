"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Play, Square, Pause, RefreshCw, XSquare, PlusSquare, ShieldAlert, Zap, GitCompare, Layers, ArrowUpDown } from "lucide-react";
import { fmtMoney, fmt } from "@/lib/format";
import type { Bot, FTProfit } from "@/types";

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
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(Math.abs), 0.01);
  return (
    <div className="flex gap-[2px] h-4 items-end">
      {data.slice(-5).map((v, i) => {
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
  const winRate = profit && profit.winning_trades != null && profit.losing_trades != null
    ? ((profit.winning_trades / (profit.winning_trades + profit.losing_trades)) * 100)
    : null;
  const avgDur = profit?.avg_duration;
  const avgDurStr = typeof avgDur === "number"
    ? (avgDur >= 3600 ? `${(avgDur / 3600).toFixed(1)}h` : `${Math.round(avgDur / 60)}m`)
    : typeof avgDur === "string" ? avgDur : "\u2014";
  // max_drawdown is injected from botStats in the dashboard per-bot loop
  const maxDd = profit ? ((profit as Record<string, unknown>).max_drawdown as number | undefined) : undefined;

  return { pnl, pnlPct, trades, winRate, avgDurStr, maxDd };
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

  // ── Sorting ──────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
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
              sortKey === key
                ? "bg-white/15 text-white"
                : "text-muted hover:text-white hover:bg-white/[0.06]"
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
          const { pnl, pnlPct, trades, winRate, avgDurStr, maxDd } = getBotMetrics(bot, botProfits[bot.id]);

          const isLive = bot.status === "running";
          const isPaused = bot.status === "draining";
          const isStopped = !isLive && !isPaused;

          return (
            <div
              key={bot.id}
              className={`p-4 l-b hover:bg-white/[0.04] transition-colors group cursor-pointer ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}
              onClick={() => onBotClick(bot.id)}
            >
              {/* Section 1 — Top: name + status + PnL */}
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  {/* Status LED */}
                  <div className={`w-2 h-2 rounded-full ${
                    isLive ? "bg-up shadow-[0_0_4px_#22c55e]" :
                    isPaused ? "bg-yellow-400" :
                    "bg-down"
                  }`} />
                  {/* Bot name */}
                  <span className={`font-bold uppercase text-[12px] tracking-wide ${
                    isLive ? "text-white" :
                    isPaused ? "text-white/60" :
                    "text-white/40"
                  }`}>
                    {bot.name}
                  </span>
                  {/* Status badge */}
                  {isPaused ? (
                    <span className="text-[10px] border border-yellow-500/30 px-1.5 py-[1px] rounded text-yellow-400 font-medium">DRAINING</span>
                  ) : isStopped ? (
                    <span className="text-[10px] border border-down/30 px-1.5 py-[1px] rounded text-down font-medium">STOPPED</span>
                  ) : bot.is_dry_run ? (
                    <span className="text-[10px] border border-yellow-500/30 px-1.5 py-[1px] rounded text-yellow-400 font-medium">PAPER</span>
                  ) : (
                    <span className="text-[10px] border border-white/20 px-1.5 py-[1px] rounded text-white/60 font-medium">LIVE</span>
                  )}
                </div>
                <div className="text-right">
                  <span className={`font-bold text-[13px] ${
                    pnl != null && pnl > 0 ? "text-up" :
                    pnl != null && pnl < 0 ? "text-down" :
                    "text-muted"
                  }`}>
                    {pnl != null ? fmtMoney(pnl) : "\u2014"}
                  </span>
                  {!isPaused && pnlPct != null && (
                    <span
                      className="text-[10px]"
                      style={{ color: pnlPct >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)" }}
                    >
                      {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct, 1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Section 2 — Stats 2x2 grid */}
              <div className="grid grid-cols-2 gap-y-1.5 text-muted text-[12px] mb-3">
                <div className="flex justify-between w-full pr-5">
                  <span className="text-muted">Trades:</span>
                  <span className="text-white/70">{trades}</span>
                </div>
                <div className="flex justify-between w-full">
                  <span className="text-muted">Win:</span>
                  <span className={winRate != null && winRate < 50 ? "text-down" : "text-white/70"}>
                    {winRate != null ? `${fmt(winRate, 0)}%` : "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between w-full pr-5">
                  <span className="text-muted">Drawdown:</span>
                  <span className={maxDd != null ? "text-down" : "text-white/70"}>
                    {maxDd != null ? `-${fmt(maxDd * 100, 1)}%` : "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between w-full">
                  <span className="text-muted">Avg. Dur:</span>
                  <span className="text-white/70">{avgDurStr}</span>
                </div>
              </div>

              {/* Section 3 — Sparkline + Controls */}
              <div className="flex justify-between items-center opacity-50 group-hover:opacity-100 transition-opacity">
                <MiniSparkline data={sparklines[bot.id] ?? []} />
                <div className="flex gap-1">
                  <button className="bot-ctrl ctrl-start" title="&#9654; Start Bot — Resume trading engine" onClick={(e) => { e.stopPropagation(); onStart(bot.id); }}>
                    <Play className="w-3 h-3" />
                  </button>
                  <button className="bot-ctrl ctrl-stop" title="&#9632; Stop Bot — Gracefully stop trading" onClick={(e) => { e.stopPropagation(); onStop(bot.id); }}>
                    <Square className="w-3 h-3" />
                  </button>
                  <button className="bot-ctrl ctrl-pause" title="&#9208; Pause — Stop opening new trades" onClick={(e) => { e.stopPropagation(); onPause(bot.id); }}>
                    <Pause className="w-3 h-3" />
                  </button>
                  <button className="bot-ctrl" title="&#8635; Reload Config — Hot-reload strategy config" onClick={(e) => { e.stopPropagation(); onReload(bot.id); }}>
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button className="bot-ctrl ctrl-stop" title="&#10005; Force Exit All — Close all open positions" onClick={(e) => { e.stopPropagation(); onForceExitAll(bot.id); }}>
                    <XSquare className="w-3 h-3" />
                  </button>
                  <button className="bot-ctrl" title="&#8862; Toggle Stopbuy — Prevent new buy orders" onClick={(e) => { e.stopPropagation(); onStopBuy(bot.id); }}>
                    <PlusSquare className="w-3 h-3" />
                  </button>
                  <span className="w-px h-3 bg-white/15 mx-0.5 self-center" />
                  <button className="bot-ctrl" style={{ color: "#facc15" }} title="Soft Kill — exits all trades, keeps bot" onClick={(e) => { e.stopPropagation(); onSoftKill(bot.id); }}>
                    <ShieldAlert className="w-3 h-3" />
                  </button>
                  <button className="bot-ctrl ctrl-stop" title="Hard Kill — force stop bot + container" onClick={(e) => { e.stopPropagation(); onHardKill(bot.id); }}>
                    <Zap className="w-3 h-3" />
                  </button>
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
