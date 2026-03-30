"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
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
  botForceEnter,
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
  botHealth,
  drainBot,
} from "@/lib/api";
import type {
  Bot,
  FTHealth,
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
} from "recharts";

import { fmt, fmtMoney, profitColor } from "@/lib/format";
import LogViewer from "@/components/dashboard/LogViewer";
import BotManagementTable from "@/components/bots/BotManagementTable";
import BotDetailPanel from "@/components/dashboard/BotDetailPanel";
import BotEditModal from "@/components/bots/BotEditModal";
import BotDeleteDialog from "@/components/bots/BotDeleteDialog";
import { registerBot, deleteBot as deleteBotApi } from "@/lib/api";

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

function StatusBadge({ status, isDryRun }: { status: string; isDryRun: boolean }) {
  if (status === "draining") {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500-500 uppercase tracking-wide border border-amber-500-500-500/20 animate-pulse">
        Draining
      </span>
    );
  }
  if (status !== "running") {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide border border-border">
        Stopped
      </span>
    );
  }
  if (isDryRun) {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500-500 uppercase tracking-wide border border-amber-500-500-500/20">
        Paper
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase tracking-wide border border-emerald-500/20">
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-xs font-semibold tracking-tight text-muted-foreground uppercase">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardBody>
        <div className={`text-2xl font-bold tracking-tight ${valueColor ?? "text-foreground"}`}>
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-1 opacity-80">{sub}</div>}
      </CardBody>
    </Card>
  );
}

// ── Bot Card (clickable) ─────────────────────────────────────────────────

