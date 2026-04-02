"use client";

import { useState } from "react";

// ── Local Toggle & Pill ─────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <div className={`builder-toggle ${on ? 'on' : ''}`} onClick={onToggle}><div className="dot" /></div>;
}
function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return <button className={`builder-pill text-[10px] px-2.5 py-1.5 text-center ${selected ? 'selected' : ''}`} onClick={onClick}>{selected && '✓ '}{label}</button>;
}

// ── Mock Data ────────────────────────────────────────────────────────
const MOCK_COMPARISON = [
  { metric: "Profit %",       training: "+42.1%",  oos: "+31.2%",  oosClass: "text-up font-bold",  ratio: "74.1%",  ratioClass: "text-up",  threshold: ">70%",   status: "✓", statusClass: "text-up font-bold" },
  { metric: "Max DD",         training: "-2.1%",   oos: "-2.8%",   oosClass: "text-down font-bold", ratio: "133%",   ratioClass: "",         threshold: "<150%",  status: "✓", statusClass: "text-up font-bold" },
  { metric: "Trades",         training: "142",     oos: "89",      oosClass: "",                    ratio: "62.7%",  ratioClass: "text-up",  threshold: ">50%",   status: "✓", statusClass: "text-up font-bold" },
  { metric: "Win Rate",       training: "72.4%",   oos: "68.5%",   oosClass: "text-up font-bold",  ratio: "94.6%",  ratioClass: "text-up",  threshold: ">50%",   status: "✓", statusClass: "text-up font-bold" },
  { metric: "Sharpe",         training: "3.92",    oos: "3.14",    oosClass: "text-up font-bold",  ratio: "80.1%",  ratioClass: "",         threshold: "—",      status: "info", statusClass: "text-muted" },
  { metric: "Sortino",        training: "4.15",    oos: "3.42",    oosClass: "",                    ratio: "82.4%",  ratioClass: "",         threshold: "—",      status: "info", statusClass: "text-muted" },
  { metric: "Profit Factor",  training: "2.58",    oos: "2.11",    oosClass: "",                    ratio: "81.8%",  ratioClass: "",         threshold: "—",      status: "info", statusClass: "text-muted" },
];

const MOCK_RECURSIVE = [
  { iter: 1, shift: "0d",  profit: "+42.1%", delta: "—" },
  { iter: 2, shift: "1d",  profit: "+41.8%", delta: "-0.3%" },
  { iter: 3, shift: "2d",  profit: "+41.5%", delta: "-0.3%" },
  { iter: 4, shift: "3d",  profit: "+41.2%", delta: "-0.3%" },
  { iter: 5, shift: "4d",  profit: "+40.8%", delta: "-0.4%" },
];

