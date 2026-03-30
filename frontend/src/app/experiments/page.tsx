"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { useToast } from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import {
  fmtDateTime,
  fmtPct,
  fmtNum,
  PIPELINE_STEPS,
  type StrategyTestStatus,
  type StepState,
} from "@/lib/experiments";

// ── Mock data: 5 strategies with varied pipeline states ─────────────────────

const MOCK_EXPERIMENTS = [
  {
    id: 1,
    strategyName: "BollingerBreak",
    status: "Paper" as StrategyTestStatus,
    testCount: 416,
    lastTestType: "backtest",
    lastTestDate: new Date(Date.now() - 86400000 * 12).toISOString(), // 12 days ago
    bestProfit: 15.2,
    maxDD: -8.4,
    sharpe: 1.52,
    pipelineSteps: {
      backtest: "completed" as StepState,
      hyperopt: "completed" as StepState,
      freqai: "skipped" as StepState,
      verify: "completed" as StepState,
      ai_review: "skipped" as StepState,
      paper: "active" as StepState,
      live: "pending" as StepState,
    },
  },
  {
    id: 2,
    strategyName: "SampleStrategy",
    status: "Testing" as StrategyTestStatus,
    testCount: 1,
    lastTestType: "backtest",
    lastTestDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    bestProfit: 8.5,
    maxDD: -12.3,
    sharpe: 0.92,
    pipelineSteps: {
      backtest: "completed" as StepState,
      hyperopt: "pending" as StepState,
      freqai: "pending" as StepState,
      verify: "pending" as StepState,
      ai_review: "pending" as StepState,
      paper: "pending" as StepState,
      live: "pending" as StepState,
    },
  },
  {
    id: 3,
    strategyName: "Diamond",
    status: "Testing" as StrategyTestStatus,
    testCount: 289,
    lastTestType: "freqai",
    lastTestDate: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    bestProfit: 12.1,
    maxDD: -7.8,
    sharpe: 1.38,
    pipelineSteps: {
      backtest: "completed" as StepState,
      hyperopt: "completed" as StepState,
      freqai: "active" as StepState,
      verify: "pending" as StepState,
      ai_review: "pending" as StepState,
      paper: "pending" as StepState,
      live: "pending" as StepState,
    },
  },
  {
    id: 4,
    strategyName: "RSIMomentum",
    status: "Live" as StrategyTestStatus,
    testCount: 416,
    lastTestType: "backtest",
    lastTestDate: new Date(Date.now() - 86400000 * 25).toISOString(), // 25 days ago
    bestProfit: 11.8,
    maxDD: -6.2,
    sharpe: 1.38,
    pipelineSteps: {
      backtest: "completed" as StepState,
      hyperopt: "completed" as StepState,
      freqai: "completed" as StepState,
      verify: "completed" as StepState,
      ai_review: "skipped" as StepState,
      paper: "completed" as StepState,
      live: "completed" as StepState,
    },
  },
  {
    id: 5,
    strategyName: "EMAScalper",
    status: "Draft" as StrategyTestStatus,
    testCount: 0,
    lastTestType: null,
    lastTestDate: null,
    bestProfit: null,
    maxDD: null,
    sharpe: null,
    pipelineSteps: {
      backtest: "pending" as StepState,
      hyperopt: "pending" as StepState,
      freqai: "pending" as StepState,
      verify: "pending" as StepState,
      ai_review: "pending" as StepState,
      paper: "pending" as StepState,
      live: "pending" as StepState,
    },
  },
];

// ── Status badge styling ──────────────────────────────────────────────────

function getStatusBadgeClass(status: StrategyTestStatus): string {
  switch (status) {
    case "Draft":
      return "bg-bg-3 text-text-2";
    case "Testing":
      return "bg-accent/20 text-accent";
    case "Optimized":
      return "bg-purple/20 text-purple";
    case "Paper":
      return "bg-amber/20 text-amber";
    case "Live":
      return "bg-green/20 text-green";
    default:
      return "bg-bg-3 text-text-2";
  }
}

// ── Pipeline step visualization ───────────────────────────────────────────

interface PipelineVisualizerProps {
  steps: Record<string, StepState>;
}

