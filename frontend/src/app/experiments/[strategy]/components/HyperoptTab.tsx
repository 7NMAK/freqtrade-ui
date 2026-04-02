"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

// ── Local Toggle ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[#9CA3AF]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`builder-toggle ${checked ? "on" : ""}`}
      >
        <span className="dot" />
      </button>
    </div>
  );
}

// ── Local Pill ──────────────────────────────────────────────────────────
function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`builder-pill text-[10px] px-2.5 py-1.5 text-center ${selected ? "selected" : ""}`}
    >
      {label}
    </button>
  );
}

// ── Mock convergence data ───────────────────────────────────────────────
function generateConvergenceData() {
  const data: { epoch: number; bestObjective: number; trades: number }[] = [];
  let best = -0.02;
  for (let i = 0; i <= 200; i += 5) {
    const noise = Math.random() * 0.015;
    const candidate = best - noise * (1 - i / 300);
    if (candidate < best) best = candidate;
    data.push({
      epoch: i,
      bestObjective: parseFloat(best.toFixed(4)),
      trades: Math.floor(80 + Math.random() * 80),
    });
  }
  return data;
}

// ── Mock epoch results ──────────────────────────────────────────────────
const MOCK_EPOCHS = [
  { epoch: 147, trades: 142, avgProfit: 0.29, totalProfit: 42.12, profitAbs: 4212, avgDur: "4h 23m", winPct: 72.4, maxDD: -2.1, objective: -0.1555, isBest: true },
  { epoch: 142, trades: 138, avgProfit: 0.27, totalProfit: 38.40, profitAbs: 3840, avgDur: "4h 45m", winPct: 70.1, maxDD: -2.8, objective: -0.1623, isBest: false, isPrevBest: true },
  { epoch: 189, trades: 135, avgProfit: 0.22, totalProfit: 30.20, profitAbs: 3020, avgDur: "5h 12m", winPct: 68.5, maxDD: -3.1, objective: -0.1890, isBest: false },
  { epoch: 95, trades: 128, avgProfit: 0.19, totalProfit: 24.80, profitAbs: 2480, avgDur: "3h 52m", winPct: 66.2, maxDD: -3.4, objective: -0.2010, isBest: false },
  { epoch: 52, trades: 112, avgProfit: 0.14, totalProfit: 15.90, profitAbs: 1590, avgDur: "6h 11m", winPct: 62.8, maxDD: -4.5, objective: -0.2340, isBest: false },
  { epoch: 12, trades: 89, avgProfit: 0.08, totalProfit: 7.20, profitAbs: 720, avgDur: "7h 33m", winPct: 58.4, maxDD: -5.2, objective: -0.2810, isBest: false },
];

