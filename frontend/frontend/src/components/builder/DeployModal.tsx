"use client";

import React, { useEffect, useState } from "react";
import { getBots, registerBot, updateBot, drainBot, hardKill } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Bot } from "@/types";

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyId: number;
  strategyName: string;
  currentVersionId?: number;
  onSuccess?: () => void;
}

type TabType = "new-bot" | "existing-bot";
type ReplacementOption = "graceful" | "force" | "save-only";

export default function DeployModal({
  isOpen,
  onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  strategyId,
  strategyName,
  currentVersionId,
  onSuccess,
}: DeployModalProps) {
  const toast = useToast();
  const [tab, setTab] = useState<TabType>("new-bot");
  const [bots, setBots] = useState<Bot[]>([]);
  const [loadingBots, setLoadingBots] = useState(false);
  const [deploying, setDeploying] = useState(false);

  // New bot tab state
  const [botName, setBotName] = useState(`${strategyName}-bot`);
  const [exchange, setExchange] = useState("binance");
  const [pairs, setPairs] = useState("BTC/USDT:USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [dryRun, setDryRun] = useState(true);

  // Existing bot tab state
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [replacementOption, setReplacementOption] = useState<ReplacementOption>("graceful");

  useEffect(() => {
    if (!isOpen) return;
    setLoadingBots(true);
    getBots()
      .then((list) => {
        setBots(list);
        if (list.length > 0) setSelectedBotId(list[0].id);
      })
      .catch(() => toast.error("Failed to load bots."))
      .finally(() => setLoadingBots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleCreateNewBot() {
    if (!botName.trim()) {
      toast.error("Bot name is required.");
      return;
    }
    if (!pairs.trim()) {
      toast.error("At least one pair is required.");
      return;
    }

    setDeploying(true);
    const id = toast.loading(`Creating bot ${botName}...`);
    try {
      const pairList = pairs
        .split(",")
        .map(p => p.trim())
        .filter(p => p);

      await registerBot({
        name: botName,
        exchange_name: exchange,
        pair_whitelist: pairList,
        timeframe,
        is_dry_run: dryRun,
        strategy_version_id: currentVersionId,
        trading_mode: "futures",
        margin_mode: "isolated",
        stake_currency: "USDT",
        stake_amount: "unlimited",
        max_open_trades: 3,
      });
      toast.dismiss(id);
      toast.success(`Bot ${botName} created and strategy deployed.`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Failed to create bot.");
    } finally {
      setDeploying(false);
    }
  }

  async function handleDeployToExisting() {
    if (!selectedBotId) {
      toast.error("Please select a bot.");
      return;
    }

    setDeploying(true);
    const id = toast.loading(`Deploying strategy to bot...`);
    try {
      const selectedBot = bots.find(b => b.id === selectedBotId);
      if (!selectedBot) {
        throw new Error("Bot not found.");
      }

      // Step 1: Handle graceful drain if bot is running
      if (replacementOption === "graceful" && selectedBot.status === "running") {
        toast.info("Starting graceful drain...");
        await drainBot(selectedBotId);
      }

      // Step 2: Force exit all positions and stop bot
      if (replacementOption === "force" && selectedBot.status === "running") {
        toast.info("Force exiting all positions...");
        await hardKill(selectedBotId, "Strategy replacement (force)");
      }

      // Step 3: Update bot with new strategy version
      const updateData = {
        strategy_version_id: currentVersionId,
      };
      await updateBot(selectedBotId, updateData);

      toast.dismiss(id);
      toast.success(
        `Strategy deployed to ${selectedBot.name}. ${
          replacementOption === "save-only"
            ? "Please manually restart the bot."
            : "Bot will restart with new strategy."
        }`
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.dismiss(id);
      toast.error(err instanceof Error ? err.message : "Deployment failed.");
    } finally {
      setDeploying(false);
    }
  }

  const selectedBot = bots.find(b => b.id === selectedBotId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-muted/50 border border-border rounded-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground mb-5">
          Deploy {strategyName} {currentVersionId && `(v${currentVersionId})`}
        </h2>

        {/* Tab buttons */}
        <div className="flex gap-2 mb-6 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => setTab("new-bot")}
            className={`px-4 py-2 rounded text-xs font-semibold transition-all ${
              tab === "new-bot"
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Create New Bot
          </button>
          <button
            type="button"
            onClick={() => setTab("existing-bot")}
            className={`px-4 py-2 rounded text-xs font-semibold transition-all ${
              tab === "existing-bot"
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/50"
            }`}
          >
            Deploy to Existing Bot
          </button>
        </div>

        {/* New Bot Tab */}
        {tab === "new-bot" && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Bot Name
              </label>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="e.g. supertrend-binance"
                className="w-full px-3 py-2 bg-card border border-border rounded text-xs text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Exchange
                </label>
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                  className="w-full px-3 py-2 bg-card border border-border rounded text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  <option value="binance">Binance</option>
                  <option value="bybit">Bybit</option>
                  <option value="okx">OKX</option>
                  <option value="hyperliquid">Hyperliquid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Timeframe
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 bg-card border border-border rounded text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Trading Pairs
              </label>
              <textarea
                value={pairs}
                onChange={(e) => setPairs(e.target.value)}
                placeholder="BTC/USDT:USDT, ETH/USDT:USDT, SOL/USDT:USDT"
                className="w-full px-3 py-2 bg-card border border-border rounded text-xs text-foreground outline-none focus:border-primary resize-none"
                rows={3}
              />
              <div className="text-2xs text-muted-foreground mt-1">Comma-separated list of pairs</div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dryRun"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-3.5 h-3.5 accent-accent cursor-pointer"
              />
              <label htmlFor="dryRun" className="text-xs text-muted-foreground cursor-pointer">
                Paper Trading (Dry Run)
              </label>
            </div>
          </div>
        )}

        {/* Existing Bot Tab */}
        {tab === "existing-bot" && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Select Bot
              </label>
              {loadingBots ? (
                <div className="text-xs text-muted-foreground animate-pulse py-2">Loading bots...</div>
              ) : bots.length === 0 ? (
                <div className="text-xs text-rose-500 py-2">No bots found. Create a bot first.</div>
              ) : (
                <select
                  value={selectedBotId ?? ""}
                  onChange={(e) => setSelectedBotId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-card border border-border rounded text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                >
                  {bots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name} ({bot.status}, {bot.is_dry_run ? "paper" : "live"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedBot && (
              <div className="p-3 bg-card border border-border rounded">
                <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">Current Config</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>Exchange: {selectedBot.exchange_name || "Unknown"}</div>
                  <div>Strategy: {selectedBot.strategy_name || "None"}</div>
                  <div>Status: {selectedBot.status}</div>
                  <div>Mode: {selectedBot.is_dry_run ? "Paper Trading" : "LIVE"}</div>
                </div>
              </div>
            )}

            {selectedBot?.status === "running" && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-foreground">How to replace strategy?</div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 bg-card border border-border rounded cursor-pointer hover:border-primary transition-all">
                    <input
                      type="radio"
                      name="replacement"
                      value="graceful"
                      checked={replacementOption === "graceful"}
                      onChange={() => setReplacementOption("graceful")}
                      className="accent-accent cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Graceful Drain</div>
                      <div className="text-2xs text-muted-foreground">Stop new entries, wait for exits, then switch</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-card border border-border rounded cursor-pointer hover:border-primary transition-all">
                    <input
                      type="radio"
                      name="replacement"
                      value="force"
                      checked={replacementOption === "force"}
                      onChange={() => setReplacementOption("force")}
                      className="accent-accent cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Force Replace</div>
                      <div className="text-2xs text-muted-foreground">Force exit all positions (market orders) and switch immediately</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-card border border-border rounded cursor-pointer hover:border-primary transition-all">
                    <input
                      type="radio"
                      name="replacement"
                      value="save-only"
                      checked={replacementOption === "save-only"}
                      onChange={() => setReplacementOption("save-only")}
                      className="accent-accent cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Save Only</div>
                      <div className="text-2xs text-muted-foreground">Update version reference, manual restart later</div>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded border border-border bg-muted/50 text-muted-foreground text-xs font-semibold cursor-pointer hover:bg-muted transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={
              tab === "new-bot" ? handleCreateNewBot : handleDeployToExisting
            }
            disabled={
              deploying ||
              (tab === "new-bot" && !botName.trim()) ||
              (tab === "existing-bot" && !selectedBotId)
            }
            className="flex-1 px-4 py-2 rounded bg-primary text-white text-xs font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {deploying ? "Deploying..." : "Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}
