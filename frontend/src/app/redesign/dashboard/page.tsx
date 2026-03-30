"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { getBots } from "@/lib/api";
import { KillSwitchModal } from "./kill-switch-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

/* ══════════════════════════════════════
   DASHBOARD — CLEAN ANALYTICS DESIGN
   ══════════════════════════════════════ */

/* ── 1. Stat Cards ── */
interface StatData {
  label: string;
  value: string;
  change: string;
  up: boolean;
  featured?: boolean;
}

function StatCards({ bots }: { bots: BotData[] }) {
  const activeCount = bots.filter(b => b.status === "live" || b.status === "paper").length;
  
  const STATS: StatData[] = [
    { label: "Portfolio Equity", value: "$127,432.00", change: "+$2,341 (1.87%)", up: true, featured: true },
    { label: "Unrealized P&L", value: "+$1,892.50", change: "7 open positions", up: true },
    { label: "Realized Today", value: "+$449.20", change: "5 closed trades", up: true },
    { label: "Max Drawdown", value: "-4.20%", change: "Peak -$5,352", up: false },
    { label: "Active Bots", value: activeCount.toString(), change: `${bots.length} registered`, up: true },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {STATS.map((s) => (
        <Card key={s.label} className={`flex flex-col justify-between p-4 shadow-sm transition-all hover:border-primary/40 ${s.featured ? 'border-primary/30 bg-primary/5' : ''}`}>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{s.label}</div>
          <div className={`text-2xl font-bold font-mono-data tracking-tight mb-1 ${s.featured ? "text-primary" : "text-foreground"}`}>
            {s.value}
          </div>
          <div className={`text-xs font-medium ${s.featured ? "text-primary/80" : s.up ? "text-ft-green" : "text-ft-red"}`}>
            {s.change}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ── 2. Bot Cards (Grid) ── */
interface BotData {
  name: string; status: "live" | "paper"; strategy: string; pair: string;
  pnl: string; pnlUp: boolean; positions: number; bars: number[];
}

function BotGrid({ selectedBotId, onSelectBot }: { selectedBotId: string | null; onSelectBot: (name: string) => void }) {
  const router = useRouter();
  const { data: botsList } = useApi(getBots, [], { refreshInterval: 15000 });
  const tradingBots = (botsList || []).filter(b => !b.is_utility && b.ft_mode !== "webserver");

  // Mock data for visual completeness
  const displayBots: BotData[] = tradingBots.length > 0 ? tradingBots.map(b => ({
    name: b.name, status: b.is_dry_run ? "paper" : "live", strategy: b.strategy_name || "Unknown",
    pair: b.pair_whitelist?.[0] || "Multiple", pnl: "+$312.40", pnlUp: true, positions: 2, bars: [10, 20, -5, 15, 30, 40, 25],
  })) : [
    { name: "bot-trend-01", status: "live", strategy: "TrendFollowerV3", pair: "BTC/USDT", pnl: "+$312.40", pnlUp: true, positions: 2, bars: [10, 20, -5, 15, 30, 40, 25] },
    { name: "bot-mean-rev", status: "live", strategy: "MeanReversionV2", pair: "ETH/USDT", pnl: "+$187.00", pnlUp: true, positions: 3, bars: [5, -10, 20, 15, -5, 10, 30] },
    { name: "bot-scalp-hl", status: "paper", strategy: "HLScalperV1", pair: "SOL/USDT", pnl: "-$51.20", pnlUp: false, positions: 1, bars: [-10, -5, -20, 5, 10, -15, -5] },
  ];

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/50">
        <CardTitle className="text-sm font-semibold text-foreground">Active Strategies</CardTitle>
        <button onClick={() => router.push("/redesign/strategies")} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          View all strategies →
        </button>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="grid grid-cols-4 gap-4">
          {displayBots.length === 0 && <div className="text-sm text-muted-foreground col-span-4 text-center py-8">No active bots found.</div>}
          {displayBots.map((bot) => (
            <div
              key={bot.name}
              onClick={() => onSelectBot(bot.name)}
              className={`group flex flex-col justify-between p-4 rounded-lg border transition-all cursor-pointer ${
                selectedBotId === bot.name 
                  ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{bot.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{bot.strategy} · {bot.pair}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${bot.status === "live" ? "bg-ft-green/10 text-ft-green border-ft-green/20" : "bg-muted text-muted-foreground border-border"}`}>
                  {bot.status}
                </span>
              </div>
              
              <div className="flex items-end justify-between mt-2">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Today P&L</div>
                  <div className={`text-sm font-bold font-mono-data ${bot.pnlUp ? "text-ft-green" : "text-ft-red"}`}>{bot.pnl}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Pos</div>
                  <div className="text-sm font-bold font-mono-data text-foreground">{bot.positions}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── 3. Open Positions Table ── */
interface PositionData {
  pair: string; bot: string; side: "LONG" | "SHORT"; lev: string;
  entry: string; current: string; pnl: string; pnlUp: boolean; duration: string;
}
const POSITIONS: PositionData[] = [
  { pair: "BTC/USDT", bot: "bot-trend-01", side: "LONG", lev: "10x", entry: "$87,234.00", current: "$87,891.50", pnl: "+$656.70", pnlUp: true, duration: "4h 23m" },
  { pair: "ETH/USDT", bot: "bot-mean-rev", side: "SHORT", lev: "5x", entry: "$2,087.00", current: "$2,074.00", pnl: "+$66.50", pnlUp: true, duration: "2h 11m" },
  { pair: "SOL/USDT", bot: "bot-scalp-hl", side: "LONG", lev: "20x", entry: "$142.85", current: "$141.90", pnl: "-$190.00", pnlUp: false, duration: "48m" },
];

function PositionsTable() {
  const router = useRouter();
  return (
    <Card className="shadow-sm flex flex-col h-full">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50 bg-muted/20">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          Open Positions <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{POSITIONS.length}</span>
        </CardTitle>
        <button onClick={() => router.push("/redesign/analytics")} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">View Journal →</button>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50">
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pair</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bot</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Side</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Entry</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Current</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">P&L</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Duration</TableHead>
              <TableHead className="h-9 px-4 w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {POSITIONS.length === 0 ? (
               <TableRow><TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">No open positions.</TableCell></TableRow>
            ) : POSITIONS.map((p, i) => (
              <TableRow key={i} className="group cursor-pointer hover:bg-muted/30 border-b border-border/30 last:border-0 transition-colors">
                <TableCell className="px-4 py-2.5">
                  <span className="text-xs font-bold text-foreground">{p.pair}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{p.bot}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span className={`text-[10px] font-bold uppercase ${p.side === "LONG" ? "text-ft-green" : "text-ft-red"}`}>
                    {p.side} <span className="text-muted-foreground/60 ml-1">{p.lev}</span>
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right font-mono-data text-xs text-muted-foreground">{p.entry}</TableCell>
                <TableCell className="px-4 py-2.5 text-right font-mono-data text-xs text-foreground">{p.current}</TableCell>
                <TableCell className="px-4 py-2.5 text-right">
                  <span className={`text-xs font-bold font-mono-data ${p.pnlUp ? "text-ft-green" : "text-ft-red"}`}>{p.pnl}</span>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right text-xs text-muted-foreground">{p.duration}</TableCell>
                <TableCell className="px-4 py-2.5 text-center">
                  <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors">✖</button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ── 4. Closed Trades Table ── */
interface ClosedTradeData {
  id: string; pair: string; bot: string; side: "LONG" | "SHORT"; entry: string; exit: string;
  pnl: string; pnlUp: boolean; closed: string;
}
const CLOSED_TRADES: ClosedTradeData[] = [
  { id: "#4821", pair: "BTC/USDT", bot: "trend-01", side: "LONG", entry: "$86,412.00", exit: "$87,120.00", pnl: "+$312.40", pnlUp: true, closed: "14:22" },
  { id: "#4820", pair: "ETH/USDT", bot: "mean-rev", side: "SHORT", entry: "$2,094.00", exit: "$2,081.00", pnl: "+$66.50", pnlUp: true, closed: "13:45" },
  { id: "#4819", pair: "SOL/USDT", bot: "scalp-hl", side: "LONG", entry: "$143.20", exit: "$142.85", pnl: "-$35.00", pnlUp: false, closed: "12:08" },
];

function ClosedTradesTable() {
  const router = useRouter();
  return (
    <Card className="shadow-sm flex flex-col h-full">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50 bg-muted/20">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          Today&apos;s Setup <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{CLOSED_TRADES.length} closed</span>
        </CardTitle>
        <button onClick={() => router.push("/redesign/analytics")} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Full history →</button>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50">
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ID</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pair</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bot</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Entry</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Exit</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">P&L</TableHead>
              <TableHead className="h-9 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CLOSED_TRADES.length === 0 ? (
               <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No trades today.</TableCell></TableRow>
            ) : CLOSED_TRADES.map((t) => (
              <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30 border-b border-border/30 last:border-0 transition-colors">
                <TableCell className="px-4 py-2 text-xs font-mono-data text-muted-foreground">{t.id}</TableCell>
                <TableCell className="px-4 py-2 text-xs font-bold text-foreground">{t.pair}</TableCell>
                <TableCell className="px-4 py-2 text-xs text-muted-foreground">{t.bot}</TableCell>
                <TableCell className="px-4 py-2 text-right font-mono-data text-xs text-muted-foreground">{t.entry}</TableCell>
                <TableCell className="px-4 py-2 text-right font-mono-data text-xs text-foreground">{t.exit}</TableCell>
                <TableCell className="px-4 py-2 text-right">
                  <span className={`text-xs font-bold font-mono-data ${t.pnlUp ? "text-ft-green" : "text-ft-red"}`}>{t.pnl}</span>
                </TableCell>
                <TableCell className="px-4 py-2 text-right text-xs text-muted-foreground">{t.closed}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ── 5. Standard Action Panel ── */
function EquityCurve() {
  const EQUITY_DATA = [
    { day: "01", eq: 110200 }, { day: "05", eq: 116200 }, { day: "10", eq: 124000 }, { day: "12", eq: 127400 }
  ];
  return (
    <Card className="flex flex-col h-full shadow-sm">
      <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-sm font-semibold text-foreground">Equity Curve (30d)</CardTitle>
      </CardHeader>
      <div className="p-4 flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={EQUITY_DATA} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eqColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(239, 84%, 67%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(240, 5%, 18%)" />
            <XAxis dataKey="day" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(240, 10%, 5.5%)", borderColor: "hsl(240, 5%, 18%)", borderRadius: "8px", fontSize: "12px", color: "#f0f0f5" }}
              itemStyle={{ color: "hsl(0, 0%, 95%)", fontWeight: "bold" }}
              formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, "Equity"]}
              labelStyle={{ display: "none" }}
            />
            <Area type="monotone" dataKey="eq" stroke="hsl(239, 84%, 67%)" strokeWidth={2} fillOpacity={1} fill="url(#eqColor)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ── 6. System Logs / Alerts ── */
interface AlertData { type: "success" | "warning" | "info" | "critical"; text: string; time: string; }
const ALERTS: AlertData[] = [
  { type: "success", text: "Trade closed — BTC/USDT +$312.40", time: "12 min ago" },
  { type: "warning", text: "Drawdown alert — bot-scalp-hl nearing 3% DD", time: "34 min ago" },
  { type: "info", text: "Backtest done — BreakoutAI v3", time: "1h ago" },
  { type: "critical", text: "Protection triggered — bot-scalp-hl", time: "3h ago" },
];

function SystemLogPanel() {
  const alertDotColors = { success: "bg-ft-green", warning: "bg-ft-amber", info: "bg-primary", critical: "bg-ft-red shadow-[0_0_8px_rgba(239,68,68,0.5)]" };
  return (
    <Card className="flex flex-col h-full shadow-sm">
      <CardHeader className="py-3 px-4 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-sm font-semibold text-foreground">System Journal</CardTitle>
      </CardHeader>
      <div className="flex-1 overflow-y-auto px-4 py-2 max-h-[220px]">
        {ALERTS.map((a, i) => (
          <div key={i} className="flex gap-3 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alertDotColors[a.type]}`} />
            <div className="flex-1">
              <div className={`text-xs ${a.type === "critical" ? "text-ft-red font-semibold" : "text-foreground"}`}>{a.text}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}


/* ══════════════════════════════════════
   MAIN DASHBOARD LAYOUT
   ══════════════════════════════════════ */
export default function DashboardPage() {
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [killSwitchOpen, setKillSwitchOpen] = useState(false);
  
  const { data: botsList } = useApi(getBots, [], { refreshInterval: 15000 });
  const tradingBots = (botsList || []).filter(b => !b.is_utility && b.ft_mode !== "webserver");

  return (
    <div className="w-full max-w-[1500px] mx-auto p-2 md:p-6 space-y-6">
      
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between pb-2 border-b border-border/30">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">System Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">Live connection to Orchestrator Enclave.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold bg-card border-border hover:bg-muted text-foreground">
            System Settings
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setKillSwitchOpen(true)} className="h-8 text-xs font-bold tracking-wide shadow-sm">
            KILL SWITCH
          </Button>
        </div>
      </div>

      {/* ── Key Metrics ── */}
      <StatCards bots={tradingBots} />

      {/* ── Active Strategies ── */}
      <BotGrid selectedBotId={selectedBotId} onSelectBot={(name) => setSelectedBotId(prev => prev === name ? null : name)} />

      {/* ── Data Layout Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        
        {/* Left Column: Tables */}
        <div className="flex flex-col gap-6">
          <PositionsTable />
          <ClosedTradesTable />
        </div>
        
        {/* Right Column: Analytics & Logs */}
        <div className="flex flex-col gap-6">
          <div className="h-[280px]">
            <EquityCurve />
          </div>
          <div className="flex-1">
            <SystemLogPanel />
          </div>
        </div>

      </div>

      <KillSwitchModal open={killSwitchOpen} onOpenChange={setKillSwitchOpen} />
    </div>
  );
}