// ── Mock run history ────────────────────────────────────────────────────
const MOCK_HISTORY = [
  { id: 1, date: "2026-03-28 14:32", strategy: "AlphaTrend_V5", lossFn: "SharpeHyperOptLoss", epochs: 200, best: 147, profit: "+42.12%", trades: 142, objective: -0.1555 },
  { id: 2, date: "2026-03-25 09:15", strategy: "AlphaTrend_V5", lossFn: "SortinoHyperOptLoss", epochs: 150, best: 112, profit: "+35.80%", trades: 128, objective: -0.1823 },
  { id: 3, date: "2026-03-20 16:44", strategy: "AlphaTrend_V5", lossFn: "CalmarHyperOptLoss", epochs: 100, best: 78, profit: "+21.40%", trades: 89, objective: -0.2410 },
];

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
interface HyperoptTabProps {
  strategy?: string;
  botId?: number;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function HyperoptTab(_props: HyperoptTabProps) {
  // ── Left panel form state ─────────────────────────────────────────────
  const [strategy, setStrategy] = useState("AlphaTrend_V5");
  const [lossFn, setLossFn] = useState("Sharpe");
  const [sampler, setSampler] = useState("TPE");
  const [epochs, setEpochs] = useState("200");
  const [minTrades, setMinTrades] = useState("80");
  const [startDate, setStartDate] = useState("2022-01-01");
  const [endDate, setEndDate] = useState("2024-01-01");
  const [timeframe, setTimeframe] = useState("1h");
  const [jobs, setJobs] = useState("-1");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [stakeAmount, setStakeAmount] = useState("unlimited");
  const [fee, setFee] = useState("");
  const [randomState, setRandomState] = useState("42");
  const [earlyStop, setEarlyStop] = useState("50");
  const [pairs, setPairs] = useState("");

  // Spaces
  const [spaces, setSpaces] = useState<Record<string, boolean>>({
    buy: true, sell: true, roi: false, stoploss: false, trailing: false, protection: false,
  });
  const toggleSpace = (s: string) => setSpaces((p) => ({ ...p, [s]: !p[s] }));

  // Flags
  const [enableProtections, setEnableProtections] = useState(true);
  const [positionStacking, setPositionStacking] = useState(false);
  const [disableMaxPositions, setDisableMaxPositions] = useState(false);
  const [printAllResults, setPrintAllResults] = useState(false);

  // ── Right panel state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);
  const [chartXMode, setChartXMode] = useState<"epochs" | "time">("epochs");
  const [chartYMode, setChartYMode] = useState<"loss" | "profit">("loss");

  // Terminal
  const [termLines] = useState<string[]>([
    "[14:32:01] Starting hyperopt: SharpeHyperOptLoss / TPE",
    "[14:32:01] Strategy: AlphaTrend_V5 | Epochs: 200 | Spaces: [buy, sell]",
    "[14:32:01] Timerange: 20220101-20240101",
    "[14:32:05] Epoch 1/200 — 89 trades, objective: -0.0210",
    "[14:32:48] Epoch 50/200 — 112 trades, objective: -0.0890",
    "[14:33:31] Epoch 100/200 — 128 trades, objective: -0.1234",
    "[14:34:12] Epoch 150/200 — 135 trades, objective: -0.1501",
    "[14:34:55] Epoch 200/200 — 142 trades, objective: -0.1555",
    "[14:34:55] ✓ Hyperopt complete — best epoch #147, objective: -0.1555",
  ]);

  // Convergence chart data
  const convergenceData = useMemo(() => generateConvergenceData(), []);

  // Sub-tabs
  const SUB_TABS = ["Epoch Results", "Best Parameters", "Param Importance", "Compare Runs", "Run History"];

  // ── Epoch sort state ──────────────────────────────────────────────────
  const [epochSortCol, setEpochSortCol] = useState<string>("totalProfit");
  const [epochSortDir, setEpochSortDir] = useState<"asc" | "desc">("desc");

  const handleEpochSort = (col: string) => {
    if (epochSortCol === col) setEpochSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setEpochSortCol(col); setEpochSortDir("desc"); }
  };
  const epochSortClass = (col: string) =>
    `sortable${epochSortCol === col ? ` sort-${epochSortDir}` : ""}`;

  // ── History sort state ────────────────────────────────────────────────
  const [histSortCol, setHistSortCol] = useState<string>("date");
  const [histSortDir, setHistSortDir] = useState<"asc" | "desc">("desc");

