"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { StrategyDetailPanel } from "./strategy-detail-panel";
import { ImportStrategyModal } from "./import-modal";

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

const INITIAL_STRATEGIES: Strategy[] = [
  { id: "s1", name: "TrendFollowerV3", status: "live", description: "Multi-timeframe trend following with EMA crossover + ADX filter", pair: "BTC/USDT", tf: "1h", leverage: "10x", totalPnl: "+$4,821", pnlUp: true, winRate: "67.9%", sharpe: "2.31", trades: 312, maxDd: "4.1%", avgDuration: "3h 42m", bars: [40, 60, -20, 80, 55, 90, 70], botName: "bot-trend-01", botRunning: true },
  { id: "s2", name: "MeanReversionV2", status: "live", description: "Bollinger Band mean reversion with RSI confirmation", pair: "ETH/USDT", tf: "1h", leverage: "5x", totalPnl: "+$2,340", pnlUp: true, winRate: "72.1%", sharpe: "1.89", trades: 428, maxDd: "3.2%", avgDuration: "1h 18m", bars: [30, -15, 45, 65, -10, 50, 75], botName: "bot-mean-rev", botRunning: true },
  { id: "s3", name: "HLScalperV1", status: "live", description: "High-leverage scalping on SOL with Supertrend + Volume", pair: "SOL/USDT", tf: "5m", leverage: "20x", totalPnl: "-$890", pnlUp: false, winRate: "54.3%", sharpe: "0.72", trades: 1241, maxDd: "8.9%", avgDuration: "22m", bars: [50, 35, -25, -40, 20, -30, -15], botName: "bot-scalp-hl", botRunning: true },
  { id: "s4", name: "BreakoutAI", status: "paper", description: "FreqAI-powered breakout detection with LightGBM predictions", pair: "Multi-pair", tf: "4h", leverage: "3x", totalPnl: "+$940", pnlUp: true, winRate: "61.2%", sharpe: "1.65", trades: 87, maxDd: "5.1%", avgDuration: "6h 10m", bars: [20, 40, 55, 70, 60, 85, 90], botName: "bot-breakout-p", botRunning: true },
  { id: "s5", name: "FreqAI_LightGBM", status: "paper", description: "Experimental ML model with custom feature engineering", pair: "BTC/USDT", tf: "1h", leverage: "2x", totalPnl: "+$280", pnlUp: true, winRate: "58.4%", sharpe: "1.22", trades: 45, maxDd: "3.8%", avgDuration: "4h 55m", bars: [-10, 25, 35, -5, 45, 30, 50], botName: "bot-freqai-exp", botRunning: true },
  { id: "s6", name: "GridBotV4", status: "backtest", description: "Grid trading strategy for ranging markets", pair: "ETH/USDT", tf: "15m", leverage: "5x", totalPnl: "+$1,420", pnlUp: true, winRate: "76.8%", sharpe: "1.95", trades: 523, maxDd: "2.9%", avgDuration: "45m", bars: [60, 55, 70, 65, 80, 75, 85] },
  { id: "s7", name: "DCA_MomentumV1", status: "draft", description: "Dollar cost averaging with momentum entry signals", pair: "BTC/USDT", tf: "4h", leverage: "1x", totalPnl: "—", pnlUp: true, winRate: "—", sharpe: "—", trades: 0, maxDd: "—", avgDuration: "—", bars: [0, 0, 0, 0, 0, 0, 0] },
  { id: "s8", name: "OldTrendV1", status: "retired", description: "Legacy trend follower — replaced by TrendFollowerV3", pair: "BTC/USDT", tf: "1h", leverage: "5x", totalPnl: "+$12,490", pnlUp: true, winRate: "64.1%", sharpe: "1.78", trades: 2104, maxDd: "7.2%", avgDuration: "2h 50m", bars: [70, 65, 80, 60, 75, 50, 45] },
];

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

/* ══════════════════════════════════════
   PAGE
   ══════════════════════════════════════ */
