"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

/* ══════════════════════════════════════
   STRATEGY DETAIL PANEL — Fully Interactive
   Props-driven: receives selected strategy from parent
   ══════════════════════════════════════ */

interface StrategyPanelProps {
  strategy: {
    id: string;
    name: string;
    status: string;
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
    botName?: string;
    botRunning?: boolean;
  } | null;
  onClose: () => void;
  onAction: (action: string) => void;
}

type DetailTab = "overview" | "trades" | "backtests" | "config" | "lifecycle";

const MOCK_OPEN_TRADES = [
  { trade_id: 1, pair: "BTC/USDT:USDT", is_short: false, open_rate: 67842.50, stake_amount: 1000, current_profit: 0.023, open_date: "2026-03-28 14:22", enter_tag: "ema_cross_bull" },
  { trade_id: 2, pair: "BTC/USDT:USDT", is_short: true, open_rate: 68100.00, stake_amount: 500, current_profit: -0.008, open_date: "2026-03-29 09:15", enter_tag: "rsi_overbought" },
];

const MOCK_CLOSED_TRADES = [
  { trade_id: 101, pair: "BTC/USDT:USDT", is_short: false, open_rate: 66500.00, close_rate: 67200.00, close_profit_abs: 105.26, enter_tag: "ema_cross_bull", exit_reason: "roi", open_date: "2026-03-25", close_date: "2026-03-26" },
  { trade_id: 102, pair: "BTC/USDT:USDT", is_short: true, open_rate: 67800.00, close_rate: 67100.00, close_profit_abs: 103.10, enter_tag: "rsi_overbought", exit_reason: "trailing_stop", open_date: "2026-03-26", close_date: "2026-03-27" },
  { trade_id: 103, pair: "BTC/USDT:USDT", is_short: false, open_rate: 65900.00, close_rate: 65500.00, close_profit_abs: -60.70, enter_tag: "macd_cross", exit_reason: "stoploss", open_date: "2026-03-24", close_date: "2026-03-24" },
];

const MOCK_BACKTEST_RUNS = [
  { run_id: "bt1", date: "Mar 10, 2026 — 2024-01-01 to 2026-03-01", profit: "+14.2%", profitAbs: "+$4,260", sharpe: "2.31", trades: 312, winRate: "67.9%", maxDd: "4.1%", duration: "3h 42m" },
  { run_id: "bt2", date: "Mar 8, 2026 — before hyperopt", profit: "+9.8%", profitAbs: "+$2,940", sharpe: "1.72", trades: 298, winRate: "63.1%", maxDd: "5.6%", duration: "4h 10m" },
  { run_id: "bt3", date: "Mar 5, 2026 — initial test", profit: "+5.2%", profitAbs: "+$1,560", sharpe: "1.15", trades: 245, winRate: "58.4%", maxDd: "7.8%", duration: "5h 22m" },
];

const PROTECTIONS = [
  { name: "StoplossGuard", val: "3 SL in 1h → lock 30m" },
  { name: "MaxDrawdown", val: "5% in 48h → lock 12h" },
  { name: "CooldownPeriod", val: "5 candles after trade" },
];

const statusBadge: Record<string, string> = {
  live: "bg-ft-green/15 text-ft-green border-ft-green/20",
  paper: "bg-ft-amber/15 text-ft-amber border-ft-amber/20",
  backtest: "bg-primary/15 text-primary border-primary/20",
  draft: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
  retired: "bg-ft-red/15 text-ft-red border-ft-red/20",
};

