"use client";

import React, { useState, useMemo } from "react";
import { fmt, fmtMoney } from "@/lib/format";
import type { FTTrade, FTPerformance, FTEntry, FTExit, FTWhitelist, FTLocksResponse } from "@/types";

type TradeTab = "open" | "closed" | "whitelist" | "performance" | "entries" | "exits";
type SortDir = "asc" | "desc" | null;

interface TradeTableProps {
  openTrades: FTTrade[];
  closedTrades: FTTrade[];
  perfData: FTPerformance[];
  entryData: FTEntry[];
  exitData: FTExit[];
  whitelistData: FTWhitelist | null;
  locksData: FTLocksResponse | null;
  loading: boolean;
  onForceExit: (trade: FTTrade, ordertype: string) => void;
  onReloadTrade: (trade: FTTrade) => void;
  onDeleteTrade: (trade: FTTrade) => void;
  onCancelOrder: (trade: FTTrade) => void;
  exitingTradeId: string | null;
}

function fmtDuration(openDate: string, closeDate?: string | null): string {
  const end = closeDate ? new Date(closeDate).getTime() : Date.now();
  const ms = end - new Date(openDate).getTime();
  if (isNaN(ms)) return "\u2014";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  align,
  highlight,
}: {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentDir: SortDir;
  onSort: (key: string) => void;
  align?: "left" | "right" | "center";
  highlight?: boolean;
}) {
  const active = currentSort === sortKey;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] ${alignClass} ${highlight ? "bg-black/20" : ""} ${active ? "text-white bg-white/[0.04]" : ""}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 text-[10px] opacity-25">
        {active ? (currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}
      </span>
    </th>
  );
}

function ActionDropdown({
  trade,
  onForceExit,
  onReloadTrade,
  onDeleteTrade,
  onCancelOrder,
  exiting,
}: {
  trade: FTTrade;
  onForceExit: (trade: FTTrade, ordertype: string) => void;
  onReloadTrade: (trade: FTTrade) => void;
  onDeleteTrade: (trade: FTTrade) => void;
  onCancelOrder: (trade: FTTrade) => void;
  exiting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasOpenOrder = trade.orders?.some((o) => o.status === "open") ?? false;

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        className="bg-[#1a1a1a] border border-white/[0.10] px-2.5 py-1 rounded-[5px] text-[#9CA3AF] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#2a2a2a] hover:text-[#F5F5F5] flex items-center gap-1.5"
        onClick={() => setOpen(!open)}
        disabled={exiting}
      >
        {exiting ? "..." : "Actions"} &#9660;
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 min-w-[200px] bg-[#151515] border border-white/[0.12] rounded-lg p-1 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onForceExit(trade, "limit"); setOpen(false); }}
            >
              Forceexit limit
            </button>
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onForceExit(trade, "market"); setOpen(false); }}
            >
              Forceexit market
            </button>
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onReloadTrade(trade); setOpen(false); }}
            >
              Reload
            </button>
            {hasOpenOrder && (
              <button
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                onClick={() => { onCancelOrder(trade); setOpen(false); }}
              >
                Cancel open order
              </button>
            )}
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#ef4444] rounded-[5px] hover:bg-[#ef4444]/10 transition-colors text-left"
              onClick={() => { onDeleteTrade(trade); setOpen(false); }}
            >
              Delete trade
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Generic sort helper
function useSortable<T>(data: T[], defaultKey?: string) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultKey ? "desc" : null);

  function onSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === "desc") setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      const na = typeof av === "number" ? av : typeof av === "string" ? av : 0;
      const nb = typeof bv === "number" ? bv : typeof bv === "string" ? bv : 0;
      if (typeof na === "number" && typeof nb === "number") {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      return sortDir === "asc"
        ? String(na).localeCompare(String(nb))
        : String(nb).localeCompare(String(na));
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, onSort };
}

