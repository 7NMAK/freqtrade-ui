"use client";

import { useState, useEffect, useCallback } from "react";
import { getExperimentRuns, botBacktestHistoryResult } from "@/lib/api";


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

interface RunOption { value: string; label: string; filename?: string; strategyName?: string; }

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return `${days}d ${rem}h`;
}

export default function AnalysisOverlay({ onClose, strategy, experimentId, botId = 2 }: AnalysisOverlayProps) {
  const [selectedRun, setSelectedRun] = useState("");
  const [activeView, setActiveView] = useState<ViewTab>("trades");
  const [runOptions, setRunOptions] = useState<RunOption[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [exits, setExits] = useState<ExitRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load run options from experiment ──────────────────────────────
  useEffect(() => {
    if (!experimentId) { setLoading(false); return; }
    (async () => {
      try {
        const runs = await getExperimentRuns(experimentId);
        const options: RunOption[] = (runs || [])
          .filter((r) => r.status === "completed")
          .map((r) => ({
            value: String(r.id),
            label: `${r.run_type?.toUpperCase()} #${r.id} — ${r.total_trades ?? 0} trades`,
          }));
        setRunOptions(options);
        if (options.length > 0) setSelectedRun(options[0].value);
      } catch { /* */ }
      setLoading(false);
    })();
  }, [experimentId]);

  // ── Load trade data for selected run ──────────────────────────────
  const loadRunData = useCallback(async (runId: string) => {
    if (!runId) return;
    try {
      // Try to load from backtest history
      // The run maps to a backtest file - we'll load via botBacktestHistoryResult
      const data = await botBacktestHistoryResult(botId, `backtest-result-${runId}.json`, strategy);
      const r = data as Record<string, unknown>;
      const stratMap = r.strategy as Record<string, Record<string, unknown>> | undefined;
      if (!stratMap) return;
      const firstKey = Object.keys(stratMap)[0];
      if (!firstKey) return;
      const raw = stratMap[firstKey];

      // Parse trades
      const rawTrades = (raw.trades as Array<Record<string, unknown>>) || [];
      const tradeRows: TradeRow[] = rawTrades.map((t, i) => ({
        id: Number(t.trade_id ?? i + 1),
        pair: String(t.pair ?? ""),
        side: t.is_short ? "SHORT" : "LONG",
        profitPct: Number(t.profit_ratio ?? t.close_profit ?? 0) * 100,
        profitAbs: Number(t.profit_abs ?? t.close_profit_abs ?? 0),
        open: String(t.open_date ?? "").slice(0, 16),
        close: String(t.close_date ?? "").slice(0, 16),
        duration: fmtDuration(Number(t.trade_duration ?? 0)),
        exit: String(t.exit_reason ?? ""),
      }));
      setTrades(tradeRows);

      // Parse per-pair
      const pairData = (raw.results_per_pair as Array<Record<string, unknown>>) || [];
      const pairRows: PairRow[] = pairData.map((p) => ({
        pair: String(p.key ?? ""),
        trades: Number(p.trades ?? 0),
        profitPct: Number(p.profit_total ?? 0) * 100,
        profitAbs: Number(p.profit_total_abs ?? 0),
        winRate: Number(p.wins ?? 0) / Math.max(Number(p.trades ?? 1), 1) * 100,
        avgDuration: "—",
      }));
      setPairs(pairRows);

      // Parse exits
      const exitData = (raw.exit_reason_summary as Array<Record<string, unknown>>) || [];
      const exitRows: ExitRow[] = exitData.map((e) => ({
        reason: String(e.exit_reason ?? ""),
        trades: Number(e.trades ?? 0),
        profitPct: Number(e.profit_total ?? 0) * 100,
        profitAbs: Number(e.profit_total_abs ?? 0),
        wins: Number(e.wins ?? 0),
        losses: Number(e.losses ?? 0),
      }));
      setExits(exitRows);
    } catch {
      // If backtest history load fails, data stays empty 
    }
  }, [botId, strategy]);

  useEffect(() => {
    if (selectedRun) loadRunData(selectedRun);
  }, [selectedRun, loadRunData]);

  // Suppress
  void onClose;

  const viewTabs: Array<{ key: ViewTab; label: string }> = [
    { key: "trades", label: "Trades" },
    { key: "per_pair", label: "Per Pair" },
    { key: "exit_reasons", label: "Exit Reasons" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {/* Selector row */}
      <div className="flex gap-3 mb-4">
        <div>
          <label className="text-white/45 mb-1 text-[10px] uppercase tracking-wider font-bold block">Select Run</label>
          <select
            value={selectedRun}
            onChange={(e) => setSelectedRun(e.target.value)}
            className="bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
          >
            {loading ? (
              <option>Loading...</option>
            ) : runOptions.length === 0 ? (
              <option>No runs available</option>
            ) : (
              runOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
            )}
          </select>
        </div>
        <div className="flex items-end gap-1 pb-0.5">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`px-3 py-2 l-bd text-[10px] font-bold rounded uppercase tracking-wider transition-colors ${
                activeView === tab.key ? "bg-white/10 text-white" : "bg-white/[0.03] text-white/40 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trades view */}
      {activeView === "trades" && (
        <div className="bg-surface l-bd rounded-md overflow-hidden">
          {trades.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[11px] text-white/20">
              {loading ? "Loading..." : "No trade data available — select a run"}
            </div>
          ) : (
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
              {trades.map((t) => (
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
          )}
        </div>
      )}

      {/* Per Pair view */}
      {activeView === "per_pair" && (
        <div className="bg-surface l-bd rounded-md overflow-hidden">
          {pairs.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[11px] text-white/20">No pair data available</div>
          ) : (
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
              {pairs.map((p) => (
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
          )}
        </div>
      )}

      {/* Exit Reasons view */}
      {activeView === "exit_reasons" && (
        <div className="bg-surface l-bd rounded-md overflow-hidden">
          {exits.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[11px] text-white/20">No exit data available</div>
          ) : (
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
              {exits.map((e) => (
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
          )}
        </div>
      )}
    </div>
  );
}