export function StrategyDetailPanel({ strategy, onClose, onAction }: StrategyPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  if (!strategy) return null;

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "trades", label: "Trades" },
    { key: "backtests", label: "Backtests" },
    { key: "config", label: "Config" },
    { key: "lifecycle", label: "Lifecycle" },
  ];

  const lifecycleStages = ["draft", "backtest", "paper", "live", "retired"];
  const currentStageIdx = lifecycleStages.indexOf(strategy.status);

  return (
    <Sheet open={!!strategy} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[540px] bg-card border-border overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg font-extrabold text-foreground flex-1">{strategy.name}</SheetTitle>
            <Badge variant="outline" className={`text-2xs font-bold uppercase ${statusBadge[strategy.status] || ""}`}>
              {strategy.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{strategy.description}</p>

          {/* Header actions */}
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onAction("edit")}>
              Edit
            </Button>
            {(strategy.status === "live" || strategy.status === "paper") && strategy.botRunning && (
              <Button variant="outline" size="sm" className="text-xs text-ft-amber border-ft-amber/20" onClick={() => alert(`Pausing bot ${strategy.botName}...`)}>
                Pause
              </Button>
            )}
            {(strategy.status === "live" || strategy.status === "paper") && (
              <Button variant="outline" size="sm" className="text-xs text-ft-red border-ft-red/20" onClick={() => onAction("retire")}>
                Retire
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs text-ft-red border-ft-red/20" onClick={() => onAction("delete")}>
              Delete
            </Button>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-border flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total P&L", value: strategy.totalPnl, color: strategy.pnlUp ? "text-ft-green" : "text-ft-red" },
                  { label: "Win Rate", value: strategy.winRate },
                  { label: "Sharpe", value: strategy.sharpe },
                  { label: "Max DD", value: strategy.maxDd },
                  { label: "Trades", value: String(strategy.trades) },
                  { label: "Avg Duration", value: strategy.avgDuration },
                ].map((stat) => (
                  <div key={stat.label} className="bg-accent/30 border border-border rounded-lg p-3">
                    <div className="text-2xs text-muted-foreground uppercase">{stat.label}</div>
                    <div className={`text-sm font-bold font-mono-data ${stat.color || "text-foreground"}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Config summary */}
              <div className="flex gap-2 flex-wrap text-2xs">
                <span className="bg-accent/40 px-2 py-1 rounded">{strategy.pair}</span>
                <span className="bg-accent/40 px-2 py-1 rounded">{strategy.tf}</span>
                <span className="bg-accent/40 px-2 py-1 rounded">{strategy.leverage}</span>
                {strategy.botName && (
                  <span className="bg-accent/40 px-2 py-1 rounded flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${strategy.botRunning ? "bg-ft-green" : "bg-muted-foreground"}`} />
                    {strategy.botName}
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTab === "trades" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground mb-2">Open Trades ({MOCK_OPEN_TRADES.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border text-left">
                        <th className="py-2 font-medium">Pair</th>
                        <th className="py-2 font-medium">Side</th>
                        <th className="py-2 font-medium text-right">open_rate</th>
                        <th className="py-2 font-medium text-right">current_profit</th>
                        <th className="py-2 font-medium">enter_tag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_OPEN_TRADES.map((t) => (
                        <tr key={t.trade_id} className="border-b border-border/30">
                          <td className="py-2 text-foreground font-medium">{t.pair}</td>
                          <td className="py-2"><span className={t.is_short ? "text-ft-red" : "text-ft-green"}>{t.is_short ? "SHORT" : "LONG"}</span></td>
                          <td className="py-2 text-right font-mono-data">{t.open_rate.toFixed(2)}</td>
                          <td className={`py-2 text-right font-bold font-mono-data ${t.current_profit >= 0 ? "text-ft-green" : "text-ft-red"}`}>
                            {(t.current_profit * 100).toFixed(2)}%
                          </td>
                          <td className="py-2 text-muted-foreground">{t.enter_tag}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-xs font-bold text-foreground mb-2">Closed Trades ({MOCK_CLOSED_TRADES.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border text-left">
                        <th className="py-2 font-medium">Pair</th>
                        <th className="py-2 font-medium">Side</th>
                        <th className="py-2 font-medium text-right">close_profit_abs</th>
                        <th className="py-2 font-medium">exit_reason</th>
                        <th className="py-2 font-medium">close_date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_CLOSED_TRADES.map((t) => (
                        <tr key={t.trade_id} className="border-b border-border/30">
                          <td className="py-2 text-foreground font-medium">{t.pair}</td>
                          <td className="py-2"><span className={t.is_short ? "text-ft-red" : "text-ft-green"}>{t.is_short ? "SHORT" : "LONG"}</span></td>
                          <td className={`py-2 text-right font-bold font-mono-data ${t.close_profit_abs >= 0 ? "text-ft-green" : "text-ft-red"}`}>
                            {t.close_profit_abs >= 0 ? "+" : ""}{t.close_profit_abs.toFixed(2)}
                          </td>
                          <td className="py-2 text-muted-foreground">{t.exit_reason}</td>
                          <td className="py-2 text-muted-foreground">{t.close_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "backtests" && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground mb-2">Backtest History ({MOCK_BACKTEST_RUNS.length} runs)</h4>
              {MOCK_BACKTEST_RUNS.map((b) => (
                <div key={b.run_id} className="bg-accent/30 border border-border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-2xs text-muted-foreground">{b.date}</span>
                    <span className="text-sm font-bold text-ft-green font-mono-data">{b.profit}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Sharpe", val: b.sharpe },
                      { label: "Trades", val: b.trades },
                      { label: "Win Rate", val: b.winRate },
                      { label: "Max DD", val: b.maxDd },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="text-2xs text-muted-foreground">{m.label}</div>
                        <div className="text-xs font-bold text-foreground font-mono-data">{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-2xs text-muted-foreground mt-1">Avg duration: {b.duration} | Profit: {b.profitAbs}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "config" && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground mb-2">Bot Configuration</h4>
              {[
                { key: "strategy", val: `${strategy.name}.py`, accent: true },
                { key: "pair_whitelist", val: strategy.pair },
                { key: "timeframe", val: strategy.tf },
                { key: "stake_amount", val: "$1,000" },
                { key: "stoploss", val: "-0.035 (-3.5%)", color: "text-ft-red" },
                { key: "trailing_stop", val: "enabled", color: "text-ft-green" },
                { key: "trailing_stop_positive", val: "0.01" },
                { key: "minimal_roi", val: '{"0": 0.10, "30": 0.05, "60": 0.02}' },
                { key: "leverage", val: `${strategy.leverage} (isolated)` },
                { key: "dry_run", val: strategy.status === "paper" ? "true" : strategy.status === "live" ? "false" : "—", color: strategy.status === "live" ? "text-ft-red" : "text-ft-amber" },
              ].map((c) => (
                <div key={c.key} className="flex justify-between items-baseline py-1.5 border-b border-border/30 last:border-b-0">
                  <span className="text-xs text-muted-foreground">{c.key}</span>
                  <span className={`text-xs font-semibold ${c.color || "text-foreground"} ${c.accent ? "text-primary font-mono-data" : ""}`}>
                    {c.val}
                  </span>
                </div>
              ))}

              <Separator className="my-3" />

              <h4 className="text-xs font-bold text-foreground mb-2">FT Protections (active)</h4>
              {PROTECTIONS.map((p) => (
                <div key={p.name} className="flex justify-between items-baseline py-1.5 border-b border-border/30 last:border-b-0">
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                  <span className="text-xs font-semibold text-foreground">{p.val}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "lifecycle" && (
            <div className="space-y-0">
              <h4 className="text-xs font-bold text-foreground mb-4">Lifecycle Progress</h4>
              {lifecycleStages.map((stage, idx) => {
                const isDone = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                return (
                  <div key={stage} className="flex gap-3 pb-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                        isDone ? "bg-ft-green border-ft-green" :
                        isCurrent ? "bg-primary border-primary animate-pulse" :
                        "bg-transparent border-muted-foreground/30"
                      }`} />
                      {idx < lifecycleStages.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 -mt-0.5">
                      <div className={`text-xs font-bold uppercase ${isCurrent ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground/40"}`}>
                        {stage}
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        {isCurrent ? "Current stage" : isDone ? "Completed" : "Pending"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border flex gap-2 mt-auto">
          <Button variant="outline" className="flex-1 text-xs" onClick={() => onAction("edit")}>
            ✏️ Edit Strategy
          </Button>
          <Button variant="outline" className="flex-1 text-xs" onClick={() => setActiveTab("trades")}>
            📒 View Trades
          </Button>
          <Button variant="outline" className="flex-1 text-xs" onClick={() => alert(`Opening analytics for ${strategy.name}`)}>
            📊 Analytics
          </Button>
          {(strategy.status === "live" || strategy.status === "paper") && (
            <Button className="flex-1 text-xs" onClick={() => alert(`Navigating to dashboard for ${strategy.name}`)}>
              📈 View Bot
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