function PipelineVisualizer({ steps }: PipelineVisualizerProps) {
  return (
    <div className="flex items-center gap-2">
      {PIPELINE_STEPS.map((step) => {
        const state = steps[step.key];
        let icon = "○";
        let color = "text-text-3";
        let className = "";

        if (state === "completed") {
          icon = "✓";
          color = "text-green";
        } else if (state === "active") {
          icon = "●";
          color = "text-accent";
          className = "animate-pulse";
        } else if (state === "pending") {
          icon = "○";
          color = "text-text-3";
        } else if (state === "skipped") {
          icon = "⊘";
          color = "text-text-3 opacity-40";
        }

        return (
          <Tooltip
            key={step.key}
            content={`${step.label}${"optional" in step && step.optional ? " (optional)" : ""}`}
            position="bottom"
          >
            <span className={`text-sm font-medium ${color} ${className}`}>
              {icon}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Search & Filter Controls ──────────────────────────────────────────────

interface SearchFilterBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

function SearchFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
}: SearchFilterBarProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* Search input */}
      <div className="flex-1 max-w-sm">
        <input
          type="text"
          placeholder="Search strategies..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 bg-bg-2 border border-border rounded-btn text-sm text-text-0 placeholder-text-3 focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="px-3 py-2 bg-bg-2 border border-border rounded-btn text-sm text-text-0 focus:outline-none focus:border-accent transition-colors cursor-pointer"
      >
        <option value="">All Statuses</option>
        <option value="Draft">Draft</option>
        <option value="Testing">Testing</option>
        <option value="Optimized">Optimized</option>
        <option value="Paper">Paper</option>
        <option value="Live">Live</option>
      </select>

      {/* Sort dropdown */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="px-3 py-2 bg-bg-2 border border-border rounded-btn text-sm text-text-0 focus:outline-none focus:border-accent transition-colors cursor-pointer"
      >
        <option value="name">Name</option>
        <option value="status">Status</option>
        <option value="tests">Test Count</option>
        <option value="profit">Best Profit</option>
        <option value="lastTest">Last Test</option>
        <option value="sharpe">Sharpe Ratio</option>
      </select>
    </div>
  );
}

// ── Strategy Row ──────────────────────────────────────────────────────────

interface StrategyRowProps {
  experiment: typeof MOCK_EXPERIMENTS[0];
}

function StrategyRow({ experiment }: StrategyRowProps) {
  const _router = useRouter();

  return (
    <tr
      className="border-b border-border last:border-b-0 hover:bg-bg-2 transition-colors cursor-pointer group"
      onClick={() => _router.push(`/experiments/${encodeURIComponent(experiment.strategyName)}`)}
    >
        {/* Strategy Name */}
        <td className="px-4 py-3 text-sm text-text-0 font-medium group-hover:text-accent transition-colors">
          {experiment.strategyName}
        </td>

        {/* Status Badge */}
        <td className="px-4 py-3">
          <span
            className={`inline-block px-2.5 py-1 rounded-btn text-xs font-semibold ${getStatusBadgeClass(experiment.status)}`}
          >
            {experiment.status}
          </span>
        </td>

        {/* Number of Tests */}
        <td className="px-4 py-3 text-sm text-text-1">
          <Tooltip content="Total number of tests run for this strategy">
            {experiment.testCount}
          </Tooltip>
        </td>

        {/* Last Test */}
        <td className="px-4 py-3 text-sm text-text-1">
          {experiment.lastTestDate ? (
            <Tooltip
              content={`Type: ${experiment.lastTestType}`}
              position="bottom"
            >
              {fmtDateTime(experiment.lastTestDate)}
            </Tooltip>
          ) : (
            <span className="text-text-3">—</span>
          )}
        </td>

        {/* Best Profit% */}
        <td className="px-4 py-3 text-sm font-medium">
          {experiment.bestProfit !== null ? (
            <Tooltip content="Best profit percentage across all tests">
              <span
                className={
                  experiment.bestProfit >= 0
                    ? "text-green"
                    : "text-red"
                }
              >
                {fmtPct(experiment.bestProfit)}
              </span>
            </Tooltip>
          ) : (
            <span className="text-text-3">—</span>
          )}
        </td>

        {/* Max DD */}
        <td className="px-4 py-3 text-sm font-medium">
          {experiment.maxDD !== null ? (
            <Tooltip content="Maximum drawdown across all tests">
              <span className="text-red">
                {fmtPct(experiment.maxDD)}
              </span>
            </Tooltip>
          ) : (
            <span className="text-text-3">—</span>
          )}
        </td>

        {/* Sharpe Ratio */}
        <td className="px-4 py-3 text-sm text-text-1">
          {experiment.sharpe !== null ? (
            <Tooltip content="Sharpe ratio: risk-adjusted returns (higher is better)">
              {fmtNum(experiment.sharpe, 2)}
            </Tooltip>
          ) : (
            <span className="text-text-3">—</span>
          )}
        </td>

        {/* Pipeline Progress */}
        <td className="px-4 py-3">
          <PipelineVisualizer steps={experiment.pipelineSteps} />
        </td>
      </tr>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────

export default function ExperimentsPage() {
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");

  // Filter and sort experiments
  const filteredAndSorted = useMemo(() => {
    let result = MOCK_EXPERIMENTS.slice();

    // Search by strategy name
    if (searchTerm) {
      result = result.filter((exp) =>
        exp.strategyName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter) {
      result = result.filter((exp) => exp.status === statusFilter);
    }

    // Sort
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.strategyName.localeCompare(b.strategyName));
        break;
      case "status":
        result.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "tests":
        result.sort((a, b) => b.testCount - a.testCount);
        break;
      case "profit":
        result.sort((a, b) => {
          const aProfit = a.bestProfit ?? -Infinity;
          const bProfit = b.bestProfit ?? -Infinity;
          return bProfit - aProfit;
        });
        break;
      case "lastTest":
        result.sort((a, b) => {
          const aDate = a.lastTestDate ? new Date(a.lastTestDate).getTime() : 0;
          const bDate = b.lastTestDate ? new Date(b.lastTestDate).getTime() : 0;
          return bDate - aDate;
        });
        break;
      case "sharpe":
        result.sort((a, b) => {
          const aSharpe = a.sharpe ?? -Infinity;
          const bSharpe = b.sharpe ?? -Infinity;
          return bSharpe - aSharpe;
        });
        break;
      default:
        break;
    }

    return result;
  }, [searchTerm, statusFilter, sortBy]);

  const handleNewExperiment = useCallback(() => {
    // In real implementation, this would create a new draft experiment
    toast.success("New experiment created (mock)");
  }, [toast]);

  return (
    <AppShell title="Experiments">
      <div className="space-y-6">
        {/* Header with title and new button */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-0">Experiments</h1>
          <button
            onClick={handleNewExperiment}
            className="px-4 py-2 bg-accent hover:bg-accent-dim text-white text-sm font-semibold rounded-btn transition-colors"
          >
            New Experiment
          </button>
        </div>

        {/* Search, Filter, Sort Controls */}
        <SearchFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Strategy Table */}
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-12 text-text-2">
            <p>No strategies found</p>
          </div>
        ) : (
          <div className="bg-bg-1 border border-border rounded-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-2">
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    Strategy Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    <Tooltip content="Current phase of strategy development">
                      Status
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    <Tooltip content="Total tests run (Hyperopt + FreqAI)">
                      # Tests
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    <Tooltip content="Date and time of last test execution">
                      Last Test
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    <Tooltip content="Highest profit% achieved in any test">
                      Best Profit%
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    <Tooltip content="Largest loss% across all tests">
                      Max DD
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    <Tooltip content="Sharpe ratio: return / volatility">
                      Sharpe
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-1">
                    <Tooltip content="Pipeline: Backtest → Hyperopt → FreqAI → Verify → AI Review → Paper → Live">
                      Pipeline
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((exp) => (
                  <StrategyRow key={exp.id} experiment={exp} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        {filteredAndSorted.length > 0 && (
          <div className="text-xs text-text-2 text-center">
            Showing {filteredAndSorted.length} of {MOCK_EXPERIMENTS.length}{" "}
            strategies. Click any row to view details.
          </div>
        )}
      </div>
    </AppShell>
  );
}
