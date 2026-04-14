"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog, { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getBots,
  getDashboardSnapshot,
  type DashboardSnapshot,
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
  portfolioWeekly,
  portfolioMonthly,
  startBot,
  stopBot,

  botDeleteTrade,
  botReloadTrade,
  botCancelOpenOrder,
  botConfig,
  botPerformance,
  botEntries,
  botExits,
  botSysinfo,
  botLogs,

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
  botLockAdd,
  botDeleteLock,
  botBlacklist,
  botBlacklistAdd,
  botBlacklistDelete,
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
import ProfitChart from "@/components/dashboard/ProfitChart";
import TradeTable from "@/components/dashboard/TradeTable";
import RightSidebar from "@/components/dashboard/RightSidebar";
import BotDetailPanel from "@/components/dashboard/BotDetailPanel";
import BotEditModal from "@/components/bots/BotEditModal";
import BotDeleteDialog from "@/components/bots/BotDeleteDialog";
import { registerBot, deleteBot as deleteBotApi } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

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
  const [botBalances, setBotBalances] = useState<Record<string, number>>({});
  const [dailyData, setDailyData] = useState<FTDailyItem[]>([]);
  const [blacklistData, setBlacklistData] = useState<{ blacklist: string[]; blacklist_expanded: string[] } | null>(null);

  // Real-time WS spread data for Whitelist Matrix
  const tradeBotIdsRaw = useMemo(() => bots.filter(b => b.status === "running").map(b => b.id), [bots]);
  const tradeBotIdsKey = JSON.stringify(tradeBotIdsRaw);
  const tradeBotIds = useMemo(() => tradeBotIdsRaw, [tradeBotIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const spreadData = useWebSocket(tradeBotIds, tradeBotIds.length > 0);

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
  const [totalTradingDays, setTotalTradingDays] = useState<number | null>(null);

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
    feeOpenAvg: number | null;
    feeCloseAvg: number | null;
    maxOpenTrades: number | null;
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
    feeOpenAvg: null,
    feeCloseAvg: null,
    maxOpenTrades: null,
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
  const [whitelistBotMap, setWhitelistBotMap] = useState<Map<string, number>>(new Map());
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
      // ── STAGE 1: Bot list + snapshot in parallel ──────────────────────
      const [botListResult, snapshotResult] = await Promise.allSettled([
        getBots(),
        getDashboardSnapshot(),
      ]);
      if (!m.current) return;

      const botList = botListResult.status === "fulfilled" ? botListResult.value : [];
      setBots(botList);

      const snap: DashboardSnapshot | null =
        snapshotResult.status === "fulfilled" ? snapshotResult.value : null;

      const runningBots = botList.filter((b) => b.status === "running" || b.status === "draining");
      const tradeBots = runningBots.filter((b) => {
        if (b.ft_mode === "webserver") return false;
        if (b.is_utility === true) return false;
        return true;
      });
      // If no trade bots found but we have running bots, use ALL running bots as fallback
      const effectiveTradeBots = tradeBots.length > 0 ? tradeBots : runningBots;

      // ── STAGE 2: Portfolio data from snapshot (or live fallback) ─────
      // Snapshot is pre-computed by DashboardWorker every 30s → Redis.
      // First load after orchestrator restart may fall back to live calls (~30s warm-up).
      const [pbResult, ppResult, ptResult, pdResult] = snap?.portfolio?.balance && snap?.portfolio?.profit
        ? [
            { status: "fulfilled" as const, value: snap.portfolio.balance },
            { status: "fulfilled" as const, value: snap.portfolio.profit },
            { status: "fulfilled" as const, value: snap.portfolio.trades ?? { trades: [], trade_count: 0, bot_count: 0 } },
            { status: "fulfilled" as const, value: snap.portfolio.daily ?? { data: [], stake_currency: "USDT", bot_count: 0 } },
          ]
        : await Promise.allSettled([
            portfolioBalance(),
            portfolioProfit(),
            portfolioTrades(),
            portfolioDaily(),
          ]);

      // Portfolio balance
      const fetchedTotalEquity: number = pbResult.status === "fulfilled" ? (pbResult.value.total_value ?? 0) : 0;
      if (pbResult.status === "fulfilled" && m.current) {
        setTotalEquity(pbResult.value.total_value);
        // Per-bot balances for the fleet table (bot name -> total)
        const perBotBal: Record<string, number> = {};
        for (const [name, bal] of Object.entries(pbResult.value.bots ?? {})) {
          if (bal && typeof bal === "object" && "total" in bal) {
            perBotBal[name] = (bal as { total: number }).total;
          }
        }
        setBotBalances(perBotBal);
      }

      // Portfolio profit
      let portfolioProfitData: Record<string, Record<string, unknown>> | null = null;
      if (ppResult.status === "fulfilled" && m.current) {
        const pp = ppResult.value;
        setTotalPnlClosed(pp.combined.profit_closed_coin);
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

      // Portfolio trades
      let allOpen: FTTrade[] = [];
      let allClosed: FTTrade[] = [];
      if (ptResult.status === "fulfilled" && m.current) {
        const trades = ptResult.value?.trades || [];
        allOpen = trades.filter((t) => t.is_open);
        allClosed = trades.filter((t) => !t.is_open);
        
        // totalTradingDays is computed after Stage 3 from first_trade_date_ts (per-bot profit)
        // — do not set it here from open trades (open trades only go back to current positions)
      }

      // Daily chart data (fetched in parallel, not sequentially)
      let fetchedDaily: FTDailyItem[] = [];
      if (pdResult.status === "fulfilled") {
        fetchedDaily = pdResult.value.data ?? [];
      }

      // ── STAGE 3: Per-bot calls — ALL bots fire simultaneously ────────
      // BUG 7 fix + botStatus + per-bot aggregation ALL in one wave
      const openTradesFromStatus: FTTrade[] = [];
      const portfolioHadClosedTrades = allClosed.length > 0; // Flag BEFORE parallel loop

      // NOTE: setOpenTrades/setClosedTrades moved to AFTER the per-bot loop
      // to ensure openTradesFromStatus and BUG 7 allClosed data are populated first

      // Per-bot sparklines + profits + stats aggregation
      const profits: Record<number, Partial<FTProfit>> = {};
      const sparks: Record<number, number[]> = {};
      const aggSharpe: number | null = null;
      let aggMaxDDAbs: number | null = null;
      const aggVolume = 0;
      const aggDurTotal = 0;
      const aggDurCount = 0;
      let bestPairName: string | null = null;
      let bestPairRate: number | null = null;
      // Sum max_open_trades across all trade bots; -1 means unlimited (any -1 → total = -1)
      const aggMaxOpenTrades: number = effectiveTradeBots.some(b => (b.max_open_trades ?? 0) === -1)
        ? -1
        : effectiveTradeBots.reduce((s, b) => s + (b.max_open_trades ?? 0), 0);
      // Accumulators for profit factor (sum winning / sum losing across all bots)
      const aggWinningProfit = 0;
      const aggLosingProfit = 0;

      // Collect all perf, entry, exit data across bots
      const allPerf: FTPerformance[] = [];
      const allEntries: FTEntry[] = [];
      const allExits: FTExit[] = [];
      // Merged whitelist/locks across all bots (with source bot ID)
      const mergedWhitelistPairs = new Map<string, number>(); // pair → botId
      const allLockEntries: FTLocksResponse["locks"] = [];

      // ── STAGE 3: Per-bot profit + sparklines + open trades ───────────
      // From snapshot if available (pre-computed), otherwise live batched calls.
      if (snap) {
        // Snapshot: read pre-computed per-bot profit + sparklines
        for (const bot of effectiveTradeBots) {
          const p = snap.per_bot_profit[String(bot.id)] as Partial<FTProfit> | undefined;
          if (p) {
            profits[bot.id] = p;
            if (p.best_pair && (bestPairRate == null || (p.best_pair_profit_ratio ?? p.best_rate ?? 0) > (bestPairRate ?? 0))) {
              bestPairName = p.best_pair;
              bestPairRate = p.best_pair_profit_ratio ?? p.best_rate ?? null;
            }
          }
          const s = snap.sparklines[String(bot.id)];
          if (s) sparks[bot.id] = s;
        }
        // Open trades from snapshot (same source as botStatus — already annotated with _bot_id/_bot_name)
        for (const t of (ptResult.status === "fulfilled" ? ptResult.value?.trades ?? [] : [])) {
          if (!t.is_open) continue;
          if (t.current_profit == null && (t as unknown as Record<string, unknown>).profit_ratio != null) {
            t.current_profit = (t as unknown as Record<string, unknown>).profit_ratio as number;
          }
          if (t.current_profit_abs == null && (t as unknown as Record<string, unknown>).profit_abs != null) {
            t.current_profit_abs = (t as unknown as Record<string, unknown>).profit_abs as number;
          }
          openTradesFromStatus.push(t);
        }

        // Closed trades from snapshot (no API calls needed)
        for (const bot of effectiveTradeBots) {
          const botClosed = snap.closed_trades?.[String(bot.id)];
          if (botClosed) allClosed.push(...botClosed);
        }
      } else {
        // Fallback: live per-bot calls in batches of 20 (snapshot not yet ready)
        const BATCH_SIZE = 20;
        for (let i = 0; i < effectiveTradeBots.length; i += BATCH_SIZE) {
          const batch = effectiveTradeBots.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (bot) => {
            try {
              const [p, d, statusResult] = await Promise.allSettled([
                botProfit(bot.id),
                botDaily(bot.id, 7),
                botStatus(bot.id),
              ]);
              if (p.status === "fulfilled") profits[bot.id] = p.value;
              if (d.status === "fulfilled") sparks[bot.id] = d.value.data.map((item) => item.abs_profit);

              if (statusResult.status === "fulfilled") {
                for (const t of statusResult.value) {
                  (t as unknown as Record<string, unknown>)._bot_id = bot.id;
                  (t as unknown as Record<string, unknown>)._bot_name = bot.name;
                  if (t.current_profit == null && t.profit_ratio != null) t.current_profit = t.profit_ratio;
                  if (t.current_profit_abs == null && t.profit_abs != null) t.current_profit_abs = t.profit_abs;
                }
                openTradesFromStatus.push(...statusResult.value);
              }

              if (!portfolioHadClosedTrades) {
                try {
                  const result = await botTrades(bot.id, 200);
                  const perBotClosed = result.trades
                    .filter((t) => !t.is_open)
                    .map((t) => ({ ...t, _bot_id: bot.id, _bot_name: bot.name }));
                  allClosed.push(...perBotClosed);
                } catch { /* non-blocking */ }
              }

              if (p.status === "fulfilled") {
                const prof = p.value;
                if (prof.best_pair && (bestPairRate == null || (prof.best_pair_profit_ratio ?? prof.best_rate) > (bestPairRate ?? 0))) {
                  bestPairName = prof.best_pair;
                  bestPairRate = prof.best_pair_profit_ratio ?? prof.best_rate ?? null;
                }
              }
            } catch { /* per-bot isolated */ }
            })
          );
        } // end batch loop
      } // end snapshot else

      // Aggregate max_drawdown + max_drawdown_abs across all bots
      // max_drawdown is a ratio from FT's own equity-based calculation → take worst (max)
      for (const prof of Object.values(profits)) {
        const ddAbs = prof.max_drawdown_abs;
        if (ddAbs != null && ddAbs > 0) {
          aggMaxDDAbs = (aggMaxDDAbs ?? 0) + ddAbs;
        }
      }

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

      // Compute totalTradingDays — take the EARLIEST timestamp across all sources:
      //   1. first_trade_date_ts from per-bot FT profit (seconds → ms)
      //   2. Earliest date in daily chart data with any activity
      //   3. Earliest open_date / open_timestamp across all closed trades
      // This handles cases where individual FT DBs were reset but aggregated data is older.
      {
        let earliestMs: number | null = null;

        // Source 1: first_trade_date_ts / first_trade_date from per-bot profit
        for (const prof of Object.values(profits)) {
          const ts = (prof as Record<string, unknown>).first_trade_date_ts as number | undefined;
          if (ts && ts > 0) {
            const ms = ts * 1000; // FT returns seconds
            if (earliestMs === null || ms < earliestMs) earliestMs = ms;
          } else if (prof.first_trade_date) {
            const ms = new Date(prof.first_trade_date).getTime();
            if (!isNaN(ms) && (earliestMs === null || ms < earliestMs)) earliestMs = ms;
          }
        }

        // Source 2: earliest date in daily chart with any activity
        // fetchedDaily is sorted ascending by date
        for (const d of fetchedDaily) {
          if ((d.trade_count ?? 0) > 0 || (d.abs_profit ?? 0) !== 0) {
            const ms = new Date(d.date).getTime();
            if (!isNaN(ms) && (earliestMs === null || ms < earliestMs)) earliestMs = ms;
            break; // sorted asc — first match is oldest
          }
        }

        // Source 3: earliest open_date across all closed trades in snapshot
        for (const t of allClosed) {
          const raw = t as unknown as Record<string, unknown>;
          const ms: number =
            (raw.open_timestamp as number | undefined) ??
            (t.open_date ? new Date(t.open_date).getTime() : 0);
          if (ms > 0 && (earliestMs === null || ms < earliestMs)) earliestMs = ms;
        }

        const days = earliestMs !== null ? Math.ceil((Date.now() - earliestMs) / (1000 * 60 * 60 * 24)) : null;
        console.log("[totalTradingDays] earliestMs=%o days=%o profits=%o fetchedDaily=%o allClosed=%o",
          earliestMs ? new Date(earliestMs).toISOString() : null,
          days,
          Object.values(profits).map(p => ({ first_trade_date: (p as Record<string,unknown>).first_trade_date, first_trade_date_ts: (p as Record<string,unknown>).first_trade_date_ts })),
          fetchedDaily.filter(d => d.trade_count > 0 || d.abs_profit !== 0).slice(0, 3),
          allClosed.length
        );
        setTotalTradingDays(days);
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

      // ALWAYS compute entry/exit stats from closed trades for reliability
      // (FT /entries and /exits endpoints often return empty or incomplete data)
      if (allClosed.length > 0) {
        // Entry tags from closed trades
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
        // Only use computed data if it has more tags than the API data (or API was empty)
        if (tagMap.size > allEntries.length || allEntries.length === 0) {
          allEntries.length = 0; // clear API data
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
      }
      if (allClosed.length > 0) {
        // Exit reasons from closed trades
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
        if (reasonMap.size > allExits.length || allExits.length === 0) {
          allExits.length = 0;
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
      }

      if (m.current) {
        // NOW set open/closed trades — per-bot loop has populated openTradesFromStatus and allClosed
        // DEDUP: botStatus trades are preferred (have current_profit), but may overlap with portfolioTrades
        let effectiveOpen: FTTrade[];
        if (openTradesFromStatus.length > 0) {
          // Use botStatus trades (most reliable profit data), dedup by trade_id
          const seen = new Set<string>();
          effectiveOpen = [];
          for (const t of openTradesFromStatus) {
            const key = `${(t as unknown as Record<string, unknown>)._bot_id ?? 0}_${t.trade_id}`;
            if (!seen.has(key)) {
              seen.add(key);
              effectiveOpen.push(t);
            }
          }
        } else {
          effectiveOpen = allOpen;
        }
        setOpenTrades(effectiveOpen);
        setClosedTrades(allClosed);

        // Open P&L with fallback for field names
        const openPnlSum = effectiveOpen.reduce((s, t) => {
          const pnl = t.current_profit_abs ?? ((t as unknown as Record<string, unknown>).profit_abs as number | undefined) ?? 0;
          console.log(`[KPI DEBUG] OPEN P&L: bot=${(t as unknown as Record<string, unknown>)._bot_name} pair=${t.pair} trade_id=${t.trade_id} current_profit_abs=${t.current_profit_abs} pnl_used=${pnl}`);
          return s + pnl;
        }, 0);
        console.log(`[KPI DEBUG] OPEN P&L TOTAL: $${openPnlSum.toFixed(2)} from ${effectiveOpen.length} trades`);
        setTotalPnlOpen(openPnlSum);
        const totalStake = effectiveOpen.reduce((s, t) => s + t.stake_amount, 0);
        setTotalPnlOpenPct(totalStake > 0 ? (openPnlSum / totalStake) * 100 : null);

        setBotProfits(profits);
        setSparklines(sparks);
        setPerfData(allPerf);
        setEntryData(allEntries);
        setExitData(allExits);
        // Build merged whitelist from all bots
        if (mergedWhitelistPairs.size > 0) {
          const pairs = Array.from(mergedWhitelistPairs.keys());
          setWhitelistData({ whitelist: pairs, length: pairs.length, method: ["StaticPairList"] });
        } else {
          setWhitelistData(null);
        }
        setWhitelistBotMap(mergedWhitelistPairs);
        // Build merged locks from all bots
        setLocksData(allLockEntries.length > 0 ? { lock_count: allLockEntries.length, locks: allLockEntries } : null);

        // Load blacklist from first running bot
        const firstRunning = botList.find((b) => b.status === "running");
        if (firstRunning) {
          try {
            const bl = await botBlacklist(firstRunning.id);
            setBlacklistData(bl);
          } catch { /* non-critical */ }
        }

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

        // Profit factor from winning/losing profit sums (correct multi-bot aggregation)
        let finalPF = aggLosingProfit > 0 ? aggWinningProfit / aggLosingProfit : null;
        // FALLBACK: compute profit factor from ALL trades (closed + open)
        if (finalPF == null && (allClosed.length > 0 || openTradesFromStatus.length > 0)) {
          let winSum = 0, lossSum = 0;
          for (const t of allClosed) {
            const pnl = t.close_profit_abs ?? 0;
            if (pnl > 0) winSum += pnl;
            else if (pnl < 0) lossSum += Math.abs(pnl);
          }
          // Include open trades unrealized P&L
          for (const t of openTradesFromStatus) {
            const pnl = t.current_profit_abs ?? 0;
            if (pnl > 0) winSum += pnl;
            else if (pnl < 0) lossSum += Math.abs(pnl);
          }
          finalPF = lossSum > 0 ? winSum / lossSum : (winSum > 0 ? winSum : null);
        }

        // Max drawdown as % of total portfolio equity:
        // aggMaxDDAbs = sum of absolute dollar drawdowns from FT's profit API
        // fetchedTotalEquity = total portfolio balance ($700k etc)
        // Result: how much of total equity was lost at worst point
        let finalMaxDD: number | null =
          aggMaxDDAbs != null && aggMaxDDAbs > 0 && fetchedTotalEquity > 0
            ? -(aggMaxDDAbs / fetchedTotalEquity * 100)
            : null;

        // FALLBACK: Sharpe ratio from ALL trade returns (closed + open)
        let finalSharpe: number | null = aggSharpe;
        const allReturns = [
          ...allClosed.map(t => t.close_profit ?? 0),
          ...openTradesFromStatus.map(t => t.current_profit ?? 0),
        ];
        if (finalSharpe == null && allReturns.length >= 3) {
          const mean = allReturns.reduce((s, r) => s + r, 0) / allReturns.length;
          const variance = allReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / allReturns.length;
          const std = Math.sqrt(variance);
          if (std > 0) finalSharpe = (mean / std) * Math.sqrt(252); // annualized
        }

        // Volume: closed + open trade stakes combined
        const closedVolume = allClosed.reduce((s, t) => s + t.stake_amount * (t.leverage || 1), 0);
        const openVolume = openTradesFromStatus.reduce((s, t) => s + t.stake_amount * (t.leverage || 1), 0);
        const volumeResult = aggVolume > 0 ? aggVolume : ((closedVolume + openVolume) || null);

        // Avg duration: closed + open (open uses current time as end)
        let finalAvgDur = aggDurCount > 0 ? fmtDurationSec(aggDurTotal / aggDurCount) : null;
        if (!finalAvgDur && (allClosed.length > 0 || openTradesFromStatus.length > 0)) {
          let durSum = 0, durN = 0;
          const now = Date.now();
          for (const t of allClosed) {
            if (t.close_date && t.open_date) {
              const ms = new Date(t.close_date).getTime() - new Date(t.open_date).getTime();
              if (ms > 0) { durSum += ms / 1000; durN++; }
            }
          }
          // Open trades: duration = now - open_date
          for (const t of openTradesFromStatus) {
            if (t.open_date) {
              const ms = now - new Date(t.open_date).getTime();
              if (ms > 0) { durSum += ms / 1000; durN++; }
            }
          }
          if (durN > 0) finalAvgDur = fmtDurationSec(durSum / durN);
        }

        // Compute fees directly from trade data (FTTrade has fee_open, fee_close, funding_fees)
        const allTradesForFees = [...allClosed, ...openTradesFromStatus];
        let totalFeesAbs = 0;
        let feeOpenSum = 0;
        let feeCloseSum = 0;
        let fundingFeesSum = 0;
        for (const t of allTradesForFees) {
          const volume = t.stake_amount * (t.leverage || 1);
          totalFeesAbs += volume * t.fee_open + volume * t.fee_close;
          feeOpenSum += t.fee_open;
          feeCloseSum += t.fee_close;
          fundingFeesSum += t.funding_fees ?? 0;
        }
        const tradeCount = allTradesForFees.length;

        setAggStats({
          profitFactor: finalPF ?? (effectiveTradeBots.length > 0 ? 0 : null),
          sharpeRatio: finalSharpe,
          maxDrawdown: finalMaxDD,
          maxDrawdownAbs: aggMaxDDAbs,
          tradingVolume: volumeResult,
          avgDuration: finalAvgDur ?? "\u2014",
          bestPair: bestPairName,
          bestPairPct: bestPairRate,
          totalFees: totalFeesAbs > 0 ? totalFeesAbs : null,
          fundingFees: Math.abs(fundingFeesSum) > 0 ? fundingFeesSum : null,
          feeOpenAvg: tradeCount > 0 ? (feeOpenSum / tradeCount) * 100 : null,
          feeCloseAvg: tradeCount > 0 ? (feeCloseSum / tradeCount) * 100 : null,
          maxOpenTrades: aggMaxOpenTrades !== 0 ? aggMaxOpenTrades : null,
        });
      }

      // Daily fallback: if portfolio daily was empty, use first bot's daily (already fetched as sparkline)
      if (fetchedDaily.length === 0 && effectiveTradeBots.length > 0) {
        try {
          const botDailyResp = await botDaily(effectiveTradeBots[0].id, 30);
          fetchedDaily = botDailyResp.data ?? [];
        } catch { /* per-bot daily also failed */ }
      }

      if (m.current) setDailyData(fetchedDaily);

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

        // Update aggStats with computed Sharpe as fallback
        setAggStats(prev => ({
          ...prev,
          sharpeRatio: prev.sharpeRatio ?? computedSharpe,
        }));
      }

      // FIX 4: Fetch real market data for whitelist pairs via botPairCandles
      const wlPairs = Array.from(mergedWhitelistPairs.keys());
      if (m.current && wlPairs.length > 0 && effectiveTradeBots.length > 0) {
        const firstBotForCandles = effectiveTradeBots[0].id;
        const marketResults: Record<string, { change24h: number; volume: number; volatility: number }> = {};
        await Promise.allSettled(
          wlPairs.map(async (pair: string) => {
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

      // Weekly + Monthly for chart toggles — from snapshot if available, otherwise live
      if (snap?.portfolio?.weekly) setWeeklyData(snap.portfolio.weekly);
      if (snap?.portfolio?.monthly) setMonthlyData(snap.portfolio.monthly);

      if (effectiveTradeBots.length > 0) {
        const firstBotId = effectiveTradeBots[0].id;
        const liveWeekly = snap?.portfolio?.weekly ? null : portfolioWeekly(12);
        const liveMonthly = snap?.portfolio?.monthly ? null : portfolioMonthly(12);
        Promise.allSettled([
          liveWeekly ?? Promise.resolve(null),
          liveMonthly ?? Promise.resolve(null),
          botBalance(firstBotId),
          botSysinfo(firstBotId),
          botLogs(firstBotId, 100),
          botHealth(firstBotId),
        ]).then(([w, mo, bal, sys, logs, health]) => {
          if (!m.current) return;
          if (w.status === "fulfilled" && w.value) setWeeklyData(w.value);
          if (mo.status === "fulfilled" && mo.value) setMonthlyData(mo.value);
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

      // Debug: log status of each API call
      if (stats.status === "fulfilled") {
        const sv = stats.value;
        console.log("[DRAWER DEBUG] Bot", botId, "stats:", { PF: sv.profit_factor, DD: sv.max_drawdown, sharpe: sv.sharpe_ratio, wins: sv.wins, losses: sv.losses });
      } else {
        console.log("[DRAWER DEBUG] Bot", botId, "stats: REJECTED");
      }

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

  async function handleLockPair(pair: string, botId: number) {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const loadId = toast.loading(`Locking ${pair}...`);
    try {
      await botLockAdd(botId, { pair, until, reason: "Manual lock from dashboard" });
      toast.dismiss(loadId);
      toast.success(`${pair} locked for 24h.`);
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Lock pair failed.");
    }
  }

  async function handleUnlockPair(lockId: number, botId: number) {
    const loadId = toast.loading("Unlocking pair...");
    try {
      await botDeleteLock(botId, lockId);
      toast.dismiss(loadId);
      toast.success("Pair unlocked.");
      await loadPortfolioData(false);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Unlock pair failed.");
    }
  }

  async function handleAddBlacklist(pair: string) {
    const runningBot = bots.find((b) => b.status === "running");
    if (!runningBot) { toast.error("No running bot to blacklist pair."); return; }
    const loadId = toast.loading(`Blacklisting ${pair}...`);
    try {
      const result = await botBlacklistAdd(runningBot.id, [pair]);
      toast.dismiss(loadId);
      if (result.errors?.length) toast.error(result.errors.join(", "));
      else { toast.success(`${pair} added to blacklist.`); setBlacklistData(result); }
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Blacklist add failed.");
    }
  }

  async function handleDeleteBlacklist(pair: string) {
    const runningBot = bots.find((b) => b.status === "running");
    if (!runningBot) { toast.error("No running bot to modify blacklist."); return; }
    const loadId = toast.loading(`Removing ${pair} from blacklist...`);
    try {
      const result = await botBlacklistDelete(runningBot.id, pair);
      toast.dismiss(loadId);
      toast.success(`${pair} removed from blacklist.`);
      setBlacklistData(result);
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Blacklist remove failed.");
    }
  }

  // ── Computed values (CLOSED + OPEN combined for live KPI view) ───────

  const selectedBot = bots.find((b) => b.id === selectedBotId) ?? null;
  const today = new Date().toISOString().slice(0, 10);

  // Open trades unrealized P&L
  const openPnlTotal = openTrades.reduce((s, t) => s + (t.current_profit_abs ?? 0), 0);
  const openStakeTotal = openTrades.reduce((s, t) => s + t.stake_amount, 0);

  // ── TODAY'S P&L: closed today + ALL open unrealized ──────────────────
  const todayClosedTrades = closedTrades.filter(t => t.close_date?.startsWith(today));
  const todayClosedPnl = todayClosedTrades.reduce((s, t) => s + (t.close_profit_abs ?? 0), 0);
  const todayPnl = (() => {
    // Daily data from API gives the best "today" value, but we ALWAYS add open unrealized
    if (dailyData.length > 0) {
      const last = dailyData[dailyData.length - 1];
      if (last?.date === today) return last.abs_profit + openPnlTotal;
    }
    // Fallback: closed trades today + open unrealized
    return todayClosedPnl + openPnlTotal;
  })();
  const todayPnlPct = (() => {
    const totalStake = todayClosedTrades.reduce((s, t) => s + t.stake_amount, 0) + openStakeTotal;
    if (totalStake > 0) return ((todayClosedPnl + openPnlTotal) / totalStake);
    if (dailyData.length > 0) {
      const last = dailyData[dailyData.length - 1];
      if (last?.date === today) return last.rel_profit ?? 0;
    }
    return 0;
  })();

  // ── WIN RATE: closed + open combined ─────────────────────────────────
  const openWins = openTrades.filter(t => (t.current_profit_abs ?? 0) > 0).length;
  const openLosses = openTrades.filter(t => (t.current_profit_abs ?? 0) < 0).length;
  const combinedWins = totalWins + openWins;
  const combinedLosses = totalLosses + openLosses;
  const combinedTotal = combinedWins + combinedLosses;
  const combinedWinRate = combinedTotal > 0 ? (combinedWins / combinedTotal) * 100 : totalWinRate;

  // ── TOTAL TRADES: closed + open ──────────────────────────────────────
  const combinedTradeCount = totalTradeCount + openTrades.length;

  // Locked in trades = sum of open trade stake amounts
  const lockedInTrades = openStakeTotal;

  const staleWarning = staleCount >= 3;

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <AppShell title="Dashboard">
      <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Stale data banner */}
      {staleWarning && (
        <div className="px-5 pt-4 shrink-0">
          <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center justify-between">
            <span className="text-xs text-amber-500 font-medium">
              Data may be stale -- last refresh failed {staleCount} times.
            </span>
            <button type="button" onClick={() => loadPortfolioData(true)}
              className="text-xs text-amber-500 underline cursor-pointer hover:no-underline">Retry now</button>
          </div>
        </div>
      )}

      {/* LINEAR EDGE LAYOUT */}
      <div className="flex flex-1 overflow-hidden l-grid p-5 flex-col gap-5 min-h-0">
        {/* LAYER 1: KPI Grid (14 KPIs in 7+7) — LIVE: closed + open combined */}
        <KPIGrid
          totalEquity={totalEquity}
          lockedInTrades={lockedInTrades > 0 ? lockedInTrades : null}
          todayPnl={todayPnl}
          todayPnlPct={todayPnlPct != null ? todayPnlPct * 100 : null}
          totalPnlClosed={totalPnlClosed}
          totalPnlClosedPct={totalPnlClosedPct}
          totalTradingDays={totalTradingDays}
          openPnl={totalPnlOpen}
          openPnlPct={totalPnlOpenPct}
          openTradeCount={openTrades.length}
          maxOpenTrades={aggStats.maxOpenTrades ?? null}
          maxDrawdown={aggStats.maxDrawdown}
          winRate={combinedWinRate}
          winCount={combinedWins}
          lossCount={combinedLosses}
          profitFactor={aggStats.profitFactor}
          avgDuration={aggStats.avgDuration}
          totalTrades={combinedTradeCount}
          bestPair={aggStats.bestPair}
          bestPairPct={aggStats.bestPairPct}
          sharpeRatio={aggStats.sharpeRatio}
          tradingVolume={aggStats.tradingVolume}
          loading={loading}
        />

        {/* LAYER 2: 2-Column Layout (chart+table | right sidebar) */}
        <div className="flex-1 flex gap-5 min-w-0 min-h-0 overflow-hidden">

          {/* COL 1: Center Workspace */}
          <div className="flex-1 flex flex-col gap-5 min-w-0 min-h-0">
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
              onLockPair={handleLockPair}
              onUnlockPair={handleUnlockPair}
              spreadData={spreadData}
              whitelistBotMap={whitelistBotMap}
              bots={bots}
              botProfits={botProfits}
              botBalances={botBalances}
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
              blacklistData={blacklistData}
              onAddBlacklist={handleAddBlacklist}
              onDeleteBlacklist={handleDeleteBlacklist}
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
            feeOpenAvg={aggStats.feeOpenAvg}
            feeCloseAvg={aggStats.feeCloseAvg}
            healthData={mainHealthData}
            exchangeName={bots.find(b => b.status === "running")?.exchange_name}
            loading={loading}
            bots={bots}
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
        onForceEnter={() => {
          if (!selectedBot) return;
          const pair = prompt(`Force Entry on ${selectedBot.name}\nPair (e.g. BTC/USDT:USDT):`);
          if (pair?.trim()) handleForceEnter({ _bot_id: selectedBot.id, pair: pair.trim(), is_short: false } as FTTrade);
        }}
        onStopBuy={() => selectedBot && handleStopBuyBot(selectedBot.id)}
        onSoftKill={() => selectedBot && handleSoftKillBot(selectedBot.id)}
        onHardKill={() => selectedBot && handleHardKillBot(selectedBot.id)}
        onConfigRefresh={(cfg) => setSingleConfigData(cfg)}
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
      </div>
    </AppShell>
  );
}
