"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Plus } from "lucide-react";
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

// ── Status badge (rounded-full per design) ──────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-zinc-800/60 text-zinc-400",
  Backtested: "bg-blue-500/12 text-blue-400 border border-blue-500/25",
  Optimized: "bg-[#f59e0b]/12 text-[#f59e0b] border border-[#f59e0b]/25",
  Paper: "bg-purple-500/12 text-purple-400 border border-purple-500/25",
  Live: "bg-up/12 text-up border border-up/25",
  Retired: "bg-zinc-800/60 text-zinc-500",
};

function StatusBadge({ status }: { status: StrategyTestStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider whitespace-nowrap ${STATUS_STYLES[status] ?? STATUS_STYLES.Draft}`}
    >
      {status}
    </span>
  );
}

// ── Mini Pipeline (10×10 dots, 1.5px borders, 6px connectors per design) ─

function MiniPipeline({ steps, status }: { steps: Record<string, StepState>; status: StrategyTestStatus }) {
  return (
    <div className="flex items-center gap-[3px]">
      {PIPELINE_STEPS.map((step, idx) => {
        const state = steps[step.key];
        let dotClass = "w-[10px] h-[10px] rounded-full border-[1.5px]";
        let connectorClass = "w-[6px] h-[1.5px]";

        if (state === "completed") {
          dotClass += " bg-up border-up";
          connectorClass += " bg-up";
        } else if (state === "active") {
          if (status === "Paper") {
            dotClass += " bg-purple-500 border-purple-500";
          } else {
            dotClass += " bg-up border-up";
          }
          connectorClass += " bg-white/10";
        } else {
          dotClass += " border-white/20";
          connectorClass += " bg-white/10";
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

// ── Format last test display ────────────────────────────────────────────

function fmtLastTest(type: string | null, date: string | null): string {
  if (!type && !date) return "—";
  const t = type ?? "test";
  const d = date ? fmtDateTime(date) : "";
  return d ? `${t} · ${d}` : t;
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
        <div className="h-14 bg-black l-b flex items-center px-5 gap-4 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FlaskConical className="w-4 h-4 text-white/40 shrink-0" />
            <span className="text-[13px] font-bold text-white">Experiments</span>
            <span className="text-[11px] text-muted">
              All strategies and their test pipelines
            </span>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="Search strategies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="builder-input text-[11px] w-48"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="builder-select text-[11px]"
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Backtested">Backtested</option>
              <option value="Optimized">Optimized</option>
              <option value="Paper">Paper</option>
              <option value="Live">Live</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="builder-select text-[11px]"
            >
              <option value="lastTest">Sort: Last Activity</option>
              <option value="name">Sort: Name A-Z</option>
              <option value="profit">Sort: Profit ↓</option>
              <option value="tests">Sort: Tests ↓</option>
            </select>
            <button
              onClick={handleNewExperiment}
              className="builder-action bg-white text-black hover:bg-white/90"
            >
              <Plus className="w-3.5 h-3.5" />
              New Experiment
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto">
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
            <table className="w-full text-left border-collapse whitespace-nowrap text-[13px]">
              <thead className="sticky top-0 bg-surface l-b font-mono text-[11px] uppercase tracking-widest text-muted z-10 shadow-lg">
                <tr>
                  <th className="px-5 py-3.5 font-medium sortable filterable">Strategy</th>
                  <th className="px-3 py-3.5 font-medium sortable filterable">Status</th>
                  <th className="px-3 py-3.5 font-medium sortable">Version</th>
                  <th className="px-3 py-3.5 font-medium sortable filterable">Pair</th>
                  <th className="px-3 py-3.5 font-medium sortable">TF</th>
                  <th className="px-3 py-3.5 font-medium sortable">Tests</th>
                  <th className="px-3 py-3.5 font-medium sortable sort-desc">Last Test</th>
                  <th className="px-3 py-3.5 font-medium sortable">Profit%</th>
                  <th className="px-3 py-3.5 font-medium sortable">Win Rate</th>
                  <th className="px-3 py-3.5 font-medium sortable">Max DD</th>
                  <th className="px-3 py-3.5 font-medium sortable">Sharpe</th>
                  <th className="px-3 py-3.5 font-medium">Pipeline</th>
                  <th className="px-3 py-3.5 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="font-mono text-white/85 divide-y divide-white/[0.05]">
                {filteredAndSorted.map((exp) => {
                  const isDraft = exp.status === "Draft";
                  return (
                    <tr
                      key={exp.id}
                      onClick={() => router.push(`/experiments/${encodeURIComponent(exp.strategyName)}`)}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3"><div className="font-semibold text-white text-[13px]">{exp.strategyName}</div>{exp.description && <div className="text-[10px] text-muted mt-0.5">{exp.description}</div>}</td>
                      <td className="px-3 py-3"><StatusBadge status={exp.status} /></td>
                      <td className="px-3 py-3 text-muted">{exp.version}</td>
                      <td className="px-3 py-3 text-white">{exp.pair}</td>
                      <td className="px-3 py-3 text-muted">{exp.timeframe}</td>
                      <td className="px-3 py-3">{isDraft ? <span className="text-muted">0</span> : <span className="text-white">{exp.testCount}</span>}</td>
                      <td className="px-3 py-3 text-muted">{isDraft ? "—" : fmtLastTest(exp.lastTestType, exp.lastTestDate)}</td>
                      <td className="px-3 py-3">{isDraft || exp.bestProfit === null ? <span className="text-muted">—</span> : <span className={`${(exp.bestProfit ?? 0) >= 0 ? "text-up" : "text-down"} font-bold`}>{fmtPct(exp.bestProfit)}</span>}</td>
                      <td className="px-3 py-3">{isDraft || exp.winRate === null ? <span className="text-muted">—</span> : <span className={(exp.winRate ?? 0) >= 65 ? "text-up" : "text-muted"}>{fmtNum(exp.winRate, 1)}%</span>}</td>
                      <td className="px-3 py-3">{isDraft || exp.maxDD === null ? <span className="text-muted">—</span> : <span className="text-down">{fmtPct(exp.maxDD)}</span>}</td>
                      <td className="px-3 py-3 text-muted">{isDraft || exp.sharpe === null ? "—" : fmtNum(exp.sharpe, 2)}</td>
                      <td className="px-3 py-3"><MiniPipeline steps={exp.pipelineSteps} status={exp.status} /></td>
                      <td className="px-3 py-3 text-center"><button onClick={(e) => { e.stopPropagation(); router.push(`/experiments/${encodeURIComponent(exp.strategyName)}`); }} className="px-2.5 py-1 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors">Open →</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
