"use client";

import React from "react";
import { fmtMoney, fmt } from "@/lib/format";

interface KPIGridProps {
  totalEquity: number | null;
  lockedInTrades: number | null;
  todayPnl: number | null;
  todayPnlPct: number | null;
  totalPnlClosed: number | null;
  totalPnlClosedPct: number | null;
  openPnl: number | null;
  openPnlPct: number | null;
  openTradeCount: number;
  maxOpenTrades: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  winCount: number;
  lossCount: number;
  profitFactor: number | null;
  avgDuration: string;
  totalTrades: number;
  bestPair: string | null;
  bestPairPct: number | null;
  sharpeRatio: number | null;
  tradingVolume: number | null;
  loading: boolean;
}

function KPISkeleton() {
  return (
    <div className="bg-black p-4 flex flex-col gap-2 animate-pulse">
      <div className="h-3 w-20 bg-white/10 rounded" />
      <div className="h-6 w-28 bg-white/10 rounded" />
    </div>
  );
}

function fmtVolume(v: number | null): string {
  if (v == null) return "\u2014";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtEquity(v: number | null): string {
  if (v == null) return "\u2014";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function KPIGrid({
  totalEquity,
  lockedInTrades,
  todayPnl,
  todayPnlPct,
  totalPnlClosed,
  totalPnlClosedPct,
  openPnl,
  openPnlPct,
  openTradeCount,
  maxOpenTrades,
  maxDrawdown,
  winRate,
  winCount,
  lossCount,
  profitFactor,
  avgDuration,
  totalTrades,
  bestPair,
  bestPairPct,
  sharpeRatio,
  tradingVolume,
  loading,
}: KPIGridProps) {
  if (loading) {
    return (
      <div className="rounded-md bg-white/10 l-bd shrink-0 overflow-hidden">
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 7 }).map((_, i) => <KPISkeleton key={`r1-${i}`} />)}
        </div>
        <div className="grid grid-cols-7 gap-px border-t border-white/10">
          {Array.from({ length: 7 }).map((_, i) => <KPISkeleton key={`r2-${i}`} />)}
        </div>
      </div>
    );
  }

  const lockedPct = totalEquity && lockedInTrades ? Math.round((lockedInTrades / totalEquity) * 100) : null;

  return (
    <div className="rounded-md bg-white/10 l-bd shrink-0 overflow-hidden">
      {/* Row 1: 7 primary KPIs */}
      <div className="grid grid-cols-7 gap-px">
        {/* Total Equity */}
        <div className="bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Total Equity</span>
          <span className="kpi-value text-xl">{fmtEquity(totalEquity)}</span>
        </div>
        {/* Locked in Trades */}
        <div className="bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Locked in Trades</span>
          <span className="kpi-value text-xl">
            {lockedInTrades != null ? fmtEquity(lockedInTrades) : "\u2014"}
            {lockedPct != null && <span className="text-[11px] text-muted font-sans font-normal ml-1">({lockedPct}%)</span>}
          </span>
        </div>
        {/* Today's P&L */}
        <div className="bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Today&apos;s P&amp;L</span>
          <span className={`kpi-value text-xl ${todayPnl != null && todayPnl >= 0 ? "text-up" : todayPnl != null && todayPnl < 0 ? "text-down" : ""}`}>
            {todayPnl != null ? fmtMoney(todayPnl) : "\u2014"}
            {todayPnlPct != null && <span className="text-[11px] font-sans font-normal ml-1">{todayPnlPct >= 0 ? "+" : ""}{fmt(todayPnlPct, 2)}%</span>}
          </span>
        </div>
        {/* Total P&L (Closed) */}
        <div className="bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Total P&amp;L (Closed)</span>
          <span className={`kpi-value text-xl ${totalPnlClosed != null && totalPnlClosed >= 0 ? "text-up" : totalPnlClosed != null && totalPnlClosed < 0 ? "text-down" : ""}`}>
            {totalPnlClosed != null ? fmtMoney(totalPnlClosed) : "\u2014"}
            {totalPnlClosedPct != null && <span className="text-[11px] font-sans font-normal ml-1">{totalPnlClosedPct >= 0 ? "+" : ""}{fmt(totalPnlClosedPct, 2)}%</span>}
          </span>
        </div>
        {/* Open P&L */}
        <div className="bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Open P&amp;L (Unreal.)</span>
          <span className={`kpi-value text-xl ${openPnl != null && openPnl >= 0 ? "text-up" : openPnl != null && openPnl < 0 ? "text-down" : ""}`}>
            {openPnl != null ? fmtMoney(openPnl) : "\u2014"}
            {openPnlPct != null && <span className="text-[11px] font-sans font-normal ml-1">{openPnlPct >= 0 ? "+" : ""}{fmt(openPnlPct, 2)}%</span>}
          </span>
        </div>
        {/* Open Trades */}
        <div className="bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Open Trades</span>
          <span className="kpi-value text-xl">
            {openTradeCount}
            {maxOpenTrades != null && <span className="text-[11px] text-muted font-sans font-normal ml-1">/ {maxOpenTrades} max</span>}
          </span>
        </div>
        {/* Max Drawdown */}
        <div className="bg-black p-4 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Max Drawdown</span>
          <span className={`kpi-value text-xl ${maxDrawdown != null ? "text-down" : ""}`}>
            {maxDrawdown != null ? `${fmt(maxDrawdown, 2)}%` : "\u2014"}
          </span>
        </div>
      </div>

      {/* Row 2: 7 secondary KPIs */}
      <div className="grid grid-cols-7 gap-px border-t border-white/10">
        {/* Win Rate */}
        <div className="bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Win Rate</span>
          <span className="kpi-value text-base">
            {winRate != null ? `${fmt(winRate, 1)}%` : "\u2014"}
            {(winCount > 0 || lossCount > 0) && <span className="text-[10px] text-muted font-sans font-normal ml-1">{winCount}W / {lossCount}L</span>}
          </span>
        </div>
        {/* Profit Factor */}
        <div className="bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Profit Factor</span>
          <span className={`kpi-value text-base ${profitFactor != null ? (profitFactor > 1 ? "text-up" : profitFactor < 1 ? "text-down" : "") : ""}`}>
            {profitFactor != null ? fmt(profitFactor, 2) : "\u2014"}
          </span>
        </div>
        {/* Avg Duration */}
        <div className="bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Avg Duration</span>
          <span className="kpi-value text-base">{avgDuration || "\u2014"}</span>
        </div>
        {/* Total Trades */}
        <div className="bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Total Trades</span>
          <span className="kpi-value text-base">{totalTrades.toLocaleString()}</span>
        </div>
        {/* Best Pair */}
        <div className="bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Best Pair</span>
          <span className={`kpi-value text-base ${bestPairPct != null && bestPairPct > 0 ? "text-up" : ""}`}>
            {bestPair || "\u2014"}
            {bestPairPct != null && <span className="text-[10px] font-sans font-normal ml-1">+{fmt(bestPairPct * 100, 2)}%</span>}
          </span>
        </div>
        {/* Sharpe Ratio */}
        <div className="bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Sharpe Ratio</span>
          <span className="kpi-value text-base">{sharpeRatio != null ? fmt(sharpeRatio, 2) : "\u2014"}</span>
        </div>
        {/* Trading Volume */}
        <div className="bg-black p-3 flex flex-col hover:bg-white/[0.04] transition-colors">
          <span className="kpi-label">Trading Volume</span>
          <span className="kpi-value text-base">{fmtVolume(tradingVolume)}</span>
        </div>
      </div>
    </div>
  );
}
