"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import { PIPELINE_STEPS, type PipelineStepKey, type StepState } from "@/lib/experiments";

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

// ── Mock data for demo ───────────────────────────────────────────────────
function getMockStrategyData(strategyName: string) {
  return {
    name: strategyName,
    status: "Paper" as const,
    paperDayStarted: "2026-03-18",
    paperDayElapsed: 12,
    paperDayTotal: 30,
    backtest: { completedAt: "2026-03-15T14:30:00Z" } as const,
    hyperopt: { completedAt: "2026-03-15T18:45:00Z" } as const,
    freqai: { completedAt: null, skipped: true } as const,
    verify: { completedAt: "2026-03-16T08:30:00Z" } as const,
    ai_review: { completedAt: null, skipped: true } as const,
    paper: { startedAt: "2026-03-18T10:00:00Z" } as const,
    live: { completedAt: null } as const,
  };
}

// ── Helper: Determine step state ────────────────────────────────────────
function getStepState(
  stepKey: PipelineStepKey,
  data: ReturnType<typeof getMockStrategyData>
): StepState {
  const stepData = data[stepKey as keyof typeof data];

  if (typeof stepData !== "object" || !stepData) return "pending";

  // Check if skipped
  if ("skipped" in stepData && stepData.skipped) return "skipped";

  // Check if active (started but not completed)
  if ("startedAt" in stepData && stepData.startedAt && !("completedAt" in stepData && stepData.completedAt)) {
    return "active";
  }

  // Check if completed
  if ("completedAt" in stepData && stepData.completedAt) return "completed";

  return "pending";
}

// ══════════════════════════════════════════════════════════════════════════
// PIPELINE TRACKER COMPONENT
// ══════════════════════════════════════════════════════════════════════════

interface PipelineTrackerProps {
  strategyData: ReturnType<typeof getMockStrategyData>;
}

