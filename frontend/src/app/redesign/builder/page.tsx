"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
// Tabs removed — using custom step navigation
import { ScrollArea } from "@/components/ui/scroll-area";

/* ══════════════════════════════════════
   BUILDER — 6-Step Strategy Wizard + Code Preview
   Audit lines 37-61:
   ✅ Step 1 Basics: name, desc, exchange, TF, pairs chips, leverage, margin
   ✅ Step 2 Indicators: search, 4 categories with chips
   ✅ Step 3 Entry: Long IF/AND builder, Short IF/AND builder
   ✅ Step 4 Exit: EXIT IF builder
   ✅ Step 5 Risk: stoploss, stake, max_open, trailing, ROI table, protections
   ✅ Step 6 Review: 4 cards + save buttons
   ✅ Code Preview panel (right, 420px)
   ✅ Callback functions tab (13 hooks)
   ✅ Footer: Prev/Next, Save Draft, Save & Backtest
   ══════════════════════════════════════ */

const STEPS = ["Basics", "Indicators", "Entry", "Exit", "Risk", "Review"];

const INDICATORS: Record<string, string[]> = {
  Trend: ["EMA", "SMA", "WMA", "ADX", "Supertrend", "Ichimoku", "PSAR"],
  Momentum: ["RSI", "MACD", "Stochastic", "CCI", "Williams%R", "MFI"],
  Volatility: ["Bollinger Bands", "ATR", "Keltner", "Donchian"],
  Volume: ["OBV", "VWAP", "VolSMA", "CMF"],
};

const DEFAULT_PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "DOGE/USDT", "LINK/USDT", "AVAX/USDT", "ADA/USDT"];

const CALLBACKS = [
  { name: "custom_exit()", desc: "Custom exit pricing/logic" },
  { name: "custom_stoploss()", desc: "Dynamic stoploss calculation" },
  { name: "custom_entry_price()", desc: "Custom entry price" },
  { name: "custom_exit_price()", desc: "Custom exit price" },
  { name: "custom_stake_amount()", desc: "Dynamic position sizing" },
  { name: "confirm_trade_entry()", desc: "Trade entry confirmation" },
  { name: "confirm_trade_exit()", desc: "Trade exit confirmation" },
  { name: "adjust_trade_position()", desc: "DCA / position adjustment" },
  { name: "adjust_entry_price()", desc: "Limit order price adjustment" },
  { name: "bot_loop_start()", desc: "Per-iteration hook" },
  { name: "bot_start()", desc: "Bot startup hook" },
  { name: "informative_pairs()", desc: "Additional data pairs" },
  { name: "leverage()", desc: "Dynamic leverage callback" },
  { name: "order_filled()", desc: "Post-fill hook" },
  { name: "check_entry_timeout()", desc: "Entry timeout handler" },
  { name: "check_exit_timeout()", desc: "Exit timeout handler" },
];

/* ── Shared form state type ── */
interface Condition {
  id: number;
  indicator: string;
  operator: string;
  value: string;
}

interface RoiRow {
  id: number;
  time: string;
  roi: string;
}

interface FormState {
  strategyName: string;
  description: string;
  exchange: string;
  timeframe: string;
  selectedPairs: string[];
  leverage: string;
  marginMode: string;
  tradingMode: string;
  selectedIndicators: string[];
  longConditions: Condition[];
  shortConditions: Condition[];
  exitConditions: Condition[];
  stoploss: string;
  stakeAmount: string;
  maxOpenTrades: string;
  trailingStop: boolean;
  trailingStopPositive: string;
  trailingStopPositiveOffset: string;
  trailingOnlyOffsetIsReached: boolean;
  roiRows: RoiRow[];
  protections: Record<string, boolean>;
  enabledCallbacks: string[];
}

let conditionIdCounter = 100;

