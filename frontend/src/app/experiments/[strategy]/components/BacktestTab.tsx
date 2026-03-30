"use client";

import { useState, useMemo } from "react";
import Tooltip from "@/components/ui/Tooltip";

interface BacktestTabProps {
  strategy: string;
}

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

// ── Shared input class ───────────────────────────────────────────────────
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// ── Mock data ────────────────────────────────────────────────────────────
const MOCK_TRADES = [
  { id: 156, pair: "BTC/USDT", side: "Long", profitPct: "+4.2%", profitAbs: "+$420", open: "2025-12-28 14:30", close: "2026-01-02 08:15", dur: "3d 17h", tag: "BB_UP", exit: "roi", green: true },
  { id: 155, pair: "BTC/USDT", side: "Short", profitPct: "+2.8%", profitAbs: "+$280", open: "2025-12-25 09:00", close: "2025-12-26 16:45", dur: "1d 7h", tag: "BB_DOWN", exit: "roi", green: true },
  { id: 154, pair: "BTC/USDT", side: "Long", profitPct: "-1.5%", profitAbs: "-$150", open: "2025-12-22 11:30", close: "2025-12-22 18:20", dur: "6h 50m", tag: "BB_UP", exit: "stoploss", green: false },
  { id: 153, pair: "BTC/USDT", side: "Long", profitPct: "+3.1%", profitAbs: "+$310", open: "2025-12-20 13:15", close: "2025-12-21 09:40", dur: "20h 25m", tag: "BB_UP", exit: "sell_signal", green: true },
  { id: 152, pair: "BTC/USDT", side: "Short", profitPct: "+5.4%", profitAbs: "+$540", open: "2025-12-18 10:00", close: "2025-12-19 14:30", dur: "1d 4h", tag: "BB_DOWN", exit: "roi", green: true },
  { id: 151, pair: "BTC/USDT", side: "Long", profitPct: "+2.3%", profitAbs: "+$230", open: "2025-12-16 15:45", close: "2025-12-17 11:20", dur: "19h 35m", tag: "BB_UP", exit: "roi", green: true },
  { id: 150, pair: "BTC/USDT", side: "Short", profitPct: "-3.2%", profitAbs: "-$320", open: "2025-12-14 08:30", close: "2025-12-14 22:15", dur: "13h 45m", tag: "BB_DOWN", exit: "stoploss", green: false },
  { id: 149, pair: "BTC/USDT", side: "Long", profitPct: "+1.9%", profitAbs: "+$190", open: "2025-12-12 12:00", close: "2025-12-13 06:30", dur: "18h 30m", tag: "BB_UP", exit: "roi", green: true },
  { id: 148, pair: "BTC/USDT", side: "Short", profitPct: "+4.7%", profitAbs: "+$470", open: "2025-12-10 16:20", close: "2025-12-11 13:40", dur: "21h 20m", tag: "BB_DOWN", exit: "roi", green: true },
  { id: 147, pair: "BTC/USDT", side: "Long", profitPct: "+3.6%", profitAbs: "+$360", open: "2025-12-08 09:45", close: "2025-12-09 10:15", dur: "24h 30m", tag: "BB_UP", exit: "roi", green: true },
];

const MOCK_HISTORY = [
  { name: "baseline 2026-03-30", date: "Mar 30 14:22", profit: "+12.5%", trades: 156, profitGreen: true, highlight: true },
  { name: "tight bands 2026-03-29", date: "Mar 29 09:15", profit: "+11.8%", trades: 142, profitGreen: true, highlight: false },
  { name: "wide bands 2026-03-28", date: "Mar 28 16:40", profit: "-2.1%", trades: 98, profitGreen: false, highlight: false },
];

const MOCK_COMPARISON = [
  { name: "baseline 03-30", profit: "+12.5%", trades: 156, dd: "-8.4%", highlight: true },
  { name: "tight bands 03-29", profit: "+11.8%", trades: 142, dd: "-7.2%", highlight: false },
  { name: "wide bands 03-28", profit: "-2.1%", trades: 98, dd: "-14.8%", highlight: false },
];

