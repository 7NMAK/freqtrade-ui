"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Filter, Download, LogOut, Zap, Scissors, PlusCircle, RefreshCw, Trash2, Ban, Play, Square, XSquare, ShieldAlert, Pause, PlusSquare } from "lucide-react";
import { fmt, fmtMoney } from "@/lib/format";
import type { FTTrade, FTPerformance, FTEntry, FTExit, FTWhitelist, FTLocksResponse, Bot, FTProfit } from "@/types";

type TradeTab = "fleet" | "open" | "closed" | "performance" | "entries" | "exits" | "whitelist" | "blacklist";
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
  onForceEnter: (trade: FTTrade) => void;
  onReloadTrade: (trade: FTTrade) => void;
  onDeleteTrade: (trade: FTTrade) => void;
  onCancelOrder: (trade: FTTrade) => void;
  exitingTradeId: string | null;
  pairMarketData?: Record<string, { change24h: number; volume: number; volatility: number }>;
  onLockPair?: (pair: string, botId: number) => void;
  onUnlockPair?: (lockId: number, botId: number) => void;
  spreadData?: Record<string, { spreadPct: number }>;
  whitelistBotMap?: Map<string, number>;
  // Fleet props
  bots?: Bot[];
  botProfits?: Record<number, Partial<FTProfit>>;
  botBalances?: Record<string, number>; // bot name -> total balance
  sparklines?: Record<number, number[]>;
  onBotClick?: (botId: number) => void;
  onStart?: (botId: number) => void;
  onStop?: (botId: number) => void;
  onPause?: (botId: number) => void;
  onReload?: (botId: number) => void;
  onForceExitAll?: (botId: number) => void;
  onStopBuy?: (botId: number) => void;
  onSoftKill?: (botId: number) => void;
  onHardKill?: (botId: number) => void;
  // Blacklist props
  blacklistData?: { blacklist: string[]; blacklist_expanded: string[] } | null;
  onAddBlacklist?: (pair: string) => void;
  onDeleteBlacklist?: (pair: string) => void;
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

/* ── Shared classes ──────────────────────────────────────────────── */
const TH_BASE = "px-5 py-3.5 font-medium font-mono text-[11px] uppercase tracking-widest text-muted";
const TH_SORT = `${TH_BASE} cursor-pointer select-none whitespace-nowrap transition-colors hover:text-white hover:bg-white/[0.04]`;
const THEAD  = "sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg";
const TBODY  = "font-mono text-white/85 divide-y divide-white/[0.05]";
const TD     = "px-5 py-3";
const TABLE  = "w-full text-left border-collapse whitespace-nowrap text-[13px]";

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
      className={`${TH_SORT} ${alignClass} ${highlight ? "bg-black/20" : ""} ${active ? "text-white bg-white/[0.04]" : ""}`}
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
        className={`inline-flex items-center p-0.5 rounded transition-colors ${isActive ? "text-[#22d3ee]" : "text-muted/50 hover:text-muted"}`}
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

function TradeActions({
  trade,
  onForceExit,
  onForceEnter,
  onReloadTrade,
  onDeleteTrade,
  onCancelOrder,
  exiting,
}: {
  trade: FTTrade;
  onForceExit: (trade: FTTrade, ordertype: string) => void;
  onForceEnter: (trade: FTTrade) => void;
  onReloadTrade: (trade: FTTrade) => void;
  onDeleteTrade: (trade: FTTrade) => void;
  onCancelOrder: (trade: FTTrade) => void;
  exiting: boolean;
}) {
  const hasOpenOrder = trade.orders?.some((o) => o.status === "open") ?? false;
  const btn = "p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button title="Force Exit (Market)" disabled={exiting} onClick={() => onForceExit(trade, "market")}
        className={`${btn} text-down hover:bg-down/15`}>
        <Zap className="w-3.5 h-3.5" />
      </button>
      <button title="Force Exit (Limit)" disabled={exiting} onClick={() => onForceExit(trade, "limit")}
        className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}>
        <LogOut className="w-3.5 h-3.5" />
      </button>
      <button title="Force Exit (Partial)" disabled={exiting} onClick={() => onForceExit(trade, "partial")}
        className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}>
        <Scissors className="w-3.5 h-3.5" />
      </button>
      <button title="Increase Position" disabled={exiting} onClick={() => onForceEnter(trade)}
        className={`${btn} text-muted hover:text-up hover:bg-up/10`}>
        <PlusCircle className="w-3.5 h-3.5" />
      </button>
      <button title="Reload Trade" disabled={exiting} onClick={() => onReloadTrade(trade)}
        className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}>
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
      {hasOpenOrder && (
        <button title="Cancel Open Order" disabled={exiting} onClick={() => onCancelOrder(trade)}
          className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}>
          <Ban className="w-3.5 h-3.5" />
        </button>
      )}
      <button title="Delete Trade" disabled={exiting} onClick={() => onDeleteTrade(trade)}
        className={`${btn} text-down/50 hover:text-down hover:bg-down/10`}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
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

// ── Fleet Cards ───────────────────────────────────────────────────────────────

function MiniSparkline7({ data }: { data: number[] }) {
  const bars = data.length >= 7 ? data.slice(-7) : [...Array(7 - data.length).fill(0), ...data];
  const max = Math.max(...bars.map(Math.abs), 0.01);
  return (
    <div className="flex items-end gap-[2px] h-5 w-14 mx-auto">
      {bars.map((v, i) => {
        const pct = Math.max(8, (Math.abs(v) / max) * 100);
        if (v === 0) return <div key={i} className="flex-1 rounded-sm bg-white/10" style={{ height: "8%" }} />;
        return <div key={i} className={`flex-1 rounded-sm ${v > 0 ? "bg-up/70" : "bg-down/60"}`} style={{ height: `${pct}%` }} />;
      })}
    </div>
  );
}

type FleetSortKey = "name" | "pnl" | "pnlPct" | "openPnl" | "winRate" | "trades" | "closed" | "open" | "balance" | "maxDd" | "avgDur";

