"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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

// ── Status badge classes (matches prototype .badge-*) ────────────────────
function statusBadgeClass(status: string): string {
  switch (status) {
    case "Draft": return "bg-bg-3 text-text-2";
    case "Testing": return "bg-amber/10 text-amber border border-amber/25";
    case "Optimized": return "bg-accent/10 text-accent border border-accent/30";
    case "Paper": return "bg-purple/10 text-purple border border-purple/25";
    case "Live": return "bg-green/10 text-green border border-green/25";
    default: return "bg-bg-3 text-text-2";
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PIPELINE TRACKER — matches prototype .pipeline exactly
// ══════════════════════════════════════════════════════════════════════════

function PipelineTracker({ data }: { data: StrategyDataProps }) {
  return (
    <div className="flex items-center gap-0 px-6 py-4 bg-bg-1 border-b border-border">
      {PIPELINE_STEPS.map((step, idx) => {
        const state = data.steps[step.key] ?? "pending";
        const isOptional = "optional" in step && step.optional;

        // Step circle + label classes (matches .pipeline-step.done/.active/.skipped)
        let circleClass = "w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-[10px] flex-shrink-0";
        let labelClass = "text-[11px] whitespace-nowrap";

        if (state === "completed") {
          circleClass += " bg-green border-green text-white";
          labelClass += " text-green";
        } else if (state === "active") {
          circleClass += " bg-accent border-accent text-white animate-pulse";
          labelClass += " text-accent font-semibold";
        } else if (state === "skipped") {
          circleClass += " border-dashed border-text-3";
          labelClass += " text-text-3 opacity-50";
        } else {
          circleClass += " border-border";
          labelClass += " text-text-3";
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
                  <span className="text-[10px] text-text-3 ml-1">
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

  useEffect(() => {
    getExperiments()
      .then((res) => {
        const items = res.items || [];
        const exp = items.find(
          (e) => e.strategy_name === strategyName || e.name === strategyName
        );
        if (exp) {
          setStrategyData({
            name: exp.strategy_name || exp.name || strategyName,
            status: "Testing",
            paperDayElapsed: 12,
            paperDayTotal: 30,
            testCount: exp.run_count || 0,
            steps: {
              backtest: "completed",
              hyperopt: "completed",
              freqai: "skipped",
              verify: "completed",
              ai_review: "skipped",
              paper: "active",
              live: "pending",
            },
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
        <header className="h-14 bg-bg-1 border-b border-border flex items-center px-6 gap-4 flex-shrink-0 overflow-hidden">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => router.push("/experiments")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border bg-bg-2 hover:bg-bg-3 text-[11px] text-text-1 rounded-btn transition-all flex-shrink-0"
            >
              ← Back
            </button>
            <span className="text-base font-semibold text-text-0 truncate">
              {strategyData.name}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${statusBadgeClass(strategyData.status)}`}>
              {strategyData.status}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Helper buttons (matches prototype .helper-btns) */}
            <button
              onClick={() => setOpenOverlay("all_tests")}
              className="px-3 py-1.5 border border-border bg-bg-2 hover:bg-bg-3 hover:border-border-hover text-[11px] text-text-2 rounded-btn transition-all flex items-center gap-1.5"
            >
              📋 All Tests <span className="text-[10px] opacity-60">({strategyData.testCount})</span>
            </button>
            <button
              onClick={() => setOpenOverlay("compare")}
              className="px-3 py-1.5 border border-border bg-bg-2 hover:bg-bg-3 hover:border-border-hover text-[11px] text-text-2 rounded-btn transition-all flex items-center gap-1.5"
            >
              ⚖️ Compare
            </button>
            <button
              onClick={() => setOpenOverlay("analysis")}
              className="px-3 py-1.5 border border-border bg-bg-2 hover:bg-bg-3 hover:border-border-hover text-[11px] text-text-2 rounded-btn transition-all flex items-center gap-1.5"
            >
              📊 Analysis
            </button>
            <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:bg-[#5558e6] text-white text-[11px] font-medium rounded-btn transition-colors">
              + New Test
            </button>
          </div>
        </header>

        {/* ── Pipeline Tracker ── */}
        <PipelineTracker data={strategyData} />

        {/* ── Tab Bar (matches prototype .tabs with .tab-number) ── */}
        <div className="flex border-b border-border px-6 bg-bg-1 flex-shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-[11.5px] font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? "text-accent border-accent font-semibold"
                    : "text-text-3 border-transparent hover:text-text-1"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[10px] mr-1.5 ${
                    isActive ? "bg-accent text-white" : "bg-bg-3 text-text-3"
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
          {activeTab === "backtest" && <BacktestTab strategy={strategyName} />}
          {activeTab === "hyperopt" && <HyperoptTab strategy={strategyName} />}
          {activeTab === "freqai" && <FreqAITab strategy={strategyName} />}
          {activeTab === "ai_review" && <AiReviewTab strategy={strategyName} />}
          {activeTab === "validation" && <ValidationTab strategy={strategyName} />}
        </div>
      </div>

      {/* ── Overlays (matches prototype .overlay) ── */}
      {openOverlay && (
        <div className="fixed inset-0 bg-[rgba(6,6,11,0.92)] z-[100] flex flex-col">
          <div className="h-14 bg-bg-1 border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
            <span className="text-base font-semibold text-text-0 flex-1">
              {openOverlay === "all_tests" && `📋 All Tests — ${strategyName}`}
              {openOverlay === "compare" && "⚖️ Compare Tests"}
              {openOverlay === "analysis" && "📊 Analysis — §30 Deep Dive"}
            </span>
            <button
              onClick={() => setOpenOverlay(null)}
              className="bg-transparent border-none text-text-2 text-xl cursor-pointer p-2 rounded-btn hover:bg-bg-3 hover:text-text-0 transition-all"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {openOverlay === "all_tests" && <AllTestsOverlay strategy={strategyName} onClose={() => setOpenOverlay(null)} />}
            {openOverlay === "compare" && <CompareOverlay strategy={strategyName} onClose={() => setOpenOverlay(null)} />}
            {openOverlay === "analysis" && <AnalysisOverlay strategy={strategyName} onClose={() => setOpenOverlay(null)} />}
          </div>
        </div>
      )}
    </AppShell>
  );
}
