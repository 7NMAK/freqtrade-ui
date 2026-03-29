"use client";

import { useEffect, useRef, useState } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import { getBots, getRiskEvents, hardKillAll, logout } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Bot, RiskEvent } from "@/types";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const toast = useToast();
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [killing, setKilling] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [hasRecentEvents, setHasRecentEvents] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Aggregate bot health
  const [bots, setBots] = useState<Bot[]>([]);

  // Load bots
  useEffect(() => {
    async function loadBots() {
      try {
        const botList = await getBots();
        setBots(botList);
      } catch { /* non-blocking */
        // Non-critical
      }
    }
    loadBots();
    const interval = setInterval(loadBots, REFRESH_INTERVALS.HEADER_BOTS);
    return () => clearInterval(interval);
  }, []);

  // H-3: Load recent risk events for notification bell
  useEffect(() => {
    async function loadEvents() {
      try {
        const events = await getRiskEvents();
        setRiskEvents(events.slice(0, 10));
        // Red dot if any event in last 1 hour
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const recent = events.some(
          (e) => new Date(e.created_at).getTime() > oneHourAgo
        );
        setHasRecentEvents(recent);
      } catch { /* non-blocking */
        // Non-critical — don't show error for notification load failure
      }
    }
    loadEvents();
    const interval = setInterval(loadEvents, REFRESH_INTERVALS.HEADER_NOTIFICATIONS);
    return () => clearInterval(interval);
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!showNotifs) return;
    function handleClick(e: MouseEvent) {
      if (notifRef.current && e.target instanceof Node && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showNotifs]);


  // H-5b: HARD KILL all bots
  async function handleKillAll() {
    setKilling(true);
    const loadingId = toast.loading("Executing emergency kill switch...");
    try {
      await hardKillAll("Emergency kill from header");
      toast.dismiss(loadingId);
      toast.success("All bots killed. All positions force-exited at market.");
      setShowKillConfirm(false);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(
        err instanceof Error
          ? `Kill switch failed: ${err.message}`
          : "Kill switch failed — check orchestrator connection.",
        {
          action: {
            label: "RETRY",
            onClick: handleKillAll,
          },
        }
      );
    } finally {
      setKilling(false);
    }
  }

  function handleLogout() {
    // No browser confirm() — just logout directly (token clear + redirect)
    logout();
  }

  function formatEventTime(ts: string) {
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch { /* non-blocking */
      
      return ts;
    }
  }

  // Aggregate health across all bots
  const runningBots = bots.filter((b) => b.status === "running");
  const unhealthyBots = bots.filter(
    (b) => b.status === "error" || b.status === "killed" || b.consecutive_failures >= 3
  );
  const warnBots = bots.filter(
    (b) =>
      !unhealthyBots.includes(b) &&
      (b.consecutive_failures >= 1 || !b.is_healthy) &&
      b.status === "running"
  );
  const aggregateStatus: "ok" | "warn" | "fail" | "none" =
    bots.length === 0
      ? "none"
      : unhealthyBots.length > 0
      ? "fail"
      : warnBots.length > 0
      ? "warn"
      : "ok";

  return (
    <>
      <header className="h-header bg-bg-1 border-b border-border flex items-center px-6 gap-4 shrink-0 relative">
        {/* H-1: Page Title */}
        <h1 className="text-lg font-bold text-text-0">{title}</h1>

        {/* Aggregate Bot Health */}
        {bots.length > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <div
              className={`w-2 h-2 rounded-full ${
                aggregateStatus === "ok"
                  ? "bg-green shadow-[0_0_6px_var(--color-green)] animate-pulse"
                  : aggregateStatus === "warn"
                  ? "bg-amber shadow-[0_0_6px_var(--color-amber)]"
                  : aggregateStatus === "fail"
                  ? "bg-red shadow-[0_0_6px_var(--color-red)] animate-pulse"
                  : "bg-text-3"
              }`}
            />
            <span className="text-xs text-text-2">
              <span className="text-green font-semibold">{runningBots.length}</span>
              <span className="text-text-3 mx-0.5">/</span>
              <span className="text-text-3">{bots.length} bots</span>
            </span>
            {unhealthyBots.length > 0 && (
              <span className="text-[10px] font-medium text-red">
                {unhealthyBots.length} unhealthy
              </span>
            )}
          </div>
        )}

        <div className="mr-auto" />

        {/* H-3..H-6: Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* H-3: Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative bg-bg-2 border border-border rounded-btn p-1.5 text-md text-text-2 hover:border-border-hover hover:text-text-1 transition-all cursor-pointer"
              aria-label="Notifications"
            >
              🔔
              {hasRecentEvents && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red" />
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifs && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-bg-2 border border-border rounded-card shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-0">Recent Events</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifs(false)}
                    className="text-text-3 hover:text-text-1 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {riskEvents.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-text-3">
                      No recent events
                    </div>
                  ) : (
                    riskEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="px-4 py-3 border-b border-border/40 hover:bg-bg-3 cursor-pointer transition-colors"
                        onClick={() => {
                          setShowNotifs(false);
                          window.location.href = "/risk";
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              ev.kill_type === "HARD_KILL"
                                ? "bg-red-bg text-red"
                                : "bg-amber-bg text-amber"
                            }`}
                          >
                            {ev.kill_type.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-text-3">
                            {formatEventTime(ev.created_at)}
                          </span>
                        </div>
                        <div className="text-xs text-text-1 truncate">
                          {ev.reason ?? ev.trigger}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* H-4: Kill Switch Button */}
          <button
            type="button"
            aria-label="Emergency kill switch — stop all bots"
            onClick={() => setShowKillConfirm(true)}
            className="bg-red-bg border border-red/25 rounded-btn px-3.5 py-1.5 text-xs font-semibold text-red tracking-wide flex items-center gap-1.5 hover:bg-red/[0.18] hover:border-red transition-all cursor-pointer"
          >
            <span className="text-base">🚨</span>
            KILL SWITCH
          </button>

          {/* H-6: User Avatar */}
          <button
            type="button"
            aria-label="Logout"
            onClick={handleLogout}
            className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-accent to-purple flex items-center justify-center text-sm font-bold text-white cursor-pointer ml-1 hover:opacity-90 transition-opacity"
            title="Logout"
          >
            N
          </button>
        </div>
      </header>

      {/* H-5: Kill Switch Confirmation Modal */}
      {showKillConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowKillConfirm(false);
          }}
        >
          <div className="bg-bg-2 border border-red/30 rounded-card p-8 max-w-md w-full mx-4 text-center">
            <div className="text-5xl mb-4">🚨</div>
            <h2 className="text-lg font-bold text-text-0 mb-2">
              Emergency Kill All Bots
            </h2>
            <p className="text-sm text-text-2 mb-2">
              This will force-exit{" "}
              <strong className="text-red">ALL positions at MARKET price</strong>{" "}
              and stop <strong className="text-red">ALL bots</strong>.
            </p>
            <p className="text-xs text-text-3 mb-6">
              This action is logged in the immutable audit trail and cannot be undone.
            </p>
            <div className="flex gap-3">
              {/* H-5a: Cancel */}
              <button
                type="button"
                onClick={() => setShowKillConfirm(false)}
                className="flex-1 bg-bg-3 border border-border rounded-btn py-2.5 text-sm font-medium text-text-1 hover:border-border-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {/* H-5b: Confirm */}
              <button
                type="button"
                onClick={handleKillAll}
                disabled={killing}
                className="flex-1 bg-red border border-red rounded-btn py-2.5 text-sm font-bold text-white hover:bg-red-dim transition-colors disabled:opacity-50 cursor-pointer"
              >
                {killing ? "Killing..." : "KILL ALL BOTS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
