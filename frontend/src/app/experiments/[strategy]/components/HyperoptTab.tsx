"use client";

import { useState, useMemo } from "react";
import {
  LOSS_FUNCTIONS,
  SAMPLERS,
  SPACE_PRESETS,
  ALL_SPACES,
  fmtPct,
  profitColor,
} from "@/lib/experiments";
import Tooltip from "@/components/ui/Tooltip";

interface HyperoptTabProps {
  strategy: string;
}

// ── Design System ────────────────────────────────────────────────────────
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// ── Toggle switch ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-text-1">{label}</span>
      <label className="relative w-[36px] h-[20px] cursor-pointer inline-block flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`absolute inset-0 rounded-[10px] border transition-all ${checked ? "bg-[rgba(34,197,94,0.08)] border-green" : "bg-bg-3 border-border"}`} />
        <span className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
      </label>
    </div>
  );
}

// ── Mock Data Generation ──────────────────────────────────────────────────

function generateMockResults() {
  const results = [];
  const presets = SPACE_PRESETS;
  const losses = LOSS_FUNCTIONS;
  const samplers = SAMPLERS;

  let resultId = 1;

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
    <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] rounded-[10px] px-4 py-3 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-lg flex-shrink-0">🏆</div>
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-green">
            Best: Signals Only · CmaEs · SortinoDaily
          </div>
          <div className="text-[10px] text-text-2 mt-0.5">Winner of 288 optimization runs</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "Profit", value: "+15.2%", color: "text-green" },
          { label: "Sharpe Ratio", value: "1.52", color: "text-text-0" },
          { label: "Max Drawdown", value: "-8.4%", color: "text-red" },
        ].map((m) => (
          <div key={m.label} className="bg-bg-2 rounded-[6px] border border-border p-2">
            <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-0.5">{m.label}</div>
            <div className={`text-[16px] font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="inline-flex items-center gap-[6px] h-[30px] px-3 rounded-btn text-[11px] font-medium cursor-pointer bg-green border border-green text-white hover:bg-opacity-90 transition-all">
          ★ Promote
        </button>
        <button className="inline-flex items-center gap-[6px] h-[30px] px-3 rounded-btn text-[11px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3">
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
  params: Record<string, { prev: number | string; new: number | string; range: string }>;
}) {
  return (
    <div className="bg-bg-1 border border-border rounded-[10px] p-3 mb-4">
      <div className="text-[12px] font-semibold text-text-0 mb-3 flex items-center gap-2">
        🎯 Optimized Parameters
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border">
              {["Parameter", "Previous", "New", "Range"].map((h, i) => (
                <th key={h} className={`py-1.5 px-2 text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(params).map(([key, val]) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-1.5 px-2 text-text-1 font-mono text-[11px]">{key}</td>
                <td className="py-1.5 px-2 text-right text-text-2 text-[11px]">{val.prev}</td>
                <td className="py-1.5 px-2 text-right font-bold text-green text-[11px]">{val.new}</td>
                <td className="py-1.5 px-2 text-right text-text-3 text-[11px]">{val.range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Winner Cumulative Profit Chart (compact) ─────────────────────────

function ProfitChart() {
  const days = 90;
  const points: [number, number][] = [];
  let cumProfit = 0;
  for (let i = 0; i < days; i++) {
    cumProfit += (Math.random() - 0.35) * 0.3;
    points.push([i, cumProfit]);
  }

  const maxP = Math.max(...points.map((p) => p[1]));
  const minP = Math.min(...points.map((p) => p[1]));
  const range = maxP - minP || 1;
  const W = 600, H = 130, pad = 30;

  const sx = (x: number) => (x / (days - 1)) * (W - pad * 2) + pad;
  const sy = (y: number) => H - pad - ((y - minP) / range) * (H - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p[0])} ${sy(p[1])}`).join(" ");
  const fill = `${line} L ${sx(days - 1)} ${H - pad} L ${sx(0)} ${H - pad} Z`;

  return (
    <div className="bg-bg-1 border border-border rounded-[10px] p-3 mb-4">
      <div className="text-[12px] font-semibold text-text-0 mb-2">Winner: Cumulative Profit</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[130px]">
        {[0, 0.5, 1].map((y) => (
          <line key={y} x1={pad} y1={H - pad - y * (H - pad * 2)} x2={W - pad} y2={H - pad - y * (H - pad * 2)} stroke="#1e1e30" strokeWidth="1" />
        ))}
        <defs>
          <linearGradient id="hpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#hpGrad)" />
        <path d={line} stroke="#22c55e" strokeWidth="2" fill="none" />
        {[0, 0.5, 1].map((y) => (
          <text key={`l${y}`} x={pad - 6} y={H - pad - y * (H - pad * 2) + 3} textAnchor="end" fontSize="9" fill="#808098">
            {((y * range + minP) * 100).toFixed(0)}%
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Per-Trade Profit Distribution (compact) ──────────────────────────

function PerTradeProfitBars() {
  const trades = Array.from({ length: 30 }, () => (Math.random() - 0.3) * 5);
  const maxAbs = Math.max(...trades.map(Math.abs));
  const W = 600, H = 100, pad = 20;
  const bw = (W - pad * 2) / trades.length;

  return (
    <div className="bg-bg-1 border border-border rounded-[10px] p-3 mb-4">
      <div className="text-[12px] font-semibold text-text-0 mb-2">Per-Trade Profit Distribution</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[100px]">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#1e1e30" strokeWidth="1" />
        {trades.map((p, i) => {
          const h = (Math.abs(p) / maxAbs) * (H - pad * 2);
          return (
            <rect key={i} x={pad + i * bw + bw * 0.1} y={H - pad - h} width={bw * 0.8} height={h} fill={p >= 0 ? "#22c55e" : "#ef4444"} opacity="0.7" />
          );
        })}
      </svg>
    </div>
  );
}

// ── Results Table ──────────────────────────────────────────────────────

function ResultsTable({ results }: { results: ReturnType<typeof generateMockResults> }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string>("profit");
  const [sortDesc, setSortDesc] = useState(true);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a];
      const bVal = b[sortKey as keyof typeof b];
      if (typeof aVal === "string") return 0;
      if (aVal == null || bVal == null) return 0;
      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [results, sortKey, sortDesc]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const TH = ({ k, children, align = "right" }: { k?: string; children: React.ReactNode; align?: string }) => (
    <th
      className={`py-1.5 px-2 text-${align} text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold whitespace-nowrap ${k ? "cursor-pointer hover:text-text-1" : ""}`}
      onClick={k ? () => handleSort(k) : undefined}
    >
      {children} {k && sortKey === k && (sortDesc ? "↓" : "↑")}
    </th>
  );

  return (
    <div className="bg-bg-1 border border-border rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-bg-2 border-b border-border">
            <tr>
              <TH align="left">Test</TH>
              <TH k="sampler" align="left">Sampler</TH>
              <TH k="lossFunction" align="left">Loss Fn</TH>
              <TH align="left">Spaces</TH>
              <TH k="epochs">Epochs</TH>
              <TH>Duration</TH>
              <TH k="trades">Trades</TH>
              <TH k="winRate">Win%</TH>
              <TH k="profit">Profit%</TH>
              <TH k="maxDD">Max DD</TH>
              <TH k="sharpe">Sharpe</TH>
              <TH k="sortino">Sortino</TH>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-border/50 hover:bg-[rgba(99,102,241,0.03)] transition-colors cursor-pointer ${r.isBest ? "bg-[rgba(99,102,241,0.12)]" : ""}`}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <td className="py-1.5 px-2 text-[11px] text-text-1 whitespace-nowrap">
                  {r.isBest && <span className="text-accent mr-1">★</span>}
                  {r.preset}
                </td>
                <td className="py-1.5 px-2 text-[11px] text-text-1 whitespace-nowrap">{r.sampler}</td>
                <td className="py-1.5 px-2 text-[11px] text-text-1 whitespace-nowrap">{r.lossFunction}</td>
                <td className="py-1.5 px-2 text-[11px] text-text-2 whitespace-nowrap">2-4</td>
                <td className="py-1.5 px-2 text-[11px] text-right text-text-2 whitespace-nowrap">{r.epochs}</td>
                <td className="py-1.5 px-2 text-[11px] text-right text-text-2 whitespace-nowrap">{r.duration}</td>
                <td className="py-1.5 px-2 text-[11px] text-right text-text-2 whitespace-nowrap">{r.trades}</td>
                <td className="py-1.5 px-2 text-[11px] text-right text-text-2 whitespace-nowrap">{fmtPct(r.winRate)}</td>
                <td className={`py-1.5 px-2 text-[11px] text-right font-semibold whitespace-nowrap ${profitColor(r.profit)}`}>{fmtPct(r.profit)}</td>
                <td className="py-1.5 px-2 text-[11px] text-right text-red whitespace-nowrap">{fmtPct(r.maxDD)}</td>
                <td className="py-1.5 px-2 text-[11px] text-right text-text-2 whitespace-nowrap">{r.sharpe.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-[11px] text-right text-text-2 whitespace-nowrap">{r.sortino.toFixed(2)}</td>
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

  // Auto-description
  const autoDesc = useMemo(() => {
    const spaceStr = selectedSpaces.length === ALL_SPACES.length ? "all spaces" : selectedSpaces.join(", ");
    const presetStr = selectedPresets.length === SPACE_PRESETS.length ? "all presets" : `${selectedPresets.length} presets`;
    return `${strategy} · ${epochs} epochs · ${spaceStr} · ${presetStr} · ${activeLosses.length} loss fns · ${startDate} → ${endDate}`;
  }, [strategy, epochs, selectedSpaces, selectedPresets, activeLosses, startDate, endDate]);

  const toggleSpace = (space: string) => {
    setSelectedSpaces((prev) => prev.includes(space) ? prev.filter((s) => s !== space) : [...prev, space]);
  };
  const togglePreset = (preset: string) => {
    setSelectedPresets((prev) => prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset]);
  };
  const toggleLoss = (loss: string) => {
    setActiveLosses((prev) => prev.includes(loss) ? prev.filter((l) => l !== loss) : [...prev, loss]);
  };

  const selectedPresetCount = SPACE_PRESETS.filter((p) => selectedPresets.includes(p.key)).length;
  const totalRuns = selectedPresetCount * activeLosses.length * SAMPLERS.length;
  const estimatedHours = Math.ceil(totalRuns / 120);

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5">
      {/* LEFT PANEL — FORM */}
      <div className="space-y-4">
        {/* Optimization Config */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[12px] font-semibold text-text-0 mb-3 flex items-center gap-2">⚙️ Optimization Config</div>

          {/* Test Name */}
          <div className="mb-3">
            <label className={LABEL}>Test Name</label>
            <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className={INPUT} placeholder="My optimization run" />
          </div>

          {/* Auto Description */}
          <div className="mb-3">
            <label className={LABEL}>Description (auto)</label>
            <div className="w-full h-[34px] py-0 px-3 bg-bg-2 border border-border rounded-btn text-[11px] text-text-2 flex items-center truncate">
              {autoDesc}
            </div>
          </div>

          {/* Epochs + Dates */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className={LABEL}>Epochs</label>
              <input type="number" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* Optimization Spaces */}
          <div>
            <label className={LABEL}>Optimization Spaces</label>
            <div className="flex flex-wrap gap-[6px]">
              {ALL_SPACES.map((space) => (
                <Tooltip key={space.value} content={space.tip}>
                  <button
                    onClick={() => toggleSpace(space.value)}
                    className={`inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-btn text-[11px] cursor-pointer border transition-all ${
                      selectedSpaces.includes(space.value)
                        ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                        : "bg-bg-2 border-border text-text-2"
                    }`}
                  >
                    <input type="checkbox" checked={selectedSpaces.includes(space.value)} readOnly className="w-3 h-3 accent-accent" />
                    {space.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>Presets</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {SPACE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => togglePreset(preset.key)}
                className={`inline-flex items-center gap-[6px] h-[30px] px-3 rounded-btn text-[11px] font-medium cursor-pointer border transition-all ${
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
          <div className="bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] rounded-btn px-3 py-2 text-[11px] text-accent mb-3">
            ℹ️ Full Matrix: {selectedPresetCount || 4} preset{selectedPresetCount !== 1 ? "s" : ""} × {activeLosses.length} loss × {SAMPLERS.length} sampler = {totalRuns} runs. ~{estimatedHours}-{estimatedHours + 2}h
          </div>

          {/* Batch Builder — 2x2 Grid */}
          <label className={LABEL}>Batch Presets <span className="font-normal text-text-3">(active)</span></label>
          <div className="grid grid-cols-2 gap-[6px] mb-2">
            {selectedPresets.length === 0 ? (
              <div className="col-span-2 text-[10px] text-text-3 py-2">No presets selected</div>
            ) : (
              SPACE_PRESETS.map((preset) =>
                selectedPresets.includes(preset.key) && (
                  <div key={preset.key} className="bg-bg-3 border border-accent rounded-btn p-2 relative">
                    <div className="text-[11px] font-semibold text-text-0">
                      {SPACE_PRESETS.findIndex((p) => p.key === preset.key) + 1}. {preset.label}
                    </div>
                    <div className="text-[9px] text-text-3 mt-[2px]">{preset.desc} · {preset.epochs} ep</div>
                    <div className="text-[9px] text-accent mt-[2px]">72 runs</div>
                    <span
                      className="absolute top-1 right-[6px] text-[9px] cursor-pointer text-text-3 hover:text-text-1"
                      onClick={(e) => { e.stopPropagation(); togglePreset(preset.key); }}
                    >✕</span>
                  </div>
                )
              )
            )}
          </div>
          <div className="text-[10px] text-text-3 text-right">
            Total: {totalRuns} runs · Est: {estimatedHours}-{estimatedHours + 2}h
          </div>
        </div>

        {/* Loss Functions */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>Loss Functions ({activeLosses.length})</label>
          <div className="flex flex-wrap gap-[6px]">
            {LOSS_FUNCTIONS.map((loss) => (
              <Tooltip key={loss.value} content={loss.tip}>
                <button
                  onClick={() => toggleLoss(loss.value)}
                  className={`inline-flex items-center gap-1 h-[26px] px-2 rounded-btn text-[10px] font-medium cursor-pointer border transition-all ${
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

        {/* Samplers */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <label className={LABEL}>Samplers (always tested)</label>
          <div className="flex flex-wrap gap-[6px]">
            {SAMPLERS.map((sampler) => (
              <Tooltip key={sampler.value} content={sampler.tip}>
                <div className="inline-flex items-center gap-1 h-[26px] px-2 rounded-btn text-[10px] font-medium bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.3)] text-accent">
                  {sampler.label}
                </div>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Advanced Options — FLAT, no dropdown */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="text-[12px] font-semibold text-text-0 mb-3">⚡ Advanced Options</div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>Min Trades</label>
              <input type="number" value={minTrades} onChange={(e) => setMinTrades(Number(e.target.value))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Max Trades</label>
              <input type="number" value={maxTrades} onChange={(e) => setMaxTrades(Number(e.target.value))} className={INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className={LABEL}>Random State (Seed)</label>
              <input type="number" value={randomState} onChange={(e) => setRandomState(Number(e.target.value))} className={INPUT} placeholder="42" />
            </div>
            <div>
              <label className={LABEL}>Jobs (Parallel)</label>
              <select value={jobs} onChange={(e) => setJobs(Number(e.target.value))} className={SELECT}>
                <option value={-1}>-1 (All CPUs)</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
                <option value={16}>16</option>
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className={LABEL}>
              Effort (Quality vs Speed) <span className="text-text-1 font-normal ml-1">{effort.toFixed(2)}x</span>
            </label>
            <input type="range" min="0.5" max="2.0" step="0.1" value={effort} onChange={(e) => setEffort(Number(e.target.value))} className="w-full accent-accent" />
          </div>

          <Toggle checked={earlyStop} onChange={setEarlyStop} label="Early Stop (stop if no improvement)" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button className="flex-1 inline-flex items-center justify-center gap-[6px] h-[34px] rounded-btn text-[12px] font-medium cursor-pointer bg-accent border border-accent text-white hover:bg-[#5558e6] transition-all">
            ⚡ Run Batch
          </button>
          <button className="flex-1 inline-flex items-center justify-center gap-[6px] h-[34px] rounded-btn text-[12px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3 transition-all">
            ▶ Run Single
          </button>
          <button className="h-[34px] px-3 rounded-btn text-[12px] font-medium cursor-pointer bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-red hover:bg-[rgba(239,68,68,0.15)] transition-all">
            ⏹
          </button>
        </div>
      </div>

      {/* RIGHT PANEL — RESULTS */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="bg-bg-1 border border-border rounded-[10px] p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-semibold text-text-1">Hyperopt Batch Progress</span>
            <span className="text-[10px] text-text-3">288/288 completed</span>
          </div>
          <div className="w-full h-1.5 bg-bg-3 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full w-full transition-all" />
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
          <div className="text-[12px] font-semibold text-text-0 mb-3">All Results (Ranked)</div>
          <ResultsTable results={mockResults} />
        </div>
      </div>
    </div>
  );
}
