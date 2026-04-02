"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog, { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getBots,
  botStatus,
  botProfit,
  botDaily,
  botForceExit,
  botForceEnter,
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
  botConfig,
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
  botPairCandles,
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
  FTShowConfig,
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
  const [confirmProps, confirmDlg] = useConfirmDialog();

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
  const [pairMarketData, setPairMarketData] = useState<Record<string, { change24h: number; volume: number; volatility: number }>>({});

  // Right sidebar data (aggregated from first running bot)
  const [balanceData, setBalanceData] = useState<FTBalance | null>(null);
  const [sysinfoData, setSysinfoData] = useState<FTSysinfo | null>(null);
  const [logsData, setLogsData] = useState<FTLogsResponse | null>(null);
  const [aggregatedProfit, setAggregatedProfit] = useState<Partial<FTProfit> | null>(null);
  const [mainHealthData, setMainHealthData] = useState<FTHealth | null>(null);

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
  const [singleConfigData, setSingleConfigData] = useState<FTShowConfig | null>(null);
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
      const tradeBots = runningBots.filter((b) => {
        if (b.ft_mode === "webserver") return false;
        if (b.is_utility === true) return false;
        return true;
      });
      // If no trade bots found but we have running bots, use ALL running bots as fallback
      const effectiveTradeBots = tradeBots.length > 0 ? tradeBots : runningBots;

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
          // Use profit_all_coin as the basis for percentage, not the sum of coin + fiat
          setTotalPnlClosedPct(null); // Will be computed from per-bot profit data below
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
      let allOpen: FTTrade[] = [];
      let allClosed: FTTrade[] = [];
      try {
        const pt = await portfolioTrades();
        if (!m.current) return;
        allOpen = pt.trades.filter((t) => t.is_open);
        allClosed = pt.trades.filter((t) => !t.is_open);
      } catch { /* non-blocking */ }

      // BUG 7 fix: If portfolio trades returned no closed trades, fetch per-bot
      if (allClosed.length === 0 && effectiveTradeBots.length > 0) {
        try {
          const perBotResults = await Promise.allSettled(
            effectiveTradeBots.map(async (bot) => {
              const result = await botTrades(bot.id, 200);
              return result.trades
                .filter((t) => !t.is_open)
                .map((t) => ({ ...t, _bot_id: bot.id, _bot_name: bot.name }));
            })
          );
          for (const r of perBotResults) {
            if (r.status === "fulfilled") allClosed.push(...r.value);
          }
        } catch { /* non-blocking */ }
      }

      // Fetch open trades from botStatus (more reliable current_profit data)
      const openTradesFromStatus: FTTrade[] = [];
      await Promise.allSettled(
        effectiveTradeBots.map(async (bot) => {
          try {
            const status = await botStatus(bot.id);
            for (const t of status) {
              (t as unknown as Record<string, unknown>)._bot_id = bot.id;
              (t as unknown as Record<string, unknown>)._bot_name = bot.name;
            }
            openTradesFromStatus.push(...status);
          } catch { /* ignore */ }
        })
      );

      if (m.current) {
        // Use botStatus open trades if available (they have current_profit fields)
        const effectiveOpen = openTradesFromStatus.length > 0 ? openTradesFromStatus : allOpen;
        setOpenTrades(effectiveOpen);
        setClosedTrades(allClosed);

        // Open P&L with fallback for field names
        const openPnlSum = effectiveOpen.reduce((s, t) => {
          const pnl = t.current_profit_abs ?? (t as unknown as Record<string, unknown>).profit_abs as number ?? 0;
          return s + pnl;
        }, 0);
        setTotalPnlOpen(openPnlSum);
        const totalStake = effectiveOpen.reduce((s, t) => s + t.stake_amount, 0);
        setTotalPnlOpenPct(totalStake > 0 ? (openPnlSum / totalStake) * 100 : null);
      }

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
      // Fallback accumulators for stats not always in /stats endpoint
      let aggWinningProfit = 0;
      let aggLosingProfit = 0;

      // Collect all perf, entry, exit data across bots
      const allPerf: FTPerformance[] = [];
      const allEntries: FTEntry[] = [];
      const allExits: FTExit[] = [];
      let firstWhitelist: FTWhitelist | null = null;
      let firstLocks: FTLocksResponse | null = null;

      await Promise.allSettled(
        effectiveTradeBots.map(async (bot) => {
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
              // Profit factor: use from stats; also accumulate winning/losing for fallback calculation
              if (stats.profit_factor != null) {
                aggPF = aggPF != null ? Math.max(aggPF, stats.profit_factor) : stats.profit_factor;
              }
              // Accumulate winning/losing profit for fallback profit factor
              if (stats.winning_profit != null) aggWinningProfit += stats.winning_profit;
              if (stats.losing_profit != null) aggLosingProfit += Math.abs(stats.losing_profit);
              // Sharpe ratio from stats
              if (stats.sharpe_ratio != null) {
                aggSharpe = aggSharpe != null ? Math.max(aggSharpe, stats.sharpe_ratio) : stats.sharpe_ratio;
              }
              // Max drawdown from stats
              if (stats.max_drawdown != null) {
                aggMaxDD = aggMaxDD != null ? Math.min(aggMaxDD, stats.max_drawdown) : stats.max_drawdown;
              }
              if (stats.max_drawdown_abs != null) {
                aggMaxDDAbs = aggMaxDDAbs != null ? Math.max(aggMaxDDAbs, stats.max_drawdown_abs) : stats.max_drawdown_abs;
              }
              // FIX 2: use negtrade_account_drawdown as additional fallback for max drawdown
              if (stats.negtrade_account_drawdown != null && stats.negtrade_account_drawdown < 0) {
                const statsMaxDD = stats.negtrade_account_drawdown; // already negative ratio
                aggMaxDD = aggMaxDD != null ? Math.min(aggMaxDD, statsMaxDD) : statsMaxDD;
              }
              if (stats.trading_volume != null) aggVolume += stats.trading_volume;
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

      // FALLBACK: compute performance stats from closed trades if API returned empty
      if (allPerf.length === 0 && allClosed.length > 0) {
        const pairMap = new Map<string, { count: number; profitSum: number; profitRatioSum: number }>();
        for (const t of allClosed) {
          const cur = pairMap.get(t.pair) ?? { count: 0, profitSum: 0, profitRatioSum: 0 };
          cur.count++;
          cur.profitSum += (t.close_profit_abs ?? 0);
          cur.profitRatioSum += (t.close_profit ?? 0);
          pairMap.set(t.pair, cur);
        }
        for (const [pair, s] of Array.from(pairMap.entries())) {
          allPerf.push({
            pair,
            trades: s.count,
            count: s.count,
            close_profit_abs: s.profitSum,
            profit_abs: s.profitSum,
            profit_ratio: s.count > 0 ? s.profitRatioSum / s.count : 0,
            profit: s.profitRatioSum,
          });
        }
      }

      // FALLBACK: compute entry/exit stats from closed trades if API returned empty
      if (allEntries.length === 0 && allClosed.length > 0) {
        const tagMap = new Map<string, { entries: number; wins: number; losses: number; draws: number; profitSum: number; avgProfitSum: number }>();
        for (const t of allClosed) {
          const tag = t.enter_tag || "(no tag)";
          const cur = tagMap.get(tag) ?? { entries: 0, wins: 0, losses: 0, draws: 0, profitSum: 0, avgProfitSum: 0 };
          cur.entries++;
          const pnl = t.close_profit_abs ?? 0;
          if (pnl > 0) cur.wins++;
          else if (pnl < 0) cur.losses++;
          else cur.draws++;
          cur.profitSum += pnl;
          cur.avgProfitSum += (t.close_profit ?? 0);
          tagMap.set(tag, cur);
        }
        for (const [tag, s] of Array.from(tagMap.entries())) {
          const total = s.wins + s.losses + s.draws;
          allEntries.push({
            enter_tag: tag,
            entries: s.entries,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            winrate: total > 0 ? s.wins / total : 0,
            profit_factor: s.losses > 0 ? Math.abs(s.wins / s.losses) : s.wins,
            profit_ratio: s.entries > 0 ? s.profitSum / s.entries : 0,
            profit_abs: s.profitSum,
            avg_profit: s.entries > 0 ? (s.avgProfitSum / s.entries) * 100 : 0,
          });
        }
      }
      if (allExits.length === 0 && allClosed.length > 0) {
        const reasonMap = new Map<string, { exits: number; wins: number; losses: number; draws: number; profitSum: number; avgProfitSum: number }>();
        for (const t of allClosed) {
          const reason = t.exit_reason || "(unknown)";
          const cur = reasonMap.get(reason) ?? { exits: 0, wins: 0, losses: 0, draws: 0, profitSum: 0, avgProfitSum: 0 };
          cur.exits++;
          const pnl = t.close_profit_abs ?? 0;
          if (pnl > 0) cur.wins++;
          else if (pnl < 0) cur.losses++;
          else cur.draws++;
          cur.profitSum += pnl;
          cur.avgProfitSum += (t.close_profit ?? 0);
          reasonMap.set(reason, cur);
        }
        for (const [reason, s] of Array.from(reasonMap.entries())) {
          const total = s.wins + s.losses + s.draws;
          allExits.push({
            exit_reason: reason,
            exits: s.exits,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            winrate: total > 0 ? s.wins / total : 0,
            profit_factor: s.losses > 0 ? Math.abs(s.wins / s.losses) : s.wins,
            profit_ratio: s.exits > 0 ? s.profitSum / s.exits : 0,
            profit_abs: s.profitSum,
            avg_profit: s.exits > 0 ? (s.avgProfitSum / s.exits) * 100 : 0,
          });
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

        // Compute closed P&L % from per-bot profit data
        let closedPctSum = 0;
        let closedPctCount = 0;
        for (const p of Object.values(profits)) {
          if (p.profit_closed_percent != null) {
            closedPctSum += p.profit_closed_percent;
            closedPctCount++;
          }
        }
        setTotalPnlClosedPct(closedPctCount > 0 ? closedPctSum / closedPctCount : null);

        // BUG 2 fix: fallback profit factor from winning/losing profit
        const finalPF = aggPF ?? (aggLosingProfit > 0 ? aggWinningProfit / aggLosingProfit : null);
        // BUG 6 fix: don't convert 0 volume to null — show $0
        // FIX 3: if volume is 0 but trades exist, compute from open trade stakes
        const finalVolume = effectiveTradeBots.length > 0 ? (aggVolume > 0 ? aggVolume :
          // Fallback: compute volume from open trade stakes
          openTradesFromStatus.reduce((s, t) => s + t.stake_amount * (t.leverage || 1), 0) || null
        ) : null;

        setAggStats({
          profitFactor: finalPF ?? (effectiveTradeBots.length > 0 ? 0 : null),
          sharpeRatio: aggSharpe,
          maxDrawdown: aggMaxDD != null ? aggMaxDD * 100 : null,
          maxDrawdownAbs: aggMaxDDAbs,
          tradingVolume: finalVolume,
          avgDuration: aggDurCount > 0 ? fmtDurationSec(aggDurTotal / aggDurCount) : "\u2014",
          bestPair: bestPairName,
          bestPairPct: bestPairRate,
          totalFees: aggTotalFees > 0 ? aggTotalFees : null,
          fundingFees: aggFundingFees > 0 ? aggFundingFees : null,
        });
      }

      // Daily P&L chart
      let fetchedDaily: FTDailyItem[] = [];
      try {
        const daily = await portfolioDaily();
        fetchedDaily = daily.data ?? [];
        if (m.current) setDailyData(fetchedDaily);
      } catch { if (m.current) setDailyData([]); }

      // FIX D: Compute Sharpe from daily data (FT /stats does not return sharpe_ratio for live)
      if (m.current && fetchedDaily.length >= 1) {
        let computedSharpe: number | null = null;
        const returns = fetchedDaily.map(d => {
          const base = d.starting_balance !== 0 ? Math.abs(d.starting_balance) : (totalEquity || 10000);
          return d.abs_profit / base;
        });
        if (returns.length === 1) {
          // Only 1 day: use the raw return as an approximation
          computedSharpe = returns[0] * Math.sqrt(252);
        } else {
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
          const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
          const std = Math.sqrt(variance);
          computedSharpe = std > 0 ? (mean / std) * Math.sqrt(252) : null;
        }

        // FIX E: Compute Max Drawdown from daily equity curve
        let computedMaxDD: number | null = null;
        if (fetchedDaily.length >= 1) {
          let peak = 0;
          let maxDd = 0;
          let cumulative = 0;
          for (const d of fetchedDaily) {
            cumulative += d.abs_profit;
            if (cumulative > peak) peak = cumulative;
            const dd = peak > 0 ? (peak - cumulative) / peak : 0;
            if (dd > maxDd) maxDd = dd;
          }
          // If only 1 day and it's negative, max drawdown = that day's loss pct
          if (fetchedDaily.length === 1 && fetchedDaily[0].abs_profit < 0) {
            const base = fetchedDaily[0].starting_balance !== 0 ? Math.abs(fetchedDaily[0].starting_balance) : (totalEquity || 10000);
            computedMaxDD = (fetchedDaily[0].abs_profit / base) * 100; // already negative
          } else {
            computedMaxDD = maxDd > 0 ? -maxDd * 100 : null;
          }
        }

        // Update aggStats with computed values as fallbacks
        setAggStats(prev => ({
          ...prev,
          sharpeRatio: prev.sharpeRatio ?? computedSharpe,
          maxDrawdown: prev.maxDrawdown ?? computedMaxDD,
        }));
      }

      // FIX 4: Fetch real market data for whitelist pairs via botPairCandles
      const wlData = firstWhitelist as FTWhitelist | null;
      if (m.current && wlData && wlData.whitelist.length > 0 && effectiveTradeBots.length > 0) {
        const firstBotForCandles = effectiveTradeBots[0].id;
        const marketResults: Record<string, { change24h: number; volume: number; volatility: number }> = {};
        await Promise.allSettled(
          wlData.whitelist.map(async (pair: string) => {
            try {
              const candles = await botPairCandles(firstBotForCandles, pair, "1d", 2);
              if (candles && candles.data && candles.data.length >= 1) {
                // Find column indexes
                const cols = candles.columns;
                const closeIdx = cols.indexOf("close");
                const highIdx = cols.indexOf("high");
                const lowIdx = cols.indexOf("low");
                const volumeIdx = cols.indexOf("volume");

                if (candles.data.length >= 2) {
                  const yesterday = candles.data[candles.data.length - 2];
                  const today = candles.data[candles.data.length - 1];
                  const todayClose = (today[closeIdx] as number) ?? 0;
                  const yesterdayClose = (yesterday[closeIdx] as number) ?? 0;
                  const change24h = yesterdayClose > 0 ? ((todayClose - yesterdayClose) / yesterdayClose) * 100 : 0;
                  const vol = (today[volumeIdx] as number) ?? 0;
                  const high = (today[highIdx] as number) ?? 0;
                  const low = (today[lowIdx] as number) ?? 0;
                  const volatility = todayClose > 0 ? ((high - low) / todayClose) * 100 : 0;
                  marketResults[pair] = { change24h, volume: vol, volatility };
                } else {
                  // Only 1 candle available
                  const today = candles.data[0];
                  const todayClose = (today[closeIdx] as number) ?? 0;
                  const vol = (today[volumeIdx] as number) ?? 0;
                  const high = (today[highIdx] as number) ?? 0;
                  const low = (today[lowIdx] as number) ?? 0;
                  const volatility = todayClose > 0 ? ((high - low) / todayClose) * 100 : 0;
                  marketResults[pair] = { change24h: 0, volume: vol, volatility };
                }
              }
            } catch { /* non-blocking per pair */ }
          })
        );
        if (m.current) setPairMarketData(marketResults);
      }

      // Weekly + Monthly for chart toggles (from first running bot)
      if (effectiveTradeBots.length > 0) {
        const firstBotId = effectiveTradeBots[0].id;
        Promise.allSettled([
          botWeekly(firstBotId, 12),
          botMonthly(firstBotId, 12),
          botBalance(firstBotId),
          botSysinfo(firstBotId),
          botLogs(firstBotId, 100),
          botHealth(firstBotId),
        ]).then(([w, mo, bal, sys, logs, health]) => {
          if (!m.current) return;
          if (w.status === "fulfilled") setWeeklyData(w.value);
          if (mo.status === "fulfilled") setMonthlyData(mo.value);
          if (bal.status === "fulfilled") setBalanceData(bal.value);
          if (sys.status === "fulfilled") setSysinfoData(sys.value);
          if (logs.status === "fulfilled") setLogsData(logs.value);
          if (health.status === "fulfilled") setMainHealthData(health.value);
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
      botConfig(botId),
    ]).then(([st, tr, perf, ent, ex, stats, sys, logs, lk, bal, health, cfg]) => {
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
      if (cfg.status === "fulfilled") setSingleConfigData(cfg.value);
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
    const ok = await confirmDlg({ title: "Stop Bot", message: "Stop this bot? It will stop trading but remain registered.", confirmLabel: "Stop", variant: "warning" });
    if (!ok) return;
    await handleBotAction("Stop", botId, () => stopBot(botId));
  }

  async function handlePauseBot(botId: number) {
    await handleBotAction("Pause (Stopbuy)", botId, () => botPause(botId));
  }

  async function handleReloadBot(botId: number) {
    await handleBotAction("Reload config", botId, () => reloadBotConfig(botId));
  }

  async function handleForceExitAllBot(botId: number) {
    const ok = await confirmDlg({ title: "Force Exit All", message: "Force exit ALL open trades on this bot at market price? Cannot be undone.", confirmLabel: "Force Exit All", variant: "danger" });
    if (!ok) return;
    await handleBotAction("Force exit all", botId, () => botForceExit(botId, "all"));
  }

  async function handleStopBuyBot(botId: number) {
    await handleBotAction("Toggle Stopbuy", botId, () => botStopBuy(botId));
  }

  async function handleSoftKillBot(botId: number) {
    const ok = await confirmDlg({ title: "Soft Kill", message: "Exit all open trades gracefully and keep the bot process alive?", confirmLabel: "Soft Kill", variant: "warning" });
    if (!ok) return;
    await handleBotAction("Soft Kill", botId, () => softKill(botId, "Manual soft kill from dashboard"));
  }

  async function handleHardKillBot(botId: number) {
    const ok = await confirmDlg({ title: "HARD KILL", message: "This will FORCE STOP the bot AND its container immediately. Cannot be undone. Continue?", confirmLabel: "Hard Kill", variant: "danger" });
    if (!ok) return;
    await handleBotAction("Hard Kill", botId, () => hardKill(botId, "Manual hard kill from dashboard"));
  }

  async function handleDrainBot(botId: number) {
    const ok = await confirmDlg({ title: "Drain Bot", message: "Stop accepting new entries and wait for positions to close naturally?", confirmLabel: "Start Drain", variant: "warning" });
    if (!ok) return;
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

  async function handleForceEnter(trade: FTTrade) {
    if (!trade._bot_id) {
      toast.error("Cannot determine which bot owns this trade.");
      return;
    }
    const ok = await confirmDlg({
      title: "Increase Position",
      message: `Add another entry to your existing ${trade.pair} position at market price?`,
      confirmLabel: "Increase",
      variant: "warning",
    });
    if (!ok) return;
    const loadId = toast.loading(`Increasing position for ${trade.pair}...`);
    try {
      await botForceEnter(trade._bot_id, trade.pair, trade.is_short ? "short" : "long");
      toast.dismiss(loadId);
      toast.success(`Position increase submitted for ${trade.pair}.`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? `Increase failed: ${err.message}` : "Increase position failed.");
    }
  }

  async function handleDeleteTrade(trade: FTTrade) {
    if (!trade._bot_id) return;
    const ok = await confirmDlg({
      title: "Delete Trade",
      message: `Delete trade #${trade.trade_id} (${trade.pair})? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
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

  // Today's P&L from daily data — with fallback to closed trades and open P&L
  const today = new Date().toISOString().slice(0, 10);
  const todayPnl = (() => {
    // Try daily data first
    if (dailyData.length > 0) {
      const last = dailyData[dailyData.length - 1];
      if (last?.date === today) return last.abs_profit;
    }
    // Fallback: sum of closed trades today
    const todayClosed = closedTrades.filter(t => t.close_date?.startsWith(today));
    if (todayClosed.length > 0) return todayClosed.reduce((s, t) => s + (t.close_profit_abs ?? 0), 0);
    // Fallback: sum of open trades P&L
    const openPnl = openTrades.reduce((s, t) => s + (t.current_profit_abs ?? (t as unknown as Record<string, unknown>).profit_abs as number ?? 0), 0);
    return openPnl;
  })();
  const todayPnlPct = (() => {
    if (dailyData.length > 0) {
      const last = dailyData[dailyData.length - 1];
      if (last?.date === today) return last.rel_profit ?? 0;
    }
    // Fallback: compute from closed trades today
    const todayClosed = closedTrades.filter(t => t.close_date?.startsWith(today));
    if (todayClosed.length > 0) {
      const totalStake = todayClosed.reduce((s, t) => s + t.stake_amount, 0);
      const totalProfit = todayClosed.reduce((s, t) => s + (t.close_profit_abs ?? 0), 0);
      return totalStake > 0 ? totalProfit / totalStake : 0;
    }
    return 0;
  })();

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
      <div className="flex flex-1 overflow-hidden l-grid p-5 flex-col gap-5">
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
              onForceEnter={handleForceEnter}
              onReloadTrade={handleReloadTrade}
              onDeleteTrade={handleDeleteTrade}
              onCancelOrder={handleCancelOpenOrder}
              exitingTradeId={exitingTradeId}
              pairMarketData={pairMarketData}
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
            healthData={mainHealthData}
            exchangeName={bots.find(b => b.status === "running")?.exchange_name}
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
        configData={singleConfigData}
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
        onPause={() => selectedBot && handlePauseBot(selectedBot.id)}
        onReload={() => selectedBot && handleReloadBot(selectedBot.id)}
        onForceExitAll={() => selectedBot && handleForceExitAllBot(selectedBot.id)}
        onStopBuy={() => selectedBot && handleStopBuyBot(selectedBot.id)}
        onSoftKill={() => selectedBot && handleSoftKillBot(selectedBot.id)}
        onHardKill={() => selectedBot && handleHardKillBot(selectedBot.id)}
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
      <ConfirmDialog {...confirmProps} />
    </AppShell>
  );
}