interface FleetCardsProps {
  bots: Bot[];
  botProfits: Record<number, Partial<FTProfit>>;
  botBalances: Record<string, number>;
  sparklines: Record<number, number[]>;
  openTrades: FTTrade[];
  onBotClick?: (botId: number) => void;
  onStart?: (botId: number) => void;
  onStop?: (botId: number) => void;
  onPause?: (botId: number) => void;
  onReload?: (botId: number) => void;
  onForceExitAll?: (botId: number) => void;
  onStopBuy?: (botId: number) => void;
  onSoftKill?: (botId: number) => void;
  onHardKill?: (botId: number) => void;
}

function FleetCards({
  bots,
  botProfits,
  botBalances,
  sparklines,
  openTrades,
  onBotClick,
  onStart,
  onStop,
  onPause,
  onReload,
  onForceExitAll,
  onStopBuy,
  onSoftKill,
  onHardKill,
}: FleetCardsProps) {
  const [sortKey, setSortKey] = useState<FleetSortKey>("pnl");
  const [sortAsc, setSortAsc] = useState(false);

  const openPnlByBot = useMemo(() => {
    const m: Record<number, number> = {};
    for (const t of openTrades) {
      const id = (t as unknown as Record<string, unknown>)._bot_id as number | undefined;
      if (id != null) m[id] = (m[id] ?? 0) + (t.current_profit_abs ?? 0);
    }
    return m;
  }, [openTrades]);

  const openCountByBot = useMemo(() => {
    const m: Record<number, number> = {};
    for (const t of openTrades) {
      const id = (t as unknown as Record<string, unknown>)._bot_id as number | undefined;
      if (id != null) m[id] = (m[id] ?? 0) + 1;
    }
    return m;
  }, [openTrades]);

  type BotRow = {
    bot: Bot; pnl: number | null; pnlPct: number | null; openPnl: number;
    winRate: number | null; trades: number; closedCount: number; openCount: number;
    maxOT: number | null; balance: number | null; maxDd: number | null;
    avgDurSecs: number | null; avgDurStr: string;
  };

  const rows: BotRow[] = useMemo(() => bots.map((bot) => {
    const p = botProfits[bot.id];
    const pnl = p?.profit_closed_coin ?? null;
    const pnlPct = p?.profit_closed_percent ?? null;
    const openPnl = openPnlByBot[bot.id] ?? 0;
    const wins = p?.winning_trades ?? 0;
    const losses = p?.losing_trades ?? 0;
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : null;
    const trades = p?.trade_count ?? 0;
    const closedCount = p?.closed_trade_count ?? 0;
    const openCount = openCountByBot[bot.id] ?? 0;
    const maxOT = bot.max_open_trades ?? null;
    const balance = botBalances[bot.name] ?? null;
    const maxDdRaw = (p as Record<string, unknown>)?.max_drawdown as number | undefined;
    const maxDd = maxDdRaw != null ? maxDdRaw * 100 : null;
    const avgDur = p?.avg_duration;
    let avgDurSecs: number | null = null;
    let avgDurStr = "\u2014";
    if (typeof avgDur === "number" && avgDur > 0) {
      avgDurSecs = avgDur;
      const d = Math.floor(avgDur / 86400);
      const h = Math.floor((avgDur % 86400) / 3600);
      const m2 = Math.floor((avgDur % 3600) / 60);
      const s = Math.floor(avgDur % 60);
      if (d > 0) avgDurStr = `${d} days, ${h.toString().padStart(2,"0")}:${m2.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
      else avgDurStr = `${h.toString().padStart(2,"0")}:${m2.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
    } else if (typeof avgDur === "string" && avgDur) {
      avgDurStr = avgDur;
    }
    return { bot, pnl, pnlPct, openPnl, winRate, trades, closedCount, openCount, maxOT, balance, maxDd, avgDurSecs, avgDurStr };
  }), [bots, botProfits, botBalances, openPnlByBot, openCountByBot]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.bot.name.localeCompare(b.bot.name);
    else if (sortKey === "pnl") cmp = (a.pnl ?? -Infinity) - (b.pnl ?? -Infinity);
    else if (sortKey === "pnlPct") cmp = (a.pnlPct ?? -Infinity) - (b.pnlPct ?? -Infinity);
    else if (sortKey === "openPnl") cmp = a.openPnl - b.openPnl;
    else if (sortKey === "winRate") cmp = (a.winRate ?? -1) - (b.winRate ?? -1);
    else if (sortKey === "trades") cmp = a.trades - b.trades;
    else if (sortKey === "closed") cmp = a.closedCount - b.closedCount;
    else if (sortKey === "open") cmp = a.openCount - b.openCount;
    else if (sortKey === "balance") cmp = (a.balance ?? -Infinity) - (b.balance ?? -Infinity);
    else if (sortKey === "maxDd") cmp = (a.maxDd ?? 0) - (b.maxDd ?? 0);
    else if (sortKey === "avgDur") cmp = (a.avgDurSecs ?? 0) - (b.avgDurSecs ?? 0);
    return sortAsc ? cmp : -cmp;
  }), [rows, sortKey, sortAsc]);

  const handleSort = (key: FleetSortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: FleetSortKey) => (
    <span className="ml-0.5 text-[9px] opacity-30">
      {sortKey === key ? (sortAsc ? "\u2191" : "\u2193") : "\u21C5"}
    </span>
  );

  const colH = (key: FleetSortKey, label: string, cls = "") => (
    <th
      className={`${TH_SORT} ${cls} ${sortKey === key ? "text-white bg-white/[0.04]" : ""}`}
      onClick={() => handleSort(key)}
    >
      {label}{sortIcon(key)}
    </th>
  );

  if (bots.length === 0) return (
    <div className="flex items-center justify-center h-48 text-muted text-sm">No bots registered.</div>
  );

  return (
    <table className={TABLE}>
      <thead className={THEAD}>
        <tr>
          <th className={`${TH_BASE} text-left w-[90px]`}>STATUS</th>
          {colH("name", "BOT \u21C5", "text-left")}
          <th className={`${TH_BASE} text-left`}>MODE</th>
          <th className={`${TH_BASE} text-center`}>P&amp;L / DAY</th>
          {colH("pnl", "CLOSED P&L \u21C5", "text-right")}
          {colH("pnlPct", "% \u21C5", "text-right")}
          {colH("openPnl", "OPEN P&L \u21C5", "text-right")}
          {colH("winRate", "WIN% \u21C5", "text-right")}
          {colH("trades", "TRADES \u21C5", "text-right")}
          {colH("closed", "CLOSED \u21C5", "text-right")}
          {colH("open", "OPEN \u21C5", "text-right")}
          {colH("balance", "BALANCE \u21C5", "text-right")}
          {colH("maxDd", "MAX DD \u21C5", "text-right")}
          {colH("avgDur", "AVG DUR \u21C5", "text-left")}
          <th className={`${TH_BASE} text-right border-l border-white/[0.06]`}>ACTIONS</th>
        </tr>
      </thead>
      <tbody className={TBODY}>
        {sorted.map((row, idx) => {
          const { bot, pnl, pnlPct, openPnl, winRate, trades, closedCount, openCount, maxOT, balance, maxDd, avgDurStr } = row;
          const isRunning = bot.status === "running";
          const isDraining = bot.status === "draining";
          const isStopped = !isRunning && !isDraining;

          return (
            <tr
              key={bot.id}
              className={`hover:bg-white/[0.04] transition-colors cursor-pointer group ${idx % 2 === 1 ? "bg-white/[0.012]" : ""}`}
              onClick={() => onBotClick?.(bot.id)}
            >
              <td className={TD}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? "bg-up shadow-[0_0_4px_#22c55e]" : isDraining ? "bg-yellow-400" : "bg-white/20"}`} />
                  <span className={`text-[11px] font-bold tracking-wide ${isRunning ? "text-up" : isDraining ? "text-yellow-400" : "text-white/30"}`}>
                    {isRunning ? "RUNNING" : isDraining ? "DRAINING" : "STOPPED"}
                  </span>
                </div>
              </td>
              <td className={`${TD} font-bold text-white max-w-[180px] truncate`} title={bot.name}>{bot.name}</td>
              <td className={TD}>
                <div className="flex items-center gap-1">
                  {isStopped
                    ? <span className="text-[9px] border border-down/30 px-1 py-[1px] rounded text-down/70 font-bold">STOPPED</span>
                    : isDraining
                      ? <span className="text-[9px] border border-yellow-500/30 px-1 py-[1px] rounded text-yellow-400 font-bold">DRAINING</span>
                      : bot.is_dry_run
                        ? <span className="text-[9px] border border-yellow-500/20 px-1 py-[1px] rounded text-yellow-400 font-bold bg-yellow-500/10">PAPER</span>
                        : <span className="text-[9px] border border-white/20 px-1 py-[1px] rounded text-white/60 font-bold">LIVE</span>
                  }
                  {bot.trading_mode === "futures"
                    ? <span className="text-[9px] border border-blue-500/40 px-1 py-[1px] rounded text-blue-400 font-bold bg-blue-500/10">FUT</span>
                    : <span className="text-[9px] border border-white/10 px-1 py-[1px] rounded text-white/25 font-bold bg-white/5">SPOT</span>
                  }
                </div>
              </td>
              <td className={TD}>
                <MiniSparkline7 data={sparklines[bot.id] ?? []} />
              </td>
              <td className={`${TD} text-right font-bold font-mono ${pnl == null ? "text-muted" : pnl >= 0 ? "text-up" : "text-down"}`}>
                {pnl != null ? `${pnl >= 0 ? "+" : ""}${fmt(pnl, 4)}` : "\u2014"}
              </td>
              <td className={`${TD} text-right font-bold font-mono ${pnlPct == null ? "text-muted" : pnlPct >= 0 ? "text-up" : "text-down"}`}>
                {pnlPct != null ? `${pnlPct >= 0 ? "+" : ""}${fmt(pnlPct, 2)}%` : "\u2014"}
              </td>
              <td className={`${TD} text-right font-mono ${openPnl === 0 ? "text-muted" : openPnl > 0 ? "text-up" : "text-down"}`}>
                {openPnl !== 0 ? `${openPnl >= 0 ? "+" : ""}${fmt(openPnl, 4)}` : "+0.0000"}
              </td>
              <td className={`${TD} text-right font-mono ${winRate == null ? "text-muted" : winRate < 50 ? "text-down" : "text-white/80"}`}>
                {winRate != null ? `${fmt(winRate, 0)}%` : "\u2014"}
              </td>
              <td className={`${TD} text-right font-mono text-white/70`}>{trades}</td>
              <td className={`${TD} text-right font-mono text-white/70`}>{closedCount}</td>
              <td className={`${TD} text-right font-mono text-white/70`}>
                {openCount}{maxOT != null && <span className="text-muted text-[10px]">/{maxOT}</span>}
              </td>
              <td className={`${TD} text-right font-mono text-white/70`}>
                {balance != null ? fmt(balance, 2) : "\u2014"}
              </td>
              <td className={`${TD} text-right font-mono ${maxDd != null && maxDd > 0.01 ? "text-down" : "text-muted"}`}>
                {maxDd != null ? `-${fmt(maxDd, 1)}%` : "\u2014"}
              </td>
              <td className={`${TD} text-muted font-mono text-[12px]`}>{avgDurStr}</td>
              <td className={`${TD} border-l border-white/[0.06] text-right`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-[2px] opacity-30 group-hover:opacity-100 transition-opacity">
                  <button className="bot-ctrl ctrl-start" title="▶ Start" onClick={() => onStart?.(bot.id)}><Play className="w-2.5 h-2.5" /></button>
                  <button className="bot-ctrl ctrl-stop" title="■ Stop" onClick={() => onStop?.(bot.id)}><Square className="w-2.5 h-2.5" /></button>
                  <button className="bot-ctrl ctrl-pause" title="⏸ Pause" onClick={() => onPause?.(bot.id)}><Pause className="w-2.5 h-2.5" /></button>
                  <button className="bot-ctrl" title="↻ Reload Config" onClick={() => onReload?.(bot.id)}><RefreshCw className="w-2.5 h-2.5" /></button>
                  <button className="bot-ctrl ctrl-stop" title="✕ Force Exit All" onClick={() => onForceExitAll?.(bot.id)}><XSquare className="w-2.5 h-2.5" /></button>
                  <button className="bot-ctrl" title="⊞ Stopbuy" onClick={() => onStopBuy?.(bot.id)}><PlusSquare className="w-2.5 h-2.5" /></button>
                  <span className="w-px h-3 bg-white/15 mx-0.5 self-center" />
                  <button className="bot-ctrl" style={{ color: "#facc15" }} title="🛡 Soft Kill" onClick={() => onSoftKill?.(bot.id)}><ShieldAlert className="w-2.5 h-2.5" /></button>
                  <button className="bot-ctrl ctrl-stop" title="⚡ Hard Kill" onClick={() => onHardKill?.(bot.id)}><Zap className="w-2.5 h-2.5" /></button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
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
  onForceEnter,
  onReloadTrade,
  onDeleteTrade,
  onCancelOrder,
  exitingTradeId,
  pairMarketData,
  onLockPair,
  onUnlockPair,
  spreadData,
  whitelistBotMap,
  bots = [],
  botProfits = {},
  botBalances = {},
  sparklines = {},
  onBotClick,
  onStart,
  onStop,
  onPause,
  onReload,
  onForceExitAll,
  onStopBuy,
  onSoftKill,
  onHardKill,
  blacklistData,
  onAddBlacklist,
  onDeleteBlacklist,
}: TradeTableProps) {
  const [activeTab, setActiveTab] = useState<TradeTab>("fleet");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [visibleRows, setVisibleRows] = useState(50);
  const [blacklistInput, setBlacklistInput] = useState("");

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
    const m = new Map<string, { id: number; reason: string; lock_end_time: string }>();
    if (locksData) {
      for (const lock of locksData.locks) {
        if (lock.active) m.set(lock.pair, { id: lock.id, reason: lock.reason, lock_end_time: lock.lock_end_time });
      }
    }
    return m;
  }, [locksData]);

  // Whitelist derived data for sorting — includes market data for 24h change, spread, volume, volatility
  const whitelistRows = useMemo(() => {
    if (!whitelistData) return [];
    return whitelistData.whitelist.map((pair) => {
      const lock = lockMap.get(pair);
      const openCount = openTrades.filter((t) => t.pair === pair).length;
      const assignedBots = Array.from(new Set(openTrades.filter((t) => t.pair === pair).map((t) => t._bot_name ?? `Bot ${t._bot_id}`))).join(", ");
      const pairTrades = openTrades.filter((t) => t.pair === pair);
      const latestPrice = pairTrades.length > 0 ? pairTrades[0].current_rate : null;
      const market = pairMarketData?.[pair];
      const spread = spreadData?.[pair];
      return {
        pair,
        status: lock ? "LOCKED" : "ACTIVE",
        assignedBots: assignedBots || "",
        price: latestPrice ?? 0,
        change24h: market?.change24h ?? null,
        spread: spread?.spreadPct ?? null,
        vol24h: market?.volume ?? null,
        volatility: market?.volatility ?? null,
        openCount,
        lockReason: lock?.reason ?? "",
        lock,
      };
    });
  }, [whitelistData, lockMap, openTrades, pairMarketData, spreadData]);

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
      for (const p of perfData) csv += `${p.pair},${p.count ?? p.trades ?? 0},${(p.profit_ratio * 100).toFixed(2)},${p.profit_abs}\n`;
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

  const tradeBots = useMemo(() => bots.filter((b) => !b.is_utility && b.ft_mode !== "webserver"), [bots]);

  const tabs: Array<{ key: TradeTab; label: string; count?: number; title: string }> = [
    { key: "fleet", label: "Fleet", count: tradeBots.length, title: "Fleet management — all bots with controls" },
    { key: "open", label: "Open", count: openTrades.length, title: "Currently active trades" },
    { key: "closed", label: "Closed", count: closedTrades.length, title: "Completed trade history" },
    { key: "performance", label: "Performance", title: "Performance by trading pair" },
    { key: "entries", label: "Entry Tags", title: "Entry signal tag analysis" },
    { key: "exits", label: "Exit Reasons", title: "Exit reason analysis" },
    { key: "whitelist", label: "Active Pairs", title: "Pair monitoring and lock management" },
    { key: "blacklist", label: "Blacklist", count: blacklistData?.blacklist.length, title: "Blacklisted pairs (blocked from trading)" },
  ];

  return (
    <div className="flex-1 bg-surface l-bd rounded-md shadow-xl flex flex-col min-h-0 overflow-hidden">
      {/* Tab Bar */}
      <div className="h-12 l-b flex items-center bg-black/40 shrink-0 border-b-2 border-transparent overflow-x-auto whitespace-nowrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            title={tab.title}
            className={`h-full px-5 font-bold text-[12px] uppercase tracking-wide trade-tab-btn shrink-0 ${
              activeTab === tab.key
                ? "border-b-2 border-up text-white"
                : "text-muted hover:text-white transition-colors"
            }`}
          >
            {tab.label}{tab.count != null ? ` (${tab.count})` : ""}
          </button>
        ))}
        <div className="ml-auto mr-3 flex items-center gap-2 shrink-0">
          <button
            onClick={exportCSV}
            className="px-2 py-1 rounded text-[10px] text-muted hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1 opacity-50 hover:opacity-100"
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
          <div className="flex items-center justify-center h-full text-muted text-sm animate-pulse p-8">
            Loading trade data...
          </div>
        ) : (
          <>
            {/* FLEET MANAGEMENT */}
            {activeTab === "fleet" && (
              <FleetCards
                bots={tradeBots}
                botProfits={botProfits}
                botBalances={botBalances}
                sparklines={sparklines ?? {}}
                openTrades={openTrades}
                onBotClick={onBotClick}
                onStart={onStart}
                onStop={onStop}
                onPause={onPause}
                onReload={onReload}
                onForceExitAll={onForceExitAll}
                onStopBuy={onStopBuy}
                onSoftKill={onSoftKill}
                onHardKill={onHardKill}
              />
            )}

            {/* OPEN TRADES */}
            {activeTab === "open" && (() => {
              const rowsToShow = openSort.sorted.slice(0, visibleRows);
              const remaining = openSort.sorted.length - visibleRows;
              return (
              <>
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <SortHeader label="Date & Time" sortKey="open_date" {...openSort} />
                    <th className={`${TH_SORT} text-left`} onClick={() => openSort.onSort("pair")}>
                      Pair<span className="ml-1 text-[10px] opacity-25">{openSort.currentSort === "pair" ? (openSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="open_pair" values={getUniqueValues(openTrades, (t) => t.pair)} activeFilters={columnFilters["open_pair"]} onToggle={toggleFilter} />
                    </th>
                    <th className={`${TH_SORT} text-left`} onClick={() => openSort.onSort("_bot_name")}>
                      Bot Logic<span className="ml-1 text-[10px] opacity-25">{openSort.currentSort === "_bot_name" ? (openSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="open_bot" values={getUniqueValues(openTrades, (t) => t._bot_name ?? `Bot ${t._bot_id}`)} activeFilters={columnFilters["open_bot"]} onToggle={toggleFilter} />
                    </th>
                    <th className={`${TH_SORT} text-center`} onClick={() => openSort.onSort("is_short")}>
                      Side<span className="ml-1 text-[10px] opacity-25">{openSort.currentSort === "is_short" ? (openSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="open_side" values={["LONG", "SHORT"]} activeFilters={columnFilters["open_side"]} onToggle={toggleFilter} />
                    </th>
                    <SortHeader label="Size" sortKey="stake_amount" {...openSort} align="right" />
                    <SortHeader label="Entry" sortKey="open_rate" {...openSort} align="right" />
                    <SortHeader label="Mark Price" sortKey="current_rate" {...openSort} align="right" />
                    <SortHeader label="Profit %" sortKey="current_profit" {...openSort} align="right" highlight />
                    <SortHeader label="Value" sortKey="current_profit_abs" {...openSort} align="right" highlight />
                    <SortHeader label="Fee" sortKey="fee_open" {...openSort} align="right" />
                    <SortHeader label="Age" sortKey="open_date" {...openSort} />
                    <th className={`${TH_BASE} border-l border-white/[0.08] text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {rowsToShow.length === 0 ? (
                    <tr><td colSpan={12} className="px-5 py-8 text-center text-muted">No open trades</td></tr>
                  ) : (
                    rowsToShow.map((trade, idx) => {
                      // FT /status returns profit_ratio + profit_abs for open trades
                      // FT /trades returns current_profit + current_profit_abs for closed/detail
                      const pct = trade.current_profit ?? trade.profit_ratio ?? trade.close_profit ?? null;
                      const pnl = trade.current_profit_abs ?? trade.profit_abs ?? trade.close_profit_abs ?? null;
                      const isUp = pnl != null && pnl >= 0;
                      const color = pnl != null ? (isUp ? "text-up" : "text-down") : "text-muted";
                      const fee = (trade.fee_open + trade.fee_close) * trade.stake_amount;
                      const d = new Date(trade.open_date);
                      const dateStr = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear().toString().slice(2)}`;
                      const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

                      return (
                        <tr key={trade.trade_id} className={`hover:bg-white/[0.04] transition-colors group ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className={TD}>{dateStr} <span className="text-white/35 ml-1">{timeStr}</span></td>
                          <td className={`${TD} font-bold text-white`}>{trade.pair}</td>
                          <td className={`${TD} text-muted font-sans text-[12px]`}>{trade._bot_name ?? `Bot ${trade._bot_id}`}</td>
                          <td className={`${TD} text-center`}>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              trade.is_short
                                ? "bg-down/12 text-down border-down/25"
                                : "bg-up/12 text-up border-up/25"
                            }`}>
                              {trade.is_short ? "SHORT" : "LONG"}{trade.leverage > 1 ? ` ${trade.leverage}x` : ""}
                            </span>
                          </td>
                          <td className={`${TD} text-right text-muted`}>{fmt(trade.stake_amount, 2)}</td>
                          <td className={`${TD} text-right`}>{fmt(trade.open_rate, trade.open_rate < 1 ? 4 : 2)}</td>
                          <td className={`${TD} text-right font-medium`}>{fmt(trade.current_rate, trade.current_rate < 1 ? 4 : 2)}</td>
                          <td className={`${TD} text-right font-bold ${isUp ? "bg-up/5" : pnl != null ? "bg-down/5" : ""} ${color}`}>
                            {pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct * 100, 2)}%` : "\u2014"}
                          </td>
                          <td className={`${TD} text-right ${isUp ? "bg-up/5" : pnl != null ? "bg-down/5" : ""} ${color}`}>
                            {pnl != null ? fmtMoney(pnl) : "\u2014"}
                          </td>
                          <td className={`${TD} text-right text-muted text-[11px]`}>${fmt(fee, 2)}</td>
                          <td className={`${TD} text-muted`}>{fmtDuration(trade.open_date)}</td>
                          <td className={`${TD} border-l border-white/[0.08] text-center opacity-40 group-hover:opacity-100 transition-opacity`}>
                            <TradeActions
                              trade={trade}
                              onForceExit={onForceExit}
                              onForceEnter={onForceEnter}
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
                  className="w-full py-2 text-[11px] text-muted font-mono l-bd rounded hover:bg-white/5 transition-colors mt-2"
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
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <SortHeader label="Date" sortKey="close_date" {...closedSort} />
                    <th className={`${TH_SORT} text-left`} onClick={() => closedSort.onSort("pair")}>
                      Pair<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "pair" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_pair" values={getUniqueValues(closedTrades, (t) => t.pair)} activeFilters={columnFilters["closed_pair"]} onToggle={toggleFilter} />
                    </th>
                    <th className={`${TH_SORT} text-left`} onClick={() => closedSort.onSort("_bot_name")}>
                      Bot<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "_bot_name" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_bot" values={getUniqueValues(closedTrades, (t) => t._bot_name ?? `Bot ${t._bot_id}`)} activeFilters={columnFilters["closed_bot"]} onToggle={toggleFilter} />
                    </th>
                    <th className={`${TH_SORT} text-center`} onClick={() => closedSort.onSort("is_short")}>
                      Side<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "is_short" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_side" values={["LONG", "SHORT"]} activeFilters={columnFilters["closed_side"]} onToggle={toggleFilter} />
                    </th>
                    <SortHeader label="Entry" sortKey="open_rate" {...closedSort} align="right" />
                    <SortHeader label="Exit" sortKey="close_rate" {...closedSort} align="right" />
                    <SortHeader label="Profit %" sortKey="close_profit" {...closedSort} align="right" highlight />
                    <SortHeader label="Value" sortKey="close_profit_abs" {...closedSort} align="right" highlight />
                    <SortHeader label="Fee" sortKey="fee_open" {...closedSort} align="right" />
                    <SortHeader label="Duration" sortKey="trade_duration" {...closedSort} />
                    <th className={`${TH_SORT} text-left`} onClick={() => closedSort.onSort("exit_reason")}>
                      Exit Reason<span className="ml-1 text-[10px] opacity-25">{closedSort.currentSort === "exit_reason" ? (closedSort.currentDir === "asc" ? "\u2191" : "\u2193") : "\u21C5"}</span>
                      <FilterDropdown column="closed_exit" values={getUniqueValues(closedTrades, (t) => t.exit_reason ?? "")} activeFilters={columnFilters["closed_exit"]} onToggle={toggleFilter} />
                    </th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {closedRowsToShow.length === 0 ? (
                    <tr><td colSpan={11} className="px-5 py-8 text-center text-muted">No closed trades</td></tr>
                  ) : (
                    closedRowsToShow.map((trade, idx) => {
                      const pnl = trade.close_profit_abs;
                      const pct = trade.close_profit;
                      const isUp = pnl != null && pnl >= 0;
                      const color = pnl != null ? (isUp ? "text-up" : "text-down") : "text-muted";
                      const fee = (trade.fee_open + trade.fee_close) * trade.stake_amount;
                      const d = trade.close_date ? new Date(trade.close_date) : null;
                      const dateStr = d ? `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear().toString().slice(2)}` : "\u2014";
                      const timeStr = d ? `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}` : "";

                      return (
                        <tr key={trade.trade_id} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className={TD}>{dateStr} <span className="text-white/35 ml-1">{timeStr}</span></td>
                          <td className={`${TD} font-bold text-white`}>{trade.pair}</td>
                          <td className={`${TD} text-muted font-sans text-[12px]`}>{trade._bot_name ?? `Bot ${trade._bot_id}`}</td>
                          <td className={`${TD} text-center`}>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              trade.is_short
                                ? "bg-down/12 text-down border-down/25"
                                : "bg-up/12 text-up border-up/25"
                            }`}>
                              {trade.is_short ? "SHORT" : "LONG"}{trade.leverage > 1 ? ` ${trade.leverage}x` : ""}
                            </span>
                          </td>
                          <td className={`${TD} text-right`}>{fmt(trade.open_rate, trade.open_rate < 1 ? 4 : 2)}</td>
                          <td className={`${TD} text-right`}>{fmt(trade.close_rate, trade.close_rate != null && trade.close_rate < 1 ? 4 : 2)}</td>
                          <td className={`${TD} text-right font-bold ${isUp ? "bg-up/5" : pnl != null ? "bg-down/5" : ""} ${color}`}>
                            {pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct * 100, 2)}%` : "\u2014"}
                          </td>
                          <td className={`${TD} text-right ${isUp ? "bg-up/5" : pnl != null ? "bg-down/5" : ""} ${color}`}>
                            {pnl != null ? fmtMoney(pnl) : "\u2014"}
                          </td>
                          <td className={`${TD} text-right text-muted text-[11px]`}>${fmt(fee, 2)}</td>
                          <td className={`${TD} text-muted`}>{fmtDuration(trade.open_date, trade.close_date)}</td>
                          <td className={`${TD} font-sans text-[11px] ${trade.exit_reason === "stoploss" ? "text-down" : "text-muted"}`}>
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
                  className="w-full py-2 text-[11px] text-muted font-mono l-bd rounded hover:bg-white/5 transition-colors mt-2"
                >
                  Load More ({closedRemaining} remaining)
                </button>
              )}
              </>
              );
            })()}

            {/* WHITELIST MATRIX */}
            {activeTab === "whitelist" && (
              <table className={TABLE}>
                <thead className={THEAD}>
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
                    <th className={`${TH_BASE} border-l border-white/[0.08] text-center`}>Controls</th>
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {whitelistSort.sorted.length === 0 ? (
                    <tr><td colSpan={11} className="px-5 py-8 text-center text-muted">No whitelist data</td></tr>
                  ) : (
                    whitelistSort.sorted.map((row, idx) => {
                      return (
                        <tr key={row.pair} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className={`${TD} font-bold text-white`}>{row.pair}</td>
                          <td className={`${TD} text-center`}>
                            {row.lock ? (
                              <span className="bg-down/12 text-down border border-down/25 px-2 py-0.5 rounded text-[10px] font-bold">LOCKED</span>
                            ) : (
                              <span className="bg-up/12 text-up border border-up/25 px-2 py-0.5 rounded text-[10px] font-bold">ACTIVE</span>
                            )}
                          </td>
                          <td className={`${TD} text-muted font-sans text-[11px]`}>{row.assignedBots || "\u2014"}</td>
                          <td className={`${TD} text-right`}>{row.price > 0 ? fmt(row.price, row.price < 1 ? 4 : 2) : "\u2014"}</td>
                          <td className={`${TD} text-right ${(pairMarketData?.[row.pair]?.change24h ?? 0) >= 0 ? "text-up font-medium" : "text-down font-medium"}`}>
                            {pairMarketData?.[row.pair]?.change24h != null ? `${pairMarketData[row.pair].change24h >= 0 ? "+" : ""}${pairMarketData[row.pair].change24h.toFixed(2)}%` : "\u2014"}
                          </td>
                          <td className={`${TD} text-right text-muted`}>
                            {spreadData?.[row.pair]?.spreadPct != null
                              ? `${spreadData[row.pair].spreadPct.toFixed(3)}%`
                              : "—"}
                          </td>
                          <td className={`${TD} text-right text-muted`}>
                            {pairMarketData?.[row.pair]?.volume != null ? (() => {
                              const v = pairMarketData[row.pair].volume;
                              if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
                              if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
                              if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
                              return `$${v.toFixed(0)}`;
                            })() : "\u2014"}
                          </td>
                          <td className={`${TD} text-right`}>
                            {pairMarketData?.[row.pair]?.volatility != null ? (() => {
                              const vol = pairMarketData[row.pair].volatility;
                              const volColor = vol > 5 ? "text-down" : vol > 2 ? "text-yellow-400" : "text-up";
                              const volLabel = vol > 5 ? "High" : vol > 2 ? "Med" : "Low";
                              return <span className={volColor}>{volLabel}</span>;
                            })() : "\u2014"}
                          </td>
                          <td className={`${TD} text-center font-bold`}>{row.openCount}</td>
                          <td className={`${TD} text-center`}>
                            {row.lock ? (
                              <span className="text-down text-[10px] font-bold">{row.lock.reason}</span>
                            ) : "\u2014"}
                          </td>
                          <td className={`${TD} border-l border-white/[0.08] text-center`}>
                            {row.lock ? (
                              <button onClick={() => {
                                const botId = whitelistBotMap?.get(row.pair);
                                if (botId && row.lock) onUnlockPair?.(row.lock.id, botId);
                              }} className="bg-black l-bd hover:bg-up/20 text-muted hover:text-up px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer">UNLOCK</button>
                            ) : (
                              <button onClick={() => {
                                const botId = whitelistBotMap?.get(row.pair);
                                if (botId) onLockPair?.(row.pair, botId);
                              }} className="bg-black l-bd hover:bg-down/20 text-muted hover:text-down px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer">LOCK</button>
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
              <table className={TABLE}>
                <thead className={THEAD}>
                  <tr>
                    <SortHeader label="Pair" sortKey="pair" {...perfSort} />
                    <SortHeader label="Trades" sortKey="count" {...perfSort} align="right" />
                    <SortHeader label="Wins" sortKey="_wins" {...perfSort} align="right" />
                    <SortHeader label="Losses" sortKey="_losses" {...perfSort} align="right" />
                    <SortHeader label="Win Rate" sortKey="_winrate" {...perfSort} align="right" />
                    <SortHeader label="Profit %" sortKey="profit_ratio" {...perfSort} align="right" highlight />
                    <SortHeader label="Profit Abs" sortKey="profit_abs" {...perfSort} align="right" highlight />
                    <SortHeader label="Avg Profit" sortKey="_avg_profit" {...perfSort} align="right" />
                    <SortHeader label="Total Fees" sortKey="_total_fees" {...perfSort} align="right" />
                  </tr>
                </thead>
                <tbody className={TBODY}>
                  {perfSort.sorted.length === 0 ? (
                    <tr><td colSpan={9} className="px-5 py-8 text-center text-muted">No performance data</td></tr>
                  ) : (
                    perfSort.sorted.map((p, idx) => {
                      const isUp = p.profit_abs >= 0;
                      const color = isUp ? "text-up" : "text-down";
                      // Derive wins/losses from closed trades for this pair
                      const pairClosed = closedTrades.filter((t) => t.pair === p.pair);
                      const wins = pairClosed.filter((t) => (t.close_profit_abs ?? 0) >= 0).length;
                      const losses = pairClosed.filter((t) => (t.close_profit_abs ?? 0) < 0).length;
                      const winrate = pairClosed.length > 0 ? wins / pairClosed.length : 0;
                      const tradeCount = p.count ?? p.trades ?? 0;
                      const avgProfit = tradeCount > 0 ? (p.profit_ratio * 100) / tradeCount : 0;
                      const totalFees = pairClosed.reduce((acc, t) => acc + (t.fee_open + t.fee_close) * t.stake_amount, 0);
                      const wrColor = winrate >= 0.65 ? "text-up" : winrate < 0.50 ? "text-down" : "";
                      return (
                        <tr key={p.pair} className={`hover:bg-white/[0.04] transition-colors ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className={`${TD} font-bold text-white`}>{p.pair}</td>
                          <td className={`${TD} text-right`}>{p.count ?? p.trades ?? 0}</td>
                          <td className={`${TD} text-right text-up`}>{wins}</td>
                          <td className={`${TD} text-right text-down`}>{losses}</td>
                          <td className={`${TD} text-right font-medium ${wrColor}`}>{fmt(winrate * 100, 1)}%</td>
                          <td className={`${TD} text-right font-bold ${isUp ? "bg-up/5" : "bg-down/5"} ${color}`}>
                            {p.profit_ratio >= 0 ? "+" : ""}{fmt(p.profit_ratio * 100, 1)}%
                          </td>
                          <td className={`${TD} text-right ${isUp ? "bg-up/5" : "bg-down/5"} ${color}`}>
                            {fmtMoney(p.profit_abs)}
                          </td>
                          <td className={`${TD} text-right ${isUp ? "text-up" : "text-down"}`}>
                            {avgProfit >= 0 ? "+" : ""}{fmt(avgProfit, 2)}%
                          </td>
                          <td className={`${TD} text-right text-muted`}>{fmtMoney(totalFees)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* ENTRY TAGS */}
            {activeTab === "entries" && (
              <table className={TABLE}>
                <thead className={THEAD}>
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
                <tbody className={TBODY}>
                  {entrySort.sorted.length === 0 ? (
                    <tr><td colSpan={10} className="px-5 py-8 text-center text-muted">No entry tag data</td></tr>
                  ) : (
                    entrySort.sorted.map((e, idx) => {
                      const wr = e.winrate ?? 0;
                      const wrColor = wr >= 0.65 ? "text-up" : wr < 0.50 ? "text-down" : "";
                      const pnlColor = (e.profit_abs ?? 0) >= 0 ? "text-up" : "text-down";
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
                      const entries = e.entries ?? 0;
                      const expectancy = entries > 0 ? (e.profit_abs ?? 0) / entries : 0;
                      const expColor = expectancy >= 0 ? "text-up" : "text-down";
                      return (
                        <tr key={e.enter_tag} className={`hover:bg-white/[0.04] ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className={`${TD} text-white font-medium`}>{e.enter_tag}</td>
                          <td className={`${TD} text-right`}>{entries}</td>
                          <td className={`${TD} text-right text-up`}>{e.wins ?? 0}</td>
                          <td className={`${TD} text-right text-down`}>{e.losses ?? 0}</td>
                          <td className={`${TD} text-right font-medium ${wrColor}`}>{fmt(wr * 100, 1)}%</td>
                          <td className={`${TD} text-right ${pnlColor}`}>{(e.avg_profit ?? 0) >= 0 ? "+" : ""}{fmt(e.avg_profit ?? 0, 2)}%</td>
                          <td className={`${TD} text-right font-bold ${pnlColor}`}>{fmtMoney(e.profit_abs ?? 0)}</td>
                          <td className={`${TD} text-right text-muted`}>{avgDurStr}</td>
                          <td className={`${TD} text-white/70`}>{bestPair}</td>
                          <td className={`${TD} text-right font-bold ${expColor}`}>{fmtMoney(expectancy)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* EXIT REASONS */}
            {activeTab === "exits" && (
              <table className={TABLE}>
                <thead className={THEAD}>
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
                <tbody className={TBODY}>
                  {exitSort.sorted.length === 0 ? (
                    <tr><td colSpan={10} className="px-5 py-8 text-center text-muted">No exit reason data</td></tr>
                  ) : (
                    exitSort.sorted.map((e, idx) => {
                      const wr = e.winrate ?? 0;
                      const wrColor = wr >= 0.65 ? "text-up" : wr < 0.50 ? "text-down" : "";
                      const pnlColor = (e.profit_abs ?? 0) >= 0 ? "text-up" : "text-down";
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
                      const exits = e.exits ?? 0;
                      const expectancy = exits > 0 ? (e.profit_abs ?? 0) / exits : 0;
                      const expColor = expectancy >= 0 ? "text-up" : "text-down";
                      return (
                        <tr key={e.exit_reason} className={`hover:bg-white/[0.04] ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                          <td className={`${TD} text-white font-medium`}>{e.exit_reason}</td>
                          <td className={`${TD} text-right`}>{exits}</td>
                          <td className={`${TD} text-right text-up`}>{e.wins ?? 0}</td>
                          <td className={`${TD} text-right text-down`}>{e.losses ?? 0}</td>
                          <td className={`${TD} text-right font-medium ${wrColor}`}>{fmt(wr * 100, 1)}%</td>
                          <td className={`${TD} text-right ${pnlColor}`}>{(e.avg_profit ?? 0) >= 0 ? "+" : ""}{fmt(e.avg_profit ?? 0, 2)}%</td>
                          <td className={`${TD} text-right font-bold ${pnlColor}`}>{fmtMoney(e.profit_abs ?? 0)}</td>
                          <td className={`${TD} text-right text-muted`}>{avgDurStr}</td>
                          <td className={`${TD} text-white/70`}>{bestPair}</td>
                          <td className={`${TD} text-right font-bold ${expColor}`}>{fmtMoney(expectancy)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
            {/* BLACKLIST */}
            {activeTab === "blacklist" && (
              <div className="p-4 flex flex-col gap-4 max-w-2xl">
                {/* Add form */}
                <div className="flex gap-2">
                  <input
                    className="builder-input flex-1"
                    placeholder="BTC/USDT:USDT or pattern..."
                    value={blacklistInput}
                    onChange={(e) => setBlacklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && blacklistInput.trim()) {
                        onAddBlacklist?.(blacklistInput.trim());
                        setBlacklistInput("");
                      }
                    }}
                  />
                  <button
                    className="builder-action border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1] px-4"
                    onClick={() => {
                      if (blacklistInput.trim()) {
                        onAddBlacklist?.(blacklistInput.trim());
                        setBlacklistInput("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>

                {/* Blacklist entries */}
                {!blacklistData || blacklistData.blacklist.length === 0 ? (
                  <div className="text-center py-8 text-muted text-sm">No pairs blacklisted</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {blacklistData.blacklist.map((pair) => (
                      <div
                        key={pair}
                        className="group/row flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/10 transition-colors"
                      >
                        <span className="font-mono text-[13px] text-foreground">{pair}</span>
                        <button
                          className="text-[11px] text-muted hover:text-down opacity-0 group-hover/row:opacity-100 transition-all"
                          title="Remove from blacklist"
                          onClick={() => onDeleteBlacklist?.(pair)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
