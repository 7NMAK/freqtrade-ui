"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Zap, Bell, Search } from "lucide-react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import { getRiskEvents, hardKillAll, softKillAll, logout } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { RiskEvent } from "@/types";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const toast = useToast();
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [killType, setKillType] = useState<"soft" | "hard">("hard");
  const [killing, setKilling] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [hasRecentEvents, setHasRecentEvents] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const events = await getRiskEvents();
        setRiskEvents(events.slice(0, 10));
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const recent = events.some(
          (e) => new Date(e.created_at).getTime() > oneHourAgo
        );
        setHasRecentEvents(recent);
      } catch { /* non-blocking */ }
    }
    loadEvents();
    const interval = setInterval(loadEvents, REFRESH_INTERVALS.HEADER_NOTIFICATIONS);
    return () => clearInterval(interval);
  }, []);

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

  async function handleSoftKillAll() {
    setKilling(true);
    const loadingId = toast.loading("Executing soft kill...");
    try {
      await softKillAll("Soft kill from header");
      toast.dismiss(loadingId);
      toast.success("All bots stopped. Positions remain open.");
      setShowKillConfirm(false);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(
        err instanceof Error
          ? `Soft kill failed: ${err.message}`
          : "Soft kill failed -- check orchestrator connection.",
        { action: { label: "RETRY", onClick: handleSoftKillAll } }
      );
    } finally {
      setKilling(false);
    }
  }

  async function handleHardKillAll() {
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
          : "Kill switch failed -- check orchestrator connection.",
        { action: { label: "RETRY", onClick: handleHardKillAll } }
      );
    } finally {
      setKilling(false);
    }
  }

  function handleLogout() {
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
    } catch {
      return ts;
    }
  }

  return (
    <>
      <header className="h-14 bg-[#0C0C0C] border-b border-white/[0.10] flex items-center px-5 gap-4 shrink-0 relative">
        {/* Page Title */}
        <h1 className="text-[13px] uppercase tracking-widest text-white font-semibold whitespace-nowrap">
          {title}
        </h1>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Global fuzzy search... (Bots, Pairs, Configs Cmd+K)"
            className="w-96 h-9 bg-black border border-white/[0.10] rounded-lg pl-9 pr-4 text-[12px] font-mono text-white placeholder-[#9CA3AF] outline-none focus:border-white/[0.22] transition-colors"
          />
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Soft Kill All */}
          <button
            type="button"
            disabled={killing}
            onClick={() => { if (killing) return; setKillType("soft"); setShowKillConfirm(true); }}
            className="border border-yellow-500/30 text-yellow-400 text-[11px] font-bold uppercase rounded-md px-3 py-1.5 flex items-center gap-1.5 hover:bg-yellow-500/10 transition-all cursor-pointer tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Soft Kill All
          </button>

          {/* Hard Kill All */}
          <button
            type="button"
            disabled={killing}
            onClick={() => { if (killing) return; setKillType("hard"); setShowKillConfirm(true); }}
            className="bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-[11px] font-bold uppercase rounded-md px-3 py-1.5 flex items-center gap-1.5 hover:bg-[#ef4444]/20 transition-all cursor-pointer tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5" />
            Hard Kill All
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-2 text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-[18px] h-[18px]" />
              {hasRecentEvents && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ef4444]" />
              )}
            </button>

            {showNotifs && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-[#0C0C0C] border border-white/[0.10] rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.10] flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white">Recent Events</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifs(false)}
                    className="text-[#9CA3AF] hover:text-white text-xs cursor-pointer"
                  >
                    x
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {riskEvents.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[#9CA3AF]">
                      No recent events
                    </div>
                  ) : (
                    riskEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.04] cursor-pointer transition-colors"
                        onClick={() => {
                          setShowNotifs(false);
                          window.location.href = "/risk";
                        }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                              ev.kill_type === "HARD_KILL"
                                ? "bg-[#ef4444]/10 text-[#ef4444]"
                                : "bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            {ev.kill_type.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-[#9CA3AF] font-mono">
                            {formatEventTime(ev.created_at)}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9CA3AF] truncate">
                          {ev.reason ?? ev.trigger}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar */}
          <button
            type="button"
            aria-label="Logout"
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-white/10 border border-white/[0.10] flex items-center justify-center text-[12px] font-bold text-white cursor-pointer hover:bg-white/20 transition-colors ml-1"
            title="Logout"
          >
            N
          </button>
        </div>
      </header>

      {/* Kill Confirmation Modal */}
      {showKillConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={(e) => {
            // Block backdrop-close while a kill is in flight — otherwise the
            // operator could dismiss the modal mid-flight and re-trigger it.
            if (killing) return;
            if (e.target === e.currentTarget) setShowKillConfirm(false);
          }}
        >
          <div className="bg-[#0C0C0C] border border-white/[0.10] rounded-xl p-8 max-w-md w-full mx-4 text-center">
            {killType === "hard" ? (
              <Zap className="w-12 h-12 text-[#ef4444] mx-auto mb-4" />
            ) : (
              <ShieldAlert className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            )}
            <h2 className="text-lg font-bold text-white mb-2">
              {killType === "hard" ? "Emergency Hard Kill All Bots" : "Soft Kill All Bots"}
            </h2>
            <p className="text-sm text-[#9CA3AF] mb-2">
              {killType === "hard" ? (
                <>
                  This will force-exit{" "}
                  <strong className="text-[#ef4444]">ALL positions at MARKET price</strong>{" "}
                  and stop <strong className="text-[#ef4444]">ALL bots</strong>.
                </>
              ) : (
                <>
                  This will <strong className="text-yellow-400">stop ALL bots</strong>.
                  Open positions will remain until manually closed.
                </>
              )}
            </p>
            <p className="text-xs text-[#9CA3AF] mb-6">
              This action is logged in the immutable audit trail and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowKillConfirm(false)}
                className="flex-1 bg-[#1a1a1a] border border-white/[0.10] rounded-lg py-2.5 text-sm font-medium text-[#9CA3AF] hover:border-white/[0.22] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={killType === "hard" ? handleHardKillAll : handleSoftKillAll}
                disabled={killing}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 cursor-pointer ${
                  killType === "hard"
                    ? "bg-[#ef4444] border border-[#ef4444] hover:bg-[#dc2626]"
                    : "bg-yellow-600 border border-yellow-500 hover:bg-yellow-500"
                }`}
              >
                {killing ? "Killing..." : killType === "hard" ? "HARD KILL ALL BOTS" : "SOFT KILL ALL BOTS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
