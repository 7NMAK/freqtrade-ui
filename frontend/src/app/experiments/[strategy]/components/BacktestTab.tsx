"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Tooltip from "@/components/ui/Tooltip";
import { botLogs, botBacktestResults } from "@/lib/api";

interface BacktestTabProps {
  strategy: string;
  backtestBotId?: number;
}

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
}

// ── Toggle switch ────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <label className="relative w-[36px] h-[20px] cursor-pointer inline-block flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`absolute inset-0 rounded-[10px] border transition-all ${checked ? "bg-[rgba(34,197,94,0.08)] border-emerald-500" : "bg-muted border-border"}`} />
        <span className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
      </label>
    </div>
  );
}

// ── Design System ───────────────────────────────────────────────────
const INPUT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground placeholder-text-3 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

// ══════════════════════════════════════════════════════════════════════════
export default function BacktestTab({ strategy, backtestBotId = 2 }: BacktestTabProps) {
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

  // ── Log window state ──────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [btProgress, setBtProgress] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((level: string, msg: string) => {
    setLogs((prev) => {
      const next = [...prev, { ts: new Date().toLocaleTimeString(), level, msg }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  // Auto-scroll log window
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Poll FT logs + backtest status while running
  useEffect(() => {
    if (!isRunning) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    let lastLogCount = 0;
    const poll = async () => {
      try {
        const logRes = await botLogs(backtestBotId, 30);
        if (logRes && logRes.logs) {
          const newLogs = logRes.logs.slice(lastLogCount);
          lastLogCount = logRes.logs.length;
          for (const entry of newLogs) {
            // FT log format: [timestamp, epoch, module, level, message]
            const level = entry[3] || "INFO";
            const msg = entry[4] || entry.join(" ");
            addLog(level, msg);
          }
        }
      } catch {
        // Log fetch failed — bot may not be ready
      }
      try {
        const btRes = await botBacktestResults(backtestBotId);
        if (btRes) {
          const raw = btRes as unknown as Record<string, unknown>;
          const step = raw.step || "";
          const progress = raw.progress as number | undefined;
          if (step === "finished" || step === "done") {
            setBtProgress("Backtest complete");
            addLog("INFO", "Backtest finished");
            setIsRunning(false);
          } else if (step) {
            const pct = progress != null ? ` (${(progress * 100).toFixed(0)}%)` : "";
            setBtProgress(`${step}${pct}`);
          }
        }
      } catch {
        // Status fetch failed
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, backtestBotId, addLog]);

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
    setLogs([]);
    setBtProgress("");
    addLog("INFO", `Starting backtest: ${strategy} — ${startDate} → ${endDate}`);
    setIsRunning(true);
    // TODO: POST to orchestrator /api/bots/{id}/backtest
  };

  const handleStop = () => {
    addLog("WARNING", "Backtest stopped by user");
    setIsRunning(false);
    setBtProgress("");
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

  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-0 max-w-full">

      {/* ═══════════ LEFT PANEL: FORM ═══════════ */}
      <div className="bg-card border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col gap-[10px]">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">⚙️ Test Configuration</div>

        {/* Test Name */}
        <div>
          <label className={LABEL}>Test Name</label>
          <input type="text" value={testName} onChange={(e) => setTestName(e.target.value)} className={INPUT} />
        </div>

        {/* Description (auto-generated) */}
        <div>
          <label className={LABEL}>Description</label>
          <div className="w-full px-3 py-[7px] bg-muted/50 border border-border rounded-btn text-xs text-muted-foreground leading-[1.5]">
            {autoDescription}
          </div>
          <div className="text-[9px] text-muted-foreground mt-[2px]">Auto-generated from settings</div>
        </div>

        {/* Strategy (readonly) */}
        <div>
          <label className={LABEL}>Strategy</label>
          <input type="text" value={strategy} readOnly className={`${INPUT} bg-muted/50 opacity-70 cursor-default`} />
        </div>

        {/* Start/End Date row */}
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

        {/* Toggles */}
        <div className="flex flex-col gap-[8px] mt-1">
          <Tooltip content="Enable FT Protections — FT: --enable-protections">
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
              <label key={val} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-xs cursor-pointer border transition-all select-none ${exportType === val ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-[#2e2e48]"}`}>
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
              <span key={item.label} onClick={() => item.set(!item.checked)} className={`inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-xs cursor-pointer border transition-all select-none ${item.checked ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary" : "bg-muted/50 border-border text-muted-foreground hover:border-[#2e2e48]"}`}>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-[6px] mt-1">
          <button onClick={handleStart} disabled={isRunning} className="flex-1 h-[32px] rounded-btn text-xs font-semibold border bg-primary border-primary text-white hover:bg-[#5558e6] transition-all disabled:opacity-50">
            {isRunning ? "⏳ Running..." : "▶ Start Backtest"}
          </button>
          <button onClick={handleStop} disabled={!isRunning} className="h-[32px] px-3 rounded-btn text-xs font-semibold border bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)] text-rose-500 hover:bg-[rgba(239,68,68,0.15)] transition-all disabled:opacity-50">
            ⏹ Stop
          </button>
          <button onClick={handleReset} className="h-[32px] px-3 rounded-btn text-xs font-semibold border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-all">
            ↻
          </button>
        </div>

        {/* ═══════════ LOG WINDOW ═══════════ */}
        <div className="flex flex-col mt-1 flex-1 min-h-[120px]">
          <div className="flex items-center justify-between mb-[4px]">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px]">Log</span>
            <div className="flex items-center gap-2">
              {btProgress && (
                <span className="text-xs text-primary font-medium">{btProgress}</span>
              )}
              {isRunning && (
                <span className="w-[6px] h-[6px] rounded-full bg-green animate-pulse" />
              )}
              {logs.length > 0 && (
                <button
                  onClick={() => { setLogs([]); setBtProgress(""); }}
                  className="text-[9px] text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 bg-[#0d0d14] border border-border rounded-btn p-2 overflow-y-auto font-mono text-xs leading-[1.6] min-h-[100px] max-h-[220px]">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-xs opacity-50 select-none">
                Logs will appear here when backtest starts...
              </div>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="flex gap-[6px]">
                  <span className="text-muted-foreground shrink-0">{entry.ts}</span>
                  <span className={`shrink-0 w-[38px] ${
                    entry.level === "ERROR" ? "text-rose-500" :
                    entry.level === "WARNING" ? "text-[#f59e0b]" :
                    "text-muted-foreground"
                  }`}>{entry.level.substring(0, 4)}</span>
                  <span className="text-muted-foreground break-all">{entry.msg}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL: RESULTS (empty state) ═══════════ */}
      <div className="bg-card border border-border rounded-[10px] p-4 overflow-y-auto flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-[32px] mb-3 opacity-30">📊</div>
        <div className="text-sm font-semibold text-muted-foreground mb-1">No backtest results yet</div>
        <div className="text-xs text-muted-foreground text-center max-w-[280px]">
          Configure your test parameters and click &quot;Start Backtest&quot; to run a real FreqTrade backtest on the server.
        </div>
      </div>
    </div>
  );
}
