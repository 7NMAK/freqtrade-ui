"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/input";
import {
  fmtDateTime,
  fmtPct,
  fmtNum,
  PIPELINE_STEPS,
  type StrategyTestStatus,
  type StepState,
} from "@/lib/experiments";
import { getExperiments, type Experiment } from "@/lib/api";

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
    freqai: types.has("freqai") ? "completed" : "skipped",
    verify: types.has("oos_validation") || types.has("verification") ? "completed" : "pending",
    ai_review: types.has("ai_pre") || types.has("ai_post") ? "completed" : "skipped",
    paper: "pending",
    live: "pending",
  };
  return steps;
}

// ── Compute status from pipeline steps ────────────────────────────────

function computeStatus(steps: Record<string, StepState>, testCount: number): StrategyTestStatus {
  if (testCount === 0) return "Draft";
  const completed = Object.values(steps).filter(s => s === "completed").length;
  if (completed >= 5) return "Optimized";
  if (completed >= 2) return "Testing";
  return "Draft";
}

// ── Status badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StrategyTestStatus }) {
  const cls: Record<string, string> = {
    Draft: "bg-muted text-muted-foreground",
    Testing: "bg-amber/10 text-amber-500 border border-amber-500/25",
    Optimized: "bg-primary/10 text-primary border border-primary/30",
    Paper: "bg-purple/10 text-purple border border-purple/25",
    Live: "bg-green/10 text-emerald-500 border border-emerald-500/25",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${cls[status] ?? cls.Draft}`}
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
        let dotClass = "w-[10px] h-[10px] rounded-full border-[1.5px]";
        let connectorClass = "w-[6px] h-[1.5px]";

        if (state === "completed") {
          dotClass += " bg-green border-emerald-500";
          connectorClass += " bg-green";
        } else if (state === "active") {
          dotClass += " bg-primary border-primary";
          connectorClass += " bg-border";
        } else if (state === "skipped") {
          dotClass += " border-dashed border-text-3";
          connectorClass += " bg-border";
        } else {
          dotClass += " border-border";
          connectorClass += " bg-border";
        }

        return (
          <div key={step.key} className="flex items-center gap-[3px]">
            <Tooltip
              content={`${step.label}${state === "completed" ? " ✓" : state === "active" ? " ●" : state === "skipped" ? " ⊘" : " ○"}`}
              position="bottom"
            >
              <div className={dotClass} />
            </Tooltip>
            {idx < PIPELINE_STEPS.length - 1 && (
              <div className={connectorClass} />
            )}
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

  useEffect(() => {
    getExperiments()
      .then((res) => {
        const data = (res as unknown as { items?: Experiment[] }).items || (res as unknown as Experiment[]);
        if (Array.isArray(data)) {
          const mapped: UIExperiment[] = data.map((exp: Experiment) => {
            const pipelineSteps = computePipelineSteps(exp.completed_run_types ?? []);
            const testCount = exp.run_count ?? 0;
            const status = computeStatus(pipelineSteps, testCount);
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
              lastTestDate: exp.last_run_date ?? exp.created_at,
              bestProfit: exp.best_profit_pct ?? null,
              winRate: exp.best_win_rate != null ? exp.best_win_rate * 100 : null,
              maxDD: exp.best_max_drawdown ?? null,
              sharpe: exp.best_sharpe ?? null,
              pipelineSteps,
            };
          });
          setExperiments(mapped);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch experiments", err);
      });
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

  const handleNewExperiment = useCallback(() => {
    toast.success("New experiment created (mock)");
  }, [toast]);

  return (
    <AppShell title="Experiments">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-base font-semibold text-foreground">Experiments</h1>
        <span className="text-xs text-muted-foreground">
          All strategies and their test pipelines
        </span>
        <div className="ml-auto">
          <button
            onClick={handleNewExperiment}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-[#5558e6] text-white text-xs font-medium rounded-btn transition-colors"
          >
            + New Experiment
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex items-center gap-2.5 mb-4">
        <Input
          type="text"
          placeholder="Search strategies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-[240px] w-full"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-9 w-full max-w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
        >
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Testing">Testing</option>
          <option value="Optimized">Optimized</option>
          <option value="Paper">Paper</option>
          <option value="Live">Live</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="flex h-9 w-full max-w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
        >
          <option value="lastTest">Sort: Last Activity</option>
          <option value="name">Sort: Name A-Z</option>
          <option value="profit">Sort: Profit ↓</option>
          <option value="tests">Sort: Tests ↓</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filteredAndSorted.length} strategies
        </span>
      </div>

      {/* ── Strategy Table ── */}
      {filteredAndSorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-xs">
          No strategies found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Strategy
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Status
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Version
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Pair
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  TF
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Tests
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Last Test
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Profit%
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Win Rate
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Max DD
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Sharpe
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Pipeline
                </th>
                <th className="px-2.5 py-2 text-left text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((exp) => (
                <tr
                  key={exp.id}
                  className="cursor-pointer hover:bg-[rgba(99,102,241,0.03)] transition-colors"
                  onClick={() =>
                    router.push(
                      `/experiments/${encodeURIComponent(exp.strategyName)}`
                    )
                  }
                >
                  {/* Strategy (name + description) */}
                  <td className="px-2.5 py-2 border-b border-border/50">
                    <div className="font-semibold text-xs text-foreground">
                      {exp.strategyName}
                    </div>
                    {exp.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {exp.description}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-2.5 py-2 border-b border-border/50">
                    <StatusBadge status={exp.status} />
                  </td>

                  {/* Version */}
                  <td className="px-2.5 py-2 border-b border-border/50 text-xs text-muted-foreground">
                    {exp.version}
                  </td>

                  {/* Pair */}
                  <td className="px-2.5 py-2 border-b border-border/50 text-xs text-muted-foreground">
                    {exp.pair}
                  </td>

                  {/* Timeframe */}
                  <td className="px-2.5 py-2 border-b border-border/50 text-xs text-muted-foreground">
                    {exp.timeframe}
                  </td>

                  {/* Tests */}
                  <td className="px-2.5 py-2 border-b border-border/50 text-xs text-muted-foreground">
                    {exp.testCount}
                  </td>

                  {/* Last Test */}
                  <td className="px-2.5 py-2 border-b border-border/50 text-xs text-muted-foreground">
                    {exp.lastTestDate
                      ? `${exp.lastTestType ?? "Test"} · ${fmtDateTime(exp.lastTestDate)}`
                      : "—"}
                  </td>

                  {/* Profit% */}
                  <td
                    className={`px-2.5 py-2 border-b border-border/50 text-xs ${
                      (exp.bestProfit ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {exp.bestProfit !== null ? fmtPct(exp.bestProfit) : "—"}
                  </td>

                  {/* Win Rate */}
                  <td
                    className={`px-2.5 py-2 border-b border-border/50 text-xs ${
                      (exp.winRate ?? 0) >= 50 ? "text-emerald-500" : "text-muted-foreground"
                    }`}
                  >
                    {exp.winRate !== null ? `${fmtNum(exp.winRate, 1)}%` : "—"}
                  </td>

                  {/* Max DD */}
                  <td className="px-2.5 py-2 border-b border-border/50 text-xs text-rose-500">
                    {exp.maxDD !== null ? fmtPct(exp.maxDD) : "—"}
                  </td>

                  {/* Sharpe */}
                  <td className="px-2.5 py-2 border-b border-border/50 text-xs text-muted-foreground">
                    {exp.sharpe !== null ? fmtNum(exp.sharpe, 2) : "—"}
                  </td>

                  {/* Pipeline */}
                  <td className="px-2.5 py-2 border-b border-border/50">
                    <MiniPipeline steps={exp.pipelineSteps} />
                  </td>

                  {/* Open button */}
                  <td className="px-2.5 py-2 border-b border-border/50">
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/experiments/${encodeURIComponent(exp.strategyName)}`); }} className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border bg-muted/50 hover:bg-muted hover:border-ring text-xs text-muted-foreground rounded-btn transition-all">
                      Open →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
