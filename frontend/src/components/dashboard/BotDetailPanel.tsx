"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Play, Square, Pause, RefreshCw, PlusCircle, XSquare, PlusSquare, ShieldAlert, Zap, LogOut, Scissors, Ban, Trash2 } from "lucide-react";
import { botForceExit, botForceEnter, botDeleteTrade, botReloadTrade, botCancelOpenOrder } from "@/lib/api";
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
  onConfigRefresh?: (config: FTShowConfig) => void;
}

// Status Badge helper — matches ds_bot_drawer.md §30B Mode Badge Variants
function StatusBadge({ status }: { status: string; isDryRun: boolean }) {
  if (status === "draining") {
    return (
      <span className="px-1.5 py-[2px] bg-yellow-400/15 text-yellow-400 border border-yellow-500/25 text-[10px] font-bold rounded">
        DRAINING
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
  return (
    <span className="px-1.5 py-[2px] bg-up/15 text-up border border-up/25 text-[10px] font-bold rounded">
      RUNNING
    </span>
  );
}

/**
 * Dynamically calculates --drawer-left CSS variable matching HTML prototype JS (line 5403-5410):
 * left = sidebarWidth + padding(20) + fleetColumnWidth + gap(20)
 * Reacts to sidebar collapse/expand by observing DOM changes.
 */
function DrawerLeftStyle({ isOpen }: { isOpen: boolean }) {
  const [drawerLeft, setDrawerLeft] = useState(680);

  useEffect(() => {
    if (!isOpen) return;

    function calc() {
      // Find the sidebar element — Sidebar component uses w-[56px] (collapsed) or w-[240px] (expanded)
      const sidebarEl = (document.querySelector(".w-\\[56px\\]") ?? document.querySelector(".w-\\[240px\\]")) as HTMLElement | null;
      const sidebarW = sidebarEl ? sidebarEl.offsetWidth : (window.innerWidth <= 1024 ? 0 : 56);
      
      // Find fleet column — FleetPanel has w-[400px]
      const fleetEl = document.querySelector(".w-\\[400px\\]") as HTMLElement | null;
      const fleetW = fleetEl ? fleetEl.offsetWidth : 400;
      
      const padding = 20;
      const gap = 20;
      let left = sidebarW + padding + fleetW + gap;
      
      // Clamp: on small screens, take full width
      if (window.innerWidth <= 1024) left = 0;
      // Don't let left be more than 60% of screen
      if (left > window.innerWidth * 0.6) left = Math.max(0, window.innerWidth * 0.4);
      
      setDrawerLeft(left);
    }

    calc();

    // React to sidebar toggle (class changes on the sidebar element)
    const observer = new MutationObserver(() => { calc(); setTimeout(calc, 300); });
    const observeEl = (document.querySelector(".w-\\[56px\\]") ?? document.querySelector(".w-\\[240px\\]")) as HTMLElement | null;
    if (observeEl?.parentElement) {
      // Observe parent so we catch when class changes from w-[56px] to w-[240px]
      observer.observe(observeEl.parentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }

    // Also react to window resize
    window.addEventListener("resize", calc);
    // Recalculate after sidebar animation completes
    const timer = setTimeout(calc, 350);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", calc);
      clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <style dangerouslySetInnerHTML={{ __html: `:root { --drawer-left: ${drawerLeft}px; }` }} />
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDelete,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDuplicate,
  onPause,
  onReload,
  onForceEnter,
  onForceExitAll,
  onStopBuy,
  onSoftKill,
  onHardKill,
  onConfigRefresh,
}: BotDetailPanelProps) {
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  // ── Drawer sort state ────────────────────────────────────────────────
  type SortDir = "asc" | "desc" | null;
  const [drawerSortKey, setDrawerSortKey] = useState<string | null>(null);
  const [drawerSortDir, setDrawerSortDir] = useState<SortDir>(null);
  const [drawerSortTable, setDrawerSortTable] = useState<string | null>(null);

  const handleDrawerSort = useCallback((table: string, key: string) => {
    if (drawerSortTable === table && drawerSortKey === key) {
      setDrawerSortDir(drawerSortDir === "asc" ? "desc" : drawerSortDir === "desc" ? null : "asc");
      if (drawerSortDir === "desc") { setDrawerSortKey(null); setDrawerSortTable(null); }
    } else {
      setDrawerSortTable(table);
      setDrawerSortKey(key);
      setDrawerSortDir("desc");
    }
  }, [drawerSortTable, drawerSortKey, drawerSortDir]);

  // Generic sort function for any array based on current drawer sort state
  const sortDrawerData = useCallback(<T,>(data: T[], table: string): T[] => {
    if (drawerSortTable !== table || !drawerSortKey || !drawerSortDir) return data;
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[drawerSortKey!];
      const bv = (b as Record<string, unknown>)[drawerSortKey!];
      const na = typeof av === "number" ? av : typeof av === "string" ? av : 0;
      const nb = typeof bv === "number" ? bv : typeof bv === "string" ? bv : 0;
      if (typeof na === "number" && typeof nb === "number") {
        return drawerSortDir === "asc" ? na - nb : nb - na;
      }
      return drawerSortDir === "asc" ? String(na).localeCompare(String(nb)) : String(nb).localeCompare(String(na));
    });
  }, [drawerSortTable, drawerSortKey, drawerSortDir]);

  // ── Config inline editing state ─────────────────────────────────────
  const [editingSection, setEditingSection] = useState<"core" | "risk" | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string | number | boolean>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const handleEditStart = useCallback((section: "core" | "risk") => {
    if (!configData) return;
    if (section === "core") {
      setEditValues({
        stake_amount: typeof configData.stake_amount === "number" ? configData.stake_amount : 0,
        max_open_trades: configData.max_open_trades ?? 0,
        timeframe: configData.timeframe ?? "",
      });
    } else {
      setEditValues({
        stoploss: configData.stoploss != null ? configData.stoploss * 100 : -10,
        trailing_stop: configData.trailing_stop ?? false,
        trailing_stop_positive: configData.trailing_stop_positive ?? 0,
        trailing_stop_positive_offset: configData.trailing_stop_positive_offset ?? 0,
      });
    }
    setEditingSection(section);
  }, [configData]);

  const handleSaveApply = useCallback(async () => {
    if (!bot || !editingSection) return;
    setSavingConfig(true);
    try {
      const { saveBotConfig, applyBotConfig, botConfig } = await import("@/lib/api");
      const patch: Record<string, unknown> = {};
      if (editingSection === "core") {
        patch.stake_amount = Number(editValues.stake_amount);
        patch.max_open_trades = Number(editValues.max_open_trades);
        patch.timeframe = String(editValues.timeframe);
      } else {
        patch.stoploss = Number(editValues.stoploss) / 100; // convert % back to ratio
        patch.trailing_stop = editValues.trailing_stop;
        patch.trailing_stop_positive = Number(editValues.trailing_stop_positive);
        patch.trailing_stop_positive_offset = Number(editValues.trailing_stop_positive_offset);
      }
      await saveBotConfig(bot.id, patch);
      await applyBotConfig(bot.id);
      // Re-fetch config to refresh the display immediately
      try {
        const freshConfig = await botConfig(bot.id);
        if (onConfigRefresh) onConfigRefresh(freshConfig);
      } catch { /* config refresh non-critical */ }
      setEditingSection(null);
    } catch { /* TODO: show error toast */ } finally {
      setSavingConfig(false);
    }
  }, [bot, editingSection, editValues, onConfigRefresh]);

  // ── Backtest / Hyperopt history state ───────────────────────────────
  const [backtestHistory, setBacktestHistory] = useState<Array<{ filename: string; strategy: string; run_id: string; backtest_start_time: number; notes?: string; timeframe?: string }>>([]);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [hyperoptRuns, setHyperoptRuns] = useState<Array<{ filename: string; strategy: string; created_at: string; mtime: number; size_bytes: number; epochs: number }>>([]);
  const [hyperoptLoading, setHyperoptLoading] = useState(false);
  // Expanded hyperopt run details
  const [hyperoptDetails, setHyperoptDetails] = useState<Record<string, Array<{ current_epoch: number; loss: number; trades: number; winRate: number; profitPct: number; profitAbs: number; maxDrawdown: number; sharpe: number; sortino: number; avgDuration: string; params?: Record<string, unknown> }>>>({});
  // Expanded backtest result details
  const [backtestDetails, setBacktestDetails] = useState<Record<string, Record<string, unknown>>>({});

  // Fetch backtest history when tab becomes active
  const fetchBacktestHistory = useCallback(async () => {
    if (!bot) return;
    setBacktestLoading(true);
    try {
      const { botBacktestHistory } = await import("@/lib/api");
      const data = await botBacktestHistory(bot.id);
      // Filter to bot's strategy
      const stratName = configData?.strategy ?? bot.strategy_name;
      const filtered = stratName ? data.results.filter(r => r.strategy === stratName) : data.results;
      setBacktestHistory(filtered.sort((a, b) => b.backtest_start_time - a.backtest_start_time));
    } catch { /* non-blocking */ } finally {
      setBacktestLoading(false);
    }
  }, [bot, configData?.strategy]);

  // Fetch single backtest result detail
  const fetchBacktestDetail = useCallback(async (filename: string, strategy: string) => {
    if (!bot) return;
    try {
      const { botBacktestHistoryResult } = await import("@/lib/api");
      const result = await botBacktestHistoryResult(bot.id, filename, strategy);
      setBacktestDetails(prev => {
        if (prev[filename]) return prev; // already fetched
        return { ...prev, [filename]: result };
      });
    } catch { /* non-blocking */ }
  }, [bot]);

  // Fetch hyperopt runs when tab becomes active
  const fetchHyperoptRuns = useCallback(async () => {
    if (!bot) return;
    setHyperoptLoading(true);
    try {
      const { botHyperoptRuns } = await import("@/lib/api");
      const data = await botHyperoptRuns(bot.id);
      setHyperoptRuns((data.runs ?? []).sort((a, b) => b.mtime - a.mtime));
    } catch { /* non-blocking */ } finally {
      setHyperoptLoading(false);
    }
  }, [bot]);

  // Fetch hyperopt detail for a specific run
  const fetchHyperoptDetail = useCallback(async (filename: string) => {
    if (!bot) return;
    try {
      const { botHyperoptHistoryResults } = await import("@/lib/api");
      const data = await botHyperoptHistoryResults(bot.id, filename);
      setHyperoptDetails(prev => {
        if (prev[filename]) return prev; // already fetched
        return { ...prev, [filename]: data.results ?? [] };
      });
    } catch { /* non-blocking */ }
  }, [bot]);

  // Reset history when bot changes
  useEffect(() => {
    setBacktestHistory([]);
    setBacktestDetails({});
    setHyperoptRuns([]);
    setHyperoptDetails({});
  }, [bot?.id]);

  // Auto-fetch when tab changes
  useEffect(() => {
    if (detailTab === "backtest" && backtestHistory.length === 0 && !backtestLoading) fetchBacktestHistory();
    if (detailTab === "hyperopt" && hyperoptRuns.length === 0 && !hyperoptLoading) fetchHyperoptRuns();
  }, [detailTab, backtestHistory.length, backtestLoading, fetchBacktestHistory, hyperoptRuns.length, hyperoptLoading, fetchHyperoptRuns]);

  // Auto-fetch detail for first backtest/hyperopt item when list loads
  useEffect(() => {
    if (backtestHistory.length > 0) {
      const first = backtestHistory[0];
      fetchBacktestDetail(first.filename, first.strategy);
    }
  }, [backtestHistory, fetchBacktestDetail]);
  useEffect(() => {
    if (hyperoptRuns.length > 0) {
      fetchHyperoptDetail(hyperoptRuns[0].filename);
    }
  }, [hyperoptRuns, fetchHyperoptDetail]);

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
      {/* Dynamic drawer-left: tracks sidebar + fleet column width, matching HTML prototype JS (line 5403-5410) */}
      <DrawerLeftStyle isOpen={isOpen} />
      <div
        className="fixed top-0 bottom-0 z-[60] flex flex-col overflow-hidden"
        style={{
          left: "var(--drawer-left)",
          right: 0,
          width: "auto",
          background: "#0C0C0C",
          borderLeft: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.85)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.25s ease",
        }}
      >
        {/* Header — ds_bot_drawer.md §30B */}
        <div className="p-4 pb-3 l-b bg-black flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-base font-bold tracking-tight text-white font-mono">{bot.name}</h2>
                <StatusBadge status={bot.status} isDryRun={bot.is_dry_run} />
                {bot.is_dry_run
                  ? <span className="px-1.5 py-[2px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 text-[10px] font-bold rounded">PAPER</span>
                  : <span className="px-1.5 py-[2px] bg-up/10 text-up border border-up/20 text-[10px] font-bold rounded">LIVE</span>
                }
                {bot.trading_mode === "futures"
                  ? <span className="px-1.5 py-[2px] bg-blue-500/15 text-blue-400 border border-blue-500/25 text-[10px] font-bold rounded">FUTURES</span>
                  : <span className="px-1.5 py-[2px] bg-white/5 text-white/40 border border-white/10 text-[10px] font-bold rounded">SPOT</span>
                }
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
            <button type="button" onClick={onForceEnter ?? (() => {})} className="bot-ctrl ctrl-start flex items-center gap-1 px-2" title="Force Entry — open a trade on this bot">
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">Force Entry</span>
            </button>
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
              backtestHistory={backtestHistory}
              backtestLoading={backtestLoading}
              backtestDetails={backtestDetails}
              fetchBacktestDetail={fetchBacktestDetail}
              hyperoptRuns={hyperoptRuns}
              hyperoptLoading={hyperoptLoading}
              hyperoptDetails={hyperoptDetails}
              fetchHyperoptDetail={fetchHyperoptDetail}
              editingSection={editingSection}
              editValues={editValues}
              savingConfig={savingConfig}
              onEditStart={handleEditStart}
              onEditCancel={() => setEditingSection(null)}
              onEditChange={(k, v) => setEditValues(prev => ({ ...prev, [k]: v }))}
              onSaveApply={handleSaveApply}
              onSort={handleDrawerSort}
              sortData={sortDrawerData}
              sortKey={drawerSortKey}
              sortDir={drawerSortDir}
              sortTable={drawerSortTable}
            />
            </div>
          )}
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
  backtestHistory,
  backtestLoading,
  backtestDetails,
  fetchBacktestDetail,
  hyperoptRuns,
  hyperoptLoading,
  hyperoptDetails,
  fetchHyperoptDetail,
  editingSection,
  editValues,
  savingConfig,
  onEditStart,
  onEditCancel,
  onEditChange,
  onSaveApply,
  onSort,
  sortData,
  sortKey,
  sortDir,
  sortTable,
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
  backtestHistory: Array<{ filename: string; strategy: string; run_id: string; backtest_start_time: number; notes?: string; timeframe?: string }>;
  backtestLoading: boolean;
  backtestDetails: Record<string, Record<string, unknown>>;
  fetchBacktestDetail: (filename: string, strategy: string) => void;
  hyperoptRuns: Array<{ filename: string; strategy: string; created_at: string; mtime: number; size_bytes: number; epochs: number }>;
  hyperoptLoading: boolean;
  hyperoptDetails: Record<string, Array<{ current_epoch: number; loss: number; trades: number; winRate: number; profitPct: number; profitAbs: number; maxDrawdown: number; sharpe: number; sortino: number; avgDuration: string; params?: Record<string, unknown> }>>;
  fetchHyperoptDetail: (filename: string) => void;
  editingSection: "core" | "risk" | null;
  editValues: Record<string, string | number | boolean>;
  savingConfig: boolean;
  onEditStart: (section: "core" | "risk") => void;
  onEditCancel: () => void;
  onEditChange: (key: string, value: string | number | boolean) => void;
  onSaveApply: () => void;
  onSort: (table: string, key: string) => void;
  sortData: <T>(data: T[], table: string) => T[];
  sortKey: string | null;
  sortDir: "asc" | "desc" | null;
  sortTable: string | null;
}) {
  // Sortable header helper for drawer tables
  const SH = ({ label, tbl, col, align }: { label: string; tbl: string; col: string; align?: "right" | "left" | "center" }) => {
    const active = sortTable === tbl && sortKey === col;
    return (
      <th
        className={`py-1.5 px-1 font-semibold cursor-pointer select-none hover:text-white transition-colors ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${active ? "text-white" : ""}`}
        onClick={() => onSort(tbl, col)}
      >
        {label}
        <span className="ml-0.5 text-[9px] opacity-30">{active ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}</span>
      </th>
    );
  };

  /* ─── Per-trade action handlers (trades tab) ─── */
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());

  const markExiting = (id: number) => setExitingIds((p) => new Set(p).add(id));
  const unmarkExiting = (id: number) => setExitingIds((p) => { const n = new Set(p); n.delete(id); return n; });

  const handleForceExit = async (trade: FTTrade, ordertype: string) => {
    markExiting(trade.trade_id);
    try { await botForceExit(bot.id, String(trade.trade_id), ordertype); }
    finally { unmarkExiting(trade.trade_id); }
  };

  const handleForceEnter = async (trade: FTTrade) => {
    markExiting(trade.trade_id);
    try { await botForceEnter(bot.id, trade.pair, trade.is_short ? "short" : "long"); }
    finally { unmarkExiting(trade.trade_id); }
  };

  const handleReloadTrade = async (trade: FTTrade) => {
    markExiting(trade.trade_id);
    try { await botReloadTrade(bot.id, trade.trade_id); }
    finally { unmarkExiting(trade.trade_id); }
  };

  const handleCancelOrder = async (trade: FTTrade) => {
    markExiting(trade.trade_id);
    try { await botCancelOpenOrder(bot.id, trade.trade_id); }
    finally { unmarkExiting(trade.trade_id); }
  };

  const handleDeleteTrade = async (trade: FTTrade) => {
    if (!confirm(`Delete trade #${trade.trade_id} (${trade.pair})? This cannot be undone.`)) return;
    markExiting(trade.trade_id);
    try { await botDeleteTrade(bot.id, trade.trade_id); }
    finally { unmarkExiting(trade.trade_id); }
  };

  switch (tab) {
    /* ─── Overview ─── */
    case "overview": {
      // ── All stats from FT /profit endpoint (2026.x) ─────────────────────
      const winCount = profit?.winning_trades ?? 0;
      const lossCount = profit?.losing_trades ?? 0;
      const totalCount = winCount + lossCount;
      const winRate = profit?.winrate != null ? profit.winrate * 100 : (totalCount > 0 ? (winCount / totalCount) * 100 : null);
      // FT /status uses profit_abs, not current_profit_abs
      const openPnl = openTrades.reduce((s, t) => s + (t.current_profit_abs ?? t.profit_abs ?? 0), 0);
      const openStake = openTrades.reduce((s, t) => s + (t.stake_amount ?? 0), 0);
      const closedCount = profit?.closed_trade_count ?? closedTrades.length;

      // All risk metrics directly from /profit endpoint
      const profitFactor: number | null = profit?.profit_factor ?? null;
      const maxDdPct: number | null = profit?.max_drawdown != null ? profit.max_drawdown * 100 : null;
      const maxDdAbs: number | null = profit?.max_drawdown_abs ?? null;
      const currentDdPct = profit?.current_drawdown != null ? profit.current_drawdown * 100 : 0;
      const sharpeRatio: number | null = profit?.sharpe ?? null;
      const sortinoRatio: number | null = profit?.sortino ?? null;
      const calmarRatio: number | null = profit?.calmar ?? null;
      const sqn: number | null = profit?.sqn ?? null;
      const expectancy: number | null = profit?.expectancy ?? null;
      const expectancyRatio: number | null = profit?.expectancy_ratio ?? null;
      // cagr: FT returns as multiplier (e.g. 2.44 = 2.44× annual)
      const cagr: number | null = profit?.cagr ?? null;

      // Trading Volume & Avg hold
      const tradingVolume = profit?.trading_volume ?? 0;
      const fmtVol = (v: number) =>
        v >= 1_000_000 ? `$${fmt(v / 1_000_000, 1)}M` : v >= 1_000 ? `$${fmt(v / 1_000, 0)}K` : `$${fmt(v, 0)}`;
      const avgHoldSec = (() => {
        const d = profit?.avg_duration;
        if (d == null) return null;
        if (typeof d === "number") return d;
        const parts = String(d).split(":");
        return parts.length === 3
          ? (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0)
          : null;
      })();

      // Best pair — prefer profit.best_pair_profit_abs, fallback to perf data
      const bestPerfPair = perfData.length > 0
        ? [...perfData].sort((a, b) => b.profit_abs - a.profit_abs)[0]
        : null;

      // Balance helpers
      const stakeCurrency = configData?.stake_currency ?? balanceData?.stake ?? "USDT";
      const stakeBalance = balanceData?.currencies?.find(c => c.currency === stakeCurrency);
      const otherCurrencies = (balanceData?.currencies ?? []).filter(
        c => c.currency !== stakeCurrency && (c.balance > 0 || c.est_stake > 0)
      );

      // Stake display — handle "unlimited" string
      const stakeAmountDisplay = configData
        ? (typeof configData.stake_amount === "number"
            ? `${fmt(configData.stake_amount, 0)} ${stakeCurrency}`
            : String(configData.stake_amount))
        : "—";

      // Exit reasons — /stats returns wins/losses per reason
      const exitReasons = statsData?.exit_reasons ?? {};

      // Inline label/sub-title helpers (functions, not components — avoids React remount)
      const lbl = (text: string) => <span className="text-[11px] text-white/40 font-mono">{text}</span>;
      const secTitle = (text: string) => <div className="text-[10px] uppercase tracking-widest text-white/20 mb-0.5">{text}</div>;

      return (
        <>
          {/* ── KPI SECTION ─────────────────────────────────────────────── */}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/20 mb-1.5 px-0.5">Key Metrics</div>
            <div className="flex flex-col gap-2">
              {/* Row 1: Closed P&L · Open P&L · Total Equity · Profit Factor · CAGR · Win Rate */}
              <div className="grid grid-cols-6 gap-2">
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Closed P&L</div>
                  <div className={`font-mono font-bold text-base ${profitColor(profit?.profit_closed_coin)}`}>{fmtMoney(profit?.profit_closed_coin)}</div>
                  {profit?.profit_closed_percent != null && <div className={`text-[10px] font-mono mt-0.5 ${profitColor(profit.profit_closed_percent)}`}>{profit.profit_closed_percent >= 0 ? "+" : ""}{fmt(profit.profit_closed_percent, 2)}%</div>}
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Open P&L</div>
                  <div className={`font-mono font-bold text-base ${profitColor(openPnl)}`}>{fmtMoney(openPnl)}</div>
                  <div className="text-white/35 text-[10px] font-mono mt-0.5">{openTrades.length} position{openTrades.length !== 1 ? "s" : ""}</div>
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Total Equity</div>
                  <div className="text-white font-mono font-bold text-base">{balanceData?.total ? `$${fmt(balanceData.total, 0)}` : "—"}</div>
                  {balanceData?.starting_capital_ratio != null && (
                    <div className={`text-[10px] font-mono mt-0.5 ${profitColor(balanceData.starting_capital_ratio)}`}>
                      {balanceData.starting_capital_ratio >= 0 ? "+" : ""}{fmt(balanceData.starting_capital_ratio * 100, 2)}% vs start
                    </div>
                  )}
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Profit Factor</div>
                  <div className={`font-mono font-bold text-base ${(profitFactor ?? 0) > 1 ? "text-up" : "text-white"}`}>{profitFactor != null ? fmt(profitFactor, 2) : "—"}</div>
                  <div className="text-white/25 text-[10px] font-mono mt-0.5">quality</div>
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">CAGR</div>
                  <div className={`font-mono font-bold text-base ${cagr != null ? (cagr >= 1 ? "text-up" : "text-down") : "text-white"}`}>{cagr != null ? `${fmt(cagr, 2)}x` : "—"}</div>
                  <div className="text-white/25 text-[10px] font-mono mt-0.5">annualized</div>
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Win Rate</div>
                  <div className={`font-mono font-bold text-base ${winRate != null && winRate >= 50 ? "text-up" : "text-white"}`}>{winRate != null ? `${fmt(winRate, 1)}%` : "—"}</div>
                  {totalCount > 0 && <div className={`text-[10px] font-mono mt-0.5 ${winRate != null && winRate >= 50 ? "text-up/50" : "text-white/35"}`}>{winCount}W · {lossCount}L</div>}
                </div>
              </div>
              {/* Row 2: Max DD · Volume · Avg Hold · Positions · Stake · Total Trades */}
              <div className="grid grid-cols-6 gap-2">
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Max Drawdown</div>
                  <div className={`font-mono font-bold text-base ${maxDdPct != null ? "text-down" : "text-white"}`}>{maxDdPct != null ? `-${fmt(maxDdPct, 2)}%` : "—"}</div>
                  {maxDdAbs != null && <div className="text-down/50 text-[10px] font-mono mt-0.5">-${fmt(maxDdAbs, 2)}</div>}
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Trading Volume</div>
                  <div className="text-white font-mono font-bold text-base">{tradingVolume > 0 ? fmtVol(tradingVolume) : "—"}</div>
                  <div className="text-white/25 text-[10px] font-mono mt-0.5">total</div>
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Avg Hold</div>
                  <div className="text-white font-mono font-bold text-base">{avgHoldSec != null ? fmtDurSec(avgHoldSec) : "—"}</div>
                  <div className="text-white/25 text-[10px] font-mono mt-0.5">per trade</div>
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Positions</div>
                  <div className="text-white font-mono font-bold text-base">{openTrades.length} / {configData?.max_open_trades ?? "∞"}</div>
                  {openStake > 0 && <div className="text-white/25 text-[10px] font-mono mt-0.5">${fmt(openStake, 0)} committed</div>}
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Stake</div>
                  <div className="text-white font-mono font-bold text-base">{stakeAmountDisplay}</div>
                  <div className="text-white/25 text-[10px] font-mono mt-0.5">per trade</div>
                </div>
                <div className="bg-surface p-2.5 l-bd rounded">
                  <div className="kpi-label">Total Trades</div>
                  <div className="text-white font-mono font-bold text-base">{profit?.trade_count ?? totalCount}</div>
                  <div className="text-white/25 text-[10px] font-mono mt-0.5">{closedCount} closed</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW A: P&L · Strategy Quality · Trading Activity ─────── */}
          <div className="flex gap-2.5">
            {/* P&L */}
            <div className="bg-surface p-3 l-bd rounded flex flex-col gap-3 flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">P&L</div>
              <div className="flex flex-col gap-2">
                {secTitle("Profit")}
                <div className="flex justify-between items-baseline">{lbl("Closed")}<span className={`font-mono font-bold text-[15px] ${profitColor(profit?.profit_closed_coin)}`}>{fmtMoney(profit?.profit_closed_coin)}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Closed %")}<span className={`font-mono text-[14px] ${profitColor(profit?.profit_closed_percent)}`}>{profit?.profit_closed_percent != null ? `${profit.profit_closed_percent >= 0 ? "+" : ""}${fmt(profit.profit_closed_percent, 2)}%` : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Incl. open")}<span className={`font-mono text-[14px] ${profitColor((profit?.profit_closed_coin ?? 0) + openPnl)}`}>{fmtMoney((profit?.profit_closed_coin ?? 0) + openPnl)}</span></div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Best Performer")}
                <div className="flex justify-between items-baseline">{lbl("Pair")}<span className="text-white font-mono font-bold text-[15px]">{profit?.best_pair ?? bestPerfPair?.pair ?? "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Profit")}<span className={`font-mono text-[14px] text-up`}>{profit?.best_pair_profit_abs != null ? fmtMoney(profit.best_pair_profit_abs) : (bestPerfPair != null ? fmtMoney(bestPerfPair.profit_abs) : (profit?.best_rate != null ? `+${fmt(profit.best_rate * 100, 2)}%` : "—"))}</span></div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Activity")}
                <div className="flex justify-between items-baseline">{lbl("Volume")}<span className="text-white/60 font-mono text-[14px]">{tradingVolume > 0 ? fmtVol(tradingVolume) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Avg hold")}<span className="text-white/60 font-mono text-[14px]">{avgHoldSec != null ? fmtDurSec(avgHoldSec) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Active since")}<span className="text-white/50 font-mono text-[12px]">{profit?.first_trade_date ? profit.first_trade_date.slice(0, 10) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Latest trade")}<span className="text-white/50 font-mono text-[12px]">{profit?.latest_trade_date ? profit.latest_trade_date.slice(0, 10) : "—"}</span></div>
              </div>
            </div>

            {/* Strategy Quality */}
            <div className="bg-surface p-3 l-bd rounded flex flex-col gap-3 flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Strategy Quality</div>
              <div className="flex flex-col gap-2">
                {secTitle("Edge")}
                <div className="flex justify-between items-baseline">{lbl("Profit Factor")}<span className={`font-mono font-bold text-[15px] ${(profitFactor ?? 0) > 1 ? "text-up" : "text-white"}`}>{profitFactor != null ? fmt(profitFactor, 2) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Expectancy")}<span className={`font-mono text-[14px] ${profitColor(expectancy)}`}>{expectancy != null ? fmtMoney(expectancy) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Expectancy Ratio")}<span className={`font-mono text-[14px] ${profitColor(expectancyRatio)}`}>{expectancyRatio != null ? fmt(expectancyRatio, 2) : "—"}</span></div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Risk-Adjusted Returns")}
                <div className="flex justify-between items-baseline">{lbl("Sharpe")}<span className={`font-mono font-bold text-[14px] ${(sharpeRatio ?? 0) > 0 ? "text-up" : "text-down"}`}>{sharpeRatio != null ? fmt(sharpeRatio, 2) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Sortino")}<span className={`font-mono font-bold text-[14px] ${(sortinoRatio ?? 0) > 0 ? "text-up" : "text-down"}`}>{sortinoRatio != null ? fmt(sortinoRatio, 2) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("SQN")}<span className={`font-mono font-bold text-[14px] ${(sqn ?? 0) > 1.6 ? "text-up" : "text-white"}`}>{sqn != null ? fmt(sqn, 2) : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Calmar")}<span className={`font-mono font-bold text-[14px] ${(calmarRatio ?? 0) > 0 ? "text-up" : "text-white"}`}>{calmarRatio != null ? fmt(calmarRatio, 2) : "—"}</span></div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Drawdown")}
                <div className="flex justify-between items-baseline">{lbl("Max %")}<span className={`font-mono font-bold text-[15px] ${maxDdPct != null && maxDdPct > 0 ? "text-down" : "text-white"}`}>{maxDdPct != null ? `-${fmt(maxDdPct, 2)}%` : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Max Abs")}<span className={`font-mono text-[14px] ${maxDdAbs != null && maxDdAbs > 0 ? "text-down" : "text-white"}`}>{maxDdAbs != null ? `-$${fmt(maxDdAbs, 2)}` : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Current")}<span className={`font-mono text-[14px] ${currentDdPct > 0 ? "text-down" : "text-up"}`}>{fmt(currentDdPct, 1)}%</span></div>
              </div>
            </div>

            {/* Trading Activity */}
            <div className="bg-surface p-3 l-bd rounded flex flex-col gap-3 flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Trading Activity</div>
              <div className="flex flex-col gap-2">
                {secTitle("Counts")}
                <div className="flex justify-between items-baseline">{lbl("Total")}<span className="text-white/60 font-mono font-bold text-[15px]">{profit?.trade_count ?? totalCount}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Closed")}<span className="text-white/60 font-mono text-[14px]">{closedCount}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Open")}<span className="text-white/60 font-mono text-[14px]">{openTrades.length}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Winners")}<span className="text-up font-mono font-bold text-[14px]">{winCount}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Losers")}<span className="text-down font-mono font-bold text-[14px]">{lossCount}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Win Rate")}<span className={`font-mono font-bold text-[15px] ${winRate != null && winRate >= 50 ? "text-up" : "text-white"}`}>{winRate != null ? `${fmt(winRate, 1)}%` : "—"}</span></div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Exit Reasons")}
                {Object.keys(exitReasons).length > 0
                  ? Object.entries(exitReasons).map(([reason, data]) => (
                    <div key={reason} className="flex justify-between items-baseline">
                      {lbl(reason)}
                      <span className="font-mono text-[14px]">
                        <span className="text-up font-bold">{data.wins}W</span>
                        <span className="text-white/20 mx-1">·</span>
                        <span className={data.losses > 0 ? "text-down font-bold" : "text-white/35"}>{data.losses}L</span>
                      </span>
                    </div>
                  ))
                  : <span className="text-white/25 text-[11px]">—</span>
                }
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Durations")}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div>
                    <div className="text-[10px] text-white/30 font-mono">Avg win</div>
                    <div className={`font-mono font-bold text-[14px] ${statsData?.durations?.wins != null ? "text-up" : "text-white/40"}`}>{statsData?.durations?.wins != null ? fmtDurSec(statsData.durations.wins) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 font-mono">Avg loss</div>
                    <div className={`font-mono font-bold text-[14px] ${statsData?.durations?.losses != null ? "text-down" : "text-white/40"}`}>{statsData?.durations?.losses != null ? fmtDurSec(statsData.durations.losses) : "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW B: Account Balance · Bot Setup ──────────────────── */}
          <div className="flex gap-2.5">
            {/* Account Balance */}
            <div className="bg-surface p-3 l-bd rounded flex flex-col gap-3 flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Account Balance</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex flex-col gap-2">
                  {secTitle(stakeCurrency)}
                  <div><div className="text-[10px] text-white/30 font-mono">Available</div><div className="text-white/60 font-mono font-bold text-[14px]">{stakeBalance != null ? fmt(stakeBalance.free, 2) : "—"}</div></div>
                  <div><div className="text-[10px] text-white/30 font-mono">In open trades</div><div className="text-white/60 font-mono text-[14px]">{fmt(openStake, 2)}</div></div>
                  <div><div className="text-[10px] text-white/30 font-mono">Total</div><div className="text-white/60 font-mono font-bold text-[16px]">{stakeBalance != null ? fmt(stakeBalance.balance, 2) : "—"}</div></div>
                </div>
                {otherCurrencies.slice(0, 1).map(c => (
                  <div key={c.currency} className="flex flex-col gap-2">
                    {secTitle(c.currency)}
                    <div><div className="text-[10px] text-white/30 font-mono">Holdings</div><div className="text-white/60 font-mono font-bold text-[14px]">{fmt(c.balance, c.balance < 1 ? 4 : 2)}</div></div>
                    {c.est_stake > 0 && <div><div className="text-[10px] text-white/30 font-mono">Est. value</div><div className="text-white/60 font-mono text-[14px]">{fmt(c.est_stake, 2)} {stakeCurrency}</div></div>}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Summary")}
                <div className="flex justify-between items-baseline">{lbl("Bot total")}<span className="text-white/60 font-mono font-bold text-[15px]">{balanceData?.total != null ? `$${fmt(balanceData.total, 2)}` : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Starting capital")}<span className="text-white/50 font-mono text-[14px]">{balanceData?.starting_capital != null ? `$${fmt(balanceData.starting_capital, 0)}` : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Growth vs start")}
                  {balanceData?.starting_capital_ratio != null
                    ? <span className={`font-mono font-bold text-[15px] ${profitColor(balanceData.starting_capital_ratio)}`}>{balanceData.starting_capital_ratio >= 0 ? "+" : ""}{fmt(balanceData.starting_capital_ratio * 100, 2)}%</span>
                    : <span className="text-white/40 font-mono text-[14px]">—</span>
                  }
                </div>
              </div>
            </div>

            {/* Bot Setup */}
            <div className="bg-surface p-3 l-bd rounded flex flex-col gap-3 flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Bot Setup</div>
              <div className="flex flex-col gap-2">
                {secTitle("Trading")}
                <div className="flex justify-between items-baseline">{lbl("Exchange")}<span className="text-white/60 font-mono font-bold text-[14px]">{bot.exchange_name ?? (configData?.exchange != null ? (typeof configData.exchange === "string" ? configData.exchange : configData.exchange.name) : null) ?? "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Timeframe")}<span className="text-white/60 font-mono font-bold text-[14px]">{configData?.timeframe ?? "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Mode")}<span className="text-white/60 font-mono font-bold text-[14px]">{configData ? `${configData.trading_mode ?? "spot"} / ${configData.margin_mode ?? "—"}` : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Paper trading")}<span className={`font-mono font-bold text-[14px] ${configData?.dry_run ? "text-up" : "text-down"}`}>{configData != null ? (configData.dry_run ? "Yes" : "No") : "—"}</span></div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-2.5">
                {secTitle("Risk")}
                <div className="flex justify-between items-baseline">{lbl("Stake per trade")}<span className="text-white/60 font-mono font-bold text-[14px]">{stakeAmountDisplay}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Stop Loss")}<span className="text-down font-mono font-bold text-[14px]">{configData?.stoploss != null ? `${fmt(configData.stoploss * 100, 0)}%` : "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Max open trades")}<span className="text-white/60 font-mono font-bold text-[14px]">{configData?.max_open_trades ?? "—"}</span></div>
                <div className="flex justify-between items-baseline">{lbl("Open positions")}<span className="text-white/60 font-mono font-bold text-[14px]">{openTrades.length} / {configData?.max_open_trades ?? "∞"}</span></div>
              </div>
              <div className="flex justify-between items-baseline border-t border-white/[0.07] pt-2.5">
                {lbl("Total committed")}
                <span className="text-white/60 font-mono font-bold text-[15px]">${fmt(openStake, 2)}</span>
              </div>
            </div>
          </div>
        </>
      );
    }

    /* ─── Trades ─── */
    case "trades": {
      return (
        <>
          {/* Open Trades */}
          <div>
            <h3 className="section-title mb-2 flex items-center gap-2">Open Positions <span className="text-white/30">({openTrades.length})</span></h3>
            {openTrades.length === 0 ? (
              <div className="text-center py-6 text-muted text-xs">No open trades</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] font-mono"><thead className="text-muted text-[13px] uppercase tracking-widest">
                    <tr>
                      <SH label="Pair" tbl="open" col="pair" />
                      <SH label="Side" tbl="open" col="is_short" align="center" />
                      <SH label="Leverage" tbl="open" col="leverage" align="right" />
                      <SH label="Entry" tbl="open" col="open_rate" align="right" />
                      <SH label="Current" tbl="open" col="current_rate" align="right" />
                      <SH label="Stake" tbl="open" col="stake_amount" align="right" />
                      <SH label="P&L" tbl="open" col="profit_abs" align="right" />
                      <SH label="P&L %" tbl="open" col="profit_ratio" align="right" />
                      <SH label="Duration" tbl="open" col="open_date" align="right" />
                      <SH label="Enter Tag" tbl="open" col="enter_tag" />
                      <SH label="SL" tbl="open" col="stop_loss_pct" align="right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {sortData(openTrades, "open").map((t) => {
                      const pnl = t.current_profit_abs ?? t.profit_abs ?? null;
                      const pct = (t.current_profit ?? t.profit_ratio) != null ? (t.current_profit ?? t.profit_ratio)! * 100 : null;
                      const ms = Date.now() - new Date(t.open_date).getTime();
                      const durH = Math.floor(ms / 3600000);
                      const durM = Math.floor((ms % 3600000) / 60000);
                      const durStr = durH > 0 ? `${durH}h${durM.toString().padStart(2, "0")}m` : `${durM}m`;
                      const slPct = t.stop_loss_pct != null ? t.stop_loss_pct : null;
                      const exiting = exitingIds.has(t.trade_id);
                      const hasOpenOrder = t.orders?.some((o) => o.status === "open") ?? false;
                      const btn = "p-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
                      return (
                        <tr key={t.trade_id} className="hover:bg-white/[0.04] group relative">
                          <td className="py-1.5 px-1 text-white font-medium">{t.pair}</td>
                          <td className="py-1.5 px-1"><span className={`${t.is_short ? "bg-down/12 text-down" : "bg-up/12 text-up"} px-1 py-0.5 rounded text-[9px] font-bold`}>{t.is_short ? "SHORT" : "LONG"}</span></td>
                          <td className="py-1.5 px-1 text-right">{t.leverage > 1 ? `${t.leverage}x` : "1x"}</td>
                          <td className="py-1.5 px-1 text-right">{fmt(t.open_rate, t.open_rate < 1 ? 4 : 0)}</td>
                          <td className="py-1.5 px-1 text-right font-medium">{fmt(t.current_rate, t.current_rate < 1 ? 4 : 0)}</td>
                          <td className="py-1.5 px-1 text-right">{fmt(t.stake_amount, 0)}</td>
                          <td className={`py-1.5 px-1 text-right font-bold ${profitColor(pnl)}`}>{pnl != null ? fmtMoney(pnl) : "—"}</td>
                          <td className={`py-1.5 px-1 text-right ${profitColor(pct)}`}>{pct != null ? `${pct >= 0 ? "+" : ""}${fmt(pct, 2)}%` : "—"}</td>
                          <td className="py-1.5 px-1 text-right text-muted">{durStr}</td>
                          <td className="py-1.5 px-1 text-muted">{t.enter_tag ?? "—"}</td>
                          <td className="py-1.5 px-1 text-right text-down">{slPct != null ? `${fmt(slPct, 0)}%` : "—"}</td>
                          {/* Hover action overlay — floats over row right edge, no table-width impact */}
                          <td className="w-0 p-0 relative">
                            <div
                              className="absolute right-0 top-0 bottom-0 z-10 hidden group-hover:flex items-center gap-0.5 pr-2 pl-8"
                              style={{ background: "linear-gradient(to right, transparent, #0C0C0C 28px)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button title="Force Exit (Market)" disabled={exiting} onClick={() => handleForceExit(t, "market")} className={`${btn} text-down hover:bg-down/15`}><Zap className="w-3.5 h-3.5" /></button>
                              <button title="Force Exit (Limit)" disabled={exiting} onClick={() => handleForceExit(t, "limit")} className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}><LogOut className="w-3.5 h-3.5" /></button>
                              <button title="Force Exit (Partial)" disabled={exiting} onClick={() => handleForceExit(t, "partial")} className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}><Scissors className="w-3.5 h-3.5" /></button>
                              <button title="Increase Position" disabled={exiting} onClick={() => handleForceEnter(t)} className={`${btn} text-muted hover:text-up hover:bg-up/10`}><PlusCircle className="w-3.5 h-3.5" /></button>
                              <button title="Reload Trade" disabled={exiting} onClick={() => handleReloadTrade(t)} className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}><RefreshCw className="w-3.5 h-3.5" /></button>
                              {hasOpenOrder && <button title="Cancel Open Order" disabled={exiting} onClick={() => handleCancelOrder(t)} className={`${btn} text-muted hover:text-white hover:bg-white/[0.08]`}><Ban className="w-3.5 h-3.5" /></button>}
                              <button title="Delete Trade" disabled={exiting} onClick={() => handleDeleteTrade(t)} className={`${btn} text-down/50 hover:text-down hover:bg-down/10`}><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
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
            <h3 className="section-title mb-2 flex items-center gap-2">Closed Trades <span className="text-white/30">(last 10)</span></h3>
            {closedTrades.length === 0 ? (
              <div className="text-center py-6 text-muted text-xs">No closed trades</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] font-mono"><thead className="text-muted text-[13px] uppercase tracking-widest">
                    <tr>
                      <SH label="Pair" tbl="closed" col="pair" />
                      <SH label="Side" tbl="closed" col="is_short" align="center" />
                      <SH label="Lev" tbl="closed" col="leverage" align="right" />
                      <SH label="Entry" tbl="closed" col="open_rate" align="right" />
                      <SH label="Exit" tbl="closed" col="close_rate" align="right" />
                      <SH label="Stake" tbl="closed" col="stake_amount" align="right" />
                      <SH label="P&L" tbl="closed" col="close_profit_abs" align="right" />
                      <SH label="P&L %" tbl="closed" col="close_profit" align="right" />
                      <SH label="Duration" tbl="closed" col="trade_duration" align="right" />
                      <SH label="Enter Tag" tbl="closed" col="enter_tag" />
                      <SH label="Exit Reason" tbl="closed" col="exit_reason" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {sortData(closedTrades.slice(0, 10), "closed").map((t) => {
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
        </>
      );
    }

    /* ─── Performance ─── */
    case "performance": {
      // Derive wins/losses/avgProfit/avgDur from closed trades for enriched performance data
      const enrichedPerf = perfData.map((p) => {
        const pairClosed = closedTrades.filter((t) => t.pair === p.pair);
        const wins = pairClosed.filter((t) => (t.close_profit_abs ?? 0) >= 0).length;
        const losses = pairClosed.filter((t) => (t.close_profit_abs ?? 0) < 0).length;
        const winrate = pairClosed.length > 0 ? wins / pairClosed.length : 0;
        const avgProfit = pairClosed.length > 0 ? pairClosed.reduce((s, t) => s + ((t.close_profit ?? 0) * 100), 0) / pairClosed.length : 0;
        const avgDurMs = pairClosed.length > 0 ? pairClosed.reduce((s, t) => s + (t.close_date ? new Date(t.close_date).getTime() - new Date(t.open_date).getTime() : 0), 0) / pairClosed.length : 0;
        return { ...p, wins, losses, winrate, avgProfit, avgDurMs };
      });
      // Derive best/worst pair, best tag, best exit for KPI summary
      const bestPerf = enrichedPerf.length > 0 ? enrichedPerf.reduce((best, p) => p.profit_abs > best.profit_abs ? p : best, enrichedPerf[0]) : null;
      const worstPerf = enrichedPerf.length > 0 ? enrichedPerf.reduce((worst, p) => p.profit_abs < worst.profit_abs ? p : worst, enrichedPerf[0]) : null;
      const bestEntry = entryData.length > 0 ? entryData.reduce((best, e) => (e.profit_abs ?? 0) > (best.profit_abs ?? 0) ? e : best, entryData[0]) : null;
      const bestExit = exitData.length > 0 ? exitData.reduce((best, e) => (e.profit_abs ?? 0) > (best.profit_abs ?? 0) ? e : best, exitData[0]) : null;

      // Helper: compute per-tag enrichment from closed trades
      const enrichEntry = (e: FTEntry) => {
        const tagTrades = closedTrades.filter(t => t.enter_tag === e.enter_tag);
        const avgDurMs = tagTrades.length > 0 ? tagTrades.reduce((s, t) => s + (t.close_date ? new Date(t.close_date).getTime() - new Date(t.open_date).getTime() : 0), 0) / tagTrades.length : 0;
        const bestPairMap = new Map<string, number>();
        tagTrades.forEach(t => bestPairMap.set(t.pair, (bestPairMap.get(t.pair) ?? 0) + (t.close_profit_abs ?? 0)));
        let bestPair = "—"; let bestPairPnl = -Infinity;
        bestPairMap.forEach((v, k) => { if (v > bestPairPnl) { bestPairPnl = v; bestPair = k; } });
        const expectancy = (e.entries ?? 0) > 0 ? (e.profit_abs ?? 0) / (e.entries ?? 1) : 0;
        return { avgDurMs, bestPair, expectancy };
      };
      const enrichExit = (e: FTExit) => {
        const reasonTrades = closedTrades.filter(t => t.exit_reason === e.exit_reason);
        const avgDurMs = reasonTrades.length > 0 ? reasonTrades.reduce((s, t) => s + (t.close_date ? new Date(t.close_date).getTime() - new Date(t.open_date).getTime() : 0), 0) / reasonTrades.length : 0;
        const bestPairMap = new Map<string, number>();
        reasonTrades.forEach(t => bestPairMap.set(t.pair, (bestPairMap.get(t.pair) ?? 0) + (t.close_profit_abs ?? 0)));
        let bestPair = "—"; let bestPairPnl = -Infinity;
        bestPairMap.forEach((v, k) => { if (v > bestPairPnl) { bestPairPnl = v; bestPair = k; } });
        const expectancy = (e.exits ?? 0) > 0 ? (e.profit_abs ?? 0) / (e.exits ?? 1) : 0;
        return { avgDurMs, bestPair, expectancy };
      };
      const fmtDurMs = (ms: number) => {
        const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
        if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
        return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
      };

      return (
        <>
          {/* KPI Summary — 4 columns matching HTML prototype line 660-665 */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="bg-surface p-3 l-bd rounded text-center"><div className="kpi-label">Best Pair</div><div className={`font-mono font-bold text-sm ${profitColor(bestPerf?.profit_abs)}`}>{bestPerf?.pair ?? "—"}</div>{bestPerf && <div className={`text-[10px] font-mono ${profitColor(bestPerf.profit_abs)}`}>{fmtMoney(bestPerf.profit_abs)}</div>}</div>
            <div className="bg-surface p-3 l-bd rounded text-center"><div className="kpi-label">Worst Pair</div><div className={`font-mono font-bold text-sm ${profitColor(worstPerf?.profit_abs)}`}>{worstPerf?.pair ?? "—"}</div>{worstPerf && <div className={`text-[10px] font-mono ${profitColor(worstPerf.profit_abs)}`}>{fmtMoney(worstPerf.profit_abs)}</div>}</div>
            <div className="bg-surface p-3 l-bd rounded text-center"><div className="kpi-label">Best Tag</div><div className={`font-mono font-bold text-sm ${profitColor(bestEntry?.profit_abs)}`}>{bestEntry?.enter_tag ?? "—"}</div>{bestEntry && <div className={`text-[10px] font-mono ${profitColor(bestEntry.profit_abs)}`}>{fmtMoney(bestEntry.profit_abs)}</div>}</div>
            <div className="bg-surface p-3 l-bd rounded text-center"><div className="kpi-label">Best Exit</div><div className={`font-mono font-bold text-sm ${profitColor(bestExit?.profit_abs)}`}>{bestExit?.exit_reason ?? "—"}</div>{bestExit && <div className={`text-[10px] font-mono ${profitColor(bestExit.profit_abs)}`}>{fmtMoney(bestExit.profit_abs)}</div>}</div>
          </div>

          {/* Per-Pair Performance — 7 columns matching HTML prototype line 669-676 */}
          {enrichedPerf.length > 0 ? (
            <div className="bg-surface l-bd rounded p-3">
              <h3 className="section-title mb-2">Per-Pair Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] font-mono whitespace-nowrap">
                  <thead><tr className="text-muted text-[11px] uppercase tracking-widest">
                    <SH label="Pair" tbl="perf" col="pair" />
                    <SH label="Trades" tbl="perf" col="count" align="right" />
                    <SH label="Profit $" tbl="perf" col="profit_abs" align="right" />
                    <SH label="Profit %" tbl="perf" col="profit_ratio" align="right" />
                    <SH label="Win Rate" tbl="perf" col="winrate" align="right" />
                    <SH label="Avg Profit" tbl="perf" col="avgProfit" align="right" />
                    <SH label="Avg Dur." tbl="perf" col="avgDurMs" align="right" />
                  </tr></thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {sortData(enrichedPerf, "perf").map((p) => (
                      <tr key={p.pair} className="hover:bg-white/[0.04]">
                        <td className="px-2 py-1.5 text-white">{p.pair}</td>
                        <td className="px-2 py-1.5 text-right">{p.count ?? p.trades ?? 0}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${profitColor(p.profit_abs)}`}>{fmtMoney(p.profit_abs)}</td>
                        <td className={`px-2 py-1.5 text-right ${profitColor(p.profit_ratio)}`}>{p.profit_ratio >= 0 ? "+" : ""}{fmt(p.profit_ratio * 100, 2)}%</td>
                        <td className={`px-2 py-1.5 text-right ${p.winrate >= 0.6 ? "text-up" : p.winrate < 0.45 ? "text-down" : "text-white"}`}>{fmt(p.winrate * 100, 1)}%</td>
                        <td className={`px-2 py-1.5 text-right ${profitColor(p.avgProfit)}`}>{p.avgProfit >= 0 ? "+" : ""}{fmt(p.avgProfit, 2)}%</td>
                        <td className="px-2 py-1.5 text-right text-muted">{fmtDurMs(p.avgDurMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted text-xs">No performance data</div>
          )}

          {/* Entry / Exit Analysis — stacked vertically for full-width tables */}
          {(entryData.length > 0 || exitData.length > 0) && (
            <div className="flex flex-col gap-2.5">
              {entryData.length > 0 && (
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className="section-title mb-2">Entry Tags</h3>
                  <div className="overflow-x-auto">
                  <table className="w-full text-[13px] font-mono whitespace-nowrap">
                    <thead><tr className="text-muted text-[11px] uppercase tracking-widest">
                      <SH label="Tag" tbl="entry" col="enter_tag" />
                      <SH label="Trades" tbl="entry" col="entries" align="right" />
                      <SH label="Wins" tbl="entry" col="wins" align="right" />
                      <SH label="Losses" tbl="entry" col="losses" align="right" />
                      <SH label="Win Rate" tbl="entry" col="winrate" align="right" />
                      <SH label="Avg P&L %" tbl="entry" col="avg_profit" align="right" />
                      <SH label="Total P&L" tbl="entry" col="profit_abs" align="right" />
                      <th className="text-right px-2 py-1.5 font-semibold">Avg Dur.</th>
                      <th className="text-left px-2 py-1.5 font-semibold">Best Pair</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Expectancy</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {sortData(entryData, "entry").map((e) => {
                        const ex = enrichEntry(e);
                        return (
                          <tr key={e.enter_tag ?? "untagged"} className="hover:bg-white/[0.04]">
                            <td className="px-2 py-1.5"><span className="px-1.5 py-0.5 bg-blue-500/[0.12] text-blue-400 rounded text-[9px]">{e.enter_tag ?? "untagged"}</span></td>
                            <td className="px-2 py-1.5 text-right">{e.entries ?? 0}</td>
                            <td className="px-2 py-1.5 text-right text-up">{e.wins ?? 0}</td>
                            <td className="px-2 py-1.5 text-right text-down">{e.losses ?? 0}</td>
                            <td className={`px-2 py-1.5 text-right ${(e.winrate ?? 0) >= 0.6 ? "text-up" : (e.winrate ?? 0) < 0.45 ? "text-down" : "text-white"}`}>{fmt((e.winrate ?? 0) * 100, 1)}%</td>
                            <td className={`px-2 py-1.5 text-right ${profitColor(e.avg_profit)}`}>{(e.avg_profit ?? 0) >= 0 ? "+" : ""}{fmt(e.avg_profit ?? 0, 2)}%</td>
                            <td className={`px-2 py-1.5 text-right font-bold ${profitColor(e.profit_abs)}`}>{fmtMoney(e.profit_abs ?? 0)}</td>
                            <td className="px-2 py-1.5 text-right text-muted">{fmtDurMs(ex.avgDurMs)}</td>
                            <td className="px-2 py-1.5 text-white">{ex.bestPair}</td>
                            <td className={`px-2 py-1.5 text-right ${profitColor(ex.expectancy)}`}>{fmtMoney(ex.expectancy)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
              {exitData.length > 0 && (
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className="section-title mb-2">Exit Reasons</h3>
                  <div className="overflow-x-auto">
                  <table className="w-full text-[13px] font-mono whitespace-nowrap">
                    <thead><tr className="text-muted text-[11px] uppercase tracking-widest">
                      <SH label="Reason" tbl="exit" col="exit_reason" />
                      <SH label="Exits" tbl="exit" col="exits" align="right" />
                      <SH label="Wins" tbl="exit" col="wins" align="right" />
                      <SH label="Losses" tbl="exit" col="losses" align="right" />
                      <SH label="Win Rate" tbl="exit" col="winrate" align="right" />
                      <SH label="Avg P&L %" tbl="exit" col="avg_profit" align="right" />
                      <SH label="Total P&L" tbl="exit" col="profit_abs" align="right" />
                      <th className="text-right px-2 py-1.5 font-semibold">Avg Dur.</th>
                      <th className="text-left px-2 py-1.5 font-semibold">Best Pair</th>
                      <th className="text-right px-2 py-1.5 font-semibold">Expectancy</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {sortData(exitData, "exit").map((e) => {
                        const ex = enrichExit(e);
                        return (
                          <tr key={e.exit_reason ?? "untagged"} className="hover:bg-white/[0.04]">
                            <td className="px-2 py-1.5 text-white">{e.exit_reason ?? "untagged"}</td>
                            <td className="px-2 py-1.5 text-right">{e.exits ?? 0}</td>
                            <td className="px-2 py-1.5 text-right text-up">{e.wins ?? 0}</td>
                            <td className="px-2 py-1.5 text-right text-down">{e.losses ?? 0}</td>
                            <td className={`px-2 py-1.5 text-right ${(e.winrate ?? 0) >= 0.6 ? "text-up" : (e.winrate ?? 0) < 0.45 ? "text-down" : "text-white"}`}>{fmt((e.winrate ?? 0) * 100, 1)}%</td>
                            <td className={`px-2 py-1.5 text-right ${profitColor(e.avg_profit)}`}>{(e.avg_profit ?? 0) >= 0 ? "+" : ""}{fmt(e.avg_profit ?? 0, 2)}%</td>
                            <td className={`px-2 py-1.5 text-right font-bold ${profitColor(e.profit_abs)}`}>{fmtMoney(e.profit_abs ?? 0)}</td>
                            <td className="px-2 py-1.5 text-right text-muted">{fmtDurMs(ex.avgDurMs)}</td>
                            <td className="px-2 py-1.5 text-white">{ex.bestPair}</td>
                            <td className={`px-2 py-1.5 text-right ${profitColor(ex.expectancy)}`}>{fmtMoney(ex.expectancy)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      );
    }

    /* ─── Config ─── */
    case "config": {
      // Helper for inline edit fields
      const EditRow = ({ label, field, type = "text", suffix }: { label: string; field: string; type?: string; suffix?: string }) => (
        <div className="flex justify-between items-center">
          <span className="text-muted">{label}</span>
          <div className="flex items-center gap-1">
            <input
              type={type}
              value={String(editValues[field] ?? "")}
              onChange={(e) => onEditChange(field, type === "number" ? Number(e.target.value) : e.target.value)}
              className="bg-white/[0.06] border border-white/10 rounded px-2 py-0.5 text-white text-[12px] font-mono w-24 text-right focus:border-cyan-500/50 outline-none"
            />
            {suffix && <span className="text-muted text-[10px]">{suffix}</span>}
          </div>
        </div>
      );
      const ToggleRow = ({ label, field }: { label: string; field: string }) => (
        <div className="flex justify-between items-center">
          <span className="text-muted">{label}</span>
          <button
            type="button"
            onClick={() => onEditChange(field, !editValues[field])}
            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${editValues[field] ? "bg-up/15 text-up" : "bg-white/10 text-muted"}`}
          >{editValues[field] ? "Yes" : "No"}</button>
        </div>
      );

      return (
        <div className="flex flex-col gap-4">
          {configData ? (
            <>
              {/* 2-column grid: Core Config + Risk Management — matching HTML line 707-731 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className="section-title mb-2 flex items-center justify-between">Core Config
                    {editingSection === "core" ? (
                      <div className="flex gap-1">
                        <button onClick={onSaveApply} disabled={savingConfig} className="text-[9px] text-up hover:text-white bg-up/15 px-1.5 py-0.5 rounded transition-colors cursor-pointer font-bold">{savingConfig ? "Saving..." : "Save & Apply"}</button>
                        <button onClick={onEditCancel} className="text-[9px] text-muted hover:text-white l-bd px-1.5 py-0.5 rounded transition-colors cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => onEditStart("core")} className="text-[9px] text-muted hover:text-white l-bd px-1.5 py-0.5 rounded transition-colors cursor-pointer" title="Edit core config">EDIT</button>
                    )}
                  </h3>
                  <div className="space-y-1.5 font-mono text-[12px]">
                    <div className="flex justify-between"><span className="text-muted">Strategy</span><span className="text-white">{configData.strategy ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Exchange</span><span className="text-white">{typeof configData.exchange === "string" ? configData.exchange : "—"}</span></div>
                    {editingSection === "core" ? (
                      <>
                        <EditRow label="Timeframe" field="timeframe" />
                        <div className="flex justify-between"><span className="text-muted">Mode</span><span className="text-white">{configData.trading_mode ? `${configData.trading_mode} · ${configData.margin_mode ?? "—"}` : "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Stake Currency</span><span className="text-white">{configData.stake_currency ?? "—"}</span></div>
                        <EditRow label="Stake Amount" field="stake_amount" type="number" />
                        <EditRow label="Max Open Trades" field="max_open_trades" type="number" />
                        <div className="flex justify-between"><span className="text-muted">Dry Run</span><span className="text-white">{configData.dry_run ? "Yes" : "No"}</span></div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between"><span className="text-muted">Timeframe</span><span className="text-white">{configData.timeframe ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Mode</span><span className="text-white">{configData.trading_mode ? `${configData.trading_mode} · ${configData.margin_mode ?? "—"}` : "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Stake Currency</span><span className="text-white">{configData.stake_currency ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Stake Amount</span><span className="text-white">{fmt(typeof configData.stake_amount === "number" ? configData.stake_amount : 0, 2)}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Max Open Trades</span><span className="text-white">{configData.max_open_trades ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Dry Run</span><span className="text-white">{configData.dry_run ? "Yes" : "No"}</span></div>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className="section-title mb-2 flex items-center justify-between">Risk Management
                    {editingSection === "risk" ? (
                      <div className="flex gap-1">
                        <button onClick={onSaveApply} disabled={savingConfig} className="text-[9px] text-up hover:text-white bg-up/15 px-1.5 py-0.5 rounded transition-colors cursor-pointer font-bold">{savingConfig ? "Saving..." : "Save & Apply"}</button>
                        <button onClick={onEditCancel} className="text-[9px] text-muted hover:text-white l-bd px-1.5 py-0.5 rounded transition-colors cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => onEditStart("risk")} className="text-[9px] text-muted hover:text-white l-bd px-1.5 py-0.5 rounded transition-colors cursor-pointer" title="Edit risk settings">EDIT</button>
                    )}
                  </h3>
                  <div className="space-y-1.5 font-mono text-[12px]">
                    {editingSection === "risk" ? (
                      <>
                        <EditRow label="Stoploss" field="stoploss" type="number" suffix="%" />
                        <ToggleRow label="Trailing Stop" field="trailing_stop" />
                        <EditRow label="Trailing Positive" field="trailing_stop_positive" type="number" />
                        <EditRow label="Trailing Offset" field="trailing_stop_positive_offset" type="number" />
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between"><span className="text-muted">Stoploss</span><span className="text-down font-bold">{configData.stoploss != null ? `${fmt(configData.stoploss * 100, 1)}%` : "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Trailing Stop</span><span className={configData.trailing_stop ? "text-up" : "text-white"}>{configData.trailing_stop ? "Yes" : "No"}</span></div>
                        {configData.trailing_stop_positive != null && (
                          <div className="flex justify-between"><span className="text-muted">Trailing Positive</span><span className="text-white">{configData.trailing_stop_positive}</span></div>
                        )}
                        {configData.trailing_stop_positive_offset != null && (
                          <div className="flex justify-between"><span className="text-muted">Trailing Offset</span><span className="text-white">{configData.trailing_stop_positive_offset}</span></div>
                        )}
                      </>
                    )}
                    {configData.minimal_roi && (
                      <div className="flex justify-between"><span className="text-muted">minimal_roi</span><span className="text-white font-mono text-[10px]">{JSON.stringify(configData.minimal_roi)}</span></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Whitelist — card-wrapped with EDIT button, matching HTML line 733-746 */}
              {configData.pair_whitelist && configData.pair_whitelist.length > 0 && (
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className="section-title mb-2 flex items-center justify-between">Whitelist <span className="text-white/30 font-normal text-[10px]">{configData.pair_whitelist.length} pairs</span> <button className="text-[9px] text-muted hover:text-white l-bd px-1.5 py-0.5 rounded transition-colors ml-auto cursor-pointer" title="Edit whitelist">EDIT</button></h3>
                  <div className="flex flex-wrap gap-1.5">
                    {configData.pair_whitelist.map((p) => (
                      <span key={p} className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/[0.08] text-cyan-400 border border-cyan-500/20 font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Locks — with Until countdown column, matching HTML line 748-754 */}
              {locksData && locksData.locks && locksData.locks.length > 0 && (
                <div className="bg-surface l-bd rounded p-3">
                  <h3 className="section-title mb-2">Active Locks</h3>
                  <table className="w-full text-[13px] font-mono"><thead className="text-muted text-[11px] uppercase tracking-widest"><tr>
                    <th className="text-left py-1 font-semibold">Pair</th>
                    <th className="text-left py-1 font-semibold">Reason</th>
                    <th className="text-right py-1 font-semibold">Until</th>
                  </tr></thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {locksData.locks.filter(l => l.active).map((l) => {
                      const until = l.lock_end_time ? new Date(l.lock_end_time) : null;
                      const remaining = until ? Math.max(0, Math.round((until.getTime() - Date.now()) / 60000)) : null;
                      return (
                        <tr key={l.id}>
                          <td className="py-1.5 text-white font-medium">{l.pair}</td>
                          <td className="py-1.5 text-muted">{l.reason ?? "—"}</td>
                          <td className="py-1.5 text-right text-down">{remaining != null ? `${remaining}m left` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody></table>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-muted text-xs">No config data</div>
          )}
        </div>
      );
    }

    /* ─── System & Log — matching HTML line 988-1038 ─── */
    case "system": {
      const cpuAvg = sysinfoData && sysinfoData.cpu_pct.length > 0 ? sysinfoData.cpu_pct.reduce((a, b) => a + b, 0) / sysinfoData.cpu_pct.length : 0;
      const ramPct = sysinfoData?.ram_pct ?? 0;
      const cpuColor = cpuAvg > 80 ? "bg-down" : cpuAvg > 60 ? "bg-yellow-400" : "bg-white/70";
      const ramColor = ramPct > 80 ? "bg-yellow-400" : ramPct > 60 ? "bg-yellow-400" : "bg-white/70";
      const cpuTextColor = cpuAvg > 80 ? "text-down" : cpuAvg > 60 ? "text-yellow-400" : "text-white";
      const ramTextColor = ramPct > 80 ? "text-yellow-400" : ramPct > 60 ? "text-yellow-400" : "text-white";
      const lastProcessAgo = healthData?.last_process ? (() => { const diff = (Date.now() - new Date(healthData.last_process).getTime()) / 1000; return isNaN(diff) ? healthData.last_process : `${diff.toFixed(1)}s ago`; })() : "—";

      return (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* System Status — 2-col grid matching HTML line 991-1008 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-surface l-bd rounded p-3">
              <div className="kpi-label mb-2">System Resources</div>
              <div className="space-y-2.5">
                {sysinfoData && (<>
                  <div>
                    <div className="flex justify-between text-[11px] font-mono mb-1"><span className="text-muted">CPU</span><span className={`${cpuTextColor} font-medium`}>{fmt(cpuAvg, 0)}%</span></div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><div className={`h-full ${cpuColor} rounded-full`} style={{ width: `${Math.min(cpuAvg, 100)}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-mono mb-1"><span className="text-muted">RAM</span><span className={`${ramTextColor} font-medium`}>{fmt(ramPct, 0)}%</span></div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><div className={`h-full ${ramColor} rounded-full`} style={{ width: `${Math.min(ramPct, 100)}%` }} /></div>
                  </div>
                </>)}
              </div>
            </div>
            <div className="bg-surface l-bd rounded p-3">
              <div className="kpi-label mb-2">Bot Health</div>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between"><span className="text-muted">Last Process</span><span className="text-white">{lastProcessAgo}</span></div>
                {healthData?.last_process_loc && <div className="flex justify-between"><span className="text-muted">Location</span><span className="text-white">{healthData.last_process_loc}</span></div>}
                {bot.status && <div className="flex justify-between"><span className="text-muted">State</span><span className="text-up font-bold">{bot.status}</span></div>}
                {configData?.version && <div className="flex justify-between"><span className="text-muted">FT Version</span><span className="text-white">{configData.version}</span></div>}
              </div>
            </div>
          </div>
          {/* Log Section — matching HTML line 1010-1037 */}
          {logsData && logsData.logs && logsData.logs.length > 0 && (
            <div className="flex-1 bg-surface l-bd rounded flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
                <div className="flex gap-1">
                  <button className="px-2 py-0.5 text-[9px] font-bold uppercase bg-white/10 text-white rounded">ALL</button>
                  <button className="px-2 py-0.5 text-[9px] font-bold uppercase text-muted hover:text-white transition-colors rounded">INFO</button>
                  <button className="px-2 py-0.5 text-[9px] font-bold uppercase text-muted hover:text-white transition-colors rounded">WARN</button>
                  <button className="px-2 py-0.5 text-[9px] font-bold uppercase text-muted hover:text-white transition-colors rounded">ERROR</button>
                </div>
                <div className="ml-auto text-[10px] font-mono text-muted">{logsData.log_count} entries</div>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] text-muted bg-[#060606] p-3 leading-relaxed max-h-[400px]">
                {logsData.logs.slice(-50).map((log, idx) => {
                  const arr = log as string[];
                  let timestamp: string, level: string, message: string;
                  if (arr.length >= 5) { [, timestamp, , level, message] = arr; }
                  else if (arr.length === 4) { [timestamp, , level, message] = arr; }
                  else { timestamp = ""; level = ""; message = arr.join(" "); }
                  const timeStr = timestamp ? String(timestamp).split(" ").pop()?.slice(0, 8) ?? "" : "";
                  const levelColor = level === "WARNING" || level === "WARN" ? "text-yellow-500" : level === "ERROR" || level === "CRITICAL" ? "text-down" : level === "INFO" ? "text-blue-400" : "text-white/25";
                  return (
                    <div key={idx} className="mb-1"><span className="text-white/30 mr-2">{timeStr}</span><span className={levelColor}>{level}</span> {message ?? ""}</div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    /* ─── Backtest — real API history matching HTML line 757-843 ─── */
    case "backtest": {
      return (
        <div className="flex flex-col gap-4">
          <h3 className="section-title flex items-center gap-2">Backtest History <span className="text-white/30">({configData?.strategy ?? bot.name})</span></h3>
          {backtestLoading ? (
            <div className="text-center py-8 text-muted text-xs animate-pulse">Loading backtest history...</div>
          ) : backtestHistory.length === 0 ? null : (
            <div className="space-y-3">
              {backtestHistory.map((run, idx) => {
                const detail = backtestDetails[run.filename];
                const strat = (detail?.strategy_comparison as Array<Record<string, unknown>> | undefined)?.[0]
                  ?? (detail?.strategy as Record<string, Record<string, unknown>> | undefined)?.[run.strategy]
                  ?? null;
                const isExpanded = idx === 0;
                // FT backtest returns profit_total as ratio (0.05 = 5%), profit_total_pct already in %
                const rawProfitPct = (strat as Record<string, number> | null)?.profit_total_pct ?? (strat as Record<string, number> | null)?.profit_total ?? 0;
                const totalProfitPct = Math.abs(rawProfitPct) < 1 ? rawProfitPct * 100 : rawProfitPct; // normalize to %
                const totalProfit = (strat as Record<string, number> | null)?.profit_total_abs ?? 0;
                const maxDD = (strat as Record<string, number> | null)?.max_drawdown ?? (strat as Record<string, number> | null)?.max_drawdown_account ?? 0;
                const winRate = (strat as Record<string, number> | null)?.wins != null && (strat as Record<string, number> | null)?.trades != null
                  ? ((strat as Record<string, number>).wins / Math.max(1, (strat as Record<string, number>).trades)) * 100 : 0;
                const trades = (strat as Record<string, number> | null)?.trades ?? 0;
                const wins = (strat as Record<string, number> | null)?.wins ?? 0;
                const draws = (strat as Record<string, number> | null)?.draws ?? 0;
                const losses = (strat as Record<string, number> | null)?.losses ?? 0;
                const sharpe = (strat as Record<string, number> | null)?.sharpe ?? 0;
                const sortino = (strat as Record<string, number> | null)?.sortino ?? 0;
                const profitFactor = (strat as Record<string, number> | null)?.profit_factor ?? 0;
                const date = run.backtest_start_time ? new Date(run.backtest_start_time * 1000).toISOString().split("T")[0] : "—";

                return (
                  <div key={run.run_id ?? run.filename} className="bg-surface l-bd rounded p-3 hover:bg-white/[0.04] cursor-pointer transition-colors" onClick={() => { if (!isExpanded) fetchBacktestDetail(run.filename, run.strategy); }}>
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-white font-mono text-[12px] font-bold">Run #{backtestHistory.length - idx} · {run.strategy} · {run.timeframe ?? "—"}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-[10px] font-mono">{date}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${totalProfitPct >= 0 ? "bg-up/12 text-up" : "bg-down/12 text-down"}`}>{totalProfitPct >= 0 ? "PROFITABLE" : "LOSS"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-2 text-[11px] font-mono mb-2">
                      <div><span className="text-muted block text-[9px]">Total Profit</span><span className={`${profitColor(totalProfitPct)} font-bold`}>{totalProfitPct >= 0 ? "+" : ""}{fmt(totalProfitPct, 1)}%</span></div>
                      <div><span className="text-muted block text-[9px]">Profit Abs</span><span className={`${profitColor(totalProfit)} font-bold`}>{fmtMoney(totalProfit)}</span></div>
                      <div><span className="text-muted block text-[9px]">Max DD</span><span className="text-down font-bold">{maxDD > 0 ? `-${fmt(maxDD * 100, 1)}%` : "—"}</span></div>
                      <div><span className="text-muted block text-[9px]">Win Rate</span><span className="text-white">{fmt(winRate, 1)}%</span></div>
                      <div><span className="text-muted block text-[9px]">Trades</span><span className="text-white">{trades}</span></div>
                      <div><span className="text-muted block text-[9px]">W / D / L</span><span className="text-white">{wins} / {draws} / {losses}</span></div>
                    </div>
                    {isExpanded && detail && (
                      <>
                        <div className="grid grid-cols-6 gap-2 text-[11px] font-mono mb-2.5">
                          <div><span className="text-muted block text-[9px]">Profit Factor</span><span className="text-white">{profitFactor ? fmt(profitFactor) : "—"}</span></div>
                          <div><span className="text-muted block text-[9px]">Sharpe</span><span className="text-white">{sharpe ? fmt(sharpe) : "—"}</span></div>
                          <div><span className="text-muted block text-[9px]">Sortino</span><span className="text-white">{sortino ? fmt(sortino) : "—"}</span></div>
                          <div><span className="text-muted block text-[9px]">Max Consec W</span><span className="text-white">{(strat as Record<string, number> | null)?.max_consecutive_wins ?? "—"}</span></div>
                          <div><span className="text-muted block text-[9px]">Avg Hold</span><span className="text-white">{(strat as Record<string, string> | null)?.holding_avg ?? "—"}</span></div>
                          <div><span className="text-muted block text-[9px]">Trades/Day</span><span className="text-white">{(strat as Record<string, number> | null)?.trades_per_day ? fmt((strat as Record<string, number>).trades_per_day, 2) : "—"}</span></div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    /* ─── Hyperopt — real API history matching HTML line 845-926 ─── */
    case "hyperopt": {
      return (
        <div className="flex flex-col gap-4">
          <h3 className="section-title flex items-center gap-2">Hyperopt Runs <span className="text-white/30">({configData?.strategy ?? bot.name})</span></h3>
          {hyperoptLoading ? (
            <div className="text-center py-8 text-muted text-xs animate-pulse">Loading hyperopt history...</div>
          ) : hyperoptRuns.length === 0 ? null : (
            <div className="space-y-3">
              {hyperoptRuns.map((run, idx) => {
                const isExpanded = idx === 0;
                const details = hyperoptDetails[run.filename];
                const best = details?.length ? details.reduce((b, d) => d.loss < b.loss ? d : b, details[0]) : null;
                const date = run.created_at ? run.created_at.split("T")[0] : new Date(run.mtime * 1000).toISOString().split("T")[0];

                return (
                  <div key={run.filename} className="bg-surface l-bd rounded p-3 hover:bg-white/[0.04] cursor-pointer transition-colors" onClick={() => { if (!isExpanded) fetchHyperoptDetail(run.filename); }}>
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-white font-mono text-[12px] font-bold">Opt #{hyperoptRuns.length - idx} · {run.strategy}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-[10px] font-mono">{date}</span>
                        {best && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded">BEST: {fmt(best.loss, 4)}</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-2 text-[11px] font-mono mb-2">
                      <div><span className="text-muted block text-[9px]">Epochs</span><span className="text-white">{run.epochs}</span></div>
                      <div><span className="text-muted block text-[9px]">Best Epoch</span><span className="text-white font-bold">{best?.current_epoch ?? "—"}</span></div>
                      <div><span className="text-muted block text-[9px]">Profit</span><span className={`${best ? (best.profitPct >= 0 ? "text-up" : "text-down") : "text-muted"} font-bold`}>{best ? `${best.profitPct >= 0 ? "+" : ""}${fmt(best.profitPct, 1)}%` : "—"}</span></div>
                      <div><span className="text-muted block text-[9px]">Max DD</span><span className="text-down font-bold">{best ? `-${fmt(best.maxDrawdown * 100, 1)}%` : "—"}</span></div>
                      <div><span className="text-muted block text-[9px]">Win Rate</span><span className="text-white">{best ? `${fmt(best.winRate * 100, 1)}%` : "—"}</span></div>
                      <div><span className="text-muted block text-[9px]">Trades</span><span className="text-white">{best?.trades ?? "—"}</span></div>
                    </div>
                    {isExpanded && best && (
                      <>
                        <div className="grid grid-cols-6 gap-2 text-[11px] font-mono mb-3">
                          <div><span className="text-muted block text-[9px]">Profit Abs</span><span className={`${profitColor(best.profitAbs)} font-bold`}>{fmtMoney(best.profitAbs)}</span></div>
                          <div><span className="text-muted block text-[9px]">Sharpe</span><span className="text-white">{fmt(best.sharpe)}</span></div>
                          <div><span className="text-muted block text-[9px]">Sortino</span><span className="text-white">{fmt(best.sortino)}</span></div>
                          <div><span className="text-muted block text-[9px]">Avg Duration</span><span className="text-white">{best.avgDuration}</span></div>
                          <div><span className="text-muted block text-[9px]">Loss</span><span className="text-white font-bold">{fmt(best.loss, 4)}</span></div>
                          <div><span className="text-muted block text-[9px]">Size</span><span className="text-white">{(run.size_bytes / 1024).toFixed(0)}KB</span></div>
                        </div>
                        {/* Best params */}
                        {best.params && Object.keys(best.params).length > 0 && (
                          <div className="border-t border-white/[0.06] pt-2">
                            <div className="text-[9px] text-muted uppercase tracking-wider mb-1.5 font-bold">Best Parameters</div>
                            <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                              {Object.entries(best.params).map(([k, v]) => (
                                <div key={k} className="flex justify-between"><span className="text-muted">{k}</span><span className="text-white">{String(v)}</span></div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    /* ─── FreqAI — matching HTML line 928-986 ─── */
    case "freqai": {
      const freqaiConfig = configData?.freqai;
      return (
        <div className="flex flex-col gap-4">
          <h3 className="section-title flex items-center gap-2">FreqAI Models <span className="text-white/30">({configData?.strategy ?? bot.name})</span></h3>
          {freqaiConfig ? (
            <>
              {/* Active Model — matching HTML line 932-960 */}
              <div className="bg-surface l-bd rounded p-3">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-white font-mono text-[12px] font-bold">{freqaiConfig.identifier ?? "FreqAI Model"}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${freqaiConfig.enabled ? "bg-up/12 text-up" : "text-muted l-bd"}`}>{freqaiConfig.enabled ? "ACTIVE" : "DISABLED"}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[11px] font-mono mb-2">
                  <div><span className="text-muted block text-[9px]">Features</span><span className="text-white">{freqaiConfig.feature_parameters?.include_timeframes?.length ?? "—"}</span></div>
                  <div><span className="text-muted block text-[9px]">Training Period</span><span className="text-white">{freqaiConfig.train_period_days != null ? `${freqaiConfig.train_period_days}d` : "—"}</span></div>
                  <div><span className="text-muted block text-[9px]">Backtest Period</span><span className="text-white">{freqaiConfig.backtest_period_days != null ? `${freqaiConfig.backtest_period_days}d` : "—"}</span></div>
                  <div><span className="text-muted block text-[9px]">Live Retrain</span><span className="text-white">{freqaiConfig.live_retrain_hours != null ? `${freqaiConfig.live_retrain_hours}h` : "—"}</span></div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[11px] font-mono mb-3">
                  <div><span className="text-muted block text-[9px]">Continual Learning</span><span className="text-white">{freqaiConfig.continual_learning ? "Yes" : "No"}</span></div>
                  {freqaiConfig.feature_parameters?.include_timeframes && (
                    <div className="col-span-3"><span className="text-muted block text-[9px]">Timeframes</span><span className="text-white">{freqaiConfig.feature_parameters.include_timeframes.join(", ")}</span></div>
                  )}
                </div>
                {/* Feature parameters as key-value grid */}
                {freqaiConfig.feature_parameters && (
                  <div className="border-t border-white/[0.06] pt-2">
                    <div className="text-[9px] text-muted uppercase tracking-wider mb-1.5 font-bold">Feature Parameters</div>
                    <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                      {freqaiConfig.feature_parameters.include_corr_pairlist && (
                        <div className="col-span-4 flex justify-between"><span className="text-muted">corr_pairs</span><span className="text-white">{freqaiConfig.feature_parameters.include_corr_pairlist.join(", ")}</span></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted text-xs">FreqAI is not configured for this bot.</div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
