"use client";

import { useState, useCallback, useEffect, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import {
  getBots,
  getStrategies,
  updateStrategy,
  deleteStrategy,
  importStrategy,
  createStrategy,
  stopBot,
  botPause,
  botProfit,
  botTrades,
  botPerformance,
  botEntries,
  botExits,
  botConfig,
  botStats,
  botBacktestHistory,
  botBacktestResults,
  botHyperoptList,
  botFtStrategy,
  fetchAIValidations,
  fetchAIValidationByTrade,
  getStrategyVersions,
} from "@/lib/api";
import { fmt, fmtMoney, profitColor } from "@/lib/format";
import type {
  Bot,
  Strategy,
  Lifecycle,
  FTProfit,
  FTTrade,
  FTPerformance,
  FTEntry,
  FTExit,
  FTShowConfig,
  FTStats,
  FTBacktestStrategyResult,
  FTHyperoptResult,
  AIValidation,
  StrategyVersion,
} from "@/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle }) {
  const styles: Record<Lifecycle, string> = {
    draft: "bg-zinc-700/40 text-zinc-300 border border-zinc-600",
    backtest: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    ai_tested: "bg-purple/10 text-purple border border-purple/20",
    deployable: "bg-green/10 text-green border border-green/20",
    paper: "bg-amber/10 text-amber border border-amber/20",
    live: "bg-emerald/10 text-emerald border border-emerald/20",
    retired: "bg-red/10 text-red border border-red/15",
  };
  return (
    <span
      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${styles[lifecycle]}`}
    >
      {lifecycle}
    </span>
  );
}

function BotStatusDot({ status }: { status: string }) {
  const color =
    status === "running"
      ? "bg-green shadow-[0_0_6px_var(--green)]"
      : status === "stopped"
        ? "bg-text-3"
        : status === "error" || status === "killed"
          ? "bg-red"
          : "bg-amber shadow-[0_0_6px_var(--amber)]";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

function MetricCell({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="bg-bg-2 py-2.5 px-3 text-center">
      <div className="text-[9px] text-text-3 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-[13px] font-bold ${colorClass ?? "text-text-0"}`}>
        {value}
      </div>
    </div>
  );
}

