"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Tooltip from "@/components/ui/Tooltip";
import { SkeletonTable, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { TOOLTIPS } from "@/lib/tooltips";
import {
  getBots,
  softKill,
  hardKill,
  softKillAll,
  hardKillAll,
  botConfig,
  botLocks,
  botDeleteLock,
  botLockAdd,
  botStats,
  botWhitelist,
  portfolioBalance,
  portfolioTrades,
  getRiskEvents,
} from "@/lib/api";
import type {
  Bot,
  FTLock,
  FTTrade,
  RiskEvent,
  PortfolioBalance,
} from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProtectionWithStatus {
  method: string;
  _status: "active" | "triggered" | "inactive";
  _drawdown?: { current: number; max: number; pct: number };
  _flaggedPairs?: string[];
  _note?: string;
  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const statusColor = {
  running: "text-green",
  stopped: "text-text-3",
  error: "text-red",
  starting: "text-amber",
  killed: "text-red",
};

const dotBg: Record<string, string> = {
  ok: "bg-green shadow-[0_0_8px_var(--color-green)]",
  warn: "bg-amber shadow-[0_0_8px_var(--color-amber)]",
  fail: "bg-red shadow-[0_0_8px_var(--color-red)] animate-pulse",
};

function botHeartbeatStatus(bot: Bot): "ok" | "warn" | "fail" {
  if (bot.consecutive_failures >= 3 || bot.status === "error" || bot.status === "killed") return "fail";
  if (bot.consecutive_failures >= 1 || !bot.is_healthy) return "warn";
  return "ok";
}

function KillTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    HARD_KILL: "bg-red-bg text-red border border-red/20",
    SOFT_KILL: "bg-amber-bg text-amber border border-amber/20",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${styles[type] ?? "bg-bg-3 text-text-3"}`}>
      {type.replace("_", " ")}
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  const styles: Record<string, string> = {
    MANUAL: "bg-accent/10 text-accent border border-accent/20",
    HEARTBEAT_FAILURE: "bg-purple/10 text-purple border border-purple/20",
    DRAWDOWN_LIMIT: "bg-cyan/10 text-cyan border border-cyan/20",
  };
  if (!trigger) return null;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${styles[trigger] ?? "bg-bg-3 text-text-3"}`}>
      {trigger.replace(/_/g, " ")}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function RiskPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [locks, setLocks] = useState<Array<FTLock & { _botId: number; _botName: string }>>([]);
  const [protections, setProtections] = useState<ProtectionWithStatus[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioBalance | null>(null);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);

  // Toast flood guard: only show warning on first failure
  const portfolioFailedRef = useRef(false);
  const eventsFailedRef = useRef(false);
  const loadFailedRef = useRef(false);

  // Kill switch state
  const [showSoftKillConfirm, setShowSoftKillConfirm] = useState(false);
  const [showHardKillConfirm, setShowHardKillConfirm] = useState(false);
  const [killing, setKilling] = useState(false);

  // Lock Pair dialog state
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [lockBotId, setLockBotId] = useState<string>("");
  const [lockPair, setLockPair] = useState("");
  const [lockDuration, setLockDuration] = useState("60");
  const [lockReason, setLockReason] = useState("");
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [whitelist, setWhitelist] = useState<string[]>([]);

  // Cross-bot correlation state
  const [correlationData, setCorrelationData] = useState<{
    botNames: string[];
    matrix: number[][];
    pairOverlaps: Record<string, Record<string, string[]>>;
  } | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const botList = await getBots();
      setBots(botList);

      // Load portfolio exposure
      try {
        const pb = await portfolioBalance();
        setPortfolio(pb);
        portfolioFailedRef.current = false;
      } catch { /* non-blocking */
        if (!portfolioFailedRef.current) {
          toast.warning("Failed to load portfolio data");
          portfolioFailedRef.current = true;
        }
      }

      // Load risk events
      try {
        const evts = await getRiskEvents();
        setRiskEvents(evts);
        eventsFailedRef.current = false;
      } catch { /* non-blocking */
        if (!eventsFailedRef.current) {
          toast.warning("Failed to load risk events");
          eventsFailedRef.current = true;
        }
      }

      // Load pair locks + protections from each running bot
      const allLocks: Array<FTLock & { _botId: number; _botName: string }> = [];
      const allProtections: ProtectionWithStatus[] = [];

      await Promise.allSettled(
        botList
          .filter((b) => b.status === "running")
          .map(async (bot) => {
            try {
              const [locksRes, configRes, statsRes] = await Promise.allSettled([
                botLocks(bot.id),
                botConfig(bot.id),
                botStats(bot.id),
              ]);

              if (locksRes.status === "fulfilled") {
                for (const lock of locksRes.value.locks) {
                  allLocks.push({ ...lock, _botId: bot.id, _botName: bot.name });
                }
              }

              if (configRes.status === "fulfilled" && configRes.value.protections) {
                for (const rawProt of configRes.value.protections) {
                  const prot: ProtectionWithStatus = Object.assign(
                    { _status: "active" as const, _drawdown: undefined, _flaggedPairs: undefined },
                    rawProt,
                  );

                  // MaxDrawdown: compute current drawdown
                  if (rawProt.method === "MaxDrawdown" && statsRes.status === "fulfilled") {
                    const rawDd = statsRes.value.max_drawdown ?? 0;
                    const rawMax = rawProt.max_allowed_drawdown ?? 0.15;
                    // If value > 1, it's already a percentage (e.g. 15 = 15%); don't multiply by 100
                    const dd = rawDd > 1 ? rawDd : rawDd * 100;
                    const maxAllowed = rawMax > 1 ? rawMax : rawMax * 100;
                    prot._drawdown = {
                      current: dd,
                      max: maxAllowed,
                      pct: maxAllowed > 0 ? Math.min(100, (dd / maxAllowed) * 100) : 0,
                    };
                  }

                  // LowProfitPairs: flagged pairs from active locks
                  if (prot.method === "LowProfitPairs" && locksRes.status === "fulfilled") {
                    const flagged = locksRes.value.locks
                      .filter((l) => l.active && l.reason?.includes("LowProfit"))
                      .map((l) => l.pair);
                    if (flagged.length > 0) {
                      prot._flaggedPairs = flagged;
                      prot._status = "triggered";
                    }
                  }

                  allProtections.push(prot);
                }
              }
            } catch { /* non-blocking */
              // per-bot error isolated
            }
          })
      );

      setLocks(allLocks);
      setProtections(allProtections);
    } catch { /* non-blocking */
      if (!loadFailedRef.current) {
        toast.error("Failed to load risk data.", {
          action: { label: "RETRY", onClick: () => loadData() },
        });
        loadFailedRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVALS.RISK);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Kill handlers ────────────────────────────────────────────────────────

  async function handleSoftKillAll() {
    setKilling(true);
    const id = toast.loading("Sending SOFT KILL to all bots...");
    try {
      await softKillAll("Manual SOFT KILL from Risk page");
      toast.dismiss(id);
      toast.success("SOFT KILL sent — all bots stopped. Positions remain open.");
      setShowSoftKillConfirm(false);
      await loadData();
    } catch (err) {
      toast.dismiss(id);
      toast.error(
        err instanceof Error ? `SOFT KILL failed: ${err.message}` : "SOFT KILL failed.",
        { action: { label: "RETRY", onClick: handleSoftKillAll } }
      );
    } finally {
      setKilling(false);
    }
  }

  async function handleHardKillAll() {
    setKilling(true);
    const id = toast.loading("Executing HARD KILL — force-exiting all positions...");
    try {
      await hardKillAll("Emergency HARD KILL from Risk page");
      toast.dismiss(id);
      toast.success("HARD KILL executed. All positions force-exited at market.");
      setShowHardKillConfirm(false);
      await loadData();
    } catch (err) {
      toast.dismiss(id);
      toast.error(
        err instanceof Error ? `HARD KILL failed: ${err.message}` : "HARD KILL failed.",
        { action: { label: "RETRY", onClick: handleHardKillAll } }
      );
    } finally {
      setKilling(false);
    }
  }

  async function handlePerBotKill(type: "soft" | "hard") {
    if (!selectedBotId) {
      toast.warning("Please select a bot first.");
      return;
    }
    const botId = parseInt(selectedBotId, 10);
    const bot = bots.find((b) => b.id === botId);
    const id = toast.loading(`${type === "soft" ? "SOFT" : "HARD"} KILL → ${bot?.name ?? selectedBotId}...`);
    try {
      if (type === "soft") {
        await softKill(botId, "Manual kill from Risk page");
      } else {
        await hardKill(botId, "Manual kill from Risk page");
      }
      toast.dismiss(id);
      toast.success(`${type === "soft" ? "SOFT" : "HARD"} KILL sent to ${bot?.name}.`);
      await loadData();
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Kill failed.");
    }
  }

  async function handleDeleteLock(lock: { id: number; _botId: number; _botName: string; pair: string }) {
    const id = toast.loading(`Deleting lock for ${lock.pair}...`);
    try {
      await botDeleteLock(lock._botId, lock.id);
      toast.dismiss(id);
      toast.success(`Lock deleted for ${lock.pair}.`);
      setLocks((prev) => prev.filter((l) => l.id !== lock.id || l._botId !== lock._botId));
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Failed to delete lock.");
    }
  }

  // ── Lock Pair handler ────────────────────────────────────────────────────

  async function handleOpenLockDialog() {
    setShowLockDialog(true);
    // Load whitelist from first running bot for pair options
    const runningBot = bots.find((b) => b.status === "running");
    if (runningBot) {
      setLockBotId(String(runningBot.id));
      try {
        const wl = await botWhitelist(runningBot.id);
        setWhitelist(wl.whitelist);
      } catch { /* non-blocking */
        setWhitelist([]);
      }
    }
  }

  async function handleLockBotChange(botIdStr: string) {
    setLockBotId(botIdStr);
    if (!botIdStr) return;
    try {
      const wl = await botWhitelist(parseInt(botIdStr, 10));
      setWhitelist(wl.whitelist);
    } catch { /* non-blocking */
      setWhitelist([]);
    }
  }

  async function handleSubmitLock() {
    if (!lockBotId || !lockPair || !lockDuration) {
      toast.warning("Please fill all required fields.");
      return;
    }
    setLockSubmitting(true);
    const id = toast.loading(`Locking ${lockPair}...`);
    try {
      const durationMinutes = parseInt(lockDuration, 10);
      const until = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      await botLockAdd(parseInt(lockBotId, 10), {
        pair: lockPair,
        until,
        reason: lockReason || "Manual lock from Risk page",
      });
      toast.dismiss(id);
      toast.success(`Pair ${lockPair} locked for ${durationMinutes} minutes.`);
      setShowLockDialog(false);
      setLockPair("");
      setLockDuration("60");
      setLockReason("");
      await loadData();
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Failed to lock pair.");
    } finally {
      setLockSubmitting(false);
    }
  }

  // ── Cross-bot correlation ──────────────────────────────────────────────────

  useEffect(() => {
    async function loadCorrelation() {
      if (bots.length < 2) {
        setCorrelationData(null);
        return;
      }
      try {
        const pt = await portfolioTrades();
        const trades = pt.trades;
        // Group trades by bot
        const botTradesMap: Record<string, FTTrade[]> = {};
        for (const t of trades) {
          const key = t._bot_name ?? `Bot ${t._bot_id ?? "?"}`;
          if (!botTradesMap[key]) botTradesMap[key] = [];
          botTradesMap[key].push(t);
        }
        const botNames = Object.keys(botTradesMap);
        if (botNames.length < 2) {
          setCorrelationData(null);
          return;
        }
        // For each bot, get unique pairs
        const botPairs: Record<string, Set<string>> = {};
        for (const [name, trades] of Object.entries(botTradesMap)) {
          botPairs[name] = new Set(trades.map((t) => t.pair));
        }
        // Build overlap matrix + detail
        const matrix: number[][] = [];
        const pairOverlaps: Record<string, Record<string, string[]>> = {};
        for (let i = 0; i < botNames.length; i++) {
          matrix[i] = [];
          const nameI = botNames[i];
          if (!pairOverlaps[nameI]) pairOverlaps[nameI] = {};
          for (let j = 0; j < botNames.length; j++) {
            const nameJ = botNames[j];
            if (i === j) {
              matrix[i][j] = botPairs[nameI].size;
            } else {
              const overlap = Array.from(botPairs[nameI]).filter((p) => botPairs[nameJ].has(p));
              matrix[i][j] = overlap.length;
              pairOverlaps[nameI][nameJ] = overlap;
            }
          }
        }
        setCorrelationData({ botNames, matrix, pairOverlaps });
      } catch { /* non-blocking */
        // Non-critical
        setCorrelationData(null);
      }
    }
    if (!loading && bots.length >= 2) {
      loadCorrelation();
    }
  }, [bots, loading]);

  // ── Running bots count ────────────────────────────────────────────────────

  const runningBots = bots.filter((b) => b.status === "running");
  const stoppedBots = bots.filter((b) => b.status !== "running");
  const lastEvent = riskEvents[0];

  return (
    <AppShell title="Risk Management">

      {/* ════ KILL SWITCH PANEL ════ */}
      <div className="bg-gradient-to-br from-bg-2 to-red/[0.03] border border-red/15 rounded-card overflow-hidden mb-6">
        <div className="px-6 py-4 flex items-center justify-between border-b border-red/10">
          <h3 className="text-sm font-semibold text-text-0 flex items-center gap-2">
            <span>🚨</span>
            <Tooltip content={"Emergency controls to stop bot trading. Soft Kill stops new entries; Hard Kill force-exits all positions at market price."} configKey="kill_switch">
              Kill Switch Control
            </Tooltip>
          </h3>
          {lastEvent && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-3">Last event:</span>
              <span className="text-[10px] text-amber font-semibold">
                {lastEvent.kill_type.replace("_", " ")} — {new Date(lastEvent.created_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Two big kill buttons */}
          <div className="grid grid-cols-2 gap-5 mb-7">
            {/* SOFT KILL */}
            <button
              type="button"
              className="bg-amber-bg border-2 border-amber/25 rounded-card p-6 text-center cursor-pointer transition-all hover:border-amber hover:shadow-[0_0_24px_rgba(245,158,11,0.15)] disabled:opacity-50"
              onClick={() => setShowSoftKillConfirm(true)}
              disabled={killing}
            >
              <div className="text-[32px] mb-2.5">⏸️</div>
              <div className="text-[15px] font-bold text-amber mb-1">SOFT KILL</div>
              <div className="text-[11px] text-text-2 leading-relaxed">
                Stop Trading — no new entries.<br />Open positions remain untouched.
              </div>
              <div className="text-[10px] text-text-3 mt-2 font-mono">POST /api/v1/stop</div>
            </button>

            {/* HARD KILL */}
            <button
              type="button"
              className="bg-red-bg border-2 border-red/25 rounded-card p-6 text-center cursor-pointer transition-all hover:border-red hover:shadow-[0_0_24px_rgba(239,68,68,0.2)] disabled:opacity-50"
              onClick={() => setShowHardKillConfirm(true)}
              disabled={killing}
            >
              <div className="text-[32px] mb-2.5">🛑</div>
              <div className="text-[15px] font-bold text-red mb-1">EMERGENCY CLOSE ALL</div>
              <div className="text-[11px] text-text-2 leading-relaxed">
                Force-exit ALL positions at MARKET<br />and stop ALL bots. Nuclear option.
              </div>
              <div className="text-[10px] text-text-3 mt-2 font-mono">POST /api/v1/forceexit + /stop</div>
            </button>
          </div>

          {/* Per-bot controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="bg-bg-1 border border-border rounded-btn px-3.5 py-2.5 text-xs text-text-1 outline-none min-w-[220px] font-inherit focus:border-accent cursor-pointer"
            >
              <option value="">Select bot to kill...</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} ({bot.is_dry_run ? "PAPER" : "LIVE"} — {bot.status})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handlePerBotKill("soft")}
              disabled={!selectedBotId}
              className="bg-amber-bg border border-amber/30 rounded-btn px-4 py-2 text-[11px] font-semibold text-amber cursor-pointer transition-all hover:bg-amber/[0.18] hover:border-amber disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Soft Kill
            </button>
            <button
              type="button"
              onClick={() => handlePerBotKill("hard")}
              disabled={!selectedBotId}
              className="bg-red-bg border border-red/30 rounded-btn px-4 py-2 text-[11px] font-semibold text-red cursor-pointer transition-all hover:bg-red/[0.18] hover:border-red disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Hard Kill
            </button>
            <div className="ml-auto flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  runningBots.length > 0
                    ? "bg-green shadow-[0_0_8px_var(--color-green)]"
                    : "bg-red"
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-text-0">
                  {runningBots.length} / {bots.length} Running
                </div>
                {stoppedBots.length > 0 && (
                  <div className="text-[10px] text-text-3">
                    {stoppedBots.map((b) => b.name).join(", ")} stopped
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════ HEARTBEAT MONITOR ════ */}
      <Card className="mb-4">
        <CardHeader
          title="Heartbeat Monitor"
          icon="💓"
          action={<span className="text-[10px] text-text-3">15s refresh · 3 failures = HARD KILL</span>}
        />
        <CardBody>
          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`skel-3-${i}`} lines={3} />)}
            </div>
          ) : bots.length === 0 ? (
            <div className="py-6 text-center text-sm text-text-3">No bots registered</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {bots.map((bot) => {
                const hbStatus = botHeartbeatStatus(bot);
                return (
                  <div
                    key={bot.id}
                    className={`bg-bg-1 border rounded-lg p-4 transition-colors ${
                      hbStatus === "warn"
                        ? "border-amber/30"
                        : hbStatus === "fail"
                        ? "border-red/30"
                        : "border-border hover:border-border-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-text-0">{bot.name}</div>
                      <div className={`w-2.5 h-2.5 rounded-full ${dotBg[hbStatus]}`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-text-3 uppercase tracking-wider">Status</span>
                        <span className={`text-[11px] font-semibold ${statusColor[bot.status] ?? "text-text-2"}`}>
                          {bot.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-text-3 uppercase tracking-wider">Health</span>
                        <span className={`text-[11px] font-semibold ${bot.is_healthy ? "text-green" : "text-red"}`}>
                          {bot.is_healthy ? "Healthy" : "Unhealthy"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-text-3 uppercase tracking-wider">Failures</span>
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map((dot) => (
                            <div
                              key={`hb-dot-${dot}`}
                              className={`w-2 h-2 rounded-full ${
                                dot < bot.consecutive_failures
                                  ? hbStatus === "fail"
                                    ? "bg-red border border-red shadow-[0_0_4px_var(--color-red)]"
                                    : "bg-amber border border-amber"
                                  : "bg-bg-3 border border-border"
                              }`}
                            />
                          ))}
                          <span className={`text-[11px] font-semibold ml-1 ${statusColor[bot.status] ?? "text-text-2"}`}>
                            {bot.consecutive_failures}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ════ FT PROTECTIONS STATUS ════ */}
      <Card className="mb-4">
        <CardHeader
          title="FT Protections Status"
          icon="🔒"
          action={<span className="text-xs text-text-3">From bot config.json (read-only)</span>}
        />
        <CardBody>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[0,1,2,3].map(i => <SkeletonCard key={`skel-4-${i}`} lines={4} />)}
            </div>
          ) : protections.length === 0 ? (
            <div className="py-6 text-center text-sm text-text-3">
              No protections configured. Add them under Settings → Core Trading.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {protections.map((prot, idx) => {
                const badgeStyles: Record<string, string> = {
                  active: "bg-green-bg text-green border border-green/20",
                  inactive: "bg-bg-3 text-text-3 border border-border",
                  triggered: "bg-red-bg text-red border border-red/20",
                };
                // Map protection method names to tooltip keys
                const protectionTooltipMap: Record<string, keyof typeof TOOLTIPS> = {
                  "MaxDrawdown": "protection_max_drawdown",
                  "StoplossGuard": "protection_stoploss_guard",
                  "CooldownPeriod": "protection_cooldown_period",
                  "LowProfitPairs": "protection_low_profit_pairs",
                };
                const tooltipKey = protectionTooltipMap[prot.method] || undefined;

                return (
                  <div key={`prot-${prot.method}-${idx}`} className="bg-bg-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      {tooltipKey && TOOLTIPS[tooltipKey] ? (
                        <Tooltip
                          content={TOOLTIPS[tooltipKey]?.description || prot.method}
                          configKey={TOOLTIPS[tooltipKey]?.configKey}
                        >
                          <div className="text-[12.5px] font-semibold text-text-0">{prot.method}</div>
                        </Tooltip>
                      ) : (
                        <div className="text-[12.5px] font-semibold text-text-0">{prot.method}</div>
                      )}
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeStyles[prot._status]}`}>
                        {prot._status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                      {Object.entries(prot)
                        .filter(([k]) => !k.startsWith("_") && k !== "method")
                        .slice(0, 6)
                        .map(([k, v]) => {
                          // Convert snake_case to Title Case for display
                          const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                          return (
                            <div key={k} className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-text-3 uppercase tracking-wider">{label}</span>
                              <span className="text-xs font-semibold text-text-1 font-mono">{String(v)}</span>
                            </div>
                          );
                        })}
                    </div>
                    {prot._drawdown && (
                      <div className="mt-2.5">
                        <div className="flex justify-between text-[10px] text-text-3 mb-1">
                          <span>Current Drawdown</span>
                          <span className="font-semibold text-amber">
                            {prot._drawdown.current.toFixed(1)}% / {prot._drawdown.max.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-bg-3 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber rounded-full transition-all"
                            style={{ width: `${prot._drawdown.pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {prot._flaggedPairs && prot._flaggedPairs.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[10px] text-text-3 mb-1">Flagged pairs:</div>
                        <div className="flex flex-wrap gap-1">
                          {prot._flaggedPairs.map((p) => (
                            <span key={p} className="text-[10px] font-semibold text-amber bg-amber-bg border border-amber/20 rounded px-2 py-0.5">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ════ PAIR LOCKS + PORTFOLIO EXPOSURE ════ */}
      <div className="grid grid-cols-2 gap-5 mb-6">

        {/* PAIR LOCKS TABLE */}
        <Card>
          <CardHeader
            title="Pair Locks"
            icon="🔐"
            action={
              <button
                type="button"
                onClick={handleOpenLockDialog}
                className="text-[11px] font-semibold text-accent bg-accent/10 border border-accent/20 rounded-btn px-3 py-1 hover:bg-accent/20 transition-colors cursor-pointer"
              >
                + Lock Pair
              </button>
            }
          />
          {loading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : locks.length === 0 ? (
            <CardBody>
              <div className="py-6 text-center text-sm text-text-3">No active pair locks</div>
            </CardBody>
          ) : (
            <div className="p-0 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Pair", "Bot", "Lock Until", "Reason", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {locks.map((lock, i) => (
                    <tr key={`${lock._botId}-${lock.id}-${i}`} className="hover:bg-bg-3 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-text-0">{lock.pair}</td>
                      <td className="px-4 py-3 text-xs text-text-2">{lock._botName}</td>
                      <td className="px-4 py-3 text-[11px] text-text-2 font-mono whitespace-nowrap">{lock.lock_end_time}</td>
                      <td className="px-4 py-3 text-xs text-text-2 max-w-[180px] truncate">{lock.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${lock.active ? "bg-red-bg text-red" : "bg-bg-3 text-text-3"}`}>
                          {lock.active ? "Active" : "Expired"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lock.active && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLock(lock)}
                            className="text-[10px] text-red hover:text-red cursor-pointer font-medium hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* PORTFOLIO EXPOSURE */}
        <Card>
          <CardHeader
            title="Portfolio Exposure (Cross-Bot)"
            icon="💰"
            action={<span className="text-xs text-text-3">Aggregated from all bots</span>}
          />
          <CardBody>
            {loading ? (
              <SkeletonCard lines={5} />
            ) : portfolio ? (
              <>
                <div className="flex items-baseline gap-2 mb-4">
                  <div className="text-[28px] font-bold text-text-0 tracking-tight">
                    ${portfolio.total_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-text-3">
                    Total across {portfolio.bot_count} bot{portfolio.bot_count !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {Object.entries(portfolio.bots).map(([botName, bal]) => {
                    const pct = portfolio.total_value > 0
                      ? (bal.total / portfolio.total_value) * 100
                      : 0;
                    return (
                      <div key={botName} className="flex items-center gap-3">
                        <div className="text-xs font-semibold min-w-[120px] text-text-0 truncate">{botName}</div>
                        <div className="flex-1 h-4 bg-bg-3 rounded overflow-hidden relative">
                          <div
                            className="h-full rounded bg-gradient-to-r from-accent to-accent/60"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-semibold min-w-[80px] text-right text-text-0">
                          ${bal.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] min-w-[40px] text-right text-text-3">
                          {pct.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-sm text-text-3">
                Portfolio data unavailable
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ════ RISK EVENTS LOG ════ */}
      <Card>
        <CardHeader
          title="Risk Events Log (Immutable Audit Trail)"
          icon="📋"
          action={
            <span className="text-xs text-text-3">
              {riskEvents.length} events total
            </span>
          }
        />
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : riskEvents.length === 0 ? (
          <CardBody>
            <div className="py-6 text-center text-sm text-text-3">No risk events recorded</div>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Timestamp", "Bot ID", "Kill Type", "Trigger", "Reason", "Triggered By"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riskEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-bg-3 transition-colors">
                    <td className="px-4 py-3 text-[11px] font-mono text-text-2 whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-2">
                      {ev.bot_instance_id != null ? `Bot ${ev.bot_instance_id}` : "ALL"}
                    </td>
                    <td className="px-4 py-3">
                      <KillTypeBadge type={ev.kill_type} />
                    </td>
                    <td className="px-4 py-3">
                      <TriggerBadge trigger={ev.trigger} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-2 max-w-[240px] truncate">
                      {ev.reason ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-2">{ev.triggered_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ════ Modal: SOFT KILL confirm ════ */}
      {showSoftKillConfirm && (
        <div
          role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSoftKillConfirm(false); }}
        >
          <div className="bg-bg-2 border border-amber/30 rounded-card p-8 max-w-md w-full mx-4 text-center">
            <div className="text-5xl mb-4">⏸️</div>
            <h2 className="text-lg font-bold text-text-0 mb-2">Soft Kill All Bots</h2>
            <p className="text-sm text-text-2 mb-6">
              This will stop all bots from entering new trades.<br />
              <strong className="text-amber">Open positions will remain untouched.</strong>
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowSoftKillConfirm(false)}
                className="flex-1 bg-bg-3 border border-border rounded-btn py-2.5 text-sm font-medium text-text-1 hover:border-border-hover transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleSoftKillAll} disabled={killing}
                className="flex-1 bg-amber border border-amber rounded-btn py-2.5 text-sm font-bold text-black hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer">
                {killing ? "Stopping..." : "SOFT KILL ALL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ Modal: HARD KILL confirm ════ */}
      {showHardKillConfirm && (
        <div
          role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHardKillConfirm(false); }}
        >
          <div className="bg-bg-2 border border-red/30 rounded-card p-8 max-w-md w-full mx-4 text-center">
            <div className="text-5xl mb-4">🛑</div>
            <h2 className="text-lg font-bold text-text-0 mb-2">Emergency Close All</h2>
            <p className="text-sm text-text-2 mb-2">
              This will force-exit{" "}
              <strong className="text-red">ALL positions at MARKET price</strong>{" "}
              and stop ALL bots.
            </p>
            <p className="text-xs text-text-3 mb-6">
              This action is immutably logged and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowHardKillConfirm(false)}
                className="flex-1 bg-bg-3 border border-border rounded-btn py-2.5 text-sm font-medium text-text-1 hover:border-border-hover transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleHardKillAll} disabled={killing}
                className="flex-1 bg-red border border-red rounded-btn py-2.5 text-sm font-bold text-white hover:bg-red-dim transition-colors disabled:opacity-50 cursor-pointer">
                {killing ? "Killing..." : "EMERGENCY CLOSE ALL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ CROSS-BOT CORRELATION MATRIX ════ */}
      {correlationData && correlationData.botNames.length >= 2 && (
        <Card className="mt-6">
          <CardHeader
            title="Cross-Bot Pair Overlap"
            icon="🔗"
            action={<span className="text-xs text-text-3">Shared pairs between bots</span>}
          />
          <div className="p-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border" />
                  {correlationData.botNames.map((name) => (
                    <th key={name} className="text-center px-4 py-3 text-[10px] font-semibold text-text-3 uppercase tracking-wider border-b border-border whitespace-nowrap">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlationData.botNames.map((rowName, i) => (
                  <tr key={rowName} className="hover:bg-bg-3 transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold text-text-0 whitespace-nowrap border-r border-border">{rowName}</td>
                    {correlationData.botNames.map((colName, j) => {
                      const val = correlationData.matrix[i][j];
                      const isDiag = i === j;
                      const overlaps = !isDiag ? (correlationData.pairOverlaps[rowName]?.[colName] ?? []) : [];
                      return (
                        <td
                          key={colName}
                          className={`text-center px-4 py-3 text-xs font-semibold ${
                            isDiag
                              ? "text-text-3 bg-bg-2"
                              : val > 0
                              ? "text-amber"
                              : "text-text-3"
                          }`}
                          title={isDiag ? `${val} unique pairs` : overlaps.length > 0 ? `Overlapping: ${overlaps.join(", ")}` : "No overlap"}
                        >
                          {isDiag ? (
                            <span className="text-text-3">{val} pairs</span>
                          ) : val > 0 ? (
                            <span className="bg-amber-bg border border-amber/20 rounded px-2 py-0.5">
                              {val} overlap
                            </span>
                          ) : (
                            <span className="text-text-3">0</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ════ Modal: Lock Pair Dialog ════ */}
      {showLockDialog && (
        <div
          role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLockDialog(false); }}
        >
          <div className="bg-bg-2 border border-border rounded-card p-6 max-w-md w-full mx-4">
            <h2 className="text-base font-bold text-text-0 mb-4 flex items-center gap-2">
              <span>🔐</span> Lock Pair
            </h2>
            <div className="flex flex-col gap-4">
              {/* Bot selector */}
              <div>
                <Tooltip content={"Bot instance to apply the pair lock to"} configKey="bot_id">
                  <label className="text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1 block">Bot</label>
                </Tooltip>
                <select
                  value={lockBotId}
                  onChange={(e) => handleLockBotChange(e.target.value)}
                  className="w-full bg-bg-1 border border-border rounded-btn px-3 py-2 text-xs text-text-1 outline-none focus:border-accent cursor-pointer font-inherit"
                >
                  <option value="">Select bot...</option>
                  {bots.filter((b) => b.status === "running").map((bot) => (
                    <option key={bot.id} value={bot.id}>{bot.name}</option>
                  ))}
                </select>
              </div>
              {/* Pair selector */}
              <div>
                <Tooltip content={"Trading pair to lock. Locked pairs will not be traded until the lock expires."} configKey="pair">
                  <label className="text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1 block">Pair</label>
                </Tooltip>
                <select
                  value={lockPair}
                  onChange={(e) => setLockPair(e.target.value)}
                  className="w-full bg-bg-1 border border-border rounded-btn px-3 py-2 text-xs text-text-1 outline-none focus:border-accent cursor-pointer font-inherit"
                >
                  <option value="">Select pair...</option>
                  {whitelist.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {/* Duration */}
              <div>
                <Tooltip content={"How long to lock this pair, in minutes. The pair will be automatically unlocked after this duration."} configKey="duration">
                  <label className="text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1 block">Duration (minutes)</label>
                </Tooltip>
                <input
                  type="number"
                  min={1}
                  value={lockDuration}
                  onChange={(e) => setLockDuration(e.target.value)}
                  className="w-full bg-bg-1 border border-border rounded-btn px-3 py-2 text-xs text-text-1 outline-none focus:border-accent font-inherit"
                  placeholder="60"
                />
              </div>
              {/* Reason */}
              <div>
                <Tooltip content={"Optional reason for locking this pair. Recorded in the lock log for auditing."} configKey="reason">
                  <label className="text-[10px] font-semibold text-text-3 uppercase tracking-wider mb-1 block">Reason (optional)</label>
                </Tooltip>
                <input
                  type="text"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  className="w-full bg-bg-1 border border-border rounded-btn px-3 py-2 text-xs text-text-1 outline-none focus:border-accent font-inherit"
                  placeholder="Manual lock from Risk page"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLockDialog(false)}
                className="flex-1 bg-bg-3 border border-border rounded-btn py-2.5 text-sm font-medium text-text-1 hover:border-border-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitLock}
                disabled={lockSubmitting || !lockBotId || !lockPair}
                className="flex-1 bg-accent border border-accent rounded-btn py-2.5 text-sm font-bold text-white hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {lockSubmitting ? "Locking..." : "Lock Pair"}
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
