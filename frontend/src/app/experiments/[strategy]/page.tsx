"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, FlaskConical } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { PIPELINE_STEPS, type PipelineStepKey, type StepState } from "@/lib/experiments";
import { getExperiments } from "@/lib/api";

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

// ── Status badge classes ────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-white/[0.04] text-white/40 border border-white/[0.08]",
  Testing: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  Optimized: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  Paper: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  Live: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
};

// ══════════════════════════════════════════════════════════════════════════
// PIPELINE TRACKER
// ══════════════════════════════════════════════════════════════════════════

function PipelineTracker({ data }: { data: StrategyDataProps }) {
  return (
    <div className="h-10 bg-black l-b flex items-center px-5 shrink-0 overflow-x-auto">
      <div className="flex items-center gap-0">
        {PIPELINE_STEPS.map((step, idx) => {
          const state = data.steps[step.key] ?? "pending";

          // Circle classes
          let circleClass = "w-4 h-4 rounded-full flex items-center justify-center text-[8px]";
          let labelClass = "text-[10px]";
          let icon = "\u25CB"; // ○
          let connectorClass = "w-5 h-px";

          if (state === "completed") {
            circleClass += " border border-up text-up font-bold";
            labelClass += " text-up font-bold";
            connectorClass += " bg-up/50";
            icon = "\u2713"; // ✓
          } else if (state === "active") {
            circleClass += " border border-white bg-white text-black font-bold animate-pulse";
            labelClass += " text-white font-bold";
            connectorClass += " bg-white/15";
            icon = "\u25CF"; // ●
          } else if (state === "skipped") {
            circleClass += " border-dashed border border-white/20 text-white/20";
            labelClass += " text-white/30";
            connectorClass += " border-t border-dashed border-white/15 bg-transparent";
            icon = "\u2298"; // ⊘
          } else {
            // pending
            circleClass += " border border-white/15 text-white/20";
            labelClass += " text-white/30";
            connectorClass += " bg-white/8";
            icon = "\u25CB"; // ○
          }

          return (
            <div key={step.key} className="contents">
              {/* Step */}
              <div className="flex items-center gap-1.5 px-2.5">
                <div className={circleClass}>{icon}</div>
                <span className={labelClass}>
                  {step.label}
                  {state === "active" && step.key === "paper" && data.paperDayElapsed > 0 && (
                    <span className="text-white/30 font-normal ml-1">
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════

export default function StrategyWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const strategyName = decodeURIComponent((params?.strategy as string) || "Unknown");

  const [strategyData, setStrategyData] = useState<StrategyDataProps | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("backtest");
  const [openOverlay, setOpenOverlay] = useState<Overlay>(null);
  const [experimentId, setExperimentId] = useState<number | undefined>(undefined);

  // Tab number -> tab key mapping for inter-tab navigation
  const tabNumToKey: Record<number, Tab> = {
    1: "backtest", 2: "hyperopt", 3: "freqai", 4: "ai_review", 5: "validation",
  };
  const handleNavigateToTab = (tabNum: number) => {
    const key = tabNumToKey[tabNum];
    if (key) {
      setActiveTab(key);
      setOpenOverlay(null);
    }
  };

  // Escape key handler for overlays
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openOverlay) setOpenOverlay(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openOverlay]);

  // Load experiment data
  useEffect(() => {
    getExperiments()
      .then((res) => {
        const items = res.items || [];
        const exp = items.find(
          (e) => e.strategy_name === strategyName || e.name?.includes(strategyName)
        );
        if (exp) {
          setExperimentId(exp.id);

          const types = new Set(exp.completed_run_types ?? []);
          const steps: Record<PipelineStepKey, StepState> = {
            backtest: types.has("backtest") ? "completed" : "pending",
            hyperopt: types.has("hyperopt") ? "completed" : "pending",
            freqai: types.has("freqai") ? "completed" : "pending",
            verify: types.has("oos_validation") || types.has("verification") ? "completed" : "pending",
            ai_review: types.has("ai_pre") || types.has("ai_post") ? "completed" : "pending",
            paper: "pending",
            live: "pending",
          };

          const completedCount = Object.values(steps).filter((s) => s === "completed").length;
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
      });
  }, [strategyName]);

  // Loading state
  if (!strategyData) {
    return (
      <AppShell title={`Experiments / ${strategyName}`}>
        <div className="flex items-center justify-center h-full bg-black">
          <div className="text-[11px] text-white/30 animate-pulse">Loading experiment data...</div>
        </div>
      </AppShell>
    );
  }

  // Tab definitions
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "backtest", label: "Backtest" },
    { key: "hyperopt", label: "Hyperopt" },
    { key: "freqai", label: "FreqAI" },
    { key: "ai_review", label: "AI Review" },
    { key: "validation", label: "Validation" },
  ];

  return (
    <AppShell title={`Experiments / ${strategyName}`}>
      <div className="h-full flex flex-col bg-black overflow-hidden">

        {/* ══ Strategy Header ══ */}
        <header className="h-14 bg-black l-b flex items-center px-5 gap-4 shrink-0">
          {/* LEFT */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => router.push("/experiments")}
              title="Back to Strategies"
              className="flex items-center gap-1.5 px-2.5 py-1 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <div className="h-5 w-px bg-white/10" />
            <FlaskConical className="w-4 h-4 text-white/40 shrink-0" />
            <span className="text-[13px] font-bold text-white truncate">
              {strategyData.name}
            </span>
            <span
              className={`px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded shrink-0 ${STATUS_BADGE[strategyData.status] ?? STATUS_BADGE.Draft}`}
            >
              {strategyData.status}
            </span>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setOpenOverlay("all_tests")}
              className="flex items-center gap-1.5 px-3 py-1.5 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors"
            >
              📋 All Tests <span className="text-white/30">({strategyData.testCount})</span>
            </button>
            <button
              onClick={() => setOpenOverlay("compare")}
              className="flex items-center gap-1.5 px-3 py-1.5 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors"
            >
              ⚖️ Compare
            </button>
            <button
              onClick={() => setOpenOverlay("analysis")}
              className="flex items-center gap-1.5 px-3 py-1.5 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors"
            >
              📊 Analysis
            </button>
            <div className="h-5 w-px bg-white/10 mx-1" />
            <button
              onClick={() => { setActiveTab("backtest"); setOpenOverlay(null); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black text-[11px] font-bold rounded hover:bg-white/85 transition-colors"
            >
              + New Test
            </button>
          </div>
        </header>

        {/* ══ Pipeline Tracker ══ */}
        <PipelineTracker data={strategyData} />

        {/* ══ Tab Bar ══ */}
        <div className="l-b flex items-end px-1 bg-black/50 shrink-0 overflow-x-auto gap-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`h-9 px-3.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap exp-nav border-b-2 transition-colors ${
                  isActive
                    ? "border-up text-white"
                    : "border-transparent text-muted hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ══ Tab Content ══ */}
        <div className="flex-1 p-4 overflow-hidden relative">
          {activeTab === "backtest" && <BacktestTab />}
          {activeTab === "hyperopt" && <HyperoptTab strategy={strategyName} botId={2} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}
          {activeTab === "freqai" && <FreqAITab strategy={strategyName} botId={2} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}
          {activeTab === "ai_review" && <AiReviewTab strategy={strategyName} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}
          {activeTab === "validation" && <ValidationTab strategy={strategyName} experimentId={experimentId} onNavigateToTab={handleNavigateToTab} />}

          {/* ══ Overlays ══ */}
          {openOverlay && (
            <div className="absolute inset-0 bg-surface z-30 flex flex-col">
              {/* Overlay Header */}
              <div className="h-10 bg-black l-b flex items-center px-4 gap-3 shrink-0">
                <span className="exp-overlay-title text-[12px] font-bold text-white uppercase tracking-wider">
                  {openOverlay === "all_tests" && "All Tests"}
                  {openOverlay === "compare" && "Compare"}
                  {openOverlay === "analysis" && "Analysis"}
                </span>
                <span className="flex-1" />
                <button
                  onClick={() => setOpenOverlay(null)}
                  className="px-3 py-1 l-bd bg-white/[0.03] hover:bg-white/[0.06] text-muted text-[11px] rounded transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {/* Overlay Content */}
              <div className="flex-1 p-4 overflow-y-auto">
                {openOverlay === "all_tests" && (
                  <AllTestsOverlay
                    strategy={strategyName}
                    experimentId={experimentId}
                    onClose={() => setOpenOverlay(null)}
                    onNavigateToTab={handleNavigateToTab}
                    onOpenOverlay={(o) => setOpenOverlay(o as Overlay)}
                  />
                )}
                {openOverlay === "compare" && (
                  <CompareOverlay
                    strategy={strategyName}
                    experimentId={experimentId}
                    onClose={() => setOpenOverlay(null)}
                    onNavigateToTab={handleNavigateToTab}
                  />
                )}
                {openOverlay === "analysis" && (
                  <AnalysisOverlay
                    strategy={strategyName}
                    experimentId={experimentId}
                    onClose={() => setOpenOverlay(null)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
