"use client";

import { useState, useEffect } from "react";
import { getExperimentRuns, type ExperimentRun } from "@/lib/api";

interface CompareOverlayProps {
  onClose: () => void;
  strategy: string;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

interface MetricRow {
  metric: string;
  a: string;
  b: string;
  winner: "A" | "B" | "tie";
}

interface RunOption {
  value: string;
  label: string;
  run: ExperimentRun;
}

function buildComparison(a: ExperimentRun, b: ExperimentRun): MetricRow[] {
  const profitA = a.profit_pct ?? 0;
  const profitB = b.profit_pct ?? 0;
  const wrA = (a.win_rate ?? 0) * 100;
  const wrB = (b.win_rate ?? 0) * 100;
  const ddA = -(a.max_drawdown ?? 0) * 100;
  const ddB = -(b.max_drawdown ?? 0) * 100;
  const sharpeA = a.sharpe_ratio ?? 0;
  const sharpeB = b.sharpe_ratio ?? 0;
  const tradesA = a.total_trades ?? 0;
  const tradesB = b.total_trades ?? 0;

  return [
    {
      metric: "Profit %",
      a: `${profitA >= 0 ? "+" : ""}${profitA.toFixed(2)}%`,
      b: `${profitB >= 0 ? "+" : ""}${profitB.toFixed(2)}%`,
      winner: profitA > profitB ? "A" : profitB > profitA ? "B" : "tie",
    },
    {
      metric: "Win Rate",
      a: `${wrA.toFixed(1)}%`,
      b: `${wrB.toFixed(1)}%`,
      winner: wrA > wrB ? "A" : wrB > wrA ? "B" : "tie",
    },
    {
      metric: "Sharpe",
      a: sharpeA.toFixed(2),
      b: sharpeB.toFixed(2),
      winner: sharpeA > sharpeB ? "A" : sharpeB > sharpeA ? "B" : "tie",
    },
    {
      metric: "Max DD",
      a: `${ddA.toFixed(1)}%`,
      b: `${ddB.toFixed(1)}%`,
      winner: Math.abs(ddA) < Math.abs(ddB) ? "A" : Math.abs(ddB) < Math.abs(ddA) ? "B" : "tie",
    },
    {
      metric: "Trades",
      a: String(tradesA),
      b: String(tradesB),
      winner: tradesA > tradesB ? "A" : tradesB > tradesA ? "B" : "tie",
    },
  ];
}

export default function CompareOverlay({ onClose, strategy, experimentId, onNavigateToTab }: CompareOverlayProps) {
  const [runOptions, setRunOptions] = useState<RunOption[]>([]);
  const [testA, setTestA] = useState("");
  const [testB, setTestB] = useState("");
  const [rows, setRows] = useState<MetricRow[]>([]);

  // ── Load runs from experiment ─────────────────────────────────────
  useEffect(() => {
    if (!experimentId) return;
    (async () => {
      try {
        const runs = await getExperimentRuns(experimentId);
        const completed = (runs || []).filter((r) => r.status === "completed");
        const options: RunOption[] = completed.map((r) => ({
          value: String(r.id),
          label: `${r.run_type?.toUpperCase()} #${r.id} — ${r.profit_pct != null ? `${r.profit_pct >= 0 ? "+" : ""}${r.profit_pct.toFixed(1)}%` : "—"}`,
          run: r,
        }));
        setRunOptions(options);
        if (options.length >= 2) {
          setTestA(options[0].value);
          setTestB(options[1].value);
        } else if (options.length === 1) {
          setTestA(options[0].value);
          setTestB(options[0].value);
        }
      } catch { /* */ }
    })();
  }, [experimentId]);

  // ── Build comparison when selections change ───────────────────────
  useEffect(() => {
    const optA = runOptions.find((o) => o.value === testA);
    const optB = runOptions.find((o) => o.value === testB);
    if (optA && optB) {
      setRows(buildComparison(optA.run, optB.run));
    }
  }, [testA, testB, runOptions]);

  // Suppress
  void onClose; void strategy; void onNavigateToTab;

  return (
    <div className="flex-1 flex flex-col">
      {/* Selector row */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold block">Test A</label>
          <select
            value={testA}
            onChange={(e) => setTestA(e.target.value)}
            className="w-full bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
          >
            {runOptions.length === 0 ? (
              <option>No runs available</option>
            ) : (
              runOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
            )}
          </select>
        </div>
        <div className="flex items-end pb-2 text-white/20 text-[11px] font-bold">VS</div>
        <div className="flex-1">
          <label className="text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold block">Test B</label>
          <select
            value={testB}
            onChange={(e) => setTestB(e.target.value)}
            className="w-full bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
          >
            {runOptions.length === 0 ? (
              <option>No runs available</option>
            ) : (
              runOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
            )}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface l-bd rounded-md overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-[11px] text-white/20">
            Select two runs to compare
          </div>
        ) : (
        <table className="w-full text-[13px] font-mono">
          <thead>
            <tr className="bg-surface l-b text-[11px] uppercase tracking-widest text-muted">
              <th className="px-4 py-2.5 text-left">Metric</th>
              <th className="px-4 py-2.5 text-right">Test A</th>
              <th className="px-4 py-2.5 text-right">Test B</th>
              <th className="px-4 py-2.5 text-center">Winner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-white/60">
            {rows.map((row) => (
              <tr key={row.metric} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-2 text-white/70">{row.metric}</td>
                <td className={`px-4 py-2 text-right ${row.winner === "A" ? "text-up font-bold" : ""}`}>{row.a}</td>
                <td className={`px-4 py-2 text-right ${row.winner === "B" ? "text-up font-bold" : ""}`}>{row.b}</td>
                <td className="px-4 py-2 text-center">
                  {row.winner === "A" && <span className="text-up">A ✓</span>}
                  {row.winner === "B" && <span className="text-up">B ✓</span>}
                  {row.winner === "tie" && <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
