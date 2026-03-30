"use client";

import React, { useEffect, useState } from "react";
import { deleteBot } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Bot } from "@/types";

interface BotDeleteDialogProps {
  open: boolean;
  bot: Bot | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BotDeleteDialog({ open, bot, onClose, onSuccess }: BotDeleteDialogProps) {
  const toast = useToast();
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) setConfirmName("");
  }, [open]);

  if (!open || !bot) return null;

  const canDelete = confirmName === bot.name;

  async function handleDelete() {
    if (!bot || !canDelete) return;
    setDeleting(true);
    try {
      await deleteBot(bot.id);
      toast.success(`Bot "${bot.name}" deleted.`);
      setConfirmName("");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bot.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-muted/50 border border-border rounded-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-rose-500 mb-2">Delete Bot</h3>
        <p className="text-xs text-muted-foreground mb-4">
          You are about to delete <strong className="text-foreground">{bot.name}</strong>.
          This will remove the bot registration and all associated metadata. This action cannot be undone.
        </p>
        <div className="mb-4">
          <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-1">
            Type <strong className="text-foreground">{bot.name}</strong> to confirm
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={bot.name}
            className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-rose-500"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold rounded border border-border text-muted-foreground hover:bg-muted cursor-pointer transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleDelete} disabled={!canDelete || deleting}
            className="flex-1 py-2 text-xs font-semibold rounded bg-red text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all">
            {deleting ? "Deleting..." : "Delete Bot"}
          </button>
        </div>
      </div>
    </div>
  );
}
