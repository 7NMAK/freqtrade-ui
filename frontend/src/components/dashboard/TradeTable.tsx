"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Filter, ChevronDown, Download, LogOut, Zap, Scissors, PlusCircle, RefreshCw, Trash2, Ban } from "lucide-react";
import { fmt, fmtMoney } from "@/lib/format";
import type { FTTrade, FTPerformance, FTEntry, FTExit, FTWhitelist, FTLocksResponse } from "@/types";

type TradeTab = "open" | "closed" | "whitelist" | "performance" | "entries" | "exits";
type SortDir = "asc" | "desc" | null;
type ColumnFilters = Record<string, Set<string>>;

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

function FilterDropdown({
  column,
  values,
  activeFilters,
  onToggle,
}: {
  column: string;
  values: string[];
  activeFilters: Set<string> | undefined;
  onToggle: (column: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = activeFilters && activeFilters.size > 0;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block ml-1" ref={ref}>
      <button
        className={`inline-flex items-center p-0.5 rounded transition-colors ${isActive ? "text-[#22d3ee]" : "text-[#9CA3AF]/50 hover:text-[#9CA3AF]"}`}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <Filter className="w-2.5 h-2.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[160px] bg-[#151515] border border-white/[0.12] rounded-lg p-1.5 z-50 shadow-[0_8px_30px_rgba(0,0,0,0.6)] max-h-[200px] overflow-y-auto">
          {values.map((val) => {
            const checked = !activeFilters || activeFilters.size === 0 || activeFilters.has(val);
            return (
              <label key={val} className="flex items-center gap-2 px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.06] rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(column, val)}
                  className="w-3 h-3 accent-[#22d3ee]"
                />
                {val || "(empty)"}
              </label>
            );
          })}
        </div>
      )}
    </div>
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
        {exiting ? "..." : "Actions"} <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 min-w-[200px] bg-[#151515] border border-white/[0.12] rounded-lg p-1 z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onForceExit(trade, "limit"); setOpen(false); }}
            >
              <LogOut className="w-3.5 h-3.5 text-[#9CA3AF]" /> Forceexit limit
            </button>
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onForceExit(trade, "market"); setOpen(false); }}
            >
              <Zap className="w-3.5 h-3.5 text-[#9CA3AF]" /> Forceexit market
            </button>
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onForceExit(trade, "partial"); setOpen(false); }}
            >
              <Scissors className="w-3.5 h-3.5 text-[#9CA3AF]" /> Forceexit partial
            </button>
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onForceExit(trade, "increase"); setOpen(false); }}
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#9CA3AF]" /> Increase position
            </button>
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
              onClick={() => { onReloadTrade(trade); setOpen(false); }}
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#9CA3AF]" /> Reload
            </button>
            {hasOpenOrder && (
              <button
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#d4d4d8] rounded-[5px] hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                onClick={() => { onCancelOrder(trade); setOpen(false); }}
              >
                <Ban className="w-3.5 h-3.5 text-[#9CA3AF]" /> Cancel open order
              </button>
            )}
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <button
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-[#ef4444] rounded-[5px] hover:bg-[#ef4444]/10 transition-colors text-left"
              onClick={() => { onDeleteTrade(trade); setOpen(false); }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete trade
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

  return { sorted, currentSort: sortKey, currentDir: sortDir, onSort };
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
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [visibleRows, setVisibleRows] = useState(50);

  // Reset visible rows when tab changes
  useEffect(() => { setVisibleRows(50); }, [activeTab]);

  const toggleFilter = useCallback((column: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      const current = new Set(next[column] ?? []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      next[column] = current;
      return next;
    });
  }, []);

  // Filter helper
  function applyFilters<T>(data: T[], filterableColumns: Array<{ key: string; accessor: (item: T) => string }>): T[] {
    let result = data;
    for (const col of filterableColumns) {
      const active = columnFilters[col.key];
      if (active && active.size > 0) {
        result = result.filter((item) => active.has(col.accessor(item)));
      }
    }
    return result;
  }

  // Get unique values for filter dropdowns
  function getUniqueValues<T>(data: T[], accessor: (item: T) => string): string[] {
    return Array.from(new Set(data.map(accessor))).sort();
  }

  // Filtered data before sorting
  const filteredOpenTrades = useMemo(() => applyFilters(openTrades, [
    { key: "open_pair", accessor: (t) => t.pair },
    { key: "open_bot", accessor: (t) => t._bot_name ?? `Bot ${t._bot_id}` },
    { key: "open_side", accessor: (t) => t.is_short ? "SHORT" : "LONG" },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [openTrades, columnFilters]);

  const filteredClosedTrades = useMemo(() => applyFilters(closedTrades, [
    { key: "closed_pair", accessor: (t) => t.pair },
    { key: "closed_bot", accessor: (t) => t._bot_name ?? `Bot ${t._bot_id}` },
    { key: "closed_side", accessor: (t) => t.is_short ? "SHORT" : "LONG" },
    { key: "closed_exit", accessor: (t) => t.exit_reason ?? "" },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [closedTrades, columnFilters]);

  const lockMap = useMemo(() => {
    const m = new Map<string, { reason: string; lock_end_time: string }>();
    if (locksData) {
      for (const lock of locksData.locks) {
        if (lock.active) m.set(lock.pair, { reason: lock.reason, lock_end_time: lock.lock_end_time });
      }
    }
    return m;
  }, [locksData]);

  // Whitelist derived data for sorting
  const whitelistRows = useMemo(() => {
    if (!whitelistData) return [];
    return whitelistData.whitelist.map((pair) => {
      const lock = lockMap.get(pair);
      const openCount = openTrades.filter((t) => t.pair === pair).length;
      const assignedBots = Array.from(new Set(openTrades.filter((t) => t.pair === pair).map((t) => t._bot_name ?? `Bot ${t._bot_id}`))).join(", ");
      const pairTrades = openTrades.filter((t) => t.pair === pair);
      const latestPrice = pairTrades.length > 0 ? pairTrades[0].current_rate : null;
      return {
        pair,
        status: lock ? "LOCKED" : "ACTIVE",
        assignedBots: assignedBots || "",
        price: latestPrice ?? 0,
        openCount,
        lockReason: lock?.reason ?? "",
        lock,
      };
    });
  }, [whitelistData, lockMap, openTrades]);

  const openSort = useSortable(filteredOpenTrades, "open_date");
  const closedSort = useSortable(filteredClosedTrades, "close_date");
  const perfSort = useSortable(perfData, "profit_abs");
  const entrySort = useSortable(entryData, "entries");
  const exitSort = useSortable(exitData, "exits");
  const whitelistSort = useSortable(whitelistRows, "pair");

  const exportCSV = useCallback(() => {
    let csv = "";
    if (activeTab === "open") {
      csv = "Date,Pair,Bot,Side,Size,Entry,Mark Price,Profit %,Value,Fee,Age\n";
      for (const t of openTrades) {
        const pct = t.current_profit != null ? (t.current_profit * 100).toFixed(2) : "";
        const fee = ((t.fee_open + t.fee_close) * t.stake_amount).toFixed(2);
        csv += `${t.open_date},${t.pair},${t._bot_name ?? ""},${t.is_short ? "SHORT" : "LONG"},${t.stake_amount},${t.open_rate},${t.current_rate},${pct},${t.current_profit_abs ?? ""},${fee},${fmtDuration(t.open_date)}\n`;
      }
    } else if (activeTab === "closed") {
      csv = "Date,Pair,Bot,Side,Entry,Exit,Profit %,Value,Fee,Duration,Exit Reason\n";
      for (const t of closedTrades) {
        const pct = t.close_profit != null ? (t.close_profit * 100).toFixed(2) : "";
        const fee = ((t.fee_open + t.fee_close) * t.stake_amount).toFixed(2);
        csv += `${t.close_date ?? ""},${t.pair},${t._bot_name ?? ""},${t.is_short ? "SHORT" : "LONG"},${t.open_rate},${t.close_rate ?? ""},${pct},${t.close_profit_abs ?? ""},${fee},${fmtDuration(t.open_date, t.close_date)},${t.exit_reason ?? ""}\n`;
      }
    } else if (activeTab === "performance") {
      csv = "Pair,Trades,Profit %,Profit Abs\n";
      for (const p of perfData) csv += `${p.pair},${p.trades},${(p.profit_ratio * 100).toFixed(2)},${p.profit_abs}\n`;
    } else if (activeTab === "entries") {
      csv = "Tag,Trades,Wins,Losses,Win Rate,Avg Profit,Total P&L\n";
      for (const e of entryData) csv += `${e.enter_tag},${e.entries},${e.wins},${e.losses},${(e.winrate * 100).toFixed(1)},${e.avg_profit},${e.profit_abs}\n`;
    } else if (activeTab === "exits") {
      csv = "Reason,Exits,Wins,Losses,Win Rate,Avg Profit,Total P&L\n";
      for (const e of exitData) csv += `${e.exit_reason},${e.exits},${e.wins},${e.losses},${(e.winrate * 100).toFixed(1)},${e.avg_profit},${e.profit_abs}\n`;
    } else if (activeTab === "whitelist") {
      csv = "Pair,Status,Open Pos\n";
      if (whitelistData) for (const p of whitelistData.whitelist) csv += `${p},${lockMap.has(p) ? "LOCKED" : "ACTIVE"},${openTrades.filter((t) => t.pair === p).length}\n`;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTab, openTrades, closedTrades, perfData, entryData, exitData, whitelistData, lockMap]);

  const tabs: Array<{ key: TradeTab; label: string; count?: number }> = [
    { key: "open", label: "Open Trades", count: openTrades.length },
    { key: "closed", label: "Closed", count: closedTrades.length },
    { key: "whitelist", label: "Whitelist Matrix" },
    { key: "performance", label: "Performance" },
    { key: "entries", label: "Entry Tags" },
    { key: "exits", label: "Exit Reasons" },
  ];

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
        <div className="ml-auto mr-5 flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-2 py-1 rounded text-[10px] text-[#9CA3AF] hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1 opacity-50 hover:opacity-100"
            title="Export table data as CSV"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </div>
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
            {activeTab === "open" && (() => {
              const rowsToShow = openSort.sorted.slice(0, visibleRows);
              const remaining = openSort.sorted.length - visibleRows;
              return (
              <>
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Date & Time" sortKey="open_date" {...openSort} />
                    <th className="px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] text-left" onClick={() => openSort.onSort("pair")}>
                      Pair<span className="ml-1 text-[10px] opacity-25">{openSort.currentSort === "pair" ? (openSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="open_pair" values={getUniqueValues(openTrades, (t) => t.pair)} activeFilters={columnFilters["open_pair"]} onToggle={toggleFilter} />
                    </th>
                    <th className="px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] text-left" onClick={() => openSort.onSort("_bot_name")}>
                      Bot Logic<span className="ml-1 text-[10px] opacity-25">{openSort.currentSort === "_bot_name" ? (openSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="open_bot" values={getUniqueValues(openTrades, (t) => t._bot_name ?? `Bot ${t._bot_id}`)} activeFilters={columnFilters["open_bot"]} onToggle={toggleFilter} />
                    </th>
                    <th className="px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] text-center" onClick={() => openSort.onSort("is_short")}>
                      Side<span className="ml-1 text-[10px] opacity-25">{openSort.currentSort === "is_short" ? (openSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="open_side" values={["LONG", "SHORT"]} activeFilters={columnFilters["open_side"]} onToggle={toggleFilter} />
                    </th>
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
                  {rowsToShow.length === 0 ? (
                    <tr><td colSpan={12} className="px-5 py-8 text-center text-[#9CA3AF]">No open trades</td></tr>
                  ) : (
                    rowsToShow.map((trade, idx) => {
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
              {remaining > 0 && (
                <button
                  onClick={() => setVisibleRows((v) => v + 50)}
                  className="w-full py-2 text-[11px] text-[#9CA3AF] font-mono border border-white/[0.10] rounded hover:bg-white/5 transition-colors mt-2"
                >
                  Load More ({remaining} remaining)
                </button>
              )}
              </>
              );
            })()}

            {/* CLOSED TRADES */}
            {activeTab === "closed" && (() => {
              const closedRowsToShow = closedSort.sorted.slice(0, visibleRows);
              const closedRemaining = closedSort.sorted.length - visibleRows;
              return (
              <>
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Date" sortKey="close_date" {...closedSort} />
                    <th className="px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] text-left" onClick={() => closedSort.onSort("pair")}>
                      Pair<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "pair" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_pair" values={getUniqueValues(closedTrades, (t) => t.pair)} activeFilters={columnFilters["closed_pair"]} onToggle={toggleFilter} />
                    </th>
                    <th className="px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] text-left" onClick={() => closedSort.onSort("_bot_name")}>
                      Bot<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "_bot_name" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_bot" values={getUniqueValues(closedTrades, (t) => t._bot_name ?? `Bot ${t._bot_id}`)} activeFilters={columnFilters["closed_bot"]} onToggle={toggleFilter} />
                    </th>
                    <th className="px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] text-center" onClick={() => closedSort.onSort("is_short")}>
                      Side<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "is_short" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_side" values={["LONG", "SHORT"]} activeFilters={columnFilters["closed_side"]} onToggle={toggleFilter} />
                    </th>
                    <SortHeader label="Entry" sortKey="open_rate" {...closedSort} align="right" />
                    <SortHeader label="Exit" sortKey="close_rate" {...closedSort} align="right" />
                    <SortHeader label="Profit %" sortKey="close_profit" {...closedSort} align="right" highlight />
                    <SortHeader label="Value" sortKey="close_profit_abs" {...closedSort} align="right" highlight />
                    <th className="px-5 py-3.5 font-medium text-right font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Fee</th>
                    <SortHeader label="Duration" sortKey="close_date" {...closedSort} />
                    <th className="px-5 py-3.5 font-medium cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] text-left" onClick={() => closedSort.onSort("exit_reason")}>
                      Exit Reason<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "exit_reason" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_exit" values={getUniqueValues(closedTrades, (t) => t.exit_reason ?? "")} activeFilters={columnFilters["closed_exit"]} onToggle={toggleFilter} />
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {closedRowsToShow.length === 0 ? (
                    <tr><td colSpan={11} className="px-5 py-8 text-center text-[#9CA3AF]">No closed trades</td></tr>
                  ) : (
                    closedRowsToShow.map((trade, idx) => {
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
              {closedRemaining > 0 && (
                <button
                  onClick={() => setVisibleRows((v) => v + 50)}
                  className="w-full py-2 text-[11px] text-[#9CA3AF] font-mono border border-white/[0.10] rounded hover:bg-white/5 transition-colors mt-2"
                >
                  Load More ({closedRemaining} remaining)
                </button>
              )}
              </>
              );
            })()}

            {/* WHITELIST MATRIX */}
            {activeTab === "whitelist" && (
              <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
                <thead className="sticky top-0 bg-[#0C0C0C] border-b border-white/[0.10] font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF] z-10 shadow-lg">
                  <tr>
                    <SortHeader label="Pair" sortKey="pair" {...whitelistSort} />
                    <SortHeader label="Status" sortKey="status" {...whitelistSort} align="center" />
                    <SortHeader label="Assigned Bots" sortKey="assignedBots" {...whitelistSort} />
                    <SortHeader label="Price" sortKey="price" {...whitelistSort} align="right" />
                    <SortHeader label="24h Change" sortKey="change24h" {...whitelistSort} align="right" />
                    <SortHeader label="Spread" sortKey="spread" {...whitelistSort} align="right" />
                    <SortHeader label="24h Vol" sortKey="vol24h" {...whitelistSort} align="right" />
                    <SortHeader label="Volatility" sortKey="volatility" {...whitelistSort} align="right" />
                    <SortHeader label="Open Pos" sortKey="openCount" {...whitelistSort} align="center" />
                    <SortHeader label="Lock" sortKey="lockReason" {...whitelistSort} align="center" />
                    <th className="px-5 py-3.5 font-medium border-l border-white/[0.08] text-center font-mono text-[11px] uppercase tracking-widest text-[#9CA3AF]">Controls</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {whitelistSort.sorted.length === 0 ? (
                    <tr><td colSpan={11} className="px-5 py-8 text-center text-[#9CA3AF]">No whitelist data</td></tr>
                  ) : (
                    whitelistSort.sorted.map((row, idx) => {
                      return (
                        <tr key={row.pair} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 font-bold text-white">{row.pair}</td>
                          <td className="px-5 py-3 text-center">
                            {row.lock ? (
                              <span className="bg-[#ef4444]/12 text-[#ef4444] border border-[#ef4444]/25 px-2 py-0.5 rounded text-[10px] font-bold">LOCKED</span>
                            ) : (
                              <span className="bg-[#22c55e]/12 text-[#22c55e] border border-[#22c55e]/25 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVE</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-[#9CA3AF] font-sans text-[11px]">{row.assignedBots || "\u2014"}</td>
                          <td className="px-5 py-3 text-right">{row.price > 0 ? fmt(row.price, row.price < 1 ? 4 : 2) : "\u2014"}</td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{"\u2014"}</td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{"\u2014"}</td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{"\u2014"}</td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{"\u2014"}</td>
                          <td className="px-5 py-3 text-center font-bold">{row.openCount}</td>
                          <td className="px-5 py-3 text-center">
                            {row.lock ? (
                              <span className="text-[#ef4444] text-[10px] font-bold">{row.lock.reason}</span>
                            ) : "\u2014"}
                          </td>
                          <td className="px-5 py-3 border-l border-white/[0.08] text-center">
                            {row.lock ? (
                              <button className="bg-black border border-white/[0.10] hover:bg-[#22c55e]/20 text-[#9CA3AF] hover:text-[#22c55e] px-2 py-0.5 rounded text-[10px] font-bold transition-colors">UNLOCK</button>
                            ) : (
                              <button className="bg-black border border-white/[0.10] hover:bg-[#ef4444]/20 text-[#9CA3AF] hover:text-[#ef4444] px-2 py-0.5 rounded text-[10px] font-bold transition-colors">LOCK</button>
                            )}
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
                    <SortHeader label="Wins" sortKey="_wins" {...perfSort} align="right" />
                    <SortHeader label="Losses" sortKey="_losses" {...perfSort} align="right" />
                    <SortHeader label="Win Rate" sortKey="_winrate" {...perfSort} align="right" />
                    <SortHeader label="Profit %" sortKey="profit_ratio" {...perfSort} align="right" highlight />
                    <SortHeader label="Profit Abs" sortKey="profit_abs" {...perfSort} align="right" highlight />
                    <SortHeader label="Avg Profit" sortKey="_avg_profit" {...perfSort} align="right" />
                    <SortHeader label="Total Fees" sortKey="_total_fees" {...perfSort} align="right" />
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {perfSort.sorted.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-8 text-center text-[#9CA3AF]">No performance data</td></tr>
                  ) : (
                    perfSort.sorted.map((p, idx) => {
                      const isUp = p.profit_abs >= 0;
                      const color = isUp ? "text-[#22c55e]" : "text-[#ef4444]";
                      // Derive wins/losses from closed trades for this pair
                      const pairClosed = closedTrades.filter((t) => t.pair === p.pair);
                      const wins = pairClosed.filter((t) => (t.close_profit_abs ?? 0) >= 0).length;
                      const losses = pairClosed.filter((t) => (t.close_profit_abs ?? 0) < 0).length;
                      const winrate = pairClosed.length > 0 ? wins / pairClosed.length : 0;
                      const avgProfit = p.trades > 0 ? (p.profit_ratio * 100) / p.trades : 0;
                      const totalFees = pairClosed.reduce((acc, t) => acc + (t.fee_open + t.fee_close) * t.stake_amount, 0);
                      const wrColor = winrate >= 0.6 ? "text-[#22c55e]" : winrate < 0.45 ? "text-[#ef4444]" : "text-white";
                      return (
                        <tr key={p.pair} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 font-bold text-white">{p.pair}</td>
                          <td className="px-5 py-3 text-right">{p.trades}</td>
                          <td className="px-5 py-3 text-right text-[#22c55e]">{wins}</td>
                          <td className="px-5 py-3 text-right text-[#ef4444]">{losses}</td>
                          <td className={`px-5 py-3 text-right font-medium ${wrColor}`}>{fmt(winrate * 100, 1)}%</td>
                          <td className={`px-5 py-3 text-right font-bold ${isUp ? "bg-[#22c55e]/5" : "bg-[#ef4444]/5"} ${color}`}>
                            {p.profit_ratio >= 0 ? "+" : ""}{fmt(p.profit_ratio * 100, 1)}%
                          </td>
                          <td className={`px-5 py-3 text-right ${isUp ? "bg-[#22c55e]/5" : "bg-[#ef4444]/5"} ${color}`}>
                            {fmtMoney(p.profit_abs)}
                          </td>
                          <td className={`px-5 py-3 text-right ${isUp ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {avgProfit >= 0 ? "+" : ""}{fmt(avgProfit, 2)}%
                          </td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{fmtMoney(totalFees)}</td>
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
                    <SortHeader label="Avg Duration" sortKey="_avg_duration" {...entrySort} align="right" />
                    <SortHeader label="Best Pair" sortKey="_best_pair" {...entrySort} />
                    <SortHeader label="Expectancy" sortKey="_expectancy" {...entrySort} align="right" />
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {entrySort.sorted.length === 0 ? (
                    <tr><td colSpan={10} className="px-5 py-8 text-center text-[#9CA3AF]">No entry tag data</td></tr>
                  ) : (
                    entrySort.sorted.map((e, idx) => {
                      const wrColor = e.winrate >= 0.6 ? "text-[#22c55e]" : e.winrate < 0.45 ? "text-[#ef4444]" : "text-white";
                      const pnlColor = e.profit_abs >= 0 ? "text-[#22c55e]" : "text-[#ef4444]";
                      // Derive avg duration & best pair from closed trades with this enter_tag
                      const tagTrades = closedTrades.filter((t) => t.enter_tag === e.enter_tag);
                      const avgDurationMs = tagTrades.length > 0
                        ? tagTrades.reduce((acc, t) => {
                            const end = t.close_date ? new Date(t.close_date).getTime() : Date.now();
                            return acc + (end - new Date(t.open_date).getTime());
                          }, 0) / tagTrades.length
                        : 0;
                      const avgDurStr = tagTrades.length > 0 ? fmtDuration(new Date(Date.now() - avgDurationMs).toISOString()) : "\u2014";
                      // Best pair = pair with highest total profit for this tag
                      const pairProfits = new Map<string, number>();
                      for (const t of tagTrades) {
                        const prev = pairProfits.get(t.pair) ?? 0;
                        pairProfits.set(t.pair, prev + (t.close_profit_abs ?? 0));
                      }
                      let bestPair = "\u2014";
                      let bestProfit = -Infinity;
                      for (const [pair, profit] of Array.from(pairProfits.entries())) {
                        if (profit > bestProfit) { bestPair = pair; bestProfit = profit; }
                      }
                      // Expectancy = profit_abs / entries (avg profit per trade in $)
                      const expectancy = e.entries > 0 ? e.profit_abs / e.entries : 0;
                      const expColor = expectancy >= 0 ? "text-[#22c55e]" : "text-[#ef4444]";
                      return (
                        <tr key={e.enter_tag} className={`hover:bg-white/[0.04] ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 text-white font-medium">{e.enter_tag}</td>
                          <td className="px-5 py-3 text-right">{e.entries}</td>
                          <td className="px-5 py-3 text-right text-[#22c55e]">{e.wins}</td>
                          <td className="px-5 py-3 text-right text-[#ef4444]">{e.losses}</td>
                          <td className={`px-5 py-3 text-right font-medium ${wrColor}`}>{fmt(e.winrate * 100, 1)}%</td>
                          <td className={`px-5 py-3 text-right ${pnlColor}`}>{e.avg_profit >= 0 ? "+" : ""}{fmt(e.avg_profit, 2)}%</td>
                          <td className={`px-5 py-3 text-right font-bold ${pnlColor}`}>{fmtMoney(e.profit_abs)}</td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{avgDurStr}</td>
                          <td className="px-5 py-3 text-white/70">{bestPair}</td>
                          <td className={`px-5 py-3 text-right font-bold ${expColor}`}>{fmtMoney(expectancy)}</td>
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
                    <SortHeader label="Avg Duration" sortKey="_avg_duration" {...exitSort} align="right" />
                    <SortHeader label="Best Pair" sortKey="_best_pair" {...exitSort} />
                    <SortHeader label="Expectancy" sortKey="_expectancy" {...exitSort} align="right" />
                  </tr>
                </thead>
                <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                  {exitSort.sorted.length === 0 ? (
                    <tr><td colSpan={10} className="px-5 py-8 text-center text-[#9CA3AF]">No exit reason data</td></tr>
                  ) : (
                    exitSort.sorted.map((e, idx) => {
                      const wrColor = e.winrate >= 0.6 ? "text-[#22c55e]" : e.winrate < 0.45 ? "text-[#ef4444]" : "text-white";
                      const pnlColor = e.profit_abs >= 0 ? "text-[#22c55e]" : "text-[#ef4444]";
                      // Derive avg duration & best pair from closed trades with this exit_reason
                      const reasonTrades = closedTrades.filter((t) => t.exit_reason === e.exit_reason);
                      const avgDurationMs = reasonTrades.length > 0
                        ? reasonTrades.reduce((acc, t) => {
                            const end = t.close_date ? new Date(t.close_date).getTime() : Date.now();
                            return acc + (end - new Date(t.open_date).getTime());
                          }, 0) / reasonTrades.length
                        : 0;
                      const avgDurStr = reasonTrades.length > 0 ? fmtDuration(new Date(Date.now() - avgDurationMs).toISOString()) : "\u2014";
                      // Best pair = pair with highest total profit for this exit reason
                      const pairProfits = new Map<string, number>();
                      for (const t of reasonTrades) {
                        const prev = pairProfits.get(t.pair) ?? 0;
                        pairProfits.set(t.pair, prev + (t.close_profit_abs ?? 0));
                      }
                      let bestPair = "\u2014";
                      let bestProfit = -Infinity;
                      for (const [pair, profit] of Array.from(pairProfits.entries())) {
                        if (profit > bestProfit) { bestPair = pair; bestProfit = profit; }
                      }
                      // Expectancy = profit_abs / exits (avg profit per trade in $)
                      const expectancy = e.exits > 0 ? e.profit_abs / e.exits : 0;
                      const expColor = expectancy >= 0 ? "text-[#22c55e]" : "text-[#ef4444]";
                      return (
                        <tr key={e.exit_reason} className={`hover:bg-white/[0.04] ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className="px-5 py-3 text-white font-medium">{e.exit_reason}</td>
                          <td className="px-5 py-3 text-right">{e.exits}</td>
                          <td className="px-5 py-3 text-right text-[#22c55e]">{e.wins}</td>
                          <td className="px-5 py-3 text-right text-[#ef4444]">{e.losses}</td>
                          <td className={`px-5 py-3 text-right font-medium ${wrColor}`}>{fmt(e.winrate * 100, 1)}%</td>
                          <td className={`px-5 py-3 text-right ${pnlColor}`}>{e.avg_profit >= 0 ? "+" : ""}{fmt(e.avg_profit, 2)}%</td>
                          <td className={`px-5 py-3 text-right font-bold ${pnlColor}`}>{fmtMoney(e.profit_abs)}</td>
                          <td className="px-5 py-3 text-right text-[#9CA3AF]">{avgDurStr}</td>
                          <td className="px-5 py-3 text-white/70">{bestPair}</td>
                          <td className={`px-5 py-3 text-right font-bold ${expColor}`}>{fmtMoney(expectancy)}</td>
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