function PipelineTracker({ strategyData }: PipelineTrackerProps) {
  const steps = PIPELINE_STEPS;
  const totalWidth = 100; // percent
  const spacing = totalWidth / (steps.length - 1); // percent between circles

  return (
    <div className="w-full">
      <div className="relative h-20 flex items-center justify-between px-0">
        {/* SVG connecting lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          {steps.map((step, idx) => {
            if (idx === steps.length - 1) return null; // no line after last step

            const step1 = steps[idx];
            const state1 = getStepState(step1.key, strategyData);
            const isOptional = "optional" in step1 && step1.optional;

            // Line color based on state of first step
            let lineColor = "rgb(88, 86, 111)"; // text-2 (pending)
            if (state1 === "completed") lineColor = "rgb(34, 197, 94)"; // green (completed)
            else if (state1 === "active") lineColor = "rgb(139, 92, 246)"; // accent (active)
            else if (state1 === "skipped") lineColor = "rgb(107, 114, 128)"; // gray (skipped)

            const x1 = (spacing * idx + 12); // center of first circle
            const x2 = (spacing * (idx + 1) + 12); // center of second circle

            if (isOptional) {
              // Dashed line for optional steps
              return (
                <line
                  key={`line-${idx}`}
                  x1={`${x1}%`}
                  y1="50%"
                  x2={`${x2}%`}
                  y2="50%"
                  stroke={lineColor}
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
              );
            } else {
              // Solid line for required steps
              return (
                <line
                  key={`line-${idx}`}
                  x1={`${x1}%`}
                  y1="50%"
                  x2={`${x2}%`}
                  y2="50%"
                  stroke={lineColor}
                  strokeWidth="2"
                />
              );
            }
          })}
        </svg>

        {/* Circles and labels */}
        <div className="absolute inset-0 flex items-center justify-between px-0">
          {steps.map((step, idx) => {
            const state = getStepState(step.key, strategyData);
            let bgColor = "bg-bg-2 border-border"; // pending
            let dotColor = "bg-text-2";
            let isAnimated = false;

            if (state === "completed") {
              bgColor = "bg-green border-green";
              dotColor = "bg-green";
            } else if (state === "active") {
              bgColor = "bg-bg-2 border-accent";
              dotColor = "bg-accent";
              isAnimated = true;
            } else if (state === "skipped") {
              bgColor = "bg-bg-2 border-text-2";
              dotColor = "bg-text-3";
            }

            return (
              <div key={step.key} className="flex flex-col items-center gap-2" style={{ zIndex: steps.length - idx }}>
                {/* Circle with optional pulse animation */}
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${bgColor} ${
                    isAnimated ? "animate-pulse" : ""
                  }`}
                >
                  {state === "completed" && (
                    <svg className="w-4 h-4 text-bg-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {state === "active" && <div className={`w-2 h-2 rounded-full ${dotColor}`} />}
                  {state === "skipped" && (
                    <svg className="w-4 h-4 text-text-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Label */}
                <div className="text-center">
                  <p className="text-xs font-semibold text-text-1">{step.label}</p>
                  {"optional" in step && step.optional && (
                    <p className="text-2xs text-text-2">(optional)</p>
                  )}
                  {state === "active" && strategyData.paper.startedAt && (
                    <p className="text-2xs text-accent font-semibold">
                      Day {strategyData.paperDayElapsed}/{strategyData.paperDayTotal}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
  const toast = useToast();

  const strategyName = (params?.strategy as string) || "Unknown";
  const strategyData = getMockStrategyData(strategyName);

  const [activeTab, setActiveTab] = useState<Tab>("backtest");
  const [openOverlay, setOpenOverlay] = useState<Overlay>(null);

  // Tab definitions
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "backtest", label: "Backtest" },
    { key: "hyperopt", label: "Hyperopt" },
    { key: "freqai", label: "FreqAI" },
    { key: "ai_review", label: "Naš AI" },
    { key: "validation", label: "Validation" },
  ];

  // Render the active tab component
  const renderTabContent = () => {
    switch (activeTab) {
      case "backtest":
        return <BacktestTab strategy={strategyName} />;
      case "hyperopt":
        return <HyperoptTab strategy={strategyName} />;
      case "freqai":
        return <FreqAITab strategy={strategyName} />;
      case "ai_review":
        return <AiReviewTab strategy={strategyName} />;
      case "validation":
        return <ValidationTab strategy={strategyName} />;
      default:
        return null;
    }
  };

  // Render overlay if open
  const renderOverlay = () => {
    if (!openOverlay) return null;

    return (
      <div className="fixed inset-0 bg-bg-0 z-50 flex flex-col">
        {/* Overlay header with close button */}
        <div className="border-b border-border px-8 py-4 flex items-center justify-between bg-bg-1">
          <h2 className="text-base font-semibold text-text-0">
            {openOverlay === "all_tests" && "All Tests"}
            {openOverlay === "compare" && "Compare Runs"}
            {openOverlay === "analysis" && "Analysis"}
          </h2>
          <button
            onClick={() => setOpenOverlay(null)}
            className="text-text-2 hover:text-text-1 transition-colors"
            aria-label="Close overlay"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Overlay content */}
        <div className="flex-1 overflow-y-auto p-8">
          {openOverlay === "all_tests" && <AllTestsOverlay strategy={strategyName} onClose={() => setOpenOverlay(null)} />}
          {openOverlay === "compare" && <CompareOverlay strategy={strategyName} onClose={() => setOpenOverlay(null)} />}
          {openOverlay === "analysis" && <AnalysisOverlay strategy={strategyName} onClose={() => setOpenOverlay(null)} />}
        </div>
      </div>
    );
  };

  return (
    <AppShell title={`Experiments / ${strategyName}`}>
      <div className="space-y-6">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-sm text-text-2 hover:text-accent transition-colors"
              aria-label="Go back to experiments list"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              <span>Back</span>
            </button>

            {/* Strategy name and status */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-0">{strategyName}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                strategyData.status === "Paper"
                  ? "bg-amber/20 text-amber"
                  : strategyData.status === "Live"
                  ? "bg-green/20 text-green"
                  : "bg-accent/20 text-accent"
              }`}>
                {strategyData.status}
              </span>
            </div>
          </div>

          {/* Header action button */}
          <button
            onClick={() => toast.info("New test creation coming soon")}
            className="px-4 py-2 bg-accent text-bg-0 text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors"
          >
            New Test
          </button>
        </div>

        {/* ── Pipeline Tracker ──────────────────────────────────────────── */}
        <div className="bg-bg-1 border border-border rounded-lg p-8">
          <PipelineTracker strategyData={strategyData} />
        </div>

        {/* ── Helper Buttons (All Tests, Compare, Analysis) ────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpenOverlay("all_tests")}
            className="flex items-center gap-2 px-4 py-2 bg-bg-2 border border-border text-text-1 text-sm font-semibold rounded-lg hover:bg-bg-3 transition-colors"
          >
            <span>📋</span>
            <span>All Tests (416)</span>
          </button>

          <button
            onClick={() => setOpenOverlay("compare")}
            className="flex items-center gap-2 px-4 py-2 bg-bg-2 border border-border text-text-1 text-sm font-semibold rounded-lg hover:bg-bg-3 transition-colors"
          >
            <span>⚖️</span>
            <span>Compare</span>
          </button>

          <button
            onClick={() => setOpenOverlay("analysis")}
            className="flex items-center gap-2 px-4 py-2 bg-bg-2 border border-border text-text-1 text-sm font-semibold rounded-lg hover:bg-bg-3 transition-colors"
          >
            <span>📊</span>
            <span>Analysis</span>
          </button>
        </div>

        {/* ── Tab Bar ────────────────────────────────────────────────────── */}
        <div className="border-b border-border">
          <div className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-accent text-accent"
                    : "border-transparent text-text-2 hover:text-text-1"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ────────────────────────────────────────────────── */}
        <div className="min-h-96">
          {renderTabContent()}
        </div>
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      {renderOverlay()}
    </AppShell>
  );
}
