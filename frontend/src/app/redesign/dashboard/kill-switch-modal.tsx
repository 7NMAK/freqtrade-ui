"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/useApi";
import { getBots, softKillAll, hardKillAll, hardKill } from "@/lib/api";

/* ══════════════════════════════════════
   KILL SWITCH MODAL (Client Component)
   Audit: 3 buttons (Cancel, Soft Kill, Hard Kill ALL)
   + per-bot kill option
   + confirmation steps
   + success messages
   + click-outside-to-close
   ══════════════════════════════════════ */

type KillView = "main" | "confirm-soft" | "confirm-hard" | "success-soft" | "success-hard" | "per-bot";

interface KillSwitchModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function KillSwitchModal({ open: controlledOpen, onOpenChange }: KillSwitchModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [view, setView] = useState<KillView>("main");
  const [killedBots, setKilledBots] = useState<Set<string>>(new Set());
  
  const { data: bots } = useApi(getBots);
  const activeBots = bots || [];

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  function handleOpenChange(newOpen: boolean) {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    if (!newOpen) {
      setView("main");
    }
  }

  function handleSoftKill() {
    setView("confirm-soft");
  }

  async function confirmSoftKill() {
    try {
      await softKillAll("Dashboard Soft Kill");
      setView("success-soft");
    } catch (err) {
      console.error("Soft kill failed", err);
    }
  }

  function handleHardKill() {
    setView("confirm-hard");
  }

  async function confirmHardKill() {
    try {
      await hardKillAll("Dashboard Hard Kill");
      const allBotNames = new Set<string>(activeBots.map((b) => b.name));
      setKilledBots(allBotNames);
      setView("success-hard");
    } catch (err) {
      console.error("Hard kill failed", err);
    }
  }

  async function handlePerBotKill(botId: number, botName: string) {
    try {
      await hardKill(botId, "Dashboard Per-Bot Kill");
      setKilledBots((prev) => {
        const next = new Set<string>();
        prev.forEach(v => next.add(v));
        next.add(botName);
        return next;
      });
    } catch (err) {
      console.error(`Kill failed for ${botName}`, err);
    }
  }

  function resetAndClose() {
    handleOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        {/* Main view */}
        {view === "main" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2 tracking-tight">
                🚨 Kill Switch
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                Select an action. <strong className="text-amber-500">Soft Kill</strong> stops trading on all bots — existing positions remain open.{" "}
                <strong className="text-rose-500">Hard Kill</strong> force-exits ALL positions on ALL bots at MARKET immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              <button
                onClick={() => setView("per-bot")}
                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
              >
                Or kill individual bots →
              </button>
            </div>
            <DialogFooter className="flex gap-3 mt-4 sm:justify-between">
              <Button
                variant="outline"
                onClick={resetAndClose}
                className="flex-1 uppercase text-[10px] tracking-wider font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSoftKill}
                className="flex-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 uppercase text-[10px] tracking-wider font-bold shadow-none"
              >
                ⚠️ Soft Kill (Stop)
              </Button>
              <Button
                onClick={handleHardKill}
                className="flex-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 uppercase text-[10px] tracking-wider font-extrabold shadow-none"
              >
                🛑 HARD KILL ALL
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Soft Kill confirmation */}
        {view === "confirm-soft" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-amber-500 flex items-center gap-2 tracking-tight">
                ⚠️ Confirm Soft Kill
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                This will send <strong className="text-foreground">POST /api/v1/stop</strong> to all {activeBots.length} bots.
                New trade entries will be blocked. Existing open positions will remain open and continue to be managed by FreqTrade (stoploss, take profit, etc.).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 mt-4 sm:justify-between">
              <Button variant="outline" onClick={() => setView("main")} className="flex-1 uppercase text-[10px] tracking-wider font-bold">
                ← Back
              </Button>
              <Button
                onClick={confirmSoftKill}
                className="flex-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 font-bold uppercase text-[10px] tracking-wider shadow-none"
              >
                Confirm Soft Kill
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Hard Kill confirmation */}
        {view === "confirm-hard" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-rose-500 flex items-center gap-2 tracking-tight">
                🛑 WARNING: Hard Kill
              </DialogTitle>
              <DialogDescription className="text-sm mt-2 space-y-2">
                <span className="block text-rose-500 font-bold">This action is IRREVERSIBLE.</span>
                <span className="block text-muted-foreground">
                  This will send <strong className="text-foreground">POST /api/v1/forceexit</strong> for ALL open positions on ALL {activeBots.length} bots,
                  closing them at <strong className="text-foreground">MARKET price</strong> immediately. Then all bots will be stopped.
                </span>
                <span className="block text-rose-500/80 text-xs font-semibold">
                  Slippage may occur. Recovery requires manual restart.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 mt-4 sm:justify-between">
              <Button variant="outline" onClick={() => setView("main")} className="flex-1 uppercase text-[10px] tracking-wider font-bold">
                ← Back
              </Button>
              <Button
                onClick={confirmHardKill}
                className="flex-1 bg-rose-500 text-white hover:bg-rose-500/90 font-extrabold uppercase text-[10px] tracking-wider"
              >
                🛑 CONFIRM HARD KILL
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Soft Kill success */}
        {view === "success-soft" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-emerald-500 flex items-center gap-2 tracking-tight">
                ✅ Soft Kill Executed
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                All {activeBots.length} bots have been stopped. No new trades will be opened.
                Existing positions remain open and will continue to be managed by each bot&apos;s stoploss and exit logic.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button onClick={resetAndClose} className="w-full uppercase text-[10px] tracking-wider font-bold">
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Hard Kill success */}
        {view === "success-hard" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-emerald-500 flex items-center gap-2 tracking-tight">
                ✅ Hard Kill Executed
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                All positions have been force-exited at MARKET. All {activeBots.length} bots have been stopped.
                Manual restart is required to resume trading.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button onClick={resetAndClose} className="w-full uppercase text-[10px] tracking-wider font-bold">
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Per-bot kill view */}
        {view === "per-bot" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
                🎯 Per-Bot Kill Switch
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                Kill individual bots. Each kill will force-exit all positions for that bot at MARKET and stop it.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
              {activeBots.length === 0 && <div className="text-xs text-muted-foreground text-center">No active bots to kill.</div>}
              {activeBots.map((bot) => {
                const isKilled = killedBots.has(bot.name);
                const isLive = !bot.is_dry_run;
                return (
                  <div
                    key={bot.id}
                    className={`flex items-center justify-between py-3 px-4 rounded-[10px] border transition-colors ${
                      isKilled
                        ? "border-rose-500/30 bg-rose-500/5"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isKilled
                            ? "bg-rose-500"
                            : isLive
                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                            : "bg-amber-500"
                        }`}
                      />
                      <div>
                        <span className="text-sm font-bold text-foreground">{bot.name}</span>
                        <span className={`ml-2 text-[10px] uppercase font-bold tracking-wider ${
                          isKilled
                            ? "text-rose-500"
                            : isLive
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }`}>
                          {isKilled ? "KILLED" : (isLive ? "LIVE" : "PAPER")}
                        </span>
                      </div>
                    </div>
                    {!isKilled ? (
                      <button
                        onClick={() => handlePerBotKill(bot.id, bot.name)}
                        className="text-[10px] uppercase font-bold tracking-wider text-rose-500 hover:text-rose-400 transition-colors px-3 py-1.5 rounded-md border border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/10 shadow-sm shadow-black/20"
                      >
                        KILL
                      </button>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500">Stopped</span>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter className="flex gap-3 mt-4 sm:justify-between">
              <Button variant="outline" onClick={() => setView("main")} className="flex-1 uppercase text-[10px] tracking-wider font-bold">
                ← Back
              </Button>
              <Button onClick={resetAndClose} className="flex-1 uppercase text-[10px] tracking-wider font-bold">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