function StepIndicator({ current, completedSteps }: { current: number; completedSteps: boolean[] }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-2xs font-bold transition-all ${
            completedSteps[i] && i !== current ? "bg-ft-green text-white" :
            i === current ? "bg-primary text-white" :
            "bg-primary/50 text-muted-foreground"
          }`}>
            {completedSteps[i] && i !== current ? "✓" : i + 1}
          </div>
          <span className={`text-2xs font-semibold mr-2 ${i === current ? "text-foreground" : "text-muted-foreground/50"}`}>
            {s}
          </span>
          {i < STEPS.length - 1 && <div className="w-8 h-px bg-border mr-1" />}
        </div>
      ))}
    </div>
  );
}

/* ── Step 1: Basics ── */
function StepBasics({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const [addingPair, setAddingPair] = useState(false);
  const [newPair, setNewPair] = useState("");

  const hasError = !form.strategyName.trim();

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs">Strategy Name</Label>
        <Input
          placeholder="e.g. TrendFollowerV3"
          className={`mt-1 ${hasError ? "border-rose-500-500" : ""}`}
          value={form.strategyName}
          onChange={(e) => setForm(prev => ({ ...prev, strategyName: e.target.value }))}
        />
        {hasError && <p className="text-2xs text-rose-500-500 mt-1">Strategy name is required</p>}
      </div>
      <div>
        <Label className="text-xs">Description</Label>
        <Textarea
          placeholder="Describe your strategy..."
          className="mt-1 h-20"
          value={form.description}
          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Exchange</Label>
          <Select value={form.exchange} onValueChange={(v) => setForm(prev => ({ ...prev, exchange: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="binance">Binance</SelectItem>
              <SelectItem value="hyperliquid">Hyperliquid</SelectItem>
              <SelectItem value="bitget">Bitget</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Timeframe</Label>
          <Select value={form.timeframe} onValueChange={(v) => setForm(prev => ({ ...prev, timeframe: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["5m", "15m", "1h", "4h", "1d"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Leverage</Label>
          <Select value={form.leverage} onValueChange={(v) => setForm(prev => ({ ...prev, leverage: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["1x", "2x", "3x", "5x", "10x", "15x", "20x"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Margin Mode</Label>
        <Select value={form.marginMode} onValueChange={(v) => setForm(prev => ({ ...prev, marginMode: v }))}>
          <SelectTrigger className="mt-1 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="isolated">Isolated</SelectItem>
            <SelectItem value="cross">Cross</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs mb-2 block">Trading Pairs</Label>
        <div className="flex flex-wrap gap-2">
          {form.selectedPairs.map(p => (
            <button
              key={p}
              onClick={() => setForm(prev => ({ ...prev, selectedPairs: prev.selectedPairs.filter(x => x !== p) }))}
              className="px-3 py-1.5 rounded-full text-2xs font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-red-500/20 hover:border-rose-500-500/30 hover:text-rose-500-500 transition-colors"
            >
              {p} ✕
            </button>
          ))}
          {addingPair ? (
            <div className="flex items-center gap-1">
              <Input
                value={newPair}
                onChange={(e) => setNewPair(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPair.trim()) {
                    if (!form.selectedPairs.includes(newPair.trim())) {
                      setForm(prev => ({ ...prev, selectedPairs: [...prev.selectedPairs, newPair.trim()] }));
                    }
                    setNewPair("");
                    setAddingPair(false);
                  } else if (e.key === "Escape") {
                    setAddingPair(false);
                    setNewPair("");
                  }
                }}
                placeholder="e.g. XRP/USDT"
                className="w-32 h-8 text-2xs"
                autoFocus
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-2xs"
                onClick={() => {
                  if (newPair.trim() && !form.selectedPairs.includes(newPair.trim())) {
                    setForm(prev => ({ ...prev, selectedPairs: [...prev.selectedPairs, newPair.trim()] }));
                  }
                  setNewPair("");
                  setAddingPair(false);
                }}
              >
                Add
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setAddingPair(true)}
              className="px-3 py-1.5 rounded-full text-2xs font-semibold border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
            >
              + Add pair
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Indicators ── */
function StepIndicators({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const [search, setSearch] = useState("");

  const toggleIndicator = (ind: string) => {
    setForm(prev => ({
      ...prev,
      selectedIndicators: prev.selectedIndicators.includes(ind)
        ? prev.selectedIndicators.filter(x => x !== ind)
        : [...prev.selectedIndicators, ind],
    }));
  };

  return (
    <div className="space-y-5">
      <Input
        placeholder="Search indicators..."
        className="mb-2"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {Object.entries(INDICATORS).map(([cat, items]) => {
        const filtered = items.filter(i => i.toLowerCase().includes(search.toLowerCase()));
        if (filtered.length === 0) return null;
        return (
          <div key={cat}>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">{cat}</Label>
            <div className="flex flex-wrap gap-2">
              {filtered.map(ind => {
                const isSelected = form.selectedIndicators.includes(ind);
                return (
                  <button
                    key={ind}
                    onClick={() => toggleIndicator(ind)}
                    className={`px-3 py-1.5 rounded-full text-2xs font-semibold border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-primary/30 text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/10"
                    }`}
                  >
                    {isSelected && "✓ "}{ind}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 3: Entry Conditions ── */
function ConditionRow({ condition, onChange, onRemove, label, showRemove }: {
  condition: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
  label: string;
  showRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="text-2xs font-bold text-primary uppercase w-8">{label}</span>
      <Select value={condition.indicator} onValueChange={(v) => onChange({ ...condition, indicator: v })}>
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="rsi">RSI(14)</SelectItem>
          <SelectItem value="ema">EMA(21)</SelectItem>
          <SelectItem value="macd">MACD</SelectItem>
          <SelectItem value="adx">ADX</SelectItem>
        </SelectContent>
      </Select>
      <Select value={condition.operator} onValueChange={(v) => onChange({ ...condition, operator: v })}>
        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="lt">&lt;</SelectItem>
          <SelectItem value="gt">&gt;</SelectItem>
          <SelectItem value="cross_above">cross ↑</SelectItem>
          <SelectItem value="cross_below">cross ↓</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        className="w-20"
      />
      {showRemove && (
        <button onClick={onRemove} className="text-2xs text-rose-500-500 hover:text-rose-500-400 font-semibold ml-1">✕</button>
      )}
    </div>
  );
}

function StepEntry({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const addLongCondition = () => {
    setForm(prev => ({
      ...prev,
      longConditions: [...prev.longConditions, { id: conditionIdCounter++, indicator: "rsi", operator: "lt", value: "30" }],
    }));
  };
  const addShortCondition = () => {
    setForm(prev => ({
      ...prev,
      shortConditions: [...prev.shortConditions, { id: conditionIdCounter++, indicator: "rsi", operator: "gt", value: "70" }],
    }));
  };
  const updateLong = (idx: number, c: Condition) => {
    setForm(prev => {
      const conds = [...prev.longConditions];
      conds[idx] = c;
      return { ...prev, longConditions: conds };
    });
  };
  const updateShort = (idx: number, c: Condition) => {
    setForm(prev => {
      const conds = [...prev.shortConditions];
      conds[idx] = c;
      return { ...prev, shortConditions: conds };
    });
  };
  const removeLong = (idx: number) => {
    setForm(prev => ({ ...prev, longConditions: prev.longConditions.filter((_, i) => i !== idx) }));
  };
  const removeShort = (idx: number) => {
    setForm(prev => ({ ...prev, shortConditions: prev.shortConditions.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs font-bold text-ft-green mb-2 block">Long Entry Conditions</Label>
        <Card className="p-4">
          {form.longConditions.map((c, i) => (
            <ConditionRow
              key={c.id}
              condition={c}
              onChange={(updated) => updateLong(i, updated)}
              onRemove={() => removeLong(i)}
              label={i === 0 ? "IF" : "AND"}
              showRemove={form.longConditions.length > 1}
            />
          ))}
          <button onClick={addLongCondition} className="text-2xs text-primary font-semibold hover:text-primary/80 mt-1">+ Add condition</button>
        </Card>
      </div>
      <div>
        <Label className="text-xs font-bold text-ft-red mb-2 block">Short Entry Conditions</Label>
        <Card className="p-4">
          {form.shortConditions.map((c, i) => (
            <ConditionRow
              key={c.id}
              condition={c}
              onChange={(updated) => updateShort(i, updated)}
              onRemove={() => removeShort(i)}
              label={i === 0 ? "IF" : "AND"}
              showRemove={form.shortConditions.length > 1}
            />
          ))}
          <button onClick={addShortCondition} className="text-2xs text-primary font-semibold hover:text-primary/80 mt-1">+ Add condition</button>
        </Card>
      </div>
    </div>
  );
}

/* ── Step 4: Exit ── */
function StepExit({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const addExitCondition = () => {
    setForm(prev => ({
      ...prev,
      exitConditions: [...prev.exitConditions, { id: conditionIdCounter++, indicator: "rsi", operator: "gt", value: "70" }],
    }));
  };
  const updateExit = (idx: number, c: Condition) => {
    setForm(prev => {
      const conds = [...prev.exitConditions];
      conds[idx] = c;
      return { ...prev, exitConditions: conds };
    });
  };
  const removeExit = (idx: number) => {
    setForm(prev => ({ ...prev, exitConditions: prev.exitConditions.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs font-bold mb-2 block">Custom Exit Conditions</Label>
        <Card className="p-4">
          {form.exitConditions.map((c, i) => (
            <ConditionRow
              key={c.id}
              condition={c}
              onChange={(updated) => updateExit(i, updated)}
              onRemove={() => removeExit(i)}
              label={i === 0 ? "EXIT" : "OR"}
              showRemove={form.exitConditions.length > 1}
            />
          ))}
          <button onClick={addExitCondition} className="text-2xs text-primary font-semibold hover:text-primary/80 mt-1">+ Add condition</button>
        </Card>
      </div>
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Note:</strong> Beyond custom exit signals, FreqTrade also exits via minimal_roi, stoploss, trailing_stop, and FT Protections (configured in the Risk step).
      </div>
    </div>
  );
}

/* ── Step 5: Risk ── */
function StepRisk({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const addRoiRow = () => {
    setForm(prev => ({
      ...prev,
      roiRows: [...prev.roiRows, { id: conditionIdCounter++, time: "0", roi: "0.01" }],
    }));
  };
  const updateRoiRow = (idx: number, field: "time" | "roi", value: string) => {
    setForm(prev => {
      const rows = [...prev.roiRows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, roiRows: rows };
    });
  };
  const removeRoiRow = (idx: number) => {
    setForm(prev => ({ ...prev, roiRows: prev.roiRows.filter((_, i) => i !== idx) }));
  };
  const toggleProtection = (name: string) => {
    setForm(prev => ({
      ...prev,
      protections: { ...prev.protections, [name]: !prev.protections[name] },
    }));
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">stoploss</Label>
          <Input
            value={form.stoploss}
            onChange={(e) => setForm(prev => ({ ...prev, stoploss: e.target.value }))}
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">stake_amount</Label>
          <Input
            value={form.stakeAmount}
            onChange={(e) => setForm(prev => ({ ...prev, stakeAmount: e.target.value }))}
            className="mt-1 font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">max_open_trades</Label>
          <Input
            value={form.maxOpenTrades}
            onChange={(e) => setForm(prev => ({ ...prev, maxOpenTrades: e.target.value }))}
            className="mt-1 font-mono"
          />
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-xs font-bold">Trailing Stop</Label>
          <Switch
            checked={form.trailingStop}
            onCheckedChange={(v) => setForm(prev => ({ ...prev, trailingStop: v }))}
          />
        </div>
        {form.trailingStop && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-2xs text-muted-foreground">trailing_stop_positive</Label>
              <Input
                value={form.trailingStopPositive}
                onChange={(e) => setForm(prev => ({ ...prev, trailingStopPositive: e.target.value }))}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">trailing_stop_positive_offset</Label>
              <Input
                value={form.trailingStopPositiveOffset}
                onChange={(e) => setForm(prev => ({ ...prev, trailingStopPositiveOffset: e.target.value }))}
                className="mt-1 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <Label className="text-xs font-bold mb-2 block">minimal_roi</Label>
        <div className="space-y-2">
          {form.roiRows.map((r, i) => (
            <div key={r.id} className="flex gap-2 items-center">
              <Input
                value={r.time}
                onChange={(e) => updateRoiRow(i, "time", e.target.value)}
                className="w-20 font-mono"
                placeholder="min"
              />
              <span className="text-2xs text-muted-foreground">-&gt;</span>
              <Input
                value={r.roi}
                onChange={(e) => updateRoiRow(i, "roi", e.target.value)}
                className="w-20 font-mono"
                placeholder="ROI"
              />
              {form.roiRows.length > 1 && (
                <button onClick={() => removeRoiRow(i)} className="text-2xs text-rose-500-500 hover:text-rose-500-400 font-semibold">✕</button>
              )}
            </div>
          ))}
          <button onClick={addRoiRow} className="text-2xs text-primary font-semibold hover:text-primary/80">+ Add ROI level</button>
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-xs font-bold mb-3 block">FT Protections</Label>
        <div className="space-y-3">
          {[
            { name: "StoplossGuard", desc: "Lock after N stoploss in timeframe" },
            { name: "MaxDrawdown", desc: "Lock after max drawdown in period" },
            { name: "CooldownPeriod", desc: "Wait N candles after trade" },
          ].map(p => (
            <div key={p.name} className="flex items-center justify-between py-2 px-3 bg-primary/20 rounded-btn">
              <div>
                <div className="text-xs font-semibold text-foreground">{p.name}</div>
                <div className="text-2xs text-muted-foreground">{p.desc}</div>
              </div>
              <Switch
                checked={!!form.protections[p.name]}
                onCheckedChange={() => toggleProtection(p.name)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step 6: Review ── */
function StepReview({ form }: { form: FormState }) {
  const activeProtections = Object.entries(form.protections).filter(([, v]) => v).length;
  return (
    <div className="space-y-4">
      <div className="bg-ft-green/8 border border-ft-green/20 rounded-lg p-4 text-sm text-ft-green font-semibold flex items-center gap-2">
        Strategy ready! Review the configuration below, then save or backtest.
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: "Basics", items: [
            `Name: ${form.strategyName || "(unnamed)"}`,
            `Exchange: ${form.exchange}`,
            `TF: ${form.timeframe}`,
            `Leverage: ${form.leverage}`,
            `Pairs: ${form.selectedPairs.length} selected`,
          ]},
          { title: "Indicators", items: [
            form.selectedIndicators.length > 0 ? form.selectedIndicators.join(", ") : "None selected",
          ]},
          { title: "Entry", items: [
            `Long: ${form.longConditions.length} condition(s)`,
            `Short: ${form.shortConditions.length} condition(s)`,
          ]},
          { title: "Risk", items: [
            `Stoploss: ${form.stoploss}`,
            `Trailing: ${form.trailingStop ? "ON" : "OFF"}${form.trailingStop ? ` (${form.trailingStopPositive}/${form.trailingStopPositiveOffset})` : ""}`,
            `ROI: ${form.roiRows.length} levels`,
            `Protections: ${activeProtections} active`,
          ]},
        ].map(c => (
          <Card key={c.title} className="p-4">
            <div className="text-sm font-bold text-foreground mb-2">{c.title}</div>
            <div className="space-y-1">
              {c.items.map(item => (
                <div key={item} className="text-2xs text-muted-foreground">{item}</div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── Code Preview Panel ── */
function CodePreview({ form }: { form: FormState }) {
  const indicatorMap: Record<string, string> = {
    "RSI": "df['rsi'] = ta.RSI(df, 14)",
    "EMA": "df['ema_21'] = ta.EMA(df, 21)\n        df['ema_50'] = ta.EMA(df, 50)",
    "SMA": "df['sma_20'] = ta.SMA(df, 20)",
    "WMA": "df['wma_20'] = ta.WMA(df, 20)",
    "ADX": "df['adx'] = ta.ADX(df)",
    "MACD": "macd = ta.MACD(df)\n        df['macd'] = macd['macd']\n        df['macdsignal'] = macd['macdsignal']",
    "Stochastic": "stoch = ta.STOCH(df)\n        df['slowk'] = stoch['slowk']",
    "CCI": "df['cci'] = ta.CCI(df)",
    "Williams%R": "df['willr'] = ta.WILLR(df)",
    "MFI": "df['mfi'] = ta.MFI(df)",
    "Bollinger Bands": "bb = ta.BBANDS(df)\n        df['bb_upper'] = bb['upperband']\n        df['bb_lower'] = bb['lowerband']",
    "ATR": "df['atr'] = ta.ATR(df)",
    "Keltner": "df['kc_upper'] = ta.EMA(df, 20) + 2 * ta.ATR(df)",
    "Donchian": "df['dc_upper'] = df['high'].rolling(20).max()",
    "OBV": "df['obv'] = ta.OBV(df)",
    "VWAP": "df['vwap'] = (df['volume'] * df['close']).cumsum() / df['volume'].cumsum()",
    "VolSMA": "df['vol_sma'] = df['volume'].rolling(20).mean()",
    "CMF": "df['cmf'] = ta.ADOSC(df)",
    "Supertrend": "# Supertrend calculation\n        df['supertrend'] = ta.SUPERTREND(df)",
    "Ichimoku": "# Ichimoku\n        df['ichi_conv'] = (df['high'].rolling(9).max() + df['low'].rolling(9).min()) / 2",
    "PSAR": "df['psar'] = ta.SAR(df)",
  };

  const opMap: Record<string, string> = {
    "lt": "<", "gt": ">", "cross_above": "crossed_above", "cross_below": "crossed_below",
  };

  const indCode = form.selectedIndicators.map(i => indicatorMap[i] || `# ${i}`).join("\n        ");

  const roiObj = form.roiRows.map(r => `        "${r.time}": ${r.roi}`).join(",\n");

  const longConds = form.longConditions.map(c => {
    if (c.operator === "cross_above" || c.operator === "cross_below") {
      return `(qtpylib.${opMap[c.operator]}(df['${c.indicator}'], ${c.value}))`;
    }
    return `(df['${c.indicator}'] ${opMap[c.operator] || "<"} ${c.value})`;
  }).join(" &\n            ");

  const exitConds = form.exitConditions.map(c => {
    if (c.operator === "cross_above" || c.operator === "cross_below") {
      return `(qtpylib.${opMap[c.operator]}(df['${c.indicator}'], ${c.value}))`;
    }
    return `(df['${c.indicator}'] ${opMap[c.operator] || ">"} ${c.value})`;
  }).join(" |\n            ");

  const className = form.strategyName.replace(/[^a-zA-Z0-9]/g, "") || "MyStrategy";

  const code = `class ${className}(IStrategy):
    """${form.description || "Auto-generated strategy"}"""

    INTERFACE_VERSION = 3
    timeframe = '${form.timeframe}'

    # ROI
    minimal_roi = {
${roiObj}
    }

    # Stoploss
    stoploss = ${form.stoploss}${form.trailingStop ? `
    trailing_stop = True
    trailing_stop_positive = ${form.trailingStopPositive}
    trailing_stop_positive_offset = ${form.trailingStopPositiveOffset}` : `
    trailing_stop = False`}

    def populate_indicators(self, df, metadata):
        ${indCode || "# No indicators selected"}
        return df

    def populate_entry_trend(self, df, metadata):
        df.loc[
            ${longConds || "(True)  # No conditions set"},
            'enter_long'] = 1
        return df

    def populate_exit_trend(self, df, metadata):
        df.loc[
            ${exitConds || "(True)  # No conditions set"},
            'exit_long'] = 1
        return df`;

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      console.info("Code copied to clipboard!");
    }).catch(() => {
      console.warn("Failed to copy. Check browser permissions.");
    });
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${className}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-[420px] flex-shrink-0 bg-[hsl(60,3%,8%)] border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-bold text-foreground">Code Preview</span>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="text-2xs font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded border border-primary/20">Copy</button>
          <button onClick={handleDownload} className="text-2xs font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded border border-primary/20">Download .py</button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <pre className="text-xs font-mono leading-relaxed text-muted-foreground whitespace-pre">
          <code>{code}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE
   ══════════════════════════════════════ */
