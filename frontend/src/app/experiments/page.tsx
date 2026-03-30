"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
  getExperiments,
  getExperiment,
  deleteExperiment,
  deleteExperimentRun,
  getStrategyVersions,
  activateStrategyVersion,
  getStrategies,
} from "@/lib/api";
import type {
  Experiment,
  ExperimentDetail,
  ExperimentRun,
  ExperimentListResponse,
} from "@/lib/api";

// ── Tab definitions ──
const TABS = ["All Runs", "Strategy Versions", "Compare"] as const;
type Tab = (typeof TABS)[number];

// ── Helper: format date ──
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPct(val: number | null): string {
  if (val == null) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

function fmtNum(val: number | null): string {
  if (val == null) return "—";
  return val.toFixed(2);
}

// ── Run type badge colors ──
const RUN_TYPE_COLORS: Record<string, string> = {
  backtest: "bg-blue-500/20 text-blue-400",
  hyperopt: "bg-purple-500/20 text-purple-400",
  ai_pre: "bg-yellow-500/20 text-yellow-400",
  ai_post: "bg-orange-500/20 text-orange-400",
  oos_validation: "bg-green-500/20 text-green-400",
  freqai: "bg-cyan-500/20 text-cyan-400",
};

const STATUS_COLORS: Record<string, string> = {
  running: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
};

// ══════════════════════════════════════════════════════════════════
// ALL RUNS TAB
// ══════════════════════════════════════════════════════════════════

function AllRunsTab() {
  const toast = useToast();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [expandedRuns, setExpandedRuns] = useState<Record<number, ExperimentRun[]>>({});
  const [selectedRuns, setSelectedRuns] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedDetail, setExpandedDetail] = useState<number | null>(null);

  const loadExperiments = useCallback(async () => {
    try {
      const res = await getExperiments({ limit: 200 });
      setExperiments(res.items);
    } catch {
      toast.error("Failed to load experiments");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const toggleExpand = useCallback(async (expId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(expId)) {
        next.delete(expId);
      } else {
        next.add(expId);
        // Always fetch fresh (setExpandedRuns uses functional updater to avoid stale closure)
        getExperiment(expId).then((detail) => {
          setExpandedRuns((prev) => ({ ...prev, [expId]: detail.runs }));
        });
      }
      return next;
    });
  }, []);

  const handleDeleteRun = useCallback(async (runId: number) => {
    if (!confirm("Delete this run? This cannot be undone.")) return;
    try {
      await deleteExperimentRun(runId);
      toast.success("Run deleted");
      // Refresh
      setExpandedRuns({});
      loadExperiments();
    } catch {
      toast.error("Failed to delete run");
    }
  }, [toast, loadExperiments]);

  const handleDeleteExperiment = useCallback(async (expId: number) => {
    if (!confirm("Delete this experiment and all its runs?")) return;
    try {
      await deleteExperiment(expId);
      toast.success("Experiment deleted");
      loadExperiments();
    } catch {
      toast.error("Failed to delete experiment");
    }
  }, [toast, loadExperiments]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRuns.size === 0) return;
    if (!confirm(`Delete ${selectedRuns.size} selected run(s)?`)) return;
    try {
      await Promise.all(Array.from(selectedRuns).map((id) => deleteExperimentRun(id)));
      toast.success(`Deleted ${selectedRuns.size} runs`);
      setSelectedRuns(new Set());
      setExpandedRuns({});
      loadExperiments();
    } catch {
      toast.error("Failed to delete some runs");
    }
  }, [selectedRuns, toast, loadExperiments]);

  // Filter experiments
  const filtered = experiments.filter((exp) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !exp.name.toLowerCase().includes(term) &&
        !exp.pair.toLowerCase().includes(term) &&
        !(exp.strategy_name || "").toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-3">
        Loading experiments...
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search strategies, pairs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-bg-2 border border-border rounded-btn px-3 py-1.5 text-sm text-text-1 flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-bg-2 border border-border rounded-btn px-3 py-1.5 text-sm text-text-1 cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="backtest">Backtest</option>
          <option value="hyperopt">Hyperopt</option>
          <option value="ai_pre">AI Pre</option>
          <option value="ai_post">AI Post</option>
        </select>
        {selectedRuns.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-btn text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Delete {selectedRuns.size} selected
          </button>
        )}
        <button
          onClick={loadExperiments}
          className="bg-bg-2 border border-border rounded-btn px-3 py-1.5 text-sm text-text-2 hover:text-text-1 hover:bg-bg-3 transition-colors"
        >
          Refresh
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-3">
          <p className="text-lg mb-2">No experiments yet</p>
          <p className="text-sm">Run a backtest or hyperopt from the Backtesting page to create your first experiment.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_100px_80px_80px_90px_90px_80px_80px_90px_40px] gap-2 px-3 py-2 text-2xs font-semibold text-text-3 uppercase tracking-wider border-b border-border">
            <div className="w-5" />
            <div>Strategy / Run</div>
            <div>Type</div>
            <div>Pair</div>
            <div>TF</div>
            <div className="text-right">Trades</div>
            <div className="text-right">Win%</div>
            <div className="text-right">Profit</div>
            <div className="text-right">DD</div>
            <div>Date</div>
            <div />
          </div>

          {/* Experiment rows */}
          {filtered.map((exp) => {
            const isExpanded = expandedIds.has(exp.id);
            const runs = expandedRuns[exp.id] || [];
            const filteredRuns = typeFilter === "all"
              ? runs
              : runs.filter((r) => r.run_type === typeFilter);

            return (
              <div key={exp.id}>
                {/* Parent experiment row */}
                <div
                  className="grid grid-cols-[auto_1fr_100px_80px_80px_90px_90px_80px_80px_90px_40px] gap-2 px-3 py-2.5 bg-bg-2 hover:bg-bg-3 rounded-btn cursor-pointer transition-colors items-center"
                  onClick={() => toggleExpand(exp.id)}
                >
                  <div className="w-5 text-text-3 text-xs">
                    {isExpanded ? "▼" : "▶"}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-text-0">{exp.strategy_name || exp.name}</span>
                    <span className="text-2xs text-text-3 ml-2">({exp.run_count} runs)</span>
                  </div>
                  <div>
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-bg-3 text-text-2">Experiment</span>
                  </div>
                  <div className="text-sm text-text-1">{exp.pair}</div>
                  <div className="text-sm text-text-2">{exp.timeframe}</div>
                  <div className="text-right text-sm text-text-2">—</div>
                  <div className="text-right text-sm text-text-2">—</div>
                  <div className="text-right text-sm text-text-2">—</div>
                  <div className="text-right text-sm text-text-2">—</div>
                  <div className="text-2xs text-text-3">{fmtDate(exp.created_at)}</div>
                  <div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteExperiment(exp.id);
                      }}
                      className="text-text-3 hover:text-red-400 text-xs transition-colors"
                      title="Delete experiment"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Child run rows */}
                {isExpanded && (
                  <div className="ml-4 border-l border-border/50">
                    {filteredRuns.length === 0 ? (
                      <div className="px-6 py-3 text-sm text-text-3">
                        {runs.length === 0 ? "Loading runs..." : "No runs match filter"}
                      </div>
                    ) : (
                      filteredRuns.map((run) => (
                        <div key={run.id}>
                          <div
                            className="grid grid-cols-[auto_1fr_100px_80px_80px_90px_90px_80px_80px_90px_40px] gap-2 px-3 py-2 hover:bg-bg-2 rounded-btn cursor-pointer transition-colors items-center"
                            onClick={() => setExpandedDetail(expandedDetail === run.id ? null : run.id)}
                          >
                            <div className="w-5">
                              <input
                                type="checkbox"
                                checked={selectedRuns.has(run.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedRuns((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(run.id)) next.delete(run.id);
                                    else next.add(run.id);
                                    return next;
                                  });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-3.5 h-3.5 accent-accent cursor-pointer"
                              />
                            </div>
                            <div className="text-sm text-text-1">
                              {run.run_type === "hyperopt" && run.loss_function
                                ? run.loss_function.replace("HyperOptLoss", "")
                                : run.run_type}
                              {run.sampler && (
                                <span className="text-2xs text-text-3 ml-1.5">
                                  ({run.sampler.replace("Sampler", "")})
                                </span>
                              )}
                            </div>
                            <div>
                              <span className={`text-2xs px-2 py-0.5 rounded-full ${RUN_TYPE_COLORS[run.run_type] || "bg-bg-3 text-text-2"}`}>
                                {run.run_type}
                              </span>
                            </div>
                            <div className="text-sm text-text-2">—</div>
                            <div className="text-sm text-text-2">{run.epochs ? `${run.epochs}ep` : "—"}</div>
                            <div className="text-right text-sm text-text-1">{run.total_trades ?? "—"}</div>
                            <div className="text-right text-sm text-text-1">
                              {run.win_rate != null ? `${run.win_rate.toFixed(1)}%` : "—"}
                            </div>
                            <div className={`text-right text-sm font-medium ${(run.profit_pct ?? 0) >= 0 ? "text-green" : "text-red-400"}`}>
                              {fmtPct(run.profit_pct)}
                            </div>
                            <div className="text-right text-sm text-text-2">
                              {run.max_drawdown != null ? `${run.max_drawdown.toFixed(1)}%` : "—"}
                            </div>
                            <div className="text-2xs text-text-3">{fmtDateTime(run.created_at)}</div>
                            <div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRun(run.id);
                                }}
                                className="text-text-3 hover:text-red-400 text-xs transition-colors"
                                title="Delete run"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Expanded detail panel */}
                          {expandedDetail === run.id && (
                            <div className="mx-4 mb-2 p-3 bg-bg-2 rounded-btn border border-border/50 text-sm">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div>
                                  <span className="text-2xs text-text-3 block">Status</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[run.status] || ""}`}>
                                    {run.status}
                                  </span>
                                </div>
                                {run.sampler && (
                                  <div>
                                    <span className="text-2xs text-text-3 block">Sampler</span>
                                    <span className="text-text-1">{run.sampler}</span>
                                  </div>
                                )}
                                {run.loss_function && (
                                  <div>
                                    <span className="text-2xs text-text-3 block">Loss Function</span>
                                    <span className="text-text-1">{run.loss_function}</span>
                                  </div>
                                )}
                                {run.epochs && (
                                  <div>
                                    <span className="text-2xs text-text-3 block">Epochs</span>
                                    <span className="text-text-1">{run.epochs}</span>
                                  </div>
                                )}
                                {run.sharpe_ratio != null && (
                                  <div>
                                    <span className="text-2xs text-text-3 block">Sharpe</span>
                                    <span className="text-text-1">{fmtNum(run.sharpe_ratio)}</span>
                                  </div>
                                )}
                                {run.sortino_ratio != null && (
                                  <div>
                                    <span className="text-2xs text-text-3 block">Sortino</span>
                                    <span className="text-text-1">{fmtNum(run.sortino_ratio)}</span>
                                  </div>
                                )}
                                {run.avg_duration && (
                                  <div>
                                    <span className="text-2xs text-text-3 block">Avg Duration</span>
                                    <span className="text-text-1">{run.avg_duration}</span>
                                  </div>
                                )}
                                {run.spaces && (
                                  <div>
                                    <span className="text-2xs text-text-3 block">Spaces</span>
                                    <span className="text-text-1">{run.spaces.join(", ")}</span>
                                  </div>
                                )}
                              </div>
                              {run.raw_output && (
                                <details className="mt-2">
                                  <summary className="text-2xs text-text-3 cursor-pointer hover:text-text-2">
                                    Raw Output
                                  </summary>
                                  <pre className="mt-2 p-2 bg-bg-1 rounded text-2xs text-text-2 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
                                    {run.raw_output}
                                  </pre>
                                </details>
                              )}
                              {run.error_message && (
                                <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400">
                                  {run.error_message}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// STRATEGY VERSIONS TAB
// ══════════════════════════════════════════════════════════════════

function StrategyVersionsTab() {
  const toast = useToast();
  const [strategies, setStrategies] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [versions, setVersions] = useState<import("@/types").StrategyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState<number | null>(null);

  useEffect(() => {
    getStrategies()
      .then((strats) => {
        setStrategies(strats.map((s) => ({ id: s.id, name: s.name })));
        if (strats.length > 0 && !selectedStrategyId) {
          setSelectedStrategyId(strats[0].id);
        }
      })
      .catch(() => toast.error("Failed to load strategies"));
  }, [toast]);

  useEffect(() => {
    if (!selectedStrategyId) return;
    setLoading(true);
    getStrategyVersions(selectedStrategyId)
      .then(setVersions)
      .catch(() => toast.error("Failed to load versions"))
      .finally(() => setLoading(false));
  }, [selectedStrategyId, toast]);

  const handleActivate = useCallback(async (versionId: number) => {
    if (!selectedStrategyId) return;
    if (!confirm("Activate this version? This will write the params to the FT container.")) return;
    setActivating(versionId);
    try {
      const res = await activateStrategyVersion(selectedStrategyId, versionId);
      toast.success(res.message);
    } catch {
      toast.error("Failed to activate version");
    } finally {
      setActivating(null);
    }
  }, [selectedStrategyId, toast]);

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* Left: version list */}
      <div className="w-80 shrink-0 overflow-y-auto">
        {/* Strategy selector */}
        <select
          value={selectedStrategyId ?? ""}
          onChange={(e) => setSelectedStrategyId(Number(e.target.value))}
          className="w-full bg-bg-2 border border-border rounded-btn px-3 py-2 text-sm text-text-1 mb-3 cursor-pointer"
        >
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {loading ? (
          <div className="text-center py-8 text-text-3">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-text-3 text-sm">
            No versions yet. Run a hyperopt to create the first version.
          </div>
        ) : (
          <div className="space-y-1.5">
            {versions.map((v) => (
              <div key={v.id} className="p-3 bg-bg-2 rounded-btn border border-border/50 hover:border-border transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-text-0">v{v.version_number}</span>
                  <span className="text-2xs text-text-3">{fmtDate(v.created_at)}</span>
                </div>
                {v.changelog && (
                  <p className="text-2xs text-text-2 mb-2 line-clamp-2">{v.changelog}</p>
                )}
                {v.risk_config && (
                  <div className="text-2xs text-text-3 mb-2">
                    {v.risk_config.stoploss != null && (
                      <span className="mr-3">SL: {String(v.risk_config.stoploss)}</span>
                    )}
                    {v.risk_config.roi && (
                      <span>ROI: {JSON.stringify(v.risk_config.roi).slice(0, 30)}...</span>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleActivate(v.id)}
                    disabled={activating === v.id}
                    className="text-2xs px-2.5 py-1 rounded-btn bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
                  >
                    {activating === v.id ? "Activating..." : "Activate"}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(v.risk_config, null, 2));
                      toast.success("Params copied to clipboard");
                    }}
                    className="text-2xs px-2.5 py-1 rounded-btn bg-bg-3 text-text-2 hover:text-text-1 hover:bg-bg-3/80 transition-colors"
                  >
                    Copy Params
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: comparison table */}
      <div className="flex-1 overflow-auto">
        <Card>
          <CardHeader>Version Comparison</CardHeader>
          <CardBody>
            {versions.length < 2 ? (
              <div className="text-center py-8 text-text-3 text-sm">
                Need at least 2 versions to compare. Run more hyperopts to generate versions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-2xs text-text-3 uppercase tracking-wider border-b border-border">
                      <th className="text-left py-2 px-2">Param</th>
                      {versions.map((v) => (
                        <th key={v.id} className="text-right py-2 px-2">v{v.version_number}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Extract common params for comparison */}
                    {["stoploss", "roi", "trailing_stop", "trailing_stop_positive", "trailing_stop_positive_offset"].map((param) => (
                      <tr key={param} className="border-b border-border/30">
                        <td className="py-1.5 px-2 text-text-2">{param}</td>
                        {versions.map((v) => (
                          <td key={v.id} className="py-1.5 px-2 text-right text-text-1 font-mono text-xs">
                            {v.risk_config?.[param] != null
                              ? typeof v.risk_config[param] === "object"
                                ? JSON.stringify(v.risk_config[param])
                                : String(v.risk_config[param])
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// COMPARE TAB
// ══════════════════════════════════════════════════════════════════

function CompareTab() {
  const toast = useToast();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<number | null>(null);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [compareRuns, setCompareRuns] = useState<ExperimentRun[]>([]);

  useEffect(() => {
    getExperiments({ limit: 200 })
      .then((res) => setExperiments(res.items))
      .catch(() => toast.error("Failed to load experiments"));
  }, [toast]);

  useEffect(() => {
    if (!selectedExpId) return;
    getExperiment(selectedExpId)
      .then((detail) => setRuns(detail.runs))
      .catch(() => toast.error("Failed to load runs"));
  }, [selectedExpId, toast]);

  const addToCompare = (run: ExperimentRun) => {
    if (compareRuns.some((r) => r.id === run.id)) return;
    setCompareRuns((prev) => [...prev, run]);
  };

  const removeFromCompare = (runId: number) => {
    setCompareRuns((prev) => prev.filter((r) => r.id !== runId));
  };

  const escapeCsvCell = (val: unknown): string => {
    const s = String(val ?? "");
    // Strip leading formula injection characters (=, +, -, @, tab, CR)
    const stripped = s.replace(/^[=+\-@\t\r]+/, "");
    // Quote if contains comma, double-quote, or newline
    if (stripped.includes(",") || stripped.includes('"') || stripped.includes("\n")) {
      return '"' + stripped.replace(/"/g, '""') + '"';
    }
    return stripped;
  };

  const exportCsv = () => {
    if (compareRuns.length === 0) return;
    const headers = ["Run ID", "Type", "Sampler", "Loss Function", "Epochs", "Trades", "Win%", "Profit%", "Max DD%", "Sharpe", "Sortino", "Avg Duration"];
    const rows = compareRuns.map((r) => [
      r.id, r.run_type, r.sampler || "", r.loss_function || "",
      r.epochs || "", r.total_trades || "", r.win_rate ?? "",
      r.profit_pct ?? "", r.max_drawdown ?? "", r.sharpe_ratio ?? "",
      r.sortino_ratio ?? "", r.avg_duration || "",
    ].map(escapeCsvCell));
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "experiment_comparison.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Run picker */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 max-w-xs">
          <label className="text-2xs text-text-3 uppercase tracking-wider mb-1 block">Experiment</label>
          <select
            value={selectedExpId ?? ""}
            onChange={(e) => setSelectedExpId(Number(e.target.value) || null)}
            className="w-full bg-bg-2 border border-border rounded-btn px-3 py-1.5 text-sm text-text-1 cursor-pointer"
          >
            <option value="">Select experiment...</option>
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>{exp.name}</option>
            ))}
          </select>
        </div>
        {runs.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => addToCompare(run)}
                disabled={compareRuns.some((r) => r.id === run.id)}
                className="text-2xs px-2 py-1 rounded-btn bg-bg-2 text-text-2 hover:bg-bg-3 disabled:opacity-40 transition-colors border border-border/50"
              >
                + {run.run_type} #{run.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comparison table */}
      {compareRuns.length === 0 ? (
        <div className="text-center py-12 text-text-3 text-sm">
          Select an experiment and add runs to compare.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-2">{compareRuns.length} runs in comparison</span>
            <button
              onClick={exportCsv}
              className="text-2xs px-3 py-1.5 rounded-btn bg-bg-2 text-text-2 hover:text-text-1 border border-border hover:bg-bg-3 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-2xs text-text-3 uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 px-2">Run</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Sampler</th>
                  <th className="text-left py-2 px-2">Loss</th>
                  <th className="text-right py-2 px-2">Epochs</th>
                  <th className="text-right py-2 px-2">Trades</th>
                  <th className="text-right py-2 px-2">Win%</th>
                  <th className="text-right py-2 px-2">Profit%</th>
                  <th className="text-right py-2 px-2">Max DD</th>
                  <th className="text-right py-2 px-2">Sharpe</th>
                  <th className="text-right py-2 px-2">Sortino</th>
                  <th className="text-left py-2 px-2">Duration</th>
                  <th className="py-2 px-2" />
                </tr>
              </thead>
              <tbody>
                {compareRuns.map((run) => {
                  // Find best values for highlighting
                  const bestProfit = Math.max(...compareRuns.map((r) => r.profit_pct ?? -Infinity));
                  const bestDD = Math.min(...compareRuns.map((r) => r.max_drawdown ?? Infinity));
                  const bestSharpe = Math.max(...compareRuns.map((r) => r.sharpe_ratio ?? -Infinity));

                  return (
                    <tr key={run.id} className="border-b border-border/30 hover:bg-bg-2 transition-colors">
                      <td className="py-2 px-2 font-mono text-text-1">#{run.id}</td>
                      <td className="py-2 px-2">
                        <span className={`text-2xs px-2 py-0.5 rounded-full ${RUN_TYPE_COLORS[run.run_type] || ""}`}>
                          {run.run_type}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-text-2">{run.sampler?.replace("Sampler", "") || "—"}</td>
                      <td className="py-2 px-2 text-text-2 text-xs">{run.loss_function?.replace("HyperOptLoss", "") || "—"}</td>
                      <td className="py-2 px-2 text-right text-text-2">{run.epochs ?? "—"}</td>
                      <td className="py-2 px-2 text-right text-text-1">{run.total_trades ?? "—"}</td>
                      <td className="py-2 px-2 text-right text-text-1">
                        {run.win_rate != null ? `${run.win_rate.toFixed(1)}%` : "—"}
                      </td>
                      <td className={`py-2 px-2 text-right font-medium ${run.profit_pct === bestProfit ? "text-green" : (run.profit_pct ?? 0) >= 0 ? "text-green/70" : "text-red-400"}`}>
                        {fmtPct(run.profit_pct)}
                      </td>
                      <td className={`py-2 px-2 text-right ${run.max_drawdown === bestDD ? "text-green" : "text-text-2"}`}>
                        {run.max_drawdown != null ? `${run.max_drawdown.toFixed(1)}%` : "—"}
                      </td>
                      <td className={`py-2 px-2 text-right ${run.sharpe_ratio === bestSharpe ? "text-green" : "text-text-2"}`}>
                        {fmtNum(run.sharpe_ratio)}
                      </td>
                      <td className="py-2 px-2 text-right text-text-2">{fmtNum(run.sortino_ratio)}</td>
                      <td className="py-2 px-2 text-text-2">{run.avg_duration || "—"}</td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => removeFromCompare(run.id)}
                          className="text-text-3 hover:text-red-400 text-xs"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════

export default function ExperimentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("All Runs");

  return (
    <AppShell>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-text-0 mb-1">Experiments</h1>
          <p className="text-sm text-text-3">
            Track all test runs grouped by strategy. Compare results, manage versions, revert parameters.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-accent text-accent"
                  : "border-transparent text-text-3 hover:text-text-1"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "All Runs" && <AllRunsTab />}
        {activeTab === "Strategy Versions" && <StrategyVersionsTab />}
        {activeTab === "Compare" && <CompareTab />}
      </div>
    </AppShell>
  );
}
