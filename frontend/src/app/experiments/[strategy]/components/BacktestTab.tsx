"use client";

import { useState, useMemo } from "react";
import { fmtPct, fmtUsd, profitColor } from "@/lib/experiments";
import Tooltip from "@/components/ui/Tooltip";
import { ChevronDown } from "lucide-react";

interface BacktestTabProps {
  strategy: string;
}

interface BacktestResult {
  id: string;
  trades: number;
  winRate: number;
  totalProfit: number;
  totalProfitPct: number;
  maxDrawdown: number;
  maxDrawdownAbs: number;
  sharpeRatio: number;
  sortinoRatio: number;
  cumulativeProfit: number[];
  tradesList: Trade[];
  startDate: string;
  endDate: string;
  timerange: string;
}

interface Trade {
  id: number;
  pair: string;
  isShort: boolean;
  profitPct: number;
  profitAbs: number;
  openDate: string;
  closeDate: string;
  duration: string;
  enterTag: string;
  exitReason: string;
}

const generateMockResults = (startDate: string, endDate: string): BacktestResult => {
  const cumulativeProfit = Array.from({ length: 156 }, (_, i) => {
    const base = Math.sin(i / 20) * 800;
    const trend = (i / 156) * 1247;
    const noise = (Math.random() - 0.5) * 200;
    return base + trend + noise;
  });

  const mockTrades: Trade[] = [
    { id: 1, pair: "BTC/USDT", isShort: false, profitPct: 3.2, profitAbs: 320, openDate: "2024-01-15 10:45", closeDate: "2024-01-15 14:30", duration: "3h 45m", enterTag: "macd_cross", exitReason: "exit_signal" },
    { id: 2, pair: "ETH/USDT", isShort: true, profitPct: -1.8, profitAbs: -180, openDate: "2024-01-16 08:12", closeDate: "2024-01-16 11:20", duration: "3h 8m", enterTag: "bb_lower", exitReason: "stoploss" },
    { id: 3, pair: "BTC/USDT", isShort: false, profitPct: 5.4, profitAbs: 540, openDate: "2024-01-17 09:30", closeDate: "2024-01-17 16:45", duration: "7h 15m", enterTag: "rsi_oversold", exitReason: "exit_signal" },
    { id: 4, pair: "SOL/USDT", isShort: false, profitPct: 2.1, profitAbs: 210, openDate: "2024-01-18 12:00", closeDate: "2024-01-18 15:45", duration: "3h 45m", enterTag: "macd_cross", exitReason: "exit_signal" },
    { id: 5, pair: "ETH/USDT", isShort: false, profitPct: 4.7, profitAbs: 470, openDate: "2024-01-19 07:30", closeDate: "2024-01-19 13:20", duration: "5h 50m", enterTag: "bb_lower", exitReason: "exit_signal" },
    { id: 6, pair: "BTC/USDT", isShort: true, profitPct: -2.3, profitAbs: -230, openDate: "2024-01-20 14:15", closeDate: "2024-01-20 17:30", duration: "3h 15m", enterTag: "rsi_overbought", exitReason: "stoploss" },
    { id: 7, pair: "XRP/USDT", isShort: false, profitPct: 6.1, profitAbs: 610, openDate: "2024-01-21 10:00", closeDate: "2024-01-21 18:45", duration: "8h 45m", enterTag: "trend_up", exitReason: "exit_signal" },
    { id: 8, pair: "ADA/USDT", isShort: false, profitPct: 1.9, profitAbs: 190, openDate: "2024-01-22 11:30", closeDate: "2024-01-22 14:15", duration: "2h 45m", enterTag: "macd_cross", exitReason: "exit_signal" },
    { id: 9, pair: "ETH/USDT", isShort: true, profitPct: -3.5, profitAbs: -350, openDate: "2024-01-23 09:00", closeDate: "2024-01-23 10:45", duration: "1h 45m", enterTag: "rsi_overbought", exitReason: "stoploss" },
    { id: 10, pair: "BTC/USDT", isShort: false, profitPct: 8.2, profitAbs: 820, openDate: "2024-01-24 08:30", closeDate: "2024-01-24 16:00", duration: "7h 30m", enterTag: "bb_lower", exitReason: "exit_signal" },
  ];

  return {
    id: `backtest_${Date.now()}`,
    trades: 156,
    winRate: 64.1,
    totalProfit: 1247.80,
    totalProfitPct: 12.5,
    maxDrawdown: -8.4,
    maxDrawdownAbs: -840.00,
    sharpeRatio: 1.52,
    sortinoRatio: 2.14,
    cumulativeProfit,
    tradesList: mockTrades,
    startDate,
    endDate,
    timerange: `${startDate.replace(/-/g, "")}-${endDate.replace(/-/g, "")}`,
  };
};

