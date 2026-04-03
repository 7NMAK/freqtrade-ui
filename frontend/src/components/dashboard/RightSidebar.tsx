"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { fmt, fmtMoney } from "@/lib/format";
import { getSystemLogs, getBotActivityLogs, getErrorLogs } from "@/lib/api";
import { REFRESH_INTERVALS } from "@/lib/constants";
import type {
  FTBalance,
  FTSysinfo,
  FTLogsResponse,
  FTProfit,
  FTHealth,
  ActivityLog,
  LogLevel,
  Bot,
} from "@/types";

// ── Level badge colors (from LogViewer) ──────────────────────────────

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  error: "bg-down/10 text-down border-down/20",
  critical: "bg-down/10 text-down border-down/40 font-bold",
};

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded border uppercase tracking-wider ${LEVEL_STYLES[level] || LEVEL_STYLES.info}`}
    >
      {level}
    </span>
  );
}

// ── Detail expander (from LogViewer) ─────────────────────────────────

function LogDetails({ details }: { details: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!details) return null;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(details);
  } catch {
    /* non-blocking — details is plain text, not JSON */
  }

  const rawDiag = parsed?.diagnosis;
  const diagnosis = typeof rawDiag === "string" ? rawDiag : undefined;
  const rest = parsed
    ? Object.fromEntries(Object.entries(parsed).filter(([k]) => k !== "diagnosis"))
    : null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-muted hover:text-muted underline"
      >
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <div className="mt-1 text-xs text-muted bg-white/5 rounded p-2 border border-white/10">
          {diagnosis && (
            <div className="mb-2 p-2 bg-down/10 border border-down/20 rounded text-down">
              <span className="font-semibold text-down">Diagnosis: </span>
              {diagnosis}
            </div>
          )}
          {rest && Object.keys(rest).length > 0 && (
            <pre className="whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(rest, null, 2)}
            </pre>
          )}
          {!parsed && <span>{details}</span>}
        </div>
      )}
    </div>
  );
}

// ── Time formatter (from LogViewer) ──────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── FT Log Entry (Panel 4 — Terminal StdOut) ─────────────────────────

function LogEntry({ log }: { log: string[] }) {
  // FT logs format: [id, timestamp, module, level, message] (5 elements)
  // or [timestamp, module, level, message] (4 elements)
  let timestamp: string, level: string, message: string;
  if (log.length >= 5) {
    [, timestamp, , level, message] = log;
  } else if (log.length === 4) {
    [timestamp, , level, message] = log;
  } else {
    // Fallback: show raw content
    timestamp = "";
    level = "";
    message = log.join(" ");
  }
  const timeStr = timestamp ? String(timestamp).split(" ").pop()?.slice(0, 8) ?? "" : "";
  const levelColor =
    level === "WARNING" || level === "WARN"
      ? "text-yellow-500 font-medium"
      : level === "ERROR" || level === "CRITICAL"
        ? "text-[#ef4444] font-bold"
        : level === "INFO"
          ? "text-blue-400 font-medium"
          : "text-[#9CA3AF]";

  // Detect trade actions in messages
  const msgColor =
    (message ?? "").includes("Buy") || (message ?? "").includes("LONG")
      ? "text-[#22c55e] font-bold"
      : (message ?? "").includes("Sell") || (message ?? "").includes("SHORT")
        ? "text-[#ef4444] font-bold"
        : (message ?? "").includes("Fill") || (message ?? "").includes("FILL")
          ? "text-[#22c55e] font-bold"
          : (message ?? "").includes("HTTP")
            ? "text-yellow-500 font-medium"
            : "";

  return (
    <div className="mb-2">
      <span className="text-white/35 pr-2">{timeStr}</span>
      <span className={levelColor}>{level}</span>{" "}
      <span className={msgColor || ""}>{message ?? ""}</span>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────

interface RightSidebarProps {
  isOpen: boolean;
  balanceData: FTBalance | null;
  sysinfoData: FTSysinfo | null;
  logsData: FTLogsResponse | null;
  /** Aggregated profit from all bots to compute fees */
  aggregatedProfit: Partial<FTProfit> | null;
  /** Total fees paid across all bots */
  totalFees: number | null;
  /** Total funding fees across all bots */
  fundingFees: number | null;
  /** Average entry fee % */
  feeOpenAvg?: number | null;
  /** Average exit fee % */
  feeCloseAvg?: number | null;
  /** Health data from FT API */
  healthData?: FTHealth | null;
  /** Exchange name from bot config */
  exchangeName?: string;
  loading: boolean;
  /** Bots for activity-log filtering (from LogViewer) */
  bots?: Bot[];
  /** Default bot ID for activity logs */
  defaultBotId?: number;
}

// ── Main Component ──────────────────────────────────────────────────

export default function RightSidebar({
  isOpen,
  balanceData,
  sysinfoData,
  logsData,
  aggregatedProfit,
  totalFees,
  fundingFees,
  feeOpenAvg,
  feeCloseAvg,
  healthData,
  exchangeName,
  loading,
  bots = [],
  defaultBotId,
}: RightSidebarProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  // ── FT StdOut auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData]);

  // ── Activity logs from orchestrator ─────────────────────────────────
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [logTab, setLogTab] = useState<"system" | "bot" | "errors">("system");
  const [levelFilter, _setLevelFilter] = useState<string>("");
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(defaultBotId);
  const [actionFilter, _setActionFilter] = useState("");
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActivityLogs = useCallback(async () => {
    setActivityLoading(true);
    try {
      if (logTab === "errors") {
        const data = await getErrorLogs({
          bot_id: selectedBotId,
          limit: 100,
        });
        setActivityLogs(data.logs);
        setActivityTotal(data.total);
      } else if (logTab === "bot" && selectedBotId) {
        const data = await getBotActivityLogs(selectedBotId, {
          level: levelFilter || undefined,
          limit: 100,
        });
        setActivityLogs(data.logs);
        setActivityTotal(data.total);
      } else {
        const data = await getSystemLogs({
          level: levelFilter || undefined,
          bot_id: logTab === "bot" ? selectedBotId : undefined,
          action: actionFilter || undefined,
          limit: 100,
        });
        setActivityLogs(data.logs);
        setActivityTotal(data.total);
      }
    } catch {
      /* non-blocking — activity log fetch failed, viewer renders with cached data */
    } finally {
      setActivityLoading(false);
    }
  }, [logTab, levelFilter, selectedBotId, actionFilter]);

  // Auto-refresh activity logs every 10s when sidebar is open
  useEffect(() => {
    if (!isOpen) return;
    fetchActivityLogs();
    refreshInterval.current = setInterval(fetchActivityLogs, REFRESH_INTERVALS.DASHBOARD);
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [isOpen, fetchActivityLogs]);

  // Switch to bot tab when defaultBotId changes
  useEffect(() => {
    if (defaultBotId) {
      setSelectedBotId(defaultBotId);
      setLogTab("bot");
    }
  }, [defaultBotId]);

  // ── Derived values ─────────────────────────────────────────────────
  const cpuPct = sysinfoData
    ? sysinfoData.cpu_pct.length > 0
      ? Math.round(sysinfoData.cpu_pct.reduce((a, b) => a + b, 0) / sysinfoData.cpu_pct.length)
      : 0
    : null;
  const ramPct = sysinfoData ? Math.round(sysinfoData.ram_pct) : null;

  const grossProfit = aggregatedProfit?.profit_closed_coin ?? null;
  const feeRatio =
    totalFees != null && grossProfit != null && grossProfit !== 0
      ? Math.abs(totalFees / grossProfit) * 100
      : null;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div
      className={`flex flex-col gap-4 shrink-0 min-h-0 2xl:w-[320px] xl:w-[260px] xl:min-w-[260px] ${
        isOpen
          ? "w-[320px] min-w-[320px] opacity-100 overflow-y-auto"
          : "w-0 min-w-0 opacity-0 overflow-hidden p-0"
      }`}
      style={{
        transition: "width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease, padding 0.3s ease",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.14) transparent",
      }}
    >
      {/* ── Panel 1: Balance Breakdown ──────────────────────────────── */}
      <div className="bg-surface l-bd rounded-md shadow-xl overflow-hidden shrink-0">
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">Balance</span>
        </div>
        <div className="p-4 font-mono text-[12px] space-y-2.5">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`bs-${i}`} className="h-4 bg-white/10 rounded w-full" />
              ))}
            </div>
          ) : !balanceData || balanceData.currencies.length === 0 ? (
            <div className="text-muted text-center py-4">No balance data</div>
          ) : (
            <>
              {balanceData.currencies
                .filter((c) => c.balance > 0 || c.used > 0 || c.est_stake > 0 || c.free > 0)
                .slice(0, 8)
                .map((c) => (
                  <div key={c.currency} className="flex items-center">
                    <span className="text-muted w-10">{c.currency}</span>
                    <span className="text-white font-medium">
                      {fmt(c.balance, c.balance < 1 ? 4 : 2)}
                    </span>
                    {c.est_stake > 0 && c.currency !== balanceData.stake && (
                      <span className="text-white/30 text-[10px] ml-auto">
                        ≈ ${fmt(c.est_stake, 0)}
                      </span>
                    )}
                    {c.currency === balanceData.stake && (
                      <span className="text-muted text-[10px] ml-auto">free</span>
                    )}
                  </div>
                ))}
              {balanceData.starting_capital != null && (
                <div className="pt-2 flex justify-between">
                  <span className="text-white/50 text-[11px] uppercase font-sans font-medium">
                    Starting Capital
                  </span>
                  <span className="text-white font-medium">
                    ${fmt(balanceData.starting_capital, 2)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Panel 2: Fees & Costs ───────────────────────────────────── */}
      <div className="bg-surface l-bd rounded-md shadow-xl overflow-hidden shrink-0">
        <div className="h-10 l-b flex items-center px-4 bg-black/40 shrink-0">
          <span className="section-title">Fees &amp; Costs</span>
        </div>
        <div className="p-4 font-mono text-[12px] space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted">Total Fees Paid</span>
            <span className="text-down font-bold">
              {totalFees != null ? fmtMoney(-Math.abs(totalFees)) : "\u2014"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted">Entry Fees (avg)</span>
            <span className="text-white/70">{feeOpenAvg != null ? `${feeOpenAvg}%` : "\u2014"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted">Exit Fees (avg)</span>
            <span className="text-white/70">
              {feeCloseAvg != null ? `${feeCloseAvg}%` : "\u2014"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted">Funding Fees</span>
            <span className={fundingFees != null ? "text-down" : "text-white/70"}>
              {fundingFees != null ? fmtMoney(-Math.abs(fundingFees)) : "\u2014"}
            </span>
          </div>
          <div className="pt-2.5 flex justify-between items-center">
            <span className="text-muted">Fees / Gross Profit</span>
            <span className="text-yellow-400 font-bold">
              {feeRatio != null ? `${fmt(feeRatio, 1)}%` : "\u2014"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted">Net vs Gross</span>
            <span className="text-white/70">
              {grossProfit != null && totalFees != null
                ? `${fmtMoney(grossProfit - Math.abs(totalFees))} / ${fmtMoney(grossProfit)}`
                : "\u2014"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Panel 3: Node Telemetry ─────────────────────────────────── */}
      <div className="bg-surface l-bd rounded-md p-4 flex flex-col gap-4 shadow-xl shrink-0">
        <span className="section-title">Node Telemetry</span>
        {loading || !sysinfoData ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-white/10 rounded w-full" />
            <div className="h-4 bg-white/10 rounded w-full" />
          </div>
        ) : (
          <>
            {/* CPU bar */}
            <div>
              <div className="flex justify-between text-[12px] font-mono mb-1.5">
                <span className="text-muted">CPU</span>
                <span className="text-white font-medium">{cpuPct}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/70 rounded-full"
                  style={{ width: `${cpuPct}%` }}
                />
              </div>
            </div>
            {/* RAM bar */}
            <div>
              <div className="flex justify-between text-[12px] font-mono mb-1.5">
                <span className="text-muted">RAM</span>
                <span className="text-yellow-400 font-medium">{ramPct}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full"
                  style={{ width: `${ramPct}%` }}
                />
              </div>
            </div>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-muted">{exchangeName || "Exchange"}</span>
                <span
                  className={
                    healthData?.last_process
                      ? "text-up"
                      : loading
                        ? "text-muted animate-pulse"
                        : "text-muted"
                  }
                >
                  {healthData?.last_process
                    ? (() => {
                        const diff =
                          (Date.now() - new Date(healthData.last_process).getTime()) / 1000;
                        return isNaN(diff) ? "N/A" : `${diff.toFixed(1)}s`;
                      })()
                    : loading
                      ? "..."
                      : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">FT Process</span>
                <span className="text-white/70">
                  {healthData?.last_process
                    ? (() => {
                        const diff =
                          (Date.now() - new Date(healthData.last_process).getTime()) / 1000;
                        return isNaN(diff) ? healthData.last_process : `${diff.toFixed(1)}s ago`;
                      })()
                    : "\u2014"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Uptime</span>
                <span className="text-white/70">
                  {(() => {
                    if (!healthData?.last_process) return "—";
                    const firstSeen = new Date(healthData.last_process).getTime();
                    if (isNaN(firstSeen)) return "—";
                    const uptimeMs = Date.now() - firstSeen;
                    const days = Math.floor(uptimeMs / 86400000);
                    const hours = Math.floor((uptimeMs % 86400000) / 3600000);
                    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                  })()}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Panel 4: Terminal StdOut ─────────────────────────────────── */}
      <div className="bg-black l-bd rounded-md flex flex-col shadow-xl overflow-hidden p-3 font-mono text-[11px] leading-relaxed text-muted shrink-0 h-[320px]">
        <div className="flex justify-between items-center mb-3 px-1">
          <span className="section-title text-white/50">Terminal StdOut</span>
          <span className="flex items-center gap-1.5 text-green-400 text-[11px]">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Streaming
          </span>
        </div>
        <div className="flex-1 overflow-y-auto l-bd rounded p-3 bg-black">
          {!logsData || logsData.logs.length === 0 ? (
            <div className="text-muted text-center py-4">No log entries</div>
          ) : (
            <>
              {logsData.logs.slice(-50).map((log, i) => (
                <LogEntry key={`log-${i}`} log={log as string[]} />
              ))}
              <div ref={logEndRef} />
            </>
          )}
        </div>
      </div>

      {/* ── Panel 5: Activity Log ──────────────────────────────────────── */}
      <div className="bg-surface l-bd rounded-md flex flex-col shadow-xl overflow-hidden shrink-0">
        <div className="h-10 l-b flex items-center justify-between px-4 bg-black/40 shrink-0">
          <span className="section-title">Activity Log</span>
          <span className="text-[10px] text-muted font-mono">{activityTotal} entries</span>
        </div>
        <div className="flex gap-0 px-3 pt-2 pb-1">
          {(["system", "bot", "errors"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setLogTab(t)}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded transition-colors cursor-pointer ${
                logTab === t ? "bg-white/10 text-white" : "text-muted hover:text-white"
              }`}
            >
              {t === "system" ? "System" : t === "bot" ? "Bot" : "Errors"}
            </button>
          ))}
          {logTab === "bot" && (
            <select
              value={selectedBotId ?? ""}
              onChange={(e) => setSelectedBotId(e.target.value ? Number(e.target.value) : undefined)}
              className="ml-auto text-[10px] bg-black/40 text-muted border border-white/10 rounded px-1.5 py-0.5"
            >
              <option value="">All bots</option>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 max-h-[250px] font-mono text-[11px] leading-relaxed">
          {activityLoading && activityLogs.length === 0 ? (
            <div className="text-muted text-center py-4 animate-pulse">Loading...</div>
          ) : activityLogs.length === 0 ? (
            <div className="text-muted text-center py-4">No log entries</div>
          ) : (
            activityLogs.slice(0, 30).map((log) => (
              <div key={log.id} className={`py-1.5 l-b flex gap-2 items-start ${log.level === "error" || log.level === "critical" ? "text-down" : ""}`}>
                <span className="text-white/35 shrink-0 w-14">{fmtTime(log.created_at)}</span>
                <span className={`shrink-0 w-12 text-[9px] font-bold uppercase ${
                  log.level === "error" || log.level === "critical" ? "text-down" :
                  log.level === "warning" ? "text-yellow-400" : "text-white/40"
                }`}>{log.level}</span>
                <span className="text-white/60 truncate">{log.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Re-export LogViewer sub-components for external use if needed ────
export { LevelBadge, LogDetails, fmtTime };
export type { RightSidebarProps };
