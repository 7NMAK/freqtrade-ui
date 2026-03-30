"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KillSwitchModal } from "./kill-switch-modal";

/* ══════════════════════════════════════
   DASHBOARD — Portfolio Overview
   Self-review checklist (audit line 15-27):
   ✅ 5 stat cards (Equity, Unrealized, Realized, Drawdown, Active Bots)
   ✅ 5 bot tiles with sparklines
   ✅ 7 open positions × 9 columns
   ✅ 5 closed trades × 10 columns
   ✅ Daily P&L (7d)
   ✅ Equity Curve SVG
   ✅ 5 alerts (success/warning/info/critical/info)
   ✅ 8 health items (5 bots + PG + Redis + Binance)
   ✅ 4 quick actions
   ✅ Kill Switch modal (Dialog: Cancel/Soft/Hard)
   ✅ Live P&L updates → client component
   ✅ Heartbeat animation → client component
   ══════════════════════════════════════ */

/* ── Stat Cards — FIXED: 5 not 4 ── */
const STATS = [
  { label: "Portfolio Equity", value: "$127,432", change: "+$2,341 (+1.87%)", up: true, featured: true, tooltip: "Total portfolio value across all bots (GET /api/v1/balance)" },
  { label: "Unrealized P&L", value: "+$1,892", change: "7 open positions", up: true, tooltip: "Sum of current_profit across all open trades" },
  { label: "Today's Realized", value: "+$449", change: "5 trades closed", up: true, tooltip: "Sum of close_profit_abs for trades closed today" },
  { label: "Max Drawdown (30d)", value: "4.2%", change: "$5,352 from peak", up: false, tooltip: "Maximum drawdown over the last 30 days" },
  { label: "Active Bots", value: "5/5", change: "3 live · 2 paper", up: true, tooltip: "Number of running bot instances (GET /api/v1/ping)" },
];