function BotCard({
  bot,
  profit,
  sparkData,
  openCount,
  onClick,
  onDrain,
}: {
  bot: Bot;
  profit: Partial<FTProfit> | null;
  sparkData: number[];
  openCount: number;
  onClick: () => void;
  onDrain?: (botId: number) => void;
}) {
  const isRunning = bot.status === "running";
  return (
    <Card
      className={`relative cursor-pointer transition-all hover:bg-muted/50 hover:-translate-y-[1px] ${
        bot.status === "error"
          ? "border-rose-500/50 shadow-[0_0_15px_-3px_rgba(244,63,94,0.1)]"
          : isRunning
          ? "hover:border-primary/50"
          : "opacity-80 hover:opacity-100"
      }`}
      onClick={onClick}
    >
      <CardBody className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm font-bold text-foreground truncate">{bot.name}</div>
            {bot.exchange_name && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
                {bot.exchange_name}
              </span>
            )}
          </div>
          <StatusBadge status={bot.status} isDryRun={bot.is_dry_run} />
        </div>
        
        <div className="text-xs text-muted-foreground truncate">
          {bot.strategy_name ?? "No strategy"}
          {bot.strategy_version_id && <span className="text-foreground/50 ml-1">v{bot.strategy_version_id}</span>}
        </div>

        <div className="grid grid-cols-3 gap-2 py-1">
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">P&L</div>
            <div className={`text-sm font-bold ${profitColor(profit?.profit_closed_coin)}`}>
              {profit ? `${fmt(profit.profit_closed_coin)}` : "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Win Rate</div>
            <div className="text-sm font-bold text-foreground">
              {profit && ((profit.winning_trades ?? 0) + (profit.losing_trades ?? 0)) > 0
                ? `${(((profit.winning_trades ?? 0) / ((profit.winning_trades ?? 0) + (profit.losing_trades ?? 0))) * 100).toFixed(1)}%`
                : "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Trades</div>
            <div className="text-sm font-bold text-foreground">{openCount}</div>
          </div>
        </div>

        {sparkData.length > 0 && (
          <div className="mt-1 h-10 w-full opacity-80 mix-blend-screen">
            <Sparkline data={sparkData} />
          </div>
        )}

        {isRunning && onDrain && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDrain(bot.id);
            }}
            className="mt-2 w-full text-xs font-bold px-3 py-2 rounded-md border border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-all uppercase tracking-wider"
          >
            Drain Bot
          </button>
        )}
      </CardBody>
    </Card>
  );
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all" onClick={onClose}>
      <Card
        className="w-[400px] shadow-2xl scale-100 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="border-b border-border/10 pb-4">
          <CardTitle>Force Entry</CardTitle>
          <CardDescription>Manually trigger a trade on the active bot.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trading Pair</label>
            <input
              type="text"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="e.g., BTC/USDT:USDT"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide("long")}
                className={`py-2 text-xs font-bold rounded-md border cursor-pointer transition-all uppercase tracking-wider ${
                  side === "long"
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Long
              </button>
              <button
                type="button"
                onClick={() => setSide("short")}
                className={`py-2 text-xs font-bold rounded-md border cursor-pointer transition-all uppercase tracking-wider ${
                  side === "short"
                    ? "bg-rose-500/15 text-rose-500 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                Short
              </button>
            </div>
          </div>
          
          <div className="space-y-1.5 pt-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Stake Amount <span className="opacity-50 font-normal normal-case">(Optional)</span>
            </label>
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="Leave blank for bot default"
              step="0.001"
              min="0"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          
          <div className="flex gap-2 pt-6 justify-end border-t border-border/10 mt-4">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold rounded-md border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!pair) {
                  return;
                }
                const st = parseFloat(stake);
                onSubmit(pair, side, isNaN(st) || st <= 0 ? undefined : st);
              }}
              disabled={submitting || !pair}
              className="px-4 py-2 text-sm font-semibold rounded-md border border-primary/50 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Entering..." : "Execute Entry"}
            </button>
          </div>
        </CardBody>
      </Card>
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
  const detailBotIdRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [bots, setBots] = useState<Bot[]>([]);
  const [openTrades, setOpenTrades] = useState<FTTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<FTTrade[]>([]);
  const [botProfits, setBotProfits] = useState<Record<number, Partial<FTProfit>>>({});
  const [sparklines, setSparklines] = useState<Record<number, number[]>>({});
  const [openByBot, setOpenByBot] = useState<Record<number, number>>({});
  const [dailyData, setDailyData] = useState<FTDailyItem[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);

  // Portfolio aggregates
  const [totalEquity, setTotalEquity] = useState<number | null>(null);
  const [totalPnl, setTotalPnl] = useState<number | null>(null);
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
  const [forceEntryOpen, setForceEntryOpen] = useState(false);
  const [forceEntrySubmitting, setForceEntrySubmitting] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [botStatusFilter, setBotStatusFilter] = useState<"all" | "running" | "stopped">("all");

  // Single-bot detail sections — data passed to BotDetailPanel, setters used in loadBotDetails.
  // Some read-side variables appear unused here because they're consumed only inside the panel.
  /* eslint-disable @typescript-eslint/no-unused-vars */
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

  const [healthData, setHealthData] = useState<FTHealth | null>(null);

  // Single-bot closed trades
  const [singleBotClosedTrades, setSingleBotClosedTrades] = useState<FTTrade[]>([]);
  const [singleBotClosedLoading, setSingleBotClosedLoading] = useState(false);

  // Single-bot open trades
  const [singleBotOpenTrades, setSingleBotOpenTrades] = useState<FTTrade[]>([]);
  const [singleBotOpenLoading, setSingleBotOpenLoading] = useState(false);

  /* eslint-enable @typescript-eslint/no-unused-vars */

  // Edit/Delete modals for side panel
  const [editBot, setEditBot] = useState<Bot | null>(null);
  const [deleteBot, setDeleteBot] = useState<Bot | null>(null);

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

      // Portfolio profit (ALL bots — running + stopped cached)
      let portfolioProfitData: Record<string, Record<string, unknown>> | null = null;
      try {
        const pp = await portfolioProfit();
        if (m.current) {
          setTotalPnl(pp.combined.profit_all_coin);
          // Win rate from ALL bots (running + stopped cached)
          const totalW = pp.combined.winning_trades ?? 0;
          const totalL = pp.combined.losing_trades ?? 0;
          const total = totalW + totalL;
          setTotalWinRate(total > 0 ? (totalW / total) * 100 : null);
          // Store per-bot profit names for stopped bots
          portfolioProfitData = pp.bots;
        }
      } catch { /* non-blocking */ }

      // Open trades (all bots combined)
      try {
        const pt = await portfolioTrades();
        if (!m.current) return;
        const allOpen = pt.trades.filter((t) => t.is_open);
        setOpenTrades(allOpen);

        // totalPnl is set from portfolioProfit above

        const todayClosed = pt.trades.filter(
          (t) => !t.is_open && isToday(t.close_date)
        );
        setClosedTrades(todayClosed);
      } catch { /* non-blocking */ }

      // Per-bot sparklines + profits
      const profits: Record<number, Partial<FTProfit>> = {};
      const sparks: Record<number, number[]> = {};
      const openCounts: Record<number, number> = {};

      // Only fetch per-bot data for trade-mode running bots (skip webserver/utility bots)
      const tradeBots = runningBots.filter((b) => b.ft_mode !== "webserver" && !b.is_utility);
      await Promise.allSettled(
        tradeBots.map(async (bot) => {
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

      // Populate stopped bots with cached profit from portfolio response
      if (portfolioProfitData) {
        const stoppedBots = botList.filter((b) => b.status !== "running");
        for (const bot of stoppedBots) {
          const cached = portfolioProfitData[bot.name];
          if (cached && !("error" in cached)) {
            // Convert Record<string, unknown> to Partial<FTProfit> via numeric coercion
            const partial: Partial<FTProfit> = {};
            for (const [k, v] of Object.entries(cached)) {
              if (k.startsWith("_")) continue; // skip _cached, _stopped flags
              (partial as Record<string, unknown>)[k] = v;
            }
            profits[bot.id] = partial;
          }
        }
      }

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
    detailBotIdRef.current = botId;

    // Stale-check helper: returns true if a different bot was selected since this call started
    const stale = () => detailBotIdRef.current !== botId;

    // Bot open trades
    setSingleBotOpenLoading(true);
    botStatus(botId)
      .then((d) => { if (m.current && !stale()) { setSingleBotOpenTrades(d.filter((t) => t.is_open)); setSingleBotOpenLoading(false); } })
      .catch(() => { if (m.current && !stale()) setSingleBotOpenLoading(false); });

    // Bot closed trades
    setSingleBotClosedLoading(true);
    botTrades(botId, 50)
      .then((d) => { if (m.current && !stale()) { setSingleBotClosedTrades(d.trades.filter((t) => !t.is_open)); setSingleBotClosedLoading(false); } })
      .catch(() => { if (m.current && !stale()) setSingleBotClosedLoading(false); });

    // Helper: for 503 errors (bot not in correct state), silently swallow — no error shown
    const soft = (e: unknown): string | null =>
      e instanceof Error && e.message.includes("503") ? null : (e instanceof Error ? e.message : "Failed");

    // Weekly
    setWeeklyLoading(true); setWeeklyError(null);
    botWeekly(botId, 12)
      .then((d) => { if (m.current && !stale()) { setWeeklyData(d); setWeeklyLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setWeeklyError(soft(e)); setWeeklyLoading(false); } });

    // Monthly
    setMonthlyLoading(true); setMonthlyError(null);
    botMonthly(botId, 12)
      .then((d) => { if (m.current && !stale()) { setMonthlyData(d); setMonthlyLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setMonthlyError(soft(e)); setMonthlyLoading(false); } });

    // Performance
    setPerfLoading(true); setPerfError(null);
    botPerformance(botId)
      .then((d) => { if (m.current && !stale()) { setPerfData(d); setPerfLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setPerfError(soft(e)); setPerfLoading(false); } });

    // Entries
    setEntryLoading(true); setEntryError(null);
    botEntries(botId)
      .then((d) => { if (m.current && !stale()) { setEntryData(d); setEntryLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setEntryError(soft(e)); setEntryLoading(false); } });

    // Exits
    setExitLoading(true); setExitError(null);
    botExits(botId)
      .then((d) => { if (m.current && !stale()) { setExitData(d); setExitLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setExitError(soft(e)); setExitLoading(false); } });

    // Mix Tags
    setMixTagLoading(true); setMixTagError(null);
    botMixTags(botId)
      .then((d) => { if (m.current && !stale()) { setMixTagData(d); setMixTagLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setMixTagError(soft(e)); setMixTagLoading(false); } });

    // Stats
    setStatsLoading(true); setStatsError(null);
    botStats(botId)
      .then((d) => { if (m.current && !stale()) { setStatsData(d); setStatsLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setStatsError(soft(e)); setStatsLoading(false); } });

    // Config
    setConfigLoading(true); setConfigError(null);
    botConfig(botId)
      .then((d) => { if (m.current && !stale()) { setConfigData(d); setConfigLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setConfigError(soft(e)); setConfigLoading(false); } });

    // Sysinfo
    setSysinfoLoading(true); setSysinfoError(null);
    botSysinfo(botId)
      .then((d) => { if (m.current && !stale()) { setSysinfoData(d); setSysinfoLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setSysinfoError(soft(e)); setSysinfoLoading(false); } });

    // Logs
    setLogsLoading(true); setLogsError(null);
    botLogs(botId, 100)
      .then((d) => { if (m.current && !stale()) { setLogsData(d); setLogsLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setLogsError(soft(e)); setLogsLoading(false); } });

    // Whitelist
    setWhitelistLoading(true); setWhitelistError(null);
    botWhitelist(botId)
      .then((d) => { if (m.current && !stale()) { setWhitelistData(d); setWhitelistLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setWhitelistError(soft(e)); setWhitelistLoading(false); } });

    // Locks
    setLocksLoading(true); setLocksError(null);
    botLocks(botId)
      .then((d) => { if (m.current && !stale()) { setLocksData(d); setLocksLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setLocksError(soft(e)); setLocksLoading(false); } });

    // Balance
    setBalanceLoading(true); setBalanceError(null);
    botBalance(botId)
      .then((d) => { if (m.current && !stale()) { setBalanceData(d); setBalanceLoading(false); } })
      .catch((e) => { if (m.current && !stale()) { setBalanceError(soft(e)); setBalanceLoading(false); } });

    // Health (last process time)
    botHealth(botId)
      .then((d) => { if (m.current && !stale()) setHealthData(d); })
      .catch(() => { /* non-blocking */ });
  }, []);

  useEffect(() => {
    if (selectedBotId !== null) {
      loadBotDetails(selectedBotId);
    }
  }, [selectedBotId, loadBotDetails]);

  // ── Bot Control Handlers ──────────────────────────────────────────────

  async function handleBotAction(action: string, botId: number, fn: () => Promise<unknown>) {
    try {
      await fn();
      toast.success(`${action} successful.`);
      await loadPortfolioData(false);
      if (selectedBotId) loadBotDetails(selectedBotId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed.`);
    }
  }

  async function handleDrainBot(botId: number) {
    if (!window.confirm("Stop new entries and wait for open positions to close?")) return;
    await handleBotAction("Drain", botId, () => drainBot(botId));
  }

  async function handleStartBot(botId: number) {
    await handleBotAction("Start", botId, () => startBot(botId));
  }

  async function handleStopBot(botId: number) {
    if (!window.confirm("Stop the bot?")) return;
    await handleBotAction("Stop", botId, () => stopBot(botId));
  }

  async function handleDuplicateBot(bot: Bot) {
    const loadId = toast.loading("Duplicating bot...");
    try {
      const newName = `${bot.name} (Copy)`;
      await registerBot({
        name: newName,
        exchange_name: bot.exchange_name,
        strategy_name: bot.strategy_name,
        is_dry_run: bot.is_dry_run,
      });
      toast.dismiss(loadId);
      toast.success(`${newName} created`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Failed to duplicate bot");
    }
  }

  async function handleDeleteBotConfirm(bot: Bot) {
    const loadId = toast.loading(`Deleting ${bot.name}...`);
    try {
      await deleteBotApi(bot.id);
      toast.dismiss(loadId);
      toast.success(`${bot.name} deleted`);
      if (selectedBotId === bot.id) setSelectedBotId(null);
      await loadPortfolioData(false);
      setDeleteBot(null);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Failed to delete bot");
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
          <div className="py-8 text-center text-sm text-muted-foreground">{emptyMsg}</div>
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
                <th key={h} className="text-left px-4 py-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
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
                    className="hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => setExpandedTradeId(isExpanded ? null : trade.trade_id)}
                  >
                    <td className="px-4 py-3 text-xs font-semibold text-foreground whitespace-nowrap">{trade.pair}</td>
                    {showBotColumn && (
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {trade._bot_name ?? `Bot ${trade._bot_id}`}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                        trade.is_short ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}>
                        {trade.is_short ? "Short" : "Long"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{fmt(trade.open_rate, 4)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{fmt(trade.current_rate, 4)}</td>
                    <td className={`px-4 py-3 text-xs font-bold whitespace-nowrap ${profitColor(pnl)}`}>
                      {pnl != null ? `${pnl >= 0 ? "+" : ""}${fmt(pnl, 2)}` : "\u2014"}
                      {pct != null && (
                        <span className="text-2xs font-normal ml-1 opacity-70">({(pct * 100).toFixed(2)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDuration(trade.open_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleForceExit(trade)} disabled={isExiting}
                          className="text-xs font-semibold px-2 py-1 rounded border border-rose-500/30 text-rose-500 bg-rose-500/10 hover:bg-red/[0.18] hover:border-rose-500 transition-all disabled:opacity-50 cursor-pointer"
                          title="Force Exit at Market">
                          {isExiting ? "..." : "Exit"}
                        </button>
                        <button type="button" onClick={() => handleReloadTrade(trade)}
                          className="text-xs font-semibold px-2 py-1 rounded border border-border text-muted-foreground bg-card hover:bg-muted cursor-pointer transition-all"
                          title="Reload Trade from Exchange">Reload</button>
                        <button type="button"
                          onClick={() => toast.warning(`Delete trade #${trade.trade_id} (${trade.pair})?`, { action: { label: "DELETE", onClick: () => handleDeleteTrade(trade) } })}
                          className="text-xs font-semibold px-2 py-1 rounded border border-rose-500/20 text-rose-500/70 bg-card hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer transition-all"
                          title="Delete Trade">Del</button>
                        {hasOpenOrder && (
                          <button type="button" onClick={() => handleCancelOpenOrder(trade)}
                            className="text-xs font-semibold px-2 py-1 rounded border border-amber-500-500/30 text-amber-500-500 bg-amber-500/10 hover:bg-amber/[0.18] cursor-pointer transition-all"
                            title="Cancel Open Order">Cancel Ord</button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`exp-${trade.trade_id}`}>
                      <td colSpan={colCount} className="bg-card border-b border-border px-4 py-3">
                        <div className="grid grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">Trade ID</span>
                            <span className="font-mono text-muted-foreground">#{trade.trade_id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">stake_amount</span>
                            <span className="font-mono text-muted-foreground">{fmt(trade.stake_amount, 2)} USDT</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">fee_open</span>
                            <span className="font-mono text-muted-foreground">{fmt((trade.fee_open ?? 0) * 100, 3)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">fee_close</span>
                            <span className="font-mono text-muted-foreground">{fmt((trade.fee_close ?? 0) * 100, 3)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">open_date</span>
                            <span className="font-mono text-muted-foreground">{new Date(trade.open_date).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">enter_tag</span>
                            <span className="font-mono text-muted-foreground">{trade.enter_tag ?? "\u2014"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">leverage</span>
                            <span className="font-mono text-muted-foreground">{trade.leverage ?? 1}x</span>
                          </div>
                          {trade.stop_loss && (
                            <div>
                              <span className="text-muted-foreground block text-2xs uppercase tracking-wide mb-0.5">stop_loss</span>
                              <span className="font-mono text-rose-500">{fmt(trade.stop_loss, 4)}</span>
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
        <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500-500-500/20 rounded-btn flex items-center justify-between">
          <span className="text-xs text-amber-500-500 font-medium">
            Data may be stale -- last refresh failed {staleCount} times.
          </span>
          <button type="button" onClick={() => loadPortfolioData(true)}
            className="text-xs text-amber-500-500 underline cursor-pointer hover:no-underline">Retry now</button>
        </div>
      )}

      {/* Force Entry Dialog */}
      <ForceEntryDialog
        open={forceEntryOpen}
        onClose={() => setForceEntryOpen(false)}
        onSubmit={handleForceEntrySubmit}
        submitting={forceEntrySubmitting}
      />

      {/* ═══════════ TOP LEVEL METRIC RIBBON ═══════════ */}
      <div className="flex flex-col gap-4 mb-6 relative z-10">
        <div className="grid grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonStat key={`skel-stat-${i}`} />)
          ) : (
            <>
              <StatCard label="Total Balance" icon="💰"
                value={totalEquity != null ? `$${totalEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "\u2014"}
                sub={`${runningBotCards.length} running bot${runningBotCards.length !== 1 ? "s" : ""}`} />
              <StatCard label="Total P&L" icon="📊"
                value={totalPnl != null ? fmtMoney(totalPnl) : "\u2014"}
                valueColor={profitColor(totalPnl)}
                sub="Realized + unrealized, all bots" />
              <StatCard label="Open Trades" icon="📋"
                value={String(openTrades.length)}
                sub={`Across ${runningBotCards.length} running bot${runningBotCards.length !== 1 ? "s" : ""}`} />
              <StatCard label="Active Bots" icon="🤖"
                value={`${runningBotCards.length}/${bots.length}`}
                sub={runningBotCards.length === bots.length ? "All bots running" : `${bots.length - runningBotCards.length} stopped`} />
              <StatCard label="Win Rate" icon="🎯"
                value={totalWinRate != null ? `${fmt(totalWinRate, 1)}%` : "\u2014"}
                valueColor={totalWinRate != null && totalWinRate >= 55 ? "text-emerald-500" : totalWinRate != null && totalWinRate < 45 ? "text-rose-500" : "text-amber-500-500"}
                sub={`All ${bots.length} bots, all trades`} />
            </>
          )}
        </div>

        {/* AI Agreement Badge */}
        {aiEnabled && aiAgreementPct !== null && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-btn border ${
            aiStrongDisagree > 0 ? "bg-rose-500/10 border-rose-500/25" : "bg-primary/[0.08] border-primary/25"
          }`}>
            <span className="text-xl">{aiStrongDisagree > 0 ? "⚠️" : "🤖"}</span>
            <div className="flex-1">
              <span className={`text-xs font-semibold ${aiStrongDisagree > 0 ? "text-rose-500" : "text-primary"}`}>
                AI Agreement (7d): <strong>{aiAgreementPct.toFixed(1)}%</strong> all-agree
                {aiStrongDisagree > 0 && (
                  <span className="text-rose-500">
                    {" "}&middot; {aiStrongDisagree} strong disagreement{aiStrongDisagree > 1 ? "s" : ""}
                  </span>
                )}
              </span>
              {aiStrongDisagree > 0 && (
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Claude and Grok both disagreed with FreqAI on {aiStrongDisagree} recent signal{aiStrongDisagree > 1 ? "s" : ""}. Review in AI Insights.
                </p>
              )}
            </div>
            <a href="/ai-insights" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              View AI Insights →
            </a>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ALL BOTS VIEW (SMARTER LAYOUT GRID)                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isAllBotsView && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
          
          {/* ════ LEFT COLUMN: DATA & PERFORMANCE (span 8) ════ */}
          <div className="xl:col-span-8 flex flex-col gap-6 w-full min-w-0">
            
            {/* Daily P&L + Equity Curve (Side by Side) */}
            <div className="grid grid-cols-2 gap-5">
              <Card className="flex flex-col h-[280px]">
                <CardHeader title="Daily P&L" icon="📊"
                  action={
                    <div className="flex gap-1 bg-muted/30 p-1 rounded-md border border-border/50">
                      {([7, 14, 30] as const).map((p) => (
                        <button key={p} type="button" onClick={() => setDailyPeriod(p)}
                          className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-sm border cursor-pointer transition-all ${
                            dailyPeriod === p 
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border border-transparent" 
                              : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-foreground/5 opacity-80"
                          }`}>{p}d</button>
                      ))}
                    </div>
                  } />
                {loading ? <SkeletonChart height={160} /> : (
                  <CardBody className="flex-1 flex flex-col justify-end p-4 pt-1">
                    <div className="flex items-end gap-1 h-32 w-full">
                      {dailyData.slice(-dailyPeriod).map((item, i) => {
                        const val = item.abs_profit;
                        const max = Math.max(...dailyData.map((x) => Math.abs(x.abs_profit)), 0.01);
                        const pct = Math.max(5, (Math.abs(val) / max) * 100);
                        return (
                          <div key={item.date ?? `day-${i}`} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${item.date.slice(5)}: ${val >= 0 ? "+" : ""}${val.toFixed(2)} USDT`}>
                            <div className={`w-full rounded-[2px] transition-all ${val >= 0 ? "bg-green/80 group-hover:bg-green" : "bg-red/80 group-hover:bg-red"}`} style={{ height: `${pct}%` }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-3 border-t border-border/40 flex justify-between items-center text-xs">
                       <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Total Period Profit</span>
                       <span className={`font-bold ${profitColor(totalClosedProfit)}`}>{fmtMoney(totalClosedProfit)}</span>
                    </div>
                  </CardBody>
                )}
              </Card>

              <Card className="flex flex-col h-[280px]">
                <CardHeader title="Equity Curve (30d)" icon="📈" />
                {loading ? <SkeletonChart height={160} /> : (
                  <CardBody className="p-3 flex-1 flex flex-col">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: "#55556a" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`} />
                        <Tooltip contentStyle={{ background: "#12121c", border: "1px solid #1e1e30", borderRadius: 6, fontSize: 11 }}
                          formatter={(v: unknown) => { const n = Number(v); return [`${n >= 0 ? "+" : ""}${n.toFixed(2)} USDT`, "Cum. P&L"]; }} />
                        <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#equityGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardBody>
                )}
              </Card>
            </div>

            {/* Open Positions Table */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader title="Open Positions" icon="📍"
                action={
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-medium">
                      {openTrades.length} risk entities
                    </span>
                    <button type="button" onClick={() => loadPortfolioData(false)}
                      className="inline-flex items-center justify-center rounded-md text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-7 px-3 cursor-pointer">
                      ↻ Refresh
                    </button>
                  </div>
                } />
              {loading ? (
                <SkeletonTable rows={5} cols={8} />
              ) : bots.length > 0 && runningBotCards.length === 0 ? (
                <CardBody><div className="py-8 text-center text-sm text-muted-foreground">No active systems.</div></CardBody>
              ) : (
                renderTradesTable(openTrades, true, "No active positions")
              )}
            </Card>

            {/* Today's Closed Trades */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader title="Today's Closed Trades" icon="📋"
                action={<span className="text-xs font-medium text-muted-foreground">{closedTrades.length} settled</span>} />
              {loading ? <SkeletonTable rows={5} cols={6} /> : closedTrades.length === 0 ? (
                <CardBody><div className="py-8 text-center text-sm text-muted-foreground">No trades settled today.</div></CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-muted/30">
                      <tr>
                        {["Pair", "Bot", "Side", "open_rate", "close_rate", "close_profit_abs", "exit_reason", "Duration"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {closedTrades.map((trade) => (
                        <tr key={trade.trade_id} className="hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0 group">
                          <td className="px-4 py-2.5 text-xs font-bold text-foreground">{trade.pair}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">{trade._bot_name ?? `Bot ${trade._bot_id}`}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${trade.is_short ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                              {trade.is_short ? "Short" : "Long"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-muted-foreground font-mono">{fmt(trade.open_rate, 4)}</td>
                          <td className="px-4 py-2.5 text-[11px] text-muted-foreground font-mono">{fmt(trade.close_rate ?? 0, 4)}</td>
                          <td className={`px-4 py-2.5 text-[11px] font-bold font-mono ${profitColor(trade.close_profit_abs)}`}>
                            {trade.close_profit_abs != null ? `${trade.close_profit_abs >= 0 ? "+" : ""}${fmt(trade.close_profit_abs, 2)}` : "\u2014"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[120px]">{trade.exit_reason ?? "\u2014"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
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

          </div>

          {/* ════ RIGHT COLUMN: COMMAND CENTER (span 4) ════ */}
          <div className="xl:col-span-4 flex flex-col gap-6 w-full min-w-0">
            
            {/* Bots Control Panel */}
            <Card className="flex flex-col flex-shrink-0" id="bot-control-panel">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex flex-col justify-between gap-3 w-full">
                  <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-sm">Enclave Workers</CardTitle>
                    <button type="button" onClick={() => setShowManagement(!showManagement)}
                      className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                      {showManagement ? "Close Matrix" : "Matrix View →"}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 w-full">
                    {(["all", "running", "stopped"] as const).map((f) => (
                      <button key={f} type="button" onClick={() => setBotStatusFilter(f)}
                        className={`flex-1 rounded-md px-2 py-1.5 text-[10px] uppercase font-bold transition-all focus:outline-none cursor-pointer tracking-wider text-center ${
                          botStatusFilter === f
                            ? "bg-secondary text-secondary-foreground shadow-sm border border-border/50"
                            : "bg-transparent text-muted-foreground hover:bg-muted border border-transparent"
                        }`}>
                        {f === "all" ? `All (${bots.length})` : f === "running" ? `Run (${runningBotCards.length})` : `Stop (${bots.length - runningBotCards.length})`}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-0 flex flex-col max-h-[500px] overflow-y-auto custom-scrollbar">
                {!loading && bots.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No workers found.</div>
                )}
                {bots.filter((bot) => !bot.is_utility && bot.ft_mode !== "webserver").filter((bot) => botStatusFilter === "all" || (botStatusFilter === "running" ? bot.status === "running" : bot.status !== "running")).map((bot) => (
                  <div key={bot.id} className="border-b border-border/40 last:border-0 p-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedBotId(bot.id)}>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate pr-2">{bot.name}</span>
                       <StatusBadge status={bot.status} isDryRun={bot.is_dry_run} />
                    </div>
                    <div className="flex justify-between items-end">
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase font-semibold text-muted-foreground mb-0.5">Today's Net</span>
                         <span className={`text-xs font-bold font-mono ${botProfits[bot.id] && botProfits[bot.id].profit_closed_abs >= 0 ? "text-emerald-500" : botProfits[bot.id] && botProfits[bot.id].profit_closed_abs < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                           {botProfits[bot.id] ? fmtMoney(botProfits[bot.id].profit_closed_abs) : "—"}
                         </span>
                       </div>
                       <div className="w-20"><Sparkline data={sparklines[bot.id] ?? []} /></div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            {/* Matrix View Toggle */}
            {showManagement && (
               <div className="animate-in fade-in slide-in-from-top-4 duration-200">
                  <BotManagementTable bots={bots} botProfits={botProfits} onRefresh={() => loadPortfolioData(false)} />
               </div>
            )}

            {/* System Log / Health Combined Panel */}
             <Card className="flex flex-col flex-1 min-h-[300px]">
               <CardHeader className="border-b border-border/50 py-3" title="System Pulse" icon="❤️" />
               <CardBody className="p-0 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
                  {/* Health Section */}
                  <div className="p-3 border-b border-border/30 bg-muted/10">
                    <h3 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-3">Health Status</h3>
                    {loading ? <SkeletonTable rows={2} cols={2} /> : (
                      <div className="flex flex-col gap-2">
                        {bots.filter(b => b.status === "running").map((bot) => (
                          <div key={bot.id} className="flex items-center gap-2" onClick={() => setSelectedBotId(bot.id)}>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${bot.is_healthy ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-rose-500 animate-pulse"}`} />
                            <span className="text-xs font-semibold text-foreground flex-1 truncate">{bot.name}</span>
                            <span className="text-xs text-muted-foreground">{bot.is_healthy ? "OK" : "Err"}</span>
                          </div>
                        ))}
                        {bots.filter(b => b.status === "running").length === 0 && (
                          <div className="text-xs text-muted-foreground">No active systems to monitor.</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Alerts Section */}
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                       <h3 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Recent Events</h3>
                       <a href="/risk" className="text-[10px] text-primary hover:underline font-bold">All →</a>
                    </div>
                    <div className="flex flex-col gap-3 flex-1">
                      {riskEvents.length === 0 ? (
                        <div className="text-xs text-muted-foreground h-full flex items-center justify-center">No recent security events</div>
                      ) : (
                        riskEvents.slice(0, 5).map((ev) => (
                          <div key={ev.id} className="flex items-start gap-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${ev.kill_type === "HARD_KILL" ? "bg-rose-500" : "bg-amber-500-500"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-foreground leading-snug">{ev.reason ?? ev.trigger}</div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[9px] text-muted-foreground">{new Date(ev.created_at).toLocaleTimeString()} · {ev.triggered_by}</span>
                                <span className={`text-[9px] font-bold px-1 rounded uppercase tracking-wider shrink-0 ${
                                  ev.kill_type === "HARD_KILL" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500-500"
                                }`}>{ev.kill_type.replace("_", "")}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
               </CardBody>
             </Card>

          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BOT DETAIL SIDE PANEL (slide-in from right)                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <BotDetailPanel
        bot={selectedBot}
        isOpen={selectedBotId !== null}
        onClose={() => setSelectedBotId(null)}
        profit={selectedBot ? botProfits[selectedBot.id] ?? null : null}
        openTrades={singleBotOpenTrades}
        closedTrades={singleBotClosedTrades}
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
        loading={selectedBotId !== null && (weeklyLoading || monthlyLoading || perfLoading || entryLoading || exitLoading || mixTagLoading || statsLoading || configLoading || sysinfoLoading || logsLoading || whitelistLoading || locksLoading || balanceLoading)}
        onStart={() => selectedBot && handleStartBot(selectedBot.id)}
        onStop={() => selectedBot && handleStopBot(selectedBot.id)}
        onDrain={() => selectedBot && handleDrainBot(selectedBot.id)}
        onEdit={() => selectedBot && setEditBot(selectedBot)}
        onDelete={() => selectedBot && setDeleteBot(selectedBot)}
        onDuplicate={() => selectedBot && handleDuplicateBot(selectedBot)}
      />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EDIT & DELETE MODALS                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <BotEditModal
        open={editBot !== null}
        bot={editBot}
        onClose={() => setEditBot(null)}
        onSuccess={async () => {
          setEditBot(null);
          await loadPortfolioData(false);
        }}
      />

      <BotDeleteDialog
        open={deleteBot !== null}
        bot={deleteBot}
        onClose={() => setDeleteBot(null)}
        onSuccess={async () => {
          if (deleteBot) {
            await handleDeleteBotConfirm(deleteBot);
          }
        }}
      />

      {/* Activity Log Viewer (both views) */}
      <LogViewer
        bots={bots}
        defaultBotId={selectedBotId ?? undefined}
        collapsed={true}
      />
    </AppShell>
  );
}