/** Skeleton card shown during loading */
function CardSkeleton() {
  return (
    <div className="bg-bg-2 border border-border rounded-[10px] overflow-hidden animate-pulse">
      <div className="p-[18px_20px_14px] flex gap-3.5">
        <div className="w-10 h-10 rounded-[10px] bg-bg-3" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 bg-bg-3 rounded" />
          <div className="h-3 w-full bg-bg-3 rounded" />
          <div className="h-3 w-24 bg-bg-3 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-px bg-border border-t border-border">
        {["m1", "m2", "m3", "m4"].map((id) => (
          <div key={id} className="bg-bg-2 py-2.5 px-3">
            <div className="h-2 w-10 bg-bg-3 rounded mx-auto mb-1" />
            <div className="h-4 w-12 bg-bg-3 rounded mx-auto" />
          </div>
        ))}
      </div>
      <div className="p-2.5 px-4 border-t border-border flex gap-1.5">
        <div className="h-7 w-20 bg-bg-3 rounded" />
        <div className="h-7 w-20 bg-bg-3 rounded" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Strategy icon helper — assigns an icon based on name keywords
   ═══════════════════════════════════════════════════════════════════════════ */

function stratIcon(name: string, lifecycle: Lifecycle): { emoji: string; bg: string } {
  const n = name.toLowerCase();
  if (lifecycle === "retired") return { emoji: "\u{1F3C1}", bg: "bg-gradient-to-br from-text-3/15 to-text-3/5" };
  if (lifecycle === "draft") return { emoji: "\u{1F4DD}", bg: "bg-gradient-to-br from-text-3/15 to-text-3/5" };
  if (n.includes("ai") || n.includes("freqai") || n.includes("lgbm") || n.includes("lightgbm"))
    return { emoji: "\u{1F9E0}", bg: "bg-gradient-to-br from-purple/15 to-purple/5" };
  if (n.includes("scalp") || n.includes("hl")) return { emoji: "\u26A1", bg: "bg-gradient-to-br from-amber/15 to-amber/5" };
  if (n.includes("mean") || n.includes("revert")) return { emoji: "\u{1F504}", bg: "bg-gradient-to-br from-cyan/15 to-cyan/5" };
  if (n.includes("breakout")) return { emoji: "\u{1F680}", bg: "bg-gradient-to-br from-accent/15 to-accent/5" };
  if (n.includes("grid")) return { emoji: "\u{1F4CA}", bg: "bg-gradient-to-br from-cyan/15 to-cyan/5" };
  return { emoji: "\u{1F4C8}", bg: "bg-gradient-to-br from-green/15 to-green/5" };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Detail panel tab types
   ═══════════════════════════════════════════════════════════════════════════ */

type DetailTab =
  | "overview"
  | "open_trades"
  | "closed_trades"
  | "backtest_history"
  | "hyperopt_history"
  | "performance"
  | "entry_exit"
  | "ai_suggestions"
  | "configuration"
  | "lifecycle"
  | "versions";

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function StrategiesPage() {
  const toast = useToast();
  const router = useRouter();
  const t = useTranslations("strategies");
  const tc = useTranslations("common");
  const mountedRef = useRef(true);

  /* ─── Core state ─── */
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [profitMap, setProfitMap] = useState<Record<number, FTProfit>>({});
  const [statsMap, setStatsMap] = useState<Record<number, FTStats>>({});
  const [configMap, setConfigMap] = useState<Record<number, FTShowConfig>>({});
  const [backtestResultMap, setBacktestResultMap] = useState<Record<number, FTBacktestStrategyResult>>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Lifecycle | "all">("all");

  /* ─── Import modal ─── */
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBotId, setImportBotId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);

  /* ─── Detail panel ─── */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    openTrades: FTTrade[];
    closedTrades: FTTrade[];
    performance: FTPerformance[];
    entries: FTEntry[];
    exits: FTExit[];
    config: FTShowConfig | null;
    stats: FTStats | null;
    backtestHistory: Array<{ filename: string; strategy: string; run_id: string; backtest_start_time: number }>;
    backtestResult: FTBacktestStrategyResult | null;
    hyperoptResults: FTHyperoptResult[];
    aiValidations: AIValidation[];
  }>({
    openTrades: [],
    closedTrades: [],
    performance: [],
    entries: [],
    exits: [],
    config: null,
    stats: null,
    backtestHistory: [],
    backtestResult: null,
    hyperoptResults: [],
    aiValidations: [],
  });
  const [tradeAiDetail, setTradeAiDetail] = useState<AIValidation | null>(null);
  const [tradeAiLoading, setTradeAiLoading] = useState(false);
  const [tradeAiTradeId, setTradeAiTradeId] = useState<number | null>(null);

  /* ─── Strategy versions ─── */
  const [strategyVersions, setStrategyVersions] = useState<StrategyVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  async function loadTradeAiValidation(ftTradeId: number) {
    if (tradeAiTradeId === ftTradeId) { setTradeAiTradeId(null); setTradeAiDetail(null); return; }
    setTradeAiTradeId(ftTradeId);
    setTradeAiLoading(true);
    try {
      const v = await fetchAIValidationByTrade(ftTradeId);
      setTradeAiDetail(v);
    } catch { /* non-blocking */
      setTradeAiDetail(null);
    } finally {
      setTradeAiLoading(false);
    }
  }

  async function loadStrategyVersions(strategyId: number) {
    setVersionsLoading(true);
    try {
      const versions = await getStrategyVersions(strategyId);
      setStrategyVersions(versions);
    } catch {
      toast.error("Failed to load versions");
      setStrategyVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  /* ─── Confirmation dialog ─── */
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ─── Load strategies + bots + profit ─── */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      let stratsList: Strategy[] = [];
      let botsList: Bot[] = [];

      try {
        stratsList = await getStrategies();
        if (mountedRef.current) setStrategies(stratsList);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load strategies");
      }

      try {
        botsList = await getBots();
        if (mountedRef.current) setBots(botsList);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load bots");
      }

      // Fetch profit for each bot linked to a strategy
      const linkedBotIds = new Set(
        stratsList
          .map((s) => s.bot_instance_id)
          .filter((id): id is number => id != null)
      );
      const linkedBots = botsList.filter((b) => linkedBotIds.has(b.id));

      const profits: Record<number, FTProfit> = {};
      const stats: Record<number, FTStats> = {};
      const configs: Record<number, FTShowConfig> = {};
      const btResults: Record<number, FTBacktestStrategyResult> = {};
      await Promise.allSettled(
        linkedBots.flatMap((bot) => [
          botProfit(bot.id)
            .then((p) => { profits[bot.id] = p; })
            .catch(() => {}),
          botStats(bot.id)
            .then((s) => { stats[bot.id] = s; })
            .catch(() => {}),
          botConfig(bot.id)
            .then((c) => { configs[bot.id] = c; })
            .catch(() => {}),
          botBacktestResults(bot.id)
            .then((r) => {
              if (r.backtest_result?.strategy) {
                const keys = Object.keys(r.backtest_result.strategy);
                if (keys.length > 0) btResults[bot.id] = r.backtest_result.strategy[keys[0]];
              }
            })
            .catch(() => {}),
        ])
      );
      if (mountedRef.current) {
        setProfitMap(profits);
        setStatsMap(stats);
        setConfigMap(configs);
        setBacktestResultMap(btResults);
        setLoading(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Keep a ref to strategies so the detail effect doesn't re-run on every update ─── */
  const strategiesRef = useRef(strategies);
  strategiesRef.current = strategies;

  /* ─── Load detail panel data when a strategy is selected ─── */
  useEffect(() => {
    if (selectedId == null) return;
    const strat = strategiesRef.current.find((s) => s.id === selectedId);
    if (!strat) return;
    const botId = strat.bot_instance_id;
    if (botId == null) {
      // No bot linked — clear detail data
      setDetailData({
        openTrades: [],
        closedTrades: [],
        performance: [],
        entries: [],
        exits: [],
        config: null,
        stats: null,
        backtestHistory: [],
        backtestResult: null,
        hyperoptResults: [],
        aiValidations: [],
      });
      return;
    }

    setDetailLoading(true);
    const load = async () => {
      const results = await Promise.allSettled([
        botTrades(botId, 9999),         // 0 — fetch all trades
        botPerformance(botId),          // 1
        botEntries(botId),              // 2
        botExits(botId),                // 3
        botConfig(botId),               // 4
        botStats(botId),                // 5
        botBacktestHistory(botId),      // 6
        botHyperoptList(botId),         // 7
        fetchAIValidations({ botId, limit: 20 }), // 8
        botBacktestResults(botId),      // 9
      ]);

      if (!mountedRef.current) return;

      const fallback: { trades: FTTrade[] } = { trades: [] };
      const tradesRes = results[0].status === "fulfilled" ? results[0].value : fallback;
      const allTrades = tradesRes.trades ?? [];

      // Extract first strategy result from backtest
      let btStratResult: FTBacktestStrategyResult | null = null;
      if (results[9].status === "fulfilled") {
        const btRes = results[9].value;
        if (btRes.backtest_result?.strategy) {
          const keys = Object.keys(btRes.backtest_result.strategy);
          if (keys.length > 0) btStratResult = btRes.backtest_result.strategy[keys[0]];
        }
      }

      setDetailData({
        openTrades: allTrades.filter((t) => t.is_open),
        closedTrades: allTrades.filter((t) => !t.is_open),
        performance: results[1].status === "fulfilled" ? results[1].value : [],
        entries: results[2].status === "fulfilled" ? results[2].value : [],
        exits: results[3].status === "fulfilled" ? results[3].value : [],
        config: results[4].status === "fulfilled" ? results[4].value : null,
        stats: results[5].status === "fulfilled" ? results[5].value : null,
        backtestHistory:
          results[6].status === "fulfilled"
            ? results[6].value.results
            : [],
        backtestResult: btStratResult,
        hyperoptResults:
          results[7].status === "fulfilled"
            ? results[7].value.results
            : [],
        aiValidations: results[8].status === "fulfilled" ? results[8].value : [],
      });
      setDetailLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ─── Helpers ─── */

  const getBotForStrategy = useCallback(
    (strat: Strategy): Bot | undefined => {
      if (strat.bot_instance_id == null) return undefined;
      return bots.find((b) => b.id === strat.bot_instance_id);
    },
    [bots]
  );

  const winRate = (profit: FTProfit): string => {
    const total = profit.winning_trades + profit.losing_trades;
    if (total === 0) return "\u2014";
    return ((profit.winning_trades / total) * 100).toFixed(1) + "%";
  };

  const getBotsUsingStrategy = useCallback(
    (strat: Strategy): number => {
      return bots.filter((b) => b.strategy_name === strat.name).length;
    },
    [bots]
  );

  const filtered = strategies.filter(
    (s) => activeFilter === "all" || s.lifecycle === activeFilter
  );

  const selectedStrat = selectedId != null ? strategies.find((s) => s.id === selectedId) : null;
  const selectedBot = selectedStrat ? getBotForStrategy(selectedStrat) : undefined;
  const selectedProfit = selectedStrat?.bot_instance_id != null ? profitMap[selectedStrat.bot_instance_id] : undefined;

  /* ─── Actions ─── */

  const actuallyTransition = useCallback(
    async (strategy: Strategy, newLifecycle: Lifecycle) => {
      const id = toast.loading(`Transitioning to ${newLifecycle}...`);
      try {
        await updateStrategy(strategy.id, { lifecycle: newLifecycle });
        toast.dismiss(id);
        toast.success(`${strategy.name} \u2192 ${newLifecycle}`);
        setStrategies((prev) =>
          prev.map((s) =>
            s.id === strategy.id ? { ...s, lifecycle: newLifecycle } : s
          )
        );
      } catch (err) {
        toast.dismiss(id);
        toast.error(err instanceof Error ? err.message : "Transition failed");
      }
    },
    [toast]
  );

  const handleTransition = useCallback(
    async (strategy: Strategy, newLifecycle: Lifecycle) => {
      if (newLifecycle === "paper") {
        const bot = strategy.bot_instance_id != null ? bots.find((b) => b.id === strategy.bot_instance_id) : undefined;
        if (!bot) {
          toast.warning("Link a bot to this strategy before promoting to Paper.");
          return;
        }
        try {
          const history = await botBacktestHistory(bot.id);
          if (!history.results || history.results.length === 0) {
            toast.warning("Run a backtest first before promoting to Paper.");
            return;
          }
        } catch { /* non-blocking — allow promotion if check fails */  }
        actuallyTransition(strategy, newLifecycle);
        return;
      }
      if (newLifecycle === "live") {
        toast.warning("This will switch to REAL trading. Confirm?", {
          action: {
            label: "CONFIRM",
            onClick: () => actuallyTransition(strategy, newLifecycle),
          },
        });
        return;
      }
      actuallyTransition(strategy, newLifecycle);
    },
    [toast, bots, actuallyTransition]
  );

  const handleDelete = useCallback(
    async (strategy: Strategy) => {
      const id = toast.loading(`Deleting ${strategy.name}...`);
      try {
        await deleteStrategy(strategy.id);
        toast.dismiss(id);
        toast.success(`${strategy.name} deleted`);
        setStrategies((prev) => prev.filter((s) => s.id !== strategy.id));
        if (selectedId === strategy.id) setSelectedId(null);
      } catch (err) {
        toast.dismiss(id);
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [toast, selectedId]
  );

  const handleClone = useCallback(
    async (strategy: Strategy) => {
      const id = toast.loading(`Cloning ${strategy.name}...`);
      try {
        const cloned = await createStrategy({
          name: `${strategy.name}_copy`,
          lifecycle: "draft",
          description: strategy.description,
          code: strategy.code,
          builder_state: strategy.builder_state,
          exchange: strategy.exchange,
          timeframe: strategy.timeframe,
        });
        toast.dismiss(id);
        toast.success(`Cloned as ${cloned.name}`);
        setStrategies((prev) => [...prev, cloned]);
      } catch (err) {
        toast.dismiss(id);
        toast.error(err instanceof Error ? err.message : "Clone failed");
      }
    },
    [toast]
  );

  const handleImportFile = useCallback(async () => {
    if (!importFile || !bots.length) {
      toast.error("No file selected or no bots available");
      return;
    }
    const targetBotId = importBotId ?? bots[0]?.id;
    if (targetBotId == null) {
      toast.error("No bot selected");
      return;
    }
    setImporting(true);
    const id = toast.loading(`Importing ${importFile.name}...`);
    try {
      await importStrategy(targetBotId, importFile);
      toast.dismiss(id);
      toast.success(`${importFile.name} imported successfully`);
      setShowImport(false);
      setImportFile(null);
      setImportBotId(null);
      const updated = await getStrategies();
      if (mountedRef.current) setStrategies(updated);
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [importFile, importBotId, bots, toast]);

  const openDetail = (stratId: number) => {
    setSelectedId(stratId);
    setDetailTab("overview");
  };

  const closeDetail = () => {
    setSelectedId(null);
  };

  /* ─── Card action buttons per lifecycle ─── */

  function cardActions(strat: Strategy) {
    const lc = strat.lifecycle;
    const stop = (e: React.MouseEvent) => e.stopPropagation();
    const btnBase = "py-1.5 px-3 rounded-md border text-[11px] font-medium transition-all cursor-pointer";
    const btnDefault = `${btnBase} border-border bg-bg-1 text-text-2 hover:border-border-hover hover:text-text-1 hover:bg-bg-3`;
    const btnPrimary = `${btnBase} border-accent bg-accent text-white font-semibold hover:bg-accent-dim ml-auto`;
    const btnPromote = `${btnBase} border-green/30 bg-green-bg text-green hover:bg-green/15`;

    switch (lc) {
      case "draft":
        return (
          <>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); router.push(`/builder?strategyId=${strat.id}`); }}>
              {t("editInBuilder")}
            </button>
            <button type="button" className={btnPrimary} onClick={(e) => { stop(e); router.push(`/backtesting?strategyId=${strat.id}`); }}>
              {t("runBacktest")} &rarr;
            </button>
          </>
        );
      case "backtest":
        return (
          <>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); openDetail(strat.id); }}>
              {t("viewResults")}
            </button>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); router.push(`/builder?strategyId=${strat.id}`); }}>
              {tc("edit")}
            </button>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); router.push(`/backtesting?strategyId=${strat.id}`); }}>
              {t("reRunBacktest")}
            </button>
            <button type="button" className={btnPromote} onClick={(e) => { stop(e); handleTransition(strat, "paper"); }}>
              {t("startPaper")} &rarr;
            </button>
          </>
        );
      case "paper":
        return (
          <>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); openDetail(strat.id); }}>
              {t("viewTrades")}
            </button>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); openDetail(strat.id); setDetailTab("backtest_history"); }}>
              {t("backtestHistory")}
            </button>
            <button
              type="button"
              className={btnPromote}
              onClick={(e) => {
                stop(e);
                setConfirmAction({
                  message: t("confirmGoLive", { name: strat.name }),
                  onConfirm: () => handleTransition(strat, "live"),
                });
              }}
            >
              {t("goLive")} &rarr;
            </button>
          </>
        );
      case "live":
        return (
          <>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); openDetail(strat.id); }}>
              {t("viewTrades")}
            </button>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); openDetail(strat.id); setDetailTab("entry_exit"); }}>
              {t("analytics")}
            </button>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); router.push(`/builder?strategyId=${strat.id}`); }}>
              {tc("edit")}
            </button>
            <button type="button" className={btnPrimary} onClick={(e) => { stop(e); router.push("/dashboard"); }}>
              {t("viewBot")} &rarr;
            </button>
          </>
        );
      case "retired":
        return (
          <>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); openDetail(strat.id); }}>
              {t("viewHistory")}
            </button>
            <button type="button" className={btnDefault} onClick={(e) => { stop(e); handleClone(strat); }}>
              {tc("clone")}
            </button>
            <button type="button" className={btnDefault} onClick={async (e) => {
              stop(e);
              if (!strat.bot_instance_id) { toast.error("No bot linked — cannot export"); return; }
              const id = toast.loading("Exporting strategy...");
              try {
                const res = await botFtStrategy(strat.bot_instance_id, strat.name);
                toast.dismiss(id);
                const blob = new Blob([res.code], { type: "text/x-python" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${strat.name}.py`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`${strat.name}.py downloaded`);
              } catch (err) {
                toast.dismiss(id);
                toast.error(err instanceof Error ? err.message : "Export failed");
              }
            }}>
              {t("exportPy")}
            </button>
          </>
        );
      default:
        return null;
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════════ */

  return (
    <AppShell title="Strategies">
      <div className="max-w-[1400px] mx-auto">
        {/* ─── Toolbar ─── */}
        <div className="flex items-center gap-2.5 mb-5 flex-wrap">
          <div className="flex gap-2 flex-1 flex-wrap">
            {(["all", "live", "paper", "backtest", "draft", "retired"] as const).map(
              (filter) => {
                const count =
                  filter === "all"
                    ? strategies.length
                    : strategies.filter((s) => s.lifecycle === filter).length;
                return (
                  <button
                    type="button"
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3.5 py-1.5 rounded-full border text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeFilter === filter
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-bg-2 border-border text-text-2 hover:border-border-hover hover:text-text-1"
                    }`}
                  >
                    {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-px rounded-lg ${
                        activeFilter === filter ? "bg-accent/20" : "bg-bg-3"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              }
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="px-3.5 py-1.5 rounded-md border border-border bg-bg-2 text-text-1 text-xs font-medium transition-all hover:border-border-hover hover:bg-bg-3 flex items-center gap-1.5 cursor-pointer"
            >
              {t("importPy")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/builder")}
              className="px-4 py-1.5 rounded-md border-none bg-accent text-white text-xs font-semibold transition-all hover:bg-accent-dim hover:-translate-y-px hover:shadow-[0_4px_12px_var(--color-accent)] flex items-center gap-1.5 cursor-pointer"
            >
              {t("newStrategy")}
            </button>
          </div>
        </div>

        {/* ─── Card Grid / Empty / Loading ─── */}
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3.5">
            {["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => (
              <CardSkeleton key={id} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-text-3 text-sm">
              {strategies.length === 0
                ? t("noStrategies")
                : t("noFilterMatch", { filter: activeFilter })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3.5">
            {filtered.map((strat) => {
              const linkedBot = getBotForStrategy(strat);
              const profit =
                strat.bot_instance_id != null
                  ? profitMap[strat.bot_instance_id]
                  : undefined;
              const stats =
                strat.bot_instance_id != null
                  ? statsMap[strat.bot_instance_id]
                  : undefined;
              const botCfg =
                strat.bot_instance_id != null
                  ? configMap[strat.bot_instance_id]
                  : undefined;
              const btResult =
                strat.bot_instance_id != null
                  ? backtestResultMap[strat.bot_instance_id]
                  : undefined;
              const icon = stratIcon(strat.name, strat.lifecycle);
              const isRetired = strat.lifecycle === "retired";

              return (
                <div
                  key={strat.id}
                  onClick={() => openDetail(strat.id)}
                  className={`bg-bg-2 border border-border rounded-[10px] overflow-hidden transition-all cursor-pointer hover:border-accent hover:-translate-y-0.5 hover:shadow-lg ${
                    isRetired ? "opacity-60" : ""
                  }`}
                >
                  {/* Card top */}
                  <div className="p-[18px_20px_14px] flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0 ${icon.bg}`}
                    >
                      {icon.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-text-0 truncate">
                          {strat.name}
                        </span>
                        <LifecycleBadge lifecycle={strat.lifecycle} />
                      </div>
                      {strat.description && (
                        <div className="text-[11px] text-text-2 leading-relaxed mb-1.5 line-clamp-2">
                          {strat.description}
                        </div>
                      )}
                      <div className="text-[10px] text-text-3 mb-1">
                        {getBotsUsingStrategy(strat)} bot{getBotsUsingStrategy(strat) !== 1 ? "s" : ""} using this
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {(botCfg?.pair_whitelist ?? []).slice(0, 2).map((pair) => (
                          <span key={pair} className="text-[9.5px] px-1.5 py-0.5 rounded-sm font-medium bg-cyan/8 text-cyan">
                            {pair}
                          </span>
                        ))}
                        {(botCfg?.pair_whitelist?.length ?? 0) > 2 && (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-sm font-medium bg-bg-3 text-text-3">
                            +{(botCfg?.pair_whitelist?.length ?? 0) - 2} more
                          </span>
                        )}
                        {(strat.timeframe || botCfg?.timeframe) && (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-sm font-medium bg-purple/8 text-purple">
                            {strat.timeframe || botCfg?.timeframe}
                          </span>
                        )}
                        {botCfg?.trading_mode === "futures" && botCfg?.margin_mode && (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded-sm font-medium bg-bg-3 text-text-2">
                            {botCfg.margin_mode}
                          </span>
                        )}
                      </div>
                      {linkedBot && (
                        <div className="flex items-center gap-1.5 text-[10px] text-text-3 mt-1.5">
                          <BotStatusDot status={linkedBot.status} />
                          <span>
                            {linkedBot.name} {linkedBot.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-4 gap-px bg-border border-t border-border">
                    {strat.lifecycle === "draft" ? (
                      <>
                        <MetricCell label="Backtest" value="\u2014" colorClass="text-text-3" />
                        <MetricCell label="Win Rate" value="\u2014" colorClass="text-text-3" />
                        <MetricCell label="Sharpe" value="\u2014" colorClass="text-text-3" />
                        <MetricCell label="Trades" value="\u2014" colorClass="text-text-3" />
                      </>
                    ) : strat.lifecycle === "backtest" && btResult ? (
                      <>
                        <MetricCell
                          label="Backtest Profit"
                          value={fmt(btResult.profit_total_abs, 2) !== "\u2014" ? fmtMoney(btResult.profit_total_abs) : fmt(btResult.profit_total * 100, 1) + "%"}
                          colorClass={profitColor(btResult.profit_total_abs)}
                        />
                        <MetricCell label="Win Rate" value={btResult.total_trades > 0 ? fmt(btResult.win_rate * 100, 1) + "%" : "\u2014"} />
                        <MetricCell label="Sharpe" value={btResult.sharpe != null ? fmt(btResult.sharpe, 2) : "\u2014"} />
                        <MetricCell label="Trades" value={String(btResult.total_trades)} />
                      </>
                    ) : profit ? (
                      <>
                        <MetricCell
                          label={strat.lifecycle === "paper" ? "Paper Profit" : "Total Profit"}
                          value={fmtMoney(profit.profit_all_coin)}
                          colorClass={profitColor(profit.profit_all_coin)}
                        />
                        <MetricCell label="Win Rate" value={winRate(profit)} />
                        <MetricCell
                          label="Max DD"
                          value={stats?.max_drawdown != null ? fmt(stats.max_drawdown * 100, 1) + "%" : "\u2014"}
                          colorClass={stats?.max_drawdown != null ? "text-red" : "text-text-3"}
                        />
                        <MetricCell label="Trades" value={String(profit.trade_count)} />
                      </>
                    ) : (
                      <>
                        <MetricCell label={strat.lifecycle === "backtest" ? "Backtest" : "Total"} value="\u2014" colorClass="text-text-3" />
                        <MetricCell label="Win Rate" value="\u2014" colorClass="text-text-3" />
                        <MetricCell label={strat.lifecycle === "backtest" ? "Sharpe" : "Max DD"} value="\u2014" colorClass="text-text-3" />
                        <MetricCell label="Trades" value="\u2014" colorClass="text-text-3" />
                      </>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center p-2.5 px-4 border-t border-border gap-1.5">
                    {cardActions(strat)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         DETAIL PANEL (slide-in from right)
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/50 z-[500] transition-opacity ${
          selectedId != null ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeDetail}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 h-screen w-[560px] max-w-[90vw] bg-bg-1 border-l border-border z-[501] transition-[right] duration-300 ease-out flex flex-col overflow-hidden ${
          selectedId != null ? "right-0" : "-right-[560px]"
        }`}
      >
        {selectedStrat && (
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-border flex items-center gap-3.5 flex-shrink-0">
              <button
                type="button"
                onClick={closeDetail}
                className="w-8 h-8 rounded-lg border border-border bg-bg-2 flex items-center justify-center text-text-2 text-base transition-all hover:bg-bg-3 hover:text-text-0 cursor-pointer"
              >
                &times;
              </button>
              <div className="text-base font-bold text-text-0 flex-1 truncate">
                {selectedStrat.name}
              </div>
              <LifecycleBadge lifecycle={selectedStrat.lifecycle} />
              {/* Detail actions: Edit | Pause | Stop | Retire | Delete */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => router.push(`/builder?strategyId=${selectedStrat.id}`)}
                  className="px-3 py-1.5 rounded-md border border-border bg-bg-2 text-text-1 text-[11px] font-medium hover:border-border-hover hover:bg-bg-3 transition-all cursor-pointer"
                >
                  {tc("edit")}
                </button>
                {selectedBot && (selectedStrat.lifecycle === "live" || selectedStrat.lifecycle === "paper") && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        const id = toast.loading("Pausing bot...");
                        try {
                          await botPause(selectedBot.id);
                          toast.dismiss(id);
                          toast.success(`${selectedBot.name} paused`);
                        } catch (err) {
                          toast.dismiss(id);
                          toast.error(err instanceof Error ? err.message : "Pause failed");
                        }
                      }}
                      className="px-3 py-1.5 rounded-md border border-amber/20 bg-amber-bg text-amber text-[11px] font-semibold hover:border-amber/40 transition-all cursor-pointer"
                    >
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          message: `Stop bot "${selectedBot.name}"?`,
                          onConfirm: async () => {
                            const id = toast.loading("Stopping bot...");
                            try {
                              await stopBot(selectedBot.id);
                              toast.dismiss(id);
                              toast.success(`${selectedBot.name} stopped`);
                            } catch (err) {
                              toast.dismiss(id);
                              toast.error(err instanceof Error ? err.message : "Stop failed");
                            }
                          },
                        })
                      }
                      className="px-3 py-1.5 rounded-md border border-red/20 bg-red-bg text-red text-[11px] font-semibold hover:border-red/40 transition-all cursor-pointer"
                    >
                      Stop
                    </button>
                  </>
                )}
                {(selectedStrat.lifecycle === "live" || selectedStrat.lifecycle === "paper") && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        message: t("confirmRetire", { name: selectedStrat.name }),
                        onConfirm: () => handleTransition(selectedStrat, "retired"),
                      })
                    }
                    className="px-3 py-1.5 rounded-md border border-red/20 bg-red-bg text-red text-[11px] font-semibold hover:border-red/40 transition-all cursor-pointer"
                  >
                    Retire
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setConfirmAction({
                      message: t("confirmDelete", { name: selectedStrat.name }),
                      onConfirm: () => handleDelete(selectedStrat),
                    })
                  }
                  className="px-3 py-1.5 rounded-md border border-red/20 bg-red-bg text-red text-[11px] font-semibold hover:border-red/40 transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-border flex gap-1 overflow-x-auto flex-shrink-0 py-1">
              {(
                [
                  { key: "overview", label: "Overview" },
                  { key: "versions", label: "Versions" },
                  { key: "open_trades", label: "Open Trades" },
                  { key: "closed_trades", label: "Closed Trades" },
                  { key: "backtest_history", label: "Backtests" },
                  { key: "hyperopt_history", label: "Hyperopt" },
                  { key: "performance", label: "Performance" },
                  { key: "entry_exit", label: "Entry/Exit" },
                  { key: "ai_suggestions", label: "AI" },
                  { key: "configuration", label: "Config" },
                  { key: "lifecycle", label: "Lifecycle" },
                ] satisfies { key: DetailTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key)}
                  className={`px-3 py-2 text-[11px] font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    detailTab === tab.key
                      ? "bg-accent/10 text-accent"
                      : "text-text-3 hover:text-text-1 hover:bg-bg-3"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32 text-text-3 text-sm">
                  Loading details...
                </div>
              ) : (
                <DetailContent
                  tab={detailTab}
                  strat={selectedStrat}
                  bot={selectedBot}
                  profit={selectedProfit}
                  data={detailData}
                  winRate={winRate}
                  onLoadTradeAi={loadTradeAiValidation}
                  tradeAiDetail={tradeAiDetail}
                  tradeAiLoading={tradeAiLoading}
                  tradeAiTradeId={tradeAiTradeId}
                  versions={strategyVersions}
                  versionsLoading={versionsLoading}
                  onLoadVersions={loadStrategyVersions}
                />
              )}
            </div>

            {/* Bottom actions */}
            <div className="px-6 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => router.push(`/builder?strategyId=${selectedStrat.id}`)}
                className="flex-1 py-2.5 rounded-md border border-border bg-bg-2 text-text-1 text-xs font-medium text-center transition-all hover:bg-bg-3 hover:border-border-hover cursor-pointer"
              >
                {t("detail.editStrategy")}
              </button>
              {selectedBot && (
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="flex-1 py-2.5 rounded-md border-none bg-accent text-white text-xs font-semibold text-center transition-all hover:bg-accent-dim cursor-pointer"
                >
                  {t("viewBot")}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         IMPORT MODAL
         ═══════════════════════════════════════════════════════════════════════ */}
      {showImport && (
        <div
          role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImport(false);
          }}
        >
          <div className="bg-bg-1 border border-border rounded-2xl p-8 max-w-[480px] w-[90%]">
            <div className="text-base font-bold text-text-0 mb-4">
              {t("importTitle")}
            </div>
            <label
              className="border-2 border-dashed border-border rounded-xl py-10 px-5 text-center mb-4 cursor-pointer transition-colors hover:border-accent block"
              htmlFor="import-file-input"
            >
              <div className="text-[13px] text-text-1 mb-1">
                {importFile
                  ? importFile.name
                  : "Drop .py strategy file here or click to browse"}
              </div>
              <div className="text-[11px] text-text-3">
                Accepts FreqTrade strategy Python files
              </div>
              <input
                id="import-file-input"
                type="file"
                accept=".py"
                className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {bots.length > 1 && (
              <div className="mb-4">
                <label htmlFor="import-bot-select" className="text-[11px] text-text-3 font-medium block mb-1">
                  Import to bot
                </label>
                <select
                  id="import-bot-select"
                  value={importBotId ?? bots[0]?.id ?? ""}
                  onChange={(e) => setImportBotId(Number(e.target.value))}
                  className="w-full bg-bg-2 border border-border rounded-md px-3 py-2 text-xs text-text-1 outline-none focus:border-accent transition-colors"
                >
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                  setImportBotId(null);
                }}
                className="px-5 py-2 rounded-md border border-border bg-bg-2 text-text-1 cursor-pointer text-xs hover:bg-bg-3 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportFile}
                disabled={importing || !importFile}
                className="px-5 py-2 rounded-md border-none bg-accent text-white cursor-pointer text-xs font-semibold hover:bg-accent-dim transition-all disabled:opacity-50"
              >
                {importing ? "Uploading..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         CONFIRM DIALOG
         ═══════════════════════════════════════════════════════════════════════ */}
      {confirmAction && (
        <div
          role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 z-[700] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmAction(null);
          }}
        >
          <div className="bg-bg-1 border border-border rounded-2xl p-8 max-w-[420px] w-[90%]">
            <div className="text-base font-bold text-text-0 mb-3">
              {tc("confirm")}
            </div>
            <div className="text-sm text-text-1 mb-6">
              {confirmAction.message}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-5 py-2 rounded-md border border-border bg-bg-2 text-text-1 cursor-pointer text-xs hover:bg-bg-3 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
                className="px-5 py-2 rounded-md border-none bg-red text-white cursor-pointer text-xs font-semibold hover:bg-red-dim transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLOSED TRADES TAB — own state for Load More
   ═══════════════════════════════════════════════════════════════════════════ */

const TRADES_PAGE = 50;

function ClosedTradesTab({ trades }: { trades: FTTrade[] }) {
  const [limit, setLimit] = useState(TRADES_PAGE);

  if (trades.length === 0) {
    return <div className="text-center py-12 text-text-3 text-sm">No closed trades</div>;
  }

  const shown = trades.slice(0, limit);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-3">
        Closed Trades ({trades.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-3 border-b border-border">
              <th className="text-left py-2 font-medium">Pair</th>
              <th className="text-left py-2 font-medium">Side</th>
              <th className="text-right py-2 font-medium">open_rate</th>
              <th className="text-right py-2 font-medium">close_rate</th>
              <th className="text-right py-2 font-medium">close_profit_abs</th>
              <th className="text-left py-2 font-medium">enter_tag</th>
              <th className="text-left py-2 font-medium">exit_reason</th>
              <th className="text-left py-2 font-medium">open_date</th>
              <th className="text-left py-2 font-medium">close_date</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.trade_id} className="border-b border-border/30">
                <td className="py-2 text-text-0 font-medium">{t.pair}</td>
                <td className="py-2">
                  <span className={t.is_short ? "text-red" : "text-green"}>
                    {t.is_short ? "SHORT" : "LONG"}
                  </span>
                </td>
                <td className="py-2 text-right text-text-0">{fmt(t.open_rate, 4)}</td>
                <td className="py-2 text-right text-text-0">{fmt(t.close_rate, 4)}</td>
                <td className={`py-2 text-right font-semibold ${profitColor(t.close_profit_abs)}`}>
                  {fmtMoney(t.close_profit_abs)}
                </td>
                <td className="py-2 text-text-2">{t.enter_tag ?? "\u2014"}</td>
                <td className="py-2 text-text-2">{t.exit_reason ?? "\u2014"}</td>
                <td className="py-2 text-text-2 whitespace-nowrap">{t.open_date ? new Date(t.open_date).toLocaleDateString() : "\u2014"}</td>
                <td className="py-2 text-text-2 whitespace-nowrap">{t.close_date ? new Date(t.close_date).toLocaleDateString() : "\u2014"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {trades.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + TRADES_PAGE)}
            className="w-full mt-2 py-2 rounded-md border border-border bg-bg-2 text-text-2 text-[11px] font-medium hover:bg-bg-3 hover:text-text-1 transition-all cursor-pointer"
          >
            Load more ({trades.length - limit} remaining)
          </button>
        )}
        {trades.length <= limit && trades.length > TRADES_PAGE && (
          <div className="text-center text-[10px] text-text-3 mt-2">
            All {trades.length} trades shown
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL CONTENT — renders the active tab
   ═══════════════════════════════════════════════════════════════════════════ */

function DetailContent({
  tab,
  strat,
  bot,
  profit,
  data,
  winRate,
  onLoadTradeAi,
  tradeAiDetail,
  tradeAiLoading,
  tradeAiTradeId,
  versions,
  versionsLoading,
  onLoadVersions,
}: {
  tab: DetailTab;
  strat: Strategy;
  bot: Bot | undefined;
  profit: FTProfit | undefined;
  data: {
    openTrades: FTTrade[];
    closedTrades: FTTrade[];
    performance: FTPerformance[];
    entries: FTEntry[];
    exits: FTExit[];
    config: FTShowConfig | null;
    stats: FTStats | null;
    backtestHistory: Array<{ filename: string; strategy: string; run_id: string; backtest_start_time: number }>;
    backtestResult: FTBacktestStrategyResult | null;
    hyperoptResults: FTHyperoptResult[];
    aiValidations: AIValidation[];
  };
  winRate: (p: FTProfit) => string;
  onLoadTradeAi: (ftTradeId: number) => void;
  tradeAiDetail: AIValidation | null;
  tradeAiLoading: boolean;
  tradeAiTradeId: number | null;
  versions: StrategyVersion[];
  versionsLoading: boolean;
  onLoadVersions: (strategyId: number) => void;
}) {
  const sectionTitle = "text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-3";
  const row = "flex justify-between py-2 border-b border-border/40 last:border-b-0";
  const key = "text-xs text-text-2";
  const val = "text-xs font-semibold text-text-0 text-right";

  switch (tab) {
    /* ─── Overview ─── */
    case "overview": {
      return (
        <div className="space-y-6">
          {/* Key stats */}
          {profit && (
            <div>
              <div className={sectionTitle}>Key Stats</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-2 border border-border rounded-lg p-3">
                  <div className="text-[10px] text-text-3 mb-1">Total Profit</div>
                  <div className={`text-sm font-bold ${profitColor(profit.profit_all_coin)}`}>
                    {fmtMoney(profit.profit_all_coin)}
                  </div>
                  <div className="text-[10px] text-text-3">{fmt(profit.profit_all_percent)}%</div>
                </div>
                <div className="bg-bg-2 border border-border rounded-lg p-3">
                  <div className="text-[10px] text-text-3 mb-1">Win Rate</div>
                  <div className="text-sm font-bold text-text-0">{winRate(profit)}</div>
                  <div className="text-[10px] text-text-3">
                    {profit.winning_trades}W / {profit.losing_trades}L
                  </div>
                </div>
                <div className="bg-bg-2 border border-border rounded-lg p-3">
                  <div className="text-[10px] text-text-3 mb-1">Trade Count</div>
                  <div className="text-sm font-bold text-text-0">{profit.trade_count}</div>
                  <div className="text-[10px] text-text-3">{profit.closed_trade_count} closed</div>
                </div>
                <div className="bg-bg-2 border border-border rounded-lg p-3">
                  <div className="text-[10px] text-text-3 mb-1">Avg Duration</div>
                  <div className="text-sm font-bold text-text-0">
                    {typeof profit.avg_duration === "number"
                      ? `${Math.round(profit.avg_duration / 60)}m`
                      : profit.avg_duration}
                  </div>
                  <div className="text-[10px] text-text-3">Best pair: {profit.best_pair}</div>
                </div>
              </div>
            </div>
          )}

          {/* Stats from /stats */}
          {data.stats && (
            <div>
              <div className={sectionTitle}>Advanced Stats</div>
              <div className={row}><span className={key}>Profit Factor</span><span className={val}>{fmt(data.stats.profit_factor)}</span></div>
              <div className={row}><span className={key}>Max Drawdown</span><span className={`${val} text-red`}>{data.stats.max_drawdown != null ? fmt(data.stats.max_drawdown * 100, 1) + "%" : "\u2014"}</span></div>
              {data.stats.sharpe_ratio != null && (
                <div className={row}><span className={key}>Sharpe Ratio</span><span className={val}>{fmt(data.stats.sharpe_ratio)}</span></div>
              )}
              {data.stats.sortino_ratio != null && (
                <div className={row}><span className={key}>Sortino Ratio</span><span className={val}>{fmt(data.stats.sortino_ratio)}</span></div>
              )}
              <div className={row}><span className={key}>Max Consecutive Wins</span><span className={val}>{data.stats.max_consecutive_wins}</span></div>
              <div className={row}><span className={key}>Max Consecutive Losses</span><span className={val}>{data.stats.max_consecutive_losses}</span></div>
              <div className={row}><span className={key}>Rejected Signals</span><span className={val}>{data.stats.rejected_signals}</span></div>
            </div>
          )}

          {/* No bot notice */}
          {!bot && !profit && (
            <div className="text-center py-6 text-text-3 text-xs">
              No bot linked to this strategy. Stats will appear when a bot is assigned.
            </div>
          )}
        </div>
      );
    }

    /* ─── Versions ─── */
    case "versions": {
      return (
        <div className="space-y-3">
          {versionsLoading ? (
            <div className="text-center py-6 text-text-3 text-sm">Loading versions...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-6 text-text-3 text-sm">
              <button
                type="button"
                onClick={() => onLoadVersions(strat.id)}
                className="text-accent hover:text-accent-dim"
              >
                Load versions
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 border-b border-border/40 last:border-b-0">
                  <div className="flex-1">
                    <span className="font-mono text-sm text-blue-400">v{v.version_number}</span>
                    <span className="text-text-3 text-xs ml-2">{new Date(v.created_at).toLocaleDateString()}</span>
                    {v.changelog && <p className="text-text-2 text-xs mt-1">{v.changelog}</p>}
                  </div>
                  <div className="flex gap-2 ml-3">
                    <button className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">View Code</button>
                    {v.version_number > 1 && (
                      <button className="text-xs text-text-3 hover:text-text-2 whitespace-nowrap">Diff v{v.version_number - 1}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    /* ─── Open Trades ─── */
    case "open_trades": {
      if (data.openTrades.length === 0) {
        return <div className="text-center py-12 text-text-3 text-sm">No open trades</div>;
      }
      return (
        <div className="space-y-2">
          <div className={sectionTitle}>Open Trades ({data.openTrades.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-3 border-b border-border">
                  <th className="text-left py-2 font-medium">Pair</th>
                  <th className="text-left py-2 font-medium">Side</th>
                  <th className="text-right py-2 font-medium">open_rate</th>
                  <th className="text-right py-2 font-medium">stake_amount</th>
                  <th className="text-right py-2 font-medium">current_profit</th>
                  <th className="text-left py-2 font-medium">open_date</th>
                  <th className="text-left py-2 font-medium">enter_tag</th>
                  <th className="text-center py-2 font-medium">AI</th>
                </tr>
              </thead>
              <tbody>
                {data.openTrades.map((t) => (
                  <Fragment key={t.trade_id}>
                  <tr className="border-b border-border/30 cursor-pointer hover:bg-bg-3 transition-colors" onClick={() => onLoadTradeAi(t.trade_id)}>
                    <td className="py-2 text-text-0 font-medium">{t.pair}</td>
                    <td className="py-2">
                      <span className={t.is_short ? "text-red" : "text-green"}>
                        {t.is_short ? "SHORT" : "LONG"}
                      </span>
                    </td>
                    <td className="py-2 text-right text-text-0">{fmt(t.open_rate, 4)}</td>
                    <td className="py-2 text-right text-text-0">{fmt(t.stake_amount)}</td>
                    <td className={`py-2 text-right font-semibold ${profitColor(t.current_profit)}`}>
                      {t.current_profit != null ? (t.current_profit * 100).toFixed(2) + "%" : "\u2014"}
                    </td>
                    <td className="py-2 text-text-2 whitespace-nowrap">{t.open_date ? new Date(t.open_date).toLocaleDateString() : "\u2014"}</td>
                    <td className="py-2 text-text-2">{t.enter_tag ?? "\u2014"}</td>
                    <td className="py-2 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-accent/30 text-accent cursor-pointer">
                        {tradeAiLoading && tradeAiTradeId === t.trade_id ? "..." : "AI"}
                      </span>
                    </td>
                  </tr>
                  {tradeAiTradeId === t.trade_id && tradeAiDetail && (
                    <tr><td colSpan={8} className="bg-bg-1 border-b border-border px-4 py-3">
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div><span className="text-text-3 block text-2xs uppercase mb-0.5">FreqAI</span><span className={`font-mono font-bold ${tradeAiDetail.freqai_direction === "long" ? "text-green" : "text-red"}`}>{tradeAiDetail.freqai_direction} ({(tradeAiDetail.freqai_confidence * 100).toFixed(0)}%)</span></div>
                        <div><span className="text-text-3 block text-2xs uppercase mb-0.5">Claude</span><span className={`font-mono font-bold ${tradeAiDetail.claude_direction === "long" ? "text-green" : "text-red"}`}>{tradeAiDetail.claude_direction} ({(tradeAiDetail.claude_confidence * 100).toFixed(0)}%)</span></div>
                        <div><span className="text-text-3 block text-2xs uppercase mb-0.5">Grok</span><span className={`font-mono font-bold ${tradeAiDetail.grok_direction === "long" ? "text-green" : "text-red"}`}>{tradeAiDetail.grok_direction} ({(tradeAiDetail.grok_confidence * 100).toFixed(0)}%)</span></div>
                        <div><span className="text-text-3 block text-2xs uppercase mb-0.5">Combined</span><span className={`font-mono font-bold ${tradeAiDetail.all_agree ? "text-green" : tradeAiDetail.strong_disagree ? "text-red" : "text-amber"}`}>{(tradeAiDetail.combined_confidence * 100).toFixed(0)}% {tradeAiDetail.all_agree ? "AGREE" : tradeAiDetail.strong_disagree ? "DISAGREE" : "PARTIAL"}</span></div>
                      </div>
                      {tradeAiDetail.claude_reasoning && <div className="mt-2 text-2xs text-text-2"><span className="text-text-3">Claude:</span> {tradeAiDetail.claude_reasoning}</div>}
                      {tradeAiDetail.grok_reasoning && <div className="mt-1 text-2xs text-text-2"><span className="text-text-3">Grok:</span> {tradeAiDetail.grok_reasoning}</div>}
                      <div className="mt-2 text-2xs text-text-3">Cost: ${tradeAiDetail.total_cost_usd.toFixed(4)}</div>
                    </td></tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    /* ─── Closed Trades ─── */
    case "closed_trades":
      return <ClosedTradesTab trades={data.closedTrades} />;

    /* ─── Backtest History ─── */
    case "backtest_history": {
      if (data.backtestHistory.length === 0 && !data.backtestResult) {
        return <div className="text-center py-12 text-text-3 text-sm">No backtest history</div>;
      }
      const btr = data.backtestResult;
      return (
        <div className="space-y-4">
          {/* Latest backtest result summary */}
          {btr && (
            <div>
              <div className={sectionTitle}>Latest Backtest Result</div>
              <div className="bg-bg-2 border border-accent/30 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-text-0">{btr.strategy_name}</span>
                  <span className={`text-sm font-bold ${profitColor(btr.profit_total_abs)}`}>
                    {fmtMoney(btr.profit_total_abs)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-[10px]">
                  <div><span className="text-text-3">Trades</span><br /><span className="text-text-0 font-semibold">{btr.total_trades}</span></div>
                  <div><span className="text-text-3">Win Rate</span><br /><span className="text-text-0 font-semibold">{fmt(btr.win_rate * 100, 1)}%</span></div>
                  <div><span className="text-text-3">Sharpe</span><br /><span className="text-text-0 font-semibold">{btr.sharpe != null ? fmt(btr.sharpe, 2) : "\u2014"}</span></div>
                  <div><span className="text-text-3">Max DD</span><br /><span className="text-red font-semibold">{fmt((btr.max_drawdown_account ?? btr.max_drawdown ?? 0) * 100, 1)}%</span></div>
                  <div><span className="text-text-3">Avg Duration</span><br /><span className="text-text-0 font-semibold">{btr.holding_avg}</span></div>
                  <div><span className="text-text-3">Profit Factor</span><br /><span className="text-text-0 font-semibold">{btr.profit_factor != null ? fmt(btr.profit_factor, 2) : "\u2014"}</span></div>
                </div>
                <div className="text-[10px] text-text-3 mt-2">
                  {btr.backtest_start} &rarr; {btr.backtest_end} ({btr.backtest_days} days)
                </div>
              </div>
            </div>
          )}
          {/* History list */}
          {data.backtestHistory.length > 0 && (
            <div>
              <div className={sectionTitle}>Run History ({data.backtestHistory.length})</div>
              {data.backtestHistory.map((bt) => (
                <div key={bt.run_id} className="bg-bg-2 border border-border rounded-lg p-3 mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-text-2">
                      {new Date(bt.backtest_start_time * 1000).toLocaleDateString()}
                    </span>
                    <span className="text-xs font-medium text-text-0">{bt.strategy}</span>
                  </div>
                  <div className="text-[10px] text-text-3 font-mono truncate">{bt.filename}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    /* ─── Hyperopt History ─── */
    case "hyperopt_history": {
      if (data.hyperoptResults.length === 0) {
        return <div className="text-center py-12 text-text-3 text-sm">No hyperopt results</div>;
      }
      const bestHoIdx = data.hyperoptResults.reduce((best, r, idx) => {
        const p = r.profit_total;
        const bp = data.hyperoptResults[best]?.profit_total;
        return (p != null && (bp == null || p > bp)) ? idx : best;
      }, 0);
      const hoSlice = data.hyperoptResults.slice(0, 20);
      return (
        <div className="space-y-3">
          <div className={sectionTitle}>Hyperopt Results ({data.hyperoptResults.length})</div>
          {hoSlice.map((result) => {
            const epoch = result.epoch != null ? Number(result.epoch) : null;
            const origIdx = data.hyperoptResults.indexOf(result);
            const isBest = origIdx === bestHoIdx;
            return (
              <div key={`ho-${epoch ?? "x"}-${String(result.loss ?? "")}-${String(result.profit_total ?? "")}`} className={`bg-bg-2 border rounded-lg p-3 ${isBest ? "border-green/40" : "border-border"}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-2">Epoch {epoch ?? "?"}</span>
                    {isBest && <span className="text-[9px] font-bold text-green bg-green-bg px-1.5 py-px rounded-full">BEST</span>}
                  </div>
                  <span className={`text-xs font-bold ${profitColor(result.profit_total)}`}>
                    {result.profit_total != null ? fmt(result.profit_total, 2) + "%" : "\u2014"}
                  </span>
                </div>
                <div className="flex gap-3 text-[10px] text-text-3 mt-1">
                  {result.trades != null && <span>Trades: {String(result.trades)}</span>}
                  {result.loss != null && <span>Loss: {fmt(result.loss, 4)}</span>}
                  {result.loss_function != null && <span>Fn: {String(result.loss_function)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    /* ─── Performance (per-pair) ─── */
    case "performance": {
      if (data.performance.length === 0) {
        return <div className="text-center py-12 text-text-3 text-sm">No performance data</div>;
      }
      return (
        <div className="space-y-2">
          <div className={sectionTitle}>Per-Pair Performance</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-3 border-b border-border">
                <th className="text-left py-2 font-medium">Pair</th>
                <th className="text-right py-2 font-medium">Trades</th>
                <th className="text-right py-2 font-medium">profit_abs</th>
                <th className="text-right py-2 font-medium">profit_ratio</th>
              </tr>
            </thead>
            <tbody>
              {data.performance.map((p) => (
                <tr key={p.pair} className="border-b border-border/30">
                  <td className="py-2 text-text-0 font-medium">{p.pair}</td>
                  <td className="py-2 text-right text-text-0">{p.count}</td>
                  <td className={`py-2 text-right font-semibold ${profitColor(p.profit_abs)}`}>
                    {fmtMoney(p.profit_abs)}
                  </td>
                  <td className={`py-2 text-right ${profitColor(p.profit_ratio)}`}>
                    {fmt(p.profit_ratio * 100, 2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    /* ─── Entry/Exit Analysis ─── */
    case "entry_exit": {
      return (
        <div className="space-y-6">
          {data.entries.length > 0 && (
            <div>
              <div className={sectionTitle}>Entry Tags</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-3 border-b border-border">
                    <th className="text-left py-2 font-medium">enter_tag</th>
                    <th className="text-right py-2 font-medium">Entries</th>
                    <th className="text-right py-2 font-medium">Win Rate</th>
                    <th className="text-right py-2 font-medium">profit_abs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.enter_tag} className="border-b border-border/30">
                      <td className="py-2 text-text-0 font-medium">{e.enter_tag}</td>
                      <td className="py-2 text-right text-text-0">{e.entries}</td>
                      <td className="py-2 text-right text-text-0">{fmt(e.winrate * 100, 1)}%</td>
                      <td className={`py-2 text-right font-semibold ${profitColor(e.profit_abs)}`}>
                        {fmtMoney(e.profit_abs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.exits.length > 0 && (
            <div>
              <div className={sectionTitle}>Exit Reasons</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-3 border-b border-border">
                    <th className="text-left py-2 font-medium">exit_reason</th>
                    <th className="text-right py-2 font-medium">Exits</th>
                    <th className="text-right py-2 font-medium">Win Rate</th>
                    <th className="text-right py-2 font-medium">profit_abs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exits.map((e) => (
                    <tr key={e.exit_reason} className="border-b border-border/30">
                      <td className="py-2 text-text-0 font-medium">{e.exit_reason}</td>
                      <td className="py-2 text-right text-text-0">{e.exits}</td>
                      <td className="py-2 text-right text-text-0">{fmt(e.winrate * 100, 1)}%</td>
                      <td className={`py-2 text-right font-semibold ${profitColor(e.profit_abs)}`}>
                        {fmtMoney(e.profit_abs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.entries.length === 0 && data.exits.length === 0 && (
            <div className="text-center py-12 text-text-3 text-sm">No entry/exit data</div>
          )}
        </div>
      );
    }

    /* ─── AI Suggestions ─── */
    case "ai_suggestions": {
      if (data.aiValidations.length === 0) {
        return <div className="text-center py-12 text-text-3 text-sm">No AI validations</div>;
      }
      return (
        <div className="space-y-3">
          <div className={sectionTitle}>AI Validations ({data.aiValidations.length})</div>
          {data.aiValidations.map((v) => (
            <div key={v.id} className="bg-bg-2 border border-border rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-text-0 font-medium">{v.pair}</span>
                <span
                  className={`text-[10px] font-bold ${
                    v.all_agree ? "text-green" : v.strong_disagree ? "text-red" : "text-amber"
                  }`}
                >
                  {v.all_agree ? "ALL AGREE" : v.strong_disagree ? "DISAGREE" : "PARTIAL"}
                </span>
              </div>
              <div className="flex gap-4 text-[10px] text-text-3">
                <span>FreqAI: {v.freqai_direction} ({fmt(v.freqai_confidence * 100, 0)}%)</span>
                <span>Claude: {v.claude_direction} ({fmt(v.claude_confidence * 100, 0)}%)</span>
                <span>Grok: {v.grok_direction} ({fmt(v.grok_confidence * 100, 0)}%)</span>
              </div>
              {v.claude_reasoning && (
                <div className="text-[10px] text-text-2 mt-1 line-clamp-2">{v.claude_reasoning}</div>
              )}
            </div>
          ))}
        </div>
      );
    }

    /* ─── Configuration ─── */
    case "configuration": {
      if (!data.config) {
        return <div className="text-center py-12 text-text-3 text-sm">No configuration data (no bot linked)</div>;
      }
      const c = data.config;
      return (
        <div className="space-y-1">
          <div className={sectionTitle}>Bot Configuration</div>
          <div className={row}><span className={key}>strategy</span><span className={`${val} font-mono text-accent`}>{c.strategy}</span></div>
          <div className={row}><span className={key}>exchange</span><span className={val}>{typeof c.exchange === "string" ? c.exchange : c.exchange?.name ?? "\u2014"}</span></div>
          <div className={row}><span className={key}>timeframe</span><span className={val}>{c.timeframe}</span></div>
          <div className={row}><span className={key}>pair_whitelist</span><span className={val}>{c.pair_whitelist?.join(", ") ?? "\u2014"}</span></div>
          <div className={row}><span className={key}>stake_currency</span><span className={val}>{c.stake_currency}</span></div>
          <div className={row}><span className={key}>stake_amount</span><span className={val}>{String(c.stake_amount)}</span></div>
          <div className={row}><span className={key}>max_open_trades</span><span className={val}>{c.max_open_trades}</span></div>
          <div className={row}><span className={key}>stoploss</span><span className={`${val} text-red`}>{c.stoploss}</span></div>
          <div className={row}><span className={key}>trailing_stop</span><span className={val}>{c.trailing_stop ? "enabled" : "disabled"}</span></div>
          {c.trailing_stop_positive != null && (
            <div className={row}><span className={key}>trailing_stop_positive</span><span className={val}>{c.trailing_stop_positive}</span></div>
          )}
          <div className={row}><span className={key}>minimal_roi</span><span className={`${val} font-mono text-[10px]`}>{JSON.stringify(c.minimal_roi)}</span></div>
          <div className={row}><span className={key}>dry_run</span><span className={`${val} ${c.dry_run ? "text-amber" : "text-red"}`}>{String(c.dry_run)}</span></div>
          <div className={row}><span className={key}>trading_mode</span><span className={val}>{c.trading_mode}</span></div>
          <div className={row}><span className={key}>margin_mode</span><span className={val}>{c.margin_mode ?? "\u2014"}</span></div>
          <div className={row}><span className={key}>can_short</span><span className={val}>{String(c.can_short)}</span></div>
        </div>
      );
    }

    /* ─── Lifecycle Timeline ─── */
    case "lifecycle": {
      const lifecycles: Lifecycle[] = ["draft", "backtest", "paper", "live", "retired"];
      const currentIdx = lifecycles.indexOf(strat.lifecycle);
      return (
        <div className="space-y-6">
          <div className={sectionTitle}>Lifecycle Progress</div>
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            {lifecycles.map((lc, idx) => {
              const isDone = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <div key={lc} className="relative pb-6 last:pb-0">
                  <div
                    className={`absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                      isDone
                        ? "border-green bg-green-bg"
                        : isCurrent
                          ? "border-accent bg-accent/10 shadow-[0_0_8px_var(--accent)]"
                          : "border-border bg-bg-2"
                    }`}
                  />
                  <div className={`text-xs font-semibold ${isCurrent ? "text-text-0" : isDone ? "text-text-1" : "text-text-3"}`}>
                    {lc.toUpperCase()}
                  </div>
                  <div className="text-[10px] text-text-3 mt-0.5">
                    {lc === "draft" && strat.created_at
                      ? `Created ${new Date(strat.created_at).toLocaleDateString()}`
                      : isCurrent
                        ? "Current stage"
                        : isDone
                          ? "Completed"
                          : "Pending"}
                  </div>
                  {/* Show contextual info per completed stage */}
                  {isDone && lc === "backtest" && data.backtestResult && (
                    <div className="text-[10px] text-text-2 mt-1">
                      Best: {fmtMoney(data.backtestResult.profit_total_abs)} | {data.backtestResult.total_trades} trades | Sharpe {data.backtestResult.sharpe != null ? fmt(data.backtestResult.sharpe, 2) : "\u2014"}
                    </div>
                  )}
                  {isCurrent && lc === "live" && profit && (
                    <div className="text-[10px] text-text-2 mt-1">
                      Profit: {fmtMoney(profit.profit_all_coin)} | {profit.trade_count} trades | {winRate(profit)} win rate
                    </div>
                  )}
                  {isCurrent && lc === "paper" && profit && (
                    <div className="text-[10px] text-text-2 mt-1">
                      Paper profit: {fmtMoney(profit.profit_all_coin)} | {profit.trade_count} trades
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
