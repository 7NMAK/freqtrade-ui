"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { StrategyDetailPanel } from "./strategy-detail-panel";
import { ImportStrategyModal } from "./import-modal";
import { useApi } from "@/lib/useApi";
import { getStrategies } from "@/lib/api";
import { Strategy as ApiStrategy } from "@/types";

/* ══════════════════════════════════════
   STRATEGIES — Fully Interactive Design
   ══════════════════════════════════════ */

type StrategyStatus = "live" | "paper" | "backtest" | "draft" | "retired";

interface Strategy {
  id: string;
  name: string;
  status: StrategyStatus;
  description: string;
  pair: string;
  tf: string;
  leverage: string;
  totalPnl: string;
  pnlUp: boolean;
  winRate: string;
  sharpe: string;
  trades: number;
  maxDd: string;
  avgDuration: string;
  bars: number[];
  botName?: string;
  botRunning?: boolean;
}

const statusColors: Record<StrategyStatus, string> = {
  live: "bg-ft-green/15 text-ft-green border-ft-green/20",
  paper: "bg-ft-amber/15 text-ft-amber border-ft-amber/20",
  backtest: "bg-primary/15 text-primary border-primary/20",
  draft: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
  retired: "bg-ft-red/15 text-ft-red border-ft-red/20",
};

const statusActions: Record<StrategyStatus, { label: string; icon: string; action: string }[]> = {
  live: [{ label: "View Bot", icon: "📈", action: "view_bot" }, { label: "Analytics", icon: "📊", action: "analytics" }, { label: "Edit", icon: "✏️", action: "edit" }],
  paper: [{ label: "Go Live →", icon: "🚀", action: "go_live" }, { label: "Analytics", icon: "📊", action: "analytics" }, { label: "Edit", icon: "✏️", action: "edit" }],
  backtest: [{ label: "Start Paper →", icon: "📝", action: "start_paper" }, { label: "View Results", icon: "📊", action: "view_results" }, { label: "Edit", icon: "✏️", action: "edit" }],
  draft: [{ label: "Run Backtest →", icon: "🧪", action: "run_backtest" }, { label: "Edit", icon: "✏️", action: "edit" }],
  retired: [{ label: "Clone", icon: "📋", action: "clone" }, { label: "Export .py", icon: "📥", action: "export" }],
};

