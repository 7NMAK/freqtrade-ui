"use client";

import React, { useState } from "react";
import { registerBot } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface BotRegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BotRegisterModal({ open, onClose, onSuccess }: BotRegisterModalProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [apiUrl, setApiUrl] = useState("http://127.0.0.1");
  const [apiPort, setApiPort] = useState("8080");
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [strategyName, setStrategyName] = useState("");
  const [dryRun, setDryRun] = useState(true);

  if (!open) return null;

  function resetForm() {
    setName("");
    setDescription("");
    setApiUrl("http://127.0.0.1");
    setApiPort("8080");
    setApiUsername("");
    setApiPassword("");
    setStrategyName("");
    setDryRun(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !apiUrl.trim() || !apiPort.trim() || !apiUsername.trim() || !apiPassword.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      await registerBot({
        name: name.trim(),
        description: description.trim() || null,
        api_url: apiUrl.trim(),
        api_port: parseInt(apiPort, 10),
        api_username: apiUsername.trim(),
        api_password: apiPassword.trim(),
        strategy_name: strategyName.trim() || null,
        is_dry_run: dryRun,
      });
      toast.success(`Bot "${name}" registered successfully.`);
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register bot.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-2 border border-border rounded-card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-text-0 mb-4">Register New Bot</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name *" value={name} onChange={setName} placeholder="my-btc-bot" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Optional description" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="API URL *" value={apiUrl} onChange={setApiUrl} placeholder="http://127.0.0.1" />
            <Field label="API Port *" value={apiPort} onChange={setApiPort} placeholder="8080" type="number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="API Username *" value={apiUsername} onChange={setApiUsername} placeholder="freqtrader" />
            <Field label="API Password *" value={apiPassword} onChange={setApiPassword} placeholder="password" type="password" />
          </div>
          <Field label="Strategy Name" value={strategyName} onChange={setStrategyName} placeholder="SampleStrategy" />
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
              {submitting ? "Registering..." : "Register Bot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-2xs text-text-3 uppercase tracking-wide block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-1 border border-border rounded px-3 py-2 text-xs text-text-0 focus:outline-none focus:border-accent"
      />
    </div>
  );
}
