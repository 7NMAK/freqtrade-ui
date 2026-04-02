"use client";

import { useState } from "react";

interface AnalysisOverlayProps {
  onClose: () => void;
  strategy: string;
  experimentId?: number;
  botId?: number;
}

type ViewTab = "trades" | "per_pair" | "exit_reasons";

interface TradeRow {
  id: number;
  pair: string;
  side: "LONG" | "SHORT";
  profitPct: number;
  profitAbs: number;
  open: string;
  close: string;
  duration: string;
  exit: string;
}

interface PairRow {
  pair: string;
  trades: number;
  profitPct: number;
  profitAbs: number;
  winRate: number;
  avgDuration: string;
}

interface ExitRow {
  reason: string;
  trades: number;
  profitPct: number;
  profitAbs: number;
  wins: number;
  losses: number;
}

const MOCK_TRADES: TradeRow[] = [
  { id: 1, pair: "BTC/USDT", side: "LONG", profitPct: 4.82, profitAbs: 48.20, open: "2026-03-15 08:00", close: "2026-03-16 14:30", duration: "30h 30m", exit: "roi" },
  { id: 2, pair: "ETH/USDT", side: "SHORT", profitPct: -1.24, profitAbs: -12.40, open: "2026-03-16 02:15", close: "2026-03-16 09:45", duration: "7h 30m", exit: "stop_loss" },
  { id: 3, pair: "BTC/USDT", side: "LONG", profitPct: 2.31, profitAbs: 23.10, open: "2026-03-17 11:00", close: "2026-03-18 03:20", duration: "16h 20m", exit: "trailing_stop_loss" },
  { id: 4, pair: "SOL/USDT", side: "SHORT", profitPct: 6.15, profitAbs: 61.50, open: "2026-03-18 19:45", close: "2026-03-20 08:10", duration: "36h 25m", exit: "roi" },
  { id: 5, pair: "ETH/USDT", side: "LONG", profitPct: -0.58, profitAbs: -5.80, open: "2026-03-20 14:30", close: "2026-03-20 22:00", duration: "7h 30m", exit: "stop_loss" },
  { id: 6, pair: "BNB/USDT", side: "LONG", profitPct: 1.92, profitAbs: 19.20, open: "2026-03-21 06:00", close: "2026-03-21 18:45", duration: "12h 45m", exit: "exit_signal" },
  { id: 7, pair: "SOL/USDT", side: "SHORT", profitPct: -2.74, profitAbs: -27.40, open: "2026-03-22 10:15", close: "2026-03-22 16:30", duration: "6h 15m", exit: "stop_loss" },
  { id: 8, pair: "BTC/USDT", side: "LONG", profitPct: 8.41, profitAbs: 84.10, open: "2026-03-23 00:00", close: "2026-03-25 12:00", duration: "60h 0m", exit: "roi" },
];

const MOCK_PAIRS: PairRow[] = [
  { pair: "BTC/USDT", trades: 3, profitPct: 15.54, profitAbs: 155.40, winRate: 100, avgDuration: "35h 37m" },
  { pair: "ETH/USDT", trades: 2, profitPct: -1.82, profitAbs: -18.20, winRate: 0, avgDuration: "7h 30m" },
  { pair: "SOL/USDT", trades: 2, profitPct: 3.41, profitAbs: 34.10, winRate: 50, avgDuration: "21h 20m" },
  { pair: "BNB/USDT", trades: 1, profitPct: 1.92, profitAbs: 19.20, winRate: 100, avgDuration: "12h 45m" },
];

const MOCK_EXITS: ExitRow[] = [
  { reason: "roi", trades: 3, profitPct: 19.38, profitAbs: 193.80, wins: 3, losses: 0 },
  { reason: "stop_loss", trades: 3, profitPct: -4.56, profitAbs: -45.60, wins: 0, losses: 3 },
  { reason: "trailing_stop_loss", trades: 1, profitPct: 2.31, profitAbs: 23.10, wins: 1, losses: 0 },
  { reason: "exit_signal", trades: 1, profitPct: 1.92, profitAbs: 19.20, wins: 1, losses: 0 },
];

