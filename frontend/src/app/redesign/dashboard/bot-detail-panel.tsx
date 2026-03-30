"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

/* ══════════════════════════════════════════════════════════════════
   BOT DETAIL PANEL — 1000px
   - Header: bot info + Pause/Stop/Kill only
   - No Edit Bot tab (config changes go through Settings page)
   - Equity curve matches FreqUI style (Days/Weeks/Months + Abs/Rel)
   - Actions tab contains ALL navigation + bot control
   ══════════════════════════════════════════════════════════════════ */

interface BotData { name: string; status: "live" | "paper"; strategy: string; pair: string; pnl: string; pnlUp: boolean; positions: number; }
interface Props { bot: BotData | null; onClose: () => void; }
type Tab = "overview" | "trades" | "history" | "config" | "logs" | "actions";



export function BotDetailPanel({ bot, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [botState, setBotState] = useState<"running" | "paused" | "stopped" | "killed">("running");
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"days" | "weeks" | "months">("days");
  const [chartMode, setChartMode] = useState<"abs" | "rel">("abs");

  // State to be hydrated via API
  const [openTrades] = useState<{ trade_id: number; pair: string; is_short: boolean; leverage: number; enter_tag: string; current_profit: number; current_profit_abs: number; open_rate: number; current_rate: number; stake_amount: number; stop_loss: number; open_date: string }[]>([]);
  const [closedTrades] = useState<{ trade_id: number; pair: string; is_short: boolean; leverage: number; enter_tag: string; exit_reason: string; close_profit_abs: number; open_rate: number; close_rate: number; stake_amount: number; close_date: string; open_date: string; fee_open: number; fee_close: number }[]>([]);
  const [btRuns] = useState<{ id: string; date: string; range: string; profit: string; profitAbs: string; sharpe: string; trades: string; winRate: string; maxDd: string; duration: string }[]>([]);
  const [logs] = useState<{ time: string; level: string; msg: string }[]>([]);
  const [stats] = useState({
    profit_factor: 0, total_trades: 0, winning: 0, losing: 0,
    avg_duration: "0", best_pair: "", max_dd: 0, max_dd_abs: 0,
    sharpe: 0, sortino: 0, calmar: 0, consec_wins: 0, consec_losses: 0,
    rejected: 0, volume: 0, total_profit: 0,
  });
  const [dailyProfit] = useState<{ date: string; profit: number; trades: number; cumulative: number }[]>([]);

  if (!bot) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "trades", label: `Trades (${openTrades.length + closedTrades.length})` },
    { key: "history", label: `Backtests (${btRuns.length})` },
    { key: "config", label: "Config" },
    { key: "logs", label: "Logs" },
    { key: "actions", label: "Actions" },
  ];

  const allTrades = [...openTrades.map(t => ({ ...t, _open: true as const })), ...closedTrades.map(t => ({ ...t, _open: false as const }))];
  const selectedTrade = allTrades.find(t => t.trade_id === selectedTradeId);
  const wr = stats.total_trades > 0 ? ((stats.winning / stats.total_trades) * 100).toFixed(1) : "0.0";

  return (
    <Sheet open={!!bot} onOpenChange={(open) => { if (!open) { onClose(); setSelectedTradeId(null); } }}>
      <SheetContent className="!w-[1000px] !max-w-[94vw] !sm:max-w-[1000px] bg-card border-border overflow-hidden p-0 flex flex-col">

        {/* ═══ HEADER ═══ */}
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg font-extrabold text-foreground flex-1">{bot.name}</SheetTitle>
            <Badge variant="outline" className={`text-2xs font-bold uppercase ${bot.status === "live" ? "bg-ft-green/15 text-ft-green border-ft-green/20" : "bg-ft-amber/15 text-ft-amber border-ft-amber/20"}`}>{bot.status}</Badge>
            <Badge variant="outline" className={`text-2xs font-bold ${botState === "running" ? "bg-ft-green/15 text-ft-green" : botState === "paused" ? "bg-ft-amber/15 text-ft-amber" : "bg-ft-red/15 text-ft-red"}`}>{botState}</Badge>
            <div className="flex gap-1.5 ml-2">
              <Button variant="outline" size="sm" className="text-2xs h-7 border-ft-amber/30 text-ft-amber" disabled={botState !== "running"} onClick={() => setBotState("paused")}>Pause</Button>
              <Button variant="outline" size="sm" className="text-2xs h-7 border-ft-red/30 text-ft-red" disabled={botState === "killed"} onClick={() => { if (window.confirm(`Stop ${bot.name}?`)) setBotState("stopped"); }}>Stop</Button>
              <Button variant="outline" size="sm" className="text-2xs h-7 border-ft-red/30 text-ft-red font-extrabold" disabled={botState === "killed"} onClick={() => { if (window.confirm(`HARD KILL ${bot.name}?`)) setBotState("killed"); }}>Kill</Button>
              {botState !== "running" && <Button variant="outline" size="sm" className="text-2xs h-7 border-ft-green/30 text-ft-green" onClick={() => setBotState("running")}>Restart</Button>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{bot.strategy} \u00b7 {bot.pair}</div>
        </SheetHeader>

        {/* ═══ TABS ═══ */}
        <div className="px-6 py-2 border-b border-border flex gap-1 overflow-x-auto flex-shrink-0">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedTradeId(null); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${tab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-primary/30"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ──── OVERVIEW ──── */}
          {tab === "overview" && (
            <div className="space-y-5">
              {/* Hero stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total Profit", value: `+$${stats.total_profit.toFixed(0)}`, sub: `${stats.total_trades} trades`, color: "text-ft-green", bg: "from-ft-green/10 to-ft-green/5" },
                  { label: "Win Rate", value: `${wr}%`, sub: `${stats.winning}W / ${stats.losing}L`, color: "text-foreground", bg: "from-primary/10 to-primary/5" },
                  { label: "Max Drawdown", value: `${stats.max_dd}%`, sub: `$${stats.max_dd_abs.toLocaleString()}`, color: "text-ft-red", bg: "from-ft-red/10 to-ft-red/5" },
                  { label: "Today P&L", value: bot.pnl, sub: `${bot.positions} open`, color: bot.pnlUp ? "text-ft-green" : "text-ft-red", bg: bot.pnlUp ? "from-ft-green/10 to-ft-green/5" : "from-ft-red/10 to-ft-red/5" },
                ].map((s) => (
                  <div key={s.label} className={`bg-gradient-to-br ${s.bg} border border-border rounded-xl p-4`}>
                    <div className="text-2xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
                    <div className={`text-xl font-extrabold font-mono mt-1 ${s.color}`}>{s.value}</div>
                    <div className="text-2xs text-muted-foreground mt-1">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* ═══ Recharts Profit Chart — FreqUI style ═══ */}
              <div className="bg-primary/20 border border-border rounded-xl p-4">
                {/* Period + mode toggles */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex bg-primary/40 rounded-md p-0.5">
                    {(["days", "weeks", "months"] as const).map((p) => (
                      <button key={p} onClick={() => setChartPeriod(p)}
                        className={`px-3 py-1 text-2xs font-semibold rounded capitalize transition-all ${chartPeriod === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-2xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-ft-green inline-block" /> Absolute profit</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted-foreground/30 inline-block" /> Trade Count</span>
                  </div>
                  <div className="flex bg-primary/40 rounded-md p-0.5">
                    {(["abs", "rel"] as const).map((m) => (
                      <button key={m} onClick={() => setChartMode(m)}
                        className={`px-3 py-1 text-2xs font-semibold rounded transition-all ${chartMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        {m === "abs" ? "Abs $" : "Rel %"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recharts */}
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={dailyProfit} margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240,5%,15%)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(240,5%,45%)" }}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(240,5%,18%)" }}
                      interval={2}
                    />
                    <YAxis
                      yAxisId="profit"
                      tick={{ fontSize: 10, fill: "hsl(240,5%,45%)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => chartMode === "abs" ? `$${v}` : `${(v / 300).toFixed(1)}%`}
                    />
                    <YAxis
                      yAxisId="trades"
                      orientation="right"
                      tick={{ fontSize: 10, fill: "hsl(240,5%,30%)" }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, "auto"]}
                    />
                    <RTooltip
                      contentStyle={{ backgroundColor: "hsl(240,10%,6%)", border: "1px solid hsl(240,5%,18%)", borderRadius: "8px", fontSize: "11px" }}
                      labelStyle={{ color: "hsl(0,0%,95%)", fontWeight: 700 }}
                    />
                    <ReferenceLine y={0} yAxisId="profit" stroke="hsl(240,5%,25%)" strokeWidth={1} />
                    {/* Trade count bars (grey, background) */}
                    <Bar yAxisId="trades" dataKey="trades" fill="hsl(240,5%,30%)" opacity={0.3} radius={[2, 2, 0, 0]} barSize={20} />
                    {/* Daily profit bars (green/red) */}
                    <Bar yAxisId="profit" dataKey="profit" radius={[3, 3, 0, 0]} barSize={14}>
                      {dailyProfit.map((entry) => (
                        <Cell key={entry.date} fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"} opacity={0.85} />
                      ))}
                    </Bar>
                    {/* Cumulative profit line */}
                    <Line
                      yAxisId="profit"
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#22c55e", stroke: "#0a0a14", strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Stats grid */}
              <div>
                <h4 className="text-xs font-bold text-foreground mb-3">Performance Metrics</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l: "Profit Factor", v: String(stats.profit_factor) }, { l: "Sharpe", v: String(stats.sharpe) },
                    { l: "Sortino", v: String(stats.sortino) }, { l: "Calmar", v: String(stats.calmar) },
                    { l: "Avg Duration", v: stats.avg_duration }, { l: "Best Pair", v: stats.best_pair },
                    { l: "Consec. Wins", v: String(stats.consec_wins) }, { l: "Consec. Losses", v: String(stats.consec_losses) },
                    { l: "Rejected Signals", v: String(stats.rejected) }, { l: "Volume", v: `$${stats.volume.toLocaleString()}` },
                    { l: "Winning Trades", v: String(stats.winning) }, { l: "Losing Trades", v: String(stats.losing) },
                  ].map((s) => (
                    <div key={s.l} className="bg-primary/20 rounded-lg px-3 py-2">
                      <div className="text-2xs text-muted-foreground">{s.l}</div>
                      <div className="text-sm font-bold text-foreground font-mono">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──── TRADES ──── */}
          {tab === "trades" && !selectedTradeId && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-foreground mb-3">Open Trades ({openTrades.length})</h4>
                {openTrades.map((t) => (
                  <div key={t.trade_id} onClick={() => setSelectedTradeId(t.trade_id)}
                    className="bg-primary/20 border border-border rounded-xl p-4 mb-3 cursor-pointer hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">{t.pair}</span>
                        <Badge variant="outline" className={`text-2xs font-bold ${t.is_short ? "text-ft-red border-ft-red/20" : "text-ft-green border-ft-green/20"}`}>{t.is_short ? "SHORT" : "LONG"} {t.leverage}x</Badge>
                        <Badge variant="secondary" className="text-2xs">{t.enter_tag}</Badge>
                      </div>
                      <span className={`text-md font-extrabold font-mono ${t.current_profit >= 0 ? "text-ft-green" : "text-ft-red"}`}>
                        {t.current_profit >= 0 ? "+" : ""}{(t.current_profit * 100).toFixed(2)}% (${t.current_profit_abs >= 0 ? "+" : ""}${t.current_profit_abs.toFixed(2)})
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-2xs">
                      <div><span className="text-muted-foreground">open_rate</span><br /><span className="text-foreground font-mono font-semibold">${t.open_rate.toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">current_rate</span><br /><span className="text-foreground font-mono font-semibold">${t.current_rate.toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">stake_amount</span><br /><span className="text-foreground font-mono font-semibold">${t.stake_amount}</span></div>
                      <div><span className="text-muted-foreground">stop_loss</span><br /><span className="text-ft-red font-mono font-semibold">${t.stop_loss.toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">open_date</span><br /><span className="text-foreground font-mono font-semibold">{t.open_date}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <h4 className="text-xs font-bold text-foreground mb-3">Closed Trades ({closedTrades.length})</h4>
                {closedTrades.map((t) => (
                  <div key={t.trade_id} onClick={() => setSelectedTradeId(t.trade_id)}
                    className="bg-primary/20 border border-border rounded-xl p-4 mb-3 cursor-pointer hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">{t.pair}</span>
                        <Badge variant="outline" className={`text-2xs font-bold ${t.is_short ? "text-ft-red border-ft-red/20" : "text-ft-green border-ft-green/20"}`}>{t.is_short ? "SHORT" : "LONG"} {t.leverage}x</Badge>
                        <Badge variant="secondary" className="text-2xs">{t.enter_tag}</Badge>
                        <span className="text-2xs text-muted-foreground">\u2192 {t.exit_reason}</span>
                      </div>
                      <span className={`text-md font-extrabold font-mono ${t.close_profit_abs >= 0 ? "text-ft-green" : "text-ft-red"}`}>
                        {t.close_profit_abs >= 0 ? "+" : ""}${t.close_profit_abs.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-2xs">
                      <div><span className="text-muted-foreground">open_rate</span><br /><span className="text-foreground font-mono font-semibold">${t.open_rate.toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">close_rate</span><br /><span className="text-foreground font-mono font-semibold">${t.close_rate.toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">stake_amount</span><br /><span className="text-foreground font-mono font-semibold">${t.stake_amount}</span></div>
                      <div><span className="text-muted-foreground">close_date</span><br /><span className="text-foreground font-mono font-semibold">{t.close_date}</span></div>
                      <div><span className="text-muted-foreground">fees</span><br /><span className="text-foreground font-mono font-semibold">{((t.fee_open + t.fee_close) * 100).toFixed(2)}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade detail */}
          {tab === "trades" && selectedTradeId && selectedTrade && (
            <div className="space-y-4">
              <button onClick={() => setSelectedTradeId(null)} className="text-xs text-primary hover:text-primary/80 font-semibold">\u2190 Back to all trades</button>
              <h4 className="text-sm font-bold text-foreground">Trade #{selectedTrade.trade_id}</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedTrade).filter(([k]) => !k.startsWith("_")).map(([k, v]) => (
                  <div key={k} className="bg-primary/20 rounded-lg px-3 py-2">
                    <div className="text-2xs text-muted-foreground">{k}</div>
                    <div className="text-xs font-semibold text-foreground font-mono">{typeof v === "number" ? (k.includes("rate") || k.includes("loss") ? `$${v.toLocaleString()}` : k.includes("profit") && !k.includes("abs") ? `${(v * 100).toFixed(2)}%` : String(v)) : String(v)}</div>
                  </div>
                ))}
              </div>
              {selectedTrade._open && (
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" className="text-xs border-ft-red/30 text-ft-red" onClick={() => { if (window.confirm("Force exit?")) setSelectedTradeId(null); }}>Force Exit (Market)</Button>
                  <Button variant="outline" className="text-xs" onClick={() => setSelectedTradeId(null)}>Cancel Open Order</Button>
                  <Button variant="outline" className="text-xs" onClick={() => setSelectedTradeId(null)}>Reload Trade</Button>
                </div>
              )}
            </div>
          )}

          {/* ──── BACKTESTS ──── */}
          {tab === "history" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-foreground">Backtest History</h4>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/backtesting")}>Run New Backtest</Button>
              </div>
              {btRuns.map((b) => (
                <div key={b.id} className="bg-primary/20 border border-border rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-muted-foreground">{b.date} \u2014 {b.range}</span>
                    <span className="text-md font-extrabold text-ft-green font-mono">{b.profit} ({b.profitAbs})</span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {[{ l: "Sharpe", v: b.sharpe }, { l: "Trades", v: b.trades }, { l: "Win Rate", v: b.winRate }, { l: "Max DD", v: b.maxDd }, { l: "Avg Duration", v: b.duration }].map((m) => (
                      <div key={m.l}><div className="text-2xs text-muted-foreground">{m.l}</div><div className="text-xs font-bold text-foreground font-mono">{m.v}</div></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ──── CONFIG ──── */}
          {tab === "config" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-foreground">Bot Configuration (read-only)</h4>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/settings")}>Edit in Settings \u2192</Button>
              </div>
              {[
                { key: "strategy", val: `${bot.strategy}.py`, accent: true }, { key: "exchange", val: "binance" }, { key: "timeframe", val: "1h" },
                { key: "pair_whitelist", val: bot.pair }, { key: "stake_amount", val: "$1,000" }, { key: "stake_currency", val: "USDT" },
                { key: "max_open_trades", val: "5" }, { key: "stoploss", val: "-0.035 (-3.5%)", color: "text-ft-red" },
                { key: "trailing_stop", val: "enabled", color: "text-ft-green" }, { key: "trailing_stop_positive", val: "0.01" },
                { key: "minimal_roi", val: '{"0": 0.10, "30": 0.05, "60": 0.02}' }, { key: "leverage", val: "10x" },
                { key: "dry_run", val: bot.status === "paper" ? "true" : "false", color: bot.status === "paper" ? "text-ft-amber" : "text-ft-red" },
                { key: "trading_mode", val: "futures" }, { key: "margin_mode", val: "isolated" },
              ].map((c) => (
                <div key={c.key} className="flex justify-between items-baseline py-2 border-b border-border/30 last:border-b-0">
                  <span className="text-xs text-muted-foreground">{c.key}</span>
                  <span className={`text-xs font-semibold font-mono ${c.color || "text-foreground"} ${c.accent ? "text-primary" : ""}`}>{c.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* ──── LOGS ──── */}
          {tab === "logs" && (
            <div>
              <h4 className="text-xs font-bold text-foreground mb-3">Bot Logs</h4>
              <div className="bg-background rounded-xl p-4 font-mono text-2xs space-y-1.5 max-h-[500px] overflow-y-auto">
                {logs.map((l) => (
                  <div key={`${l.time}-${l.msg.slice(0,15)}`} className="flex gap-3">
                    <span className="text-muted-foreground/40 w-16 flex-shrink-0">{l.time}</span>
                    <span className={`w-16 flex-shrink-0 font-bold ${l.level === "WARNING" ? "text-ft-amber" : l.level === "ERROR" ? "text-ft-red" : "text-muted-foreground/60"}`}>{l.level}</span>
                    <span className="text-foreground/80">{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──── ACTIONS ──── */}
          {tab === "actions" && (
            <div className="space-y-4">
              <div className={`px-4 py-3 rounded-xl border text-xs font-bold ${
                botState === "running" ? "border-ft-green/30 bg-ft-green/10 text-ft-green" : botState === "paused" ? "border-ft-amber/30 bg-ft-amber/10 text-ft-amber" : "border-ft-red/30 bg-ft-red/10 text-ft-red"
              }`}>Bot status: {botState.toUpperCase()}</div>

              <h4 className="text-xs font-bold text-foreground">Bot Control</h4>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="text-xs" onClick={() => setBotState("running")}>Reload Config</Button>
                <Button variant="outline" className="text-xs" onClick={() => setBotState("running")}>Stop Buy</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/risk")}>Force Entry</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/risk")}>Pair Locks</Button>
                <Button variant="outline" className="text-xs" onClick={() => setTab("logs")}>View Logs</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/data")}>Data Mgmt</Button>
              </div>

              <Separator />

              <h4 className="text-xs font-bold text-foreground">Navigate</h4>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/strategies")}>Strategy Details</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/analytics")}>Full Analytics</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/backtesting")}>Backtesting</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/settings")}>Bot Settings</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/risk")}>Risk Monitor</Button>
                <Button variant="outline" className="text-xs" onClick={() => router.push("/redesign/freqai")}>FreqAI</Button>
              </div>

              <Separator />

              <h4 className="text-xs font-bold text-ft-red">Danger Zone</h4>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="text-xs border-ft-amber/30 text-ft-amber" disabled={botState !== "running"} onClick={() => setBotState("paused")}>Pause</Button>
                <Button variant="outline" className="text-xs border-ft-red/30 text-ft-red" disabled={botState === "killed"} onClick={() => { if (window.confirm(`Stop?`)) setBotState("stopped"); }}>Stop</Button>
                <Button variant="outline" className="text-xs border-ft-red/30 text-ft-red font-bold" disabled={botState === "killed"} onClick={() => { if (window.confirm(`HARD KILL?`)) setBotState("killed"); }}>Hard Kill</Button>
              </div>
              {botState !== "running" && <Button variant="outline" className="text-xs border-ft-green/30 text-ft-green w-full" onClick={() => setBotState("running")}>Restart Bot</Button>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