const MOCK_HISTORY: Array<{ strategy: string; date: string; timerange: string; trades: number; profitPct: number }> = [
  { strategy: "SampleStrategy", date: "2024-03-28 14:32:15", timerange: "20240101-20250101", trades: 156, profitPct: 12.5 },
  { strategy: "SampleStrategy", date: "2024-03-27 09:15:42", timerange: "20240101-20240630", trades: 98, profitPct: 8.3 },
  { strategy: "SampleStrategy", date: "2024-03-26 16:45:20", timerange: "20231201-20240229", trades: 142, profitPct: 15.2 },
];

export default function BacktestTab({ strategy }: BacktestTabProps) {
  const [testName, setTestName] = useState(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [timeframeOverride, setTimeframeOverride] = useState("Use strategy default");
  const [timeframeDetail, setTimeframeDetail] = useState("None");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [startingCapital, setStartingCapital] = useState("10000");
  const [stakeAmount, setStakeAmount] = useState("1000");
  const [feeOverride, setFeeOverride] = useState("");
  const [enableProtections, setEnableProtections] = useState(true);
  const [cacheResults, setCacheResults] = useState(true);
  const [enableFreqAI, setEnableFreqAI] = useState(false);
  const [exportType, setExportType] = useState("none");
  const [breakdownDay, setBreakdownDay] = useState(false);
  const [breakdownWeek, setBreakdownWeek] = useState(false);
  const [breakdownMonth, setBreakdownMonth] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [results, setResults] = useState<BacktestResult | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"day" | "week" | "month">("month");
  const [currentPage, setCurrentPage] = useState(1);

  const timerange = useMemo(() => {
    const start = startDate.replace(/-/g, "");
    const end = endDate.replace(/-/g, "");
    return `${start}-${end}`;
  }, [startDate, endDate]);

  const handleStartBacktest = async () => {
    setIsRunning(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const mockResults = generateMockResults(startDate, endDate);
    setResults(mockResults);
    setIsRunning(false);
  };

  const handleLoadResult = (index: number) => {
    const history = MOCK_HISTORY[index];
    const mockResults = generateMockResults(
      history.timerange.slice(0, 4) + "-" + history.timerange.slice(4, 6) + "-" + history.timerange.slice(6, 8),
      history.timerange.slice(9, 13) + "-" + history.timerange.slice(13, 15) + "-" + history.timerange.slice(15, 17)
    );
    setResults(mockResults);
  };

  const handleReset = () => {
    setResults(null);
    setTestName(`${strategy} baseline ${new Date().toISOString().split("T")[0]}`);
    setDescription("");
    setStartDate("2024-01-01");
    setEndDate("2025-01-01");
    setTimeframeOverride("Use strategy default");
    setTimeframeDetail("None");
    setMaxOpenTrades("3");
    setStartingCapital("10000");
    setStakeAmount("1000");
    setFeeOverride("");
    setEnableProtections(true);
    setCacheResults(true);
    setEnableFreqAI(false);
    setExportType("none");
    setBreakdownDay(false);
    setBreakdownWeek(false);
    setBreakdownMonth(true);
    setCurrentPage(1);
  };

  const profitColor_ = profitColor(results?.totalProfitPct || 0);
  const drawdownColor = profitColor(results?.maxDrawdown || 0);

  return (
    <div className="flex gap-6 h-full">
      {/* LEFT PANEL - FORM */}
      <div className="w-[380px] shrink-0 flex flex-col gap-6 overflow-y-auto pr-2">
        {/* Test Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-0">Test Configuration</h3>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-2">Test Name</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent"
              placeholder="Test name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-2">Strategy</label>
            <input
              type="text"
              value={strategy}
              disabled
              className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-xs text-text-1 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-1 mb-2">Timerange</label>
            <input
              type="text"
              value={timerange}
              disabled
              className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-xs text-text-2 cursor-not-allowed font-mono"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <details className="group">
          <summary
            className="flex items-center justify-between cursor-pointer text-sm font-semibold text-text-0 hover:text-accent transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Advanced Options
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          </summary>

          <div className="space-y-4 mt-4 pt-4 border-t border-border">
            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Timeframe Override</label>
              <select
                value={timeframeOverride}
                onChange={(e) => setTimeframeOverride(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 focus:outline-none focus:border-accent"
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

            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Timeframe Detail</label>
              <select
                value={timeframeDetail}
                onChange={(e) => setTimeframeDetail(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 focus:outline-none focus:border-accent"
              >
                <option>None</option>
                <option>1m</option>
                <option>5m</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Max Open Trades</label>
              <input
                type="number"
                value={maxOpenTrades}
                onChange={(e) => setMaxOpenTrades(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Starting Capital</label>
              <input
                type="number"
                value={startingCapital}
                onChange={(e) => setStartingCapital(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Stake Amount</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Fee Override (%)</label>
              <input
                type="number"
                step="0.01"
                value={feeOverride}
                onChange={(e) => setFeeOverride(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent"
                placeholder="Leave blank to use exchange default"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Tooltip content="Enable trading protections during backtest (FT: --enable-protections)">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableProtections}
                      onChange={(e) => setEnableProtections(e.target.checked)}
                      className="w-4 h-4 rounded border border-border bg-bg-2 accent-accent cursor-pointer"
                    />
                    <span className="text-xs text-text-1">Enable Protections</span>
                  </label>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip content="Cache results to avoid re-computing (FT: --cache)">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cacheResults}
                      onChange={(e) => setCacheResults(e.target.checked)}
                      className="w-4 h-4 rounded border border-border bg-bg-2 accent-accent cursor-pointer"
                    />
                    <span className="text-xs text-text-1">Cache Results</span>
                  </label>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFreqAI}
                    onChange={(e) => setEnableFreqAI(e.target.checked)}
                    className="w-4 h-4 rounded border border-border bg-bg-2 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-1">Enable FreqAI</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Export</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export"
                    value="none"
                    checked={exportType === "none"}
                    onChange={(e) => setExportType(e.target.value)}
                    className="w-4 h-4 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-1">None</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export"
                    value="trades"
                    checked={exportType === "trades"}
                    onChange={(e) => setExportType(e.target.value)}
                    className="w-4 h-4 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-1">Trades</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export"
                    value="signals"
                    checked={exportType === "signals"}
                    onChange={(e) => setExportType(e.target.value)}
                    className="w-4 h-4 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-1">Signals</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-1 mb-2">Breakdown By</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={breakdownDay}
                    onChange={(e) => setBreakdownDay(e.target.checked)}
                    className="w-4 h-4 rounded border border-border bg-bg-2 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-1">Day</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={breakdownWeek}
                    onChange={(e) => setBreakdownWeek(e.target.checked)}
                    className="w-4 h-4 rounded border border-border bg-bg-2 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-1">Week</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={breakdownMonth}
                    onChange={(e) => setBreakdownMonth(e.target.checked)}
                    className="w-4 h-4 rounded border border-border bg-bg-2 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-text-1">Month</span>
                </label>
              </div>
            </div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleStartBacktest}
            disabled={isRunning}
            className="flex-1 px-4 py-2 bg-accent text-white text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isRunning ? "Running..." : "Start Backtest"}
          </button>
          <button
            onClick={() => results && handleLoadResult(0)}
            className="flex-1 px-4 py-2 bg-bg-2 border border-border text-text-0 text-xs font-semibold rounded hover:bg-bg-3 transition-colors"
          >
            Load Result
          </button>
        </div>

        <div className="flex gap-2">
          <button
            disabled={!isRunning}
            className="flex-1 px-4 py-2 bg-red text-white text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            Stop
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-bg-2 border border-border text-text-0 text-xs font-semibold rounded hover:bg-bg-3 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Backtest History */}
        <div>
          <h3 className="text-sm font-semibold text-text-0 mb-3">History</h3>
          <div className="space-y-2">
            {MOCK_HISTORY.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleLoadResult(idx)}
                className="w-full text-left p-3 bg-bg-2 border border-border rounded hover:bg-bg-3 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-0">{item.strategy}</span>
                  <span className={`text-xs font-semibold ${item.profitPct >= 0 ? "text-green" : "text-red"}`}>
                    {fmtPct(item.profitPct)}
                  </span>
                </div>
                <div className="text-xs text-text-2 mb-1">{item.date}</div>
                <div className="flex items-center justify-between text-xs text-text-3">
                  <span>{item.timerange}</span>
                  <span>{item.trades} trades</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - RESULTS */}
      {results && (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Stat Boxes */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-bg-2 border border-border rounded p-4">
                <div className="text-xs font-medium text-text-2 mb-2">Total Trades</div>
                <div className="text-lg font-bold text-text-0">{results.trades}</div>
              </div>

              <div className="bg-bg-2 border border-border rounded p-4">
                <div className="text-xs font-medium text-text-2 mb-2">Win Rate</div>
                <div className="text-lg font-bold text-green">{fmtPct(results.winRate)}</div>
              </div>

              <div className="bg-bg-2 border border-border rounded p-4">
                <div className="text-xs font-medium text-text-2 mb-2">Total Profit</div>
                <div className={`text-lg font-bold ${profitColor_}`}>
                  {fmtUsd(results.totalProfit)} / {fmtPct(results.totalProfitPct)}
                </div>
              </div>

              <div className="bg-bg-2 border border-border rounded p-4">
                <div className="text-xs font-medium text-text-2 mb-2">Max Drawdown</div>
                <div className={`text-lg font-bold ${drawdownColor}`}>
                  {fmtPct(results.maxDrawdown)} / {fmtUsd(results.maxDrawdownAbs)}
                </div>
              </div>

              <div className="bg-bg-2 border border-border rounded p-4">
                <Tooltip content="Risk-adjusted return metric — higher is better (FT: sharpe)">
                  <div className="text-xs font-medium text-text-2 mb-2 cursor-help">Sharpe Ratio</div>
                </Tooltip>
                <div className="text-lg font-bold text-text-0">{results.sharpeRatio.toFixed(2)}</div>
              </div>

              <div className="bg-bg-2 border border-border rounded p-4">
                <Tooltip content="Downside deviation metric — like Sharpe but only penalizes losses (FT: sortino)">
                  <div className="text-xs font-medium text-text-2 mb-2 cursor-help">Sortino Ratio</div>
                </Tooltip>
                <div className="text-lg font-bold text-text-0">{results.sortinoRatio.toFixed(2)}</div>
              </div>
            </div>

            {/* Cumulative Profit Chart */}
            <div className="bg-bg-2 border border-border rounded p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-0">Cumulative Profit</h3>
                <div className="flex gap-2">
                  {(["day", "week", "month"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setChartPeriod(period)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                        chartPeriod === period ? "bg-accent text-white" : "bg-bg-3 text-text-2 hover:text-text-1"
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <svg viewBox="0 0 800 300" className="w-full h-auto">
                <defs>
                  <linearGradient id="profitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Grid */}
                <line x1="40" y1="250" x2="780" y2="250" stroke="#1e1e30" strokeWidth="1" />
                <line x1="40" y1="200" x2="780" y2="200" stroke="#1e1e30" strokeWidth="1" strokeDasharray="4" />
                <line x1="40" y1="150" x2="780" y2="150" stroke="#1e1e30" strokeWidth="1" strokeDasharray="4" />
                <line x1="40" y1="100" x2="780" y2="100" stroke="#1e1e30" strokeWidth="1" strokeDasharray="4" />
                <line x1="40" y1="50" x2="780" y2="50" stroke="#1e1e30" strokeWidth="1" strokeDasharray="4" />

                {/* Y-axis labels */}
                <text x="35" y="255" textAnchor="end" className="text-[10px] fill-text-3">
                  $0
                </text>
                <text x="35" y="205" textAnchor="end" className="text-[10px] fill-text-3">
                  $312
                </text>
                <text x="35" y="155" textAnchor="end" className="text-[10px] fill-text-3">
                  $624
                </text>
                <text x="35" y="105" textAnchor="end" className="text-[10px] fill-text-3">
                  $936
                </text>
                <text x="35" y="55" textAnchor="end" className="text-[10px] fill-text-3">
                  $1248
                </text>

                {/* X-axis labels */}
                <text x="40" y="275" className="text-[10px] fill-text-3">
                  Jan
                </text>
                <text x="200" y="275" className="text-[10px] fill-text-3">
                  Apr
                </text>
                <text x="360" y="275" className="text-[10px] fill-text-3">
                  Jul
                </text>
                <text x="520" y="275" className="text-[10px] fill-text-3">
                  Oct
                </text>
                <text x="680" y="275" className="text-[10px] fill-text-3">
                  Dec
                </text>

                {/* Data line with gradient fill */}
                <polyline
                  points={results.cumulativeProfit
                    .map((profit, i) => {
                      const x = 40 + (i / results.cumulativeProfit.length) * 740;
                      const y = 250 - (profit / 1600) * 200;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                />

                {/* Gradient fill */}
                <polygon
                  points={`40,250 ${results.cumulativeProfit
                    .map((profit, i) => {
                      const x = 40 + (i / results.cumulativeProfit.length) * 740;
                      const y = 250 - (profit / 1600) * 200;
                      return `${x},${y}`;
                    })
                    .join(" ")} 780,250`}
                  fill="url(#profitGrad)"
                />

                {/* Max drawdown marker */}
                <circle cx="280" cy="110" r="4" fill="#ef4444" />
                <line x1="280" y1="110" x2="280" y2="260" stroke="#ef4444" strokeWidth="1" strokeDasharray="2" />
                <text x="280" y="95" textAnchor="middle" className="text-[9px] fill-red">
                  Min: -$840
                </text>

                {/* Final profit marker */}
                <circle cx="780" cy="50" r="4" fill="#22c55e" />
                <text x="780" y="35" textAnchor="middle" className="text-[9px] fill-green font-semibold">
                  Final: +$1,248
                </text>
              </svg>
            </div>

            {/* Per-Trade Profit Bars */}
            <div className="bg-bg-2 border border-border rounded p-4">
              <h3 className="text-sm font-semibold text-text-0 mb-4">Per-Trade Profit Distribution</h3>
              <svg viewBox="0 0 800 150" className="w-full h-auto">
                {/* Zero line */}
                <line x1="40" y1="75" x2="780" y2="75" stroke="#55556a" strokeWidth="1" />

                {/* Bars */}
                {results.tradesList.map((trade, i) => {
                  const x = 40 + (i / results.tradesList.length) * 740;
                  const barWidth = 740 / results.tradesList.length - 2;
                  const barHeight = (Math.abs(trade.profitPct) / 10) * 50;
                  const y = trade.profitPct >= 0 ? 75 - barHeight : 75;
                  const color = trade.profitPct >= 0 ? "#22c55e" : "#ef4444";

                  return <rect key={i} x={x} y={y} width={barWidth} height={barHeight} fill={color} opacity="0.8" />;
                })}

                {/* Y-axis labels */}
                <text x="35" y="80" textAnchor="end" className="text-[9px] fill-text-3">
                  0%
                </text>
                <text x="35" y="30" textAnchor="end" className="text-[9px] fill-text-3">
                  +10%
                </text>
                <text x="35" y="130" textAnchor="end" className="text-[9px] fill-text-3">
                  -10%
                </text>
              </svg>
            </div>

            {/* Trades Table */}
            <div className="bg-bg-2 border border-border rounded overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-bg-3">
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">#</th>
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">Pair</th>
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">Side</th>
                      <th className="px-4 py-3 text-right text-text-1 font-semibold">Profit %</th>
                      <th className="px-4 py-3 text-right text-text-1 font-semibold">Profit $</th>
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">Open</th>
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">Close</th>
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">Duration</th>
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">
                        <Tooltip content="FT: enter_tag — strategy signal that triggered this trade">
                          <span className="cursor-help border-b border-dashed border-text-1">Enter Tag</span>
                        </Tooltip>
                      </th>
                      <th className="px-4 py-3 text-left text-text-1 font-semibold">
                        <Tooltip content="FT: exit_reason — why trade was closed">
                          <span className="cursor-help border-b border-dashed border-text-1">Exit Reason</span>
                        </Tooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.tradesList.map((trade) => (
                      <tr key={trade.id} className="border-b border-border hover:bg-bg-3 transition-colors">
                        <td className="px-4 py-3 text-text-1">{trade.id}</td>
                        <td className="px-4 py-3 text-text-0 font-medium">{trade.pair}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.isShort ? "bg-red/20 text-red" : "bg-green/20 text-green"}`}>
                            {trade.isShort ? "Short" : "Long"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${trade.profitPct >= 0 ? "text-green" : "text-red"}`}>
                          {fmtPct(trade.profitPct)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${trade.profitAbs >= 0 ? "text-green" : "text-red"}`}>
                          {fmtUsd(trade.profitAbs)}
                        </td>
                        <td className="px-4 py-3 text-text-1 font-mono text-xs">{trade.openDate}</td>
                        <td className="px-4 py-3 text-text-1 font-mono text-xs">{trade.closeDate}</td>
                        <td className="px-4 py-3 text-text-2">{trade.duration}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-bg-3 rounded text-xs text-text-1">{trade.enterTag}</span>
                        </td>
                        <td className="px-4 py-3 text-text-2 text-xs">{trade.exitReason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 bg-bg-3 border-t border-border flex items-center justify-between text-xs text-text-2">
                <span>Showing 1-10 of {results.trades}</span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-bg-2 border border-border rounded hover:bg-bg-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <button className="px-3 py-1 bg-bg-2 border border-border rounded hover:bg-bg-3 transition-colors">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
