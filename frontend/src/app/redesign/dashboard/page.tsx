"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { getBots } from "@/lib/api";
import { KillSwitchModal } from "./kill-switch-modal";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

/* ══════════════════════════════════════
   DASHBOARD — Unified ShadCN Architecture
   ══════════════════════════════════════ */

/* ── 1. Stat Cards ── */
interface StatData {
  label: string;
  value: string;
  change: string;
  up: boolean;
  featured?: boolean;
  tooltip: string;
}

function StatCards({ bots }: { bots: BotData[] }) {
  const activeCount = bots.filter(b => b.status === "live" || b.status === "paper").length;
  
  const STATS: StatData[] = [
    { label: "Equity", value: "$0.00", change: "0.00%", up: true, tooltip: "Total equity" },
    { label: "Unrealized", value: "$0.00", change: "0.00%", up: true, tooltip: "Open positions PnL" },
    { label: "Realized", value: "$0.00", change: "0.00%", up: true, tooltip: "Closed trades PnL" },
    { label: "Drawdown", value: "0.00%", change: "0.00%", up: false, tooltip: "System Drawdown" },
    { label: "Active Bots", value: activeCount.toString(), change: `${bots.length} total`, up: true, featured: true, tooltip: "Running bots" },
  ];

  return (
    <div className="grid grid-cols-5 gap-6 mb-6">
      {STATS.map((s) => (
        <Card key={s.label} title={s.tooltip} className={`cursor-pointer hover:border-primary/50 transition-colors hover:-translate-y-[1px] shadow-sm flex flex-col justify-center p-5 ${s.featured ? "bg-primary/10 border-primary/30" : ""}`}>
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">{s.label}</div>
          <div className={`text-base font-extrabold text-foreground tracking-tight text-[24px] ${s.featured ? "text-primary" : s.up ? "text-emerald-500" : "text-foreground"}`}>
            {s.value}
          </div>
          <div className={`text-[11px] mt-1 font-semibold ${s.featured ? "text-primary" : s.up ? "text-emerald-500" : "text-muted-foreground"}`}>
            {s.up && !s.featured && "▲ "}{s.change}
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

  const displayBots: BotData[] = tradingBots.map(b => ({
    name: b.name, status: b.is_dry_run ? "paper" : "live", strategy: b.strategy_name || "Unknown",
    pair: b.pair_whitelist?.[0] || "Multiple", pnl: "—", pnlUp: true, positions: 0, bars: [0, 0, 0, 0, 0, 0, 0],
  }));

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle><span>🤖</span> Active Bots</CardTitle>
        <button onClick={() => router.push("/redesign/strategies")} className="text-[11px] font-semibold text-primary hover:underline">
          View all strategies →
        </button>
      </CardHeader>
      
      <CardContent className="grid grid-cols-5 gap-4">
        {displayBots.length === 0 && <div className="text-xs text-muted-foreground col-span-5 text-center py-4">No active bots found.</div>}
        {displayBots.map((bot) => (
          <div
            key={bot.name}
            onClick={() => onSelectBot(bot.name)}
            className={`bg-muted/50 border rounded-[10px] p-4 cursor-pointer hover:border-border hover:border-ring hover:-translate-y-[1px] transition-all ${
              selectedBotId === bot.name ? "border-primary ring-1 ring-primary shadow-[0_0_15px_rgba(99,102,241,0.15)]" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-foreground">{bot.name}</span>
              <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase ${bot.status === "live" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500" : "bg-amber-500/10 text-amber-500 border border-amber-500"}`}>
                {bot.status === "live" ? "Live" : "Paper"}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mb-4 truncate">{bot.strategy} · {bot.pair}</div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">Today P&L</div>
                <div className={`text-[14px] font-bold font-mono ${bot.pnlUp ? "text-emerald-500" : "text-rose-500"}`}>{bot.pnl}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">Positions</div>
                <div className="text-[14px] font-bold text-foreground font-mono">{bot.positions}</div>
              </div>
            </div>

            <div className="flex items-end gap-[3px] h-6">
              {bot.bars.map((v, i) => (
                <div key={i} className={`flex-1 rounded-[2px] min-h-[3px] ${v >= 0 ? "bg-green" : "bg-red"}`} style={{ height: `${Math.max(10, Math.abs(v))}%`, opacity: 0.6 }} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── 3. Open Positions Table ── */
interface PositionData {
  pair: string; tf: string; icon: string; bot: string; side: string; lev: string;
  entry: string; current: string; pnl: string; pnlUp: boolean; duration: string; paper?: boolean;
}
const POSITIONS: PositionData[] = [];

function PositionsTable() {
  const router = useRouter();
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle><span>📍</span> Open Positions <span className="text-[11px] font-normal text-muted-foreground">(7 active)</span></CardTitle>
        <button onClick={() => router.push("/redesign/analytics")} className="text-[11px] font-semibold text-primary hover:underline">View in Journal →</button>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead><TableHead>Bot</TableHead><TableHead>Side</TableHead>
              <TableHead>Leverage</TableHead><TableHead>Entry</TableHead><TableHead>Current</TableHead>
              <TableHead>P&L</TableHead><TableHead>Duration</TableHead><TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {POSITIONS.length === 0 ? (
               <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No positions.</TableCell></TableRow>
            ) : POSITIONS.map((p, i) => (
              <TableRow key={i} className="cursor-pointer" onClick={() => console.info(`Viewing trade details for ${p.pair}`)}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted/50 border border-border flex items-center justify-center text-[10px] font-extrabold text-foreground">{p.icon}</div>
                    <div>
                      <div className="text-[13px] font-bold text-foreground">{p.pair}</div>
                      <div className="text-[10px] text-muted-foreground">{p.tf}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={`${p.paper ? "italic text-muted-foreground" : "text-foreground"}`}>{p.bot}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase border ${p.side === "long" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"}`}>{p.side}</span>
                </TableCell>
                <TableCell><span className="px-2 py-0.5 rounded-[4px] bg-muted/50 border border-border text-[10px] font-bold">{p.lev}</span></TableCell>
                <TableCell className="font-mono">{p.entry}</TableCell>
                <TableCell className="font-mono">{p.current}</TableCell>
                <TableCell>
                  <span className={`text-[13px] font-bold font-mono ${p.pnlUp ? "text-emerald-500" : "text-rose-500"}`}>{p.pnl}</span>
                  {p.paper && <span className="text-[10px] text-amber-500 font-semibold ml-1">(paper)</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{p.duration}</TableCell>
                <TableCell className="text-muted-foreground hover:text-foreground text-center text-lg">⋮</TableCell>
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
  id: string; pair: string; bot: string; side: string; entry: string; exit: string;
  pnl: string; pnlUp: boolean; fees: string; duration: string; closed: string;
}
const CLOSED_TRADES: ClosedTradeData[] = [];

function ClosedTradesTable() {
  const router = useRouter();
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle><span>📋</span> Today&apos;s Closed Trades <span className="text-[11px] font-normal text-muted-foreground">(5 trades)</span></CardTitle>
        <button onClick={() => router.push("/redesign/analytics")} className="text-[11px] font-semibold text-primary hover:underline">Full history →</button>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead><TableHead>Pair</TableHead><TableHead>Bot</TableHead>
              <TableHead>Side</TableHead><TableHead>open_rate</TableHead><TableHead>close_rate</TableHead>
              <TableHead>P&L</TableHead><TableHead>Fees</TableHead><TableHead>Duration</TableHead><TableHead>close_date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CLOSED_TRADES.length === 0 ? (
               <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No trades today.</TableCell></TableRow>
            ) : CLOSED_TRADES.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => console.info(`Viewing trade ${t.id}`)}>
                <TableCell className="font-mono text-muted-foreground">{t.id}</TableCell>
                <TableCell className="font-bold text-foreground">{t.pair}</TableCell>
                <TableCell className="text-[11px]">{t.bot}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase border ${t.side === "long" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"}`}>{t.side}</span>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{t.entry}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{t.exit}</TableCell>
                <TableCell className={`font-mono ${t.pnlUp ? "text-emerald-500" : "text-rose-500"}`}>{t.pnl}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{t.fees}</TableCell>
                <TableCell className="text-muted-foreground">{t.duration}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{t.closed}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ── 5. Quick Actions ── */
const ACTIONS = [
  { icon: "✏️", label: "New Strategy", href: "/redesign/builder" },
  { icon: "🧪", label: "Run Backtest", href: "/redesign/backtesting" },
  { icon: "📥", label: "Import Strategy", href: "#" },
  { icon: "💾", label: "Download Data", href: "/redesign/data" },
];

function QuickActions() {
  const router = useRouter();
  return (
    <Card>
      <CardHeader><CardTitle><span>⚡</span> Quick Actions</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => { if (a.href !== "#") router.push(a.href); }}
            className="flex items-center gap-3 px-4 py-3 rounded-btn border border-border bg-muted/50 cursor-pointer hover:border-primary hover:bg-primary/10 hover:text-primary transition-all text-[13px] text-muted-foreground font-medium w-full text-left"
          >
            <span className="text-[16px] w-5 text-center">{a.icon}</span>
            {a.label}
            <span className="ml-auto text-muted-foreground">→</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── 6. Equity Curve (Recharts) ── */
const EQUITY_DATA = [
  { day: "01", eq: 110200 }, { day: "02", eq: 112000 }, { day: "03", eq: 109500 },
  { day: "04", eq: 114000 }, { day: "05", eq: 116200 }, { day: "06", eq: 115000 },
  { day: "07", eq: 118500 }, { day: "08", eq: 121000 }, { day: "09", eq: 119800 },
  { day: "10", eq: 124000 }, { day: "11", eq: 125500 }, { day: "12", eq: 127400 }
];

function EquityCurve() {
  const router = useRouter();
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle><span>📈</span> Equity Curve (30d)</CardTitle>
        <button onClick={() => router.push("/redesign/analytics")} className="text-[11px] font-semibold text-primary hover:underline">Full Analytics →</button>
      </CardHeader>
      <div className="p-5 pt-0 flex-1 w-full min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={EQUITY_DATA} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="eqColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ backgroundColor: "#0c0c14", borderColor: "#1e1e30", borderRadius: "10px", fontSize: "12px", color: "#f0f0f5" }}
              itemStyle={{ color: "#22c55e", fontWeight: "bold" }}
              formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, "Equity"]}
              labelStyle={{ color: "#808098", marginBottom: "4px" }}
            />
            <Area type="monotone" dataKey="eq" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#eqColor)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ── 7. Alerts ── */
interface AlertData { type: "success" | "warning" | "info" | "critical"; text: string; time: string; }
const INITIAL_ALERTS: AlertData[] = [];
const alertDotColors = { success: "bg-green", warning: "bg-amber", info: "bg-primary", critical: "bg-red shadow-[0_0_8px_rgba(239,68,68,0.5)]" };

function Alerts() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle><span>🔔</span> Recent Alerts {alerts.length > 0 && <span className="text-[11px] font-normal text-muted-foreground">({alerts.length})</span>}</CardTitle>
        <button className="text-[11px] font-semibold text-primary hover:underline">View all →</button>
      </CardHeader>
      <div className="overflow-y-auto max-h-[160px] custom-scrollbar">
        {alerts.length === 0 && <div className="text-[12px] text-muted-foreground text-center py-6">No active alerts.</div>}
        {alerts.map((a, i) => (
          <div key={i} className="flex gap-3 px-5 py-3 border-b border-border hover:bg-muted/50 transition-colors">
            <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${alertDotColors[a.type]}`} />
            <div className="flex-1">
              <div className="text-[12px] text-foreground leading-snug">{a.text}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{a.time}</div>
            </div>
            <button onClick={() => setAlerts(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground text-[11px] font-bold">✕</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── 8. System Health ── */
interface HealthData { name: string; detail: string; status: "ok" | "warn" | "err"; }
const HEALTH: HealthData[] = [];
const healthDotColors = { ok: "bg-green", warn: "bg-amber", err: "bg-red" };

function SystemHealth() {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle><span>💚</span> System Health</CardTitle>
        <span className="text-[10px] text-muted-foreground">Check: {timestamp}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
         {HEALTH.length === 0 && <div className="text-[12px] text-muted-foreground text-center py-6">Systems Operational</div>}
         {HEALTH.map((h, i) => (
           <div key={i} className="flex items-center gap-3 px-3 py-2 bg-muted/50 border border-border rounded-[8px]">
             <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthDotColors[h.status]}`} />
             <div>
               <div className="text-[12px] font-bold text-foreground">{h.name}</div>
               <div className="text-[10px] text-muted-foreground">{h.detail}</div>
             </div>
           </div>
         ))}
      </CardContent>
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
  const displayBots: BotData[] = tradingBots.map(b => ({
    name: b.name, status: b.is_dry_run ? "paper" : "live", strategy: b.strategy_name || "Unknown",
    pair: b.pair_whitelist?.[0] || "Multiple", pnl: "—", pnlUp: true, positions: 0, bars: [0, 0, 0, 0, 0, 0, 0],
  }));

  return (
    <div className="pb-10 max-w-[1600px] mx-auto pt-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground tracking-tight leading-tight">System Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Live connection to Orchestrator Enclave.</p>
        </div>
        <Button variant="destructive" onClick={() => setKillSwitchOpen(true)}>
          🚨 Kill Switch
        </Button>
      </div>

      <StatCards bots={displayBots} />
      <BotGrid selectedBotId={selectedBotId} onSelectBot={(name) => setSelectedBotId(prev => prev === name ? null : name)} />

      {selectedBotId && (
        <div className="mb-6 px-5 py-3 bg-primary/10 border border-primary/20 rounded-[8px] text-[13px] text-foreground font-medium flex items-center justify-between">
          <span>Filtering active display for enclave: <strong className="text-primary">{selectedBotId}</strong></span>
          <button onClick={() => setSelectedBotId(null)} className="text-[12px] text-muted-foreground hover:text-foreground hover:underline transition-colors">Clear Filter ✕</button>
        </div>
      )}

      {/* Grid: Main Table vs Sidebar */}
      <div className="grid grid-cols-[2.5fr_1fr] gap-6 mb-6">
        <div className="flex flex-col gap-6">
          <PositionsTable />
          <ClosedTradesTable />
        </div>
        <div className="flex flex-col gap-6">
          <QuickActions />
          <div className="h-[240px]"><EquityCurve /></div>
        </div>
      </div>

      {/* Footer Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="h-[220px]"><Alerts /></div>
        <div className="h-[220px]"><SystemHealth /></div>
      </div>

      <KillSwitchModal open={killSwitchOpen} onOpenChange={setKillSwitchOpen} />
    </div>
  );
}
