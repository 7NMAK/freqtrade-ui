"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GitCompare,
  Download,
  Play,
  Square,
  Pause,
  RefreshCw,
  XSquare,
  PlusSquare,
  ShieldAlert,
  Zap,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog, { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getBots,
  botProfit,
  botDaily,
  botBalance,
  botStatus,
  startBot,
  stopBot,
  botPause,
  reloadBotConfig,
  botStopBuy,
  botForceExit,
  softKill,
  hardKill,
} from "@/lib/api";
import { fmtMoney, fmt } from "@/lib/format";
import type { Bot, FTProfit, FTDailyItem, FTTrade } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────

type SortKey =
  | "status"
  | "name"
  | "strategy"
  | "exchange"
  | "balance"
  | "todayPnl"
  | "totalPnl"
  | "pnlPct"
  | "winRate"
  | "trades"
  | "open"
  | "drawdown"
  | "avgDur";

type SortDir = "asc" | "desc";

interface BotRow {
  bot: Bot;
  profit: Partial<FTProfit> | null;
  balance: number | null;
  todayPnl: number | null;
  openCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function statusRank(status: string): number {
  if (status === "running") return 0;
  if (status === "draining") return 1;
  return 2;
}

function fmtDurationSec(seconds: number | string | undefined): string {
  if (seconds == null) return "\u2014";
  const s = typeof seconds === "string" ? parseFloat(seconds) : seconds;
  if (isNaN(s)) return typeof seconds === "string" ? seconds : "\u2014";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getSortValue(row: BotRow, key: SortKey): number | string {
  const { bot, profit, balance, todayPnl, openCount } = row;
  switch (key) {
    case "status":
      return statusRank(bot.status);
    case "name":
      return bot.name.toLowerCase();
    case "strategy":
      return (bot.strategy_name ?? "").toLowerCase();
    case "exchange":
      return (bot.exchange_name ?? "").toLowerCase();
    case "balance":
      return balance ?? -Infinity;
    case "todayPnl":
      return todayPnl ?? -Infinity;
    case "totalPnl":
      return profit?.profit_all_coin ?? -Infinity;
    case "pnlPct":
      return profit?.profit_all_percent ?? -Infinity;
    case "winRate": {
      const w = profit?.winning_trades ?? 0;
      const l = profit?.losing_trades ?? 0;
      return w + l > 0 ? (w / (w + l)) * 100 : -Infinity;
    }
    case "trades":
      return profit?.trade_count ?? 0;
    case "open":
      return openCount;
    case "drawdown": {
      const dd = profit
        ? ((profit as Record<string, unknown>).max_drawdown as number | undefined)
        : undefined;
      return dd ?? 0;
    }
    case "avgDur": {
      const d = profit?.avg_duration;
      if (typeof d === "number") return d;
      if (typeof d === "string") return parseFloat(d) || 0;
      return 0;
    }
    default:
      return 0;
  }
}

function exportCSV(rows: BotRow[]) {
  const headers = [
    "Status",
    "Bot Name",
    "Strategy",
    "Exchange",
    "Balance",
    "Today P&L",
    "Total P&L",
    "P&L %",
    "Win Rate",
    "Trades",
    "Open",
    "Drawdown",
    "Avg Duration",
  ];
  const csvRows = rows.map((r) => {
    const { bot, profit, balance, todayPnl, openCount } = r;
    const w = profit?.winning_trades ?? 0;
    const l = profit?.losing_trades ?? 0;
    const wr = w + l > 0 ? ((w / (w + l)) * 100).toFixed(1) : "";
    const dd = profit
      ? ((profit as Record<string, unknown>).max_drawdown as number | undefined)
      : undefined;
    return [
      bot.status,
      bot.name,
      bot.strategy_name ?? "",
      bot.exchange_name ?? "",
      balance?.toFixed(2) ?? "",
      todayPnl?.toFixed(2) ?? "",
      profit?.profit_all_coin?.toFixed(2) ?? "",
      profit?.profit_all_percent?.toFixed(2) ?? "",
      wr,
      profit?.trade_count ?? "",
      openCount,
      dd != null ? dd.toFixed(2) : "",
      fmtDurationSec(profit?.avg_duration),
    ].join(",");
  });
  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fleet-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sort Header Component ────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-3 py-3 cursor-pointer select-none hover:text-white/60 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          currentDir === "asc" ? (
            <ChevronUp className="w-3 h-3 text-white/50" />
          ) : (
            <ChevronDown className="w-3 h-3 text-white/50" />
          )
        ) : null}
      </span>
    </th>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLEET PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function FleetPage() {
  const toast = useToast();
  const [confirmProps, confirmDlg] = useConfirmDialog();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Data State ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<Bot[]>([]);
  const [botProfits, setBotProfits] = useState<Record<number, Partial<FTProfit>>>({});
  const [botBalances, setBotBalances] = useState<Record<number, number>>({});
  const [botTodayPnl, setBotTodayPnl] = useState<Record<number, number>>({});
  const [botOpenCounts, setBotOpenCounts] = useState<Record<number, number>>({});

  // ── UI State ────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // ── Data Fetching ───────────────────────────────────────────────────────

  const loadData = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      const m = mountedRef;

      try {
        const botList = await getBots();
        if (!m.current) return;
        const tradeBots = botList.filter(
          (b) => !b.is_utility && b.ft_mode !== "webserver"
        );
        setBots(tradeBots);

        const profits: Record<number, Partial<FTProfit>> = {};
        const balances: Record<number, number> = {};
        const todayPnls: Record<number, number> = {};
        const openCounts: Record<number, number> = {};

        await Promise.allSettled(
          tradeBots.map(async (bot) => {
            const results = await Promise.allSettled([
              botProfit(bot.id),
              botDaily(bot.id, 1),
              botBalance(bot.id),
              botStatus(bot.id),
            ]);

            // Profit
            if (results[0].status === "fulfilled") {
              profits[bot.id] = results[0].value;
            }
            // Today P&L (first item of daily with days=1)
            if (results[1].status === "fulfilled") {
              const dailyItems: FTDailyItem[] = results[1].value.data ?? [];
              if (dailyItems.length > 0) {
                todayPnls[bot.id] = dailyItems[0].abs_profit;
              }
            }
            // Balance
            if (results[2].status === "fulfilled") {
              const bal = results[2].value;
              balances[bot.id] = bal.total ?? bal.value ?? 0;
            }
            // Open trades count
            if (results[3].status === "fulfilled") {
              const trades: FTTrade[] = results[3].value;
              openCounts[bot.id] = trades.length;
            }
          })
        );

        if (!m.current) return;
        setBotProfits(profits);
        setBotBalances(balances);
        setBotTodayPnl(todayPnls);
        setBotOpenCounts(openCounts);
      } catch (err) {
        if (m.current) toast.error(err instanceof Error ? err.message : "Failed to load fleet data.");
      } finally {
        if (m.current) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 10_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Bot Actions ─────────────────────────────────────────────────────────

  async function handleBotAction(
    action: string,
    botId: number,
    fn: () => Promise<unknown>
  ) {
    try {
      await fn();
      toast.success(`${action} successful.`);
      await loadData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed.`);
    }
  }

  async function handleStart(botId: number) {
    await handleBotAction("Start", botId, () => startBot(botId));
  }
  async function handleStop(botId: number) {
    const ok = await confirmDlg({
      title: "Stop Bot",
      message: "Stop this bot? It will stop trading but remain registered.",
      confirmLabel: "Stop",
      variant: "warning",
    });
    if (!ok) return;
    await handleBotAction("Stop", botId, () => stopBot(botId));
  }
  async function handlePause(botId: number) {
    await handleBotAction("Pause (Stopbuy)", botId, () => botPause(botId));
  }
  async function handleReload(botId: number) {
    await handleBotAction("Reload config", botId, () => reloadBotConfig(botId));
  }
  async function handleForceExitAll(botId: number) {
    const ok = await confirmDlg({
      title: "Force Exit All",
      message:
        "Force exit ALL open trades on this bot at market price? Cannot be undone.",
      confirmLabel: "Force Exit All",
      variant: "danger",
    });
    if (!ok) return;
    await handleBotAction("Force exit all", botId, () =>
      botForceExit(botId, "all")
    );
  }
  async function handleStopBuy(botId: number) {
    await handleBotAction("Toggle Stopbuy", botId, () => botStopBuy(botId));
  }
  async function handleSoftKill(botId: number) {
    const ok = await confirmDlg({
      title: "Soft Kill",
      message:
        "Exit all open trades gracefully and keep the bot process alive?",
      confirmLabel: "Soft Kill",
      variant: "warning",
    });
    if (!ok) return;
    await handleBotAction("Soft Kill", botId, () =>
      softKill(botId, "Manual soft kill from fleet")
    );
  }
  async function handleHardKill(botId: number) {
    const ok = await confirmDlg({
      title: "HARD KILL",
      message:
        "This will FORCE STOP the bot AND its container immediately. Cannot be undone. Continue?",
      confirmLabel: "Hard Kill",
      variant: "danger",
    });
    if (!ok) return;
    await handleBotAction("Hard Kill", botId, () =>
      hardKill(botId, "Manual hard kill from fleet")
    );
  }

  // ── Sorting ─────────────────────────────────────────────────────────────

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ── Selection ───────────────────────────────────────────────────────────

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(allIds: number[]) {
    setSelectedIds((prev) => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  }

  // ── Computed Rows ───────────────────────────────────────────────────────

  const tradeBots = bots.filter((b) => !b.is_utility && b.ft_mode !== "webserver");
  const filteredBots = statusFilter
    ? tradeBots.filter((b) => {
        if (statusFilter === "running") return b.status === "running";
        if (statusFilter === "draining") return b.status === "draining";
        return b.status !== "running" && b.status !== "draining";
      })
    : tradeBots;

  const rows: BotRow[] = filteredBots.map((bot) => ({
    bot,
    profit: botProfits[bot.id] ?? null,
    balance: botBalances[bot.id] ?? null,
    todayPnl: botTodayPnl[bot.id] ?? null,
    openCount: botOpenCounts[bot.id] ?? 0,
  }));

  const sortedRows = [...rows].sort((a, b) => {
    const va = getSortValue(a, sortKey);
    const vb = getSortValue(b, sortKey);
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
    return sortDir === "asc" ? cmp : -cmp;
  });

  // ── Counts ──────────────────────────────────────────────────────────────

  const runningCount = tradeBots.filter((b) => b.status === "running").length;
  const pausedCount = tradeBots.filter((b) => b.status === "draining").length;
  const stoppedCount = tradeBots.filter(
    (b) => b.status !== "running" && b.status !== "draining"
  ).length;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <AppShell title="Fleet Management">
      <div className="flex flex-1 overflow-y-auto flex-col p-5 gap-5">
        {/* Fleet Header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          {/* LEFT */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-muted hover:text-white transition-colors flex items-center gap-1.5 text-[12px] font-medium"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <span className="text-white/15">|</span>
            <span className="text-[16px] font-bold uppercase tracking-widest text-white/80">
              Fleet Management
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded text-[11px] font-mono text-muted">
              {tradeBots.length} bots
            </span>
            <span className="flex items-center gap-1.5 text-up text-[11px] font-mono">
              <span className="w-2 h-2 bg-up rounded-full animate-pulse" />
              {runningCount} running
            </span>
            {pausedCount > 0 && (
              <span className="flex items-center gap-1.5 text-yellow-400 text-[11px] font-mono">
                {pausedCount} paused
              </span>
            )}
            {stoppedCount > 0 && (
              <span className="flex items-center gap-1.5 text-down text-[11px] font-mono">
                {stoppedCount} stopped
              </span>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 border border-white/12 rounded text-[11px] hover:bg-white/10 font-medium transition-colors flex items-center gap-1.5"
              title="Compare selected bots side by side"
              onClick={() => {
                if (selectedIds.size < 2) {
                  toast.warning("Select at least 2 bots to compare.");
                  return;
                }
                toast.info(`Comparing ${selectedIds.size} bots...`);
              }}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Compare Selected
            </button>
            <button
              className="px-3 py-1.5 border border-white/12 rounded text-[11px] hover:bg-white/10 font-medium transition-colors flex items-center gap-1.5"
              title="Export fleet data as CSV"
              onClick={() => exportCSV(sortedRows)}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Fleet Table */}
        <div className="flex-1 bg-surface l-bd rounded-md shadow-xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
              <thead className="sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg">
                <tr>
                  {/* 1. Checkbox */}
                  <th className="w-8 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={
                        sortedRows.length > 0 &&
                        selectedIds.size === sortedRows.length
                      }
                      onChange={() =>
                        toggleSelectAll(sortedRows.map((r) => r.bot.id))
                      }
                    />
                  </th>
                  {/* 2. Status */}
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  {/* 3. Bot Name */}
                  <SortHeader
                    label="Bot Name"
                    sortKey="name"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="px-4 py-3"
                  />
                  {/* 4. Strategy */}
                  <SortHeader
                    label="Strategy"
                    sortKey="strategy"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  {/* 5. Exchange */}
                  <SortHeader
                    label="Exchange"
                    sortKey="exchange"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  {/* 6. Balance */}
                  <SortHeader
                    label="Balance"
                    sortKey="balance"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  {/* 7. Today P&L */}
                  <SortHeader
                    label="Today P&L"
                    sortKey="todayPnl"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right bg-black/20"
                  />
                  {/* 8. Total P&L */}
                  <SortHeader
                    label="Total P&L"
                    sortKey="totalPnl"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right bg-black/20"
                  />
                  {/* 9. P&L % */}
                  <SortHeader
                    label="P&L %"
                    sortKey="pnlPct"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right bg-black/20"
                  />
                  {/* 10. Win Rate */}
                  <SortHeader
                    label="Win Rate"
                    sortKey="winRate"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  {/* 11. Trades */}
                  <SortHeader
                    label="Trades"
                    sortKey="trades"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  {/* 12. Open */}
                  <SortHeader
                    label="Open"
                    sortKey="open"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  {/* 13. Drawdown */}
                  <SortHeader
                    label="Drawdown"
                    sortKey="drawdown"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  {/* 14. Avg Dur */}
                  <SortHeader
                    label="Avg Dur"
                    sortKey="avgDur"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="text-right"
                  />
                  {/* 15. Actions */}
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                {loading && sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-3 py-12 text-center text-muted text-sm">
                      Loading fleet data...
                    </td>
                  </tr>
                )}
                {!loading && sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-3 py-12 text-center text-muted text-sm">
                      No bots registered.
                    </td>
                  </tr>
                )}
                {sortedRows.map((row, idx) => {
                  const { bot, profit, balance, todayPnl, openCount } = row;
                  const isLive = bot.status === "running";
                  const isPaused = bot.status === "draining";

                  const pnl = profit?.profit_all_coin ?? null;
                  const pnlPct = profit?.profit_all_percent ?? null;
                  const trades = profit?.trade_count ?? 0;
                  const w = profit?.winning_trades ?? 0;
                  const l = profit?.losing_trades ?? 0;
                  const winRate = w + l > 0 ? (w / (w + l)) * 100 : null;
                  const maxDd = profit
                    ? ((profit as Record<string, unknown>).max_drawdown as
                        | number
                        | undefined)
                    : undefined;
                  const avgDur = profit?.avg_duration;

                  return (
                    <tr
                      key={bot.id}
                      className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${
                        idx % 2 === 1 ? "bg-white/[0.015]" : ""
                      }`}
                    >
                      {/* 1. Checkbox */}
                      <td className="w-8 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(bot.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(bot.id);
                          }}
                        />
                      </td>

                      {/* 2. Status */}
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isLive
                                ? "bg-up shadow-[0_0_4px_#22c55e]"
                                : isPaused
                                ? "bg-yellow-400"
                                : "bg-down"
                            }`}
                          />
                          <span
                            className={`text-[10px] font-medium uppercase ${
                              isLive
                                ? "text-up"
                                : isPaused
                                ? "text-yellow-400"
                                : "text-down"
                            }`}
                          >
                            {isLive ? "RUN" : isPaused ? "PAUSE" : "STOP"}
                          </span>
                        </span>
                      </td>

                      {/* 3. Bot Name */}
                      <td className="px-4 py-2.5">
                        <span
                          className={`font-bold ${
                            isLive
                              ? "text-white"
                              : isPaused
                              ? "text-white/60"
                              : "text-white/40"
                          }`}
                        >
                          {bot.name}
                        </span>
                      </td>

                      {/* 4. Strategy */}
                      <td className="px-3 py-2.5">
                        <span className="text-muted font-sans text-[11px]">
                          {bot.strategy_name ?? "\u2014"}
                        </span>
                      </td>

                      {/* 5. Exchange */}
                      <td className="px-3 py-2.5">
                        <span className="text-muted">
                          {bot.exchange_name ?? "\u2014"}
                        </span>
                      </td>

                      {/* 6. Balance */}
                      <td className="px-3 py-2.5 text-right">
                        {balance != null ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "\u2014"}
                      </td>

                      {/* 7. Today P&L */}
                      <td
                        className={`px-3 py-2.5 text-right ${
                          todayPnl != null && todayPnl > 0
                            ? "bg-up/5 text-up font-bold"
                            : todayPnl != null && todayPnl < 0
                            ? "bg-down/5 text-down font-bold"
                            : ""
                        }`}
                      >
                        {todayPnl != null ? fmtMoney(todayPnl) : "\u2014"}
                      </td>

                      {/* 8. Total P&L */}
                      <td
                        className={`px-3 py-2.5 text-right ${
                          pnl != null && pnl > 0
                            ? "bg-up/5 text-up"
                            : pnl != null && pnl < 0
                            ? "bg-down/5 text-down"
                            : ""
                        }`}
                      >
                        {pnl != null ? fmtMoney(pnl) : "\u2014"}
                      </td>

                      {/* 9. P&L % */}
                      <td
                        className={`px-3 py-2.5 text-right text-[11px] ${
                          pnlPct != null && pnlPct > 0
                            ? "bg-up/5 text-up"
                            : pnlPct != null && pnlPct < 0
                            ? "bg-down/5 text-down"
                            : ""
                        }`}
                      >
                        {pnlPct != null
                          ? `${pnlPct >= 0 ? "+" : ""}${fmt(pnlPct, 2)}%`
                          : "\u2014"}
                      </td>

                      {/* 10. Win Rate */}
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={
                            winRate != null && winRate >= 65
                              ? "text-up"
                              : winRate != null && winRate < 50
                              ? "text-down"
                              : ""
                          }
                        >
                          {winRate != null ? `${fmt(winRate, 1)}%` : "\u2014"}
                        </span>
                      </td>

                      {/* 11. Trades */}
                      <td className="px-3 py-2.5 text-right">{trades}</td>

                      {/* 12. Open */}
                      <td className="px-3 py-2.5 text-right">
                        <span className={openCount === 0 ? "text-muted" : ""}>
                          {openCount}
                        </span>
                      </td>

                      {/* 13. Drawdown */}
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-down">
                          {maxDd != null ? `${fmt(maxDd, 1)}%` : "\u2014"}
                        </span>
                      </td>

                      {/* 14. Avg Dur */}
                      <td className="px-3 py-2.5 text-right">
                        {fmtDurationSec(avgDur)}
                      </td>

                      {/* 15. Actions */}
                      <td className="px-3 py-2.5">
                        <div className="flex gap-0.5 justify-center">
                          <button
                            className="bot-ctrl ctrl-start"
                            style={{ width: "22px", height: "22px" }}
                            title="Start Bot"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStart(bot.id);
                            }}
                          >
                            <Play className="w-2.5 h-2.5" />
                          </button>
                          <button
                            className="bot-ctrl ctrl-stop"
                            style={{ width: "22px", height: "22px" }}
                            title="Stop Bot"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStop(bot.id);
                            }}
                          >
                            <Square className="w-2.5 h-2.5" />
                          </button>
                          <button
                            className="bot-ctrl ctrl-pause"
                            style={{ width: "22px", height: "22px" }}
                            title="Pause"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePause(bot.id);
                            }}
                          >
                            <Pause className="w-2.5 h-2.5" />
                          </button>
                          <button
                            className="bot-ctrl"
                            style={{ width: "22px", height: "22px" }}
                            title="Reload Config"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReload(bot.id);
                            }}
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                          </button>
                          <button
                            className="bot-ctrl ctrl-stop"
                            style={{ width: "22px", height: "22px" }}
                            title="Force Exit All"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleForceExitAll(bot.id);
                            }}
                          >
                            <XSquare className="w-2.5 h-2.5" />
                          </button>
                          <button
                            className="bot-ctrl"
                            style={{ width: "22px", height: "22px" }}
                            title="Toggle Stopbuy"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStopBuy(bot.id);
                            }}
                          >
                            <PlusSquare className="w-2.5 h-2.5" />
                          </button>
                          <span className="w-px h-3 bg-white/15 mx-0.5 self-center" />
                          <button
                            className="bot-ctrl"
                            style={{
                              width: "22px",
                              height: "22px",
                              color: "#facc15",
                            }}
                            title="Soft Kill"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSoftKill(bot.id);
                            }}
                          >
                            <ShieldAlert className="w-2.5 h-2.5" />
                          </button>
                          <button
                            className="bot-ctrl ctrl-stop"
                            style={{ width: "22px", height: "22px" }}
                            title="Hard Kill"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHardKill(bot.id);
                            }}
                          >
                            <Zap className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Fleet Footer */}
          <div className="h-10 l-b bg-black/40 flex items-center justify-between px-5 shrink-0 font-mono text-[11px] text-muted">
            <span>
              Showing {sortedRows.length} of {tradeBots.length} bots
            </span>
            <span className="flex items-center gap-3">
              {statusFilter && (
                <span>
                  Filter: {statusFilter}{" "}
                  <button
                    className="text-white/50 hover:text-white ml-1"
                    onClick={() => setStatusFilter(null)}
                  >
                    x
                  </button>
                </span>
              )}
              <span>
                Sort: {sortKey} {sortDir === "asc" ? "\u2191" : "\u2193"}
              </span>
              <span className="text-white/50">Page 1 of 1</span>
            </span>
          </div>
        </div>
      </div>

      <ConfirmDialog {...confirmProps} />
    </AppShell>
  );
}
