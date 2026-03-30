"use client";

import { useState, useMemo } from "react";
import {
  LOSS_FUNCTIONS,
  SAMPLERS,
  SPACE_PRESETS,
  ALL_SPACES,
  fmtDateTime,
  fmtPct,
  profitColor,
} from "@/lib/experiments";
import Tooltip from "@/components/ui/Tooltip";

interface HyperoptTabProps {
  strategy: string;
}

// ── Mock Data Generation ──────────────────────────────────────────────────

function generateMockResults() {
  const results = [];
  const presets = SPACE_PRESETS;
  const losses = LOSS_FUNCTIONS;
  const samplers = SAMPLERS;

  let resultId = 1;

  // Generate results
  for (let p = 0; p < Math.min(presets.length, 4); p++) {
    for (let l = 0; l < Math.min(losses.length, 12); l++) {
      for (let s = 0; s < Math.min(samplers.length, 6); s++) {
        const baseProfit = Math.random() * 30 - 5;
        const baseSharpe = Math.random() * 2;
        const baseSortino = baseSharpe * (1 + Math.random() * 0.3);

        results.push({
          id: resultId++,
          preset: presets[p].label,
          sampler: samplers[s].label,
          lossFunction: losses[l].label,
          epochs: presets[p].epochs,
          started: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
          finished: new Date(Date.now() - Math.random() * 86400000 * 20).toISOString(),
          duration: `${Math.floor(Math.random() * 45) + 5}m ${Math.floor(Math.random() * 60)}s`,
          trades: Math.floor(Math.random() * 150) + 10,
          winRate: Math.random() * 70 + 25,
          profit: baseProfit,
          maxDD: -(Math.random() * 15 + 2),
          sharpe: baseSharpe,
          sortino: baseSortino,
          isBest: resultId === 2,
          optimizedParams: {
            buy_bb_offset: { prev: 0.95, new: 0.98, range: "0.8-1.2" },
            buy_rsi: { prev: 30, new: 28, range: "20-40" },
            sell_bb_offset: { prev: 1.05, new: 1.02, range: "0.8-1.2" },
            stoploss: { prev: "-0.05", new: "-0.04", range: "-0.1 to -0.01" },
            roi_p1: { prev: 0.1, new: 0.15, range: "0.05-0.5" },
            trailing_stop_positive: { prev: "0.005", new: "0.008", range: "0.0-0.02" },
          },
        });

        if (results.length >= 20) break;
      }
      if (results.length >= 20) break;
    }
    if (results.length >= 20) break;
  }

  return results;
}

// ── Winner Banner ─────────────────────────────────────────────────────

function WinnerBanner() {
  return (
    <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] rounded-[10px] px-5 py-4 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-2xl flex-shrink-0">🏆</div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-green">
            Best: Signals Only · CmaEs · SortinoDaily
          </div>
          <div className="text-[11px] text-text-2 mt-1">Winner of 288 optimization runs</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-bg-2 rounded-[6px] border border-border p-3">
          <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-1">
            Profit
          </div>
          <div className="text-[18px] font-bold text-green">+15.2%</div>
        </div>
        <div className="bg-bg-2 rounded-[6px] border border-border p-3">
          <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-1">
            Sharpe Ratio
          </div>
          <div className="text-[18px] font-bold text-text-0">1.52</div>
        </div>
        <div className="bg-bg-2 rounded-[6px] border border-border p-3">
          <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-1">
            Max Drawdown
          </div>
          <div className="text-[18px] font-bold text-red">-8.4%</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-[6px] text-[12px] font-medium cursor-pointer bg-green border border-green text-white hover:bg-opacity-90 transition-all">
          ★ Promote
        </button>
        <button className="inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-[6px] text-[12px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3">
          → Verify
        </button>
      </div>
    </div>
  );
}

// ── Optimized Parameters Table ────────────────────────────────────────

