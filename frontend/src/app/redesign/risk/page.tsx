"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/* ══════════════════════════════════════
   RISK — Live Risk Monitoring
   Self-review checklist (audit line 84-90):
   ✅ Kill Switch Control (Soft Kill, Hard Kill, Kill All, per-bot toggles)
   ✅ Heartbeat Monitor (5 bots with ping/candle/trade/status)
   ✅ FT Protections Status (per-bot, read-only)
   ✅ Pair Locks table
   ✅ Portfolio Exposure (cross-bot)
   ✅ Risk Events Log (immutable audit trail)
   ══════════════════════════════════════ */

/* ── Kill Switch ── */
const INITIAL_BOTS_KILL = [
  { name: "bot-trend-01", originalStatus: "live" as const },
  { name: "bot-mean-rev", originalStatus: "live" as const },
  { name: "bot-scalp-hl", originalStatus: "live" as const },
  { name: "bot-breakout-p", originalStatus: "paper" as const },
  { name: "bot-freqai-exp", originalStatus: "paper" as const },
];

type BotStatus = "live" | "paper" | "stopped" | "killed";

function KillSwitchCard({ botStatuses, onSoftKill, onHardKill, onToggleBot, onKillAll }: {
  botStatuses: Record<string, BotStatus>;
  onSoftKill: () => void;
  onHardKill: () => void;
  onToggleBot: (name: string) => void;
  onKillAll: () => void;
}) {
  return (
    <Card className="border-ft-red/20">
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>🚨</span> Kill Switch Control
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onSoftKill}
            className="py-4 rounded-lg border border-ft-amber/30 bg-ft-amber/8 text-ft-amber text-sm font-bold hover:bg-ft-amber/15 transition-colors"
          >
            ⚠️ Soft Kill<br /><span className="text-2xs font-normal opacity-70">Stops new entries. Positions remain open.</span>
          </button>
          <button
            onClick={onHardKill}
            className="py-4 rounded-lg border border-ft-red/30 bg-ft-red/8 text-ft-red text-sm font-bold hover:bg-ft-red/15 transition-colors"
          >
            🛑 HARD KILL<br /><span className="text-2xs font-normal opacity-70">Force-exit ALL at MARKET. Irreversible.</span>
          </button>
        </div>
        <div className="space-y-2">
          {INITIAL_BOTS_KILL.map((b) => {
            const status = botStatuses[b.name] || b.originalStatus;
            const isActive = status === "live" || status === "paper";
            return (
              <div key={b.name} className="flex items-center justify-between py-2 px-3 bg-accent/20 rounded-btn">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    status === "killed" ? "bg-ft-red" :
                    status === "stopped" ? "bg-muted-foreground" :
                    status === "live" ? "bg-ft-green" : "bg-ft-amber"
                  }`} />
                  <span className="text-xs font-semibold text-foreground">{b.name}</span>
                  <Badge variant="outline" className={`text-2xs ${
                    status === "killed" ? "text-ft-red border-ft-red/20" :
                    status === "stopped" ? "text-muted-foreground border-border" :
                    status === "live" ? "text-ft-green border-ft-green/20" : "text-ft-amber border-ft-amber/20"
                  }`}>
                    {status}
                  </Badge>
                </div>
                <button
                  onClick={() => onToggleBot(b.name)}
                  className={`text-2xs font-bold transition-colors px-2 py-1 rounded border ${
                    isActive
                      ? "text-ft-red/70 hover:text-ft-red border-ft-red/20 hover:border-ft-red/40"
                      : "text-ft-green/70 hover:text-ft-green border-ft-green/20 hover:border-ft-green/40"
                  }`}
                >
                  {isActive ? "KILL" : "START"}
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={onKillAll}
          className="w-full py-3 rounded-btn bg-ft-red/10 border border-ft-red/30 text-ft-red text-sm font-extrabold hover:bg-ft-red/20 transition-colors"
        >
          🛑 KILL ALL BOTS
        </button>
      </CardContent>
    </Card>
  );
}

/* ── Heartbeat Monitor ── */
const INITIAL_HEARTBEATS = [
  { name: "bot-trend-01", lastCandle: "2m ago", lastTrade: "12m ago", tradesToday: 3 },
  { name: "bot-mean-rev", lastCandle: "2m ago", lastTrade: "2h ago", tradesToday: 1 },
  { name: "bot-scalp-hl", lastCandle: "2m ago", lastTrade: "48m ago", tradesToday: 8 },
  { name: "bot-breakout-p", lastCandle: "2m ago", lastTrade: "3h ago", tradesToday: 0 },
  { name: "bot-freqai-exp", lastCandle: "2m ago", lastTrade: "5h ago", tradesToday: 0 },
];

function HeartbeatCard({ botStatuses }: { botStatuses: Record<string, BotStatus> }) {
  const [pings, setPings] = useState<Record<string, { ms: number; lastChecked: string }>>({});

  const updatePings = useCallback(() => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const newPings: Record<string, { ms: number; lastChecked: string }> = {};
    for (const h of INITIAL_HEARTBEATS) {
      const status = botStatuses[h.name];
      if (status === "killed" || status === "stopped") {
        newPings[h.name] = { ms: -1, lastChecked: timeStr };
      } else {
        newPings[h.name] = { ms: Math.floor(Math.random() * 50) + 5, lastChecked: timeStr };
      }
    }
    setPings(newPings);
  }, [botStatuses]);

  useEffect(() => {
    updatePings();
    const interval = setInterval(updatePings, 3000);
    return () => clearInterval(interval);
  }, [updatePings]);

  return (
    <Card>
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>💓</span> Heartbeat Monitor
          <span className="text-2xs font-normal text-muted-foreground ml-auto">Ping every 3s</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/20 hover:bg-accent/20">
              <TableHead className="text-2xs">Bot</TableHead>
              <TableHead className="text-2xs">Ping</TableHead>
              <TableHead className="text-2xs">Last Candle</TableHead>
              <TableHead className="text-2xs">Last Trade</TableHead>
              <TableHead className="text-2xs">Trades Today</TableHead>
              <TableHead className="text-2xs">Status</TableHead>
              <TableHead className="text-2xs">Last Checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INITIAL_HEARTBEATS.map((h) => {
              const pingData = pings[h.name];
              const status = botStatuses[h.name];
              const isDead = status === "killed" || status === "stopped";
              const isWarn = h.name === "bot-scalp-hl" && !isDead;
              return (
                <TableRow key={h.name}>
                  <TableCell className="text-xs font-bold text-foreground">{h.name}</TableCell>
                  <TableCell className={`text-xs font-mono-data ${isDead ? "text-ft-red" : "text-muted-foreground"}`}>
                    {isDead ? "TIMEOUT" : pingData ? `${pingData.ms}ms` : "..."}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{isDead ? "—" : h.lastCandle}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{isDead ? "—" : h.lastTrade}</TableCell>
                  <TableCell className="text-xs font-mono-data text-foreground">{isDead ? "—" : h.tradesToday}</TableCell>
                  <TableCell>
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                      isDead
                        ? "bg-ft-red shadow-[0_0_6px_hsla(0,67%,60%,0.3)]"
                        : isWarn
                        ? "bg-ft-amber shadow-[0_0_6px_hsla(38,92%,50%,0.3)]"
                        : "bg-ft-green shadow-[0_0_6px_hsla(97,75%,33%,0.3)]"
                    }`} />
                  </TableCell>
                  <TableCell className="text-2xs font-mono-data text-muted-foreground">
                    {pingData?.lastChecked || "..."}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── FT Protections Status ── */
const PROTECTIONS_STATUS = [
  { bot: "bot-trend-01", guard: "Active", guardState: "ok", maxDd: "OK (1.2%)", maxDdState: "ok", cooldown: "OK", coolState: "ok" },
  { bot: "bot-mean-rev", guard: "Active", guardState: "ok", maxDd: "OK (0.8%)", maxDdState: "ok", cooldown: "OK", coolState: "ok" },
  { bot: "bot-scalp-hl", guard: "TRIGGERED (2/3 SL)", guardState: "warn", maxDd: "WARNING (4.1%)", maxDdState: "warn", cooldown: "Active", coolState: "warn" },
  { bot: "bot-breakout-p", guard: "Active", guardState: "ok", maxDd: "OK (0.3%)", maxDdState: "ok", cooldown: "OK", coolState: "ok" },
  { bot: "bot-freqai-exp", guard: "Active", guardState: "ok", maxDd: "OK (0.1%)", maxDdState: "ok", cooldown: "OK", coolState: "ok" },
];

function ProtectionsCard() {
  return (
    <Card>
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>🔒</span> FT Protections Status <span className="text-2xs font-normal text-muted-foreground">(read-only from FreqTrade)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/20 hover:bg-accent/20">
              <TableHead className="text-2xs">Bot</TableHead>
              <TableHead className="text-2xs">StoplossGuard</TableHead>
              <TableHead className="text-2xs">MaxDrawdown</TableHead>
              <TableHead className="text-2xs">CooldownPeriod</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PROTECTIONS_STATUS.map((p) => (
              <TableRow key={p.bot}>
                <TableCell className="text-xs font-bold text-foreground">{p.bot}</TableCell>
                <TableCell className={`text-xs font-semibold ${p.guardState === "ok" ? "text-ft-green" : "text-ft-amber"}`}>{p.guard}</TableCell>
                <TableCell className={`text-xs font-semibold ${p.maxDdState === "ok" ? "text-ft-green" : "text-ft-amber"}`}>{p.maxDd}</TableCell>
                <TableCell className={`text-xs font-semibold ${p.coolState === "ok" ? "text-ft-green" : "text-ft-amber"}`}>{p.cooldown}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Pair Locks ── */
const INITIAL_PAIR_LOCKS = [
  { id: "PL-001", bot: "bot-scalp-hl", pair: "SOL/USDT", reason: "StoplossGuard: 3 SL in 1h", until: "16:45", active: true },
  { id: "PL-002", bot: "bot-scalp-hl", pair: "SOL/USDT", reason: "CooldownPeriod: 5 candles", until: "15:25", active: false },
];

function PairLocksCard({ locks, onUnlock, onAddLock }: {
  locks: typeof INITIAL_PAIR_LOCKS;
  onUnlock: (id: string) => void;
  onAddLock: () => void;
}) {
  return (
    <Card>
      <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>🔐</span> Pair Locks
        </CardTitle>
        <button
          onClick={onAddLock}
          className="text-2xs font-semibold text-primary px-3 py-1 rounded border border-primary/20 hover:bg-primary/10 transition-colors"
        >
          + Lock Pair
        </button>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent/20 hover:bg-accent/20">
              <TableHead className="text-2xs">ID</TableHead>
              <TableHead className="text-2xs">Bot</TableHead>
              <TableHead className="text-2xs">Pair</TableHead>
              <TableHead className="text-2xs">Reason</TableHead>
              <TableHead className="text-2xs">Until</TableHead>
              <TableHead className="text-2xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-xs text-muted-foreground text-center py-4">No pair locks active</TableCell>
              </TableRow>
            )}
            {locks.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs font-mono-data text-muted-foreground">{l.id}</TableCell>
                <TableCell className="text-xs text-foreground">{l.bot}</TableCell>
                <TableCell className="text-xs font-bold text-foreground">{l.pair}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.reason}</TableCell>
                <TableCell className="text-xs font-mono-data text-foreground">{l.until}</TableCell>
                <TableCell>
                  {l.active && (
                    <button
                      onClick={() => onUnlock(l.id)}
                      className="text-2xs font-bold text-primary hover:text-primary/80 transition-colors"
                    >
                      Unlock
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Lock Pair Form Modal ── */
function LockPairForm({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: { pair: string; reason: string; duration: string }) => void;
}) {
  const [pair, setPair] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pair.trim()) { alert("Pair is required"); return; }
    if (!reason.trim()) { alert("Reason is required"); return; }
    onSubmit({ pair: pair.trim(), reason: reason.trim(), duration });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-foreground mb-4 flex items-center gap-2">
          🔐 Lock Pair
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Pair</label>
            <input
              type="text"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="e.g. BTC/USDT"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-accent/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Manual lock — high volatility"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-accent/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Duration (minutes)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-accent/20 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors"
            >
              Lock Pair
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Portfolio Exposure ── */
const EXPOSURE = [
  { pair: "BTC/USDT", bots: 2, exposure: "$42,300", pct: 68 },
  { pair: "ETH/USDT", bots: 1, exposure: "$12,100", pct: 19 },
  { pair: "SOL/USDT", bots: 1, exposure: "$5,800", pct: 9 },
  { pair: "DOGE/USDT", bots: 1, exposure: "$2,400", pct: 4 },
];

function ExposureCard() {
  return (
    <Card>
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>💰</span> Portfolio Exposure (Cross-Bot)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 space-y-3">
        {EXPOSURE.map((e) => (
          <div key={e.pair} className="flex items-center gap-4">
            <span className="text-xs font-bold text-foreground w-24">{e.pair}</span>
            <div className="flex-1">
              <Progress value={e.pct} className="h-2" />
            </div>
            <span className="text-xs font-mono-data text-muted-foreground w-20 text-right">{e.exposure}</span>
            <span className="text-2xs font-bold text-foreground w-10 text-right">{e.pct}%</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Risk Events Log ── */
const INITIAL_RISK_EVENTS = [
  { time: "14:22", type: "trade" as const, text: "Trade #4821 closed — BTC/USDT +$312.40 (bot-trend-01)" },
  { time: "13:45", type: "protection" as const, text: "StoplossGuard TRIGGERED — bot-scalp-hl locked SOL/USDT for 30m" },
  { time: "13:30", type: "alert" as const, text: "Drawdown alert — bot-scalp-hl reached 4.1% (threshold: 5%)" },
  { time: "12:08", type: "trade" as const, text: "Trade #4819 closed — SOL/USDT -$35.00 (bot-scalp-hl)" },
  { time: "10:55", type: "trade" as const, text: "Trade #4818 closed — BTC/USDT +$87.50 (bot-trend-01)" },
  { time: "09:30", type: "trade" as const, text: "Trade #4817 closed — DOGE/USDT +$18.00 (bot-breakout-p)" },
  { time: "08:00", type: "system" as const, text: "All bots started — daily cycle initiated" },
];

const MORE_EVENTS = [
  { time: "07:55", type: "system" as const, text: "Pre-market health check passed — all systems nominal" },
  { time: "07:30", type: "system" as const, text: "Data download complete — 6 pairs updated" },
  { time: "06:00", type: "system" as const, text: "Scheduled maintenance window ended" },
  { time: "03:22", type: "trade" as const, text: "Trade #4816 closed — BTC/USDT +$145.20 (bot-trend-01)" },
  { time: "01:10", type: "alert" as const, text: "Binance API rate limit warning — 980/1200 used" },
];

const eventIcons = { trade: "📊", protection: "🛡️", alert: "⚠️", system: "🔧" };

function RiskEventsCard() {
  const [visibleCount, setVisibleCount] = useState(7);
  const allEvents = [...INITIAL_RISK_EVENTS, ...MORE_EVENTS];
  const visibleEvents = allEvents.slice(0, visibleCount);
  const hasMore = visibleCount < allEvents.length;

  return (
    <Card>
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <span>📋</span> Risk Events Log <span className="text-2xs font-normal text-muted-foreground">(Immutable Audit Trail)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <div className="max-h-[300px] overflow-y-auto space-y-0">
          {visibleEvents.map((e, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-border last:border-b-0">
              <span className="text-xs font-mono-data text-muted-foreground/50 w-12 flex-shrink-0">{e.time}</span>
              <span className="text-sm flex-shrink-0">{eventIcons[e.type]}</span>
              <span className="text-xs text-muted-foreground leading-relaxed">{e.text}</span>
            </div>
          ))}
        </div>
        {hasMore && (
          <button
            onClick={() => setVisibleCount((prev) => prev + 5)}
            className="w-full mt-3 py-2 text-xs font-semibold text-primary border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
          >
            Load More ({allEvents.length - visibleCount} remaining)
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════
   PAGE
   ══════════════════════════════════════ */
export default function RiskPage() {
  const [botStatuses, setBotStatuses] = useState<Record<string, BotStatus>>(() => {
    const initial: Record<string, BotStatus> = {};
    for (const b of INITIAL_BOTS_KILL) {
      initial[b.name] = b.originalStatus;
    }
    return initial;
  });

  const [pairLocks, setPairLocks] = useState(INITIAL_PAIR_LOCKS);
  const [showLockForm, setShowLockForm] = useState(false);

  function handleSoftKill() {
    if (!confirm("SOFT KILL: This will stop all bots from opening new trades. Existing positions remain open. Continue?")) return;
    console.log("SOFT KILL: POST /api/v1/stop per bot");
    setBotStatuses((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = "stopped";
      }
      return next;
    });
  }

  function handleHardKill() {
    if (!confirm("HARD KILL: This will force-exit ALL positions at MARKET and stop ALL bots. This is IRREVERSIBLE. Continue?")) return;
    console.log("HARD KILL: POST /api/v1/forceexit + POST /api/v1/stop per bot");
    setBotStatuses((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = "killed";
      }
      return next;
    });
  }

  function handleToggleBot(name: string) {
    setBotStatuses((prev) => {
      const current = prev[name];
      if (current === "live" || current === "paper") {
        console.log(`KILL BOT: POST /api/v1/forceexit + POST /api/v1/stop for ${name}`);
        return { ...prev, [name]: "killed" };
      } else {
        const original = INITIAL_BOTS_KILL.find((b) => b.name === name)?.originalStatus || "live";
        console.log(`START BOT: Starting ${name} as ${original}`);
        return { ...prev, [name]: original };
      }
    });
  }

  function handleKillAll() {
    if (!confirm("KILL ALL BOTS: This will force-exit ALL positions on ALL bots at MARKET. Continue?")) return;
    console.log("KILL ALL: POST /api/v1/forceexit + POST /api/v1/stop for all bots");
    setBotStatuses((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = "killed";
      }
      return next;
    });
  }

  function handleUnlock(id: string) {
    console.log(`UNLOCK: DELETE /api/v1/locks/${id}`);
    setPairLocks((prev) => prev.filter((l) => l.id !== id));
  }

  function handleAddLock(data: { pair: string; reason: string; duration: string }) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + parseInt(data.duration));
    const until = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const newLock = {
      id: `PL-${String(pairLocks.length + 1).padStart(3, "0")}`,
      bot: "manual",
      pair: data.pair,
      reason: data.reason,
      until,
      active: true,
    };
    console.log(`LOCK PAIR: POST /api/v1/locks — ${data.pair} for ${data.duration}m`);
    setPairLocks((prev) => [newLock, ...prev]);
    setShowLockForm(false);
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-foreground">Risk Management</h2>
        <p className="text-xs text-muted-foreground mt-1">Live risk monitoring, protections, and emergency controls</p>
      </div>

      <div className="grid grid-cols-[1fr_1.5fr] gap-4 mb-4">
        <KillSwitchCard
          botStatuses={botStatuses}
          onSoftKill={handleSoftKill}
          onHardKill={handleHardKill}
          onToggleBot={handleToggleBot}
          onKillAll={handleKillAll}
        />
        <HeartbeatCard botStatuses={botStatuses} />
      </div>

      <div className="mb-4">
        <ProtectionsCard />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <PairLocksCard locks={pairLocks} onUnlock={handleUnlock} onAddLock={() => setShowLockForm(true)} />
        <ExposureCard />
      </div>

      <RiskEventsCard />

      {showLockForm && (
        <LockPairForm onClose={() => setShowLockForm(false)} onSubmit={handleAddLock} />
      )}
    </>
  );
}