export default function BuilderPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    strategyName: "MyNewStrategy",
    description: "",
    exchange: "binance",
    timeframe: "1h",
    selectedPairs: [...DEFAULT_PAIRS],
    leverage: "10x",
    marginMode: "isolated",
    tradingMode: "futures",
    selectedIndicators: [],
    longConditions: [
      { id: 1, indicator: "rsi", operator: "lt", value: "30" },
      { id: 2, indicator: "ema", operator: "cross_above", value: "50" },
    ],
    shortConditions: [
      { id: 3, indicator: "rsi", operator: "gt", value: "70" },
      { id: 4, indicator: "ema", operator: "cross_below", value: "50" },
    ],
    exitConditions: [
      { id: 5, indicator: "rsi", operator: "gt", value: "70" },
      { id: 6, indicator: "rsi", operator: "lt", value: "30" },
    ],
    stoploss: "-0.035",
    stakeAmount: "1000",
    maxOpenTrades: "5",
    trailingStop: true,
    trailingStopPositive: "0.01",
    trailingStopPositiveOffset: "0.02",
    trailingOnlyOffsetIsReached: false,
    roiRows: [
      { id: 10, time: "0", roi: "0.10" },
      { id: 11, time: "30", roi: "0.05" },
      { id: 12, time: "60", roi: "0.02" },
    ],
    protections: { StoplossGuard: false, MaxDrawdown: false, CooldownPeriod: false },
    enabledCallbacks: [],
  });

  const toggleCallback = (name: string) => {
    setForm(prev => ({
      ...prev,
      enabledCallbacks: prev.enabledCallbacks.includes(name)
        ? prev.enabledCallbacks.filter(x => x !== name)
        : [...prev.enabledCallbacks, name],
    }));
  };

  // Validation per step
  const isStepValid = useCallback((s: number): boolean => {
    switch (s) {
      case 0: return form.strategyName.trim().length > 0 && form.selectedPairs.length > 0;
      case 1: return true; // indicators optional
      case 2: return form.longConditions.length > 0;
      case 3: return true; // exit optional
      case 4: return form.stoploss.trim().length > 0;
      case 5: return true;
      default: return true;
    }
  }, [form]);

  const completedSteps = STEPS.map((_, i) => i < step && isStepValid(i));

  const handleNext = () => {
    if (!isStepValid(step)) {
      console.warn("Please fill in all required fields before proceeding.");
      return;
    }
    setStep(Math.min(STEPS.length - 1, step + 1));
  };

  const handleSaveDraft = () => {
    console.info("Strategy saved as draft: " + form.strategyName);
  };

  const handleSaveBacktest = () => {
    console.info("Starting backtest for: " + form.strategyName);
  };

  const stepContent = [
    <StepBasics key={0} form={form} setForm={setForm} />,
    <StepIndicators key={1} form={form} setForm={setForm} />,
    <StepEntry key={2} form={form} setForm={setForm} />,
    <StepExit key={3} form={form} setForm={setForm} />,
    <StepRisk key={4} form={form} setForm={setForm} />,
    <StepReview key={5} form={form} />,
  ];

  return (
    <div className="flex -m-7 -mb-12 h-[calc(100vh-56px)]">
      {/* Main wizard */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-7 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-extrabold text-foreground">Strategy Builder</h2>
              <p className="text-xs text-muted-foreground mt-1">Create or edit a strategy step by step</p>
            </div>
          </div>
          <StepIndicator current={step} completedSteps={completedSteps} />
        </div>

        <ScrollArea className="flex-1 px-7 pb-4">
          {stepContent[step]}

          {/* Callbacks tab -- shown on steps 2-4 */}
          {step >= 2 && step <= 4 && (
            <div className="mt-6">
              <Separator className="mb-4" />
              <details className="group">
                <summary className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-2 mb-3">
                  Advanced Callbacks <span className="text-2xs text-muted-foreground font-normal">(16 hooks)</span>
                  <span className="text-muted-foreground/50 group-open:rotate-90 transition-transform">&#9654;</span>
                </summary>
                <div className="grid grid-cols-2 gap-2">
                  {CALLBACKS.map(cb => (
                    <div key={cb.name} className="flex items-center justify-between py-2 px-3 bg-primary/20 rounded-btn">
                      <div>
                        <div className="text-xs font-mono font-semibold text-primary">{cb.name}</div>
                        <div className="text-2xs text-muted-foreground">{cb.desc}</div>
                      </div>
                      <Switch
                        checked={form.enabledCallbacks.includes(cb.name)}
                        onCheckedChange={() => toggleCallback(cb.name)}
                      />
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </ScrollArea>

        {/* Footer navigation */}
        <div className="px-7 py-4 border-t border-border flex items-center justify-between bg-card">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            &larr; Previous
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="text-xs" onClick={handleSaveDraft}>Save as Draft</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={handleNext}>
                Next &rarr;
              </Button>
            ) : (
              <Button className="bg-ft-green text-white hover:bg-ft-green/90" onClick={handleSaveBacktest}>
                Save &amp; Backtest
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Code preview */}
      <CodePreview form={form} />
    </div>
  );
}