const RUN_OPTIONS = [
  { value: "bt1", label: "BT #1 \u2014 AlphaTrend_V5 \u2014 142 trades" },
  { value: "ho147", label: "HO #147 \u2014 200 epochs" },
  { value: "fai1", label: "FAI \u2014 LightGBM-R \u2014 156 trades" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AnalysisOverlay({ onClose, strategy, experimentId, botId }: AnalysisOverlayProps) {
  const [selectedRun, setSelectedRun] = useState("bt1");
  const [activeView, setActiveView] = useState<ViewTab>("trades");

  const viewTabs: Array<{ key: ViewTab; label: string }> = [
    { key: "trades", label: "Trades" },
    { key: "per_pair", label: "Per Pair" },
    { key: "exit_reasons", label: "Exit Reasons" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Selector row */}
      <div className="flex gap-3 mb-4">
        {/* Run select */}
        <div>
          <label className="text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold block">
            Select Run
          </label>
          <select
            value={selectedRun}
            onChange={(e) => setSelectedRun(e.target.value)}
            className="bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
          >
            {RUN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* View tabs */}
        <div className="flex items-end gap-1 pb-0.5">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`px-3 py-2 l-bd text-[10px] font-bold rounded uppercase tracking-wider transition-colors ${
                activeView === tab.key
                  ? "bg-white/10 text-white"
                  : "bg-white/[0.03] text-white/40 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trades view ─────────────────────────────────────────── */}
      {activeView === "trades" && (
        <div className="bg-surface l-bd rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
            <thead>
              <tr className="bg-surface l-b text-[11px] uppercase tracking-widest text-muted">
                <th className="px-3 py-2.5 sortable">#</th>
                <th className="px-3 py-2.5 sortable filterable">Pair</th>
                <th className="px-3 py-2.5 sortable filterable">Side</th>
                <th className="px-3 py-2.5 text-right sortable">Profit%</th>
                <th className="px-3 py-2.5 text-right sortable">Profit$</th>
                <th className="px-3 py-2.5 sortable">Open</th>
                <th className="px-3 py-2.5 sortable">Close</th>
                <th className="px-3 py-2.5 text-right sortable">Duration</th>
                <th className="px-3 py-2.5 sortable filterable">Exit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-white/70">
              {MOCK_TRADES.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-2 text-muted">{t.id}</td>
                  <td className="px-3 py-2 text-white/80">{t.pair}</td>
                  <td className="px-3 py-2">
                    {t.side === "LONG" ? (
                      <span className="bg-up/12 text-up px-1 py-0.5 rounded text-[9px] font-bold">LONG</span>
                    ) : (
                      <span className="bg-down/12 text-down px-1 py-0.5 rounded text-[9px] font-bold">SHORT</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right ${t.profitPct >= 0 ? "text-up font-bold" : "text-down font-bold"}`}>
                    {t.profitPct >= 0 ? "+" : ""}{t.profitPct.toFixed(2)}%
                  </td>
                  <td className={`px-3 py-2 text-right ${t.profitAbs >= 0 ? "text-up" : "text-down"}`}>
                    {t.profitAbs >= 0 ? "+" : ""}{t.profitAbs.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-muted">{t.open}</td>
                  <td className="px-3 py-2 text-muted">{t.close}</td>
                  <td className="px-3 py-2 text-right text-muted">{t.duration}</td>
                  <td className="px-3 py-2 text-white/25">{t.exit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Per Pair view ───────────────────────────────────────── */}
      {activeView === "per_pair" && (
        <div className="bg-surface l-bd rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
            <thead>
              <tr className="bg-surface l-b text-[11px] uppercase tracking-widest text-muted">
                <th className="px-3 py-2.5">Pair</th>
                <th className="px-3 py-2.5 text-right">Trades</th>
                <th className="px-3 py-2.5 text-right">Profit%</th>
                <th className="px-3 py-2.5 text-right">Profit$</th>
                <th className="px-3 py-2.5 text-right">Win Rate</th>
                <th className="px-3 py-2.5 text-right">Avg Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-white/70">
              {MOCK_PAIRS.map((p) => (
                <tr key={p.pair} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-2 text-white/80">{p.pair}</td>
                  <td className="px-3 py-2 text-right">{p.trades}</td>
                  <td className={`px-3 py-2 text-right ${p.profitPct >= 0 ? "text-up font-bold" : "text-down font-bold"}`}>
                    {p.profitPct >= 0 ? "+" : ""}{p.profitPct.toFixed(2)}%
                  </td>
                  <td className={`px-3 py-2 text-right ${p.profitAbs >= 0 ? "text-up" : "text-down"}`}>
                    {p.profitAbs >= 0 ? "+" : ""}{p.profitAbs.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">{p.winRate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-muted">{p.avgDuration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Exit Reasons view ───────────────────────────────────── */}
      {activeView === "exit_reasons" && (
        <div className="bg-surface l-bd rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
            <thead>
              <tr className="bg-surface l-b text-[11px] uppercase tracking-widest text-muted">
                <th className="px-3 py-2.5">Exit Reason</th>
                <th className="px-3 py-2.5 text-right">Trades</th>
                <th className="px-3 py-2.5 text-right">Profit%</th>
                <th className="px-3 py-2.5 text-right">Profit$</th>
                <th className="px-3 py-2.5 text-right">Wins</th>
                <th className="px-3 py-2.5 text-right">Losses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-white/70">
              {MOCK_EXITS.map((e) => (
                <tr key={e.reason} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-2 text-white/80">{e.reason}</td>
                  <td className="px-3 py-2 text-right">{e.trades}</td>
                  <td className={`px-3 py-2 text-right ${e.profitPct >= 0 ? "text-up font-bold" : "text-down font-bold"}`}>
                    {e.profitPct >= 0 ? "+" : ""}{e.profitPct.toFixed(2)}%
                  </td>
                  <td className={`px-3 py-2 text-right ${e.profitAbs >= 0 ? "text-up" : "text-down"}`}>
                    {e.profitAbs >= 0 ? "+" : ""}{e.profitAbs.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-up">{e.wins}</td>
                  <td className="px-3 py-2 text-right text-down">{e.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
