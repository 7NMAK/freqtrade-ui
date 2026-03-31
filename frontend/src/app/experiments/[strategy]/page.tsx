"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import { PIPELINE_STEPS, type PipelineStepKey, type StepState } from "@/lib/experiments";
import { getExperiments, getExperimentRuns, type ExperimentRun } from "@/lib/api";

// ── Lazy-loaded tab components ────────────────────────────────────────────
const BacktestTab = dynamic(() => import("./components/BacktestTab"), { ssr: false });
const HyperoptTab = dynamic(() => import("./components/HyperoptTab"), { ssr: false });
const FreqAITab = dynamic(() => import("./components/FreqAITab"), { ssr: false });
const AiReviewTab = dynamic(() => import("./components/AiReviewTab"), { ssr: false });
const ValidationTab = dynamic(() => import("./components/ValidationTab"), { ssr: false });

// ── Lazy-loaded overlay components ────────────────────────────────────────
const AllTestsOverlay = dynamic(() => import("./components/AllTestsOverlay"), { ssr: false });
const CompareOverlay = dynamic(() => import("./components/CompareOverlay"), { ssr: false });
const AnalysisOverlay = dynamic(() => import("./components/AnalysisOverlay"), { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────
type Tab = "backtest" | "hyperopt" | "freqai" | "ai_review" | "validation";
type Overlay = "all_tests" | "compare" | "analysis" | null;

type StrategyDataProps = {
  name: string;
  status: "Draft" | "Testing" | "Optimized" | "Paper" | "Live";
  paperDayElapsed: number;
  paperDayTotal: number;
  testCount: number;
  steps: Record<PipelineStepKey, StepState>;
};

// ── Status badge classes (matches prototype .badge-*) ────────────────────
function statusBadgeClass(status: string): string {
  switch (status) {
    case "Draft": return "bg-muted text-muted-foreground";
    case "Testing": return "bg-amber/10 text-amber-500 border border-amber-500/25";
    case "Optimized": return "bg-primary/10 text-primary border border-primary/30";
    case "Paper": return "bg-purple/10 text-purple border border-purple/25";
    case "Live": return "bg-green/10 text-emerald-500 border border-emerald-500/25";
    default: return "bg-muted text-muted-foreground";
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PIPELINE TRACKER — matches prototype .pipeline exactly
// ══════════════════════════════════════════════════════════════════════════

function PipelineTracker({ data }: { data: StrategyDataProps }) {
  return (
    <div className="flex items-center gap-0 px-6 py-4 bg-card border-b border-border">
      {PIPELINE_STEPS.map((step, idx) => {
        const state = data.steps[step.key] ?? "pending";
        const isOptional = "optional" in step && step.optional;

        // Step circle + label classes (matches .pipeline-step.done/.active/.skipped)
        let circleClass = "w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0";
        let labelClass = "text-xs whitespace-nowrap";

        if (state === "completed") {
          circleClass += " bg-green border-emerald-500 text-white";
          labelClass += " text-emerald-500";
        } else if (state === "active") {
          circleClass += " bg-primary border-primary text-white animate-pulse";
          labelClass += " text-primary font-semibold";
        } else if (state === "skipped") {
          circleClass += " border-dashed border-text-3";
          labelClass += " text-muted-foreground opacity-50";
        } else {
          circleClass += " border-border";
          labelClass += " text-muted-foreground";
        }

        // Connector line classes (matches .pipeline-connector)
        let connectorClass = "w-[30px] h-[2px] flex-shrink-0";
        if (state === "completed") {
          connectorClass += " bg-green";
        } else if (isOptional || state === "skipped") {
          connectorClass += " border-t-2 border-dashed border-text-3 opacity-30 bg-transparent";
        } else {
          connectorClass += " bg-border";
        }

        // Icon inside circle
        let icon = "○";
        if (state === "completed") icon = "✓";
        else if (state === "active") icon = "●";
        else if (state === "skipped") icon = "⊘";

        return (
          <div key={step.key} className="contents">
            {/* Step */}
            <div className="flex items-center gap-2 px-3.5 py-1.5">
              <div className={circleClass}>{icon}</div>
              <span className={labelClass}>
                {step.label}
                {state === "active" && step.key === "paper" && (
                  <span className="text-xs text-muted-foreground ml-1">
                    Day {data.paperDayElapsed}/{data.paperDayTotal}
                  </span>
                )}
              </span>
            </div>

            {/* Connector (not after last step) */}
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

export default function StrategyWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const strategyName = (params?.strategy as string) || "Unknown";

  const [strategyData, setStrategyData] = useState<StrategyDataProps | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("backtest");
  const [openOverlay, setOpenOverlay] = useState<Overlay>(null);
  const [experimentId, setExperimentId] = useState<number | undefined>(undefined);
  const [miniRuns, setMiniRuns] = useState<ExperimentRun[]>([]);

  // Tab number → tab key mapping for inter-tab navigation
  const tabNumToKey: Record<number, Tab> = {
    1: "backtest", 2: "hyperopt", 3: "freqai", 4: "ai_review", 5: "validation",
  };
  const handleNavigateToTab = (tabNum: number) => {
    const key = tabNumToKey[tabNum];
    if (key) {
      setActiveTab(key);
      setOpenOverlay(null); // Close any open overlay
    }
  };

  // Escape key handler for overlays
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && openOverlay) setOpenOverlay(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openOverlay]);

  useEffect(() => {
    getExperiments()
      .then((res) => {
        const items = res.items || [];
        const exp = items.find(
          (e) => e.strategy_name === strategyName || e.name === strategyName
        );
        if (exp) {
          setExperimentId(exp.id);

          // Compute pipeline from actual completed run types
          const types = new Set(exp.completed_run_types ?? []);
          const steps: Record<PipelineStepKey, StepState> = {
            backtest: types.has("backtest") ? "completed" : "pending",
            hyperopt: types.has("hyperopt") ? "completed" : "pending",
            freqai: types.has("freqai") ? "completed" : "skipped",
            verify: types.has("oos_validation") || types.has("verification") ? "completed" : "pending",
            ai_review: types.has("ai_pre") || types.has("ai_post") ? "completed" : "skipped",
            paper: "pending",
            live: "pending",
          };

          // Compute status from pipeline
          const completedCount = Object.values(steps).filter(s => s === "completed").length;
          const testCount = exp.run_count ?? 0;
          let status: "Draft" | "Testing" | "Optimized" | "Paper" | "Live" = "Draft";
          if (testCount > 0) {
            if (completedCount >= 5) status = "Optimized";
            else if (completedCount >= 2) status = "Testing";
          }

          setStrategyData({
            name: exp.strategy_name || exp.name || strategyName,
            status,
            paperDayElapsed: 0,
            paperDayTotal: 30,
            testCount,
            steps,
          });
        } else {
          setStrategyData({
            name: strategyName,
            status: "Draft",
            paperDayElapsed: 0,
            paperDayTotal: 30,
            testCount: 0,
            steps: {
              backtest: "pending", hyperopt: "pending", freqai: "pending",
              verify: "pending", ai_review: "pending", paper: "pending", live: "pending",
            },
          });
        }
      })
      .catch(() => {
        setStrategyData({
          name: strategyName, status: "Draft", paperDayElapsed: 0, paperDayTotal: 30, testCount: 0,
          steps: { backtest: "pending", hyperopt: "pending", freqai: "pending", verify: "pending", ai_review: "pending", paper: "pending", live: "pending" },
        });
      });
  }, [strategyName]);

  // Fetch runs for mini comparison panel
  useEffect(() => {
    if (!experimentId) return;
    getExperimentRuns(experimentId)
      .then((runs) => {
        if (Array.isArray(runs)) {
          // Only show completed runs, sorted by most recent
          const completed = runs
            .filter((r) => r.status === 'completed')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10); // Show last 10
          setMiniRuns(completed);
        }
      })
      .catch(() => { /* silent */ });
  }, [experimentId]);

  if (!strategyData) return null;

  // Tab definitions — numbered 1-5 like prototype
  const tabs: Array<{ key: Tab; num: number; label: string }> = [
    { key: "backtest", num: 1, label: "Backtest" },
    { key: "hyperopt", num: 2, label: "Hyperopt" },
    { key: "freqai", num: 3, label: "FreqAI" },
    { key: "ai_review", num: 4, label: "Naš AI" },
    { key: "validation", num: 5, label: "Validation" },
  ];

  return (
    <AppShell title={`Experiments / ${strategyName}`}>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">

        {/* ── Workspace Header (matches prototype header) ── */}
        <header className="h-14 bg-card border-b border-border flex items-center px-6 gap-4 flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => router.push("/experiments")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border bg-muted/50 hover:bg-muted text-xs text-muted-foreground rounded-btn transition-all flex-shrink-0"
            >
              ← Back
            </button>
            <span className="text-base font-semibold text-foreground truncate">
              {strategyData.name}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide flex-shrink-0 ${statusBadgeClass(strategyData.status)}`}>
              {strategyData.status}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Helper buttons (matches prototype .helper-btns) */}
            <button
              onClick={() => setOpenOverlay("all_tests")}
              className="px-3 py-1.5 border border-border bg-muted/50 hover:bg-muted hover:border-border-border hover:border-ring text-xs text-muted-foreground rounded-btn transition-all flex items-center gap-1.5"
            >
              📋 All Tests <span className="text-xs opacity-60">({strategyData.testCount})</span>
            </button>
            <button
              onClick={() => setOpenOverlay("compare")}
              className="px-3 py-1.5 border border-border bg-muted/50 hover:bg-muted hover:border-border-border hover:border-ring text-xs text-muted-foreground rounded-btn transition-all flex items-center gap-1.5"
            >
              ⚖️ Compare
            </button>
            <button
              onClick={() => setOpenOverlay("analysis")}
              className="px-3 py-1.5 border border-border bg-muted/50 hover:bg-muted hover:border-border-border hover:border-ring text-xs text-muted-foreground rounded-btn transition-all flex items-center gap-1.5"
            >
              📊 Analysis
            </button>
            <button onClick={() => { setActiveTab("backtest"); setOpenOverlay(null); }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-[#5558e6] text-white text-xs font-medium rounded-btn transition-colors">
              + New Test
            </button>
          </div>
        </header>

        {/* ── Pipeline Tracker ── */}
        <PipelineTracker data={strategyData} />

        {/* ── Tab Bar (matches prototype .tabs with .tab-number) ── */}
        <div className="flex border-b border-border px-6 bg-card flex-shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-[11.5px] font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "text-primary border-primary font-semibold"
                    : "text-muted-foreground border-transparent hover:text-muted-foreground"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-xs mr-1.5 ${
                    isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.num}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content (scrollable) ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "backtest" && <BacktestTab strategy={strategyName} experimentId={experimentId} />}
          {activeTab === "hyperopt" && <HyperoptTab strategy={strategyName} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}
          {activeTab === "freqai" && <FreqAITab strategy={strategyName} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}
          {activeTab === "ai_review" && <AiReviewTab strategy={strategyName} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}
          {activeTab === "validation" && <ValidationTab strategy={strategyName} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}
        </div>

        {/* ── Mini Comparison Panel (§70-76 — always visible at bottom) ── */}
        <details className="border-t border-border bg-card">
          <summary className="px-6 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none flex items-center gap-2">
            <span>📊 Quick Compare — All Results ({miniRuns.length})</span>
          </summary>
          <div className="px-6 pb-3 overflow-x-auto">
            <table className="w-full text-[10px] whitespace-nowrap">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left px-2 py-1 font-semibold">#</th>
                  <th className="text-left px-2 py-1 font-semibold">Type</th>
                  <th className="text-left px-2 py-1 font-semibold">Sampler</th>
                  <th className="text-left px-2 py-1 font-semibold">Date</th>
                  <th className="text-right px-2 py-1 font-semibold">Trades</th>
                  <th className="text-right px-2 py-1 font-semibold">Win%</th>
                  <th className="text-right px-2 py-1 font-semibold">Profit%</th>
                  <th className="text-right px-2 py-1 font-semibold">Max DD</th>
                  <th className="text-right px-2 py-1 font-semibold">Sharpe</th>
                </tr>
              </thead>
              <tbody>
                {miniRuns.length === 0 ? (
                  <tr className="border-t border-border/30 text-muted-foreground/50">
                    <td colSpan={9} className="px-2 py-2 text-center italic">
                      No completed tests yet — run a backtest to see results here
                    </td>
                  </tr>
                ) : miniRuns.map((run) => (
                  <tr key={run.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-2 py-1 tabular-nums text-muted-foreground">{run.id}</td>
                    <td className="px-2 py-1"><span className={`uppercase font-semibold ${run.run_type === 'backtest' ? 'text-blue-400' : run.run_type === 'hyperopt' ? 'text-purple-400' : 'text-amber-400'}`}>{run.run_type}</span></td>
                    <td className="px-2 py-1 text-muted-foreground">{run.sampler ?? '—'}</td>
                    <td className="px-2 py-1 text-muted-foreground">{run.created_at ? new Date(run.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{run.total_trades ?? '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{run.win_rate != null ? `${(run.win_rate * 100).toFixed(1)}%` : '—'}</td>
                    <td className={`px-2 py-1 text-right tabular-nums font-medium ${(run.profit_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{run.profit_pct != null ? `${run.profit_pct >= 0 ? '+' : ''}${run.profit_pct.toFixed(2)}%` : '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-rose-400">{run.max_drawdown != null ? `-${Math.abs(run.max_drawdown).toFixed(2)}%` : '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{run.sharpe_ratio?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {/* ── Overlays (matches prototype .overlay) ── */}
      {openOverlay && (
        <div className="fixed inset-0 bg-[rgba(6,6,11,0.92)] z-[100] flex flex-col">
          <div className="h-14 bg-card border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
            <span className="text-base font-semibold text-foreground flex-1">
              {openOverlay === "all_tests" && `📋 All Tests — ${strategyName}`}
              {openOverlay === "compare" && "⚖️ Compare Tests"}
              {openOverlay === "analysis" && "📊 Analysis — §30 Deep Dive"}
            </span>
            <button
              onClick={() => setOpenOverlay(null)}
              className="bg-transparent border-none text-muted-foreground text-xl cursor-pointer p-2 rounded-btn hover:bg-muted hover:text-foreground transition-all"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {openOverlay === "all_tests" && <AllTestsOverlay strategy={strategyName} experimentId={experimentId} onClose={() => setOpenOverlay(null)} onNavigateToTab={handleNavigateToTab} onOpenOverlay={(o) => setOpenOverlay(o as Overlay)} />}
            {openOverlay === "compare" && <CompareOverlay strategy={strategyName} experimentId={experimentId} onClose={() => setOpenOverlay(null)} onNavigateToTab={handleNavigateToTab} />}
            {openOverlay === "analysis" && <AnalysisOverlay strategy={strategyName} experimentId={experimentId} onClose={() => setOpenOverlay(null)} />}
          </div>
        </div>
      )}
    </AppShell>
  );
}
