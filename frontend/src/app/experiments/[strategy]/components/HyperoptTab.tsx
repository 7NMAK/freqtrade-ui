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

  // Generate one result per combination (simplified for display)
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
          isBest: resultId === 3, // Mark one as best
          optimizedParams: {
            buy_bb_offset: { prev: 0.95, new: 0.98, range: "0.8-1.2" },
            buy_rsi: { prev: 30, new: 28, range: "20-40" },
            sell_bb_offset: { prev: 1.05, new: 1.02, range: "0.8-1.2" },
            stoploss: { prev: -0.05, new: -0.04, range: "-0.1 to -0.01" },
            roi_p1: { prev: 0.1, new: 0.15, range: "0.05-0.5" },
            trailing_stop_positive: { prev: 0.005, new: 0.008, range: "0.0-0.02" },
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

// ── Space Checkbox Card ───────────────────────────────────────────────────

function SpaceCheckbox({
  space,
  checked,
  onChange,
}: {
  space: (typeof ALL_SPACES)[number];
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <Tooltip content={space.tip}>
      <label className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-bg-2 transition-colors">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-accent"
        />
        <span className="text-sm text-text-1">{space.label}</span>
      </label>
    </Tooltip>
  );
}

// ── Batch Preset Card ─────────────────────────────────────────────────────

function BatchPresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: (typeof SPACE_PRESETS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const runCount = LOSS_FUNCTIONS.length * SAMPLERS.length; // 72 runs per preset

  return (
    <button
      onClick={onSelect}
      className={`p-3 rounded border transition-all text-left ${
        selected
          ? "border-accent bg-bg-3"
          : "border-border bg-bg-2 hover:border-text-3"
      }`}
    >
      <div className="font-semibold text-xs text-text-0">{preset.label}</div>
      <div className="text-2xs text-text-3 mt-1">{preset.desc}</div>
      <div className="text-2xs text-accent mt-2">{runCount} runs</div>
      <div className="text-2xs text-text-2 mt-1">Epochs: {preset.epochs}</div>
    </button>
  );
}

// ── Loss Function Chip ────────────────────────────────────────────────────

function LossFunctionChip({
  loss,
  active,
  onToggle,
}: {
  loss: (typeof LOSS_FUNCTIONS)[number];
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip content={loss.tip}>
      <button
        onClick={onToggle}
        className={`px-2 py-1 rounded text-2xs font-medium transition-all ${
          active
            ? "bg-accent text-bg-0 border border-accent"
            : "bg-bg-2 text-text-2 border border-border"
        }`}
      >
        {loss.label}
      </button>
    </Tooltip>
  );
}

// ── Sampler Chip (non-toggleable) ─────────────────────────────────────────

function SamplerChip({ sampler }: { sampler: (typeof SAMPLERS)[number] }) {
  return (
    <Tooltip content={sampler.tip}>
      <div className="px-2 py-1 rounded text-2xs font-medium bg-accent text-bg-0 border border-accent">
        {sampler.label}
      </div>
    </Tooltip>
  );
}

// ── Winner Banner ─────────────────────────────────────────────────────────

function WinnerBanner() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-green/30 bg-gradient-to-r from-green/10 to-transparent p-4 mb-6">
      <div className="absolute inset-0 bg-gradient-to-r from-green/5 to-transparent opacity-50" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">🏆</div>
          <div>
            <div className="font-semibold text-text-0">
              Best: Signals Only · CmaEs · SortinoDaily
            </div>
            <div className="text-xs text-text-2 mt-1">Winner of 288 optimization runs</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-bg-2 rounded border border-border p-3">
            <div className="text-xs text-text-3 mb-1">Profit</div>
            <div className="font-bold text-green text-sm">+15.2%</div>
          </div>
          <div className="bg-bg-2 rounded border border-border p-3">
            <div className="text-xs text-text-3 mb-1">Sharpe Ratio</div>
            <div className="font-bold text-text-0 text-sm">1.52</div>
          </div>
          <div className="bg-bg-2 rounded border border-border p-3">
            <div className="text-xs text-text-3 mb-1">Max Drawdown</div>
            <div className="font-bold text-red text-sm">-8.4%</div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="px-4 py-2 rounded text-sm font-medium bg-accent text-bg-0 hover:bg-opacity-90 transition-all">
            ★ Promote
          </button>
          <button className="px-4 py-2 rounded text-sm font-medium border border-accent text-accent hover:bg-accent/10 transition-all">
            → Verify
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Optimized Parameters Card ─────────────────────────────────────────────

function OptimizedParametersCard({
  params,
}: {
  params: Record<
    string,
    { prev: number | string; new: number | string; range: string }
  >;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-2 p-4 mb-6">
      <h3 className="text-sm font-semibold text-text-0 mb-4">Optimized Parameters</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-text-3 font-medium">Parameter</th>
              <th className="text-right py-2 px-2 text-text-3 font-medium">Previous</th>
              <th className="text-right py-2 px-2 text-text-3 font-medium">New</th>
              <th className="text-right py-2 px-2 text-text-3 font-medium">Range</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(params).map(([key, val]) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-3 px-2 text-text-1 font-mono">{key}</td>
                <td className="text-right py-3 px-2 text-text-2">{val.prev}</td>
                <td className="text-right py-3 px-2 font-bold text-green">{val.new}</td>
                <td className="text-right py-3 px-2 text-text-3">{val.range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Profit Chart (SVG) ────────────────────────────────────────────────────

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
    <div className="rounded-lg border border-border bg-bg-2 p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-text-0">Winner Cumulative Profit</h3>
        <div className="flex gap-2">
          {["Day", "Week", "Month"].map((label) => (
            <button
              key={label}
              className="px-2 py-1 rounded text-2xs border border-border text-text-2 hover:text-text-1 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
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
            fill="#80808"
          >
            {((y * range + minProfit) * 100).toFixed(0)}%
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Per-Trade Profit Bars ─────────────────────────────────────────────────

function PerTradeProfitBars() {
  const trades = Array.from({ length: 30 }, () => (Math.random() - 0.3) * 5);
  const maxAbs = Math.max(...trades.map(Math.abs));

  const width = 600;
  const height = 150;
  const padding = 30;
  const barWidth = (width - padding * 2) / trades.length;

  return (
    <div className="rounded-lg border border-border bg-bg-2 p-4 mb-6">
      <h3 className="text-sm font-semibold text-text-0 mb-4">Per-Trade Profit Distribution</h3>

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

// ── Results Table with Expandable Rows ────────────────────────────────────

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
    <div className="rounded-lg border border-border bg-bg-2 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead className="bg-bg-3 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-text-3">#</th>
              <th className="px-3 py-2 text-left font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("preset")}>
                Preset
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("sampler")}>
                Sampler
              </th>
              <th className="px-3 py-2 text-left font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("lossFunction")}>
                Loss Function
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("epochs")}>
                Epochs
              </th>
              <th className="px-3 py-2 text-center font-medium text-text-3">Started</th>
              <th className="px-3 py-2 text-center font-medium text-text-3">Finished</th>
              <th className="px-3 py-2 text-center font-medium text-text-3">Duration</th>
              <th className="px-3 py-2 text-right font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("trades")}>
                Trades
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("winRate")}>
                Win%
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("profit")}>
                Profit%
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("maxDD")}>
                Max DD
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("sharpe")}>
                Sharpe
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-3 cursor-pointer hover:text-text-1" onClick={() => handleSort("sortino")}>
                Sortino
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, idx) => (
              <div key={result.id}>
                <tr className="border-b border-border/50 hover:bg-bg-3 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === result.id ? null : result.id)}>
                  <td className="px-3 py-3 text-text-2">
                    {result.isBest && <span className="text-accent mr-1">★</span>}
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 text-text-1">{result.preset}</td>
                  <td className="px-3 py-3 text-text-1">{result.sampler}</td>
                  <td className="px-3 py-3 text-text-1">{result.lossFunction}</td>
                  <td className="px-3 py-3 text-right text-text-2">{result.epochs}</td>
                  <td className="px-3 py-3 text-center text-text-2">{fmtDateTime(result.started).split(" ")[1]}</td>
                  <td className="px-3 py-3 text-center text-text-2">{fmtDateTime(result.finished).split(" ")[1]}</td>
                  <td className="px-3 py-3 text-center text-text-2">{result.duration}</td>
                  <td className="px-3 py-3 text-right text-text-2">{result.trades}</td>
                  <td className="px-3 py-3 text-right text-text-2">{fmtPct(result.winRate)}</td>
                  <td className={`px-3 py-3 text-right font-semibold ${profitColor(result.profit)}`}>
                    {fmtPct(result.profit)}
                  </td>
                  <td className="px-3 py-3 text-right text-red">{fmtPct(result.maxDD)}</td>
                  <td className="px-3 py-3 text-right text-text-2">{result.sharpe.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right text-text-2">{result.sortino.toFixed(2)}</td>
                </tr>

                {/* Expanded Row */}
                {expanded === result.id && (
                  <tr className="border-b border-border/50 bg-bg-3">
                    <td colSpan={14} className="px-4 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Optimized Parameters */}
                        <div>
                          <h4 className="text-xs font-semibold text-text-0 mb-3">Optimized Parameters</h4>
                          <div className="space-y-2">
                            {Object.entries(result.optimizedParams).map(([key, val]) => (
                              <div key={key} className="text-2xs">
                                <div className="text-text-3">{key}</div>
                                <div className="flex justify-between">
                                  <span className="text-text-2">{val.prev}</span>
                                  <span className="text-green font-bold">{val.new}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Performance Summary */}
                        <div>
                          <h4 className="text-xs font-semibold text-text-0 mb-3">Performance Summary</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-bg-2 rounded border border-border p-3">
                              <div className="text-2xs text-text-3 mb-1">Total Profit</div>
                              <div className={`font-bold text-sm ${profitColor(result.profit)}`}>
                                {fmtPct(result.profit)}
                              </div>
                            </div>
                            <div className="bg-bg-2 rounded border border-border p-3">
                              <div className="text-2xs text-text-3 mb-1">Sharpe</div>
                              <div className="font-bold text-sm text-text-0">{result.sharpe.toFixed(3)}</div>
                            </div>
                            <div className="bg-bg-2 rounded border border-border p-3">
                              <div className="text-2xs text-text-3 mb-1">Win Rate</div>
                              <div className="font-bold text-sm text-text-0">{fmtPct(result.winRate)}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4">
                        <button className="px-3 py-2 rounded text-2xs font-medium bg-accent text-bg-0 hover:bg-opacity-90 transition-all">
                          Promote
                        </button>
                        <button className="px-3 py-2 rounded text-2xs font-medium border border-accent text-accent hover:bg-accent/10 transition-all">
                          Verify
                        </button>
                        <button className="px-3 py-2 rounded text-2xs font-medium border border-border text-text-2 hover:text-text-1 transition-all">
                          Analysis
                        </button>
                        <button className="px-3 py-2 rounded text-2xs font-medium border border-border text-text-2 hover:text-text-1 transition-all">
                          Compare
                        </button>
                        <button className="px-3 py-2 rounded text-2xs font-medium border border-border text-text-2 hover:text-text-1 transition-all">
                          Copy Params
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </div>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-bg-3">
        <div className="text-2xs text-text-3">
          Showing 1-20 of {results.length * 4} (estimated 288 total)
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded text-2xs border border-border text-text-2 hover:text-text-1 transition-all">
            Prev
          </button>
          <button className="px-3 py-1 rounded text-2xs border border-border text-text-2 hover:text-text-1 transition-all">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function HyperoptTab({ strategy }: HyperoptTabProps) {
  const [testName, setTestName] = useState("Optimization Run 1");
  const [description, setDescription] = useState("");
  const [epochs, setEpochs] = useState(100);
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>(["buy", "sell"]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["signals"]);
  const [activeLosses, setActiveLosses] = useState<string[]>(LOSS_FUNCTIONS.map((l) => l.value));
  const [expandAdvanced, setExpandAdvanced] = useState(false);
  const [minTrades, setMinTrades] = useState(10);
  const [maxTrades, setMaxTrades] = useState(1000);
  const [randomState, setRandomState] = useState(42);
  const [jobs, setJobs] = useState(-1);
  const [effort, setEffort] = useState(1.0);
  const [earlyStop, setEarlyStop] = useState(20);

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

  return (
    <div className="flex gap-6 min-h-screen bg-bg-0 p-6">
      {/* LEFT PANEL — FORM */}
      <div className="w-[380px] space-y-6">
        {/* Basic Fields */}
        <div className="bg-bg-2 border border-border rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-1 mb-2">
              Test Name
            </label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 placeholder-text-3 focus:outline-none focus:border-accent"
              placeholder="My optimization run"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-1 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 placeholder-text-3 focus:outline-none focus:border-accent resize-none"
              rows={3}
              placeholder="Notes about this run..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-1 mb-2">
              Strategy
            </label>
            <div className="px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-2">
              {strategy} (readonly)
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-1 mb-2">
                Epochs
              </label>
              <input
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-1 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-1 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Spaces */}
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-text-1 mb-3">Spaces</h3>
          <div className="space-y-1">
            {ALL_SPACES.map((space) => (
              <SpaceCheckbox
                key={space.value}
                space={space}
                checked={selectedSpaces.includes(space.value)}
                onChange={() => toggleSpace(space.value)}
              />
            ))}
          </div>
        </div>

        {/* Batch Testing — Space Presets */}
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-text-1 mb-3">Batch Testing — Space Presets</h3>
          <div className="grid grid-cols-2 gap-2">
            {SPACE_PRESETS.map((preset) => (
              <BatchPresetCard
                key={preset.key}
                preset={preset}
                selected={selectedPresets.includes(preset.key)}
                onSelect={() => togglePreset(preset.key)}
              />
            ))}
          </div>

          <div className="mt-3 p-3 bg-bg-1 border border-border/50 rounded text-2xs text-text-2 space-y-1">
            <div className="font-semibold text-text-1">Full Matrix Info:</div>
            <div>
              {selectedPresetCount} preset{selectedPresetCount !== 1 ? "s" : ""} × {activeLosses.length} loss ×{" "}
              {SAMPLERS.length} sampler = {totalRuns} runs
            </div>
            <div className="text-text-3">CCX63: ~{Math.ceil(totalRuns / 16)}min</div>
          </div>
        </div>

        {/* Loss Functions */}
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-text-1 mb-3">Loss Functions ({activeLosses.length})</h3>
          <div className="flex flex-wrap gap-2">
            {LOSS_FUNCTIONS.map((loss) => (
              <LossFunctionChip
                key={loss.value}
                loss={loss}
                active={activeLosses.includes(loss.value)}
                onToggle={() => toggleLoss(loss.value)}
              />
            ))}
          </div>
        </div>

        {/* Samplers */}
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <h3 className="text-xs font-semibold text-text-1 mb-3">Samplers (All 6 — Always Active)</h3>
          <div className="flex flex-wrap gap-2">
            {SAMPLERS.map((sampler) => (
              <SamplerChip key={sampler.value} sampler={sampler} />
            ))}
          </div>
          <div className="mt-2 text-2xs text-text-3">All samplers are always tested in the full matrix.</div>
        </div>

        {/* Advanced Options */}
        <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandAdvanced(!expandAdvanced)}
            className="w-full px-4 py-3 text-left text-xs font-semibold text-text-1 hover:bg-bg-3 transition-colors flex justify-between items-center"
          >
            Advanced Options
            <span className={`transition-transform ${expandAdvanced ? "rotate-180" : ""}`}>⌄</span>
          </button>

          {expandAdvanced && (
            <div className="px-4 py-4 space-y-4 border-t border-border">
              <div>
                <label className="block text-xs font-semibold text-text-1 mb-2">
                  Min Trades
                </label>
                <input
                  type="number"
                  value={minTrades}
                  onChange={(e) => setMinTrades(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-1 mb-2">
                  Max Trades
                </label>
                <input
                  type="number"
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-1 mb-2">
                  Random State
                </label>
                <input
                  type="number"
                  value={randomState}
                  onChange={(e) => setRandomState(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-1 mb-2">
                  Jobs
                </label>
                <select
                  value={jobs}
                  onChange={(e) => setJobs(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
                >
                  <option value={-1}>All CPUs</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-1 mb-2">
                  Effort: {effort.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={effort}
                  onChange={(e) => setEffort(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-1 mb-2">
                  Early Stop Rounds
                </label>
                <input
                  type="number"
                  value={earlyStop}
                  onChange={(e) => setEarlyStop(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm text-text-0 focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button className="w-full px-4 py-3 rounded font-semibold text-sm bg-accent text-bg-0 hover:bg-opacity-90 transition-all">
            Run Batch ({totalRuns} runs)
          </button>
          <button className="w-full px-4 py-3 rounded font-semibold text-sm border border-accent text-accent hover:bg-accent/10 transition-all">
            Run Single ({selectedPresetCount === 0 ? "0" : "72"} runs)
          </button>
          <button className="w-full px-4 py-3 rounded font-semibold text-sm border border-red text-red hover:bg-red/10 transition-all">
            Stop All
          </button>
        </div>
      </div>

      {/* RIGHT PANEL — RESULTS */}
      <div className="flex-1 space-y-6">
        {/* Progress Bar */}
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-text-0">Hyperopt Batch Progress</h3>
            <span className="text-2xs text-text-3">288/288 completed</span>
          </div>
          <div className="w-full bg-bg-1 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-accent to-green h-full w-full transition-all" />
          </div>
        </div>

        {/* Winner Banner */}
        <WinnerBanner />

        {/* Optimized Parameters */}
        <OptimizedParametersCard
          params={{
            buy_bb_offset: { prev: 0.95, new: 0.98, range: "0.8-1.2" },
            buy_rsi: { prev: 30, new: 28, range: "20-40" },
            sell_bb_offset: { prev: 1.05, new: 1.02, range: "0.8-1.2" },
            stoploss: { prev: "-0.05", new: "-0.04", range: "-0.1 to -0.01" },
            roi_p1: { prev: 0.1, new: 0.15, range: "0.05-0.5" },
            trailing_stop_positive: { prev: "0.005", new: "0.008", range: "0.0-0.02" },
          }}
        />

        {/* Charts */}
        <ProfitChart />
        <PerTradeProfitBars />

        {/* Results Table */}
        <div>
          <h3 className="text-sm font-semibold text-text-0 mb-4">All Results (Ranked)</h3>
          <ResultsTable results={mockResults} />
        </div>
      </div>
    </div>
  );
}
