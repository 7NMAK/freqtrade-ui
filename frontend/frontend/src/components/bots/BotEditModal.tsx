"use client";

import React, { useEffect, useState } from "react";
import { updateBot, getStrategies, getExchangeProfiles } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Bot, Strategy, ExchangeProfile } from "@/types";

interface BotEditModalProps {
  open: boolean;
  bot: Bot | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EXCHANGES = ["binance", "bybit", "okx", "hyperliquid", "bitget", "kraken", "kucoin", "gate"];
const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d"];
const STAKE_CURRENCIES = ["USDT", "BUSD", "BTC", "ETH"];

export default function BotEditModal({ open, bot, onClose, onSuccess }: BotEditModalProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    general: true,
    exchange: false,
    trading: false,
    connection: false,
  });

  // Strategies & Profiles
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [profiles, setProfiles] = useState<ExchangeProfile[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Exchange
  const [exchange, setExchange] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [useProfile, setUseProfile] = useState<number | null>(null);
  const [subaccount, setSubaccount] = useState("");

  // Trading Config
  const [pairInput, setPairInput] = useState("");
  const [pairWhitelist, setPairWhitelist] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState("");
  const [tradingMode, setTradingMode] = useState("");
  const [marginMode, setMarginMode] = useState("");

  // Stake & Limits
  const [stakeCurrency, setStakeCurrency] = useState("");
  const [unlimitedStake, setUnlimitedStake] = useState(true);
  const [stakeAmount, setStakeAmount] = useState("");
  const [maxOpenTrades, setMaxOpenTrades] = useState("");
  const [dryRun, setDryRun] = useState(true);

  // Connection
  const [apiUrl, setApiUrl] = useState("");
  const [apiPort, setApiPort] = useState("");
  const [apiUsername, setApiUsername] = useState("");
  const [apiPassword, setApiPassword] = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);

  // Load strategies and profiles on mount
  useEffect(() => {
    if (!open) return;
    const loadData = async () => {
      try {
        setStrategiesLoading(true);
        const strats = await getStrategies();
        const deployable = strats.filter((s) =>
          ["deployable", "backtest", "ai_tested"].includes(s.lifecycle)
        );
        setStrategies(deployable);
      } catch (err) {
        console.error("Failed to load strategies:", err);
      } finally {
        setStrategiesLoading(false);
      }

      try {
        const profs = await getExchangeProfiles();
        setProfiles(profs.items || []);
      } catch (err) {
        console.error("Failed to load profiles:", err);
      }
    };
    loadData();
  }, [open]);

  // Populate form when bot changes
  useEffect(() => {
    if (!bot) return;

    setName(bot.name);
    setDescription(bot.description ?? "");
    setExchange(bot.exchange_name ?? "binance");
    setApiKey("");
    setApiSecret("");
    setShowApiKeyInput(false);
    setUseProfile(bot.exchange_profile_id ?? null);
    setSubaccount(bot.exchange_subaccount ?? "");

    setPairWhitelist(bot.pair_whitelist ?? []);
    setTimeframe(bot.timeframe ?? "1h");
    setTradingMode(bot.trading_mode ?? "futures");
    setMarginMode(bot.margin_mode ?? "isolated");

    setStakeCurrency(bot.stake_currency ?? "USDT");
    const stakeVal = bot.stake_amount ?? "unlimited";
    setUnlimitedStake(stakeVal === "unlimited");
    setStakeAmount(stakeVal === "unlimited" ? "" : stakeVal);
    setMaxOpenTrades(String(bot.max_open_trades ?? 3));
    setDryRun(bot.is_dry_run);

    setApiUrl(bot.api_url);
    setApiPort(String(bot.api_port));
    setApiUsername(bot.api_username ?? "");
    setApiPassword("");

    if (bot.strategy_name) {
      const strat = strategies.find((s) => s.name === bot.strategy_name);
      setSelectedStrategyId(strat?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot?.id, strategies]);

  if (!open || !bot) return null;

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  function handleAddPair() {
    const trimmed = pairInput.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Enter a pair name.");
      return;
    }
    if (pairWhitelist.includes(trimmed)) {
      toast.error("Pair already added.");
      return;
    }
    setPairWhitelist([...pairWhitelist, trimmed]);
    setPairInput("");
  }

  function handleRemovePair(pair: string) {
    setPairWhitelist(pairWhitelist.filter((p) => p !== pair));
  }

  // Track which fields have changed
  function getChangedFields(): Record<string, unknown> {
    if (!bot) return {};

    const changed: Record<string, unknown> = {};

    if (name !== bot.name) changed.name = name.trim();
    if (description !== (bot.description ?? "")) changed.description = description.trim() || null;

    if (exchange !== (bot.exchange_name ?? "binance")) changed.exchange_name = exchange;
    if (apiKey) changed.exchange_key_enc = apiKey.trim();
    if (apiSecret) changed.exchange_secret_enc = apiSecret.trim();
    if (useProfile !== (bot.exchange_profile_id ?? null)) changed.exchange_profile_id = useProfile;
    if (subaccount !== (bot.exchange_subaccount ?? "")) changed.exchange_subaccount = subaccount.trim() || null;

    if (pairWhitelist.sort().join(",") !== (bot.pair_whitelist ?? []).sort().join(","))
      changed.pair_whitelist = pairWhitelist;
    if (timeframe !== (bot.timeframe ?? "1h")) changed.timeframe = timeframe;
    if (tradingMode !== (bot.trading_mode ?? "futures")) changed.trading_mode = tradingMode;
    if (marginMode !== (bot.margin_mode ?? "isolated")) changed.margin_mode = marginMode;

    if (stakeCurrency !== (bot.stake_currency ?? "USDT")) changed.stake_currency = stakeCurrency;
    const newStake = unlimitedStake ? "unlimited" : stakeAmount.trim();
    if (newStake !== (bot.stake_amount ?? "unlimited")) changed.stake_amount = newStake;
    if (parseInt(maxOpenTrades, 10) !== (bot.max_open_trades ?? 3))
      changed.max_open_trades = parseInt(maxOpenTrades, 10);
    if (dryRun !== bot.is_dry_run) changed.is_dry_run = dryRun;

    if (apiUrl !== bot.api_url) changed.api_url = apiUrl.trim();
    if (parseInt(apiPort, 10) !== bot.api_port) changed.api_port = parseInt(apiPort, 10);
    if (apiUsername !== (bot.api_username ?? "")) changed.api_username = apiUsername.trim();
    if (apiPassword) changed.api_password = apiPassword.trim();

    if (selectedStrategyId && selectedStrategyId !== bot.strategy_version_id) {
      changed.strategy_version_id = selectedStrategyId;
    }

    return changed;
  }

  function requiresRestart(): boolean {
    const changed = getChangedFields();
    const restartFields = [
      "exchange_name",
      "exchange_key_enc",
      "exchange_secret_enc",
      "pair_whitelist",
      "timeframe",
      "trading_mode",
      "margin_mode",
      "stake_currency",
      "stake_amount",
      "strategy_version_id",
    ];
    return restartFields.some((field) => field in changed);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bot) return;

    const changed = getChangedFields();
    if (Object.keys(changed).length === 0) {
      toast.info("No changes detected.");
      return;
    }

    if (!name.trim()) {
      toast.error("Bot name is required.");
      return;
    }

    const needsRestart = requiresRestart();

    if (
      needsRestart &&
      !dryRun &&
      !window.confirm(
        "This change requires a restart and you are in LIVE mode. Continue?"
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      await updateBot(bot.id, changed);
      toast.success(
        needsRestart
          ? `Bot "${name}" updated. Restarting...`
          : `Bot "${name}" updated.`
      );
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update bot.");
    } finally {
      setSubmitting(false);
    }
  }

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
        <h3 className="text-sm font-semibold text-foreground mb-6">Edit Bot: {bot.name}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Section */}
          <CollapsibleSection
            title="General"
            expanded={expandedSections.general}
            onToggle={() => toggleSection("general")}
          >
            <Field label="Name *" value={name} onChange={setName} placeholder="bot-name" />
            <Field label="Description" value={description} onChange={setDescription} placeholder="Optional description" />
          </CollapsibleSection>

          {/* Exchange Section */}
          <CollapsibleSection
            title="Exchange"
            expanded={expandedSections.exchange}
            onToggle={() => toggleSection("exchange")}
          >
            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Exchange *</label>
              <select
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                {EXCHANGES.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex.charAt(0).toUpperCase() + ex.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">API Credentials</label>
              {!showApiKeyInput ? (
                <button
                  type="button"
                  onClick={() => setShowApiKeyInput(true)}
                  className="px-3 py-2 text-xs font-semibold bg-muted border border-border rounded hover:bg-muted transition-all cursor-pointer"
                >
                  Change API Keys
                </button>
              ) : (
                <>
                  <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="••••••••" type="password" />
                  <Field label="API Secret" value={apiSecret} onChange={setApiSecret} placeholder="••••••••" type="password" />
                </>
              )}
            </div>

            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Use Exchange Profile</label>
              <select
                value={useProfile ?? ""}
                onChange={(e) => setUseProfile(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">-- None --</option>
                {profiles
                  .filter((p) => p.exchange_name === exchange)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <Field label="Subaccount" value={subaccount} onChange={setSubaccount} placeholder="subaccount-name" />
          </CollapsibleSection>

          {/* Trading Config Section */}
          <CollapsibleSection
            title="Trading Configuration"
            expanded={expandedSections.trading}
            onToggle={() => toggleSection("trading")}
          >
            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Trading Pairs *</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={pairInput}
                  onChange={(e) => setPairInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPair())}
                  placeholder="BTC/USDT"
                  className="flex-1 bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleAddPair}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-white rounded hover:brightness-110 transition-all"
                >
                  Add
                </button>
              </div>
              {pairWhitelist.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pairWhitelist.map((pair) => (
                    <div
                      key={pair}
                      className="flex items-center gap-2 px-3 py-1 bg-primary/20 border border-primary rounded text-xs text-foreground"
                    >
                      {pair}
                      <button
                        type="button"
                        onClick={() => handleRemovePair(pair)}
                        className="text-muted-foreground hover:text-foreground transition-all"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Timeframe *</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                {TIMEFRAMES.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Trading Mode *</label>
              <div className="flex gap-4">
                {["spot", "futures"].map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tradingMode"
                      value={mode}
                      checked={tradingMode === mode}
                      onChange={(e) => setTradingMode(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-foreground">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            {tradingMode === "futures" && (
              <div>
                <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Margin Mode *</label>
                <div className="flex gap-4">
                  {["isolated", "cross"].map((mode) => (
                    <label key={mode} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="marginMode"
                        value={mode}
                        checked={marginMode === mode}
                        onChange={(e) => setMarginMode(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-foreground">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Stake Currency *</label>
              <select
                value={stakeCurrency}
                onChange={(e) => setStakeCurrency(e.target.value)}
                className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                {STAKE_CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Stake Amount</label>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={unlimitedStake}
                  onChange={(e) => setUnlimitedStake(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-xs text-muted-foreground">Unlimited</span>
              </div>
              {!unlimitedStake && (
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="100"
                  className="w-full mt-2 bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              )}
            </div>

            <Field
              label="Max Open Trades *"
              value={maxOpenTrades}
              onChange={setMaxOpenTrades}
              placeholder="3"
              type="number"
            />

            <div className="flex items-center gap-3 py-1">
              <label className="text-2xs text-muted-foreground uppercase tracking-wide">Trading Mode</label>
              <button
                type="button"
                onClick={() => setDryRun(!dryRun)}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                  dryRun ? "bg-amber" : "bg-red-500"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    dryRun ? "left-0.5" : "left-[22px]"
                  }`}
                />
              </button>
              <span className={`text-xs font-semibold ${dryRun ? "text-amber-500" : "text-rose-500-500"}`}>
                {dryRun ? "Paper" : "Live"}
              </span>
            </div>

            {!dryRun && (
              <div className="p-3 bg-red-500/10 border border-rose-500-500/30 rounded text-xs text-rose-500-400">
                ⚠ LIVE TRADING: Real money trading is enabled. Be cautious!
              </div>
            )}
          </CollapsibleSection>

          {/* Connection Section */}
          <CollapsibleSection
            title="Connection"
            expanded={expandedSections.connection}
            onToggle={() => toggleSection("connection")}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="API URL *" value={apiUrl} onChange={setApiUrl} placeholder="http://127.0.0.1" />
              <Field label="API Port *" value={apiPort} onChange={setApiPort} placeholder="8080" type="number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="API Username *" value={apiUsername} onChange={setApiUsername} placeholder="freqtrader" />
              <Field label="API Password *" value={apiPassword} onChange={setApiPassword} placeholder="password" type="password" />
            </div>

            <div>
              <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Strategy</label>
              {strategiesLoading ? (
                <div className="text-xs text-muted-foreground">Loading strategies...</div>
              ) : (
                <select
                  value={selectedStrategyId ?? ""}
                  onChange={(e) => setSelectedStrategyId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">-- No change --</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.lifecycle})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </CollapsibleSection>

          {requiresRestart() && (
            <div className="p-3 bg-amber/10 border border-amber-500/30 rounded text-xs text-amber-500">
              Note: Changes require bot restart.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-xs font-semibold rounded border border-border text-muted-foreground hover:bg-muted cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 text-xs font-semibold rounded bg-primary text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
      />
    </div>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted transition-all cursor-pointer"
      >
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
      </button>
      {expanded && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}
