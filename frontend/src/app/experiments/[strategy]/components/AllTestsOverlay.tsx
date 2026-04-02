"use client";

import { useState, useEffect, useCallback } from "react";
import { getExperimentRuns, deleteExperimentRun } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface AllTestsOverlayProps {
  strategy: string;
  experimentId?: number;
  onClose: () => void;
  onNavigateToTab?: (tab: number) => void;
  onOpenOverlay?: (overlay: string) => void;
}

interface TestRow {
  id: number;
  type: string;
  status: string;
  date: string;
  profit: string;
  trades: number;
  winRate: string;
  sharpe: string;
  maxDD: string;
}

export default function AllTestsOverlay({ strategy, experimentId, onClose, onNavigateToTab, onOpenOverlay }: AllTestsOverlayProps) {
  const toast = useToast();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch experiment runs ──────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    if (!experimentId) { setLoading(false); return; }
    try {
      const runs = await getExperimentRuns(experimentId);
      const rows: TestRow[] = (runs || []).map((r) => ({
        id: r.id,
        type: r.run_type?.toUpperCase() || "—",
        status: r.status || "—",
        date: r.created_at ? new Date(r.created_at).toLocaleString() : "—",
        profit: r.profit_pct != null ? `${r.profit_pct >= 0 ? "+" : ""}${r.profit_pct.toFixed(2)}%` : "—",
        trades: r.total_trades ?? 0,
        winRate: r.win_rate != null ? `${(r.win_rate * 100).toFixed(1)}%` : "—",
        sharpe: r.sharpe_ratio != null ? r.sharpe_ratio.toFixed(2) : "—",
        maxDD: r.max_drawdown != null ? `${(-r.max_drawdown * 100).toFixed(1)}%` : "—",
      }));
      setTests(rows);
    } catch (err) {
      toast.error(`Failed to load runs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [experimentId, toast]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // ── Delete run ────────────────────────────────────────────────────
  const handleDelete = useCallback(async (runId: number) => {
    try {
      await deleteExperimentRun(runId);
      toast.success("Run deleted");
      fetchRuns();
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [toast, fetchRuns]);

  // ── Promote ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePromote = useCallback((_runId: number) => {
    toast.success("Promote: use activateStrategyVersion to deploy params");
  }, [toast]);

  // ── Load into tab ─────────────────────────────────────────────────
  const handleLoad = useCallback((row: TestRow) => {
    const typeMap: Record<string, number> = { BACKTEST: 1, HYPEROPT: 2, FREQAI: 3, AI_PRE: 4, AI_POST: 4, OOS_VALIDATION: 5 };
    const tabNum = typeMap[row.type] ?? 1;
    if (onNavigateToTab) onNavigateToTab(tabNum);
    if (onClose) onClose();
  }, [onNavigateToTab, onClose]);

  // Suppress
  void strategy; void onOpenOverlay;

  return (
    <div className="flex-1 flex flex-col">
      {loading ? (
        <div className="flex items-center justify-center h-full text-[11px] text-white/20 animate-pulse">Loading runs...</div>
      ) : tests.length === 0 ? (
        <div className="flex items-center justify-center h-full text-[11px] text-white/20">No experiment runs yet — start a backtest first</div>
      ) : (
        <div className="bg-surface l-bd rounded-md overflow-hidden">
          <table className="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
            <thead>
              <tr className="bg-surface l-b text-[11px] uppercase tracking-widest text-muted">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5 filterable">Type</th>
                <th className="px-3 py-2.5 filterable">Status</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5 text-right sortable">Profit</th>
                <th className="px-3 py-2.5 text-right sortable">Trades</th>
                <th className="px-3 py-2.5 text-right sortable">Win%</th>
                <th className="px-3 py-2.5 text-right sortable">Sharpe</th>
                <th className="px-3 py-2.5 text-right sortable">Max DD</th>
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-white/70">
              {tests.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-2 text-muted">{row.id}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 bg-white/[0.06] text-white/60 text-[9px] font-bold rounded">{row.type}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                      row.status === "completed" ? "bg-up/12 text-up" : row.status === "running" ? "bg-yellow-500/12 text-yellow-400" : "bg-down/12 text-down"
                    }`}>{row.status}</span>
                  </td>
                  <td className="px-3 py-2 text-muted">{row.date}</td>
                  <td className={`px-3 py-2 text-right font-bold ${row.profit.startsWith("+") ? "text-up" : row.profit.startsWith("-") ? "text-down" : ""}`}>{row.profit}</td>
                  <td className="px-3 py-2 text-right">{row.trades}</td>
                  <td className="px-3 py-2 text-right">{row.winRate}</td>
                  <td className="px-3 py-2 text-right">{row.sharpe}</td>
                  <td className="px-3 py-2 text-right text-down">{row.maxDD}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handlePromote(row.id)} className="text-[9px] px-1.5 py-0.5 bg-up/10 border border-up/25 text-up rounded hover:bg-up/20 transition-all">Promote</button>
                      <button onClick={() => handleLoad(row)} className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/10 text-muted rounded hover:text-white hover:bg-white/10 transition-all">Load</button>
                      <button onClick={() => handleDelete(row.id)} className="text-[9px] px-1.5 py-0.5 bg-down/10 border border-down/20 text-down/70 rounded hover:bg-down/20 hover:text-down transition-all">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
