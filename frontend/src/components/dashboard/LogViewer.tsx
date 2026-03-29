"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { getSystemLogs, getBotActivityLogs, getErrorLogs } from "@/lib/api";
import { REFRESH_INTERVALS } from "@/lib/constants";
import type { ActivityLog, LogLevel, Bot } from "@/types";

// ── Level badge colors ────────────────────────────────────────────────

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "bg-accent/10 text-accent border-accent/20",
  warning: "bg-amber-bg text-amber border-amber/20",
  error: "bg-red-bg text-red border-red/20",
  critical: "bg-red-bg text-red border-red/40 font-bold",
};

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${LEVEL_STYLES[level] || LEVEL_STYLES.info}`}
    >
      {level}
    </span>
  );
}

// ── Detail expander ──────────────────────────────────────────────────

function LogDetails({ details }: { details: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!details) return null;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(details);
  } catch { /* non-blocking */
    // plain text
  }

  const rawDiag = parsed?.diagnosis;
  const diagnosis = typeof rawDiag === "string" ? rawDiag : undefined;
  const rest = parsed
    ? Object.fromEntries(Object.entries(parsed).filter(([k]) => k !== "diagnosis"))
    : null;

  return (
    <div className="mt-1">
      <button type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-text-3 hover:text-text-2 underline"
      >
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <div className="mt-1 text-xs text-text-3 bg-bg-2 rounded p-2 border border-border">
          {diagnosis && (
            <div className="mb-2 p-2 bg-red-bg border border-red/20 rounded text-red">
              <span className="font-semibold text-red">Diagnosis: </span>
              {diagnosis}
            </div>
          )}
          {rest && Object.keys(rest).length > 0 && (
            <pre className="whitespace-pre-wrap break-all text-[11px]">
              {JSON.stringify(rest, null, 2)}
            </pre>
          )}
          {!parsed && <span>{details}</span>}
        </div>
      )}
    </div>
  );
}

// ── Time formatter ──────────────────────────────────────────────────

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

// ── Main Component ──────────────────────────────────────────────────

interface LogViewerProps {
  bots: Bot[];
  defaultBotId?: number;
  collapsed?: boolean;
}

export default function LogViewer({ bots, defaultBotId, collapsed = true }: LogViewerProps) {
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [tab, setTab] = useState<"system" | "bot" | "errors">("system");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [selectedBotId, setSelectedBotId] = useState<number | undefined>(defaultBotId);
  const [actionFilter, setActionFilter] = useState("");

  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "errors") {
        const data = await getErrorLogs({
          bot_id: selectedBotId,
          limit: 100,
        });
        setLogs(data.logs);
        setTotal(data.total);
      } else if (tab === "bot" && selectedBotId) {
        const data = await getBotActivityLogs(selectedBotId, {
          level: levelFilter || undefined,
          limit: 100,
        });
        setLogs(data.logs);
        setTotal(data.total);
      } else {
        const data = await getSystemLogs({
          level: levelFilter || undefined,
          bot_id: tab === "bot" ? selectedBotId : undefined,
          action: actionFilter || undefined,
          limit: 100,
        });
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch { /* non-blocking */
      // Log fetch failed — non-critical, viewer still renders with cached data
    } finally {
      setLoading(false);
    }
  }, [tab, levelFilter, selectedBotId, actionFilter]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!isOpen) return;
    fetchLogs();
    refreshInterval.current = setInterval(fetchLogs, REFRESH_INTERVALS.DASHBOARD);
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, [isOpen, fetchLogs]);

  // Switch to bot tab when defaultBotId changes
  useEffect(() => {
    if (defaultBotId) {
      setSelectedBotId(defaultBotId);
      setTab("bot");
    }
  }, [defaultBotId]);

  return (
    <div className="border border-border rounded-lg bg-bg-1 overflow-hidden">
      {/* Header / toggle */}
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-2 hover:bg-bg-3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-1">Activity Log</span>
          <span className="text-[10px] text-text-3 bg-bg-1 px-2 py-0.5 rounded-full border border-border">
            {total} entries
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-text-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-3">
          {/* Tabs */}
          <div className="flex items-center gap-4 mb-3 border-b border-border pb-2">
            <div className="flex gap-1">
              {(["system", "bot", "errors"] as const).map((t) => (
                <button type="button"
                  key={t}
                  onClick={() => setTab(t)}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    tab === t
                      ? "bg-accent text-white"
                      : "text-text-3 hover:text-text-2 hover:bg-bg-2"
                  }`}
                >
                  {t === "system" ? "System Log" : t === "bot" ? "Bot Log" : "Errors"}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 ml-auto">
              {tab !== "errors" && (
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="text-xs bg-bg-2 text-text-2 border border-border rounded px-2 py-1"
                >
                  <option value="">All levels</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              )}

              {(tab === "bot" || tab === "errors") && (
                <select
                  value={selectedBotId ?? ""}
                  onChange={(e) =>
                    setSelectedBotId(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="text-xs bg-bg-2 text-text-2 border border-border rounded px-2 py-1"
                >
                  <option value="">All bots</option>
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}

              {tab === "system" && (
                <input
                  type="text"
                  placeholder="Filter action..."
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="text-xs bg-bg-2 text-text-2 border border-border rounded px-2 py-1 w-32"
                />
              )}

              <button type="button"
                onClick={fetchLogs}
                disabled={loading}
                className="text-xs text-text-3 hover:text-text-2 px-2 py-1 rounded border border-border hover:bg-bg-2"
              >
                {loading ? "..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Log table */}
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-2 z-10">
                <tr className="text-text-3 border-b border-border">
                  <th className="text-left px-2 py-1.5 w-28">Time</th>
                  <th className="text-left px-2 py-1.5 w-16">Level</th>
                  <th className="text-left px-2 py-1.5 w-40">Action</th>
                  <th className="text-left px-2 py-1.5 w-28">Bot</th>
                  <th className="text-left px-2 py-1.5">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-text-3 py-6">
                      {loading ? "Loading..." : "No log entries found"}
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`border-b border-border/50 hover:bg-bg-2 transition-colors ${
                      log.level === "error" || log.level === "critical"
                        ? "bg-red-bg"
                        : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 text-text-3 whitespace-nowrap">
                      {fmtTime(log.created_at)}
                    </td>
                    <td className="px-2 py-1.5">
                      <LevelBadge level={log.level} />
                    </td>
                    <td className="px-2 py-1.5 text-text-2 font-mono">{log.action}</td>
                    <td className="px-2 py-1.5 text-text-3">
                      {log.bot_name || (log.bot_id ? `#${log.bot_id}` : "\u2014")}
                    </td>
                    <td className="px-2 py-1.5 text-text-3">
                      <LogDetails details={log.details} />
                      {!log.details && log.target_name && (
                        <span className="text-text-3">{log.target_name}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {total > logs.length && (
            <div className="text-center text-[10px] text-text-3 mt-2 pt-2 border-t border-border">
              Showing {logs.length} of {total} entries
            </div>
          )}
        </div>
      )}
    </div>
  );
}