export default function StrategiesPage() {
  const { data: rawStrategies, refetch } = useApi(getStrategies, []);
  
  const strategies: Strategy[] = (rawStrategies || []).map((s: ApiStrategy) => {
    let mappedStatus: StrategyStatus = "draft";
    if (s.lifecycle === "live") mappedStatus = "live";
    else if (s.lifecycle === "paper") mappedStatus = "paper";
    else if (s.lifecycle === "backtest") mappedStatus = "backtest";
    else if (s.lifecycle === "retired") mappedStatus = "retired";

    return {
      id: String(s.id),
      name: s.name,
      status: mappedStatus,
      description: s.description || "No description provided.",
      pair: "Multiple",
      tf: s.timeframe || "1h",
      leverage: "1x",
      totalPnl: "—",
      pnlUp: true,
      winRate: "—",
      sharpe: "—",
      trades: 0,
      maxDd: "—",
      avgDuration: "—",
      bars: [0, 0, 0, 0, 0, 0, 0],
      botName: s.bot_instance_id ? `Bot #${s.bot_instance_id}` : undefined,
      botRunning: !!s.bot_instance_id
    };
  });

  const [activeFilter, setActiveFilter] = useState<StrategyStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

  const filtered = activeFilter === "all"
    ? strategies
    : strategies.filter((s) => s.status === activeFilter);

  const counts: Record<string, number> = { all: strategies.length };
  for (const s of strategies) counts[s.status] = (counts[s.status] || 0) + 1;

  const selectedStrategy = selectedId ? strategies.find((s) => s.id === selectedId) ?? null : null;

  const handleAction = useCallback((strategyId: string, action: string) => {
    const strat = strategies.find((s) => s.id === strategyId);
    if (!strat) return;

    switch (action) {
      case "view_bot":
        router.push("/redesign/dashboard");
        break;
      case "analytics":
        router.push("/redesign/analytics");
        break;
      case "edit":
        router.push("/redesign/builder");
        break;
      case "go_live": {
        if (window.confirm(`Switch "${strat.name}" to LIVE trading?\nThis will use REAL funds.`)) {
          console.info(`${strat.name} is now LIVE (Pending API toggle)`);
        }
        break;
      }
      case "start_paper": {
        if (window.confirm(`Start paper trading for "${strat.name}"?`)) {
          console.info(`${strat.name} is now paper trading (Pending API toggle)`);
        }
        break;
      }
      case "run_backtest":
        console.info(`Starting backtest for ${strat.name}...`);
        router.push("/redesign/backtesting");
        break;
      case "clone": {
        console.info(`Cloned as ${strat.name}_copy (Pending API clone)`);
        break;
      }
      case "export":
        console.info(`Downloading ${strat.name}.py`);
        break;
      case "view_results":
        setSelectedId(strategyId);
        break;
      case "retire": {
        if (window.confirm(`Retire "${strat.name}"? This will stop the bot.`)) {
          console.info(`Retired ${strat.name} (Pending API retire)`);
        }
        break;
      }
      case "delete": {
        if (window.confirm(`Delete "${strat.name}"? This cannot be undone.`)) {
          console.info(`Deleted ${strat.name} (Pending API delete)`);
          if (selectedId === strategyId) setSelectedId(null);
        }
        break;
      }
    }
  }, [strategies, selectedId, router]);

  const handleImport = useCallback((fileName: string) => {
    console.info(`${fileName} imported (Pending API POST handling)`);
    refetch();
  }, [refetch]);

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Strategies</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {strategies.length} strategies &middot; {counts.live || 0} live &middot; {counts.paper || 0} paper
          </p>
        </div>
        <div className="flex gap-2">
          <ImportStrategyModal onImport={handleImport} />
          <a
            href="/redesign/builder"
            className="h-9 px-4 rounded-btn bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            ✏️ New Strategy
          </a>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {(["all", "live", "paper", "backtest", "draft", "retired"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-btn text-xs font-semibold border transition-all capitalize ${
              activeFilter === f
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-primary/30 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f}
            <span className="ml-1.5 text-2xs opacity-60">{counts[f] || 0}</span>
          </button>
        ))}
      </div>

      {/* Strategy Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No strategies in &ldquo;{activeFilter}&rdquo; lifecycle.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((s) => (
            <StrategyCard
              key={s.id}
              s={s}
              isSelected={selectedId === s.id}
              onSelect={() => setSelectedId(s.id)}
              onAction={(action) => handleAction(s.id, action)}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      <StrategyDetailPanel
        strategy={selectedStrategy}
        onClose={() => setSelectedId(null)}
        onAction={(action) => selectedId && handleAction(selectedId, action)}
      />
    </>
  );
}

/* ── Strategy Card ── */
function StrategyCard({
  s,
  isSelected,
  onSelect,
  onAction,
}: {
  s: Strategy;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: string) => void;
}) {
  const actions = statusActions[s.status];
  return (
    <Card
      className={`hover:border-primary/30 hover:-translate-y-0.5 transition-all cursor-pointer ${
        isSelected ? "border-primary/50 ring-1 ring-primary/20" : ""
      } ${s.status === "retired" ? "opacity-60" : ""}`}
      onClick={onSelect}
    >
      <CardHeader className="py-4 px-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <CardTitle className="text-md font-extrabold text-foreground">{s.name}</CardTitle>
          <Badge variant="outline" className={`text-2xs font-bold uppercase ${statusColors[s.status]}`}>
            {s.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {/* Config tags */}
        <div className="flex gap-2 mb-3 text-2xs text-muted-foreground flex-wrap">
          <span className="bg-primary/40 px-2 py-0.5 rounded">{s.pair}</span>
          <span className="bg-primary/40 px-2 py-0.5 rounded">{s.tf}</span>
          <span className="bg-primary/40 px-2 py-0.5 rounded">{s.leverage}</span>
        </div>

        {/* Bot status */}
        {s.botName && (
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground mb-3">
            <span className={`w-1.5 h-1.5 rounded-full ${s.botRunning ? "bg-ft-green shadow-[0_0_4px_var(--ft-green)]" : "bg-muted-foreground"}`} />
            {s.botName} {s.botRunning ? "running" : "stopped"}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-3">
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Total P&L</div>
            <div className={`text-sm font-bold font-mono ${s.pnlUp ? "text-ft-green" : "text-ft-red"}`}>{s.totalPnl}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Win Rate</div>
            <div className="text-sm font-bold font-mono text-foreground">{s.winRate}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Sharpe</div>
            <div className="text-sm font-bold font-mono text-foreground">{s.sharpe}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Trades</div>
            <div className="text-sm font-bold font-mono text-foreground">{s.trades || "—"}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Max DD</div>
            <div className="text-sm font-bold font-mono text-foreground">{s.maxDd}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Avg Duration</div>
            <div className="text-sm font-bold font-mono text-foreground">{s.avgDuration}</div>
          </div>
        </div>

        {/* Sparkline */}
        <div className="flex items-end gap-[3px] h-5 mb-3">
          {s.bars.map((v, i) => (
            <div
              key={`${s.id}-bar-${v}-${i === 0 ? "first" : i === s.bars.length - 1 ? "last" : "mid"}`}
              className={`flex-1 rounded-t-[2px] min-h-[2px] ${v >= 0 ? "bg-ft-green/50" : "bg-ft-red/50 rounded-t-none rounded-b-[2px]"}`}
              style={{ height: v === 0 ? "2px" : `${Math.abs(v)}%` }}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => onAction(a.action)}
              className="flex-1 text-2xs font-semibold py-2 rounded-btn border border-border bg-primary/20 text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