export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  const [activeFilter, setActiveFilter] = useState<StrategyStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        alert(`Navigating to dashboard for ${strat.name}`);
        break;
      case "analytics":
        alert(`Opening analytics for ${strat.name}`);
        break;
      case "edit":
        alert(`Opening builder for ${strat.name}`);
        break;
      case "go_live": {
        if (window.confirm(`Switch "${strat.name}" to LIVE trading?\nThis will use REAL funds.`)) {
          setStrategies((prev) =>
            prev.map((s) => s.id === strategyId ? { ...s, status: "live" as StrategyStatus } : s)
          );
          alert(`${strat.name} is now LIVE`);
        }
        break;
      }
      case "start_paper": {
        if (window.confirm(`Start paper trading for "${strat.name}"?`)) {
          setStrategies((prev) =>
            prev.map((s) => s.id === strategyId ? { ...s, status: "paper" as StrategyStatus, botName: `bot-${strat.name.toLowerCase().slice(0, 8)}`, botRunning: true } : s)
          );
          alert(`${strat.name} is now paper trading`);
        }
        break;
      }
      case "run_backtest":
        alert(`Starting backtest for ${strat.name}...`);
        setStrategies((prev) =>
          prev.map((s) => s.id === strategyId ? { ...s, status: "backtest" as StrategyStatus } : s)
        );
        break;
      case "clone": {
        const clone: Strategy = {
          ...strat,
          id: `s${Date.now()}`,
          name: `${strat.name}_copy`,
          status: "draft",
          trades: 0,
          totalPnl: "—",
          winRate: "—",
          sharpe: "—",
          maxDd: "—",
          avgDuration: "—",
          bars: [0, 0, 0, 0, 0, 0, 0],
        };
        setStrategies((prev) => [...prev, clone]);
        alert(`Cloned as ${clone.name}`);
        break;
      }
      case "export":
        alert(`Downloading ${strat.name}.py`);
        break;
      case "view_results":
        setSelectedId(strategyId);
        break;
      case "retire": {
        if (window.confirm(`Retire "${strat.name}"? This will stop the bot.`)) {
          setStrategies((prev) =>
            prev.map((s) => s.id === strategyId ? { ...s, status: "retired" as StrategyStatus, botRunning: false } : s)
          );
        }
        break;
      }
      case "delete": {
        if (window.confirm(`Delete "${strat.name}"? This cannot be undone.`)) {
          setStrategies((prev) => prev.filter((s) => s.id !== strategyId));
          if (selectedId === strategyId) setSelectedId(null);
        }
        break;
      }
    }
  }, [strategies, selectedId]);

  const handleImport = useCallback((fileName: string) => {
    const newStrat: Strategy = {
      id: `s${Date.now()}`,
      name: fileName.replace(".py", ""),
      status: "draft",
      description: `Imported from ${fileName}`,
      pair: "BTC/USDT",
      tf: "1h",
      leverage: "1x",
      totalPnl: "—",
      pnlUp: true,
      winRate: "—",
      sharpe: "—",
      trades: 0,
      maxDd: "—",
      avgDuration: "—",
      bars: [0, 0, 0, 0, 0, 0, 0],
    };
    setStrategies((prev) => [...prev, newStrat]);
    alert(`${fileName} imported as "${newStrat.name}" (DRAFT)`);
  }, []);

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
                : "bg-accent/30 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
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
          <span className="bg-accent/40 px-2 py-0.5 rounded">{s.pair}</span>
          <span className="bg-accent/40 px-2 py-0.5 rounded">{s.tf}</span>
          <span className="bg-accent/40 px-2 py-0.5 rounded">{s.leverage}</span>
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
            <div className={`text-sm font-bold font-mono-data ${s.pnlUp ? "text-ft-green" : "text-ft-red"}`}>{s.totalPnl}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Win Rate</div>
            <div className="text-sm font-bold font-mono-data text-foreground">{s.winRate}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Sharpe</div>
            <div className="text-sm font-bold font-mono-data text-foreground">{s.sharpe}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Trades</div>
            <div className="text-sm font-bold font-mono-data text-foreground">{s.trades || "—"}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Max DD</div>
            <div className="text-sm font-bold font-mono-data text-foreground">{s.maxDd}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground uppercase">Avg Duration</div>
            <div className="text-sm font-bold font-mono-data text-foreground">{s.avgDuration}</div>
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
              className="flex-1 text-2xs font-semibold py-2 rounded-btn border border-border bg-accent/20 text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
