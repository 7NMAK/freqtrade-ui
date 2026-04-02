"use client";

import { useState } from "react";

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

const OPTIONS = [
  { value: "bt1", label: "BT #1 \u2014 AlphaTrend_V5 \u2014 +42.12%" },
  { value: "ho147", label: "HO #147 \u2014 Sharpe \u2014 +42.12%" },
  { value: "fai1", label: "FAI \u2014 LightGBM-R \u2014 +52.4%" },
];

const COMPARE_DATA: Record<string, MetricRow[]> = {
  "bt1|ho147": [
    { metric: "Profit %", a: "+42.12%", b: "+42.12%", winner: "tie" },
    { metric: "Sharpe", a: "3.92", b: "3.58", winner: "A" },
    { metric: "Max DD", a: "-2.1%", b: "-3.4%", winner: "A" },
    { metric: "Win Rate", a: "72.4%", b: "68.1%", winner: "A" },
    { metric: "Trades", a: "142", b: "156", winner: "B" },
  ],
  "bt1|fai1": [
    { metric: "Profit %", a: "+42.12%", b: "+52.4%", winner: "B" },
    { metric: "Sharpe", a: "3.92", b: "4.12", winner: "B" },
    { metric: "Max DD", a: "-2.1%", b: "-1.8%", winner: "B" },
    { metric: "Win Rate", a: "72.4%", b: "74.2%", winner: "B" },
    { metric: "Trades", a: "142", b: "156", winner: "B" },
  ],
  "ho147|fai1": [
    { metric: "Profit %", a: "+42.12%", b: "+52.4%", winner: "B" },
    { metric: "Sharpe", a: "3.58", b: "4.12", winner: "B" },
    { metric: "Max DD", a: "-3.4%", b: "-1.8%", winner: "B" },
    { metric: "Win Rate", a: "68.1%", b: "74.2%", winner: "B" },
    { metric: "Trades", a: "156", b: "156", winner: "tie" },
  ],
};

function getRows(a: string, b: string): MetricRow[] {
  return (
    COMPARE_DATA[`${a}|${b}`] ??
    COMPARE_DATA[`${b}|${a}`]?.map((r) => ({
      ...r,
      a: r.b,
      b: r.a,
      winner: r.winner === "A" ? ("B" as const) : r.winner === "B" ? ("A" as const) : ("tie" as const),
    })) ?? [
      { metric: "Profit %", a: "+42.12%", b: "+52.4%", winner: "B" },
      { metric: "Sharpe", a: "3.92", b: "4.12", winner: "B" },
      { metric: "Max DD", a: "-2.1%", b: "-1.8%", winner: "B" },
      { metric: "Win Rate", a: "72.4%", b: "74.2%", winner: "B" },
      { metric: "Trades", a: "142", b: "156", winner: "B" },
    ]
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function CompareOverlay({ onClose, strategy, experimentId, onNavigateToTab }: CompareOverlayProps) {
  const [testA, setTestA] = useState("bt1");
  const [testB, setTestB] = useState("fai1");

  const rows = getRows(testA, testB);

  return (
    <div className="flex-1 flex flex-col">
      {/* Selector row */}
      <div className="flex gap-4 mb-4">
        {/* Test A */}
        <div className="flex-1">
          <label className="text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold block">
            Test A
          </label>
          <select
            value={testA}
            onChange={(e) => setTestA(e.target.value)}
            className="w-full bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
          >
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* VS divider */}
        <div className="flex items-end pb-2 text-white/20 text-[11px] font-bold">
          VS
        </div>

        {/* Test B */}
        <div className="flex-1">
          <label className="text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold block">
            Test B
          </label>
          <select
            value={testB}
            onChange={(e) => setTestB(e.target.value)}
            className="w-full bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
          >
            {OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface l-bd rounded-md overflow-hidden">
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
                <td className={`px-4 py-2 text-right ${row.winner === "A" ? "text-up font-bold" : ""}`}>
                  {row.a}
                </td>
                <td className={`px-4 py-2 text-right ${row.winner === "B" ? "text-up font-bold" : ""}`}>
                  {row.b}
                </td>
                <td className="px-4 py-2 text-center">
                  {row.winner === "A" && <span className="text-up">A {"\u2713"}</span>}
                  {row.winner === "B" && <span className="text-up">B {"\u2713"}</span>}
                  {row.winner === "tie" && <span className="text-muted">{"\u2014"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
