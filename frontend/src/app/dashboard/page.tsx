"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";
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
  startBot,
  stopBot,

  botDeleteTrade,
  botReloadTrade,
  botCancelOpenOrder,
  botWeekly,
  botMonthly,
  botPerformance,
  botEntries,
  botExits,
  botSysinfo,
  botLogs,
  botWhitelist,
  botLocks,
  botTrades,
  botBalance,
  botHealth,
  drainBot,
  reloadBotConfig,
  botStopBuy,
  botPause,
  softKill,
  hardKill,
} from "@/lib/api";
import type {
  Bot,
  FTTrade,
  FTProfit,
  FTDailyItem,
  FTWeeklyResponse,
  FTMonthlyResponse,
  FTPerformance,
  FTEntry,
  FTExit,
  FTStats,
  FTSysinfo,
  FTLogsResponse,
  FTWhitelist,
  FTLocksResponse,
  FTBalance,
  FTHealth,
} from "@/types";

// Dashboard sub-components
import KPIGrid from "@/components/dashboard/KPIGrid";
import FleetPanel from "@/components/dashboard/FleetPanel";
import ProfitChart from "@/components/dashboard/ProfitChart";
import TradeTable from "@/components/dashboard/TradeTable";
import RightSidebar from "@/components/dashboard/RightSidebar";
import BotDetailPanel from "@/components/dashboard/BotDetailPanel";
import BotEditModal from "@/components/bots/BotEditModal";
import BotDeleteDialog from "@/components/bots/BotDeleteDialog";
import { registerBot, deleteBot as deleteBotApi } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────


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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const toast = useToast();

  // ── Core State ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [staleCount, setStaleCount] = useState(0);
  const staleCountRef = useRef(0);
  const mountedRef = useRef(true);
  const detailBotIdRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Data State ────────────────────────────────────────────────────────
  const [bots, setBots] = useState<Bot[]>([]);
  const [openTrades, setOpenTrades] = useState<FTTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<FTTrade[]>([]);
  const [botProfits, setBotProfits] = useState<Record<number, Partial<FTProfit>>>({});
  const [sparklines, setSparklines] = useState<Record<number, number[]>>({});
  const [dailyData, setDailyData] = useState<FTDailyItem[]>([]);

  // Portfolio aggregates
  const [totalEquity, setTotalEquity] = useState<number | null>(null);
  const [totalPnlClosed, setTotalPnlClosed] = useState<number | null>(null);
  const [totalPnlClosedPct, setTotalPnlClosedPct] = useState<number | null>(null);
  const [totalPnlOpen, setTotalPnlOpen] = useState<number | null>(null);
  const [totalPnlOpenPct, setTotalPnlOpenPct] = useState<number | null>(null);
  const [totalWinRate, setTotalWinRate] = useState<number | null>(null);
  const [totalWins, setTotalWins] = useState(0);
  const [totalLosses, setTotalLosses] = useState(0);
  const [totalTradeCount, setTotalTradeCount] = useState(0);

  // Aggregated stats (from per-bot stats calls)
  const [aggStats, setAggStats] = useState<{
    profitFactor: number | null;
    sharpeRatio: number | null;
    maxDrawdown: number | null;
    maxDrawdownAbs: number | null;
    tradingVolume: number | null;
    avgDuration: string;
    bestPair: string | null;
    bestPairPct: number | null;
    totalFees: number | null;
    fundingFees: number | null;
  }>({
    profitFactor: null,
    sharpeRatio: null,
    maxDrawdown: null,
    maxDrawdownAbs: null,
    tradingVolume: null,
    avgDuration: "\u2014",
    bestPair: null,
    bestPairPct: null,
    totalFees: null,
    fundingFees: null,
  });

  // Weekly/monthly for chart toggle
  const [weeklyData, setWeeklyData] = useState<FTWeeklyResponse | null>(null);
  const [monthlyData, setMonthlyData] = useState<FTMonthlyResponse | null>(null);

  // Aggregated performance/entries/exits for trade table tabs
  const [perfData, setPerfData] = useState<FTPerformance[]>([]);
  const [entryData, setEntryData] = useState<FTEntry[]>([]);
  const [exitData, setExitData] = useState<FTExit[]>([]);
  const [whitelistData, setWhitelistData] = useState<FTWhitelist | null>(null);
  const [locksData, setLocksData] = useState<FTLocksResponse | null>(null);

  // Right sidebar data (aggregated from first running bot)
  const [balanceData, setBalanceData] = useState<FTBalance | null>(null);
  const [sysinfoData, setSysinfoData] = useState<FTSysinfo | null>(null);
  const [logsData, setLogsData] = useState<FTLogsResponse | null>(null);
  const [aggregatedProfit, setAggregatedProfit] = useState<Partial<FTProfit> | null>(null);

  // UI state
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [exitingTradeId, setExitingTradeId] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);

  // Bot detail panel data
  const [singleBotOpenTrades, setSingleBotOpenTrades] = useState<FTTrade[]>([]);
  const [singleBotClosedTrades, setSingleBotClosedTrades] = useState<FTTrade[]>([]);
  const [singlePerfData, setSinglePerfData] = useState<FTPerformance[]>([]);
  const [singleEntryData, setSingleEntryData] = useState<FTEntry[]>([]);
  const [singleExitData, setSingleExitData] = useState<FTExit[]>([]);
  const [singleStatsData, setSingleStatsData] = useState<FTStats | null>(null);
  const [singleSysinfoData, setSingleSysinfoData] = useState<FTSysinfo | null>(null);
  const [singleLogsData, setSingleLogsData] = useState<FTLogsResponse | null>(null);
  const [singleLocksData, setSingleLocksData] = useState<FTLocksResponse | null>(null);
  const [singleBalanceData, setSingleBalanceData] = useState<FTBalance | null>(null);
  const [singleHealthData, setSingleHealthData] = useState<FTHealth | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit/delete modals
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

      const runningBots = botList.filter((b) => b.status === "running");
      const tradeBots = runningBots.filter((b) => b.ft_mode !== "webserver" && !b.is_utility);

      // Portfolio balance
      try {
        const pb = await portfolioBalance();
        if (m.current) setTotalEquity(pb.total_value);
      } catch { /* non-blocking */ }

      // Portfolio profit
      let portfolioProfitData: Record<string, Record<string, unknown>> | null = null;
      try {
        const pp = await portfolioProfit();
        if (m.current) {
          setTotalPnlClosed(pp.combined.profit_closed_coin);
          const closedPct = pp.combined.trade_count > 0 ? (pp.combined.profit_closed_coin / (pp.combined.profit_closed_coin + pp.combined.profit_closed_fiat || 1)) * 100 : null;
          setTotalPnlClosedPct(closedPct);
          setTotalTradeCount(pp.combined.trade_count);
          const totalW = pp.combined.winning_trades ?? 0;
          const totalL = pp.combined.losing_trades ?? 0;
          const total = totalW + totalL;
          setTotalWinRate(total > 0 ? (totalW / total) * 100 : null);
          setTotalWins(totalW);
          setTotalLosses(totalL);
          setAggregatedProfit({ profit_closed_coin: pp.combined.profit_closed_coin } as Partial<FTProfit>);
          portfolioProfitData = pp.bots;
        }
      } catch { /* non-blocking */ }

      // Open trades (all bots combined)
      try {
        const pt = await portfolioTrades();
        if (!m.current) return;
        const allOpen = pt.trades.filter((t) => t.is_open);
        setOpenTrades(allOpen);

        // Open P&L
        const openPnlSum = allOpen.reduce((s, t) => s + (t.current_profit_abs ?? 0), 0);
        setTotalPnlOpen(openPnlSum);
        const totalStake = allOpen.reduce((s, t) => s + t.stake_amount, 0);
        setTotalPnlOpenPct(totalStake > 0 ? (openPnlSum / totalStake) * 100 : null);

        // All closed for the table (last 200)
        const allClosed = pt.trades.filter((t) => !t.is_open);
        setClosedTrades(allClosed);
      } catch { /* non-blocking */ }

      // Per-bot sparklines + profits + stats aggregation
      const profits: Record<number, Partial<FTProfit>> = {};
      const sparks: Record<number, number[]> = {};
      let aggPF: number | null = null;
      let aggSharpe: number | null = null;
      let aggMaxDD: number | null = null;
      let aggMaxDDAbs: number | null = null;
      let aggVolume = 0;
      let aggDurTotal = 0;
      let aggDurCount = 0;
      let bestPairName: string | null = null;
      let bestPairRate: number | null = null;
      let aggTotalFees = 0;
      const aggFundingFees = 0;

      // Collect all perf, entry, exit data across bots
      const allPerf: FTPerformance[] = [];
      const allEntries: FTEntry[] = [];
      const allExits: FTExit[] = [];
      let firstWhitelist: FTWhitelist | null = null;
      let firstLocks: FTLocksResponse | null = null;

      await Promise.allSettled(
        tradeBots.map(async (bot) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [p, d, , st, perf, ent, ex, wl, lk] = await Promise.allSettled([
              botProfit(bot.id),
              botDaily(bot.id, 7),
              botStatus(bot.id),
              botStats(bot.id),
              botPerformance(bot.id),
              botEntries(bot.id),
              botExits(bot.id),
              botWhitelist(bot.id),
              botLocks(bot.id),
            ]);
            if (p.status === "fulfilled") profits[bot.id] = p.value;
            if (d.status === "fulfilled") sparks[bot.id] = d.value.data.map((item) => item.abs_profit);

            // Stats aggregation
            if (st.status === "fulfilled") {
              const stats = st.value;
              if (stats.profit_factor != null && (aggPF == null || stats.profit_factor > aggPF)) aggPF = stats.profit_factor;
              if (stats.sharpe_ratio != null && (aggSharpe == null || stats.sharpe_ratio < aggSharpe)) aggSharpe = stats.sharpe_ratio;
              if (stats.max_drawdown != null && (aggMaxDD == null || stats.max_drawdown < aggMaxDD)) aggMaxDD = stats.max_drawdown;
              if (stats.max_drawdown_abs != null && (aggMaxDDAbs == null || stats.max_drawdown_abs > aggMaxDDAbs)) aggMaxDDAbs = stats.max_drawdown_abs;
              if (stats.trading_volume) aggVolume += stats.trading_volume;
              if (stats.durations.wins != null) { aggDurTotal += stats.durations.wins; aggDurCount++; }
            }

            // Best pair from profit response
            if (p.status === "fulfilled") {
              const prof = p.value;
              if (prof.best_pair && (bestPairRate == null || (prof.best_pair_profit_ratio ?? prof.best_rate) > bestPairRate)) {
                bestPairName = prof.best_pair;
                bestPairRate = prof.best_pair_profit_ratio ?? prof.best_rate;
              }
              // Fee estimation
              if (prof.trade_count > 0) {
                aggTotalFees += (prof.trade_count * 0.04 * 2) / 100 * ((prof.profit_closed_coin ?? 0) + (prof.profit_open_coin ?? 0));
              }
            }

            // Performance
            if (perf.status === "fulfilled") allPerf.push(...perf.value);
            if (ent.status === "fulfilled") allEntries.push(...ent.value);
            if (ex.status === "fulfilled") allExits.push(...ex.value);
            if (wl.status === "fulfilled" && !firstWhitelist) firstWhitelist = wl.value;
            if (lk.status === "fulfilled" && !firstLocks) firstLocks = lk.value;
          } catch { /* per-bot isolated */ }
        })
      );

      // Populate stopped bots with cached profit
      if (portfolioProfitData) {
        const stoppedBots = botList.filter((b) => b.status !== "running");
        for (const bot of stoppedBots) {
          const cached = portfolioProfitData[bot.name];
          if (cached && !("error" in cached)) {
            const partial: Partial<FTProfit> = {};
            for (const [k, v] of Object.entries(cached)) {
              if (k.startsWith("_")) continue;
              (partial as Record<string, unknown>)[k] = v;
            }
            profits[bot.id] = partial;
          }
        }
      }

      if (m.current) {
        setBotProfits(profits);
        setSparklines(sparks);
        setPerfData(allPerf);
        setEntryData(allEntries);
        setExitData(allExits);
        setWhitelistData(firstWhitelist);
        setLocksData(firstLocks);

        setAggStats({
          profitFactor: aggPF,
          sharpeRatio: aggSharpe,
          maxDrawdown: aggMaxDD != null ? aggMaxDD * 100 : null,
          maxDrawdownAbs: aggMaxDDAbs,
          tradingVolume: aggVolume > 0 ? aggVolume : null,
          avgDuration: aggDurCount > 0 ? fmtDurationSec(aggDurTotal / aggDurCount) : "\u2014",
          bestPair: bestPairName,
          bestPairPct: bestPairRate,
          totalFees: aggTotalFees > 0 ? aggTotalFees : null,
          fundingFees: aggFundingFees > 0 ? aggFundingFees : null,
        });
      }

      // Daily P&L chart
      try {
        const daily = await portfolioDaily();
        if (m.current) setDailyData(daily.data ?? []);
      } catch { if (m.current) setDailyData([]); }

      // Weekly + Monthly for chart toggles (from first running bot)
      if (tradeBots.length > 0) {
        const firstBotId = tradeBots[0].id;
        Promise.allSettled([
          botWeekly(firstBotId, 12),
          botMonthly(firstBotId, 12),
          botBalance(firstBotId),
          botSysinfo(firstBotId),
          botLogs(firstBotId, 100),
        ]).then(([w, mo, bal, sys, logs]) => {
          if (!m.current) return;
          if (w.status === "fulfilled") setWeeklyData(w.value);
          if (mo.status === "fulfilled") setMonthlyData(mo.value);
          if (bal.status === "fulfilled") setBalanceData(bal.value);
          if (sys.status === "fulfilled") setSysinfoData(sys.value);
          if (logs.status === "fulfilled") setLogsData(logs.value);
        });
      }

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

  // ── Load Single Bot Detail ────────────────────────────────────────────

  const loadBotDetails = useCallback(async (botId: number) => {
    const m = mountedRef;
    detailBotIdRef.current = botId;
    setDetailLoading(true);
    const stale = () => detailBotIdRef.current !== botId;

    const soft = (e: unknown): string | null =>
      e instanceof Error && e.message.includes("503") ? null : (e instanceof Error ? e.message : "Failed");

    // Fire all requests in parallel
    Promise.allSettled([
      botStatus(botId),
      botTrades(botId, 50),
      botPerformance(botId),
      botEntries(botId),
      botExits(botId),
      botStats(botId),
      botSysinfo(botId),
      botLogs(botId, 100),
      botLocks(botId),
      botBalance(botId),
      botHealth(botId),
    ]).then(([st, tr, perf, ent, ex, stats, sys, logs, lk, bal, health]) => {
      if (!m.current || stale()) return;
      if (st.status === "fulfilled") { setSingleBotOpenTrades(st.value.filter((t) => t.is_open)); }
      if (tr.status === "fulfilled") { setSingleBotClosedTrades(tr.value.trades.filter((t) => !t.is_open)); }
      if (perf.status === "fulfilled") setSinglePerfData(perf.value);
      if (ent.status === "fulfilled") setSingleEntryData(ent.value);
      if (ex.status === "fulfilled") setSingleExitData(ex.value);
      if (stats.status === "fulfilled") setSingleStatsData(stats.value);
      if (sys.status === "fulfilled") setSingleSysinfoData(sys.value);
      if (logs.status === "fulfilled") setSingleLogsData(logs.value);
      if (lk.status === "fulfilled") setSingleLocksData(lk.value);
      if (bal.status === "fulfilled") setSingleBalanceData(bal.value);
      if (health.status === "fulfilled") setSingleHealthData(health.value);
      setDetailLoading(false);
    });

    // Suppress unused variable warnings for soft
    void soft;
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed.`);
    }
  }

  async function handleStartBot(botId: number) {
    await handleBotAction("Start", botId, () => startBot(botId));
  }

  async function handleStopBot(botId: number) {
    if (!window.confirm("Stop the bot?")) return;
    await handleBotAction("Stop", botId, () => stopBot(botId));
  }

  async function handlePauseBot(botId: number) {
    await handleBotAction("Pause (Stopbuy)", botId, () => botPause(botId));
  }

  async function handleReloadBot(botId: number) {
    await handleBotAction("Reload config", botId, () => reloadBotConfig(botId));
  }

  async function handleForceExitAllBot(botId: number) {
    if (!window.confirm("Force exit ALL open trades on this bot?")) return;
    await handleBotAction("Force exit all", botId, () => botForceExit(botId, "all"));
  }

  async function handleStopBuyBot(botId: number) {
    await handleBotAction("Toggle Stopbuy", botId, () => botStopBuy(botId));
  }

  async function handleSoftKillBot(botId: number) {
    if (!window.confirm("Soft Kill: exit all trades, keep bot alive?")) return;
    await handleBotAction("Soft Kill", botId, () => softKill(botId, "Manual soft kill from dashboard"));
  }

  async function handleHardKillBot(botId: number) {
    if (!window.confirm("HARD KILL: Force stop bot + container? This is destructive!")) return;
    await handleBotAction("Hard Kill", botId, () => hardKill(botId, "Manual hard kill from dashboard"));
  }

  async function handleDrainBot(botId: number) {
    if (!window.confirm("Stop new entries and wait for open positions to close?")) return;
    await handleBotAction("Drain", botId, () => drainBot(botId));
  }

  async function handleDuplicateBot(bot: Bot) {
    const loadId = toast.loading("Duplicating bot...");
    try {
      await registerBot({ name: `${bot.name} (Copy)`, exchange_name: bot.exchange_name, strategy_name: bot.strategy_name, is_dry_run: bot.is_dry_run });
      toast.dismiss(loadId);
      toast.success(`${bot.name} (Copy) created`);
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

  // ── Trade Action Handlers ─────────────────────────────────────────────

  async function handleForceExit(trade: FTTrade, ordertype = "market") {
    if (!trade._bot_id) {
      toast.error("Cannot determine which bot owns this trade.");
      return;
    }
    const tradeIdStr = String(trade.trade_id);
    setExitingTradeId(tradeIdStr);
    const loadId = toast.loading(`Force exiting ${trade.pair}...`);
    try {
      await botForceExit(trade._bot_id, tradeIdStr, ordertype);
      toast.dismiss(loadId);
      toast.success(`Force exit submitted for ${trade.pair}.`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? `Force exit failed: ${err.message}` : "Force exit failed.");
    } finally {
      setExitingTradeId(null);
    }
  }

  async function handleDeleteTrade(trade: FTTrade) {
    if (!trade._bot_id) return;
    if (!window.confirm(`Delete trade #${trade.trade_id} (${trade.pair})?`)) return;
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

  const selectedBot = bots.find((b) => b.id === selectedBotId) ?? null;

  // Today's P&L from daily data
  const todayPnl = dailyData.length > 0 ? dailyData[dailyData.length - 1]?.abs_profit ?? null : null;
  const todayPnlPct = dailyData.length > 0 ? dailyData[dailyData.length - 1]?.rel_profit ?? null : null;

  // Locked in trades = sum of open trade stake amounts
  const lockedInTrades = openTrades.reduce((s, t) => s + t.stake_amount, 0);

  const staleWarning = staleCount >= 3;

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <AppShell title="Dashboard">
      {/* Stale data banner */}
      {staleWarning && (
        <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center justify-between">
          <span className="text-xs text-amber-500 font-medium">
            Data may be stale -- last refresh failed {staleCount} times.
          </span>
          <button type="button" onClick={() => loadPortfolioData(true)}
            className="text-xs text-amber-500 underline cursor-pointer hover:no-underline">Retry now</button>
        </div>
      )}

      {/* LINEAR EDGE LAYOUT */}
      <div
        className="flex flex-col gap-5 h-full -m-8 p-5 overflow-hidden"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* LAYER 1: KPI Grid (14 KPIs in 7+7) */}
        <KPIGrid
          totalEquity={totalEquity}
          lockedInTrades={lockedInTrades > 0 ? lockedInTrades : null}
          todayPnl={todayPnl}
          todayPnlPct={todayPnlPct != null ? todayPnlPct * 100 : null}
          totalPnlClosed={totalPnlClosed}
          totalPnlClosedPct={totalPnlClosedPct}
          openPnl={totalPnlOpen}
          openPnlPct={totalPnlOpenPct}
          openTradeCount={openTrades.length}
          maxOpenTrades={null}
          maxDrawdown={aggStats.maxDrawdown}
          winRate={totalWinRate}
          winCount={totalWins}
          lossCount={totalLosses}
          profitFactor={aggStats.profitFactor}
          avgDuration={aggStats.avgDuration}
          totalTrades={totalTradeCount}
          bestPair={aggStats.bestPair}
          bestPairPct={aggStats.bestPairPct}
          sharpeRatio={aggStats.sharpeRatio}
          tradingVolume={aggStats.tradingVolume}
          loading={loading}
        />

        {/* LAYER 2: 3-Column Layout */}
        <div className="flex-1 flex gap-5 min-w-0 min-h-0 overflow-hidden">

          {/* COL 1: Fleet Management */}
          <FleetPanel
            bots={bots}
            botProfits={botProfits}
            sparklines={sparklines}
            onBotClick={(id) => setSelectedBotId(id)}
            onStart={handleStartBot}
            onStop={handleStopBot}
            onPause={handlePauseBot}
            onReload={handleReloadBot}
            onForceExitAll={handleForceExitAllBot}
            onStopBuy={handleStopBuyBot}
            onSoftKill={handleSoftKillBot}
            onHardKill={handleHardKillBot}
          />

          {/* COL 2: Center Workspace */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">
            {/* Chart area */}
            <ProfitChart
              dailyData={dailyData}
              weeklyData={weeklyData}
              monthlyData={monthlyData}
              maxDrawdownAbs={aggStats.maxDrawdownAbs}
              maxDrawdownRel={aggStats.maxDrawdown}
              onToggleSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
              sidebarOpen={rightSidebarOpen}
              loading={loading}
            />

            {/* Trade Table (6-tab engine) */}
            <TradeTable
              openTrades={openTrades}
              closedTrades={closedTrades}
              perfData={perfData}
              entryData={entryData}
              exitData={exitData}
              whitelistData={whitelistData}
              locksData={locksData}
              loading={loading}
              onForceExit={handleForceExit}
              onReloadTrade={handleReloadTrade}
              onDeleteTrade={handleDeleteTrade}
              onCancelOrder={handleCancelOpenOrder}
              exitingTradeId={exitingTradeId}
            />
          </div>

          {/* COL 3: Right Sidebar (collapsible) */}
          <RightSidebar
            isOpen={rightSidebarOpen}
            balanceData={balanceData}
            sysinfoData={sysinfoData}
            logsData={logsData}
            aggregatedProfit={aggregatedProfit}
            totalFees={aggStats.totalFees}
            fundingFees={aggStats.fundingFees}
            loading={loading}
          />
        </div>
      </div>

      {/* BOT DETAIL PANEL (slide-in drawer) */}
      <BotDetailPanel
        bot={selectedBot}
        isOpen={selectedBotId !== null}
        onClose={() => setSelectedBotId(null)}
        profit={selectedBot ? botProfits[selectedBot.id] ?? null : null}
        openTrades={singleBotOpenTrades}
        closedTrades={singleBotClosedTrades}
        perfData={singlePerfData}
        entryData={singleEntryData}
        exitData={singleExitData}
        statsData={singleStatsData}
        configData={null as import("@/types").FTShowConfig | null}
        sysinfoData={singleSysinfoData}
        logsData={singleLogsData}
        locksData={singleLocksData}
        balanceData={singleBalanceData}
        healthData={singleHealthData}
        loading={detailLoading}
        onStart={() => selectedBot && handleStartBot(selectedBot.id)}
        onStop={() => selectedBot && handleStopBot(selectedBot.id)}
        onDrain={() => selectedBot && handleDrainBot(selectedBot.id)}
        onEdit={() => selectedBot && setEditBot(selectedBot)}
        onDelete={() => selectedBot && setDeleteBot(selectedBot)}
        onDuplicate={() => selectedBot && handleDuplicateBot(selectedBot)}
      />

      {/* EDIT & DELETE MODALS */}
      <BotEditModal
        open={editBot !== null}
        bot={editBot}
        onClose={() => setEditBot(null)}
        onSuccess={async () => { setEditBot(null); await loadPortfolioData(false); }}
      />
      <BotDeleteDialog
        open={deleteBot !== null}
        bot={deleteBot}
        onClose={() => setDeleteBot(null)}
        onSuccess={async () => { if (deleteBot) await handleDeleteBotConfirm(deleteBot); }}
      />
    </AppShell>
  );
}
