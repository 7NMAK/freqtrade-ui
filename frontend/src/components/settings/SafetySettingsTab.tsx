"use client";

import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getSafetySettings, updateSafetySettings } from "@/lib/api";
import type { SafetySettings } from "@/types";

const DAILY_LOSS_ACTIONS = [
  { value: "soft_kill_all", label: "Soft Kill All — stop trading, positions stay open" },
  { value: "hard_kill_all", label: "Hard Kill All — force-exit all positions + stop" },
];

export default function SafetySettingsTab() {
  const toast = useToast();
  const [data, setData] = useState<SafetySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSafetySettings();
        if (alive) setData(s);
      } catch (e) {
        toast.error(`Failed to load safety settings: ${(e as Error).message}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const updated = await updateSafetySettings({
        max_leverage: data.max_leverage,
        portfolio_exposure_pct: data.portfolio_exposure_pct,
        daily_loss_threshold_pct: data.daily_loss_threshold_pct,
        daily_loss_action: data.daily_loss_action,
        require_typed_go_live: data.require_typed_go_live,
        forbid_unlimited_stake_live: data.forbid_unlimited_stake_live,
      });
      setData(updated);
      toast.success("Safety settings saved");
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return <div className="text-sm text-muted-foreground p-8">Loading safety settings…</div>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Warning banner */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-card">
        <div className="flex gap-3">
          <span className="text-xl">⚠️</span>
          <div className="text-sm">
            <div className="font-semibold text-amber-400 mb-1">Critical safety controls</div>
            <div className="text-muted-foreground">
              These thresholds are enforced at runtime on every bot start, config apply, and
              polling cycle. Tightening them mid-trade is safe; loosening them during live
              trading is risky. Every change is recorded in the audit log.
            </div>
          </div>
        </div>
      </div>

      {/* Exposure & leverage */}
      <section>
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Exposure limits
        </div>
        <div className="space-y-4">
          <Field label="Max leverage (per bot)" hint="Blocks bot start / config apply if any pair leverage exceeds this. 10× is conservative for crypto futures; 20× is the hard upper recommendation for €1M accounts.">
            <NumberInput
              value={data.max_leverage}
              min={1}
              max={125}
              onChange={(v) => setData({ ...data, max_leverage: v })}
              suffix="x"
            />
          </Field>
          <Field label="Portfolio exposure cap" hint="Max cumulative stake across all RUNNING bots, as % of total balance. 70% leaves 30% as free collateral for volatile periods. New bot starts are blocked if projected exposure would exceed this.">
            <NumberInput
              value={data.portfolio_exposure_pct}
              min={1}
              max={100}
              onChange={(v) => setData({ ...data, portfolio_exposure_pct: v })}
              suffix="%"
            />
          </Field>
        </div>
      </section>

      {/* Daily loss breaker */}
      <section>
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Daily loss circuit breaker
        </div>
        <div className="space-y-4">
          <Field label="Loss threshold" hint="If sum of today's profit_abs across all bots crosses -(this % of total balance), the selected action below fires automatically. Resets at UTC midnight.">
            <NumberInput
              value={data.daily_loss_threshold_pct}
              min={1}
              max={100}
              onChange={(v) => setData({ ...data, daily_loss_threshold_pct: v })}
              suffix="%"
            />
          </Field>
          <Field label="Action when triggered" hint="Soft kill is safer: it stops new entries but leaves stoplosses to work naturally. Hard kill forces market exits — useful only if you trust the current liquidity.">
            <select
              value={data.daily_loss_action}
              onChange={(e) => setData({ ...data, daily_loss_action: e.target.value as SafetySettings["daily_loss_action"] })}
              className="w-full bg-card border border-border rounded-btn px-3.5 py-2 text-sm outline-none focus:border-primary"
            >
              {DAILY_LOSS_ACTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* UX guardrails */}
      <section>
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          UX guardrails
        </div>
        <div className="space-y-3">
          <CheckboxField
            checked={data.require_typed_go_live}
            onChange={(v) => setData({ ...data, require_typed_go_live: v })}
            label='Require typing "GO LIVE" to flip dry_run → off'
            hint="Double-confirmation is not enough for moving real money — force a deliberate typing step so accidental clicks cannot go live."
          />
          <CheckboxField
            checked={data.forbid_unlimited_stake_live}
            onChange={(v) => setData({ ...data, forbid_unlimited_stake_live: v })}
            label='Forbid stake_amount="unlimited" on non-dry-run bots'
            hint="Unlimited stake lets a bot consume the entire account per trade. Block it on live bots — require a numeric amount."
          />
        </div>
      </section>

      {/* Meta */}
      {data.updated_at && (
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(data.updated_at).toLocaleString()}
          {data.updated_by && <> by {data.updated_by}</>}
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary-dim text-white font-semibold px-6 py-2.5 rounded-btn text-sm transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving…" : "Save safety settings"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-full bg-card border border-border rounded-btn px-3.5 py-2 text-sm outline-none focus:border-primary pr-10"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
      )}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
      />
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{hint}</div>}
      </div>
    </label>
  );
}
