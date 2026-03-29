"use client";

import React, { useEffect, useState } from "react";
import { getBots, importStrategy, saveBotConfig, reloadBotConfig, updateStrategy } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Bot } from "@/types";

interface DeployModalProps {
  open: boolean;
  strategyName: string;
  strategyCode: string;
  strategyId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeployModal({
  open, strategyName, strategyCode, strategyId, onClose, onSuccess,
}: DeployModalProps) {
  const toast = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [setActive, setSetActive] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [loadingBots, setLoadingBots] = useState(false);

  useEffect(() => {
    if (!open) {
      setSetActive(true);
      setDeploying(false);
      return;
    }
    setLoadingBots(true);
    getBots()
      .then((list) => {
        setBots(list);
        if (list.length > 0) setSelectedBotId(list[0].id);
      })
      .catch(() => toast.error("Failed to load bots."))
      .finally(() => setLoadingBots(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function handleDeploy() {
    if (!selectedBotId) {
      toast.error("Please select a bot.");
      return;
    }
    setDeploying(true);
    const loadId = toast.loading(`Deploying ${strategyName} to bot...`);
    try {
      // Upload .py file to bot's strategy directory
      const file = new File([strategyCode], `${strategyName}.py`, { type: "text/x-python" });
      await importStrategy(selectedBotId, file);

      // Optionally set as active strategy and reload
      if (setActive) {
        await saveBotConfig(selectedBotId, { strategy: strategyName });
        await reloadBotConfig(selectedBotId);
      }

      // Link strategy to bot in orchestrator DB
      if (strategyId) {
        await updateStrategy(strategyId, { bot_instance_id: selectedBotId });
      }

      toast.dismiss(loadId);
      const botName = bots.find((b) => b.id === selectedBotId)?.name ?? `Bot ${selectedBotId}`;
      toast.success(`Strategy deployed to ${botName}${setActive ? " and set as active." : "."}`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.dismiss(loadId);
      toast.error(err instanceof Error ? err.message : "Deploy failed.");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-2 border border-border rounded-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-text-0 mb-4">Deploy Strategy</h3>

        <div className="mb-4">
          <div className="text-2xs text-text-3 uppercase tracking-wide mb-1">Strategy</div>
          <div className="text-xs font-mono font-semibold text-text-0 bg-bg-1 border border-border rounded px-3 py-2">
            {strategyName}.py
          </div>
        </div>

        <div className="mb-4">
          <div className="text-2xs text-text-3 uppercase tracking-wide mb-1">Select Bot</div>
          {loadingBots ? (
            <div className="text-xs text-text-3 animate-pulse py-2">Loading bots...</div>
          ) : bots.length === 0 ? (
            <div className="text-xs text-red py-2">No bots registered. Register a bot first.</div>
          ) : (
            <select
              value={selectedBotId ?? ""}
              onChange={(e) => setSelectedBotId(Number(e.target.value))}
              className="w-full bg-bg-1 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent cursor-pointer"
            >
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} ({bot.status}, {bot.is_dry_run ? "dry_run" : "live"})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setActive}
              onChange={(e) => setSetActive(e.target.checked)}
              className="w-3.5 h-3.5 accent-accent cursor-pointer"
            />
            <span className="text-xs text-text-1">Set as active strategy</span>
          </label>
          <div className="text-2xs text-text-3 mt-1 ml-5.5">
            Updates bot config to use this strategy and reloads
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold rounded border border-border text-text-2 hover:bg-bg-3 cursor-pointer transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleDeploy}
            disabled={deploying || bots.length === 0 || !selectedBotId}
            className="flex-1 py-2 text-xs font-semibold rounded bg-accent text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all">
            {deploying ? "Deploying..." : "Deploy \u2192"}
          </button>
        </div>
      </div>
    </div>
  );
}
