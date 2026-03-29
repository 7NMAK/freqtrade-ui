"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  SkeletonStat,
  SkeletonTable,
  SkeletonChart,
} from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  getBots,
  botStatus,
  botProfit,
  botDaily,
  botForceExit,
  botStats,
  portfolioProfit,
  portfolioBalance,
  portfolioTrades,
  portfolioDaily,
  getRiskEvents,
  fetchAIAgreementRate,
  startBot,
  stopBot,
  botStopBuy,
  botPause,
  botForceEnter,
  reloadBotConfig,
  botDeleteTrade,
  botReloadTrade,
  botCancelOpenOrder,
  botWeekly,
  botMonthly,
  botPerformance,
  botEntries,
  botExits,
  botMixTags,
  botConfig,
  botSysinfo,
  botLogs,
  botWhitelist,
  botLocks,
  botTrades,
  botBalance,
} from "@/lib/api";
import type {
  Bot,
  FTTrade,
  FTProfit,
  FTDailyItem,
  RiskEvent,
  FTWeeklyResponse,
  FTMonthlyResponse,
  FTPerformance,
  FTEntry,
  FTExit,
  FTMixTag,
  FTStats,
  FTShowConfig,
  FTSysinfo,
  FTLogsResponse,
  FTWhitelist,
  FTLocksResponse,
  FTBalance,
} from "@/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import { fmt, fmtMoney, profitColor } from "@/lib/format";
import LogViewer from "@/components/dashboard/LogViewer";
import BotManagementTable from "@/components/bots/BotManagementTable";

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDuration(openDate: string): string {
  const ms = Date.now() - new Date(openDate).getTime();
  if (isNaN(ms)) return "\u2014";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ isRunning, isDryRun }: { isRunning: boolean; isDryRun: boolean }) {
  if (!isRunning) {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-bg-3 text-text-3 uppercase tracking-wide border border-border">
        Stopped
      </span>
    );
  }
  if (isDryRun) {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-bg text-amber uppercase tracking-wide border border-amber/20">
        Paper
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-bg text-green uppercase tracking-wide border border-green/20">
      Live
    </span>
  );
}

