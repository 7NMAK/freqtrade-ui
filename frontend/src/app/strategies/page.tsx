"use client";

import { useState, useCallback, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import {
  getBots,
  getStrategies,
  updateStrategy,
  deleteStrategy,
  importStrategy,
  botProfit,
} from "@/lib/api";
import type { Bot, Strategy, FTProfit } from "@/types";

/* ─── Types ─── */
type Lifecycle = "live" | "paper" | "backtest" | "draft" | "retired";

/* ─── Sub-components ─── */

function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle }) {
  const styles: Record<Lifecycle, string> = {
    draft: "bg-bg-3 text-text-3 border border-border",
    backtest: "bg-cyan/10 text-cyan border border-cyan/20",
    paper: "bg-amber-bg text-amber border border-amber/20",
    live: "bg-green-bg text-green border border-green/20",
    retired: "bg-red-bg text-red border border-red/15",
  };
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${styles[lifecycle]}`}>
      {lifecycle}
    </span>
  );
}

function BotStatusDot({ status }: { status: string }) {
  const color =
    status === "running"
      ? "bg-green"
      : status === "stopped"
        ? "bg-text-3"
        : status === "error" || status === "killed"
          ? "bg-red"
          : "bg-amber";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

/* ─── Page ─── */

export default function StrategiesPage() {
  const toast = useToast();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [profitMap, setProfitMap] = useState<Record<number, FTProfit>>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Lifecycle | "all">("all");
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Load strategies and bots on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      let stratsList: Strategy[] = [];
      let botsList: Bot[] = [];

      try {
        stratsList = await getStrategies();
        setStrategies(stratsList);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load strategies");
      }

      try {
        botsList = await getBots();
        setBots(botsList);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load bots");
      }

      // Fetch profit for each running bot that is linked to a strategy
      const linkedBotIds = new Set(
        stratsList
          .filter((s) => s.bot_instance_id != null)
          .map((s) => s.bot_instance_id as number)
      );
      const runningLinkedBots = botsList.filter(
        (b) => linkedBotIds.has(b.id) && b.status === "running"
      );

      const profits: Record<number, FTProfit> = {};
      await Promise.allSettled(
        runningLinkedBots.map(async (bot) => {
          try {
            const p = await botProfit(bot.id);
            profits[bot.id] = p;
          } catch {
            // Bot may not have trade data yet — not an error worth showing
          }
        })
      );
      setProfitMap(profits);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getBotForStrategy = useCallback(
    (strat: Strategy): Bot | undefined => {
      if (strat.bot_instance_id == null) return undefined;
      return bots.find((b) => b.id === strat.bot_instance_id);
    },
    [bots]
  );

  const handleImportFile = useCallback(async () => {
    if (!importFile || !bots.length) {
      toast.error("No file selected or no bots available");
      return;
    }
    setImporting(true);
    const id = toast.loading(`Importing ${importFile.name}...`);
    try {
      const bot = bots.find((b) => b.status === "running") ?? bots[0];
      await importStrategy(bot.id, importFile);
      toast.dismiss(id);
      toast.success(`${importFile.name} imported successfully`);
      setShowImport(false);
      setImportFile(null);
      // Reload strategies
      const updated = await getStrategies();
      setStrategies(updated);
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [importFile, bots, toast]);

  const handleDelete = useCallback(async (strategy: Strategy) => {
    if (!bots.length) {
      toast.error("No bots available");
      return;
    }
    setDeleting(strategy.id);
    const id = toast.loading(`Deleting ${strategy.name}...`);
    try {
      await deleteStrategy(strategy.id);
      toast.dismiss(id);
      toast.success(`${strategy.name} deleted`);
      setStrategies((prev) => prev.filter((s) => s.id !== strategy.id));
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }, [bots, toast]);

  const handleTransition = useCallback(
    async (strategy: Strategy, newLifecycle: Lifecycle) => {
      const id = toast.loading(`Transitioning to ${newLifecycle}...`);
      try {
        await updateStrategy(strategy.id, { lifecycle: newLifecycle });
        toast.dismiss(id);
        toast.success(`${strategy.name} transitioned to ${newLifecycle}`);
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

  const filtered = strategies.filter(
    (s) => activeFilter === "all" || s.lifecycle === activeFilter
  );

  if (loading) {
    return (
      <AppShell title="Strategies">
        <div className="flex items-center justify-center h-64">
          <div className="text-text-2">Loading strategies...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Strategies">
      <div className="max-w-[1400px] mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-2">
            {(["all", "live", "paper", "backtest", "draft", "retired"] as const).map(
              (filter) => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-btn text-xs font-semibold transition-all ${
                    activeFilter === filter
                      ? "bg-accent text-white"
                      : "bg-bg-2 text-text-2 border border-border hover:border-border-hover"
                  }`}
                >
                  {filter === "all"
                    ? `All (${strategies.length})`
                    : `${filter.charAt(0).toUpperCase() + filter.slice(1)} (${strategies.filter((s) => s.lifecycle === filter).length})`}
                </button>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="px-4 py-2 rounded-btn bg-accent text-white text-xs font-semibold hover:bg-accent-dim transition-all"
          >
            Import Strategy
          </button>
        </div>

        {/* Strategies list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-text-3 text-sm">
              {strategies.length === 0
                ? "No strategies found. Import a strategy or create one via the orchestrator."
                : `No strategies in "${activeFilter}" lifecycle.`}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((strat, idx) => {
              const isOpen = detailIdx === idx;
              const linkedBot = getBotForStrategy(strat);
              const profit = strat.bot_instance_id != null ? profitMap[strat.bot_instance_id] : undefined;

              return (
                <div key={strat.id} className="bg-bg-2 border border-border rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDetailIdx(isOpen ? null : idx)}
                    className="w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-bg-3 transition-all"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-text-0">{strat.name}</div>
                          <LifecycleBadge lifecycle={strat.lifecycle as Lifecycle} />
                        </div>
                        {strat.description && (
                          <div className="text-xs text-text-3 mt-1">{strat.description}</div>
                        )}
                      </div>

                      {/* Bot info in collapsed row */}
                      {linkedBot && (
                        <div className="flex items-center gap-2 text-xs text-text-2">
                          <BotStatusDot status={linkedBot.status} />
                          <span>{linkedBot.name}</span>
                        </div>
                      )}

                      {/* Profit summary in collapsed row */}
                      {profit && (
                        <div className="text-right">
                          <div
                            className={`text-xs font-bold ${
                              profit.profit_all_coin >= 0 ? "text-green" : "text-red"
                            }`}
                          >
                            {profit.profit_all_coin >= 0 ? "+" : ""}
                            {profit.profit_all_coin.toFixed(4)}
                          </div>
                          <div className="text-[10px] text-text-3">
                            {profit.trade_count} trade{profit.trade_count !== 1 ? "s" : ""}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs text-text-3 transition-transform ml-4 ${isOpen ? "" : "-rotate-90"}`}>
                      &#9660;
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 py-6 border-t border-border bg-bg-1">
                      {/* Info grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <div>
                          <div className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1">
                            Lifecycle
                          </div>
                          <div className="text-sm text-text-0 capitalize">{strat.lifecycle}</div>
                        </div>

                        {linkedBot && (
                          <>
                            <div>
                              <div className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1">
                                Bot
                              </div>
                              <div className="flex items-center gap-2">
                                <BotStatusDot status={linkedBot.status} />
                                <span className="text-sm text-text-0">{linkedBot.name}</span>
                                <span className="text-[10px] text-text-3 capitalize">({linkedBot.status})</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1">
                                Mode
                              </div>
                              <div className="text-sm text-text-0">
                                {linkedBot.is_dry_run ? "Dry Run" : "Live"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1">
                                Health
                              </div>
                              <div className={`text-sm font-semibold ${linkedBot.is_healthy ? "text-green" : "text-red"}`}>
                                {linkedBot.is_healthy ? "Healthy" : `Unhealthy (${linkedBot.consecutive_failures} failures)`}
                              </div>
                            </div>
                          </>
                        )}

                        {!linkedBot && strat.bot_instance_id && (
                          <div>
                            <div className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1">
                              Bot Instance
                            </div>
                            <div className="text-sm text-text-3">ID: {strat.bot_instance_id} (not found)</div>
                          </div>
                        )}
                      </div>

                      {/* Profit details */}
                      {profit && (
                        <div className="mb-6">
                          <div className="text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-3">
                            Profit (from FT API)
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-bg-2 rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-text-3 mb-1">All Profit</div>
                              <div className={`text-sm font-bold ${profit.profit_all_coin >= 0 ? "text-green" : "text-red"}`}>
                                {profit.profit_all_coin >= 0 ? "+" : ""}{profit.profit_all_coin.toFixed(4)}
                              </div>
                              <div className="text-[10px] text-text-3">
                                {profit.profit_all_percent.toFixed(2)}%
                              </div>
                            </div>
                            <div className="bg-bg-2 rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-text-3 mb-1">Closed Profit</div>
                              <div className={`text-sm font-bold ${profit.profit_closed_coin >= 0 ? "text-green" : "text-red"}`}>
                                {profit.profit_closed_coin >= 0 ? "+" : ""}{profit.profit_closed_coin.toFixed(4)}
                              </div>
                              <div className="text-[10px] text-text-3">
                                {profit.profit_closed_percent.toFixed(2)}%
                              </div>
                            </div>
                            <div className="bg-bg-2 rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-text-3 mb-1">Trade Count</div>
                              <div className="text-sm font-bold text-text-0">{profit.trade_count}</div>
                              <div className="text-[10px] text-text-3">
                                {profit.closed_trade_count} closed
                              </div>
                            </div>
                            <div className="bg-bg-2 rounded-lg p-3 border border-border">
                              <div className="text-[10px] text-text-3 mb-1">Win Rate</div>
                              <div className="text-sm font-bold text-text-0">
                                {profit.winning_trades + profit.losing_trades > 0
                                  ? ((profit.winning_trades / (profit.winning_trades + profit.losing_trades)) * 100).toFixed(1)
                                  : "0.0"}%
                              </div>
                              <div className="text-[10px] text-text-3">
                                {profit.winning_trades}W / {profit.losing_trades}L
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(strat)}
                          disabled={deleting === strat.id}
                          className="px-4 py-2 rounded-btn border border-red/20 bg-red-bg text-red text-xs font-semibold hover:border-red/40 transition-all disabled:opacity-50"
                        >
                          {deleting === strat.id ? "Deleting..." : "Delete"}
                        </button>

                        {strat.lifecycle === "draft" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(strat, "backtest")}
                            className="px-4 py-2 rounded-btn border border-cyan/20 bg-cyan/10 text-cyan text-xs font-semibold hover:border-cyan/40 transition-all"
                          >
                            Promote to Backtest
                          </button>
                        )}
                        {strat.lifecycle === "backtest" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(strat, "paper")}
                            className="px-4 py-2 rounded-btn border border-amber/20 bg-amber-bg text-amber text-xs font-semibold hover:border-amber/40 transition-all"
                          >
                            Promote to Paper
                          </button>
                        )}
                        {strat.lifecycle === "paper" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(strat, "live")}
                            className="px-4 py-2 rounded-btn border border-green/20 bg-green-bg text-green text-xs font-semibold hover:border-green/40 transition-all"
                          >
                            Promote to Live
                          </button>
                        )}
                        {(strat.lifecycle === "live" || strat.lifecycle === "paper") && (
                          <button
                            type="button"
                            onClick={() => handleTransition(strat, "retired")}
                            className="px-4 py-2 rounded-btn border border-red/20 bg-red-bg text-red text-xs font-semibold hover:border-red/40 transition-all"
                          >
                            Retire
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Import Modal */}
        {showImport && (
          <div
            className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowImport(false);
            }}
          >
            <div className="bg-bg-1 border border-border rounded-2xl p-8 max-w-[480px] w-[90%]">
              <div className="text-base font-bold text-text-0 mb-4">Import Strategy</div>
              <label
                className="border-2 border-dashed border-border rounded-xl py-10 px-5 text-center mb-4 cursor-pointer transition-colors hover:border-accent block"
                htmlFor="import-file-input"
              >
                <div className="text-[13px] text-text-1 mb-1">
                  {importFile ? importFile.name : "Drop .py strategy file here or click to browse"}
                </div>
                <div className="text-[11px] text-text-3">Accepts FreqTrade strategy Python files</div>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".py"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowImport(false);
                    setImportFile(null);
                  }}
                  className="px-5 py-2 rounded-btn border border-border bg-bg-2 text-text-1 cursor-pointer text-xs hover:bg-bg-3 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportFile}
                  disabled={importing || !importFile}
                  className="px-5 py-2 rounded-btn border-none bg-accent text-white cursor-pointer text-xs font-semibold hover:bg-accent-dim transition-all disabled:opacity-50"
                >
                  {importing ? "Uploading..." : "Import"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
