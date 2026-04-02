"use client";

import React from "react";
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
            className={`w-1.5 rounded-sm ${v >= 0 ? "bg-[#22c55e]" : "bg-[#ef4444]"}`}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

function BotStatusDot({ status }: { status: string }) {
  if (status === "running") {
    return <div className="w-2 h-2 bg-[#22c55e] rounded-full shadow-[0_0_4px_#22c55e]" />;
  }
  if (status === "draining") {
    return <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />;
  }
  return <div className="w-2 h-2 bg-[#ef4444] rounded-full" />;
}

function BotStatusBadge({ status, isDryRun }: { status: string; isDryRun: boolean }) {
  if (status === "draining") {
    return <span className="text-[10px] border border-yellow-500/30 px-1.5 py-[1px] rounded text-yellow-400 font-medium">DRAINING</span>;
  }
  if (status !== "running") {
    return <span className="text-[10px] border border-[#ef4444]/30 px-1.5 py-[1px] rounded text-[#ef4444] font-medium">STOPPED</span>;
  }
  if (isDryRun) {
    return <span className="text-[10px] border border-yellow-500/30 px-1.5 py-[1px] rounded text-yellow-400 font-medium">PAPER</span>;
  }
  return <span className="text-[10px] border border-white/20 px-1.5 py-[1px] rounded text-white/60 font-medium">LIVE</span>;
}