// ── Mini Sparkline ───────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-0.5 h-7">
      {data.map((v, i) => {
        const pct = Math.max(10, ((v - min) / range) * 100);
        const isPos = v >= 0;
        return (
          <div
            key={`spark-${i}`}
            className={`flex-1 rounded-[1px] ${isPos ? "bg-green" : "bg-red"} opacity-60`}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueColor,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  icon: string;
}) {
  return (
    <div className="bg-bg-2 border border-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-3 font-medium uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-xl font-bold tracking-tight mb-1 ${valueColor ?? "text-text-0"}`}>
        {value}
      </div>
      {sub && <div className="text-2xs text-text-3">{sub}</div>}
    </div>
  );
}

// ── Bot Card (clickable) ─────────────────────────────────────────────────

function BotCard({
  bot,
  profit,
  sparkData,
  openCount,
  onClick,
}: {
  bot: Bot;
  profit: FTProfit | null;
  sparkData: number[];
  openCount: number;
  onClick: () => void;
}) {
  const isRunning = bot.status === "running";
  return (
    <div
      onClick={onClick}
      className={`bg-bg-1 border rounded-lg p-4 transition-all cursor-pointer hover:border-accent hover:translate-y-[-1px] hover:shadow-lg ${
        bot.status === "error"
          ? "border-red/30"
          : isRunning
          ? "border-border"
          : "border-border/50"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-text-0 truncate mr-2">{bot.name}</div>
        <StatusBadge isRunning={isRunning} isDryRun={bot.is_dry_run} />
      </div>
      <div className="text-2xs text-text-3 mb-3 truncate">
        {bot.strategy_name ?? "No strategy"}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <div className="text-2xs text-text-3 mb-0.5">Close P&L</div>
          <div className={`text-sm font-bold ${profitColor(profit?.profit_closed_coin)}`}>
            {profit ? `${fmt(profit.profit_closed_coin)} USDT` : "\u2014"}
          </div>
        </div>
        <div>
          <div className="text-2xs text-text-3 mb-0.5">Win Rate</div>
          <div className="text-sm font-bold text-text-0">
            {profit && (profit.winning_trades + profit.losing_trades) > 0
              ? `${((profit.winning_trades / (profit.winning_trades + profit.losing_trades)) * 100).toFixed(1)}%`
              : "\u2014"}
          </div>
        </div>
        <div>
          <div className="text-2xs text-text-3 mb-0.5">Trades</div>
          <div className="text-sm font-bold text-text-0">{openCount} open</div>
        </div>
      </div>

      {sparkData.length > 0 && <Sparkline data={sparkData} />}
    </div>
  );
}

// ── Section Loading / Error wrapper ──────────────────────────────────────

function SectionLoader({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-text-3 animate-pulse">Loading...</div>
    );
  }
  if (error) {
    return (
      <div className="py-4 text-center text-xs text-red">{error}</div>
    );
  }
  return <>{children}</>;
}

// ── Force Entry Dialog ───────────────────────────────────────────────────

function ForceEntryDialog({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (pair: string, side: "long" | "short", stake?: number) => void;
  submitting: boolean;
}) {
  const [pair, setPair] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [stake, setStake] = useState("");

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-bg-2 border border-border rounded-card p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-text-0 mb-4">Force Entry</h3>
        <div className="space-y-3">
          <div>
            <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">Pair</label>
            <input
              type="text"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="BTC/USDT:USDT"
              className="w-full bg-bg-1 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">Side</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSide("long")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded border cursor-pointer transition-all ${
                  side === "long"
                    ? "bg-green-bg text-green border-green/30"
                    : "bg-bg-1 text-text-3 border-border"
                }`}
              >
                Long
              </button>
              <button
                type="button"
                onClick={() => setSide("short")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded border cursor-pointer transition-all ${
                  side === "short"
                    ? "bg-red-bg text-red border-red/30"
                    : "bg-bg-1 text-text-3 border-border"
                }`}
              >
                Short
              </button>
            </div>
          </div>
          <div>
            <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">stake_amount (optional)</label>
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="Use default"
              className="w-full bg-bg-1 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold rounded border border-border text-text-2 hover:bg-bg-3 cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!pair.trim() || submitting}
            onClick={() => onSubmit(pair.trim(), side, stake ? Number(stake) : undefined)}
            className="flex-1 py-2 text-xs font-semibold rounded bg-accent text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all"
          >
            {submitting ? "Submitting..." : "Force Enter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const toast = useToast();

  // ── State ──────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [staleCount, setStaleCount] = useState(0);
  const staleCountRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [bots, setBots] = useState<Bot[]>([]);
  const [openTrades, setOpenTrades] = useState<FTTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<FTTrade[]>([]);
  const [botProfits, setBotProfits] = useState<Record<number, FTProfit>>({});
  const [sparklines, setSparklines] = useState<Record<number, number[]>>({});
  const [openByBot, setOpenByBot] = useState<Record<number, number>>({});
  const [dailyData, setDailyData] = useState<FTDailyItem[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);

  // Portfolio aggregates
  const [totalEquity, setTotalEquity] = useState<number | null>(null);
  const [totalUnrealized, setTotalUnrealized] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [totalWinRate, setTotalWinRate] = useState<number | null>(null);

  // Expanded trade detail
  const [expandedTradeId, setExpandedTradeId] = useState<number | null>(null);
  const [exitingTradeId, setExitingTradeId] = useState<string | null>(null);

  // AI Agreement
  const [aiAgreementPct, setAiAgreementPct] = useState<number | null>(null);
  const [aiStrongDisagree, setAiStrongDisagree] = useState<number>(0);
  const [aiEnabled, setAiEnabled] = useState<boolean>(false);

  // Daily period selector
  const [dailyPeriod, setDailyPeriod] = useState<7 | 14 | 30>(30);

  // ═════════════════════════════════════════════════════════════════
  // KEY CHANGE: selectedBotId = null means ALL BOTS (default).
  // When user clicks a bot card, selectedBotId gets set.
  // NO auto-selection of first bot.
  // ═════════════════════════════════════════════════════════════════
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [controlLoading, setControlLoading] = useState<string | null>(null);
  const [forceEntryOpen, setForceEntryOpen] = useState(false);
  const [forceEntrySubmitting, setForceEntrySubmitting] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  // Single-bot detail sections state
  const [weeklyData, setWeeklyData] = useState<FTWeeklyResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const [monthlyData, setMonthlyData] = useState<FTMonthlyResponse | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  const [perfData, setPerfData] = useState<FTPerformance[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);

  const [entryData, setEntryData] = useState<FTEntry[]>([]);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const [exitData, setExitData] = useState<FTExit[]>([]);
  const [exitLoading, setExitLoading] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);

  const [mixTagData, setMixTagData] = useState<FTMixTag[]>([]);
  const [mixTagLoading, setMixTagLoading] = useState(false);
  const [mixTagError, setMixTagError] = useState<string | null>(null);

  const [statsData, setStatsData] = useState<FTStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [configData, setConfigData] = useState<FTShowConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [sysinfoData, setSysinfoData] = useState<FTSysinfo | null>(null);
  const [sysinfoLoading, setSysinfoLoading] = useState(false);
  const [sysinfoError, setSysinfoError] = useState<string | null>(null);

  const [logsData, setLogsData] = useState<FTLogsResponse | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [whitelistData, setWhitelistData] = useState<FTWhitelist | null>(null);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  const [locksData, setLocksData] = useState<FTLocksResponse | null>(null);
  const [locksLoading, setLocksLoading] = useState(false);
  const [locksError, setLocksError] = useState<string | null>(null);

  const [balanceData, setBalanceData] = useState<FTBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Single-bot closed trades
  const [singleBotClosedTrades, setSingleBotClosedTrades] = useState<FTTrade[]>([]);
  const [singleBotClosedLoading, setSingleBotClosedLoading] = useState(false);

  // Single-bot open trades
  const [singleBotOpenTrades, setSingleBotOpenTrades] = useState<FTTrade[]>([]);
  const [singleBotOpenLoading, setSingleBotOpenLoading] = useState(false);

  // ── Portfolio Data Loading (ALL BOTS) ────────────────────────────────

  const loadPortfolioData = useCallback(async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    const m = mountedRef;

    try {
      const botList = await getBots();
      if (!m.current) return;
      setBots(botList);

      // AI agreement (non-blocking)
      fetchAIAgreementRate(7)
        .then((agr) => {
          if (!m.current) return;
          setAiAgreementPct(agr.all_agree_pct ?? null);
          setAiStrongDisagree(agr.strong_disagree ?? 0);
          setAiEnabled(true);
        })
        .catch(() => { if (m.current) setAiEnabled(false); });

      const runningBots = botList.filter((b) => b.status === "running");

      // Portfolio balance
      try {
        const pb = await portfolioBalance();
        if (m.current) setTotalEquity(pb.total_value);
      } catch { /* non-blocking */ }

      // Portfolio profit
      try {
        const pp = await portfolioProfit();
        if (m.current) setTotalUnrealized(pp.combined.profit_all_coin - pp.combined.profit_closed_coin);
      } catch { /* non-blocking */ }

      // Open trades (all bots combined)
      try {
        const pt = await portfolioTrades();
        if (!m.current) return;
        const allOpen = pt.trades.filter((t) => t.is_open);
        setOpenTrades(allOpen);

        const unrealized = allOpen.reduce((s, t) => s + (t.current_profit_abs ?? 0), 0);
        setTotalUnrealized((prev) => prev ?? unrealized);

        const todayClosed = pt.trades.filter(
          (t) => !t.is_open && isToday(t.close_date)
        );
        setClosedTrades(todayClosed);
      } catch { /* non-blocking */ }

      // Per-bot sparklines + profits
      const profits: Record<number, FTProfit> = {};
      const sparks: Record<number, number[]> = {};
      const openCounts: Record<number, number> = {};

      await Promise.allSettled(
        runningBots.map(async (bot) => {
          try {
            const [p, d, s] = await Promise.allSettled([
              botProfit(bot.id),
              botDaily(bot.id, 7),
              botStatus(bot.id),
            ]);
            if (p.status === "fulfilled") profits[bot.id] = p.value;
            if (d.status === "fulfilled") sparks[bot.id] = d.value.data.map((item) => item.abs_profit);
            if (s.status === "fulfilled") openCounts[bot.id] = s.value.filter((t) => t.is_open).length;
          } catch { /* per-bot isolated */ }
        })
      );

      if (m.current) {
        setBotProfits(profits);
        setSparklines(sparks);
        setOpenByBot(openCounts);
      }

      // Daily P&L chart (aggregated across all bots)
      try {
        const daily = await portfolioDaily();
        if (m.current) setDailyData(daily.data ?? []);
      } catch { /* non-blocking */
        if (m.current) setDailyData([]);
      }

      // Win rate
      const allProfit = Object.values(profits);
      if (allProfit.length > 0 && m.current) {
        const totalW = allProfit.reduce((s, p) => s + (p.winning_trades ?? 0), 0);
        const totalL = allProfit.reduce((s, p) => s + (p.losing_trades ?? 0), 0);
        const total = totalW + totalL;
        setTotalWinRate(total > 0 ? (totalW / total) * 100 : null);
      }

      // Recent alerts
      try {
        const events = await getRiskEvents();
        if (m.current) setRiskEvents(events.slice(0, 5));
      } catch { /* non-blocking */ }

      staleCountRef.current = 0;
      if (m.current) setStaleCount(0);
    } catch (err) {
      staleCountRef.current += 1;
      if (m.current) setStaleCount(staleCountRef.current);
      if (staleCountRef.current === 1) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load dashboard data.",
          { action: { label: "RETRY", onClick: () => loadPortfolioData(true) } }
        );
      }
    } finally {
      if (m.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // Initial load + auto-refresh
  useEffect(() => {
    loadPortfolioData(true);
    const interval = setInterval(() => loadPortfolioData(false), REFRESH_INTERVALS.DASHBOARD);
    return () => clearInterval(interval);
  }, [loadPortfolioData]);

  // ── Load Single Bot Detail Sections ────────────────────────────────────

  const loadBotDetails = useCallback(async (botId: number) => {
    const m = mountedRef;

    // Bot open trades
    setSingleBotOpenLoading(true);
    botStatus(botId)
      .then((d) => { if (m.current) { setSingleBotOpenTrades(d.filter((t) => t.is_open)); setSingleBotOpenLoading(false); } })
      .catch(() => { if (m.current) setSingleBotOpenLoading(false); });

    // Bot closed trades
    setSingleBotClosedLoading(true);
    botTrades(botId, 50)
      .then((d) => { if (m.current) { setSingleBotClosedTrades(d.trades.filter((t) => !t.is_open)); setSingleBotClosedLoading(false); } })
      .catch(() => { if (m.current) setSingleBotClosedLoading(false); });

    // Weekly
    setWeeklyLoading(true); setWeeklyError(null);
    botWeekly(botId, 12)
      .then((d) => { if (m.current) { setWeeklyData(d); setWeeklyLoading(false); } })
      .catch((e) => { if (m.current) { setWeeklyError(e instanceof Error ? e.message : "Failed"); setWeeklyLoading(false); } });

    // Monthly
    setMonthlyLoading(true); setMonthlyError(null);
    botMonthly(botId, 12)
      .then((d) => { if (m.current) { setMonthlyData(d); setMonthlyLoading(false); } })
      .catch((e) => { if (m.current) { setMonthlyError(e instanceof Error ? e.message : "Failed"); setMonthlyLoading(false); } });

    // Performance
    setPerfLoading(true); setPerfError(null);
    botPerformance(botId)
      .then((d) => { if (m.current) { setPerfData(d); setPerfLoading(false); } })
      .catch((e) => { if (m.current) { setPerfError(e instanceof Error ? e.message : "Failed"); setPerfLoading(false); } });

    // Entries
    setEntryLoading(true); setEntryError(null);
    botEntries(botId)
      .then((d) => { if (m.current) { setEntryData(d); setEntryLoading(false); } })
      .catch((e) => { if (m.current) { setEntryError(e instanceof Error ? e.message : "Failed"); setEntryLoading(false); } });

    // Exits
    setExitLoading(true); setExitError(null);
    botExits(botId)
      .then((d) => { if (m.current) { setExitData(d); setExitLoading(false); } })
      .catch((e) => { if (m.current) { setExitError(e instanceof Error ? e.message : "Failed"); setExitLoading(false); } });

    // Mix Tags
    setMixTagLoading(true); setMixTagError(null);
    botMixTags(botId)
      .then((d) => { if (m.current) { setMixTagData(d); setMixTagLoading(false); } })
      .catch((e) => { if (m.current) { setMixTagError(e instanceof Error ? e.message : "Failed"); setMixTagLoading(false); } });

    // Stats
    setStatsLoading(true); setStatsError(null);
    botStats(botId)
      .then((d) => { if (m.current) { setStatsData(d); setStatsLoading(false); } })
      .catch((e) => { if (m.current) { setStatsError(e instanceof Error ? e.message : "Failed"); setStatsLoading(false); } });

    // Config
    setConfigLoading(true); setConfigError(null);
    botConfig(botId)
      .then((d) => { if (m.current) { setConfigData(d); setConfigLoading(false); } })
      .catch((e) => { if (m.current) { setConfigError(e instanceof Error ? e.message : "Failed"); setConfigLoading(false); } });

    // Sysinfo
    setSysinfoLoading(true); setSysinfoError(null);
    botSysinfo(botId)
      .then((d) => { if (m.current) { setSysinfoData(d); setSysinfoLoading(false); } })
      .catch((e) => { if (m.current) { setSysinfoError(e instanceof Error ? e.message : "Failed"); setSysinfoLoading(false); } });

    // Logs
    setLogsLoading(true); setLogsError(null);
    botLogs(botId, 100)
      .then((d) => { if (m.current) { setLogsData(d); setLogsLoading(false); } })
      .catch((e) => { if (m.current) { setLogsError(e instanceof Error ? e.message : "Failed"); setLogsLoading(false); } });

    // Whitelist
    setWhitelistLoading(true); setWhitelistError(null);
    botWhitelist(botId)
      .then((d) => { if (m.current) { setWhitelistData(d); setWhitelistLoading(false); } })
      .catch((e) => { if (m.current) { setWhitelistError(e instanceof Error ? e.message : "Failed"); setWhitelistLoading(false); } });

    // Locks
    setLocksLoading(true); setLocksError(null);
    botLocks(botId)
      .then((d) => { if (m.current) { setLocksData(d); setLocksLoading(false); } })
      .catch((e) => { if (m.current) { setLocksError(e instanceof Error ? e.message : "Failed"); setLocksLoading(false); } });

    // Balance
    setBalanceLoading(true); setBalanceError(null);
    botBalance(botId)
      .then((d) => { if (m.current) { setBalanceData(d); setBalanceLoading(false); } })
      .catch((e) => { if (m.current) { setBalanceError(e instanceof Error ? e.message : "Failed"); setBalanceLoading(false); } });
  }, []);

  useEffect(() => {
    if (selectedBotId !== null) {
      loadBotDetails(selectedBotId);
    }
  }, [selectedBotId, loadBotDetails]);

  // ── Bot Control Handlers ──────────────────────────────────────────────

  async function handleBotAction(action: string, botId: number, fn: () => Promise<unknown>) {
    setControlLoading(action);
    try {
      await fn();
      toast.success(`${action} successful.`);
      await loadPortfolioData(false);
      if (selectedBotId) loadBotDetails(selectedBotId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed.`);
    } finally {
      setControlLoading(null);
    }
  }

  async function handleForceEntrySubmit(pair: string, side: "long" | "short", stake?: number) {
    if (!selectedBotId) return;
    setForceEntrySubmitting(true);
    try {
      await botForceEnter(selectedBotId, pair, side, stake);
      toast.success(`Force entry submitted: ${pair} ${side}`);
      setForceEntryOpen(false);
      await loadPortfolioData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Force entry failed.");
    } finally {
      setForceEntrySubmitting(false);
    }
  }

  // ── Trade Action Handlers ─────────────────────────────────────────────

  async function handleForceExit(trade: FTTrade) {
    if (!trade._bot_id) {
      toast.error("Cannot determine which bot owns this trade.");
      return;
    }
    const tradeIdStr = String(trade.trade_id);
    setExitingTradeId(tradeIdStr);
    const loadId = toast.loading(`Force exiting ${trade.pair}...`);
    try {
      await botForceExit(trade._bot_id, tradeIdStr);
      toast.dismiss(loadId);
      toast.success(`Force exit submitted for ${trade.pair}.`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? `Force exit failed: ${err.message}` : "Force exit failed.",
        { action: { label: "RETRY", onClick: () => handleForceExit(trade) } }
      );
    } finally {
      setExitingTradeId(null);
    }
  }

  async function handleDeleteTrade(trade: FTTrade) {
    if (!trade._bot_id) return;
    const loadId = toast.loading(`Deleting trade #${trade.trade_id}...`);
    try {
      await botDeleteTrade(trade._bot_id, trade.trade_id);
      toast.dismiss(loadId);
      toast.success(`Trade #${trade.trade_id} deleted.`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Delete trade failed.");
    }
  }

  async function handleReloadTrade(trade: FTTrade) {
    if (!trade._bot_id) return;
    const loadId = toast.loading(`Reloading trade #${trade.trade_id}...`);
    try {
      await botReloadTrade(trade._bot_id, trade.trade_id);
      toast.dismiss(loadId);
      toast.success(`Trade #${trade.trade_id} reloaded.`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Reload trade failed.");
    }
  }

  async function handleCancelOpenOrder(trade: FTTrade) {
    if (!trade._bot_id) return;
    const loadId = toast.loading(`Cancelling open order for #${trade.trade_id}...`);
    try {
      await botCancelOpenOrder(trade._bot_id, trade.trade_id);
      toast.dismiss(loadId);
      toast.success(`Open order cancelled for trade #${trade.trade_id}.`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Cancel order failed.");
    }
  }

  // ── Computed values ────────────────────────────────────────────────────

  const totalClosedProfit = Object.values(botProfits).reduce(
    (s, p) => s + (p.profit_closed_coin ?? 0), 0
  );

  const chartData = (() => {
    let cum = 0;
    return dailyData.map((d) => {
      cum += d.abs_profit;
      return { date: d.date.slice(5), value: cum };
    });
  })();

  const staleWarning = staleCount >= 3;
  const runningBotCards = bots.filter((b) => b.status === "running");
  const selectedBot = bots.find((b) => b.id === selectedBotId) ?? null;
  const isAllBotsView = selectedBotId === null;

  // ════════════════════════════════════════════════════════════════════════
  // RENDER: Open Trades Table (shared between all-bots and single-bot)
  // ════════════════════════════════════════════════════════════════════════

  function renderTradesTable(trades: FTTrade[], showBotColumn: boolean, emptyMsg: string) {
    if (trades.length === 0) {
      return (
        <CardBody>
          <div className="py-8 text-center text-sm text-text-3">{emptyMsg}</div>
        </CardBody>
      );
    }
    const headers = showBotColumn
      ? ["Pair", "Bot", "Side", "Open Rate", "Current", "P&L", "Duration", "Actions"]
      : ["Pair", "Side", "Open Rate", "Current", "P&L", "Duration", "Actions"];

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left px-4 py-3 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => {
              const isExpanded = expandedTradeId === trade.trade_id;
              const isExiting = exitingTradeId === String(trade.trade_id);
              const pnl = trade.current_profit_abs ?? trade.close_profit_abs ?? null;
              const pct = trade.current_profit ?? null;
              const hasOpenOrder = trade.orders?.some((o) => o.status === "open") ?? false;
              const colCount = headers.length;

              return (
                <React.Fragment key={trade.trade_id}>
                  <tr
                    className="hover:bg-bg-3 transition-colors cursor-pointer"
                    onClick={() => setExpandedTradeId(isExpanded ? null : trade.trade_id)}
                  >
                    <td className="px-4 py-3 text-xs font-semibold text-text-0 whitespace-nowrap">{trade.pair}</td>
                    {showBotColumn && (
                      <td className="px-4 py-3 text-xs text-text-2 whitespace-nowrap">
                        {trade._bot_name ?? `Bot ${trade._bot_id}`}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                        trade.is_short ? "bg-red-bg text-red border border-red/20" : "bg-green-bg text-green border border-green/20"
                      }`}>
                        {trade.is_short ? "Short" : "Long"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-2 font-mono whitespace-nowrap">{fmt(trade.open_rate, 4)}</td>
                    <td className="px-4 py-3 text-xs text-text-1 font-mono whitespace-nowrap">{fmt(trade.current_rate, 4)}</td>
                    <td className={`px-4 py-3 text-xs font-bold whitespace-nowrap ${profitColor(pnl)}`}>
                      {pnl != null ? `${pnl >= 0 ? "+" : ""}${fmt(pnl, 2)}` : "\u2014"}
                      {pct != null && (
                        <span className="text-2xs font-normal ml-1 opacity-70">({(pct * 100).toFixed(2)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-3 whitespace-nowrap">{fmtDuration(trade.open_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleForceExit(trade)} disabled={isExiting}
                          className="text-[10px] font-semibold px-2 py-1 rounded border border-red/30 text-red bg-red-bg hover:bg-red/[0.18] hover:border-red transition-all disabled:opacity-50 cursor-pointer"
                          title="Force Exit at Market">
                          {isExiting ? "..." : "Exit"}
                        </button>
                        <button type="button" onClick={() => handleReloadTrade(trade)}
                          className="text-[10px] font-semibold px-2 py-1 rounded border border-border text-text-2 bg-bg-1 hover:bg-bg-3 cursor-pointer transition-all"
                          title="Reload Trade from Exchange">Reload</button>
                        <button type="button"
                          onClick={() => toast.warning(`Delete trade #${trade.trade_id} (${trade.pair})?`, { action: { label: "DELETE", onClick: () => handleDeleteTrade(trade) } })}
                          className="text-[10px] font-semibold px-2 py-1 rounded border border-red/20 text-red/70 bg-bg-1 hover:bg-red-bg hover:text-red cursor-pointer transition-all"
                          title="Delete Trade">Del</button>
                        {hasOpenOrder && (
                          <button type="button" onClick={() => handleCancelOpenOrder(trade)}
                            className="text-[10px] font-semibold px-2 py-1 rounded border border-amber/30 text-amber bg-amber-bg hover:bg-amber/[0.18] cursor-pointer transition-all"
                            title="Cancel Open Order">Cancel Ord</button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`exp-${trade.trade_id}`}>
                      <td colSpan={colCount} className="bg-bg-1 border-b border-border px-4 py-3">
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Trade ID</span>
                            <span className="font-mono text-text-1">#{trade.trade_id}</span>
                          </div>
                          <div>
                            <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">stake_amount</span>
                            <span className="font-mono text-text-1">{fmt(trade.stake_amount, 2)} USDT</span>
                          </div>
                          <div>
                            <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">fee_open</span>
                            <span className="font-mono text-text-1">{fmt((trade.fee_open ?? 0) * 100, 3)}%</span>
                          </div>
                          <div>
                            <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">fee_close</span>
                            <span className="font-mono text-text-1">{fmt((trade.fee_close ?? 0) * 100, 3)}%</span>
                          </div>
                          <div>
                            <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">open_date</span>
                            <span className="font-mono text-text-1">{new Date(trade.open_date).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">enter_tag</span>
                            <span className="font-mono text-text-1">{trade.enter_tag ?? "\u2014"}</span>
                          </div>
                          <div>
                            <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">leverage</span>
                            <span className="font-mono text-text-1">{trade.leverage ?? 1}x</span>
                          </div>
                          {trade.stop_loss && (
                            <div>
                              <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">stop_loss</span>
                              <span className="font-mono text-red">{fmt(trade.stop_loss, 4)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <AppShell title="Dashboard">

      {/* Stale data banner */}
      {staleWarning && (
        <div className="mb-4 px-4 py-3 bg-amber-bg border border-amber/20 rounded-btn flex items-center justify-between">
          <span className="text-xs text-amber font-medium">
            Data may be stale -- last refresh failed {staleCount} times.
          </span>
          <button type="button" onClick={() => loadPortfolioData(true)}
            className="text-xs text-amber underline cursor-pointer hover:no-underline">Retry now</button>
        </div>
      )}

      {/* ═══════════ BACK BUTTON (single bot view only) ═══════════ */}
      {!isAllBotsView && selectedBot && (
        <div className="mb-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSelectedBotId(null)}
            className="text-sm text-accent hover:text-accent/80 font-medium cursor-pointer transition-colors flex items-center gap-1"
          >
            ← All Bots
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text-0">{selectedBot.name}</span>
            <StatusBadge isRunning={selectedBot.status === "running"} isDryRun={selectedBot.is_dry_run} />
            <span className="text-xs text-text-3">{selectedBot.strategy_name ?? "No strategy"}</span>
          </div>
        </div>
      )}

      {/* Force Entry Dialog */}
      <ForceEntryDialog
        open={forceEntryOpen}
        onClose={() => setForceEntryOpen(false)}
        onSubmit={handleForceEntrySubmit}
        submitting={forceEntrySubmitting}
      />

      {/* ═══════════ STAT CARDS (always portfolio-level) ═══════════ */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonStat key={`skel-stat-${i}`} />)
        ) : (
          <>
            <StatCard label="Total Balance" icon="💰"
              value={totalEquity != null ? `$${totalEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "\u2014"}
              sub="Total allocated capital" />
            <StatCard label="Total P&L" icon="📊"
              value={totalUnrealized != null ? fmtMoney(totalUnrealized) : "\u2014"}
              valueColor={profitColor(totalUnrealized)}
              sub="Open positions combined" />
            <StatCard label="Open Trades" icon="📋"
              value={String(openTrades.length)}
              sub={`Across ${runningBotCards.length} bots`} />
            <StatCard label="Active Bots" icon="🤖"
              value={`${runningBotCards.length} / ${bots.length}`}
              sub={runningBotCards.length === bots.length ? "All bots running" : `${bots.length - runningBotCards.length} stopped`} />
            <StatCard label="Win Rate" icon="🎯"
              value={totalWinRate != null ? `${fmt(totalWinRate, 1)}%` : "\u2014"}
              valueColor={totalWinRate != null && totalWinRate >= 55 ? "text-green" : totalWinRate != null && totalWinRate < 45 ? "text-red" : "text-amber"}
              sub="All closed trades" />
          </>
        )}
      </div>

      {/* AI Agreement Badge */}
      {aiEnabled && aiAgreementPct !== null && (
        <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-btn border ${
          aiStrongDisagree > 0 ? "bg-red-bg border-red/25" : "bg-accent/[0.08] border-accent/25"
        }`}>
          <span className="text-xl">{aiStrongDisagree > 0 ? "⚠️" : "🤖"}</span>
          <div className="flex-1">
            <span className={`text-xs font-semibold ${aiStrongDisagree > 0 ? "text-red" : "text-accent"}`}>
              AI Agreement (7d): <strong>{aiAgreementPct.toFixed(1)}%</strong> all-agree
              {aiStrongDisagree > 0 && (
                <span className="text-red">
                  {" "}&middot; {aiStrongDisagree} strong disagreement{aiStrongDisagree > 1 ? "s" : ""}
                </span>
              )}
            </span>
            {aiStrongDisagree > 0 && (
              <p className="text-2xs text-text-3 mt-0.5">
                Claude and Grok both disagreed with FreqAI on {aiStrongDisagree} recent signal{aiStrongDisagree > 1 ? "s" : ""}. Review in AI Insights.
              </p>
            )}
          </div>
          <a href="/ai-insights" className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors">
            View AI Insights →
          </a>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ALL BOTS VIEW (default when selectedBotId === null)            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isAllBotsView && (
        <>
          {/* Empty state: no bots registered */}
          {!loading && bots.length === 0 && (
            <div className="mb-6">
              <BotManagementTable bots={bots} botProfits={botProfits} onRefresh={() => loadPortfolioData(true)} />
            </div>
          )}

          {/* Bot Cards Grid — click to drill down */}
          {!loading && bots.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-0">Bots</h2>
                <div className="flex items-center gap-3">
                  <span className="text-2xs text-text-3">
                    {runningBotCards.length} of {bots.length} running &middot; Click a bot for details
                  </span>
                  <button type="button" onClick={() => setShowManagement(!showManagement)}
                    className="text-2xs font-semibold text-accent hover:text-accent/80 cursor-pointer transition-colors">
                    {showManagement ? "Hide Management" : "Manage Bots"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                {bots.map((bot) => (
                  <BotCard
                    key={bot.id}
                    bot={bot}
                    profit={botProfits[bot.id] ?? null}
                    sparkData={sparklines[bot.id] ?? []}
                    openCount={openByBot[bot.id] ?? 0}
                    onClick={() => setSelectedBotId(bot.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bot Management Table (toggled) */}
          {showManagement && (
            <div className="mb-6">
              <BotManagementTable bots={bots} botProfits={botProfits} onRefresh={() => loadPortfolioData(false)} />
            </div>
          )}

          {/* Open Positions Table — ALL bots */}
          <Card className="mb-6">
            <CardHeader title="Open Positions" icon="📋"
              action={
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-3">
                    {openTrades.length} positions across {runningBotCards.length} bots
                  </span>
                  <button type="button" onClick={() => loadPortfolioData(false)}
                    className="text-xs text-accent hover:text-accent cursor-pointer font-medium">↻ Refresh</button>
                </div>
              } />
            {loading ? (
              <SkeletonTable rows={5} cols={8} />
            ) : bots.length > 0 && runningBotCards.length === 0 ? (
              <CardBody><div className="py-8 text-center text-sm text-text-3">No running bots</div></CardBody>
            ) : (
              renderTradesTable(openTrades, true, "No open positions")
            )}
          </Card>

          {/* Daily P&L + Equity Curve */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <Card>
              <CardHeader title="Daily P&L" icon="📊"
                action={
                  <div className="flex gap-0.5">
                    {([7, 14, 30] as const).map((p) => (
                      <button key={p} type="button" onClick={() => setDailyPeriod(p)}
                        className={`px-2 py-0.5 text-2xs rounded cursor-pointer font-medium transition-all ${
                          dailyPeriod === p ? "bg-accent text-white" : "text-text-3 hover:text-text-1"
                        }`}>{p}d</button>
                    ))}
                  </div>
                } />
              {loading ? <SkeletonChart height={160} /> : (
                <CardBody>
                  <div className="flex items-end gap-1 h-28">
                    {dailyData.slice(-dailyPeriod).map((item, i) => {
                      const val = item.abs_profit;
                      const max = Math.max(...dailyData.map((x) => Math.abs(x.abs_profit)), 0.01);
                      const pct = Math.max(5, (Math.abs(val) / max) * 100);
                      return (
                        <div key={item.date ?? `day-${i}`} className="flex-1 flex flex-col items-center gap-0.5" title={`${item.date.slice(5)}: ${val >= 0 ? "+" : ""}${val.toFixed(2)} USDT`}>
                          <div className={`w-full rounded-[2px] ${val >= 0 ? "bg-green" : "bg-red"} opacity-70`} style={{ height: `${pct}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-right text-2xs text-text-3">
                    Total (all bots): <span className={`font-bold ${profitColor(totalClosedProfit)}`}>{fmtMoney(totalClosedProfit)}</span>
                  </div>
                </CardBody>
              )}
            </Card>

            <Card>
              <CardHeader title="Equity Curve (30d)" icon="📈" />
              {loading ? <SkeletonChart height={160} /> : (
                <CardBody className="p-3">
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`} />
                      <Tooltip contentStyle={{ background: "#12121c", border: "1px solid #1e1e30", borderRadius: 6, fontSize: 11 }}
                        formatter={(v: unknown) => { const n = Number(v); return [`${n >= 0 ? "+" : ""}${n.toFixed(2)} USDT`, "Cum. P&L"]; }} />
                      <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#equityGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardBody>
              )}
            </Card>
          </div>

          {/* Recent Alerts + System Health */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <Card>
              <CardHeader title="Recent Alerts" icon="🔔"
                action={<a href="/risk" className="text-xs text-accent hover:text-accent font-medium">View All →</a>} />
              <CardBody className="p-0">
                {riskEvents.length === 0 ? (
                  <div className="py-6 text-center text-sm text-text-3">No recent alerts</div>
                ) : (
                  riskEvents.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-bg-3 transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${ev.kill_type === "HARD_KILL" ? "bg-red" : "bg-amber"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-text-0 truncate">{ev.reason ?? ev.trigger}</div>
                        <div className="text-2xs text-text-3 mt-0.5">{new Date(ev.created_at).toLocaleString()} -- {ev.triggered_by}</div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${
                        ev.kill_type === "HARD_KILL" ? "bg-red-bg text-red" : "bg-amber-bg text-amber"
                      }`}>{ev.kill_type.replace("_", " ")}</span>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="System Health" icon="❤️" />
              <CardBody>
                {loading ? <SkeletonTable rows={3} cols={3} /> : (
                  <div className="grid grid-cols-1 gap-2">
                    {bots.map((bot) => (
                      <div key={bot.id}
                        className="flex items-center gap-3 px-3 py-2 bg-bg-1 border border-border rounded-lg cursor-pointer hover:border-accent transition-colors"
                        onClick={() => setSelectedBotId(bot.id)}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          bot.status === "running" && bot.is_healthy ? "bg-green shadow-[0_0_6px_#22c55e]"
                            : bot.status === "error" || !bot.is_healthy ? "bg-red animate-pulse" : "bg-amber"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-text-0">{bot.name}</div>
                          <div className="text-2xs text-text-3">
                            {bot.consecutive_failures > 0
                              ? `${bot.consecutive_failures} failure${bot.consecutive_failures > 1 ? "s" : ""}`
                              : bot.status}
                          </div>
                        </div>
                        <StatusBadge isRunning={bot.status === "running"} isDryRun={bot.is_dry_run} />
                      </div>
                    ))}
                    {bots.length === 0 && (
                      <div className="py-4 text-center text-sm text-text-3">No bots registered</div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Today's Closed Trades */}
          <Card className="mb-6">
            <CardHeader title="Today's Closed Trades" icon="✅"
              action={<span className="text-xs text-text-3">{closedTrades.length} trade{closedTrades.length !== 1 ? "s" : ""} closed today</span>} />
            {loading ? <SkeletonTable rows={5} cols={6} /> : closedTrades.length === 0 ? (
              <CardBody><div className="py-8 text-center text-sm text-text-3">No trades closed today</div></CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["Pair", "Bot", "Side", "open_rate", "close_rate", "close_profit_abs", "exit_reason", "Duration"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {closedTrades.map((trade) => (
                      <tr key={trade.trade_id} className="hover:bg-bg-3 transition-colors">
                        <td className="px-4 py-3 text-xs font-semibold text-text-0">{trade.pair}</td>
                        <td className="px-4 py-3 text-xs text-text-2">{trade._bot_name ?? `Bot ${trade._bot_id}`}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${trade.is_short ? "bg-red-bg text-red" : "bg-green-bg text-green"}`}>
                            {trade.is_short ? "Short" : "Long"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-2 font-mono">{fmt(trade.open_rate, 4)}</td>
                        <td className="px-4 py-3 text-xs text-text-2 font-mono">{fmt(trade.close_rate ?? 0, 4)}</td>
                        <td className={`px-4 py-3 text-xs font-bold ${profitColor(trade.close_profit_abs)}`}>
                          {trade.close_profit_abs != null ? `${trade.close_profit_abs >= 0 ? "+" : ""}${fmt(trade.close_profit_abs, 2)} USDT` : "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-2">{trade.exit_reason ?? "\u2014"}</td>
                        <td className="px-4 py-3 text-xs text-text-3">
                          {trade.close_date && trade.open_date
                            ? (() => { const ms = new Date(trade.close_date).getTime() - new Date(trade.open_date).getTime(); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; })()
                            : "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SINGLE BOT VIEW (when user clicks a bot card)                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {!isAllBotsView && selectedBotId && (
        <>
          {/* Bot Control Toolbar */}
          <Card className="mb-6">
            <CardHeader title="Bot Control" icon="🎮" />
            <CardBody className="p-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={controlLoading !== null}
                  onClick={() => handleBotAction("Start Bot", selectedBotId, () => startBot(selectedBotId))}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-green/30 text-green bg-green-bg hover:bg-green/[0.18] disabled:opacity-50 cursor-pointer transition-all">
                  {controlLoading === "Start Bot" ? "..." : "Start"}</button>
                <button type="button" disabled={controlLoading !== null}
                  onClick={() => handleBotAction("Stop Bot", selectedBotId, () => stopBot(selectedBotId))}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-red/30 text-red bg-red-bg hover:bg-red/[0.18] disabled:opacity-50 cursor-pointer transition-all">
                  {controlLoading === "Stop Bot" ? "..." : "Stop"}</button>
                <button type="button" disabled={controlLoading !== null}
                  onClick={() => handleBotAction("Stop Buy", selectedBotId, () => botStopBuy(selectedBotId))}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-amber/30 text-amber bg-amber-bg hover:bg-amber/[0.18] disabled:opacity-50 cursor-pointer transition-all">
                  {controlLoading === "Stop Buy" ? "..." : "Stop New Entries"}</button>
                <button type="button" disabled={controlLoading !== null}
                  onClick={() => handleBotAction("Pause", selectedBotId, () => botPause(selectedBotId))}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-amber/30 text-amber bg-amber-bg hover:bg-amber/[0.18] disabled:opacity-50 cursor-pointer transition-all">
                  {controlLoading === "Pause" ? "..." : "Pause"}</button>
                <button type="button" disabled={controlLoading !== null}
                  onClick={() => setForceEntryOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-accent/30 text-accent bg-accent/10 hover:bg-accent/20 disabled:opacity-50 cursor-pointer transition-all">
                  Force Entry</button>
                <button type="button" disabled={controlLoading !== null || singleBotOpenTrades.length === 0}
                  onClick={async () => {
                    if (!selectedBotId || singleBotOpenTrades.length === 0) return;
                    setControlLoading("Force Exit All");
                    const loadId = toast.loading(`Force exiting all ${singleBotOpenTrades.length} trades...`);
                    try {
                      await Promise.allSettled(
                        singleBotOpenTrades.map((t) => botForceExit(selectedBotId, String(t.trade_id)))
                      );
                      toast.dismiss(loadId);
                      toast.success(`Force exit submitted for ${singleBotOpenTrades.length} trades.`);
                      await loadPortfolioData(false);
                      loadBotDetails(selectedBotId);
                    } catch (err) {
                      toast.dismiss(loadId);
                      toast.error(err instanceof Error ? err.message : "Force exit failed.");
                    } finally {
                      setControlLoading(null);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-red/30 text-red bg-red-bg hover:bg-red/[0.18] disabled:opacity-50 cursor-pointer transition-all">
                  {controlLoading === "Force Exit All" ? "..." : `Force Exit All (${singleBotOpenTrades.length})`}</button>
                <button type="button" disabled={controlLoading !== null}
                  onClick={() => handleBotAction("Reload Config", selectedBotId, () => reloadBotConfig(selectedBotId))}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-border text-text-2 bg-bg-1 hover:bg-bg-3 disabled:opacity-50 cursor-pointer transition-all">
                  {controlLoading === "Reload Config" ? "..." : "Reload Config"}</button>
              </div>
            </CardBody>
          </Card>

          {/* Single bot open positions */}
          <Card className="mb-6">
            <CardHeader title="Open Positions" icon="📋"
              action={<span className="text-xs text-text-3">{singleBotOpenTrades.length} open</span>} />
            {singleBotOpenLoading ? <SkeletonTable rows={3} cols={7} /> : renderTradesTable(singleBotOpenTrades, false, "No open positions")}
          </Card>

          {/* Weekly P&L + Monthly P&L */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <Card>
              <CardHeader title="Weekly P&L" icon="📅" />
              <SectionLoader loading={weeklyLoading} error={weeklyError}>
                <CardBody className="p-3">
                  {weeklyData && weeklyData.data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={weeklyData.data.map((w) => ({ ...w, date: w.date.slice(5) }))}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip contentStyle={{ background: "#12121c", border: "1px solid #1e1e30", borderRadius: 6, fontSize: 11 }}
                          formatter={(v: unknown) => [`${Number(v).toFixed(2)} ${weeklyData.stake_currency}`, "Profit"]} />
                        <Bar dataKey="abs_profit" fill="#22c55e" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="py-4 text-center text-sm text-text-3">No weekly data</div>}
                </CardBody>
              </SectionLoader>
            </Card>
            <Card>
              <CardHeader title="Monthly P&L" icon="📆" />
              <SectionLoader loading={monthlyLoading} error={monthlyError}>
                <CardBody className="p-3">
                  {monthlyData && monthlyData.data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={monthlyData.data.map((mo) => ({ ...mo, date: mo.date.slice(0, 7) }))}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip contentStyle={{ background: "#12121c", border: "1px solid #1e1e30", borderRadius: 6, fontSize: 11 }}
                          formatter={(v: unknown) => [`${Number(v).toFixed(2)} ${monthlyData.stake_currency}`, "Profit"]} />
                        <Bar dataKey="abs_profit" fill="#818cf8" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="py-4 text-center text-sm text-text-3">No monthly data</div>}
                </CardBody>
              </SectionLoader>
            </Card>
          </div>

          {/* Per-pair Performance + Trade Stats */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <Card>
              <CardHeader title="Per-pair Performance" icon="📊" />
              <SectionLoader loading={perfLoading} error={perfError}>
                {perfData.length === 0 ? (
                  <CardBody><div className="py-4 text-center text-sm text-text-3">No performance data</div></CardBody>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead><tr>
                        {["Pair", "Trades", "profit_abs", "profit_ratio"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {perfData.slice(0, 20).map((p) => (
                          <tr key={p.pair} className="hover:bg-bg-3 transition-colors">
                            <td className="px-4 py-2 text-xs font-semibold text-text-0">{p.pair}</td>
                            <td className="px-4 py-2 text-xs text-text-2">{p.count}</td>
                            <td className={`px-4 py-2 text-xs font-bold ${profitColor(p.profit_abs)}`}>{fmt(p.profit_abs, 2)}</td>
                            <td className={`px-4 py-2 text-xs ${profitColor(p.profit_ratio)}`}>{(p.profit_ratio * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionLoader>
            </Card>
            <Card>
              <CardHeader title="Trade Stats" icon="📈" />
              <SectionLoader loading={statsLoading} error={statsError}>
                {statsData ? (
                  <CardBody>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">profit_factor</span><span className="font-mono text-text-1 font-bold">{fmt(statsData.profit_factor, 2)}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">trading_volume</span><span className="font-mono text-text-1">{fmt(statsData.trading_volume, 2)}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Wins / Losses / Draws</span><span className="font-mono"><span className="text-green">{statsData.wins}</span>{" / "}<span className="text-red">{statsData.losses}</span>{" / "}<span className="text-text-3">{statsData.draws}</span></span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">max_drawdown</span><span className="font-mono text-red">{statsData.max_drawdown != null ? `${(statsData.max_drawdown * 100).toFixed(2)}%` : "\u2014"}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Avg Duration (wins)</span><span className="font-mono text-text-1">{statsData.durations.wins != null ? `${(statsData.durations.wins / 60).toFixed(1)}m` : "\u2014"}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Avg Duration (losses)</span><span className="font-mono text-text-1">{statsData.durations.losses != null ? `${(statsData.durations.losses / 60).toFixed(1)}m` : "\u2014"}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Max Consecutive Wins</span><span className="font-mono text-green">{statsData.max_consecutive_wins ?? "\u2014"}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Max Consecutive Losses</span><span className="font-mono text-red">{statsData.max_consecutive_losses ?? "\u2014"}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">rejected_signals</span><span className="font-mono text-text-1">{statsData.rejected_signals}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">timedout_entry_orders</span><span className="font-mono text-text-1">{statsData.timedout_entry_orders}</span></div>
                    </div>
                  </CardBody>
                ) : <CardBody><div className="py-4 text-center text-sm text-text-3">No stats data</div></CardBody>}
              </SectionLoader>
            </Card>
          </div>

          {/* Entry Tag + Exit Reason Analysis */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <Card>
              <CardHeader title="Entry Tag Analysis" icon="🏷" />
              <SectionLoader loading={entryLoading} error={entryError}>
                {entryData.length === 0 ? <CardBody><div className="py-4 text-center text-sm text-text-3">No entry tag data</div></CardBody> : (
                  <div className="overflow-x-auto"><table className="w-full border-collapse">
                    <thead><tr>{["enter_tag", "Entries", "Wins", "Losses", "winrate", "profit_abs"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border">{h}</th>
                    ))}</tr></thead>
                    <tbody>{entryData.map((e) => (
                      <tr key={e.enter_tag} className="hover:bg-bg-3 transition-colors">
                        <td className="px-4 py-2 text-xs font-semibold text-text-0">{e.enter_tag}</td>
                        <td className="px-4 py-2 text-xs text-text-2">{e.entries}</td>
                        <td className="px-4 py-2 text-xs text-green">{e.wins}</td>
                        <td className="px-4 py-2 text-xs text-red">{e.losses}</td>
                        <td className="px-4 py-2 text-xs text-text-1">{(e.winrate * 100).toFixed(1)}%</td>
                        <td className={`px-4 py-2 text-xs font-bold ${profitColor(e.profit_abs)}`}>{fmt(e.profit_abs, 2)}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </SectionLoader>
            </Card>
            <Card>
              <CardHeader title="Exit Reason Analysis" icon="🚪" />
              <SectionLoader loading={exitLoading} error={exitError}>
                {exitData.length === 0 ? <CardBody><div className="py-4 text-center text-sm text-text-3">No exit reason data</div></CardBody> : (
                  <div className="overflow-x-auto"><table className="w-full border-collapse">
                    <thead><tr>{["exit_reason", "Exits", "Wins", "Losses", "winrate", "profit_abs"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border">{h}</th>
                    ))}</tr></thead>
                    <tbody>{exitData.map((e) => (
                      <tr key={e.exit_reason} className="hover:bg-bg-3 transition-colors">
                        <td className="px-4 py-2 text-xs font-semibold text-text-0">{e.exit_reason}</td>
                        <td className="px-4 py-2 text-xs text-text-2">{e.exits}</td>
                        <td className="px-4 py-2 text-xs text-green">{e.wins}</td>
                        <td className="px-4 py-2 text-xs text-red">{e.losses}</td>
                        <td className="px-4 py-2 text-xs text-text-1">{(e.winrate * 100).toFixed(1)}%</td>
                        <td className={`px-4 py-2 text-xs font-bold ${profitColor(e.profit_abs)}`}>{fmt(e.profit_abs, 2)}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </SectionLoader>
            </Card>
          </div>

          {/* Mix Tag Analysis */}
          <Card className="mb-6">
            <CardHeader title="Mix Tag Analysis" icon="🔀" />
            <SectionLoader loading={mixTagLoading} error={mixTagError}>
              {mixTagData.length === 0 ? <CardBody><div className="py-4 text-center text-sm text-text-3">No mix tag data</div></CardBody> : (
                <div className="overflow-x-auto"><table className="w-full border-collapse">
                  <thead><tr>{["enter_tag", "exit_reason", "Trades", "Wins", "Losses", "winrate", "profit_abs"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border">{h}</th>
                  ))}</tr></thead>
                  <tbody>{mixTagData.slice(0, 30).map((m, i) => (
                    <tr key={`${m.enter_tag}-${m.exit_reason}-${i}`} className="hover:bg-bg-3 transition-colors">
                      <td className="px-4 py-2 text-xs font-semibold text-text-0">{m.enter_tag}</td>
                      <td className="px-4 py-2 text-xs text-text-2">{m.exit_reason}</td>
                      <td className="px-4 py-2 text-xs text-text-2">{m.trades}</td>
                      <td className="px-4 py-2 text-xs text-green">{m.wins}</td>
                      <td className="px-4 py-2 text-xs text-red">{m.losses}</td>
                      <td className="px-4 py-2 text-xs text-text-1">{(m.winrate * 100).toFixed(1)}%</td>
                      <td className={`px-4 py-2 text-xs font-bold ${profitColor(m.profit_abs)}`}>{fmt(m.profit_abs, 2)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </SectionLoader>
          </Card>

          {/* Bot Balance */}
          <Card className="mb-6">
            <CardHeader title="Wallet Balance" icon="💰" />
            <SectionLoader loading={balanceLoading} error={balanceError}>
              {balanceData ? (
                <CardBody>
                  <div className="grid grid-cols-4 gap-4 text-xs mb-4">
                    <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Total</span><span className="font-mono text-text-0 font-bold">{fmt(balanceData.total, 4)} {balanceData.stake}</span></div>
                    <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Estimated Value</span><span className="font-mono text-text-0">${fmt(balanceData.value, 2)}</span></div>
                    <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Stake Currency</span><span className="font-mono text-text-0">{balanceData.stake}</span></div>
                    <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">Starting Capital</span><span className="font-mono text-text-0">{balanceData.starting_capital != null ? `${fmt(balanceData.starting_capital, 2)} ${balanceData.stake}` : "\u2014"}</span></div>
                  </div>
                  {balanceData.currencies.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead><tr>
                          {["Currency", "Free", "Used", "Balance", "Est. Stake"].map((h) => (
                            <th key={h} className="text-left px-3 py-2 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {balanceData.currencies.filter((c) => c.balance > 0).map((c) => (
                            <tr key={c.currency} className="hover:bg-bg-3 transition-colors">
                              <td className="px-3 py-2 text-xs font-semibold text-text-0">{c.currency}</td>
                              <td className="px-3 py-2 text-xs text-text-2 font-mono">{fmt(c.free, 4)}</td>
                              <td className="px-3 py-2 text-xs text-text-2 font-mono">{fmt(c.used, 4)}</td>
                              <td className="px-3 py-2 text-xs text-text-1 font-mono">{fmt(c.balance, 4)}</td>
                              <td className="px-3 py-2 text-xs text-text-2 font-mono">{fmt(c.est_stake, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              ) : <CardBody><div className="py-4 text-center text-sm text-text-3">No balance data</div></CardBody>}
            </SectionLoader>
          </Card>

          {/* Bot Config + System Info */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <Card>
              <CardHeader title="Bot Config" icon="⚙️" />
              <SectionLoader loading={configLoading} error={configError}>
                {configData ? (
                  <CardBody>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">strategy</span><span className="font-mono text-text-1 font-bold">{configData.strategy}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">exchange</span><span className="font-mono text-text-1">{typeof configData.exchange === "string" ? configData.exchange : configData.exchange?.name ?? "\u2014"}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">timeframe</span><span className="font-mono text-text-1">{configData.timeframe}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">trading_mode</span><span className="font-mono text-text-1">{configData.trading_mode}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">stake_currency</span><span className="font-mono text-text-1">{configData.stake_currency}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">stake_amount</span><span className="font-mono text-text-1">{configData.stake_amount}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">max_open_trades</span><span className="font-mono text-text-1">{configData.max_open_trades}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">stoploss</span><span className="font-mono text-red">{(configData.stoploss * 100).toFixed(1)}%</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">dry_run</span><span className={`font-mono ${configData.dry_run ? "text-amber" : "text-green"}`}>{configData.dry_run ? "Yes" : "No"}</span></div>
                      <div><span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">trailing_stop</span><span className="font-mono text-text-1">{configData.trailing_stop ? "On" : "Off"}</span></div>
                    </div>
                  </CardBody>
                ) : <CardBody><div className="py-4 text-center text-sm text-text-3">No config data</div></CardBody>}
              </SectionLoader>
            </Card>
            <Card>
              <CardHeader title="System Info" icon="💻" />
              <SectionLoader loading={sysinfoLoading} error={sysinfoError}>
                {sysinfoData ? (
                  <CardBody>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">CPU Usage</span>
                        <div className="flex gap-1 items-center">
                          {sysinfoData.cpu_pct.map((pct, i) => (
                            <div key={`cpu-${i}`} className="flex-1">
                              <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct > 80 ? "bg-red" : pct > 50 ? "bg-amber" : "bg-green"}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <span className="font-mono text-text-1 text-2xs mt-1 block">
                          {sysinfoData.cpu_pct.length > 0 ? `Avg: ${(sysinfoData.cpu_pct.reduce((a, b) => a + b, 0) / sysinfoData.cpu_pct.length).toFixed(1)}%` : "\u2014"}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-3 block text-2xs uppercase tracking-wide mb-0.5">RAM Usage</span>
                        <div className="h-2 bg-bg-3 rounded-full overflow-hidden mb-1">
                          <div className={`h-full rounded-full ${sysinfoData.ram_pct > 80 ? "bg-red" : sysinfoData.ram_pct > 50 ? "bg-amber" : "bg-green"}`} style={{ width: `${sysinfoData.ram_pct}%` }} />
                        </div>
                        <span className="font-mono text-text-1 text-2xs">{sysinfoData.ram_pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardBody>
                ) : <CardBody><div className="py-4 text-center text-sm text-text-3">No system info</div></CardBody>}
              </SectionLoader>
            </Card>
          </div>

          {/* Bot Logs */}
          <Card className="mb-6">
            <CardHeader title="Bot Logs" icon="📜"
              action={
                <button type="button" onClick={() => {
                  setLogsLoading(true);
                  botLogs(selectedBotId, 100)
                    .then((d) => { setLogsData(d); setLogsLoading(false); })
                    .catch((e) => { setLogsError(e instanceof Error ? e.message : "Failed"); setLogsLoading(false); });
                }} className="text-xs text-accent hover:text-accent cursor-pointer font-medium">↻ Refresh</button>
              } />
            <SectionLoader loading={logsLoading} error={logsError}>
              <div className="max-h-64 overflow-y-auto bg-bg-1 font-mono text-2xs p-4">
                {logsData && logsData.logs.length > 0 ? (
                  logsData.logs.map((log, i) => {
                    const level = log[1] ?? "";
                    const levelColor = level === "ERROR" ? "text-red" : level === "WARNING" ? "text-amber" : "text-text-3";
                    return (
                      <div key={`log-${log[0] ?? i}`} className="py-0.5 border-b border-border/20 last:border-b-0">
                        <span className="text-text-3">{log[0]}</span>{" "}
                        <span className={`font-bold ${levelColor}`}>{level}</span>{" "}
                        <span className="text-text-2">{log[2]}</span>{" "}
                        <span className="text-text-1">{log[3]}</span>
                      </div>
                    );
                  })
                ) : <div className="text-center text-text-3">No logs available</div>}
              </div>
            </SectionLoader>
          </Card>

          {/* Whitelist + Locks */}
          <div className="grid grid-cols-2 gap-5 mb-6">
            <Card>
              <CardHeader title="Whitelist" icon="📝" />
              <SectionLoader loading={whitelistLoading} error={whitelistError}>
                <CardBody>
                  {whitelistData && whitelistData.whitelist.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {whitelistData.whitelist.map((pair) => (
                        <span key={pair} className="text-2xs font-mono bg-bg-1 border border-border rounded px-2 py-1 text-text-1">{pair}</span>
                      ))}
                    </div>
                  ) : <div className="py-4 text-center text-sm text-text-3">Empty whitelist</div>}
                  {whitelistData && (
                    <div className="mt-2 text-2xs text-text-3">{whitelistData.length} pair{whitelistData.length !== 1 ? "s" : ""} | Method: {whitelistData.method.join(", ")}</div>
                  )}
                </CardBody>
              </SectionLoader>
            </Card>
            <Card>
              <CardHeader title="Locks" icon="🔒" />
              <SectionLoader loading={locksLoading} error={locksError}>
                {locksData && locksData.locks.length > 0 ? (
                  <div className="overflow-x-auto"><table className="w-full border-collapse">
                    <thead><tr>{["Pair", "Reason", "Until", "Side"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border">{h}</th>
                    ))}</tr></thead>
                    <tbody>{locksData.locks.map((lock) => (
                      <tr key={lock.id} className="hover:bg-bg-3 transition-colors">
                        <td className="px-4 py-2 text-xs font-semibold text-text-0">{lock.pair}</td>
                        <td className="px-4 py-2 text-xs text-text-2">{lock.reason}</td>
                        <td className="px-4 py-2 text-xs text-text-3">{new Date(lock.lock_end_time).toLocaleString()}</td>
                        <td className="px-4 py-2 text-xs text-text-2">{lock.side}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                ) : <CardBody><div className="py-4 text-center text-sm text-text-3">No active locks</div></CardBody>}
              </SectionLoader>
            </Card>
          </div>

          {/* Single bot closed trades */}
          <Card className="mb-6">
            <CardHeader title="Closed Trades" icon="✅"
              action={<span className="text-xs text-text-3">{singleBotClosedTrades.length} trades</span>} />
            {singleBotClosedLoading ? <SkeletonTable rows={5} cols={7} /> : singleBotClosedTrades.length === 0 ? (
              <CardBody><div className="py-8 text-center text-sm text-text-3">No closed trades</div></CardBody>
            ) : (
              <div className="overflow-x-auto"><table className="w-full border-collapse">
                <thead><tr>{["Pair", "Side", "open_rate", "close_rate", "close_profit_abs", "exit_reason", "Duration"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>{singleBotClosedTrades.slice(0, 50).map((trade) => (
                  <tr key={trade.trade_id} className="hover:bg-bg-3 transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold text-text-0">{trade.pair}</td>
                    <td className="px-4 py-3"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${trade.is_short ? "bg-red-bg text-red" : "bg-green-bg text-green"}`}>{trade.is_short ? "Short" : "Long"}</span></td>
                    <td className="px-4 py-3 text-xs text-text-2 font-mono">{fmt(trade.open_rate, 4)}</td>
                    <td className="px-4 py-3 text-xs text-text-2 font-mono">{fmt(trade.close_rate ?? 0, 4)}</td>
                    <td className={`px-4 py-3 text-xs font-bold ${profitColor(trade.close_profit_abs)}`}>{trade.close_profit_abs != null ? `${trade.close_profit_abs >= 0 ? "+" : ""}${fmt(trade.close_profit_abs, 2)} USDT` : "\u2014"}</td>
                    <td className="px-4 py-3 text-xs text-text-2">{trade.exit_reason ?? "\u2014"}</td>
                    <td className="px-4 py-3 text-xs text-text-3">{trade.close_date && trade.open_date ? (() => { const ms = new Date(trade.close_date).getTime() - new Date(trade.open_date).getTime(); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; })() : "\u2014"}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </>
      )}

      {/* Activity Log Viewer (both views) */}
      <LogViewer
        bots={bots}
        defaultBotId={selectedBotId ?? undefined}
        collapsed={true}
      />
    </AppShell>
  );
}