function OptimizedParametersCard({
  params,
}: {
  params: Record<
    string,
    { prev: number | string; new: number | string; range: string }
  >;
}) {
  return (
    <div className="bg-bg-1 border border-border rounded-[10px] p-4 mb-6">
      <div className="text-[13px] font-semibold text-text-0 mb-4 flex items-center gap-2">
        🎯 Optimized Parameters
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                Parameter
              </th>
              <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                Previous
              </th>
              <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                New
              </th>
              <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                Range
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(params).map(([key, val]) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-2 px-[10px] text-text-1 font-mono text-[11px]">{key}</td>
                <td className="py-2 px-[10px] text-right text-text-2 text-[11px]">{val.prev}</td>
                <td className="py-2 px-[10px] text-right font-bold text-green text-[11px]">{val.new}</td>
                <td className="py-2 px-[10px] text-right text-text-3 text-[11px]">{val.range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Winner Cumulative Profit Chart ────────────────────────────────────

function ProfitChart() {
  const days = 90;
  const points: [number, number][] = [];
  let cumProfit = 0;

  for (let i = 0; i < days; i++) {
    cumProfit += (Math.random() - 0.35) * 0.3;
    points.push([i, cumProfit]);
  }

  const maxProfit = Math.max(...points.map((p) => p[1]));
  const minProfit = Math.min(...points.map((p) => p[1]));
  const range = maxProfit - minProfit || 1;

  const width = 600;
  const height = 200;
  const padding = 40;

  const scaleX = (x: number) => (x / (days - 1)) * (width - padding * 2) + padding;
  const scaleY = (y: number) => height - padding - ((y - minProfit) / range) * (height - padding * 2);

  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p[0])} ${scaleY(p[1])}`)
    .join(" ");

  const fillPath = `${pathData} L ${scaleX(days - 1)} ${height - padding} L ${scaleX(0)} ${height - padding} Z`;

  return (
    <div className="bg-bg-1 border border-border rounded-[10px] p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-[13px] font-semibold text-text-0">Winner: Cumulative Profit</div>
      </div>

      <svg width={width} height={height} className="w-full h-auto">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((y) => (
          <line
            key={`grid-${y}`}
            x1={padding}
            y1={height - padding - y * (height - padding * 2)}
            x2={width - padding}
            y2={height - padding - y * (height - padding * 2)}
            stroke="#1e1e30"
            strokeWidth="1"
          />
        ))}

        {/* Gradient fill */}
        <defs>
          <linearGradient id="profitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#profitGradient)" />

        {/* Line */}
        <path d={pathData} stroke="#22c55e" strokeWidth="2" fill="none" />

        {/* Axes */}
        <line x1={padding} y1={height - padding} x2={width} y2={height - padding} stroke="#1e1e30" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height} stroke="#1e1e30" strokeWidth="1" />

        {/* Y-axis labels */}
        {[0, 0.5, 1].map((y) => (
          <text
            key={`label-${y}`}
            x={padding - 10}
            y={height - padding - y * (height - padding * 2) + 4}
            textAnchor="end"
            fontSize="10"
            fill="#808098"
          >
            {((y * range + minProfit) * 100).toFixed(0)}%
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Per-Trade Profit Distribution ──────────────────────────────────────

function PerTradeProfitBars() {
  const trades = Array.from({ length: 30 }, () => (Math.random() - 0.3) * 5);
  const maxAbs = Math.max(...trades.map(Math.abs));

  const width = 600;
  const height = 150;
  const padding = 30;
  const barWidth = (width - padding * 2) / trades.length;

  return (
    <div className="bg-bg-1 border border-border rounded-[10px] p-4 mb-6">
      <div className="text-[13px] font-semibold text-text-0 mb-4">Per-Trade Profit Distribution</div>

      <svg width={width} height={height} className="w-full h-auto">
        {/* Axis */}
        <line x1={padding} y1={height - padding} x2={width} y2={height - padding} stroke="#1e1e30" strokeWidth="1" />

        {/* Bars */}
        {trades.map((profit, i) => {
          const barHeight = (Math.abs(profit) / maxAbs) * (height - padding * 2);
          const y = height - padding - barHeight;
          const color = profit >= 0 ? "#22c55e" : "#ef4444";

          return (
            <rect
              key={i}
              x={padding + i * barWidth + barWidth * 0.1}
              y={y}
              width={barWidth * 0.8}
              height={barHeight}
              fill={color}
              opacity="0.7"
            />
          );
        })}

        {/* Y-axis label */}
        <text x={padding - 10} y={height - padding + 4} textAnchor="end" fontSize="10" fill="#808098">
          0%
        </text>
      </svg>
    </div>
  );
}

// ── Results Table ──────────────────────────────────────────────────────

function ResultsTable({
  results,
}: {
  results: ReturnType<typeof generateMockResults>;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string>("profit");
  const [sortDesc, setSortDesc] = useState(true);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      let aVal = a[sortKey as keyof typeof a];
      let bVal = b[sortKey as keyof typeof b];

      if (typeof aVal === "string") return 0;
      if (aVal == null) aVal = 0;
      if (bVal == null) bVal = 0;

      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [results, sortKey, sortDesc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  return (
    <div className="bg-bg-1 border border-border rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-bg-2 border-b border-border">
            <tr>
              <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap">
                Test Name
              </th>
              <th
                className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("sampler")}
              >
                Sampler
              </th>
              <th
                className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("lossFunction")}
              >
                Loss Fn
              </th>
              <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap">
                Spaces
              </th>
              <th
                className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("epochs")}
              >
                Epochs
              </th>
              <th className="py-2 px-[10px] text-center text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap">
                Started
              </th>
              <th className="py-2 px-[10px] text-center text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap">
                Finished
              </th>
              <th className="py-2 px-[10px] text-center text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap">
                Duration
              </th>
              <th
                className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("trades")}
              >
                Trades
              </th>
              <th
                className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("winRate")}
              >
                Win%
              </th>
              <th
                className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("profit")}
              >
                Profit%
              </th>
              <th
                className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("maxDD")}
              >
                Max DD
              </th>
              <th
                className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("sharpe")}
              >
                Sharpe
              </th>
              <th
                className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap cursor-pointer hover:text-text-1"
                onClick={() => handleSort("sortino")}
              >
                Sortino
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result) => (
              <tr
                key={result.id}
                className={`border-b border-border/50 hover:bg-[rgba(99,102,241,0.03)] transition-colors cursor-pointer ${
                  result.isBest ? "bg-[rgba(99,102,241,0.12)]" : ""
                }`}
                onClick={() => setExpanded(expanded === result.id ? null : result.id)}
              >
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 whitespace-nowrap">
                  {result.isBest && <span className="text-accent mr-1">★</span>}
                  {result.preset}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 whitespace-nowrap">
                  {result.sampler}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 whitespace-nowrap">
                  {result.lossFunction}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-2 whitespace-nowrap">
                  2-4
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-right text-text-2 whitespace-nowrap">
                  {result.epochs}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-center text-text-2 whitespace-nowrap">
                  {fmtDateTime(result.started).split(" ")[1]}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-center text-text-2 whitespace-nowrap">
                  {fmtDateTime(result.finished).split(" ")[1]}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-center text-text-2 whitespace-nowrap">
                  {result.duration}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-right text-text-2 whitespace-nowrap">
                  {result.trades}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-right text-text-2 whitespace-nowrap">
                  {fmtPct(result.winRate)}
                </td>
                <td
                  className={`py-2 px-[10px] border-b border-border/50 text-[11px] text-right font-semibold whitespace-nowrap ${profitColor(
                    result.profit
                  )}`}
                >
                  {fmtPct(result.profit)}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-right text-red whitespace-nowrap">
                  {fmtPct(result.maxDD)}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-right text-text-2 whitespace-nowrap">
                  {result.sharpe.toFixed(2)}
                </td>
                <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-right text-text-2 whitespace-nowrap">
                  {result.sortino.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function HyperoptTab({ strategy }: HyperoptTabProps) {
  const [testName, setTestName] = useState("BollingerBreak hyperopt v2");
  const [description, setDescription] = useState("");
  const [epochs, setEpochs] = useState(100);
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>(["buy", "sell", "roi", "stoploss"]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["signals", "signals_risk", "signals_trailing", "full"]);
  const [activeLosses, setActiveLosses] = useState<string[]>(LOSS_FUNCTIONS.map((l) => l.value));
  const [minTrades, setMinTrades] = useState(10);
  const [maxTrades, setMaxTrades] = useState(999);
  const [randomState, setRandomState] = useState(42);
  const [jobs, setJobs] = useState(-1);
  const [effort, setEffort] = useState(1.0);
  const [earlyStop, setEarlyStop] = useState(false);

  const mockResults = useMemo(() => generateMockResults(), []);

  const toggleSpace = (space: string) => {
    setSelectedSpaces((prev) =>
      prev.includes(space) ? prev.filter((s) => s !== space) : [...prev, space]
    );
  };

  const togglePreset = (preset: string) => {
    setSelectedPresets((prev) =>
      prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset]
    );
  };

  const toggleLoss = (loss: string) => {
    setActiveLosses((prev) =>
      prev.includes(loss) ? prev.filter((l) => l !== loss) : [...prev, loss]
    );
  };

  const selectedPresetCount = SPACE_PRESETS.filter((p) =>
    selectedPresets.includes(p.key)
  ).length;
  const totalRuns = selectedPresetCount * activeLosses.length * SAMPLERS.length;
  const estimatedHours = Math.ceil(totalRuns / 120); // Very rough estimate

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5 min-h-screen bg-bg-0 p-6">
      {/* LEFT PANEL — FORM */}
      <div className="space-y-6">
        {/* Panel: Optimization Config */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[13px] font-semibold text-text-0 mb-4 flex items-center gap-2">
            ⚙️ Optimization Config
          </div>

          {/* Test Name */}
          <div className="mb-4">
            <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
              Test Name
            </label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              placeholder="My optimization run"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              placeholder="e.g., Full parameter sweep"
            />
          </div>

          {/* Strategy (readonly) */}
          <div className="mb-4">
            <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
              Strategy
            </label>
            <input
              type="text"
              value={strategy}
              readOnly
              className="w-full py-2 px-3 bg-bg-2 border border-border rounded-[6px] text-[12.5px] text-text-2 opacity-70"
            />
          </div>

          {/* Epochs + Start Date */}
          <div className="grid grid-cols-2 gap-[10px] mb-4">
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Epochs
              </label>
              <input
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="mb-4">
            <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
            />
          </div>

          {/* Optimization Spaces */}
          <div>
            <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
              Optimization Spaces
            </label>
            <div className="flex flex-wrap gap-[6px]">
              {ALL_SPACES.map((space) => (
                <Tooltip key={space.value} content={space.tip}>
                  <button
                    onClick={() => toggleSpace(space.value)}
                    className={`inline-flex items-center gap-1 px-3 py-[5px] rounded-[6px] text-[11px] cursor-pointer border transition-all ${
                      selectedSpaces.includes(space.value)
                        ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                        : "bg-bg-2 border-border text-text-2"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSpaces.includes(space.value)}
                      readOnly
                      style={{ margin: "0" }}
                      className="w-4 h-4"
                    />
                    {space.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>

        {/* Presets Buttons */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-3 block">
            Presets
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            {SPACE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => togglePreset(preset.key)}
                className={`inline-flex items-center gap-[6px] py-[6px] px-[14px] rounded-[6px] text-[12px] font-medium cursor-pointer border transition-all ${
                  selectedPresets.includes(preset.key)
                    ? "bg-accent border-accent text-white hover:bg-[#5558e6]"
                    : "border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Info Box */}
          <div className="bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] rounded-[6px] px-3 py-2 text-[12px] text-accent mb-4">
            <span>ℹ️</span> Full Matrix: {selectedPresetCount || 4} preset{selectedPresetCount !== 1 ? "s" : ""} × {activeLosses.length} loss × {SAMPLERS.length} sampler = {totalRuns} runs. CCX63: ~{estimatedHours}-{estimatedHours + 2} hours.
          </div>

          {/* Batch Builder — 2x2 Grid */}
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-2 block">
            Batch Presets
            <span className="font-normal text-text-3 text-[10px]"> (active presets)</span>
          </label>
          <div className="grid grid-cols-2 gap-[6px] mb-3">
            {selectedPresets.length === 0 ? (
              <div className="col-span-2 text-[10px] text-text-3 py-2">No presets selected</div>
            ) : (
              SPACE_PRESETS.map(
                (preset) =>
                  selectedPresets.includes(preset.key) && (
                    <div
                      key={preset.key}
                      className="bg-bg-3 border border-accent rounded-[6px] p-[8px_10px] relative"
                    >
                      <div className="text-[11px] font-semibold text-text-0">
                        {SPACE_PRESETS.findIndex((p) => p.key === preset.key) + 1}. {preset.label}
                      </div>
                      <div className="text-[9px] text-text-3 mt-[2px]">{preset.desc} · {preset.epochs} epochs</div>
                      <div className="text-[9px] text-accent mt-[2px]">72 runs</div>
                      <span
                        className="absolute top-1 right-[6px] text-[9px] cursor-pointer text-text-3 hover:text-text-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePreset(preset.key);
                        }}
                      >
                        ✕
                      </span>
                    </div>
                  )
              )
            )}
          </div>
          <div className="text-[10px] text-text-3 text-right">
            Total: {totalRuns} runs · Est: {estimatedHours}-{estimatedHours + 2} hours on CCX63
          </div>
        </div>

        {/* Loss Functions */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-3 block">
            Loss Functions ({activeLosses.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {LOSS_FUNCTIONS.map((loss) => (
              <Tooltip key={loss.value} content={loss.tip}>
                <button
                  onClick={() => toggleLoss(loss.value)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium cursor-pointer border transition-all ${
                    activeLosses.includes(loss.value)
                      ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                      : "bg-bg-2 border-border text-text-2 hover:text-text-1"
                  }`}
                >
                  {loss.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Samplers (Non-removable) */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-3 block">
            Samplers (Non-Removable)
          </label>
          <div className="flex flex-wrap gap-2">
            {SAMPLERS.map((sampler) => (
              <Tooltip key={sampler.value} content={sampler.tip}>
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] text-accent">
                  {sampler.label}
                </div>
              </Tooltip>
            ))}
          </div>
          <div className="text-[10px] text-text-3 mt-2">All samplers are always tested in the full matrix.</div>
        </div>

        {/* Advanced Options */}
        <details open className="border border-border rounded-[6px]">
          <summary className="px-3 py-3 cursor-pointer text-[12px] font-medium color-text-1 hover:bg-bg-2 flex items-center justify-between">
            ⚡ Advanced Options
            <span className="text-[10px]">▸</span>
          </summary>
          <div className="px-4 py-4 space-y-4 border-t border-border">
            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Min Trades
              </label>
              <input
                type="number"
                value={minTrades}
                onChange={(e) => setMinTrades(Number(e.target.value))}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Max Trades
              </label>
              <input
                type="number"
                value={maxTrades}
                onChange={(e) => setMaxTrades(Number(e.target.value))}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Random State (Seed)
              </label>
              <input
                type="number"
                value={randomState}
                onChange={(e) => setRandomState(Number(e.target.value))}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent"
                placeholder="Leave empty for random"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px] block">
                Jobs (Parallel)
              </label>
              <select
                value={jobs}
                onChange={(e) => setJobs(Number(e.target.value))}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-[6px] text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              >
                <option value={-1}>-1 (All CPUs)</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
                <option value={16}>16</option>
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-2 flex items-center justify-between block">
                Effort (Quality vs Speed)
                <span className="text-[11.5px] font-normal">{effort.toFixed(2)}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={effort}
                onChange={(e) => setEffort(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-2 flex items-center gap-2 block">
                <Tooltip content="Stop optimization if no improvement found">
                  Early Stop
                </Tooltip>
              </label>
              <label className="relative inline-flex items-center w-9 h-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={earlyStop}
                  onChange={(e) => setEarlyStop(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-bg-3 border border-border rounded-full peer peer-checked:bg-[rgba(34,197,94,0.08)] peer-checked:border-green transition-all" />
                <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
              </label>
            </div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button className="w-full inline-flex items-center justify-center gap-[6px] py-[6px] px-[14px] rounded-[6px] text-[12px] font-medium cursor-pointer bg-accent border border-accent text-white hover:bg-[#5558e6]">
            ⚡ Run Batch
          </button>
          <button className="w-full inline-flex items-center justify-center gap-[6px] py-[6px] px-[14px] rounded-[6px] text-[12px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3">
            ▶️ Run Single
          </button>
          <button className="w-full inline-flex items-center justify-center gap-[6px] py-[6px] px-[14px] rounded-[6px] text-[12px] font-medium cursor-pointer bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-red hover:bg-[rgba(239,68,68,0.15)]">
            ⏹️ Stop All
          </button>
        </div>
      </div>

      {/* RIGHT PANEL — RESULTS */}
      <div className="space-y-6">
        {/* Panel: Optimization Results */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[13px] font-semibold text-text-0 mb-4 flex items-center gap-2">
            📊 Optimization Results
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-semibold text-text-1">Hyperopt Batch Progress</span>
              <span className="text-[10px] text-text-3">288/288 completed</span>
            </div>
            <div className="w-full h-2 bg-bg-3 rounded-[4px] overflow-hidden">
              <div className="h-full bg-accent rounded-[4px] w-full transition-all" />
            </div>
            <div className="text-[10px] text-text-2 mt-1">100% complete</div>
          </div>

          {/* Winner Banner */}
          <WinnerBanner />

          {/* Optimized Parameters Card */}
          <OptimizedParametersCard
            params={{
              buy_bb_offset: { prev: 0.95, new: 0.98, range: "0.5-1.5" },
              buy_rsi: { prev: 30, new: 28, range: "10-50" },
              sell_bb_offset: { prev: 1.05, new: 1.02, range: "0.5-1.5" },
              stoploss: { prev: "-0.10", new: "-0.08", range: "-0.50 to -0.01" },
              roi_p1: { prev: 0.05, new: 0.07, range: "0.01-0.50" },
            }}
          />

          {/* Charts */}
          <ProfitChart />
          <PerTradeProfitBars />

          {/* Results Table */}
          <div>
            <div className="text-[13px] font-semibold text-text-0 mb-4">All Results (Ranked)</div>
            <ResultsTable results={mockResults} />
          </div>
        </div>
      </div>
    </div>
  );
}