const MOCK_LOGS = [
  { ts: "10:15:01", level: "INFO", msg: "Validation started — 3 checks queued" },
  { ts: "10:15:02", level: "INFO", msg: "[1/3] OOS Backtest — running 2025-01-01 to 2025-06-01..." },
  { ts: "10:28:44", level: "INFO", msg: "[1/3] OOS Backtest — PASS — +31.2%, 89 trades, ratio 74.1%" },
  { ts: "10:28:45", level: "INFO", msg: "[2/3] Lookahead Bias Check — scanning indicators..." },
  { ts: "10:31:12", level: "INFO", msg: "[2/3] Lookahead — CLEAN — 0 shifted indicators, 0 future refs" },
  { ts: "10:31:13", level: "INFO", msg: "[3/3] Recursive Stability — running 5 iterations..." },
  { ts: "10:42:55", level: "INFO", msg: "[3/3] Recursive — STABLE — max delta -0.4%, 5 iterations" },
  { ts: "10:42:56", level: "INFO", msg: "All validations passed (3/3) — strategy is production ready" },
];

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
interface ValidationTabProps {
  strategy?: string;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ValidationTab(_props: ValidationTabProps) {
  // ── Form State ──────────────────────────────────────────────────
  const [sourceTest, setSourceTest] = useState("bt1");
  const [verificationName, setVerificationName] = useState("OOS verify BT #1");
  const [oosStart, setOosStart] = useState("2025-01-01");
  const [oosEnd, setOosEnd] = useState("2025-06-01");
  const [minProfit, setMinProfit] = useState(70);
  const [maxDD, setMaxDD] = useState(150);
  const [minTrades, setMinTrades] = useState(50);
  const [minWinRate, setMinWinRate] = useState(50);

  // Validation checks
  const [oosBacktest, setOosBacktest] = useState(true);
  const [lookaheadCheck, setLookaheadCheck] = useState(true);
  const [recursiveStability, setRecursiveStability] = useState(true);
  const [walkForward, setWalkForward] = useState(false);

  // Suppress unused local components
  void Pill;

  return (
    <div className="h-full flex flex-row gap-3">
      {/* ══════════ LEFT PANEL — CONFIG ══════════ */}
      <div className="w-[400px] flex flex-col gap-0 bg-surface l-bd rounded-md shadow-xl shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">Validation Configuration</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5 flex-1 overflow-y-auto">
          {/* 1. Source Test */}
          <div>
            <label className="builder-label">Source Test</label>
            <select className="builder-select w-full" value={sourceTest} onChange={(e) => setSourceTest(e.target.value)}>
              <option value="bt1">BT #1 — +42.12%, HO #147</option>
              <option value="bt2">BT #2 — +21.4%</option>
              <option value="fai">FAI — LightGBM-R — +52.4%</option>
            </select>
          </div>

          {/* 2. Verification Name */}
          <div>
            <label className="builder-label">Verification Name</label>
            <input type="text" className="builder-input" value={verificationName} onChange={(e) => setVerificationName(e.target.value)} />
          </div>

          {/* 3. OOS Period */}
          <div>
            <label className="builder-label">OOS Period</label>
            <div className="flex gap-2">
              <input type="date" className="builder-input" value={oosStart} onChange={(e) => setOosStart(e.target.value)} />
              <input type="date" className="builder-input" value={oosEnd} onChange={(e) => setOosEnd(e.target.value)} />
            </div>
          </div>

          {/* 4. Pass/Fail Thresholds */}
          <div className="l-t pt-3">
            <label className="builder-label">Pass/Fail Thresholds</label>
          </div>

          {/* 5. Min Profit % / Max DD % */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="builder-label">Min Profit %</label>
              <input type="number" className="builder-input" value={minProfit} onChange={(e) => setMinProfit(Number(e.target.value))} />
            </div>
            <div className="flex-1">
              <label className="builder-label">Max DD %</label>
              <input type="number" className="builder-input" value={maxDD} onChange={(e) => setMaxDD(Number(e.target.value))} />
            </div>
          </div>

          {/* 6. Min Trades % / Min Win Rate % */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="builder-label">Min Trades %</label>
              <input type="number" className="builder-input" value={minTrades} onChange={(e) => setMinTrades(Number(e.target.value))} />
            </div>
            <div className="flex-1">
              <label className="builder-label">Min Win Rate %</label>
              <input type="number" className="builder-input" value={minWinRate} onChange={(e) => setMinWinRate(Number(e.target.value))} />
            </div>
          </div>

          {/* 7. Validation Checks */}
          <div className="l-t pt-3">
            <label className="builder-label">Validation Checks</label>
            <div className="flex flex-col gap-2.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">OOS Backtest</span>
                <Toggle on={oosBacktest} onToggle={() => setOosBacktest(!oosBacktest)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">Lookahead Bias Check</span>
                <Toggle on={lookaheadCheck} onToggle={() => setLookaheadCheck(!lookaheadCheck)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">Recursive Stability</span>
                <Toggle on={recursiveStability} onToggle={() => setRecursiveStability(!recursiveStability)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white font-mono">Walk-Forward</span>
                <Toggle on={walkForward} onToggle={() => setWalkForward(!walkForward)} />
              </div>
            </div>
          </div>

          {/* 8. Warning box */}
          <div className="bg-yellow-500/[0.04] border border-yellow-500/15 rounded px-3 py-2 flex gap-2">
            <span className="text-yellow-400">⚠</span>
            <span className="text-[10px] text-muted">OOS period must <b className="text-yellow-400">NOT overlap</b> with training data</span>
          </div>

          {/* 9. Run Buttons */}
          <div className="flex gap-1.5 l-t pt-3">
            <button
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', color: '#22c55e' }}
              title="Run all validation checks"
            >
              ▶ Run Verification
            </button>
            <button
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5F5F5' }}
              title="Stop running"
            >
              ⏹ Stop
            </button>
            <button
              className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5F5F5' }}
              title="Reset configuration to defaults"
            >
              ↺ Reset
            </button>
          </div>

          {/* 10. Progress */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-muted">Progress</span>
              <span className="text-white">3/3 checks</span>
            </div>
            <div className="mt-1.5 w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-up rounded-full transition-all" style={{ width: '100%' }} />
            </div>
          </div>

          {/* 11. Terminal Output */}
          <div className="l-t pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted uppercase tracking-widest font-bold">Terminal</span>
              <button className="text-[9px] text-muted hover:text-white transition-colors">Clear</button>
            </div>
            <div className="bg-black/60 rounded-md l-bd p-2 max-h-[200px] overflow-y-auto font-mono text-[10px] leading-[1.7] space-y-px">
              {MOCK_LOGS.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted shrink-0">{log.ts}</span>
                  <span className={
                    log.msg.includes("All validations passed") ? "text-up font-bold" :
                    log.msg.includes("PASS") || log.msg.includes("CLEAN") || log.msg.includes("STABLE") ? "text-up" :
                    "text-muted"
                  }>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT PANEL — RESULTS ══════════ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto pr-1">
        {/* 1. Verdict Banner */}
        <div className="bg-up/[0.04] l-bd rounded-md p-3 shadow-xl border-l-2 border-l-up relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-up/[0.03] rounded-full -translate-y-8 translate-x-8" />
          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-[12px] font-bold">✓ PASS — All Validations (3/3)</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-up/12 text-up rounded border border-up/25">PRODUCTION READY</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F5F5F5' }}
                title="Promote to paper trading"
              >
                → Paper
              </button>
              <button
                className="h-7 px-3 rounded-md text-[10px] font-bold flex items-center gap-1.5 transition-colors hover:border-up/30 hover:text-up"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', color: '#22c55e' }}
                title="Promote to live trading"
              >
                → Live
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-[11px] font-mono relative z-10">
            <div><div className="kpi-label">OOS Profit</div><div className="kpi-value text-up font-bold">+31.2%</div></div>
            <div><div className="kpi-label">Ratio</div><div className="kpi-value text-up">74.1%</div></div>
            <div><div className="kpi-label">Trades</div><div className="kpi-value text-white">89</div></div>
            <div><div className="kpi-label">Win Rate</div><div className="kpi-value text-up">68.5%</div></div>
            <div><div className="kpi-label">Sharpe</div><div className="kpi-value text-white">3.14</div></div>
            <div><div className="kpi-label">Max DD</div><div className="kpi-value text-down font-bold">-2.8%</div></div>
            <div><div className="kpi-label">Lookahead</div><div className="kpi-value text-up">Clean</div></div>
          </div>
        </div>

        {/* 2. Training vs OOS Comparison */}
        <div className="bg-surface l-bd rounded-md flex flex-col min-h-[200px] overflow-hidden shadow-xl">
          <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
            <span className="section-title">Training vs OOS Comparison</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[13px] font-mono">
              <thead>
                <tr className="text-muted text-[11px] uppercase tracking-widest">
                  <th className="px-2 py-1.5 text-left sticky top-0 bg-surface z-10">Metric</th>
                  <th className="px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Training</th>
                  <th className="px-2 py-1.5 text-right sticky top-0 bg-surface z-10">OOS</th>
                  <th className="px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Ratio</th>
                  <th className="px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Threshold</th>
                  <th className="px-2 py-1.5 text-right sticky top-0 bg-surface z-10">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {MOCK_COMPARISON.map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.04]">
                    <td className="px-2 py-1.5 text-white">{row.metric}</td>
                    <td className="px-2 py-1.5 text-right">{row.training}</td>
                    <td className={`px-2 py-1.5 text-right ${row.oosClass}`}>{row.oos}</td>
                    <td className={`px-2 py-1.5 text-right ${row.ratioClass}`}>{row.ratio}</td>
                    <td className="px-2 py-1.5 text-right text-muted">{row.threshold}</td>
                    <td className={`px-2 py-1.5 text-right ${row.statusClass}`}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Lookahead + Recursive */}
        <div className="grid grid-cols-2 gap-3">
          {/* Lookahead Card */}
          <div className="bg-surface l-bd rounded-md p-3 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="section-title">Lookahead Bias</span>
              <span className="text-up font-bold text-[10px]">✓ CLEAN</span>
            </div>
            <div className="text-[11px] text-muted font-mono mb-2">No lookahead bias detected in feature engineering</div>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between"><span className="text-muted">Shifted Indicators</span><span className="text-up">0 found</span></div>
              <div className="flex justify-between"><span className="text-muted">Future References</span><span className="text-up">0 found</span></div>
              <div className="flex justify-between"><span className="text-muted">Data Leakage</span><span className="text-up">None</span></div>
            </div>
          </div>

          {/* Recursive Card */}
          <div className="bg-surface l-bd rounded-md p-3 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="section-title">Recursive Stability</span>
              <span className="text-up font-bold text-[10px]">✓ STABLE</span>
            </div>
            <div className="text-[11px] text-muted font-mono mb-2">Results stable across 5 recursive iterations</div>
            <table className="w-full text-[13px] font-mono">
              <thead>
                <tr className="text-muted text-[11px] uppercase tracking-widest">
                  <th className="px-2 py-1 text-left">Iter</th>
                  <th className="px-2 py-1 text-left">Shift</th>
                  <th className="px-2 py-1 text-right">Profit</th>
                  <th className="px-2 py-1 text-right">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {MOCK_RECURSIVE.map((row) => (
                  <tr key={row.iter}>
                    <td className="px-2 py-1">{row.iter}</td>
                    <td className="px-2 py-1 text-muted">{row.shift}</td>
                    <td className="px-2 py-1 text-right text-up">{row.profit}</td>
                    <td className="px-2 py-1 text-right text-muted">{row.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Final Badge */}
        <div className="bg-up/[0.04] border border-up/15 rounded-md px-4 py-3 text-center shadow-xl">
          <span className="text-up font-bold text-[13px]">✓ All Validations Passed</span>
          <span className="text-muted text-[11px] ml-3 font-mono">Strategy ready for paper trading deployment</span>
        </div>
      </div>
    </div>
  );
}
