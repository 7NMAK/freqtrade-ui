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
              <DialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
                🚨 Kill Switch
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                Select an action. <strong className="text-ft-amber">Soft Kill</strong> stops trading on all bots — existing positions remain open.{" "}
                <strong className="text-ft-red">Hard Kill</strong> force-exits ALL positions on ALL bots at MARKET immediately.
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
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSoftKill}
                className="flex-1 bg-ft-amber/15 text-ft-amber border border-ft-amber/30 hover:bg-ft-amber/25"
              >
                ⚠️ Soft Kill (Stop)
              </Button>
              <Button
                onClick={handleHardKill}
                className="flex-1 bg-ft-red/15 text-ft-red border border-ft-red/30 hover:bg-ft-red/25 font-extrabold"
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
              <DialogTitle className="text-lg font-extrabold text-ft-amber flex items-center gap-2">
                ⚠️ Confirm Soft Kill
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                This will send <strong className="text-foreground">POST /api/v1/stop</strong> to all {activeBots.length} bots.
                New trade entries will be blocked. Existing open positions will remain open and continue to be managed by FreqTrade (stoploss, take profit, etc.).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 mt-4 sm:justify-between">
              <Button variant="outline" onClick={() => setView("main")} className="flex-1">
                ← Back
              </Button>
              <Button
                onClick={confirmSoftKill}
                className="flex-1 bg-ft-amber/15 text-ft-amber border border-ft-amber/30 hover:bg-ft-amber/25 font-bold"
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
              <DialogTitle className="text-lg font-extrabold text-ft-red flex items-center gap-2">
                🛑 WARNING: Hard Kill
              </DialogTitle>
              <DialogDescription className="text-sm mt-2 space-y-2">
                <span className="block text-ft-red font-bold">This action is IRREVERSIBLE.</span>
                <span className="block text-muted-foreground">
                  This will send <strong className="text-foreground">POST /api/v1/forceexit</strong> for ALL open positions on ALL {activeBots.length} bots,
                  closing them at <strong className="text-foreground">MARKET price</strong> immediately. Then all bots will be stopped.
                </span>
                <span className="block text-ft-red/80 text-xs font-semibold">
                  Slippage may occur. Recovery requires manual restart.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 mt-4 sm:justify-between">
              <Button variant="outline" onClick={() => setView("main")} className="flex-1">
                ← Back
              </Button>
              <Button
                onClick={confirmHardKill}
                className="flex-1 bg-ft-red text-white hover:bg-ft-red/90 font-extrabold"
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
              <DialogTitle className="text-lg font-extrabold text-ft-green flex items-center gap-2">
                ✅ Soft Kill Executed
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                All {activeBots.length} bots have been stopped. No new trades will be opened.
                Existing positions remain open and will continue to be managed by each bot&apos;s stoploss and exit logic.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button onClick={resetAndClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Hard Kill success */}
        {view === "success-hard" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-ft-green flex items-center gap-2">
                ✅ Hard Kill Executed
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                All positions have been force-exited at MARKET. All {activeBots.length} bots have been stopped.
                Manual restart is required to resume trading.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button onClick={resetAndClose} className="w-full">
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
                    className={`flex items-center justify-between py-3 px-4 rounded-lg border ${
                      isKilled
                        ? "border-ft-red/30 bg-ft-red/5"
                        : "border-border bg-primary/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isKilled
                            ? "bg-ft-red"
                            : isLive
                            ? "bg-ft-green shadow-[0_0_6px_hsla(97,75%,33%,0.3)]"
                            : "bg-ft-amber"
                        }`}
                      />
                      <div>
                        <span className="text-sm font-bold text-foreground">{bot.name}</span>
                        <span className={`ml-2 text-2xs font-semibold ${
                          isKilled
                            ? "text-ft-red"
                            : isLive
                            ? "text-ft-green"
                            : "text-ft-amber"
                        }`}>
                          {isKilled ? "KILLED" : (isLive ? "LIVE" : "PAPER")}
                        </span>
                      </div>
                    </div>
                    {!isKilled ? (
                      <button
                        onClick={() => handlePerBotKill(bot.id, bot.name)}
                        className="text-xs font-bold text-ft-red/70 hover:text-ft-red transition-colors px-3 py-1.5 rounded border border-ft-red/20 hover:border-ft-red/40 hover:bg-ft-red/10"
                      >
                        KILL
                      </button>
                    ) : (
                      <span className="text-2xs font-bold text-ft-red">Stopped</span>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter className="flex gap-3 mt-4 sm:justify-between">
              <Button variant="outline" onClick={() => setView("main")} className="flex-1">
                ← Back
              </Button>
              <Button onClick={resetAndClose} className="flex-1">
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
