"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FlaskConical, Plus, ArrowUpDown, Filter } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import {
  fmtDateTime,
  fmtPct,
  fmtNum,
  PIPELINE_STEPS,
  type StrategyTestStatus,
  type StepState,
} from "@/lib/experiments";
import { getExperiments, seedExperiments, type Experiment } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────

interface UIExperiment {
  id: number;
  strategyName: string;
  description: string;
  status: StrategyTestStatus;
  version: string;
  pair: string;
  timeframe: string;
  testCount: number;
  lastTestType: string | null;
  lastTestDate: string | null;
  bestProfit: number | null;
  winRate: number | null;
  maxDD: number | null;
  sharpe: number | null;
  pipelineSteps: Record<string, StepState>;
}

// ── Compute pipeline steps from completed run types ──────────────────────

function computePipelineSteps(completedRunTypes: string[]): Record<string, StepState> {
  const types = new Set(completedRunTypes);
  const steps: Record<string, StepState> = {
    backtest: types.has("backtest") ? "completed" : "pending",
    hyperopt: types.has("hyperopt") ? "completed" : "pending",
    freqai: types.has("freqai") ? "completed" : "pending",
    verify: types.has("oos_validation") || types.has("verification") ? "completed" : "pending",
    ai_review: types.has("ai_pre") || types.has("ai_post") ? "completed" : "pending",
    paper: "pending",
    live: "pending",
  };
  return steps;
}

// ── Compute lifecycle status from completed run types ─────────────────

function computeStatus(completedRunTypes: string[], testCount: number): StrategyTestStatus {
  if (testCount === 0) return "Draft";
  const types = new Set(completedRunTypes);
  if (types.has("live")) return "Live";
  if (types.has("paper")) return "Paper";
  if (types.has("hyperopt") || types.has("oos_validation") || types.has("freqai")) return "Optimized";
  if (types.has("backtest")) return "Backtested";
  return "Draft";
}

// ── Status badge ─────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-white/[0.04] text-white/40 border border-white/[0.08]",
  Backtested: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  Optimized: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  Paper: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  Live: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  Retired: "bg-white/[0.03] text-white/30 border border-white/[0.06]",
};

