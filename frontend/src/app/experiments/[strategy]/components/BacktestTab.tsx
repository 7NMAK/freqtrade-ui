"use client";

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ── Toggle ──────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className={`builder-toggle ${on ? "on" : ""}`} onClick={onToggle}>
      <div className="dot" />
    </div>
  );
}

// ── Pill ────────────────────────────────────────────────────────────────
function Pill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`builder-pill text-[10px] px-2.5 py-1.5 text-center ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      {selected && "✓ "}
      {label}
    </button>
  );
}

// ── Mock chart data ─────────────────────────────────────────────────────
const chartData = [
  { month: "01-15", profit: 10200, trades: 12 },
  { month: "02-15", profit: 10550, trades: 14 },
  { month: "03-15", profit: 10980, trades: 10 },
  { month: "04-15", profit: 11200, trades: 13 },
  { month: "05-15", profit: 11750, trades: 11 },
  { month: "06-15", profit: 11400, trades: 15 },
  { month: "07-15", profit: 12100, trades: 9 },
  { month: "08-15", profit: 12650, trades: 12 },
  { month: "09-15", profit: 13100, trades: 11 },
  { month: "10-15", profit: 13500, trades: 14 },
  { month: "11-15", profit: 13850, trades: 10 },
  { month: "12-15", profit: 14212, trades: 11 },
];

// ── Mock trade rows ─────────────────────────────────────────────────────
const mockTrades = [
  {
    date: "2024-12-28 14:30",
    pair: "BTC/USDT:USDT",
    side: "LONG" as const,
    entry: 42150.2,
    exit: 43612.8,
    profitPct: 3.47,
    value: 346.8,
    fee: 4.21,
    duration: "6h 12m",
    exitReason: "roi",
    winner: true,
  },
  {
    date: "2024-12-22 08:15",
    pair: "ETH/USDT:USDT",
    side: "SHORT" as const,
    entry: 2285.4,
    exit: 2198.6,
    profitPct: 3.8,
    value: 380.2,
    fee: 3.85,
    duration: "4h 45m",
    exitReason: "trailing_stop_loss",
    winner: true,
  },
  {
    date: "2024-12-18 19:00",
    pair: "BTC/USDT:USDT",
    side: "LONG" as const,
    entry: 43800.0,
    exit: 43450.5,
    profitPct: -0.8,
    value: -79.7,
    fee: 4.38,
    duration: "2h 10m",
    exitReason: "stoploss",
    winner: false,
  },
  {
    date: "2024-12-15 03:22",
    pair: "ETH/USDT:USDT",
    side: "LONG" as const,
    entry: 2180.0,
    exit: 2248.6,
    profitPct: 3.15,
    value: 314.6,
    fee: 3.64,
    duration: "8h 30m",
    exitReason: "roi",
    winner: true,
  },
];

// ── Mock per-pair rows ──────────────────────────────────────────────────
const mockPerPair = [
  { pair: "BTC/USDT:USDT", trades: 80, profitAbs: 2812.4, profitRatio: 28.12, winRate: 74.2, avgProfit: 2.41, avgDur: "4h 10m" },
  { pair: "ETH/USDT:USDT", trades: 52, profitAbs: 1180.6, profitRatio: 11.81, winRate: 69.8, avgProfit: 1.92, avgDur: "5h 02m" },
  { pair: "SOL/USDT:USDT", trades: 10, profitAbs: 219.0, profitRatio: 2.19, winRate: 70.0, avgProfit: 2.19, avgDur: "3h 45m" },
];

// ── Mock entry tags ─────────────────────────────────────────────────────
const mockEntryTags = [
  { tag: "alpha_signal", trades: 58, wins: 44, losses: 14, winRate: 75.9, avgPnl: 2.84, totalPnl: 1648.2, avgDur: "4h 15m", bestPair: "BTC/USDT:USDT", expectancy: 28.42 },
  { tag: "trend_follow", trades: 42, wins: 30, losses: 12, winRate: 71.4, avgPnl: 2.12, totalPnl: 890.4, avgDur: "5h 30m", bestPair: "ETH/USDT:USDT", expectancy: 21.2 },
  { tag: "mean_revert", trades: 24, wins: 16, losses: 8, winRate: 66.7, avgPnl: 1.85, totalPnl: 444.0, avgDur: "3h 45m", bestPair: "BTC/USDT:USDT", expectancy: 18.5 },
  { tag: "momentum", trades: 12, wins: 8, losses: 4, winRate: 66.7, avgPnl: 2.95, totalPnl: 354.0, avgDur: "2h 50m", bestPair: "SOL/USDT:USDT", expectancy: 29.5 },
  { tag: "breakout", trades: 6, wins: 4, losses: 2, winRate: 66.7, avgPnl: 14.57, totalPnl: 875.4, avgDur: "6h 10m", bestPair: "BTC/USDT:USDT", expectancy: 145.9 },
];

// ── Mock exit reasons ───────────────────────────────────────────────────
const mockExitReasons = [
  { reason: "roi", trades: 68, wins: 68, losses: 0, winRate: 100.0, avgPnl: 3.12, totalPnl: 2121.6, avgDur: "5h 20m", bestPair: "BTC/USDT:USDT", expectancy: 31.2 },
  { reason: "trailing_stop_loss", trades: 34, wins: 24, losses: 10, winRate: 70.6, avgPnl: 1.85, totalPnl: 629.0, avgDur: "4h 10m", bestPair: "ETH/USDT:USDT", expectancy: 18.5 },
  { reason: "stoploss", trades: 28, wins: 0, losses: 28, winRate: 0.0, avgPnl: -1.42, totalPnl: -397.6, avgDur: "1h 45m", bestPair: "BTC/USDT:USDT", expectancy: -14.2 },
  { reason: "exit_signal", trades: 12, wins: 10, losses: 2, winRate: 83.3, avgPnl: 4.92, totalPnl: 1859.0, avgDur: "8h 15m", bestPair: "BTC/USDT:USDT", expectancy: 154.9 },
];

// ── Mock history ────────────────────────────────────────────────────────
const mockHistory = [
  { id: 1, runDate: "2025-01-02 14:30", tf: "1h", timerange: "2024-01-01 → 2025-01-01", trades: 142, profit: 42.12, winPct: 72.4, sharpe: 3.92, best: true },
  { id: 2, runDate: "2024-12-28 09:15", tf: "4h", timerange: "2024-01-01 → 2024-12-28", trades: 86, profit: 18.45, winPct: 65.1, sharpe: 1.82, best: false },
  { id: 3, runDate: "2024-12-20 16:45", tf: "1h", timerange: "2024-06-01 → 2024-12-20", trades: 64, profit: -4.22, winPct: 48.3, sharpe: -0.31, best: false },
  { id: 4, runDate: "2024-12-15 11:00", tf: "15m", timerange: "2024-09-01 → 2024-12-15", trades: 210, profit: 28.91, winPct: 61.4, sharpe: 2.14, best: false },
];

// ══════════════════════════════════════════════════════════════════════════
// BACKTEST TAB
// ══════════════════════════════════════════════════════════════════════════
export default function BacktestTab() {
  // ── Config state ──────────────────────────────────────────────────────
  const [strategy, setStrategy] = useState("AlphaTrend_V5");
  const [timerangeStart, setTimerangeStart] = useState("2024-01-01");
  const [timerangeEnd, setTimerangeEnd] = useState("2025-01-01");
  const [timeframe, setTimeframe] = useState("1h");
  const [timeframeDetail, setTimeframeDetail] = useState("None");
  const [startingCapital, setStartingCapital] = useState("10000");
  const [stakeAmount, setStakeAmount] = useState("unlimited");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [fee, setFee] = useState("");
  const [enableProtections, setEnableProtections] = useState(true);
  const [dryRunWallet, setDryRunWallet] = useState(false);
  const [positionStacking, setPositionStacking] = useState(false);
  const [enableShorts, setEnableShorts] = useState(false);
  const [breakdownSelected, setBreakdownSelected] = useState("month");
  const [cache, setCache] = useState("day");

  // ── Sub-tab state ─────────────────────────────────────────────────────
  const [btSubTab, setBtSubTab] = useState<
    "closed" | "per-pair" | "entry-tags" | "exit-reasons" | "history"
  >("closed");

  // ── Chart toggle state ────────────────────────────────────────────────
  const [chartPeriod, setChartPeriod] = useState<"days" | "weeks" | "months">("days");
  const [chartMode, setChartMode] = useState<"abs" | "rel">("abs");

  return (
    <div className="h-full flex flex-row gap-3">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL — Config                                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="w-[400px] flex flex-col gap-0 bg-surface l-bd rounded-md shadow-xl shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">Backtest Configuration</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto">
          {/* 1. Strategy */}
          <div>
            <label className="builder-label">Strategy</label>
            <select
              className="builder-select w-full"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option>AlphaTrend_V5</option>
              <option>TrendFollowerV3</option>
              <option>MeanReversion_V2</option>
            </select>
          </div>

          {/* 2. Timerange */}
          <div>
            <label className="builder-label">Timerange</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="builder-input flex-1"
                value={timerangeStart}
                onChange={(e) => setTimerangeStart(e.target.value)}
              />
              <input
                type="date"
                className="builder-input flex-1"
                value={timerangeEnd}
                onChange={(e) => setTimerangeEnd(e.target.value)}
              />
            </div>
          </div>

          {/* 3. Timeframe / Timeframe Detail */}
          <div>
            <label className="builder-label">Timeframe</label>
            <div className="flex gap-2">
              <select
                className="builder-select flex-1"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
              >
                <option>1h</option>
                <option>4h</option>
                <option>15m</option>
                <option>5m</option>
                <option>1d</option>
              </select>
              <select
                className="builder-select flex-1"
                value={timeframeDetail}
                onChange={(e) => setTimeframeDetail(e.target.value)}
              >
                <option>None</option>
                <option>5m</option>
                <option>1m</option>
              </select>
            </div>
          </div>

          {/* 4. Starting Capital / Stake Amount */}
          <div>
            <label className="builder-label">Position</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="builder-input flex-1"
                value={startingCapital}
                onChange={(e) => setStartingCapital(e.target.value)}
              />
              <input
                type="text"
                className="builder-input flex-1"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
            </div>
          </div>

          {/* 5. Max Open Trades / Fee */}
          <div>
            <label className="builder-label">Limits</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="builder-input flex-1"
                value={maxOpenTrades}
                onChange={(e) => setMaxOpenTrades(e.target.value)}
              />
              <input
                type="text"
                className="builder-input flex-1"
                placeholder="exchange default"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
          </div>

          {/* 6. Flags */}
          <div className="l-t pt-3">
            <label className="builder-label">Flags</label>
            <div className="flex flex-col gap-2.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Enable Protections</span>
                <Toggle on={enableProtections} onToggle={() => setEnableProtections(!enableProtections)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Dry Run Wallet</span>
                <Toggle on={dryRunWallet} onToggle={() => setDryRunWallet(!dryRunWallet)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Position Stacking</span>
                <Toggle on={positionStacking} onToggle={() => setPositionStacking(!positionStacking)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">Enable Shorts</span>
                <Toggle on={enableShorts} onToggle={() => setEnableShorts(!enableShorts)} />
              </div>
            </div>
          </div>

          {/* 7. Breakdown */}
          <div className="l-t pt-3">
            <label className="builder-label">Breakdown</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {(["day", "week", "month"] as const).map((b) => (
                <Pill
                  key={b}
                  label={b}
                  selected={breakdownSelected === b}
                  onClick={() => setBreakdownSelected(b)}
                />
              ))}
            </div>
          </div>

          {/* 8. Cache */}
          <div className="l-t pt-3">
            <label className="builder-label">Cache</label>
            <select
              className="builder-select w-full"
              value={cache}
              onChange={(e) => setCache(e.target.value)}
            >
              <option>day</option>
              <option>none</option>
              <option>week</option>
              <option>month</option>
            </select>
          </div>

          {/* 9. Strategy Config Preview */}
          <div className="l-t pt-3">
            <label className="builder-label">
              Strategy Config{" "}
              <span className="text-muted text-[8px] normal-case font-normal">
                (read from strategy)
              </span>
            </label>
            <div className="builder-card space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-muted">stoploss</span>
                <span className="text-down font-bold">-0.10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">trailing_stop</span>
                <span className="text-up">true</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">trailing_stop_positive</span>
                <span className="text-white">0.01</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">use_exit_signal</span>
                <span className="text-up">true</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">minimal_roi</span>
                <span className="text-white text-[9px]">
                  {`{"0": 0.05, "30": 0.02, "60": 0.01}`}
                </span>
              </div>
            </div>
          </div>

          {/* 10. Run buttons */}
          <div className="flex gap-1.5 l-t pt-3">
            <button
              className="flex-1 bg-white text-black hover:bg-white/85 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors"
              title="Start backtesting run"
            >
              ▶ Start Backtest
            </button>
            <button
              className="px-3 l-bd text-down hover:bg-down/10 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors"
              title="Stop running backtest"
            >
              ⏹ Stop
            </button>
            <button
              className="px-3 l-bd text-muted hover:text-white hover:bg-white/5 py-2 text-[11px] font-bold uppercase tracking-wider rounded transition-colors"
              title="Reset configuration to defaults"
            >
              ↺ Reset
            </button>
          </div>

          {/* 11. Progress */}
          <div className="l-t pt-3">
            <div className="flex justify-between text-[11px] font-mono mb-1.5">
              <span className="text-muted">Progress</span>
              <span className="text-white font-bold">
                Completed · 142 trades · ETA —
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full">
              <div
                className="h-full bg-up rounded-full transition-all"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* 12. Terminal Output */}
          <div className="l-t pt-3">
            <label className="builder-label">Terminal Output</label>
            <div className="mt-1 bg-black rounded p-3 font-mono text-[10px] text-muted leading-relaxed l-bd max-h-[300px] overflow-y-auto">
              <div>[2025-01-02 14:30:01] Loading strategy AlphaTrend_V5...</div>
              <div>[2025-01-02 14:30:02] Loading data for BTC/USDT:USDT, ETH/USDT:USDT</div>
              <div className="text-white">
                [2025-01-02 14:30:03] Using timeframe: 1h, timerange: 20240101-20250101
              </div>
              <div>[2025-01-02 14:30:04] Running backtesting with 365 days of data...</div>
              <div>[2025-01-02 14:30:12] Processing candles... 100%</div>
              <div className="text-white">
                [2025-01-02 14:30:15] Found 142 trades in backtest period
              </div>
              <div>[2025-01-02 14:30:15] Calculating statistics...</div>
              <div className="text-up font-bold">
                [2025-01-02 14:30:16] Backtesting complete. Total profit: +42.12%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL — Results                                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">
        {/* 1. Winner Banner */}
        <div className="bg-up/[0.04] l-bd rounded-md p-3 shadow-xl border-l-2 border-l-up relative overflow-hidden">
          {/* Decorative circle */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-up/[0.03] rounded-full -translate-y-8 translate-x-8" />

          {/* Title row */}
          <div className="flex justify-between items-center mb-2 relative z-10">
            <span className="text-white font-mono text-[12px] font-bold">
              ★ AlphaTrend_V5 · 1h · 142 trades
            </span>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded border border-up/25">
                COMPLETED
              </span>
              <button
                title="Deploy params to live"
                className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#F5F5F5",
                }}
              >
                Deploy
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-7 gap-2 text-[11px] font-mono relative z-10">
            <div>
              <span className="text-muted block text-[9px]">Profit</span>
              <span className="text-up font-bold">+42.12%</span>
            </div>
            <div>
              <span className="text-muted block text-[9px]">Profit $</span>
              <span className="text-up font-bold">+$4,212</span>
            </div>
            <div>
              <span className="text-muted block text-[9px]">Trades</span>
              <span className="text-white">142</span>
            </div>
            <div>
              <span className="text-muted block text-[9px]">Win Rate</span>
              <span className="text-up">72.4%</span>
            </div>
            <div>
              <span className="text-muted block text-[9px]">Sharpe</span>
              <span className="text-white">3.92</span>
            </div>
            <div>
              <span className="text-muted block text-[9px]">Max DD</span>
              <span className="text-down font-bold">-2.1%</span>
            </div>
            <div>
              <span className="text-muted block text-[9px]">Duration</span>
              <span className="text-muted">365 days</span>
            </div>
          </div>
        </div>

        {/* 2. KPI Cards */}
        <div className="grid grid-cols-6 gap-2">
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Total Profit</div>
            <div className="kpi-value text-up">+$4,212</div>
            <div className="text-[9px] font-mono text-up">+42.12%</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Win Rate</div>
            <div className="kpi-value text-up">72.4%</div>
            <div className="text-[9px] font-mono text-muted">102W 40L</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Trades</div>
            <div className="kpi-value">142</div>
            <div className="text-[9px] font-mono text-muted">80L 62S</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Max Drawdown</div>
            <div className="kpi-value text-down">-2.11%</div>
            <div className="text-[9px] font-mono text-down">-$211</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Sharpe Ratio</div>
            <div className="kpi-value">3.92</div>
          </div>
          <div className="bg-surface p-2.5 l-bd rounded">
            <div className="kpi-label">Sortino Ratio</div>
            <div className="kpi-value">4.15</div>
          </div>
        </div>

        {/* 3. Advanced Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface l-bd rounded p-2.5 space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-muted">Profit Factor</span>
              <span className="text-up">2.58</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Expectancy</span>
              <span className="text-up">$29.66</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">SQN</span>
              <span className="text-white">5.12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Calmar</span>
              <span className="text-white">19.96</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">CAGR</span>
              <span className="text-up">42.12%</span>
            </div>
          </div>
          <div className="bg-surface l-bd rounded p-2.5 space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-muted">Starting Balance</span>
              <span className="text-white">$10,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Final Balance</span>
              <span className="text-up font-bold">$14,212</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Best Day</span>
              <span className="text-up">+$412</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Worst Day</span>
              <span className="text-down">-$156</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Avg Duration</span>
              <span className="text-white">4h 23m</span>
            </div>
          </div>
        </div>

        {/* 4. Profit Over Time Chart */}
        <div className="h-[200px] bg-surface l-bd rounded-md flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 shrink-0 gap-3">
            <span className="section-title text-white/50 whitespace-nowrap">
              Profit Over Time
            </span>
            <div className="flex gap-0 shrink-0">
              {/* Period toggles */}
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase ${
                  chartPeriod === "days"
                    ? "bg-white/10 text-white rounded-l"
                    : "text-muted hover:text-white l-bd border-l-0 transition-colors"
                } ${chartPeriod === "days" ? "" : chartPeriod === "weeks" ? "rounded-l-none" : ""}`}
                onClick={() => setChartPeriod("days")}
              >
                Days
              </button>
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase ${
                  chartPeriod === "weeks"
                    ? "bg-white/10 text-white"
                    : "text-muted hover:text-white l-bd border-l-0 transition-colors"
                }`}
                onClick={() => setChartPeriod("weeks")}
              >
                Weeks
              </button>
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase ${
                  chartPeriod === "months"
                    ? "bg-white/10 text-white rounded-r"
                    : "text-muted hover:text-white l-bd border-l-0 rounded-r transition-colors"
                }`}
                onClick={() => setChartPeriod("months")}
              >
                Months
              </button>

              <div className="w-3" />

              {/* Abs / Rel toggles */}
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-l ${
                  chartMode === "abs"
                    ? "bg-up/15 text-up border border-up/25"
                    : "text-muted l-bd border-l-0 hover:text-white transition-colors"
                }`}
                onClick={() => setChartMode("abs")}
              >
                Abs $
              </button>
              <button
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-r ${
                  chartMode === "rel"
                    ? "bg-up/15 text-up border border-up/25"
                    : "text-muted l-bd border-l-0 hover:text-white transition-colors"
                }`}
                onClick={() => setChartMode("rel")}
              >
                Rel %
              </button>
            </div>
          </div>

          {/* Chart body */}
          <div className="flex-1 px-5 pb-4 relative">
            <div className="absolute inset-0 l-grid opacity-20" />
            {/* Legend */}
            <div className="absolute top-0 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10">
              <span className="flex items-center gap-1">
                <span className="w-3 h-[2px] bg-[#22c55e] rounded inline-block" />
                Profit
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2.5 bg-white/15 rounded-sm inline-block" />
                Trade Count
              </span>
            </div>

            {/* Y-axis labels */}
            <div className="absolute left-1 top-0 bottom-4 flex flex-col justify-between text-[9px] font-mono text-white/25">
              <span>14k</span>
              <span>12k</span>
              <span>10k</span>
              <span>8k</span>
            </div>

            {/* Recharts */}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 12, right: 0, bottom: 0, left: 24 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: "#0C0C0C",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  labelStyle={{ color: "#9CA3AF" }}
                  itemStyle={{ color: "#F5F5F5" }}
                />
                <Bar
                  dataKey="trades"
                  fill="rgba(255,255,255,0.15)"
                  radius={[2, 2, 0, 0]}
                  barSize={14}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* X-axis labels */}
            <div className="flex justify-between text-[9px] font-mono text-white/25 mt-1">
              {chartData.map((d) => (
                <span key={d.month}>{d.month}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Master Table */}
        <div className="flex-1 bg-surface l-bd rounded-md flex flex-col min-h-[250px] overflow-hidden">
          {/* Tab bar */}
          <div className="h-10 l-b flex items-center bg-black/40 shrink-0 border-b-2 border-transparent overflow-x-auto whitespace-nowrap">
            {(
              [
                { key: "closed", label: "Closed Trades" },
                { key: "per-pair", label: "Per-Pair" },
                { key: "entry-tags", label: "Entry Tags" },
                { key: "exit-reasons", label: "Exit Reasons" },
                { key: "history", label: "History" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                className={`h-full px-4 font-bold text-[11px] uppercase tracking-wide bt-tab-btn shrink-0 ${
                  btSubTab === tab.key
                    ? "border-b-2 border-up text-white"
                    : "text-muted hover:text-white transition-colors"
                }`}
                onClick={() => setBtSubTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Closed Trades ── */}
          {btSubTab === "closed" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-left">Date</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Pair</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-center">Side</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Entry</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Exit</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Profit%</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Value</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Fee</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-left">Duration</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {mockTrades.map((t, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-white/[0.04] ${t.winner ? "bg-up/[0.02]" : ""}`}
                    >
                      <td className="px-2 py-1.5">
                        {t.winner && "★ "}
                        {t.date}
                      </td>
                      <td className="px-2 py-1.5">{t.pair}</td>
                      <td className="px-2 py-1.5 text-center">
                        {t.side === "LONG" ? (
                          <span className="bg-up/12 text-up px-1 py-0.5 rounded text-[9px] font-bold">
                            LONG
                          </span>
                        ) : (
                          <span className="bg-down/12 text-down px-1 py-0.5 rounded text-[9px] font-bold">
                            SHORT
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {t.entry.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {t.exit.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                        })}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          t.profitPct >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {t.profitPct >= 0 ? "+" : ""}
                        {t.profitPct.toFixed(2)}%
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          t.value >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {t.value >= 0 ? "+" : ""}${Math.abs(t.value).toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">
                        ${t.fee.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5">{t.duration}</td>
                      <td className="px-2 py-1.5 text-muted">{t.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="w-full py-1.5 text-[10px] text-muted font-mono hover:bg-white/5 transition-colors l-t">
                Load More (138 remaining)
              </button>
            </div>
          )}

          {/* ── Per-Pair ── */}
          {btSubTab === "per-pair" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Pair</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Trades</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-right">profit_abs</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">profit_ratio</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Win Rate</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg Profit</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg Dur.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {mockPerPair.map((p, i) => (
                    <tr key={i} className="hover:bg-white/[0.04]">
                      <td className="px-2 py-1.5">{p.pair}</td>
                      <td className="px-2 py-1.5 text-right">{p.trades}</td>
                      <td
                        className={`px-2 py-1.5 text-right font-bold ${
                          p.profitAbs >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {p.profitAbs >= 0 ? "+" : ""}${p.profitAbs.toFixed(1)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          p.profitRatio >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {p.profitRatio >= 0 ? "+" : ""}
                        {p.profitRatio.toFixed(2)}%
                      </td>
                      <td className="px-2 py-1.5 text-right text-up">
                        {p.winRate.toFixed(1)}%
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          p.avgProfit >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {p.avgProfit >= 0 ? "+" : ""}
                        {p.avgProfit.toFixed(2)}%
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">
                        {p.avgDur}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Entry Tags ── */}
          {btSubTab === "entry-tags" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Tag</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Trades</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Wins</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Losses</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Win Rate</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg P&L %</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-right">Total P&L</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg Dur.</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Best Pair</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Expectancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {mockEntryTags.map((t, i) => (
                    <tr key={i} className="hover:bg-white/[0.04]">
                      <td className="px-2 py-1.5">
                        <span className="px-1.5 py-0.5 bg-blue-500/12 text-blue-400 rounded text-[9px]">
                          {t.tag}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right">{t.trades}</td>
                      <td className="px-2 py-1.5 text-right text-up">{t.wins}</td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          t.losses > 0 ? "text-down" : "text-muted"
                        }`}
                      >
                        {t.losses}
                      </td>
                      <td className="px-2 py-1.5 text-right text-up">
                        {t.winRate.toFixed(1)}%
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          t.avgPnl >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {t.avgPnl >= 0 ? "+" : ""}
                        {t.avgPnl.toFixed(2)}%
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-bold ${
                          t.totalPnl >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {t.totalPnl >= 0 ? "+" : ""}${t.totalPnl.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">
                        {t.avgDur}
                      </td>
                      <td className="px-2 py-1.5">{t.bestPair}</td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          t.expectancy >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        ${t.expectancy.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Exit Reasons ── */}
          {btSubTab === "exit-reasons" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Reason</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Trades</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Wins</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Losses</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Win Rate</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg P&L %</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-right">Total P&L</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Avg Dur.</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">Best Pair</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Expectancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {mockExitReasons.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.04]">
                      <td className="px-2 py-1.5 text-white">{r.reason}</td>
                      <td className="px-2 py-1.5 text-right">{r.trades}</td>
                      <td className="px-2 py-1.5 text-right text-up">{r.wins}</td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          r.losses > 0 ? "text-down" : "text-muted"
                        }`}
                      >
                        {r.losses}
                      </td>
                      <td className="px-2 py-1.5 text-right text-up">
                        {r.winRate.toFixed(1)}%
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          r.avgPnl >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {r.avgPnl >= 0 ? "+" : ""}
                        {r.avgPnl.toFixed(2)}%
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-bold ${
                          r.totalPnl >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {r.totalPnl >= 0 ? "+" : ""}${Math.abs(r.totalPnl).toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">
                        {r.avgDur}
                      </td>
                      <td className="px-2 py-1.5">{r.bestPair}</td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          r.expectancy >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        ${r.expectancy.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── History ── */}
          {btSubTab === "history" && (
            <div className="bt-tab-content flex-1 overflow-auto">
              <table className="w-full text-[13px] font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-muted text-[11px] uppercase tracking-widest">
                    <th className="sortable font-semibold px-2 py-1.5 text-left">#</th>
                    <th className="sortable sort-desc font-semibold px-2 py-1.5 text-left">Run Date</th>
                    <th className="sortable filterable font-semibold px-2 py-1.5 text-left">TF</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-left">Timerange</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Trades</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Profit</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Win%</th>
                    <th className="sortable font-semibold px-2 py-1.5 text-right">Sharpe</th>
                    <th className="font-semibold px-2 py-1.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {mockHistory.map((h) => (
                    <tr
                      key={h.id}
                      className={`hover:bg-white/[0.04] ${h.best ? "bg-up/[0.02]" : ""}`}
                    >
                      <td className={`px-2 py-1.5 ${h.best ? "text-up font-bold" : "text-muted"}`}>
                        {h.best && "★ "}{h.id}
                      </td>
                      <td className="px-2 py-1.5 text-muted">{h.runDate}</td>
                      <td className="px-2 py-1.5">{h.tf}</td>
                      <td className="px-2 py-1.5 text-muted">{h.timerange}</td>
                      <td className="px-2 py-1.5 text-right">{h.trades}</td>
                      <td
                        className={`px-2 py-1.5 text-right font-bold ${
                          h.profit >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {h.profit >= 0 ? "+" : ""}
                        {h.profit.toFixed(2)}%
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {h.winPct.toFixed(1)}%
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${
                          h.sharpe < 0 ? "text-down" : ""
                        }`}
                      >
                        {h.sharpe.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white hover:bg-white/5 transition-colors">
                            Load
                          </button>
                          <button className="px-2 py-0.5 l-bd rounded text-[9px] text-down/60 hover:text-down hover:bg-down/10 transition-colors">
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
  );
}