  const handleHistSort = (col: string) => {
    if (histSortCol === col) setHistSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setHistSortCol(col); setHistSortDir("desc"); }
  };
  const histSortClass = (col: string) =>
    `sortable${histSortCol === col ? ` sort-${histSortDir}` : ""}`;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-row gap-3">
      {/* ═══════════ LEFT PANEL — Config (400px) ═══════════ */}
      <div className="w-[400px] flex flex-col gap-0 bg-surface l-bd rounded-md shadow-xl shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">Hyperopt Configuration</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto">

          {/* 1. Strategy */}
          <div>
            <label className="builder-label">Strategy</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="builder-select w-full"
            >
              <option>AlphaTrend_V5</option>
              <option>TrendFollowerV3</option>
              <option>MeanReversion_V2</option>
            </select>
          </div>

          {/* 2. Loss Function */}
          <div className="l-t">
            <label className="builder-label">Loss Function</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {["Sharpe", "Sortino", "Calmar", "MaxDrawDown", "OnlyProfit", "ProfitDD"].map((lf) => (
                <Pill key={lf} label={lf} selected={lossFn === lf} onClick={() => setLossFn(lf)} />
              ))}
            </div>
          </div>

          {/* 3. Sampler */}
          <div className="l-t pt-3">
            <label className="builder-label">Sampler</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {["TPE", "Random", "CmaEs", "NSGAII", "QMC"].map((s) => (
                <Pill key={s} label={s} selected={sampler === s} onClick={() => setSampler(s)} />
              ))}
            </div>
          </div>

          {/* 4. Epochs / Min Trades */}
          <div>
            <label className="builder-label">Optimization</label>
            <div className="flex gap-2">
              <input type="number" value={epochs} onChange={(e) => setEpochs(e.target.value)} className="builder-input" placeholder="Epochs" />
              <input type="number" value={minTrades} onChange={(e) => setMinTrades(e.target.value)} className="builder-input" placeholder="Min Trades" />
            </div>
          </div>

          {/* 5. Timerange Start / End */}
          <div>
            <label className="builder-label">Timerange</label>
            <div className="flex gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="builder-input" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="builder-input" />
            </div>
          </div>

          {/* 6. Timeframe / Jobs */}
          <div>
            <label className="builder-label">Execution</label>
            <div className="flex gap-2">
              <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="builder-select w-full">
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="15m">15m</option>
                <option value="5m">5m</option>
                <option value="1d">1d</option>
              </select>
              <select value={jobs} onChange={(e) => setJobs(e.target.value)} className="builder-select w-full">
                <option value="-1">-1 (all CPUs)</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="4">4</option>
                <option value="8">8</option>
              </select>
            </div>
          </div>

          {/* 7. Max Open Trades / Stake Amount */}
          <div>
            <label className="builder-label">Position</label>
            <div className="flex gap-2">
              <input type="number" value={maxOpenTrades} onChange={(e) => setMaxOpenTrades(e.target.value)} className="builder-input" placeholder="Max Open Trades" />
              <input type="text" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className="builder-input" placeholder="Stake Amount" />
            </div>
          </div>

          {/* 8. Fee / Random State */}
          <div>
            <label className="builder-label">Parameters</label>
            <div className="flex gap-2">
              <input type="text" value={fee} onChange={(e) => setFee(e.target.value)} className="builder-input" placeholder="exchange default" />
              <input type="number" value={randomState} onChange={(e) => setRandomState(e.target.value)} className="builder-input" placeholder="Random State" />
            </div>
          </div>

          {/* 9. Early Stop / Pairs */}
          <div>
            <label className="builder-label">Constraints</label>
            <div className="flex gap-2">
              <input type="text" value={earlyStop} onChange={(e) => setEarlyStop(e.target.value)} className="builder-input" placeholder="disabled" />
              <input type="text" value={pairs} onChange={(e) => setPairs(e.target.value)} className="builder-input" placeholder="all whitelist" />
            </div>
          </div>

          {/* 10. Spaces */}
          <div className="l-t pt-3">
            <label className="builder-label">Spaces</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {(["buy", "sell", "roi", "stoploss", "trailing", "protection"] as const).map((s) => (
                <Pill key={s} label={s} selected={spaces[s]} onClick={() => toggleSpace(s)} />
              ))}
            </div>
          </div>

          {/* 11. Flags */}
          <div className="l-t pt-3">
            <div className="flex flex-col gap-2.5 mt-1">
              <Toggle checked={enableProtections} onChange={setEnableProtections} label="Enable Protections" />
              <Toggle checked={positionStacking} onChange={setPositionStacking} label="Position Stacking" />
              <Toggle checked={disableMaxPositions} onChange={setDisableMaxPositions} label="Disable Max Positions" />
              <Toggle checked={printAllResults} onChange={setPrintAllResults} label="Print All Results" />
            </div>
          </div>

          {/* 12. Run Buttons */}
          <div className="flex gap-1.5 l-t pt-3">
            <button
              title="Start hyperopt optimization"
              className="flex-1 h-9 rounded-md text-[11px] font-bold uppercase tracking-wide bg-up/12 text-up border border-up/25 hover:bg-up/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>▶</span> Start Hyperopt
            </button>
            <button
              title="Stop running hyperopt"
              className="h-9 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide bg-down/12 text-down border border-down/25 hover:bg-down/20 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>⏹</span> Stop
            </button>
            <button
              title="Reset configuration to defaults"
              className="h-9 px-3 rounded-md text-[11px] font-bold uppercase tracking-wide bg-white/5 text-muted border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <span>↺</span> Reset
            </button>
          </div>

          {/* 13. Progress */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#9CA3AF]">Progress</span>
              <span className="text-white">Epoch 200/200</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-up rounded-full transition-all" style={{ width: "100%" }} />
            </div>
          </div>

          {/* 14. Terminal Output */}
          <div className="l-t pt-3">
            <label className="builder-label">Output</label>
            <div className="h-[140px] bg-black rounded-md l-bd overflow-y-auto p-2 font-mono text-[10px] leading-relaxed">
              {termLines.map((line, i) => (
                <div key={i} className={line.includes("✓") ? "text-up" : line.includes("ERROR") ? "text-down" : "text-[#9CA3AF]"}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL — Results (flex-1) ═══════════ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">

        {/* ── 1. Winner Banner ── */}
        <div className="bg-surface l-bd rounded-md p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="section-title text-white/50">★ Best Epoch #147 · SharpeHyperOptLoss</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded border border-up/25">BEST: -0.1555</span>
            </div>
            <button
              title="Deploy params to strategy file"
              className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-up/12 text-up border border-up/25 hover:bg-up/20 transition-colors"
            >
              Deploy
            </button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            <div><div className="kpi-label">Profit</div><div className="kpi-value text-up font-bold">+42.12%</div></div>
            <div><div className="kpi-label">Profit $</div><div className="kpi-value text-up font-bold">+$4,212</div></div>
            <div><div className="kpi-label">Trades</div><div className="kpi-value text-white">142</div></div>
            <div><div className="kpi-label">Win Rate</div><div className="kpi-value text-up">72.4%</div></div>
            <div><div className="kpi-label">Sharpe</div><div className="kpi-value text-white">3.92</div></div>
            <div><div className="kpi-label">Max DD</div><div className="kpi-value text-down font-bold">-2.1%</div></div>
            <div><div className="kpi-label">Avg Dur.</div><div className="kpi-value text-muted">4h 23m</div></div>
          </div>
        </div>

        {/* ── 2. Convergence Chart ── */}
        <div className="h-[200px] bg-surface l-bd rounded-md flex flex-col overflow-hidden shadow-xl relative">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0 gap-3">
            <span className="section-title text-white/50 whitespace-nowrap">Convergence</span>
            <div className="flex items-center gap-0">
              {/* Group 1: Epochs / Time */}
              <button
                title="Show by epoch number"
                onClick={() => setChartXMode("epochs")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-l border transition-colors ${
                  chartXMode === "epochs"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Epochs
              </button>
              <button
                title="Show by elapsed time"
                onClick={() => setChartXMode("time")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-r border-y border-r transition-colors ${
                  chartXMode === "time"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Time
              </button>
              {/* Spacer */}
              <div className="w-3" />
              {/* Group 2: Loss / Profit% */}
              <button
                title="Show objective loss"
                onClick={() => setChartYMode("loss")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-l border transition-colors ${
                  chartYMode === "loss"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Loss
              </button>
              <button
                title="Show profit percentage"
                onClick={() => setChartYMode("profit")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-r border-y border-r transition-colors ${
                  chartYMode === "profit"
                    ? "bg-up/15 text-up border-up/25"
                    : "bg-white/5 text-muted border-white/10 hover:text-white"
                }`}
              >
                Profit%
              </button>
            </div>
          </div>

          {/* Chart body */}
          <div className="flex-1 px-5 pb-4 relative">
            <div className="absolute inset-0 l-grid opacity-20" />
            {/* Legend */}
            <div className="absolute top-0 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-[2px] bg-[#22c55e] rounded" />
                Best Objective
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2.5 bg-white/15 rounded-sm" />
                Trades/Epoch
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={convergenceData} margin={{ top: 14, right: 0, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                  ticks={[0, 50, 100, 150, 200]}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono" }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[0, -0.05, -0.10, -0.15, -0.20]}
                  domain={[-0.22, 0.02]}
                  tickFormatter={(v: number) => v.toFixed(2)}
                />
                <YAxis yAxisId="right" orientation="right" hide />
                <RTooltip
                  contentStyle={{ background: "#0C0C0C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 10, fontFamily: "JetBrains Mono" }}
                  labelStyle={{ color: "#9CA3AF" }}
                  formatter={(value: unknown, name: unknown) => [
                    name === "bestObjective" ? Number(value).toFixed(4) : String(value),
                    name === "bestObjective" ? "Best Obj." : "Trades",
                  ]}
                />
                <Bar dataKey="trades" yAxisId="right" fill="rgba(255,255,255,0.07)" radius={[2, 2, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="bestObjective"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: "#22c55e" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 3. Tabbed Results ── */}
        <div className="flex-1 bg-surface l-bd rounded-md flex flex-col min-h-[250px] overflow-hidden shadow-xl">
          {/* Tab bar */}
          <div className="h-10 l-b flex items-center bg-black/40 shrink-0 overflow-x-auto whitespace-nowrap">
            {SUB_TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={`h-full px-4 font-bold text-[11px] uppercase tracking-wide ho-tab-btn shrink-0 ${
                  activeTab === i
                    ? "border-b-2 border-up text-white"
                    : "text-muted hover:text-white transition-colors"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="ho-tab-content flex-1 overflow-hidden flex flex-col">

            {/* ── Epoch Results ── */}
            {activeTab === 0 && (
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-[13px] font-mono">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="text-muted text-[10px] uppercase tracking-wider">
                      <th className={`px-2 py-1.5 text-left ${epochSortClass("epoch")}`} onClick={() => handleEpochSort("epoch")}>Epoch</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("trades")}`} onClick={() => handleEpochSort("trades")}>Trades</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("avgProfit")}`} onClick={() => handleEpochSort("avgProfit")}>Avg Profit</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("totalProfit")}`} onClick={() => handleEpochSort("totalProfit")}>Total Profit</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("profitAbs")}`} onClick={() => handleEpochSort("profitAbs")}>Profit $</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("avgDur")}`} onClick={() => handleEpochSort("avgDur")}>Avg Dur.</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("winPct")}`} onClick={() => handleEpochSort("winPct")}>Win%</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("maxDD")}`} onClick={() => handleEpochSort("maxDD")}>Max DD</th>
                      <th className={`px-2 py-1.5 text-right ${epochSortClass("objective")}`} onClick={() => handleEpochSort("objective")}>Objective</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_EPOCHS.map((row) => (
                      <tr
                        key={row.epoch}
                        className={`l-t hover:bg-white/[0.02] transition-colors ${row.isBest ? "bg-up/[0.02]" : ""}`}
                      >
                        <td className={`px-2 py-1.5 ${row.isBest ? "text-up font-bold" : row.isPrevBest ? "text-muted" : "text-muted"}`}>
                          {row.isBest ? "★" : row.isPrevBest ? "*" : ""}{row.epoch}
                        </td>
                        <td className="px-2 py-1.5 text-right text-white">{row.trades}</td>
                        <td className={`px-2 py-1.5 text-right ${row.avgProfit >= 0 ? "text-up" : "text-down"}`}>
                          {row.avgProfit >= 0 ? "+" : ""}{row.avgProfit.toFixed(2)}%
                        </td>
                        <td className={`px-2 py-1.5 text-right font-bold ${row.totalProfit >= 0 ? "text-up" : "text-down"}`}>
                          {row.totalProfit >= 0 ? "+" : ""}{row.totalProfit.toFixed(2)}%
                        </td>
                        <td className={`px-2 py-1.5 text-right ${row.profitAbs >= 0 ? "text-up font-bold" : "text-down"}`}>
                          {row.profitAbs >= 0 ? "+" : ""}${row.profitAbs.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted">{row.avgDur}</td>
                        <td className={`px-2 py-1.5 text-right ${row.winPct >= 65 ? "text-up" : "text-muted"}`}>{row.winPct}%</td>
                        <td className="px-2 py-1.5 text-right text-down">{row.maxDD}%</td>
                        <td className={`px-2 py-1.5 text-right ${row.isBest ? "text-up font-bold" : "text-muted"}`}>
                          {row.objective.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Best Parameters ── */}
            {activeTab === 1 && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="section-title">Optimized Parameters · Epoch #147</span>
                  <div className="flex items-center gap-1.5">
                    <button title="Copy as Python dict" className="px-2.5 py-1 l-bd rounded text-[10px] text-muted hover:text-white hover:bg-white/5 transition-colors font-mono">
                      📋 Copy Python
                    </button>
                    <button title="Copy as JSON" className="px-2.5 py-1 l-bd rounded text-[10px] text-muted hover:text-white hover:bg-white/5 transition-colors font-mono">
                      📋 Copy JSON
                    </button>
                    <button title="Export CSV" className="px-2.5 py-1 l-bd rounded text-[10px] text-muted hover:text-white hover:bg-white/5 transition-colors font-mono">
                      ⬇ CSV
                    </button>
                  </div>
                </div>
                <div className="bg-black rounded p-3 font-mono text-[11px] leading-relaxed l-bd space-y-0.5">
                  <div><span className="text-white">buy_params</span> <span className="text-muted">=</span> <span className="text-white">{"{"}</span></div>
                  <div className="pl-4"><span className="text-up">&quot;buy_rsi&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">28</span><span className="text-muted">,</span></div>
                  <div className="pl-4"><span className="text-up">&quot;buy_ema_short&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">12</span><span className="text-muted">,</span></div>
                  <div className="pl-4"><span className="text-up">&quot;buy_ema_long&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">26</span><span className="text-muted">,</span></div>
                  <div><span className="text-white">{"}"}</span></div>
                  <div>&nbsp;</div>
                  <div><span className="text-white">sell_params</span> <span className="text-muted">=</span> <span className="text-white">{"{"}</span></div>
                  <div className="pl-4"><span className="text-down">&quot;sell_rsi&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">72</span><span className="text-muted">,</span></div>
                  <div className="pl-4"><span className="text-down">&quot;sell_profit_offset&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">0.012</span><span className="text-muted">,</span></div>
                  <div><span className="text-white">{"}"}</span></div>
                  <div>&nbsp;</div>
                  <div className="text-muted pt-2"># ROI Table</div>
                  <div><span className="text-white">minimal_roi</span> <span className="text-muted">=</span> <span className="text-white">{"{"}</span></div>
                  <div className="pl-4"><span className="text-muted">&quot;0&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">0.05</span><span className="text-muted">,</span></div>
                  <div className="pl-4"><span className="text-muted">&quot;30&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">0.02</span><span className="text-muted">,</span></div>
                  <div className="pl-4"><span className="text-muted">&quot;60&quot;</span><span className="text-muted">:</span> <span className="text-white font-bold">0.01</span><span className="text-muted">,</span></div>
                  <div><span className="text-white">{"}"}</span></div>
                  <div>&nbsp;</div>
                  <div className="text-muted pt-2"># Stoploss</div>
                  <div><span className="text-white">stoploss</span> <span className="text-muted">=</span> <span className="text-down font-bold">-0.03</span></div>
                  <div><span className="text-white">trailing_stop</span> <span className="text-muted">=</span> <span className="text-up font-bold">True</span></div>
                  <div><span className="text-white">trailing_stop_positive</span> <span className="text-muted">=</span> <span className="text-white font-bold">0.01</span></div>
                </div>
              </div>
            )}

            {/* ── Param Importance ── */}
            {activeTab === 2 && (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="section-title mb-3">Parameter Importance (Impact on Objective)</div>
                <div className="space-y-2.5">
                  {[
                    { name: "buy_rsi", pct: 85 },
                    { name: "sell_rsi", pct: 72 },
                    { name: "buy_ema_short", pct: 61 },
                    { name: "trailing_stop_positive", pct: 48 },
                    { name: "sell_profit_offset", pct: 35 },
                    { name: "stoploss", pct: 22 },
                  ].map((p) => {
                    const color = p.pct >= 70 ? "bg-up" : p.pct >= 50 ? "bg-white" : "bg-white/60";
                    const textColor = p.pct >= 70 ? "text-up" : p.pct >= 50 ? "text-white" : "text-muted";
                    return (
                      <div key={p.name} className="flex items-center gap-3 text-[11px] font-mono">
                        <span className="w-[180px] text-muted truncate">{p.name}</span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${p.pct}%` }} />
                        </div>
                        <span className={`w-12 text-right font-bold ${textColor}`}>{p.pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Compare Runs ── */}
            {activeTab === 3 && (
              <div className="flex-1 overflow-x-auto overflow-y-auto p-0">
                <table className="w-full text-[13px] font-mono">
                  <thead>
                    <tr className="text-[#9CA3AF] text-[10px] uppercase tracking-wider sticky top-0 bg-surface z-10">
                      <th className="px-2 py-1.5 text-left">Metric</th>
                      <th className="px-2 py-1.5 text-right">Run #1</th>
                      <th className="px-2 py-1.5 text-right">Run #2</th>
                      <th className="px-2 py-1.5 text-right">Run #3</th>
                      <th className="px-2 py-1.5 text-right">Δ Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Profit % */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Profit %</td>
                      <td className="px-2 py-1.5 text-right text-up font-bold">+42.12%</td>
                      <td className="px-2 py-1.5 text-right text-up">+38.40%</td>
                      <td className="px-2 py-1.5 text-right text-up">+21.4%</td>
                      <td className="px-2 py-1.5 text-right text-up">+3.72%</td>
                    </tr>
                    {/* Win Rate */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Win Rate</td>
                      <td className="px-2 py-1.5 text-right text-up font-bold">72.4%</td>
                      <td className="px-2 py-1.5 text-right text-up">70.1%</td>
                      <td className="px-2 py-1.5 text-right text-up">65.8%</td>
                      <td className="px-2 py-1.5 text-right text-up">+2.3%</td>
                    </tr>
                    {/* Max DD */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Max DD</td>
                      <td className="px-2 py-1.5 text-right text-down font-bold">-2.1%</td>
                      <td className="px-2 py-1.5 text-right text-down">-3.4%</td>
                      <td className="px-2 py-1.5 text-right text-down">-5.2%</td>
                      <td className="px-2 py-1.5 text-right text-down">-2.1%</td>
                    </tr>
                    {/* Sharpe */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Sharpe</td>
                      <td className="px-2 py-1.5 text-right font-bold">3.92</td>
                      <td className="px-2 py-1.5 text-right">3.45</td>
                      <td className="px-2 py-1.5 text-right">2.11</td>
                      <td className="px-2 py-1.5 text-right text-up">+0.47</td>
                    </tr>
                    {/* Sortino */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Sortino</td>
                      <td className="px-2 py-1.5 text-right font-bold">4.15</td>
                      <td className="px-2 py-1.5 text-right">3.80</td>
                      <td className="px-2 py-1.5 text-right">2.44</td>
                      <td className="px-2 py-1.5 text-right text-up">+0.35</td>
                    </tr>
                    {/* Trades */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Trades</td>
                      <td className="px-2 py-1.5 text-right font-bold">142</td>
                      <td className="px-2 py-1.5 text-right">128</td>
                      <td className="px-2 py-1.5 text-right">89</td>
                      <td className="px-2 py-1.5 text-right">+14</td>
                    </tr>
                    {/* Avg Duration */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Avg Duration</td>
                      <td className="px-2 py-1.5 text-right">4h 23m</td>
                      <td className="px-2 py-1.5 text-right">3h 52m</td>
                      <td className="px-2 py-1.5 text-right">6h 11m</td>
                      <td className="px-2 py-1.5 text-right text-muted">&mdash;</td>
                    </tr>
                    {/* Objective */}
                    <tr className="l-t hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-muted">Objective</td>
                      <td className="px-2 py-1.5 text-right text-up font-bold">-0.1555</td>
                      <td className="px-2 py-1.5 text-right text-muted">-0.1823</td>
                      <td className="px-2 py-1.5 text-right text-muted">-0.2410</td>
                      <td className="px-2 py-1.5 text-right text-up">+0.0268</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Run History ── */}
            {activeTab === 4 && (
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-[13px] font-mono">
                  <thead>
                    <tr className="text-[#9CA3AF] text-[10px] uppercase tracking-wider sticky top-0 bg-surface z-10">
                      <th className={`px-2 py-1.5 text-left ${histSortClass("id")}`} onClick={() => handleHistSort("id")}>#</th>
                      <th className={`px-2 py-1.5 text-left ${histSortClass("date")}`} onClick={() => handleHistSort("date")}>Date</th>
                      <th className={`px-2 py-1.5 text-left ${histSortClass("strategy")} filterable`} onClick={() => handleHistSort("strategy")}>Strategy</th>
                      <th className={`px-2 py-1.5 text-left ${histSortClass("lossFn")} filterable`} onClick={() => handleHistSort("lossFn")}>Loss Fn</th>
                      <th className={`px-2 py-1.5 text-right ${histSortClass("epochs")}`} onClick={() => handleHistSort("epochs")}>Epochs</th>
                      <th className={`px-2 py-1.5 text-right ${histSortClass("best")}`} onClick={() => handleHistSort("best")}>Best</th>
                      <th className={`px-2 py-1.5 text-right ${histSortClass("profit")}`} onClick={() => handleHistSort("profit")}>Profit</th>
                      <th className={`px-2 py-1.5 text-right ${histSortClass("trades")}`} onClick={() => handleHistSort("trades")}>Trades</th>
                      <th className={`px-2 py-1.5 text-right ${histSortClass("objective")}`} onClick={() => handleHistSort("objective")}>Objective</th>
                      <th className="px-2 py-1.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_HISTORY.map((row) => (
                      <tr key={row.id} className="l-t hover:bg-white/[0.02] transition-colors">
                        <td className="px-2 py-1.5 text-muted">{row.id}</td>
                        <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{row.date}</td>
                        <td className="px-2 py-1.5 text-white">{row.strategy}</td>
                        <td className="px-2 py-1.5 text-muted">{row.lossFn}</td>
                        <td className="px-2 py-1.5 text-right text-white">{row.epochs}</td>
                        <td className="px-2 py-1.5 text-right text-up">{row.best}</td>
                        <td className="px-2 py-1.5 text-right text-up">{row.profit}</td>
                        <td className="px-2 py-1.5 text-right text-white">{row.trades}</td>
                        <td className="px-2 py-1.5 text-right text-up font-bold">{row.objective.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              title="Load results"
                              className="text-[10px] px-2 py-0.5 bg-up/10 border border-up/25 text-up rounded hover:bg-up/20 transition-all"
                            >
                              Load
                            </button>
                            <button
                              title="Delete run"
                              className="text-[10px] px-1.5 py-0.5 bg-down/10 border border-down/20 text-down/70 rounded hover:bg-down/20 hover:text-down transition-all"
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
