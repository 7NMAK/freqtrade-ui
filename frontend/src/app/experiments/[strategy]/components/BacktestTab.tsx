"use client";

import { useState, useMemo } from "react";
import Tooltip from "@/components/ui/Tooltip";

interface BacktestTabProps {
  strategy: string;
}

// ── Toggle switch (matches prototype .toggle) ────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative w-[36px] h-[20px] cursor-pointer inline-block">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="hidden"
      />
      <span
        className={`absolute inset-0 rounded-[10px] border transition-all ${
          checked ? "bg-green/8 border-green" : "bg-bg-3 border-border"
        }`}
      />
      <span
        className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${
          checked ? "left-[19px]" : "left-[3px]"
        }`}
      />
    </label>
  );
}

// ── Mock data for display ────────────────────────────────────────────────
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
  { id: 146, pair: "BTC/USDT", side: "Short", profitPct: "-0.8%", profitAbs: "-$80", open: "2025-12-06 14:10", close: "2025-12-07 08:50", dur: "18h 40m", tag: "BB_DOWN", exit: "stoploss", green: false },
];

const MOCK_HISTORY = [
  { name: "baseline 2026-03-30", date: "Mar 30 14:22", profit: "+12.5%", trades: 156, profitGreen: true, highlight: true },
  { name: "tight bands 2026-03-29", date: "Mar 29 09:15", profit: "+11.8%", trades: 142, profitGreen: true, highlight: false },
  { name: "wide bands 2026-03-28", date: "Mar 28 16:40", profit: "-2.1%", trades: 98, profitGreen: false, highlight: false },
];

const MOCK_COMPARISON = [
  { name: "baseline 2026-03-30", profit: "+12.5%", trades: 156, dd: "-8.4%", highlight: true },
  { name: "tight bands 2026-03-29", profit: "+11.8%", trades: 142, dd: "-7.2%", highlight: false },
  { name: "wide bands 2026-03-28", profit: "-2.1%", trades: 98, dd: "-14.8%", highlight: false },
];

// ══════════════════════════════════════════════════════════════════════════
// BACKTEST TAB — matches prototype Tab 1 pixel-perfect
// ══════════════════════════════════════════════════════════════════════════

export default function BacktestTab({ strategy }: BacktestTabProps) {
  // ── Form state ──
  const [testName, setTestName] = useState(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
  const [description, setDescription] = useState("");
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

  const timerange = useMemo(() => {
    const start = startDate.replace(/-/g, "");
    const end = endDate.replace(/-/g, "");
    return `${start}-${end}`;
  }, [startDate, endDate]);

  const handleStart = () => {
    setIsRunning(true);
    // Placeholder — backend integration pending
    setTimeout(() => setIsRunning(false), 100);
  };

  const handleReset = () => {
    setTestName(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
    setDescription("");
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

  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-5 min-h-0 max-w-full">

      {/* ══════════════ LEFT PANEL: FORM ══════════════ */}
      <div className="bg-bg-1 border border-border rounded-card p-4 overflow-y-auto">
        <div className="text-[13px] font-semibold text-text-0 mb-4 flex items-center gap-2">
          <span>⚙️ Test Configuration</span>
        </div>

        {/* Test Name */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Test Name</label>
          <input
            type="text"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Description (Optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Testing with tighter bands"
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
          />
        </div>

        {/* Strategy (readonly) */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Strategy</label>
          <input
            type="text"
            value={strategy}
            readOnly
            className="w-full py-2 px-3 bg-bg-2 border border-border rounded-btn text-[12.5px] text-text-0 opacity-70 cursor-default"
          />
        </div>

        {/* Start/End Date row */}
        <div className="grid grid-cols-2 gap-[10px] mb-3">
          <div>
            <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
            />
          </div>
        </div>

        {/* Timerange (auto, readonly) */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Timerange</label>
          <input
            type="text"
            value={timerange}
            readOnly
            className="w-full py-2 px-3 bg-bg-2 border border-border rounded-btn text-[12.5px] text-text-0 opacity-70 cursor-default"
          />
        </div>

        {/* Separator — Additional Settings */}
        <div className="border-t border-border mt-4 mb-3 pt-3">
          <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] mb-2 font-semibold">Additional Settings</div>
        </div>

        {/* Timeframe Override */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Timeframe Override</label>
          <select
            value={timeframeOverride}
            onChange={(e) => setTimeframeOverride(e.target.value)}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all"
          >
            <option>Use strategy default</option>
            <option>1m</option>
            <option>5m</option>
            <option>15m</option>
            <option>30m</option>
            <option>1h</option>
            <option>4h</option>
            <option>1d</option>
          </select>
        </div>

        {/* Timeframe Detail */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Timeframe Detail</label>
          <select
            value={timeframeDetail}
            onChange={(e) => setTimeframeDetail(e.target.value)}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all"
          >
            <option>Same as timeframe</option>
            <option>1m</option>
            <option>5m</option>
          </select>
        </div>

        {/* Max Open Trades + Starting Capital row */}
        <div className="grid grid-cols-2 gap-[10px] mb-3">
          <div>
            <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Max Open Trades</label>
            <input
              type="number"
              value={maxOpenTrades}
              onChange={(e) => setMaxOpenTrades(e.target.value)}
              className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Starting Capital ($)</label>
            <input
              type="number"
              value={startingCapital}
              onChange={(e) => setStartingCapital(e.target.value)}
              className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
            />
          </div>
        </div>

        {/* Stake Amount */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Stake Amount ($)</label>
          <input
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
          />
        </div>

        {/* Fee Override */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Fee Override (%)</label>
          <input
            type="number"
            step="0.01"
            value={feeOverride}
            onChange={(e) => setFeeOverride(e.target.value)}
            placeholder="Leave empty for exchange default"
            className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all"
          />
        </div>

        {/* Enable Protections toggle */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">
            <Tooltip content="Enable FT Protections (stoploss, use_sell_signal, etc.)">
              <span className="border-b border-dotted border-text-3 cursor-help">Enable Protections</span>
            </Tooltip>
          </label>
          <Toggle checked={enableProtections} onChange={setEnableProtections} />
        </div>

        {/* Cache Results toggle */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">
            <Tooltip content="Cache results to avoid re-computing">
              <span className="border-b border-dotted border-text-3 cursor-help">Cache Results</span>
            </Tooltip>
          </label>
          <Toggle checked={cacheResults} onChange={setCacheResults} />
        </div>

        {/* Enable FreqAI toggle */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">
            <Tooltip content="Use FreqAI model predictions in backtest">
              <span className="border-b border-dotted border-text-3 cursor-help">Enable FreqAI</span>
            </Tooltip>
          </label>
          <Toggle checked={enableFreqAI} onChange={setEnableFreqAI} />
        </div>

        {/* Export radio chips */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Export</label>
          <div className="flex flex-wrap gap-[6px] mt-[6px]">
            {["none", "trades", "signals"].map((val) => (
              <label
                key={val}
                className={`inline-flex items-center gap-1 py-[5px] px-3 rounded-btn text-[11px] cursor-pointer border transition-all select-none ${
                  exportType === val
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                    : "bg-bg-2 border-border text-text-2 hover:border-[#2e2e48]"
                }`}
              >
                <input
                  type="radio"
                  name="export"
                  value={val}
                  checked={exportType === val}
                  onChange={(e) => setExportType(e.target.value)}
                  className="m-0"
                  style={{ margin: 0 }}
                />
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Breakdown checkbox chips */}
        <div className="mb-3">
          <label className="block text-[10.5px] font-semibold text-text-2 uppercase tracking-[0.5px] mb-[5px]">Breakdown</label>
          <div className="flex flex-wrap gap-[6px] mt-[6px]">
            {([
              { label: "Day", checked: breakdownDay, set: setBreakdownDay },
              { label: "Week", checked: breakdownWeek, set: setBreakdownWeek },
              { label: "Month", checked: breakdownMonth, set: setBreakdownMonth },
            ] as const).map((item) => (
              <span
                key={item.label}
                onClick={() => item.set(!item.checked)}
                className={`inline-flex items-center gap-1 py-[5px] px-3 rounded-btn text-[11px] cursor-pointer border transition-all select-none ${
                  item.checked
                    ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-accent"
                    : "bg-bg-2 border-border text-text-2 hover:border-[#2e2e48]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => item.set(!item.checked)}
                  className="m-0"
                  style={{ margin: 0 }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={handleStart}
            disabled={isRunning}
            className="flex-1 inline-flex items-center justify-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium cursor-pointer border bg-accent border-accent text-white hover:bg-[#5558e6] hover:border-[#5558e6] transition-all whitespace-nowrap disabled:opacity-50"
          >
            ▶️ Start Backtest
          </button>
          <button className="flex-1 inline-flex items-center justify-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3 transition-all whitespace-nowrap">
            📂 Load Result
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            disabled={!isRunning}
            className="flex-1 inline-flex items-center justify-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium cursor-pointer border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)] text-red hover:bg-[rgba(239,68,68,0.15)] transition-all whitespace-nowrap disabled:opacity-50"
          >
            ⏹️ Stop
          </button>
          <button
            onClick={handleReset}
            className="flex-1 inline-flex items-center justify-center gap-[6px] py-[6px] px-[14px] rounded-btn text-[12px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3 transition-all whitespace-nowrap"
          >
            ↻ Reset
          </button>
        </div>

        {/* History card */}
        <div className="bg-bg-1 border border-border rounded-card p-4 mt-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-semibold">📋 History</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ fontSize: "11px" }}>
              <thead>
                <tr>
                  <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Name</th>
                  <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Date</th>
                  <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Profit%</th>
                  <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Trades</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_HISTORY.map((h, i) => (
                  <tr key={i} className="cursor-pointer hover:bg-[rgba(99,102,241,0.03)]">
                    <td className={`py-2 px-[10px] border-b border-border/50 text-[11px] ${h.highlight ? "text-accent" : "text-text-1"}`}>
                      {h.name}
                    </td>
                    <td className="py-2 px-[10px] border-b border-border/50 text-[10px] text-text-3">{h.date}</td>
                    <td className={`py-2 px-[10px] border-b border-border/50 text-[11px] ${h.profitGreen ? "text-green" : "text-red"}`}>{h.profit}</td>
                    <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{h.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════ RIGHT PANEL: RESULTS ══════════════ */}
      <div className="bg-bg-1 border border-border rounded-card p-4 overflow-y-auto">
        <div className="text-[13px] font-semibold text-text-0 mb-4 flex items-center gap-2">
          <span>📊 Results</span>
        </div>

        {/* Stat Grid (3×2) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-bg-1 border border-border rounded-card p-[14px]">
            <div className="text-[10px] uppercase tracking-[0.5px] text-text-3 mb-1 font-semibold">Total Trades</div>
            <div className="text-[18px] font-bold text-text-0">156</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-[14px]">
            <div className="text-[10px] uppercase tracking-[0.5px] text-text-3 mb-1 font-semibold">Win Rate</div>
            <div className="text-[18px] font-bold text-green">64.1%</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-[14px]">
            <div className="text-[10px] uppercase tracking-[0.5px] text-text-3 mb-1 font-semibold">Total Profit</div>
            <div className="text-[18px] font-bold text-green">+$1,247.80</div>
            <div className="text-[10px] text-text-3 mt-[2px]">+12.5%</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-[14px]">
            <div className="text-[10px] uppercase tracking-[0.5px] text-text-3 mb-1 font-semibold">Max Drawdown</div>
            <div className="text-[18px] font-bold text-red">-8.4%</div>
            <div className="text-[10px] text-text-3 mt-[2px]">-$840.00</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-[14px]">
            <div className="text-[10px] uppercase tracking-[0.5px] text-text-3 mb-1 font-semibold">
              <Tooltip content="Risk-adjusted return metric">
                <span className="border-b border-dotted border-text-3 cursor-help">Sharpe Ratio</span>
              </Tooltip>
            </div>
            <div className="text-[18px] font-bold text-text-0">1.52</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-[14px]">
            <div className="text-[10px] uppercase tracking-[0.5px] text-text-3 mb-1 font-semibold">
              <Tooltip content="Downside deviation metric">
                <span className="border-b border-dotted border-text-3 cursor-help">Sortino Ratio</span>
              </Tooltip>
            </div>
            <div className="text-[18px] font-bold text-text-0">2.14</div>
          </div>
        </div>

        {/* Equity Curve */}
        <div className="mt-5 mb-0 relative" style={{ height: 200, background: "var(--bg-1)" }}>
          <svg
            style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="equityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <polyline
              points="0,180 15,175 30,168 45,162 60,158 75,152 90,148 105,145 120,138 135,132 150,125 165,118 180,110 195,105 210,98 225,92 240,85 255,78 270,72 285,65 300,58 315,52 330,45 345,38 360,32 375,28 390,22 400,18"
              style={{ fill: "url(#equityGrad)", stroke: "#22c55e", strokeWidth: 2, strokeLinejoin: "round" }}
            />
          </svg>
        </div>
        <div className="text-[10px] py-2 text-text-2">
          Equity Growth: +12.5% (BTC/USDT:USDT)
        </div>

        {/* Trades Table */}
        <div className="text-[10px] text-text-3 uppercase tracking-[0.5px] mb-2 font-semibold mt-5">
          Recent Trades
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontSize: "11px" }}>
            <thead>
              <tr>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">#</th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Pair</th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Side</th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Profit%</th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Profit$</th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                  <Tooltip content="FT: open_date">
                    <span className="border-b border-dotted border-text-3 cursor-help">Open</span>
                  </Tooltip>
                </th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                  <Tooltip content="FT: close_date">
                    <span className="border-b border-dotted border-text-3 cursor-help">Close</span>
                  </Tooltip>
                </th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">Dur</th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                  <Tooltip content="FT: enter_tag">
                    <span className="border-b border-dotted border-text-3 cursor-help">Tag</span>
                  </Tooltip>
                </th>
                <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                  <Tooltip content="FT: exit_reason">
                    <span className="border-b border-dotted border-text-3 cursor-help">Exit Reason</span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TRADES.map((t) => (
                <tr key={t.id} className="hover:bg-[rgba(99,102,241,0.03)]">
                  <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{t.id}</td>
                  <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1 font-semibold">{t.pair}</td>
                  <td className="py-2 px-[10px] border-b border-border/50 text-[11px]">
                    <span
                      className={`inline-flex items-center px-2 py-[2px] rounded-full text-[10px] font-semibold uppercase tracking-[0.3px] ${
                        t.side === "Long"
                          ? "bg-[rgba(34,197,94,0.08)] text-green border border-[rgba(34,197,94,0.25)]"
                          : "bg-[rgba(239,68,68,0.08)] text-red border border-[rgba(239,68,68,0.25)]"
                      }`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className={`py-2 px-[10px] border-b border-border/50 text-[11px] ${t.green ? "text-green" : "text-red"}`}>{t.profitPct}</td>
                  <td className={`py-2 px-[10px] border-b border-border/50 text-[11px] ${t.green ? "text-green" : "text-red"}`}>{t.profitAbs}</td>
                  <td className="py-2 px-[10px] border-b border-border/50 text-[10px] text-text-1">{t.open}</td>
                  <td className="py-2 px-[10px] border-b border-border/50 text-[10px] text-text-1">{t.close}</td>
                  <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{t.dur}</td>
                  <td className="py-2 px-[10px] border-b border-border/50 text-[11px]">
                    <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[10px] font-semibold uppercase tracking-[0.3px] bg-[rgba(245,158,11,0.08)] text-amber border border-[rgba(245,158,11,0.25)]">
                      {t.tag}
                    </span>
                  </td>
                  <td className="py-2 px-[10px] border-b border-border/50 text-[11px] text-text-1">{t.exit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between py-2 text-[11px] text-text-2">
          <span>Showing 1-10 of 156</span>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-[6px] py-1 px-[10px] rounded-btn text-[11px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3 transition-all">
              ← Prev
            </button>
            <button className="inline-flex items-center gap-[6px] py-1 px-[10px] rounded-btn text-[11px] font-medium cursor-pointer border border-border bg-bg-2 text-text-1 hover:border-[#2e2e48] hover:bg-bg-3 transition-all">
              Next →
            </button>
          </div>
        </div>

        {/* Comparison Summary */}
        <div className="mt-5">
          <div className="text-[13px] font-semibold text-text-0 mb-3">📈 Recent Test Summaries</div>
          <div className="grid grid-cols-3 gap-2" style={{ fontSize: "11px" }}>
            {MOCK_COMPARISON.map((c, i) => (
              <div key={i} className="bg-bg-3 p-2 rounded-btn">
                <div className={`font-semibold mb-1 ${c.highlight ? "text-accent" : "text-text-2"}`}>{c.name}</div>
                <div className="text-text-1">
                  Profit: <span className={c.profit.startsWith("+") ? "text-green" : "text-red"}>{c.profit}</span>
                </div>
                <div className="text-text-1">Trades: {c.trades}</div>
                <div className="text-text-1">
                  DD: <span className="text-red">{c.dd}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
