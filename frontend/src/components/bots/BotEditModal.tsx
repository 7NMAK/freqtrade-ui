"use client";

import React, { useEffect, useState } from "react";
import { updateBot } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Bot } from "@/types";

interface BotEditModalProps {
  open: boolean;
  bot: Bot | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BotEditModal({ open, bot, onClose, onSuccess }: BotEditModalProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [strategyName, setStrategyName] = useState("");
  const [dryRun, setDryRun] = useState(true);

  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setDescription(bot.description ?? "");
      setStrategyName(bot.strategy_name ?? "");
      setDryRun(bot.is_dry_run);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot?.id]);

  if (!open || !bot) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bot) return;
    if (!name.trim()) {
      toast.error("Bot name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await updateBot(bot.id, {
        name: name.trim(),
        description: description.trim() || null,
        strategy_name: strategyName.trim() || null,
        is_dry_run: dryRun,
      });
      toast.success(`Bot "${name}" updated.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update bot.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-2 border border-border rounded-card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-text-0 mb-4">Edit Bot</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-1 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-bg-1 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent" />
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">API URL</label>
              <div className="w-full bg-bg-3 border border-border rounded px-3 py-2 text-xs text-text-3 font-mono">{bot.api_url}</div>
            </div>
            <div>
              <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">API Port</label>
              <div className="w-full bg-bg-3 border border-border rounded px-3 py-2 text-xs text-text-3 font-mono">{bot.api_port}</div>
            </div>
          </div>

          <div>
            <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">Strategy Name</label>
            <input type="text" value={strategyName} onChange={(e) => setStrategyName(e.target.value)}
              placeholder="SampleStrategy"
              className="w-full bg-bg-1 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent" />
          </div>

          <div className="flex items-center gap-3 py-1">
            <label className="text-2xs text-text-3 uppercase tracking-wide">Dry Run</label>
            <button
              type="button"
              onClick={() => setDryRun(!dryRun)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${dryRun ? "bg-amber" : "bg-green"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${dryRun ? "left-0.5" : "left-[22px]"}`} />
            </button>
            <span className={`text-xs font-semibold ${dryRun ? "text-amber" : "text-green"}`}>
              {dryRun ? "Paper" : "Live"}
            </span>
          </div>

          <div className="flex gap-2 mt-5">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold rounded border border-border text-text-2 hover:bg-bg-3 cursor-pointer transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 text-xs font-semibold rounded bg-accent text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all">
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