function CtrlBtn({
  title,
  icon,
  variant,
  onClick,
}: {
  title: string;
  icon: string;
  variant?: "start" | "stop" | "pause" | "warn" | "default";
  onClick: (e: React.MouseEvent) => void;
}) {
  const hoverClass =
    variant === "start" ? "hover:text-[#22c55e] hover:border-[rgba(34,197,94,0.3)]" :
    variant === "stop" ? "hover:text-[#ef4444] hover:border-[rgba(239,68,68,0.3)]" :
    variant === "pause" ? "hover:text-[#eab308] hover:border-[rgba(234,179,8,0.3)]" :
    variant === "warn" ? "text-[#facc15]" :
    "hover:text-[#F5F5F5] hover:border-white/20";

  return (
    <button
      className={`inline-flex items-center justify-center w-7 h-7 rounded-[5px] bg-[#1a1a1a] border border-white/10 text-[#9CA3AF] transition-all cursor-pointer hover:bg-[#2a2a2a] ${hoverClass}`}
      title={title}
      onClick={onClick}
    >
      <span className="text-xs">{icon}</span>
    </button>
  );
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
  const tradeBots = bots.filter((b) => !b.is_utility && b.ft_mode !== "webserver");

  return (
    <div className="w-[400px] flex flex-col gap-5 min-w-[400px] shrink-0 2xl:w-[400px] xl:w-[320px] xl:min-w-[320px]">
      <div className="flex-1 bg-[#0C0C0C] border border-white/[0.10] rounded-md flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="h-12 border-b border-white/[0.10] flex items-center justify-between px-5 bg-black/40 shrink-0">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF] flex items-center gap-2.5">
            <span className="text-[#9CA3AF]">&#x25a6;</span> Fleet Management ({tradeBots.length})
          </span>
        </div>

        {/* Bot List */}
        <div className="flex-1 overflow-y-auto flex flex-col font-mono text-xs">
          {tradeBots.length === 0 && (
            <div className="p-8 text-center text-sm text-[#9CA3AF]">No bots registered.</div>
          )}
          {tradeBots.map((bot, idx) => {
            const profit = botProfits[bot.id];
            const pnl = profit?.profit_all_coin ?? null;
            const pnlPct = profit?.profit_all_percent ?? null;
            const trades = profit?.trade_count ?? 0;
            const winRate = profit && profit.winning_trades != null && profit.losing_trades != null
              ? ((profit.winning_trades / (profit.winning_trades + profit.losing_trades)) * 100)
              : null;
            const avgDur = profit?.avg_duration;
            const avgDurStr = typeof avgDur === "number"
              ? (avgDur >= 3600 ? `${(avgDur / 3600).toFixed(1)}h` : `${Math.round(avgDur / 60)}m`)
              : typeof avgDur === "string" ? avgDur : "\u2014";
            const maxDd = profit ? ((profit as Record<string, unknown>).max_drawdown as number | undefined) : undefined;

            return (
              <div
                key={bot.id}
                className={`p-4 border-b border-white/[0.10] hover:bg-white/[0.04] transition-colors group cursor-pointer ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}
                onClick={() => onBotClick(bot.id)}
              >
                {/* Top: name + status + PnL */}
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <BotStatusDot status={bot.status} />
                    <span className={`font-bold uppercase text-[12px] tracking-wide ${bot.status === "running" ? "text-white" : "text-white/40"}`}>
                      {bot.name}
                    </span>
                    <BotStatusBadge status={bot.status} isDryRun={bot.is_dry_run} />
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-bold text-[13px] ${pnl != null && pnl >= 0 ? "text-[#22c55e]" : pnl != null && pnl < 0 ? "text-[#ef4444]" : "text-[#9CA3AF]"}`}>
                      {pnl != null ? fmtMoney(pnl) : "\u2014"}
                    </span>
                    {pnlPct != null && (
                      <span className={`text-[10px] ml-1 ${pnlPct >= 0 ? "text-[#22c55e]/50" : "text-[#ef4444]/50"}`}>
                        {pnlPct >= 0 ? "+" : ""}{fmt(pnlPct, 1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats 2x2 grid */}
                <div className="grid grid-cols-2 gap-y-1.5 text-[#9CA3AF] text-[12px] mb-3">
                  <div className="flex justify-between w-full pr-5">
                    <span>Trades:</span>
                    <span className="text-white/70">{trades}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span>Win:</span>
                    <span className={winRate != null && winRate < 50 ? "text-[#ef4444]" : "text-white/70"}>
                      {winRate != null ? `${fmt(winRate, 0)}%` : "\u2014"}
                    </span>
                  </div>
                  <div className="flex justify-between w-full pr-5">
                    <span>Drawdown:</span>
                    <span className={maxDd != null ? "text-[#ef4444]" : "text-white/70"}>
                      {maxDd != null ? `${fmt(maxDd, 1)}%` : "\u2014"}
                    </span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span>Avg. Dur:</span>
                    <span className="text-white/70">{avgDurStr}</span>
                  </div>
                </div>

                {/* Sparkline + Controls */}
                <div className="flex justify-between items-center opacity-50 group-hover:opacity-100 transition-opacity">
                  <MiniSparkline data={sparklines[bot.id] ?? []} />
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <CtrlBtn title="Start Bot" icon="&#9654;" variant="start" onClick={(e) => { e.stopPropagation(); onStart(bot.id); }} />
                    <CtrlBtn title="Stop Bot" icon="&#9632;" variant="stop" onClick={(e) => { e.stopPropagation(); onStop(bot.id); }} />
                    <CtrlBtn title="Pause (Stopbuy)" icon="&#10074;&#10074;" variant="pause" onClick={(e) => { e.stopPropagation(); onPause(bot.id); }} />
                    <CtrlBtn title="Reload Config" icon="&#8635;" onClick={(e) => { e.stopPropagation(); onReload(bot.id); }} />
                    <CtrlBtn title="Force Exit All" icon="&#10005;" variant="stop" onClick={(e) => { e.stopPropagation(); onForceExitAll(bot.id); }} />
                    <CtrlBtn title="Toggle Stopbuy" icon="&#8862;" onClick={(e) => { e.stopPropagation(); onStopBuy(bot.id); }} />
                    <span className="w-px h-3 bg-white/15 mx-0.5 self-center" />
                    <CtrlBtn title="Soft Kill" icon="&#128737;" variant="warn" onClick={(e) => { e.stopPropagation(); onSoftKill(bot.id); }} />
                    <CtrlBtn title="Hard Kill" icon="&#9889;" variant="stop" onClick={(e) => { e.stopPropagation(); onHardKill(bot.id); }} />
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