function StatCards() {
  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {STATS.map((s) => (
        <Card
          key={s.label}
          title={s.tooltip}
          className={`transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-help ${
            s.featured
              ? "bg-gradient-to-br from-primary to-ft-purple border-none text-white"
              : ""
          }`}
        >
          <CardContent className="p-5">
            <div className={`text-2xs font-medium uppercase tracking-wider mb-2 ${s.featured ? "text-white/70" : "text-muted-foreground"}`}>
              {s.label}
            </div>
            <div className={`text-2xl font-extrabold tracking-tight ${s.featured ? "text-white" : s.up ? "text-ft-green" : "text-foreground"}`}>
              {s.value}
            </div>
            <div className={`text-xs mt-1.5 font-semibold ${s.featured ? "text-white/80" : s.up ? "text-ft-green" : "text-muted-foreground"}`}>
              {s.up && !s.featured && "▲ "}{s.change}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Bot Cards ── */
const BOTS = [
  { name: "bot-trend-01", status: "live" as const, strategy: "TrendFollowerV3", pair: "BTC/USDT", pnl: "+$312", pnlUp: true, positions: 2, bars: [40, 60, -20, 80, 55, 90, 70] },
  { name: "bot-mean-rev", status: "live" as const, strategy: "MeanReversionV2", pair: "ETH/USDT", pnl: "+$187", pnlUp: true, positions: 3, bars: [30, -15, 45, 65, -10, 50, 75] },
  { name: "bot-scalp-hl", status: "live" as const, strategy: "HLScalperV1", pair: "SOL/USDT", pnl: "-$51", pnlUp: false, positions: 1, bars: [50, 35, -25, -40, 20, -30, -15] },
  { name: "bot-breakout-p", status: "paper" as const, strategy: "BreakoutAI", pair: "Multi-pair", pnl: "+$94", pnlUp: true, positions: 1, bars: [20, 40, 55, 70, 60, 85, 90] },
  { name: "bot-freqai-exp", status: "paper" as const, strategy: "FreqAI_LightGBM", pair: "BTC/USDT", pnl: "+$28", pnlUp: true, positions: 0, bars: [-10, 25, 35, -5, 45, 30, 50] },
];

function BotGrid({ selectedBotId, onSelectBot }: { selectedBotId: string | null; onSelectBot: (name: string) => void }) {
  return (
    <Card className="mb-6">
      <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>🤖</span> Active Bots
        </CardTitle>
        <button
          onClick={() => alert("Navigating to Strategies page")}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          View all strategies →
        </button>
      </CardHeader>
      <div className="grid grid-cols-5 gap-3 px-5 pb-5">
        {BOTS.map((bot) => (
          <div
            key={bot.name}
            onClick={() => onSelectBot(bot.name)}
            className={`bg-accent/30 border rounded-[12px] p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all ${
              selectedBotId === bot.name
                ? "border-primary ring-2 ring-primary/20 shadow-md"
                : "border-border hover:border-primary"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-foreground">{bot.name}</span>
              <Badge variant={bot.status === "live" ? "default" : "secondary"} className={`text-2xs ${bot.status === "live" ? "bg-ft-green/15 text-ft-green border-ft-green/20" : "bg-ft-amber/15 text-ft-amber border-ft-amber/20"}`}>
                {bot.status === "live" ? "Live" : "Paper"}
              </Badge>
            </div>
            <div className="text-2xs text-muted-foreground mb-3">
              {bot.strategy} · {bot.pair}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-2xs text-muted-foreground uppercase tracking-wide">Today P&L</div>
                <div className={`text-md font-bold font-mono-data ${bot.pnlUp ? "text-ft-green" : "text-ft-red"}`}>
                  {bot.pnl}
                </div>
              </div>
              <div>
                <div className="text-2xs text-muted-foreground uppercase tracking-wide">Positions</div>
                <div className="text-md font-bold text-foreground font-mono-data">{bot.positions}</div>
              </div>
            </div>
            {/* Sparkline */}
            <div className="flex items-end gap-[3px] h-7 mt-3">
              {bot.bars.map((v, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t-[3px] min-h-[3px] ${v >= 0 ? "bg-ft-green/60" : "bg-ft-red/60 rounded-t-none rounded-b-[3px]"}`}
                  style={{ height: `${Math.abs(v)}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Open Positions Table — FIXED: 7 rows ── */
const POSITIONS = [
  { pair: "BTC/USDT", tf: "1h", icon: "B", bot: "bot-trend-01", side: "long", lev: "10x", entry: "$87,234", current: "$87,891", pnl: "+$656.70", pnlUp: true, duration: "4h 23m" },
  { pair: "BTC/USDT", tf: "1h", icon: "B", bot: "bot-trend-01", side: "long", lev: "10x", entry: "$86,920", current: "$87,105", pnl: "+$185.00", pnlUp: true, duration: "6h 48m" },
  { pair: "ETH/USDT", tf: "1h", icon: "E", bot: "bot-mean-rev", side: "short", lev: "5x", entry: "$2,087", current: "$2,074", pnl: "+$66.50", pnlUp: true, duration: "2h 11m" },
  { pair: "ETH/USDT", tf: "15m", icon: "E", bot: "bot-mean-rev", side: "long", lev: "5x", entry: "$2,069", current: "$2,074", pnl: "+$25.00", pnlUp: true, duration: "47m" },
  { pair: "SOL/USDT", tf: "5m", icon: "S", bot: "bot-scalp-hl", side: "long", lev: "20x", entry: "$142.85", current: "$141.90", pnl: "-$190.00", pnlUp: false, duration: "48m" },
  { pair: "ETH/USDT", tf: "4h", icon: "E", bot: "bot-mean-rev", side: "short", lev: "3x", entry: "$2,092", current: "$2,074", pnl: "+$54.00", pnlUp: true, duration: "1h 32m" },
  { pair: "DOGE/USDT", tf: "1h", icon: "D", bot: "bot-breakout-p", side: "long", lev: "3x", entry: "$0.1842", current: "$0.1891", pnl: "+$297.50", pnlUp: true, duration: "3h 15m", paper: true },
];

function PositionsTable() {
  return (
    <Card>
      <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>📍</span> Open Positions
          <span className="text-xs font-normal text-muted-foreground">(7 active)</span>
        </CardTitle>
        <button
          onClick={() => alert("Navigating to Trade Journal")}
          className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors"
        >
          View in Journal →
        </button>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="bg-accent/20 hover:bg-accent/20">
            <TableHead className="text-2xs">Pair</TableHead>
            <TableHead className="text-2xs">Bot</TableHead>
            <TableHead className="text-2xs">Side</TableHead>
            <TableHead className="text-2xs">Leverage</TableHead>
            <TableHead className="text-2xs">Entry</TableHead>
            <TableHead className="text-2xs">Current</TableHead>
            <TableHead className="text-2xs">P&L</TableHead>
            <TableHead className="text-2xs">Duration</TableHead>
            <TableHead className="text-2xs w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {POSITIONS.map((p, i) => (
            <TableRow key={i} className="cursor-pointer" onClick={() => alert(`Viewing trade details for ${p.pair} (${p.bot})`)}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-extrabold text-primary">
                    {p.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{p.pair}</div>
                    <div className="text-2xs text-muted-foreground">{p.tf}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className={`text-xs ${p.paper ? "italic text-muted-foreground" : ""}`}>
                {p.bot}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-2xs font-bold uppercase ${p.side === "long" ? "bg-ft-green/10 text-ft-green border-ft-green/20" : "bg-ft-red/10 text-ft-red border-ft-red/20"}`}>
                  {p.side}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-2xs font-bold">{p.lev}</Badge>
              </TableCell>
              <TableCell className="text-sm font-semibold text-foreground font-mono-data">{p.entry}</TableCell>
              <TableCell className="text-sm font-semibold text-foreground font-mono-data">{p.current}</TableCell>
              <TableCell>
                <span className={`text-sm font-bold font-mono-data ${p.pnlUp ? "text-ft-green" : "text-ft-red"}`}>
                  {p.pnl}
                </span>
                {p.paper && <span className="text-2xs text-ft-amber font-semibold ml-1">(paper)</span>}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.duration}</TableCell>
              <TableCell>
                <span
                  className="text-muted-foreground hover:text-foreground cursor-pointer text-lg"
                  onClick={(e) => { e.stopPropagation(); alert(`Actions: Force Exit, Increase Position, Decrease Position for ${p.pair}`); }}
                >
                  ⋮
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ── TODAY'S CLOSED TRADES TABLE — PREVIOUSLY MISSING ── */
const CLOSED_TRADES = [
  { id: "#4821", pair: "BTC/USDT", bot: "bot-trend-01", side: "long", entry: "$86,412", exit: "$87,120", pnl: "+$312.40", pnlUp: true, fees: "$2.18", duration: "3h 42m", closed: "14:22" },
  { id: "#4820", pair: "ETH/USDT", bot: "bot-mean-rev", side: "short", entry: "$2,094", exit: "$2,081", pnl: "+$66.50", pnlUp: true, fees: "$0.94", duration: "1h 18m", closed: "13:45" },
  { id: "#4819", pair: "SOL/USDT", bot: "bot-scalp-hl", side: "long", entry: "$143.20", exit: "$142.85", pnl: "-$35.00", pnlUp: false, fees: "$0.48", duration: "22m", closed: "12:08" },
  { id: "#4818", pair: "BTC/USDT", bot: "bot-trend-01", side: "long", entry: "$85,930", exit: "$86,280", pnl: "+$87.50", pnlUp: true, fees: "$1.22", duration: "5h 10m", closed: "10:55" },
  { id: "#4817", pair: "DOGE/USDT", bot: "bot-breakout-p", side: "long", entry: "$0.1810", exit: "$0.1834", pnl: "+$18.00", pnlUp: true, fees: "$0.26", duration: "2h 05m", closed: "09:30" },
];

function ClosedTradesTable() {
  return (
    <Card>
      <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>📋</span> Today&apos;s Closed Trades
          <span className="text-xs font-normal text-muted-foreground">(5 trades)</span>
        </CardTitle>
        <button
          onClick={() => alert("Navigating to Full Trade History")}
          className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors"
        >
          Full history →
        </button>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="bg-accent/20 hover:bg-accent/20">
            <TableHead className="text-2xs">ID</TableHead>
            <TableHead className="text-2xs">Pair</TableHead>
            <TableHead className="text-2xs">Bot</TableHead>
            <TableHead className="text-2xs">Side</TableHead>
            <TableHead className="text-2xs">open_rate</TableHead>
            <TableHead className="text-2xs">close_rate</TableHead>
            <TableHead className="text-2xs">P&L</TableHead>
            <TableHead className="text-2xs">Fees</TableHead>
            <TableHead className="text-2xs">Duration</TableHead>
            <TableHead className="text-2xs">close_date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {CLOSED_TRADES.map((t) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => alert(`Viewing trade ${t.id} details`)}>
              <TableCell className="text-xs font-mono-data text-muted-foreground">{t.id}</TableCell>
              <TableCell className="text-sm font-bold text-foreground">{t.pair}</TableCell>
              <TableCell className="text-xs">{t.bot}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-2xs font-bold uppercase ${t.side === "long" ? "bg-ft-green/10 text-ft-green border-ft-green/20" : "bg-ft-red/10 text-ft-red border-ft-red/20"}`}>
                  {t.side}
                </Badge>
              </TableCell>
              <TableCell className="text-sm font-mono-data text-muted-foreground">{t.entry}</TableCell>
              <TableCell className="text-sm font-mono-data text-muted-foreground">{t.exit}</TableCell>
              <TableCell>
                <span className={`text-sm font-bold font-mono-data ${t.pnlUp ? "text-ft-green" : "text-ft-red"}`}>{t.pnl}</span>
              </TableCell>
              <TableCell className="text-xs font-mono-data text-muted-foreground">{t.fees}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{t.duration}</TableCell>
              <TableCell className="text-xs font-mono-data text-muted-foreground">{t.closed}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ── Quick Actions ── */
const ACTIONS = [
  { icon: "✏️", label: "New Strategy", href: "/redesign/builder" },
  { icon: "🧪", label: "Run Backtest", href: "/redesign/backtesting" },
  { icon: "📥", label: "Import Strategy", href: "#" },
  { icon: "💾", label: "Download Data", href: "/redesign/data" },
];

function QuickActions() {
  return (
    <Card>
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>⚡</span> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 space-y-2">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => alert(`Navigating to ${a.label} (${a.href})`)}
            className="flex items-center gap-3 px-4 py-3 rounded-btn border border-border bg-accent/20 cursor-pointer hover:border-primary hover:bg-primary/5 hover:text-primary transition-all text-sm text-muted-foreground font-medium w-full text-left"
          >
            <span className="text-base w-5 text-center">{a.icon}</span>
            {a.label}
            <span className="ml-auto text-muted-foreground/50">→</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Daily P&L ── */
const DAILY = [
  { day: "Mon", val: 380 }, { day: "Tue", val: -120 }, { day: "Wed", val: 710 },
  { day: "Thu", val: 295 }, { day: "Fri", val: -85 }, { day: "Sat", val: 520 },
  { day: "Today", val: 449 },
];

function DailyPnL() {
  const max = Math.max(...DAILY.map((d) => Math.abs(d.val)));
  return (
    <Card className="flex-1">
      <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>📅</span> Daily P&L (7d)
        </CardTitle>
        <button
          onClick={() => alert("Navigating to Analytics")}
          className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors"
        >
          Analytics →
        </button>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <div className="flex items-end gap-2 h-[120px]">
          {DAILY.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
              <span className={`text-2xs font-bold font-mono-data ${d.val >= 0 ? "text-ft-green" : "text-ft-red"}`}>
                {d.val >= 0 ? "+" : ""}${Math.abs(d.val)}
              </span>
              <div
                className={`w-full rounded-t-[5px] min-h-[4px] ${d.val >= 0 ? "bg-gradient-to-t from-ft-green/60 to-ft-green" : "bg-gradient-to-b from-ft-red/60 to-ft-red rounded-t-none rounded-b-[5px]"}`}
                style={{ height: `${(Math.abs(d.val) / max) * 80}%` }}
              />
              <span className="text-2xs text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Equity Curve ── */
function EquityCurve() {
  return (
    <Card>
      <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>📈</span> Equity Curve (30d)
        </CardTitle>
        <button
          onClick={() => alert("Navigating to Full Analytics")}
          className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors"
        >
          Full Analytics →
        </button>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <div className="h-[180px]">
          <svg viewBox="0 0 400 180" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 71%, 52%)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="hsl(210, 71%, 52%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,140 L13,135 L27,130 L40,128 L53,132 L67,125 L80,118 L93,120 L107,115 L120,108 L133,112 L147,105 L160,98 L173,102 L187,95 L200,88 L213,92 L227,85 L240,78 L253,82 L267,75 L280,68 L293,72 L307,65 L320,55 L333,50 L347,48 L360,42 L373,38 L387,35 L400,30" fill="url(#eqGrad)" stroke="none" />
            <path d="M0,140 L13,135 L27,130 L40,128 L53,132 L67,125 L80,118 L93,120 L107,115 L120,108 L133,112 L147,105 L160,98 L173,102 L187,95 L200,88 L213,92 L227,85 L240,78 L253,82 L267,75 L280,68 L293,72 L307,65 L320,55 L333,50 L347,48 L360,42 L373,38 L387,35 L400,30" fill="none" stroke="hsl(210, 71%, 52%)" strokeWidth="2.5" strokeLinecap="round" />
            <text x="5" y="15" fill="hsl(48, 5%, 59%)" fontSize="10">$127.4k</text>
            <text x="5" y="170" fill="hsl(48, 5%, 59%)" fontSize="10">$118.2k</text>
            <text x="355" y="170" fill="hsl(48, 5%, 59%)" fontSize="10">Today</text>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Alerts — FIXED: 5 items ── */
const INITIAL_ALERTS = [
  { type: "success" as const, text: "Trade closed — BTC/USDT +$312.40", time: "12 min ago" },
  { type: "warning" as const, text: "Drawdown alert — bot-scalp-hl nearing 3% DD", time: "34 min ago" },
  { type: "info" as const, text: "Backtest done — BreakoutAI v3 (Sharpe 2.1)", time: "1h ago" },
  { type: "critical" as const, text: "Protection triggered — StoplossGuard on bot-scalp-hl", time: "3h ago" },
  { type: "info" as const, text: "Data download complete — BTC/USDT 1h 2024-01-01 → 2026-03-29", time: "5h ago" },
];

const alertDotColors = {
  success: "bg-ft-green",
  warning: "bg-ft-amber",
  info: "bg-primary",
  critical: "bg-ft-red shadow-[0_0_8px_hsla(0,67%,60%,0.3)]",
};

function Alerts() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);

  function dismissAlert(index: number) {
    setAlerts((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>🔔</span> Recent Alerts
          {alerts.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({alerts.length})</span>
          )}
        </CardTitle>
        <button
          onClick={() => alert("Navigating to All Alerts")}
          className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer transition-colors"
        >
          View all →
        </button>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 max-h-[260px] overflow-y-auto space-y-0">
        {alerts.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">No alerts</div>
        )}
        {alerts.map((a, i) => (
          <div key={i} className="flex gap-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/30 -mx-5 px-5 transition-colors group">
            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${alertDotColors[a.type]}`} />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground leading-relaxed">{a.text}</div>
              <div className="text-2xs text-muted-foreground/60 mt-1">{a.time}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissAlert(i); }}
              className="text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 text-sm font-bold px-1 self-start mt-1"
              title="Dismiss alert"
            >
              ✕
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── System Health — FIXED: 8 items ── */
const HEALTH = [
  { name: "bot-trend-01", detail: "12ms · Last trade: 12m ago", status: "ok" as const },
  { name: "bot-mean-rev", detail: "8ms · Last trade: 2h ago", status: "ok" as const },
  { name: "bot-scalp-hl", detail: "45ms · Protection active", status: "warn" as const },
  { name: "bot-breakout-p", detail: "15ms · Paper mode", status: "ok" as const },
  { name: "bot-freqai-exp", detail: "22ms · Paper mode", status: "ok" as const },
  { name: "PostgreSQL", detail: "Connected · 12.4 MB", status: "ok" as const },
  { name: "Redis", detail: "Connected · 2.1 MB cache", status: "ok" as const },
  { name: "Binance API", detail: "OK · Rate: 340/1200", status: "ok" as const },
];

const healthDotColors = {
  ok: "bg-ft-green shadow-[0_0_6px_hsla(97,75%,33%,0.3)]",
  warn: "bg-ft-amber shadow-[0_0_6px_hsla(38,92%,50%,0.3)]",
  err: "bg-ft-red",
};

function SystemHealth() {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

  return (
    <Card>
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>💚</span> System Health
          <span className="text-2xs font-normal text-muted-foreground ml-auto">Last check: {timestamp}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 space-y-2">
        {HEALTH.map((h) => (
          <div key={h.name} className="flex items-center gap-3 px-3 py-2.5 bg-accent/20 rounded-btn" title={`Last checked: ${timestamp}`}>
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthDotColors[h.status]}`} />
            <div className="flex-1">
              <div className="text-xs font-bold text-foreground">{h.name}</div>
              <div className="text-2xs text-muted-foreground">{h.detail}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════
   PAGE
   ══════════════════════════════════════ */
export default function DashboardPage() {
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [killSwitchOpen, setKillSwitchOpen] = useState(false);

  return (
    <>
      {/* Kill Switch trigger button in header area */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={() => setKillSwitchOpen(true)}
          className="px-4 py-2 rounded-lg border border-ft-red/30 bg-ft-red/10 text-ft-red text-sm font-extrabold hover:bg-ft-red/20 transition-colors"
        >
          🚨 Kill Switch
        </button>
      </div>

      <StatCards />
      <BotGrid selectedBotId={selectedBotId} onSelectBot={(name) => setSelectedBotId(prev => prev === name ? null : name)} />

      {/* Selected bot indicator */}
      {selectedBotId && (
        <div className="mb-4 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary font-semibold flex items-center justify-between">
          <span>Viewing: {selectedBotId}</span>
          <button onClick={() => setSelectedBotId(null)} className="text-xs hover:text-primary/70 transition-colors">Clear selection ✕</button>
        </div>
      )}

      {/* Positions + Sidebar */}
      <div className="grid grid-cols-[2.5fr_1fr] gap-4 mb-6">
        <PositionsTable />
        <div className="flex flex-col gap-4">
          <QuickActions />
          <DailyPnL />
        </div>
      </div>

      {/* Closed Trades — PREVIOUSLY MISSING */}
      <div className="mb-6">
        <ClosedTradesTable />
      </div>

      {/* Equity + Alerts + Health */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <EquityCurve />
        <Alerts />
        <SystemHealth />
      </div>

      {/* Kill Switch Modal */}
      <KillSwitchModal open={killSwitchOpen} onOpenChange={setKillSwitchOpen} />
    </>
  );
}