export default function TradeTable({
  openTrades,
  closedTrades,
  perfData,
  entryData,
  exitData,
  whitelistData,
  locksData,
  loading,
  onForceExit,
  onReloadTrade,
  onDeleteTrade,
  onCancelOrder,
  exitingTradeId,
}: TradeTableProps) {
  const [activeTab, setActiveTab] = useState<TradeTab>("open");

  const openSort = useSortable(openTrades, "open_date");
  const closedSort = useSortable(closedTrades, "close_date");
  const perfSort = useSortable(perfData, "profit_abs");
  const entrySort = useSortable(entryData, "entries");
  const exitSort = useSortable(exitData, "exits");

  const tabs: Array<{ key: TradeTab; label: string; count?: number }> = [
    { key: "open", label: "Open Trades", count: openTrades.length },
    { key: "closed", label: "Closed", count: closedTrades.length },
    { key: "whitelist", label: "Whitelist Matrix" },
    { key: "performance", label: "Performance" },
    { key: "entries", label: "Entry Tags" },
    { key: "exits", label: "Exit Reasons" },
  ];

  const lockMap = useMemo(() => {
    const m = new Map<string, { reason: string; lock_end_time: string }>();
    if (locksData) {
      for (const lock of locksData.locks) {
        if (lock.active) m.set(lock.pair, { reason: lock.reason, lock_end_time: lock.lock_end_time });
      }
    }
    return m;
  }, [locksData]);

  return (
    <div className="flex-1 bg-[#0C0C0C] border border-white/[0.10] rounded-md shadow-xl flex flex-col min-h-0 overflow-hidden">
      {/* Tab Bar */}
      <div className="h-12 border-b border-white/[0.10] flex items-center bg-black/40 shrink-0 overflow-x-auto whitespace-nowrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`h-full px-5 font-bold text-[12px] uppercase tracking-wide shrink-0 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "border-b-2 border-[#22c55e] text-white"
                : "text-[#9CA3AF] hover:text-white"
            }`}
          >
            {tab.label}{tab.count != null ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[#9CA3AF] text-sm animate-pulse p-8">
            Loading trade data...
          </div>
        ) : (
          <>
            {/* OPEN TRADES */}
            {activeTab === "open" && (
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Date & Time" sortKey="open_date" {...openSort} />
                    <SortHeader label="Pair" sortKey="pair" {...openSort} />
                    <SortHeader label="Bot" sortKey="_bot_name" {...openSort} />
                    <SortHeader label="Side" sortKey="is_short" {...openSort} align="center" />
                    <SortHeader label="Size" sortKey="stake_amount" {...openSort} align="right" />
                    <SortHeader label="Entry" sortKey="open_rate" {...openSort} align="right" />
                    <SortHeader label="Mark Price" sortKey="current_rate" {...openSort} align="right" />
                    <SortHeader label="Profit %" sortKey="current_profit" {...openSort} align="right" highlight />
                    <SortHeader label="Value" sortKey="current_profit_abs" {...openSort} align="right" highlight />
                    <th className="px-5 py-3.5 font-medium text-right font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Fee</th>
                    <SortHeader label="Age" sortKey="open_date" {...openSort} />
                    <th className="px-5 py-3.5 font-medium border-l border-white/[0.08] text-center font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Actions</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {openSort.sorted.length === 0 ? (
                    <tr><td colSpan={12} className="px-5 py-8 text-center text-[#9CA3AF]">No open trades</td></tr>
                  ) : (
                    openSort.sorted.map((trade, idx) => {
                      const pct = trade.current_profit;
                      const pnl = trade.current_profit_abs;
                      const isUp = pnl != null && pnl >= 0;
                      const color = pnl != null ? (isUp ? "text-[#22c55e]" : "text-[#ef4444]") : "text-[#9CA3AF]";
                      const fee = (trade.fee_open + trade.fee_close) * trade.stake_amount;
                      const d = new Date(trade.open_date);
                      const dateStr = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear().toString().slice(2)}`;
                      const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

                      return (
                        <tr key={trade.trade_id} className={`hover:bg-white/[0.04] transition-colors group ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3">{dateStr} <span className="text-white/35 ml-1">{timeStr}</span></td>
                          <td className="px-5 py-3 font-bold text-white">{trade.pair}</td>
                          <td className="px-5 py-3 text-[#9CA3AF] font-sans text-[12px]">{trade._bot_name ?? `Bot ${trade._bot_id}`}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              trade.is_short
                                ? "bg-[#ef4444]/12 text-[#ef4444] border-[#ef4444]/25"
                                : "bg-[#22c55e]/12 text-[#22c55e] border-[#22c55e]/25"
                            }`}>
                              {trade.is_short ? "SHORT" : "LONG"}{trade.leverage > 1 ? ` ${trade.leverage}x` : ""}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{fmt(trade.stake_amount, 2)}</td>
                          <td className="px-5 py-3 text-right">{fmt(trade.open_rate, trade.open_rate < 1 ? 4 : 2)}</td>
                          <td className="px-5 py-3 text-right font-medium">{fmt(trade.current_rate, trade.current_rate < 1 ? 4 : 2)}</td>
                          <td className={`px-5 py-3 text-right font-bold ${isUp ? "bg-[#22c55e]/5" : pnl != null ? "bg-[#ef4444]/5" : ""} ${color}`}>
                            {pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct * 100, 2)}%` : "\u2014"}
                          </td>
                          <td className={`px-5 py-3 text-right ${isUp ? "bg-[#22c55e]/5" : pnl != null ? "bg-[#ef4444]/5" : ""} ${color}`}>
                            {pnl != null ? fmtMoney(pnl) : "\u2014"}
                          </td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF] text-[11px]">${fmt(fee, 2)}</td>
                          <td className="px-5 py-3 text-[#9CA3AF]">{fmtDuration(trade.open_date)}</td>
                          <td className="px-5 py-3 border-l border-white/[0.08] text-center opacity-40 group-hover:opacity-100 transition-opacity">
                            <ActionDropdown
                              trade={trade}
                              onForceExit={onForceExit}
                              onReloadTrade={onReloadTrade}
                              onDeleteTrade={onDeleteTrade}
                              onCancelOrder={onCancelOrder}
                              exiting={exitingTradeId === String(trade.trade_id)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* CLOSED TRADES */}
            {activeTab === "closed" && (
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Date" sortKey="close_date" {...closedSort} />
                    <SortHeader label="Pair" sortKey="pair" {...closedSort} />
                    <SortHeader label="Bot" sortKey="_bot_name" {...closedSort} />
                    <SortHeader label="Side" sortKey="is_short" {...closedSort} align="center" />
                    <SortHeader label="Entry" sortKey="open_rate" {...closedSort} align="right" />
                    <SortHeader label="Exit" sortKey="close_rate" {...closedSort} align="right" />
                    <SortHeader label="Profit %" sortKey="close_profit" {...closedSort} align="right" highlight />
                    <SortHeader label="Value" sortKey="close_profit_abs" {...closedSort} align="right" highlight />
                    <th className="px-5 py-3.5 font-medium text-right font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Fee</th>
                    <SortHeader label="Duration" sortKey="close_date" {...closedSort} />
                    <SortHeader label="Exit Reason" sortKey="exit_reason" {...closedSort} />
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {closedSort.sorted.length === 0 ? (
                    <tr><td colSpan={11} className="px-5 py-8 text-center text-[#9CA3AF]">No closed trades</td></tr>
                  ) : (
                    closedSort.sorted.map((trade, idx) => {
                      const pnl = trade.close_profit_abs;
                      const pct = trade.close_profit;
                      const isUp = pnl != null && pnl >= 0;
                      const color = pnl != null ? (isUp ? "text-[#22c55e]" : "text-[#ef4444]") : "text-[#9CA3AF]";
                      const fee = (trade.fee_open + trade.fee_close) * trade.stake_amount;
                      const d = trade.close_date ? new Date(trade.close_date) : null;
                      const dateStr = d ? `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear().toString().slice(2)}` : "\u2014";
                      const timeStr = d ? `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}` : "";

                      return (
                        <tr key={trade.trade_id} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3">{dateStr} <span className="text-white/35 ml-1">{timeStr}</span></td>
                          <td className="px-5 py-3 font-bold text-white">{trade.pair}</td>
                          <td className="px-5 py-3 text-[#9CA3AF] font-sans text-[12px]">{trade._bot_name ?? `Bot ${trade._bot_id}`}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              trade.is_short
                                ? "bg-[#ef4444]/12 text-[#ef4444] border-[#ef4444]/25"
                                : "bg-[#22c55e]/12 text-[#22c55e] border-[#22c55e]/25"
                            }`}>
                              {trade.is_short ? "SHORT" : "LONG"}{trade.leverage > 1 ? ` ${trade.leverage}x` : ""}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">{fmt(trade.open_rate, trade.open_rate < 1 ? 4 : 2)}</td>
                          <td className="px-5 py-3 text-right">{fmt(trade.close_rate, trade.close_rate != null && trade.close_rate < 1 ? 4 : 2)}</td>
                          <td className={`px-5 py-3 text-right font-bold ${isUp ? "bg-[#22c55e]/5" : pnl != null ? "bg-[#ef4444]/5" : ""} ${color}`}>
                            {pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct * 100, 2)}%` : "\u2014"}
                          </td>
                          <td className={`px-5 py-3 text-right ${isUp ? "bg-[#22c55e]/5" : pnl != null ? "bg-[#ef4444]/5" : ""} ${color}`}>
                            {pnl != null ? fmtMoney(pnl) : "\u2014"}
                          </td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF] text-[11px]">${fmt(fee, 2)}</td>
                          <td className="px-5 py-3 text-[#9CA3AF]">{fmtDuration(trade.open_date, trade.close_date)}</td>
                          <td className={`px-5 py-3 font-sans text-[11px] ${trade.exit_reason === "stoploss" ? "text-[#ef4444]" : "text-[#9CA3AF]"}`}>
                            {trade.exit_reason ?? "\u2014"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* WHITELIST MATRIX */}
            {activeTab === "whitelist" && (
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Pair</th>
                    <th className="px-5 py-3.5 font-medium text-center">Status</th>
                    <th className="px-5 py-3.5 font-medium text-center">Open Pos</th>
                    <th className="px-5 py-3.5 font-medium text-center">Lock</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {!whitelistData || whitelistData.whitelist.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-[#9CA3AF]">No whitelist data</td></tr>
                  ) : (
                    whitelistData.whitelist.map((pair, idx) => {
                      const lock = lockMap.get(pair);
                      const openCount = openTrades.filter((t) => t.pair === pair).length;
                      return (
                        <tr key={pair} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 font-bold text-white">{pair}</td>
                          <td className="px-5 py-3 text-center">
                            {lock ? (
                              <span className="bg-[#ef4444]/12 text-[#ef4444] border border-[#ef4444]/25 px-2 py-0.5 rounded text-[10px] font-bold">LOCKED</span>
                            ) : (
                              <span className="bg-[#22c55e]/12 text-[#22c55e] border border-[#22c55e]/25 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVE</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center font-bold">{openCount}</td>
                          <td className="px-5 py-3 text-center">
                            {lock ? (
                              <span className="text-[#ef4444] text-[10px] font-bold">{lock.reason}</span>
                            ) : "\u2014"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* PERFORMANCE */}
            {activeTab === "performance" && (
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Pair" sortKey="pair" {...perfSort} />
                    <SortHeader label="Trades" sortKey="trades" {...perfSort} align="right" />
                    <SortHeader label="Profit %" sortKey="profit_ratio" {...perfSort} align="right" highlight />
                    <SortHeader label="Profit Abs" sortKey="profit_abs" {...perfSort} align="right" highlight />
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {perfSort.sorted.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-[#9CA3AF]">No performance data</td></tr>
                  ) : (
                    perfSort.sorted.map((p, idx) => {
                      const isUp = p.profit_abs >= 0;
                      const color = isUp ? "text-[#22c55e]" : "text-[#ef4444]";
                      return (
                        <tr key={p.pair} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 font-bold text-white">{p.pair}</td>
                          <td className="px-5 py-3 text-right">{p.trades}</td>
                          <td className={`px-5 py-3 text-right font-bold ${isUp ? "bg-[#22c55e]/5" : "bg-[#ef4444]/5"} ${color}`}>
                            {p.profit_ratio >= 0 ? "+" : ""}{fmt(p.profit_ratio * 100, 1)}%
                          </td>
                          <td className={`px-5 py-3 text-right ${isUp ? "bg-[#22c55e]/5" : "bg-[#ef4444]/5"} ${color}`}>
                            {fmtMoney(p.profit_abs)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* ENTRY TAGS */}
            {activeTab === "entries" && (
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Tag" sortKey="enter_tag" {...entrySort} />
                    <SortHeader label="Trades" sortKey="entries" {...entrySort} align="right" />
                    <SortHeader label="Wins" sortKey="wins" {...entrySort} align="right" />
                    <SortHeader label="Losses" sortKey="losses" {...entrySort} align="right" />
                    <SortHeader label="Win Rate" sortKey="winrate" {...entrySort} align="right" />
                    <SortHeader label="Avg P&L %" sortKey="avg_profit" {...entrySort} align="right" />
                    <SortHeader label="Total P&L" sortKey="profit_abs" {...entrySort} align="right" />
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {entrySort.sorted.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-[#9CA3AF]">No entry tag data</td></tr>
                  ) : (
                    entrySort.sorted.map((e, idx) => {
                      const wrColor = e.winrate >= 0.6 ? "text-[#22c55e]" : e.winrate < 0.45 ? "text-[#ef4444]" : "text-white";
                      const pnlColor = e.profit_abs >= 0 ? "text-[#22c55e]" : "text-[#ef4444]";
                      return (
                        <tr key={e.enter_tag} className={`hover:bg-white/[0.04] ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 text-white font-medium">{e.enter_tag}</td>
                          <td className="px-5 py-3 text-right">{e.entries}</td>
                          <td className="px-5 py-3 text-right text-[#22c55e]">{e.wins}</td>
                          <td className="px-5 py-3 text-right text-[#ef4444]">{e.losses}</td>
                          <td className={`px-5 py-3 text-right font-medium ${wrColor}`}>{fmt(e.winrate * 100, 1)}%</td>
                          <td className={`px-5 py-3 text-right ${pnlColor}`}>{e.avg_profit >= 0 ? "+" : ""}{fmt(e.avg_profit, 2)}%</td>
                          <td className={`px-5 py-3 text-right font-bold ${pnlColor}`}>{fmtMoney(e.profit_abs)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* EXIT REASONS */}
            {activeTab === "exits" && (
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Reason" sortKey="exit_reason" {...exitSort} />
                    <SortHeader label="Exits" sortKey="exits" {...exitSort} align="right" />
                    <SortHeader label="Wins" sortKey="wins" {...exitSort} align="right" />
                    <SortHeader label="Losses" sortKey="losses" {...exitSort} align="right" />
                    <SortHeader label="Win Rate" sortKey="winrate" {...exitSort} align="right" />
                    <SortHeader label="Avg P&L %" sortKey="avg_profit" {...exitSort} align="right" />
                    <SortHeader label="Total P&L" sortKey="profit_abs" {...exitSort} align="right" />
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {exitSort.sorted.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-[#9CA3AF]">No exit reason data</td></tr>
                  ) : (
                    exitSort.sorted.map((e, idx) => {
                      const wrColor = e.winrate >= 0.6 ? "text-[#22c55e]" : e.winrate < 0.45 ? "text-[#ef4444]" : "text-white";
                      const pnlColor = e.profit_abs >= 0 ? "text-[#22c55e]" : "text-[#ef4444]";
                      return (
                        <tr key={e.exit_reason} className={`hover:bg-white/[0.04] ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 text-white font-medium">{e.exit_reason}</td>
                          <td className="px-5 py-3 text-right">{e.exits}</td>
                          <td className="px-5 py-3 text-right text-[#22c55e]">{e.wins}</td>
                          <td className="px-5 py-3 text-right text-[#ef4444]">{e.losses}</td>
                          <td className={`px-5 py-3 text-right font-medium ${wrColor}`}>{fmt(e.winrate * 100, 1)}%</td>
                          <td className={`px-5 py-3 text-right ${pnlColor}`}>{e.avg_profit >= 0 ? "+" : ""}{fmt(e.avg_profit, 2)}%</td>
                          <td className={`px-5 py-3 text-right font-bold ${pnlColor}`}>{fmtMoney(e.profit_abs)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