// ══════════════════════════════════════════════════════════════════════════
export default function BacktestTab({ strategy }: BacktestTabProps) {
  const [testName, setTestName] = useState(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [timeframeOverride, setTimeframeOverride] = useState("Use strategy default");
  const [timeframeDetail, setTimeframeDetail] = useState("Same as timeframe");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [startingCapital, setStartingCapital] = useState("10000");
  const [stakeAmount, setStakeAmount] = useState("100");
  const [feeOverride, setFeeOverride] = useState("");
  const [enableProtections, setEnableProtections] = useState(false);
  const [cacheResults, setCacheResults] = useState(true);
  const [enableFreqAI, setEnableFreqAI] = useState(false);
  const [exportType, setExportType] = useState("none");
  const [breakdownDay, setBreakdownDay] = useState(false);
  const [breakdownWeek, setBreakdownWeek] = useState(false);
  const [breakdownMonth, setBreakdownMonth] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month">("month");

  // Auto-generate description from current settings
  const autoDescription = useMemo(() => {
    const tf = timeframeOverride === "Use strategy default" ? "default TF" : timeframeOverride;
    const parts = [
      `${strategy} backtest`,
      `${startDate} → ${endDate}`,
      tf,
      `${maxOpenTrades} max trades`,
      `$${startingCapital} capital`,
      enableFreqAI ? "FreqAI ON" : null,
      enableProtections ? "Protections ON" : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }, [strategy, startDate, endDate, timeframeOverride, maxOpenTrades, startingCapital, enableFreqAI, enableProtections]);

  const handleStart = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 100);
  };

  const handleReset = () => {
    setTestName(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
    setStartDate("2024-01-01");
    setEndDate("2025-01-01");
    setTimeframeOverride("Use strategy default");
    setTimeframeDetail("Same as timeframe");
    setMaxOpenTrades("3");
    setStartingCapital("10000");
    setStakeAmount("100");
    setFeeOverride("");
    setEnableProtections(false);
    setCacheResults(true);
    setEnableFreqAI(false);
    setExportType("none");
    setBreakdownDay(false);
    setBreakdownWeek(false);
    setBreakdownMonth(true);
  };

  // Chart data per period
  const chartData = useMemo(() => {
    if (chartPeriod === "day") {
      return { points: "0,58 8,57 16,55 24,54 32,52 40,50 48,53 56,55 64,57 72,59 80,62 88,60 96,57 104,54 112,51 120,48 128,45 136,42 144,39 152,36 160,33 168,30 176,28 184,26 192,24 200,22 208,20 216,18 224,17 232,16 240,14 248,13 256,12 264,11 272,10 280,9 288,8 296,7 304,7 312,6 320,5 328,5 336,4 344,4 352,3 360,3", labels: ["Jan 1","Jan 15","Feb 1","Feb 15","Mar 1"], final: "+$1,248", low: "-$120", lowX: 80, lowY: 62 };
    } else if (chartPeriod === "week") {
      return { points: "0,58 20,55 40,51 60,47 80,50 100,54 120,56 140,52 160,48 180,44 200,40 220,36 240,32 260,28 280,24 300,20 320,16 340,12 360,8", labels: ["W1","W8","W16","W24","W32","W40","W48"], final: "+$1,248", low: "-$180", lowX: 120, lowY: 56 };
    }
    return { points: "0,58 30,54 60,50 90,53 120,57 150,60 180,55 210,49 240,43 270,37 300,31 330,23 360,15", labels: ["Jan","Apr","Jul","Oct","Jan"], final: "+$1,248", low: "-$30", lowX: 150, lowY: 60 };
  }, [chartPeriod]);

  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-0 max-w-full">

      {/* ═══════════ LEFT PANEL: FORM ═══════════ */}
      <div className="bg-bg-1 border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col gap-[10px]">
        <div className="text-[13px] font-semibold text-text-0 flex items-center gap-2">⚙️ Test Configuration</div>

        {/* Test Name */}
        <div>
          <label className={LABEL}>Test Name</label>
          <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className={INPUT} />
        </div>

        {/* Description (auto-generated) */}
        <div>
          <label className={LABEL}>Description</label>
          <div className="w-full px-3 py-[7px] bg-bg-2 border border-border rounded-btn text-[11px] text-text-2 leading-[1.5]">
            {autoDescription}
          </div>
          <div className="text-[9px] text-text-3 mt-[2px]">Auto-generated from settings</div>
        </div>

        {/* Strategy (readonly) */}
        <div>
          <label className={LABEL}>Strategy</label>
          <input type="text" value={strategy} readOnly className={`${INPUT} bg-bg-2 opacity-70 cursor-default`} />
        </div>

        {/* Start/End Date row — NO separate timerange field */}
        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
          </div>
        </div>

        {/* Timeframe Override + Detail row */}
        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Timeframe Override</label>
            <select value={timeframeOverride} onChange={(e) => setTimeframeOverride(e.target.value)} className={SELECT}>
              <option>Use strategy default</option>
              <option>1m</option><option>5m</option><option>15m</option><option>30m</option>
              <option>1h</option><option>4h</option><option>1d</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Timeframe Detail</label>
            <select value={timeframeDetail} onChange={(e) => setTimeframeDetail(e.target.value)} className={SELECT}>
              <option>Same as timeframe</option>
              <option>1m</option><option>5m</option>
            </select>
          </div>
        </div>

        {/* Max Trades + Starting Capital */}
        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Max Open Trades</label>
            <input type="number" value={maxOpenTrades} onChange={(e) => setMaxOpenTrades(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Starting Capital ($)</label>
            <input type="number" value={startingCapital} onChange={(e) => setStartingCapital(e.target.value)} className={INPUT} />
          </div>
        </div>

        {/* Stake + Fee row */}
        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className={LABEL}>Stake Amount ($)</label>
            <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Fee Override (%)</label>
            <input type="number" step="0.01" value={feeOverride} onChange={(e) => setFeeOverride(e.target.value)} placeholder="Exchange default" className={INPUT} />
          </div>
        </div>

        {/* Toggles — all visible, no dropdown */}
        <div className="flex flex-col gap-[8px] mt-1">
          <Tooltip content="Enable FT Protections (stoploss, use_sell_signal, etc.) — FT: --enable-protections">
            <div><Toggle checked={enableProtections} onChange={setEnableProtections} label="Enable Protections" /></div>
          </Tooltip>
          <Tooltip content="Cache results to avoid re-computing — FT: --cache">
            <div><Toggle checked={cacheResults} onChange={setCacheResults} label="Cache Results" /></div>
          </Tooltip>
          <Tooltip content="Use FreqAI model predictions in backtest — FT: --freqaimodel">
            <div><Toggle checked={enableFreqAI} onChange={setEnableFreqAI} label="Enable FreqAI" /></div>
          </Tooltip>
        </div>

        {/* Export */}
        <div>
          <label className={LABEL}>Export</label>
          <div className="flex gap-[6px]">
            {["none", "trades", "signals"].map((val) => (
              <label key={val} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-[11px] cursor-pointer border transition-all select-none ${exportType === val ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent" : "bg-bg-2 border-border text-text-2 hover:border-[#2e2e48]"}`}>
                <input type="radio" name="export" value={val} checked={exportType === val} onChange={(e) => setExportType(e.target.value)} className="hidden" />
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Breakdown */}
        <div>
          <label className={LABEL}>Breakdown</label>
          <div className="flex gap-[6px]">
            {([
              { label: "Day", checked: breakdownDay, set: setBreakdownDay },
              { label: "Week", checked: breakdownWeek, set: setBreakdownWeek },
              { label: "Month", checked: breakdownMonth, set: setBreakdownMonth },
            ] as const).map((item) => (
              <span key={item.label} onClick={() => item.set(!item.checked)} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-[11px] cursor-pointer border transition-all select-none ${item.checked ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent" : "bg-bg-2 border-border text-text-2 hover:border-[#2e2e48]"}`}>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons — 2 rows */}
        <div className="flex gap-[6px] mt-1">
          <button onClick={handleStart} disabled={isRunning} className="flex-1 h-[32px] rounded-btn text-[12px] font-semibold border bg-accent border-accent text-white hover:bg-[#5558e6] transition-all disabled:opacity-50">
            {isRunning ? "⏳ Running..." : "▶ Start Backtest"}
          </button>
          <button disabled={!isRunning} className="h-[32px] px-3 rounded-btn text-[12px] font-semibold border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)] text-red hover:bg-[rgba(239,68,68,0.15)] transition-all disabled:opacity-50">
            ⏹ Stop
          </button>
          <button onClick={handleReset} className="h-[32px] px-3 rounded-btn text-[12px] font-semibold border border-border bg-bg-2 text-text-1 hover:bg-bg-3 transition-all">
            ↻
          </button>
        </div>

        {/* History */}
        <div className="mt-2">
          <div className="text-[11px] font-semibold text-text-1 mb-2">📋 History</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Name","Date","Profit%","Trades"].map(h => (
                    <th key={h} className="py-[6px] px-2 text-left text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_HISTORY.map((h, i) => (
                  <tr key={i} className="cursor-pointer hover:bg-[rgba(99,102,241,0.03)]">
                    <td className={`py-[5px] px-2 border-b border-border/50 text-[10px] ${h.highlight ? "text-accent font-semibold" : "text-text-1"}`}>{h.name}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[9px] text-text-3">{h.date}</td>
                    <td className={`py-[5px] px-2 border-b border-border/50 text-[10px] font-semibold ${h.profitGreen ? "text-green" : "text-red"}`}>{h.profit}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[10px] text-text-1">{h.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL: RESULTS (always visible) ═══════════ */}
      <div className="bg-bg-1 border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col gap-4">
        <div className="text-[13px] font-semibold text-text-0 flex items-center gap-2">📊 Results — baseline 2026-03-30</div>

        {/* Stat Grid 3×2 — compact */}
        <div className="grid grid-cols-3 gap-[8px]">
          {[
            { label: "Total Trades", value: "156", color: "text-text-0" },
            { label: "Win Rate", value: "64.1%", color: "text-green" },
            { label: "Total Profit", value: "+$1,247.80", color: "text-green", sub: "+12.5%" },
            { label: "Max Drawdown", value: "-8.4%", color: "text-red", sub: "-$840" },
            { label: "Sharpe Ratio", value: "1.52", color: "text-text-0", tip: "Risk-adjusted return metric" },
            { label: "Sortino Ratio", value: "2.14", color: "text-text-0", tip: "Downside deviation metric" },
          ].map((s, i) => (
            <div key={i} className="bg-bg-2 border border-border rounded-btn p-[10px]">
              <div className="text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold mb-[2px]">
                {s.tip ? (
                  <Tooltip content={s.tip}><span className="border-b border-dotted border-text-3 cursor-help">{s.label}</span></Tooltip>
                ) : s.label}
              </div>
              <div className={`text-[16px] font-bold ${s.color}`}>{s.value}</div>
              {s.sub && <div className="text-[9px] text-text-3 mt-[1px]">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Equity Curve — compact with working period switcher */}
        <div>
          <div className="flex items-center justify-between mb-[6px]">
            <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold">Cumulative Profit</div>
            <div className="flex items-center gap-[6px]">
              <div className="flex bg-bg-3 rounded-[4px] p-[2px]">
                {(["day","week","month"] as const).map(p => (
                  <button key={p} onClick={() => setChartPeriod(p)} className={`px-[8px] py-[2px] rounded-[3px] text-[9px] font-semibold transition-all ${chartPeriod === p ? "bg-accent text-white" : "text-text-3 hover:text-text-1"}`}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-[8px] text-[9px] text-text-3">
                <span className="flex items-center gap-[3px]"><span className="w-[6px] h-[6px] rounded-full bg-green inline-block" /> Profit</span>
                <span className="flex items-center gap-[3px]"><span className="w-[6px] h-[2px] bg-text-3 inline-block" /> $0</span>
              </div>
            </div>
          </div>
          <div className="bg-bg-2 border border-border rounded-btn h-[130px] relative overflow-hidden" style={{ padding: "0 16px 16px 36px" }}>
            <svg width="100%" height="100%" viewBox="0 0 360 65" preserveAspectRatio="none" style={{ position: "absolute", top: 4, left: 36, width: "calc(100% - 52px)", height: "calc(100% - 20px)" }}>
              {/* Grid */}
              <line x1="0" y1="16" x2="360" y2="16" stroke="#1e1e30" strokeWidth="0.5" />
              <line x1="0" y1="32" x2="360" y2="32" stroke="#1e1e30" strokeWidth="0.5" />
              <line x1="0" y1="48" x2="360" y2="48" stroke="#1e1e30" strokeWidth="0.5" />
              <line x1="0" y1="32" x2="360" y2="32" stroke="#55556a" strokeWidth="0.5" strokeDasharray="3,2" />
              {/* Fill */}
              <defs>
                <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <polygon points={`0,60 ${chartData.points} 360,60`} fill="url(#btGrad)" />
              <polyline points={chartData.points} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
              {/* Low marker */}
              <circle cx={chartData.lowX} cy={chartData.lowY} r="2.5" fill="#ef4444" />
              <text x={chartData.lowX} y={chartData.lowY + 8} fontSize="5" fill="#ef4444" textAnchor="middle">{chartData.low}</text>
              {/* Final */}
              <text x="358" y="6" fontSize="5" fill="#22c55e" textAnchor="end" fontWeight="600">{chartData.final}</text>
            </svg>
            {/* Y-axis */}
            <div className="absolute top-0 left-0 w-[34px] h-[calc(100%-16px)] flex flex-col justify-between py-[3px] px-[2px] text-[7px] text-text-3 text-right">
              <span>+$1.2k</span><span>$0</span><span>-$500</span>
            </div>
            {/* X-axis */}
            <div className="absolute bottom-[2px] left-[36px] right-[16px] flex justify-between text-[7px] text-text-3">
              {chartData.labels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>
          <div className="text-[9px] text-text-2 mt-[3px]">Equity Growth: +12.5% · BTC/USDT:USDT · {startDate} → {endDate}</div>
        </div>

        {/* Trades Table */}
        <div>
          <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-[6px]">Recent Trades</div>
          <div className="overflow-x-auto border border-border rounded-btn">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg-2">
                  {["#","Pair","Side","Profit%","Profit$"].map(h => (
                    <th key={h} className="py-[6px] px-2 text-left text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">{h}</th>
                  ))}
                  <th className="py-[6px] px-2 text-left text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                    <Tooltip content="FT: open_date"><span className="border-b border-dotted border-text-3 cursor-help">Open</span></Tooltip>
                  </th>
                  <th className="py-[6px] px-2 text-left text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                    <Tooltip content="FT: close_date"><span className="border-b border-dotted border-text-3 cursor-help">Close</span></Tooltip>
                  </th>
                  <th className="py-[6px] px-2 text-left text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Dur</th>
                  <th className="py-[6px] px-2 text-left text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                    <Tooltip content="FT: enter_tag"><span className="border-b border-dotted border-text-3 cursor-help">Tag</span></Tooltip>
                  </th>
                  <th className="py-[6px] px-2 text-left text-[9px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                    <Tooltip content="FT: exit_reason"><span className="border-b border-dotted border-text-3 cursor-help">Exit</span></Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_TRADES.map((t) => (
                  <tr key={t.id} className="hover:bg-[rgba(99,102,241,0.03)]">
                    <td className="py-[5px] px-2 border-b border-border/50 text-[10px] text-text-2">{t.id}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[10px] text-text-0 font-semibold">{t.pair}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[10px]">
                      <span className={`inline-flex items-center px-[6px] py-[1px] rounded-full text-[9px] font-semibold uppercase ${t.side === "Long" ? "bg-[rgba(34,197,94,0.08)] text-green border border-[rgba(34,197,94,0.25)]" : "bg-[rgba(239,68,68,0.08)] text-red border border-[rgba(239,68,68,0.25)]"}`}>{t.side}</span>
                    </td>
                    <td className={`py-[5px] px-2 border-b border-border/50 text-[10px] font-semibold ${t.green ? "text-green" : "text-red"}`}>{t.profitPct}</td>
                    <td className={`py-[5px] px-2 border-b border-border/50 text-[10px] ${t.green ? "text-green" : "text-red"}`}>{t.profitAbs}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[9px] text-text-2">{t.open}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[9px] text-text-2">{t.close}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[10px] text-text-2">{t.dur}</td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[10px]">
                      <span className="inline-flex items-center px-[6px] py-[1px] rounded-full text-[9px] font-semibold uppercase bg-[rgba(245,158,11,0.08)] text-amber border border-[rgba(245,158,11,0.25)]">{t.tag}</span>
                    </td>
                    <td className="py-[5px] px-2 border-b border-border/50 text-[10px] text-text-2">{t.exit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between py-[6px] text-[10px] text-text-3">
            <span>Showing 1-10 of 156</span>
            <div className="flex gap-[4px]">
              <button className="h-[24px] px-[8px] rounded-btn text-[10px] font-medium border border-border bg-bg-2 text-text-2 hover:bg-bg-3 transition-all">← Prev</button>
              <button className="h-[24px] px-[8px] rounded-btn text-[10px] font-medium border border-border bg-bg-2 text-text-2 hover:bg-bg-3 transition-all">Next →</button>
            </div>
          </div>
        </div>

        {/* Comparison Summary — compact */}
        <div>
          <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] font-semibold mb-[6px]">Recent Test Summaries</div>
          <div className="grid grid-cols-3 gap-[6px]">
            {MOCK_COMPARISON.map((c, i) => (
              <div key={i} className="bg-bg-3 p-[8px] rounded-btn text-[10px]">
                <div className={`font-semibold mb-[3px] ${c.highlight ? "text-accent" : "text-text-2"}`}>{c.name}</div>
                <div className="text-text-2">Profit: <span className={c.profit.startsWith("+") ? "text-green" : "text-red"}>{c.profit}</span></div>
                <div className="text-text-2">Trades: {c.trades}</div>
                <div className="text-text-2">DD: <span className="text-red">{c.dd}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