function StatusBadge({ status }: { status: StrategyTestStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider shrink-0 ${STATUS_STYLES[status] ?? STATUS_STYLES.Draft}`}
    >
      {status}
    </span>
  );
}

// ── Mini Pipeline (dots + connectors) ────────────────────────────────────

function MiniPipeline({ steps }: { steps: Record<string, StepState> }) {
  return (
    <div className="flex items-center gap-[3px]">
      {PIPELINE_STEPS.map((step, idx) => {
        const state = steps[step.key];
        let dotClass = "w-[7px] h-[7px] rounded-full";
        let connectorClass = "w-[5px] h-px";

        if (state === "completed") {
          dotClass += " bg-emerald-500";
          connectorClass += " bg-emerald-500/50";
        } else if (state === "active") {
          dotClass += " bg-white animate-pulse";
          connectorClass += " bg-white/20";
        } else if (state === "skipped") {
          dotClass += " border border-dashed border-white/20";
          connectorClass += " bg-white/10";
        } else {
          dotClass += " border border-white/15";
          connectorClass += " bg-white/8";
        }

        return (
          <div key={step.key} className="flex items-center gap-[3px]">
            <div className={dotClass} />
            {idx < PIPELINE_STEPS.length - 1 && <div className={connectorClass} />}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════

export default function ExperimentsPage() {
  const router = useRouter();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("lastTest");
  const [experiments, setExperiments] = useState<UIExperiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getExperiments()
      .then((res) => {
        const data = (res as unknown as { items?: Experiment[] }).items || (res as unknown as Experiment[]);
        if (Array.isArray(data)) {
          const mapped: UIExperiment[] = data.map((exp: Experiment) => {
            const completedTypes = exp.completed_run_types ?? [];
            const pipelineSteps = computePipelineSteps(completedTypes);
            const testCount = exp.run_count ?? 0;
            const status = computeStatus(completedTypes, testCount);
            return {
              id: exp.id,
              strategyName: exp.strategy_name || exp.name || "Unknown",
              description: exp.notes || "",
              status,
              version: exp.best_version_id ? `v${exp.best_version_id}` : "v0 (draft)",
              pair: exp.pair || "BTC/USDT:USDT",
              timeframe: exp.timeframe || "1h",
              testCount,
              lastTestType: exp.last_run_type ?? null,
              lastTestDate: exp.last_run_date ?? (exp.run_count && exp.run_count > 0 ? exp.created_at : null),
              bestProfit: exp.best_profit_pct ?? null,
              winRate: exp.best_win_rate ?? null,
              maxDD: exp.best_max_drawdown ?? null,
              sharpe: exp.best_sharpe ?? null,
              pipelineSteps,
            };
          });
          setExperiments(mapped);
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to fetch experiments");
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = experiments.slice();

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.strategyName.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      result = result.filter((e) => e.status === statusFilter);
    }

    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.strategyName.localeCompare(b.strategyName));
        break;
      case "profit":
        result.sort((a, b) => (b.bestProfit ?? -Infinity) - (a.bestProfit ?? -Infinity));
        break;
      case "tests":
        result.sort((a, b) => b.testCount - a.testCount);
        break;
      case "lastTest":
      default:
        result.sort((a, b) => {
          const ad = a.lastTestDate ? new Date(a.lastTestDate).getTime() : 0;
          const bd = b.lastTestDate ? new Date(b.lastTestDate).getTime() : 0;
          return bd - ad;
        });
        break;
    }
    return result;
  }, [experiments, searchTerm, statusFilter, sortBy]);

  const handleNewExperiment = useCallback(async () => {
    const loadId = toast.loading("Creating experiments for all strategies...");
    try {
      const result = await seedExperiments();
      toast.dismiss(loadId);
      if (result.created > 0) {
        toast.success(`${result.created} experiment(s) created.`);
        const resp = await getExperiments();
        if (resp.items) {
          setExperiments(resp.items.map((exp) => ({
            id: exp.id,
            strategyName: exp.strategy_name ?? exp.name,
            description: exp.notes || "",
            status: computeStatus(exp.completed_run_types ?? [], exp.run_count ?? 0),
            version: exp.best_version_id ? `v${exp.best_version_id}` : "v0 (draft)",
            pair: exp.pair || "BTC/USDT:USDT",
            timeframe: exp.timeframe || "1h",
            testCount: exp.run_count ?? 0,
            lastTestType: exp.last_run_type ?? null,
            lastTestDate: exp.last_run_date ?? null,
            bestProfit: exp.best_profit_pct ?? null,
            winRate: exp.best_win_rate ?? null,
            maxDD: exp.best_max_drawdown ?? null,
            sharpe: exp.best_sharpe ?? null,
            pipelineSteps: computePipelineSteps(exp.completed_run_types ?? []),
          })));
        }
      } else {
        toast.success("All strategies already have experiments.");
      }
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Failed to create experiments.");
    }
  }, [toast]);

  return (
    <AppShell title="Experiments">
      <div className="flex flex-col h-full min-h-0 bg-black">
        {/* ── Header Bar ── */}
        <div className="h-12 l-b flex items-center px-5 gap-4 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <FlaskConical className="w-4 h-4 text-white/40 shrink-0" />
            <h1 className="text-[13px] font-bold text-white">Experiments</h1>
            <span className="text-[10px] text-white/30 ml-1">
              {filteredAndSorted.length} strategies
            </span>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search strategies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-[200px] pl-8 pr-3 text-[11px] rounded bg-white/[0.03] border border-white/[0.12] text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <Filter className="w-3 h-3 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 w-[130px] pl-7 pr-2 text-[11px] rounded bg-white/[0.03] border border-white/[0.12] text-white/70 focus:border-white/25 focus:outline-none appearance-none cursor-pointer transition-colors"
              >
                <option value="">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Backtested">Backtested</option>
                <option value="Optimized">Optimized</option>
                <option value="Paper">Paper</option>
                <option value="Live">Live</option>
              </select>
            </div>

            <div className="relative">
              <ArrowUpDown className="w-3 h-3 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-8 w-[140px] pl-7 pr-2 text-[11px] rounded bg-white/[0.03] border border-white/[0.12] text-white/70 focus:border-white/25 focus:outline-none appearance-none cursor-pointer transition-colors"
              >
                <option value="lastTest">Last Activity</option>
                <option value="name">Name A-Z</option>
                <option value="profit">Profit</option>
                <option value="tests">Tests</option>
              </select>
            </div>

            <div className="h-5 w-px bg-white/10 mx-1" />

            <button
              onClick={handleNewExperiment}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black text-[11px] font-bold rounded hover:bg-white/85 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Experiment
            </button>
          </div>
        </div>

        {/* ── Card Grid ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-[11px] text-white/30 animate-pulse">Loading experiments...</div>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <FlaskConical className="w-8 h-8 text-white/10" />
              <div className="text-[11px] text-white/30">No strategies found</div>
              {experiments.length === 0 && (
                <button
                  onClick={handleNewExperiment}
                  className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-white/60 text-[11px] rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Create experiments from strategies
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {filteredAndSorted.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => router.push(`/experiments/${encodeURIComponent(exp.strategyName)}`)}
                  className="bg-white/[0.03] border border-white/[0.12] hover:bg-white/[0.06] hover:border-white/[0.20] rounded-md cursor-pointer transition-all group"
                >
                  {/* Card Header */}
                  <div className="px-4 pt-3.5 pb-2.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FlaskConical className="w-3.5 h-3.5 text-white/25 shrink-0" />
                          <span className="text-[12px] font-bold text-white truncate">
                            {exp.strategyName}
                          </span>
                        </div>
                        {exp.description && (
                          <p className="text-[10px] text-white/30 truncate pl-5.5">
                            {exp.description}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={exp.status} />
                    </div>

                    {/* Pipeline */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <MiniPipeline steps={exp.pipelineSteps} />
                      <span className="text-[9px] text-white/20 uppercase tracking-wider">
                        pipeline
                      </span>
                    </div>
                  </div>

                  {/* Card Metrics */}
                  <div className="border-t border-white/[0.06] px-4 py-2.5 grid grid-cols-4 gap-2">
                    <div>
                      <div className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">Tests</div>
                      <div className="text-[11px] font-mono font-bold text-white/70">{exp.testCount}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">Profit</div>
                      <div className={`text-[11px] font-mono font-bold ${exp.bestProfit !== null ? ((exp.bestProfit ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500") : "text-white/25"}`}>
                        {exp.bestProfit !== null ? fmtPct(exp.bestProfit) : "--"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">Win%</div>
                      <div className={`text-[11px] font-mono font-bold ${exp.winRate !== null ? ((exp.winRate ?? 0) >= 50 ? "text-emerald-500" : "text-white/50") : "text-white/25"}`}>
                        {exp.winRate !== null ? `${fmtNum(exp.winRate, 1)}%` : "--"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">Max DD</div>
                      <div className={`text-[11px] font-mono font-bold ${exp.maxDD !== null ? "text-rose-500" : "text-white/25"}`}>
                        {exp.maxDD !== null ? fmtPct(exp.maxDD) : "--"}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="border-t border-white/[0.06] px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-white/25">
                      <span>{exp.pair}</span>
                      <span className="text-white/10">|</span>
                      <span>{exp.timeframe}</span>
                      <span className="text-white/10">|</span>
                      <span>{exp.version}</span>
                    </div>
                    <div className="text-[10px] text-white/20">
                      {exp.lastTestDate
                        ? fmtDateTime(exp.lastTestDate)
                        : "No tests yet"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
