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
const MOCK_HISTORY = [
  { date: "2026-03-28 14:22", source: "BT #1 — 142 trades", model: "Claude Sonnet 4", score: 78, cost: "$0.03" },
  { date: "2026-03-25 09:15", source: "BT #1 — 142 trades", model: "GPT-4o",          score: 74, cost: "$0.04" },
  { date: "2026-03-20 11:40", source: "HO #147 — 89 trades", model: "Claude Sonnet 4", score: 71, cost: "$0.02" },
  { date: "2026-03-18 16:05", source: "FAI — LightGBM-R",   model: "Gemini 2.5 Pro",  score: 82, cost: "$0.03" },
];

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
interface AiReviewTabProps {
  strategy?: string;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AiReviewTab(_props: AiReviewTabProps) {
  const [model, setModel] = useState("claude-sonnet-4");

  // Suppress unused local components (kept for design system consistency)
  void Toggle; void Pill;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto">
      {/* ── 1. Header Bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="section-title">AI Review</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="bg-surface l-bd rounded px-2.5 py-1.5 text-[11px] font-mono">
            <span className="text-muted">Scope:</span> <span className="text-white">BT #1 — 142 trades</span>
          </span>
          <select
            className="builder-select text-[11px] font-mono"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          </select>
          <span className="bg-surface l-bd rounded px-2.5 py-1.5 text-[11px] font-mono">
            <span className="text-muted">Cost:</span> <span className="text-muted">~$0.03</span>
          </span>
          <button className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-white text-black rounded hover:bg-white/85 transition-colors">
            ▶ Analyze
          </button>
        </div>
      </div>

      {/* ── 2. Score Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Robustness</div>
          <div className="kpi-value text-up text-xl">82</div>
          <div className="text-[10px] text-up font-mono">Excellent</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Risk</div>
          <div className="kpi-value text-xl">65</div>
          <div className="text-[10px] text-muted font-mono">Moderate</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Execution</div>
          <div className="kpi-value text-xl">78</div>
          <div className="text-[10px] text-muted font-mono">Good</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Overfitting</div>
          <div className="kpi-value text-up text-xl">88</div>
          <div className="text-[10px] text-up font-mono">Low Risk</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded border-l-2 border-l-up">
          <div className="kpi-label">Overall</div>
          <div className="kpi-value text-white text-xl">78</div>
          <div className="text-[10px] text-up font-mono">Production Ready</div>
        </div>
      </div>

      {/* ── 3. Analysis Content ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-surface l-bd rounded p-3 text-[11px] font-mono space-y-2">
          <div className="text-up font-bold text-[10px] uppercase tracking-wider">✓ Strengths</div>
          <div className="text-muted leading-relaxed">
            • Consistent positive returns across all tested periods with low variance<br />
            • Strong Sharpe ratio (4.12) indicates excellent risk-adjusted performance<br />
            • Win rate of 74.2% with favorable risk/reward profile per trade<br />
            • Maximum drawdown under 2% suggests robust risk management<br />
            • Average trade duration of 3h 45m reduces overnight exposure risk
          </div>
        </div>
        <div className="bg-surface l-bd rounded p-3 text-[11px] font-mono space-y-2">
          <div className="text-down font-bold text-[10px] uppercase tracking-wider">⚠ Concerns</div>
          <div className="text-muted leading-relaxed">
            • Limited pair diversity — tested only on BTC/USDT futures<br />
            • Training period (18 months) may not capture full market cycles<br />
            • High win rate could indicate overfitting to training data distribution<br />
            • No stress-testing against black swan events or flash crashes
          </div>
        </div>
      </div>

      {/* ── 4. Recommendation ──────────────────────────────────────── */}
      <div className="bg-surface l-bd rounded p-3 text-[11px] font-mono border-l-2 border-l-white/30">
        <div className="text-white font-bold text-[10px] uppercase tracking-wider mb-2">→ Recommendation</div>
        <div className="text-muted leading-relaxed">
          Proceed to paper trading with position sizing at 50% of planned live allocation. Monitor for 30+ days with minimum 50 trades to validate OOS performance. Pay close attention to drawdown behavior during high-volatility periods and ensure win rate remains above 65% before scaling to live deployment.
        </div>
      </div>

      {/* ── 5. Analysis History ─────────────────────────────────────── */}
      <h3 className="section-title">Analysis History</h3>
      <table className="w-full text-[13px] font-mono whitespace-nowrap">
        <thead>
          <tr className="text-muted text-[11px] uppercase tracking-widest">
            <th className="px-2 py-1.5 text-left">Date</th>
            <th className="px-2 py-1.5 text-left">Source</th>
            <th className="px-2 py-1.5 text-left">Model</th>
            <th className="px-2 py-1.5 text-right">Score</th>
            <th className="px-2 py-1.5 text-right">Cost</th>
            <th className="px-2 py-1.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {MOCK_HISTORY.map((row, i) => (
            <tr key={i} className="hover:bg-white/[0.04]">
              <td className="px-2 py-1.5 text-muted">{row.date}</td>
              <td className="px-2 py-1.5 text-white">{row.source}</td>
              <td className="px-2 py-1.5 text-muted">{row.model}</td>
              <td className="px-2 py-1.5 text-right text-white">{row.score}</td>
              <td className="px-2 py-1.5 text-right text-muted">{row.cost}</td>
              <td className="px-2 py-1.5 text-right">
                <button className="px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white hover:bg-white/5 transition-colors">
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
