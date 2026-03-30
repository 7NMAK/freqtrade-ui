"use client";

import React, { useState, useEffect } from "react";
import { registerBot, getStrategies, getExchangeProfiles } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Strategy, ExchangeProfile } from "@/types";

interface BotRegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EXCHANGES = ["binance", "bybit", "okx", "hyperliquid", "bitget", "kraken", "kucoin", "gate"];
const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d"];
const STAKE_CURRENCIES = ["USDT", "BUSD", "BTC", "ETH"];

export default function BotRegisterModal({ open, onClose, onSuccess }: BotRegisterModalProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Strategies & Profiles
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [profiles, setProfiles] = useState<ExchangeProfile[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [, setProfilesLoading] = useState(false);

  // Step 1: Bot Name + Exchange
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exchange, setExchange] = useState("binance");
  const [useProfile, setUseProfile] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [subaccount, setSubaccount] = useState("");

  // Step 2: Trading Config
  const [pairInput, setPairInput] = useState("");
  const [pairWhitelist, setPairWhitelist] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState("1h");
  const [tradingMode, setTradingMode] = useState<"Futures" | "Spot">("Futures");
  const [marginMode, setMarginMode] = useState<"Isolated" | "Cross">("Isolated");

  // Step 3: Stake & Limits
  const [stakeCurrency, setStakeCurrency] = useState("USDT");
  const [unlimitedStake, setUnlimitedStake] = useState(true);
  const [stakeAmount, setStakeAmount] = useState("");
  const [maxOpenTrades, setMaxOpenTrades] = useState("3");
  const [dryRun, setDryRun] = useState(true);

  // Step 4: Connection + Review
  const [apiUrl, setApiUrl] = useState("http://127.0.0.1");
  const [apiPort, setApiPort] = useState("8080");
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
        const deployable = strats.filter((s) => ["deployable", "backtest", "ai_tested"].includes(s.lifecycle));
        setStrategies(deployable);
      } catch (err) {
        console.error("Failed to load strategies:", err);
      } finally {
        setStrategiesLoading(false);
      }

      try {
        setProfilesLoading(true);
        const profs = await getExchangeProfiles();
        setProfiles(profs.items || []);
      } catch (err) {
        console.error("Failed to load profiles:", err);
      } finally {
        setProfilesLoading(false);
      }
    };
    loadData();
  }, [open]);

  if (!open) return null;

  function resetForm() {
    setCurrentStep(1);
    setName("");
    setDescription("");
    setExchange("binance");
    setUseProfile(null);
    setApiKey("");
    setApiSecret("");
    setSubaccount("");
    setPairInput("");
    setPairWhitelist([]);
    setTimeframe("1h");
    setTradingMode("Futures");
    setMarginMode("Isolated");
    setStakeCurrency("USDT");
    setUnlimitedStake(true);
    setStakeAmount("");
    setMaxOpenTrades("3");
    setDryRun(true);
    setApiUrl("http://127.0.0.1");
    setApiPort("8080");
    setApiUsername("");
    setApiPassword("");
    setSelectedStrategyId(null);
  }

  function validateStep1(): boolean {
    if (!name.trim()) {
      toast.error("Bot name is required.");
      return false;
    }
    if (useProfile === null && !apiKey.trim()) {
      toast.error("Please select a profile or enter API key.");
      return false;
    }
    if (useProfile === null && !apiSecret.trim()) {
      toast.error("API secret is required.");
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (pairWhitelist.length === 0) {
      toast.error("Please add at least one trading pair.");
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    if (!unlimitedStake && !stakeAmount.trim()) {
      toast.error("Stake amount is required.");
      return false;
    }
    return true;
  }

  function validateStep4(): boolean {
    if (!apiUrl.trim() || !apiPort.trim() || !apiUsername.trim() || !apiPassword.trim()) {
      toast.error("Please fill in all API connection fields.");
      return false;
    }
    if (!selectedStrategyId) {
      toast.error("Please select a strategy.");
      return false;
    }
    return true;
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

  function handleNextStep() {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    setCurrentStep(currentStep + 1);
  }

  function handlePrevStep() {
    setCurrentStep(currentStep - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep4()) return;

    const selectedStrat = strategies.find((s) => s.id === selectedStrategyId);
    if (!selectedStrat) return;

    setSubmitting(true);
    try {
      await registerBot({
        name: name.trim(),
        description: description.trim() || null,
        exchange_name: exchange,
        exchange_key_enc: useProfile ? undefined : apiKey.trim(),
        exchange_secret_enc: useProfile ? undefined : apiSecret.trim(),
        exchange_profile_id: useProfile,
        exchange_subaccount: subaccount.trim() || null,
        pair_whitelist: pairWhitelist,
        timeframe,
        trading_mode: tradingMode.toLowerCase(),
        margin_mode: marginMode.toLowerCase(),
        stake_currency: stakeCurrency,
        stake_amount: unlimitedStake ? "unlimited" : stakeAmount.trim(),
        max_open_trades: parseInt(maxOpenTrades, 10),
        is_dry_run: dryRun,
        api_url: apiUrl.trim(),
        api_port: parseInt(apiPort, 10),
        api_username: apiUsername.trim(),
        api_password: apiPassword.trim(),
        strategy_version_id: selectedStrat.id,
      });
      toast.success(`Bot "${name}" created successfully.`);
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bot.");
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
        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step <= currentStep
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step}
              </div>
              {step < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-all ${
                    step < currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            {currentStep === 1 && "Bot Name & Exchange"}
            {currentStep === 2 && "Trading Configuration"}
            {currentStep === 3 && "Stake & Limits"}
            {currentStep === 4 && "Connection & Strategy"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1 */}
          {currentStep === 1 && (
            <>
              <Field label="Bot Name *" value={name} onChange={setName} placeholder="my-trading-bot" />
              <Field label="Description" value={description} onChange={setDescription} placeholder="Optional description" />

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
                <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Use Exchange Profile</label>
                <select
                  value={useProfile ?? ""}
                  onChange={(e) => setUseProfile(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">-- Enter manually --</option>
                  {profiles
                    .filter((p) => p.exchange_name === exchange)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              {useProfile === null && (
                <>
                  <Field label="API Key *" value={apiKey} onChange={setApiKey} placeholder="your-api-key" type="password" />
                  <Field label="API Secret *" value={apiSecret} onChange={setApiSecret} placeholder="your-api-secret" type="password" />
                </>
              )}

              <Field label="Subaccount (optional)" value={subaccount} onChange={setSubaccount} placeholder="subaccount-name" />
            </>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <>
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
                  {["Spot", "Futures"].map((mode) => (
                    <label key={mode} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tradingMode"
                        value={mode}
                        checked={tradingMode === mode}
                        onChange={(e) => setTradingMode(e.target.value as "Spot" | "Futures")}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-foreground">{mode}</span>
                    </label>
                  ))}
                </div>
              </div>

              {tradingMode === "Futures" && (
                <div>
                  <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Margin Mode *</label>
                  <div className="flex gap-4">
                    {["Isolated", "Cross"].map((mode) => (
                      <label key={mode} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="marginMode"
                          value={mode}
                          checked={marginMode === mode}
                          onChange={(e) => setMarginMode(e.target.value as "Isolated" | "Cross")}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-foreground">{mode}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 3 */}
          {currentStep === 3 && (
            <>
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
                  ⚠ Warning: This will enable REAL MONEY TRADING. Be cautious!
                </div>
              )}
            </>
          )}

          {/* Step 4 */}
          {currentStep === 4 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="API URL *" value={apiUrl} onChange={setApiUrl} placeholder="http://127.0.0.1" />
                <Field label="API Port *" value={apiPort} onChange={setApiPort} placeholder="8080" type="number" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="API Username *" value={apiUsername} onChange={setApiUsername} placeholder="freqtrader" />
                <Field label="API Password *" value={apiPassword} onChange={setApiPassword} placeholder="password" type="password" />
              </div>

              <div>
                <label className="text-2xs text-muted-foreground uppercase tracking-wide block mb-2">Strategy *</label>
                {strategiesLoading ? (
                  <div className="text-xs text-muted-foreground">Loading strategies...</div>
                ) : (
                  <select
                    value={selectedStrategyId ?? ""}
                    onChange={(e) => setSelectedStrategyId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Select a strategy --</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.lifecycle})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Review Summary */}
              <div className="mt-6 p-4 bg-muted border border-border rounded space-y-2">
                <div className="text-xs font-semibold text-foreground mb-2">Configuration Summary</div>
                <div className="text-2xs text-muted-foreground space-y-1">
                  <div>
                    <span className="text-muted-foreground">Bot:</span> {name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exchange:</span> {exchange}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pairs:</span> {pairWhitelist.join(", ")}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timeframe:</span> {timeframe}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mode:</span> {tradingMode} {tradingMode === "Futures" ? `(${marginMode})` : ""}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stake:</span> {unlimitedStake ? "Unlimited" : stakeAmount} {stakeCurrency}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max Trades:</span> {maxOpenTrades}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span> {dryRun ? "Paper" : "LIVE"}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={currentStep === 1 ? onClose : handlePrevStep}
              className="flex-1 py-2 text-xs font-semibold rounded border border-border text-muted-foreground hover:bg-muted cursor-pointer transition-all"
            >
              {currentStep === 1 ? "Cancel" : "Back"}
            </button>
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex-1 py-2 text-xs font-semibold rounded bg-primary text-white hover:brightness-110 cursor-pointer transition-all"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 text-xs font-semibold rounded bg-primary text-white hover:brightness-110 disabled:opacity-50 cursor-pointer transition-all"
              >
                {submitting ? "Creating..." : "Create Bot"}
              </button>
            )}
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
