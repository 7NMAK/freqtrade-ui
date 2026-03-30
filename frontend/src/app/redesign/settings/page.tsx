"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

/* ══════════════════════════════════════
   SETTINGS — 7 Tabs Config (Interactive)
   ══════════════════════════════════════ */

/* ── Default values for reset ── */
const DEFAULTS = {
  // General
  bot_name: "bot-trend-01",
  initial_state: "running",
  db_url: "sqlite:///tradesv3.sqlite",
  dry_run: false,
  process_throttle_secs: "5",
  heartbeat_interval: "60",
  sd_notify: false,
  internals_process_throttle: "5",
  internals_heartbeat: "60",
  // Exchange
  exchange: "binance",
  markets_refresh: "60",
  api_key: "",
  api_secret: "",
  ccxt_config: '{"enableRateLimit": true}',
  ccxt_sync_config: "{}",
  rate_limiting: true,
  // Telegram
  tg_enabled: true,
  tg_token: "",
  tg_chat_id: "-1001234567890",
  tg_notifications: {
    entry: true, entry_fill: false, exit: true, exit_fill: true,
    protection_trigger: false, status: true, warning: false,
    startup: false, buy_cancel: false, sell_cancel: false,
  } as Record<string, boolean>,
  tg_balance_dust: "0.01",
  // Webhooks
  wh_enabled: false,
  wh_urls: { entry: "", entry_cancel: "", exit: "", exit_cancel: "", exit_fill: "", status: "" } as Record<string, string>,
  wh_format: "json",
  wh_retries: "3",
  // Producer/Consumer
  pc_role: "standalone",
  pc_producers: [
    { name: "bot-trend-01", url: "ws://localhost:8080/api/v1/message/ws", status: "Connected" },
  ],
  pc_api_port: "8080",
  pc_ws_token: "",
  // Advanced
  trading_mode: "futures",
  margin_mode: "isolated",
  log_level: "info",
  custom_commands: "",
  // Pairlists
  pairlist_handlers: [
    { name: "VolumePairList", config: "number_assets: 30, sort_key: quoteVolume", showSettings: false },
    { name: "AgeFilter", config: "min_days_listed: 10", showSettings: false },
    { name: "PrecisionFilter", config: "(no config)", showSettings: false },
    { name: "PriceFilter", config: "low_price_ratio: 0.01", showSettings: false },
    { name: "SpreadFilter", config: "max_spread_ratio: 0.005", showSettings: false },
  ],
};

const AVAILABLE_HANDLERS = [
  "VolumePairList", "StaticPairList", "ProducerPairList",
  "AgeFilter", "PrecisionFilter", "PriceFilter", "SpreadFilter",
  "RangeStabilityFilter", "ShuffleFilter", "OffsetFilter", "PerformanceFilter",
];

/* ── Tab 1: General ── */
function GeneralTab({ state, setState }: { state: typeof DEFAULTS; setState: (s: typeof DEFAULTS) => void }) {
  const set = (key: string, val: string | boolean) => setState({ ...state, [key]: val });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">Bot Name</Label>
          <Input value={state.bot_name} onChange={e => set("bot_name", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Initial State</Label>
          <Select value={state.initial_state} onValueChange={v => set("initial_state", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="running">running</SelectItem>
              <SelectItem value="stopped">stopped</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">db_url</Label>
          <Input value={state.db_url} onChange={e => set("db_url", e.target.value)} className="mt-1 font-mono-data text-2xs" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="dry-run" checked={state.dry_run} onCheckedChange={v => set("dry_run", v)} />
        <Label htmlFor="dry-run" className="text-xs">dry_run <span className="text-muted-foreground">(Paper trading mode)</span></Label>
      </div>
      <Separator />
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-2xs text-muted-foreground">process_throttle_secs</Label>
          <Input value={state.process_throttle_secs} onChange={e => set("process_throttle_secs", e.target.value)} className="mt-1 font-mono-data" />
        </div>
        <div>
          <Label className="text-2xs text-muted-foreground">heartbeat_interval</Label>
          <Input value={state.heartbeat_interval} onChange={e => set("heartbeat_interval", e.target.value)} className="mt-1 font-mono-data" />
        </div>
        <div>
          <Label className="text-2xs text-muted-foreground">sd_notify (systemd)</Label>
          <Switch checked={state.sd_notify} onCheckedChange={v => set("sd_notify", v)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-2xs text-muted-foreground">internals.process_throttle_secs</Label>
          <Input value={state.internals_process_throttle} onChange={e => set("internals_process_throttle", e.target.value)} className="mt-1 font-mono-data" />
        </div>
        <div>
          <Label className="text-2xs text-muted-foreground">internals.heartbeat_interval</Label>
          <Input value={state.internals_heartbeat} onChange={e => set("internals_heartbeat", e.target.value)} className="mt-1 font-mono-data" />
        </div>
      </div>
    </div>
  );
}

/* ── Tab 2: Pairlists ── */
function PairlistsTab({ state, setState }: { state: typeof DEFAULTS; setState: (s: typeof DEFAULTS) => void }) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  const toggleSettings = (index: number) => {
    const updated = state.pairlist_handlers.map((h, i) =>
      i === index ? { ...h, showSettings: !h.showSettings } : h
    );
    setState({ ...state, pairlist_handlers: updated });
  };

  const removeHandler = (index: number) => {
    const updated = state.pairlist_handlers.filter((_, i) => i !== index);
    setState({ ...state, pairlist_handlers: updated });
  };

  const addHandler = (name: string) => {
    const updated = [...state.pairlist_handlers, { name, config: "(no config)", showSettings: false }];
    setState({ ...state, pairlist_handlers: updated });
    setShowAddDropdown(false);
  };

  const moveHandler = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= state.pairlist_handlers.length) return;
    const updated = [...state.pairlist_handlers];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setState({ ...state, pairlist_handlers: updated });
  };

  const usedNames = new Set(state.pairlist_handlers.map(h => h.name));
  const availableToAdd = AVAILABLE_HANDLERS.filter(h => !usedNames.has(h));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Pairlists are processed as a chain — top to bottom. Use arrows to reorder.</p>
      <div className="space-y-2">
        {state.pairlist_handlers.map((h, i) => (
          <div key={`${h.name}-${i}`}>
            <div className="flex items-center gap-3 py-3 px-4 bg-accent/20 rounded-lg border border-border">
              <div className="flex flex-col gap-0.5">
                <button
                  className="text-muted-foreground/60 hover:text-foreground text-xs leading-none disabled:opacity-20"
                  disabled={i === 0}
                  onClick={() => moveHandler(i, "up")}
                >
                  ▲
                </button>
                <button
                  className="text-muted-foreground/60 hover:text-foreground text-xs leading-none disabled:opacity-20"
                  disabled={i === state.pairlist_handlers.length - 1}
                  onClick={() => moveHandler(i, "down")}
                >
                  ▼
                </button>
              </div>
              <span className="text-xs font-bold text-foreground w-6">{i + 1}.</span>
              <div className="flex-1">
                <div className="text-xs font-bold text-primary">{h.name}</div>
                <div className="text-2xs text-muted-foreground font-mono-data">{h.config}</div>
              </div>
              <button className="text-2xs text-muted-foreground hover:text-foreground" onClick={() => toggleSettings(i)}>
                {h.showSettings ? "✕ Close" : "⚙️"}
              </button>
              <button className="text-2xs text-ft-red/70 hover:text-ft-red" onClick={() => removeHandler(i)}>✕</button>
            </div>
            {h.showSettings && (
              <div className="ml-8 mt-1 mb-2 p-3 bg-accent/10 rounded-lg border border-border/50">
                <Label className="text-2xs text-muted-foreground mb-1 block">Configuration for {h.name}</Label>
                <Input
                  value={h.config}
                  onChange={e => {
                    const updated = state.pairlist_handlers.map((handler, idx) =>
                      idx === i ? { ...handler, config: e.target.value } : handler
                    );
                    setState({ ...state, pairlist_handlers: updated });
                  }}
                  className="font-mono-data text-2xs"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="relative">
        <Button variant="outline" className="text-xs" onClick={() => setShowAddDropdown(!showAddDropdown)}>
          + Add Pairlist Handler
        </Button>
        {showAddDropdown && (
          <div className="absolute top-full mt-1 left-0 z-10 w-64 bg-card border border-border rounded-lg shadow-lg p-1">
            {availableToAdd.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2">All handlers already added</div>
            ) : (
              availableToAdd.map(name => (
                <button
                  key={name}
                  className="w-full text-left text-xs px-3 py-2 rounded hover:bg-accent/30 transition-colors"
                  onClick={() => addHandler(name)}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tab 3: Exchange ── */
function ExchangeTab({ state, setState }: { state: typeof DEFAULTS; setState: (s: typeof DEFAULTS) => void }) {
  const set = (key: string, val: string | boolean) => setState({ ...state, [key]: val });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Exchange</Label>
          <Select value={state.exchange} onValueChange={v => set("exchange", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="binance">Binance</SelectItem>
              <SelectItem value="hyperliquid">Hyperliquid</SelectItem>
              <SelectItem value="bitget">Bitget</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Markets Refresh Period</Label>
          <Input value={state.markets_refresh} onChange={e => set("markets_refresh", e.target.value)} className="mt-1 font-mono-data" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">API Key</Label>
          <Input type="password" value={state.api_key} onChange={e => set("api_key", e.target.value)} placeholder="Enter API key" className="mt-1 font-mono-data" />
        </div>
        <div>
          <Label className="text-xs">API Secret</Label>
          <Input type="password" value={state.api_secret} onChange={e => set("api_secret", e.target.value)} placeholder="Enter API secret" className="mt-1 font-mono-data" />
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-xs font-bold mb-2 block">ccxt_config (advanced)</Label>
        <Textarea value={state.ccxt_config} onChange={e => set("ccxt_config", e.target.value)} className="font-mono-data text-xs h-20" />
      </div>
      <div>
        <Label className="text-xs font-bold mb-2 block">ccxt_sync_config</Label>
        <Textarea value={state.ccxt_sync_config} onChange={e => set("ccxt_sync_config", e.target.value)} className="font-mono-data text-xs h-16" />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={state.rate_limiting} onCheckedChange={v => set("rate_limiting", v)} />
        <Label className="text-xs">Enable Rate Limiting</Label>
      </div>
    </div>
  );
}

/* ── Tab 4: Telegram ── */
function TelegramTab({ state, setState }: { state: typeof DEFAULTS; setState: (s: typeof DEFAULTS) => void }) {
  const setNotif = (key: string, val: boolean) => {
    setState({ ...state, tg_notifications: { ...state.tg_notifications, [key]: val } });
  };
  const set = (key: string, val: string | boolean) => setState({ ...state, [key]: val });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Switch id="tg-enable" checked={state.tg_enabled} onCheckedChange={v => set("tg_enabled", v)} />
        <Label htmlFor="tg-enable" className="text-xs font-bold">Enable Telegram</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Bot Token</Label>
          <Input type="password" value={state.tg_token} onChange={e => set("tg_token", e.target.value)} placeholder="Enter bot token" className="mt-1 font-mono-data" />
        </div>
        <div>
          <Label className="text-xs">Chat ID</Label>
          <Input value={state.tg_chat_id} onChange={e => set("tg_chat_id", e.target.value)} className="mt-1 font-mono-data" />
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-xs font-bold mb-3 block">Notification Toggles</Label>
        <div className="grid grid-cols-2 gap-2">
          {["entry", "entry_fill", "exit", "exit_fill", "protection_trigger", "status", "warning", "startup", "buy_cancel", "sell_cancel"].map(n => (
            <div key={n} className="flex items-center gap-3 py-1.5">
              <Switch checked={state.tg_notifications[n] ?? false} onCheckedChange={v => setNotif(n, v)} />
              <Label className="text-xs">{n}</Label>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-2xs text-muted-foreground">balance_dust_level</Label>
        <Input value={state.tg_balance_dust} onChange={e => set("tg_balance_dust", e.target.value)} className="mt-1 w-32 font-mono-data" />
      </div>
      <div>
        <Label className="text-xs font-bold mb-2 block">Keyboard Layout</Label>
        <div className="bg-accent/20 rounded-lg p-3 text-xs font-mono-data text-muted-foreground">
          [[&quot;/daily&quot;, &quot;/profit&quot;, &quot;/balance&quot;], [&quot;/status&quot;, &quot;/status table&quot;, &quot;/performance&quot;], [&quot;/count&quot;, &quot;/start&quot;, &quot;/stop&quot;]]
        </div>
      </div>
    </div>
  );
}

/* ── Tab 5: Webhooks ── */
function WebhooksTab({ state, setState }: { state: typeof DEFAULTS; setState: (s: typeof DEFAULTS) => void }) {
  const set = (key: string, val: string | boolean) => setState({ ...state, [key]: val });
  const setUrl = (key: string, val: string) => {
    setState({ ...state, wh_urls: { ...state.wh_urls, [key]: val } });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Switch id="wh-enable" checked={state.wh_enabled} onCheckedChange={v => set("wh_enabled", v)} />
        <Label htmlFor="wh-enable" className="text-xs font-bold">Enable Webhooks</Label>
      </div>
      {["entry", "entry_cancel", "exit", "exit_cancel", "exit_fill", "status"].map(ev => (
        <div key={ev}>
          <Label className="text-xs mb-1 block">{ev} webhook URL</Label>
          <Input
            value={state.wh_urls[ev] ?? ""}
            onChange={e => setUrl(ev, e.target.value)}
            placeholder={`https://hooks.example.com/${ev}`}
            className="font-mono-data text-2xs"
          />
        </div>
      ))}
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Format</Label>
          <Select value={state.wh_format} onValueChange={v => set("wh_format", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="form">Form</SelectItem>
              <SelectItem value="raw">Raw</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Retry Count</Label>
          <Input value={state.wh_retries} onChange={e => set("wh_retries", e.target.value)} className="mt-1 font-mono-data" />
        </div>
      </div>
    </div>
  );
}

/* ── Tab 6: Producer/Consumer ── */
function ProducerConsumerTab({ state, setState }: { state: typeof DEFAULTS; setState: (s: typeof DEFAULTS) => void }) {
  const set = (key: string, val: string) => setState({ ...state, [key]: val });

  const addProducer = () => {
    const name = `bot-new-${state.pc_producers.length + 1}`;
    const updated = [
      ...state.pc_producers,
      { name, url: `ws://localhost:${8080 + state.pc_producers.length}/api/v1/message/ws`, status: "Disconnected" },
    ];
    setState({ ...state, pc_producers: updated });
  };

  const removeProducer = (index: number) => {
    setState({ ...state, pc_producers: state.pc_producers.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs font-bold mb-2 block">Role</Label>
        <Select value={state.pc_role} onValueChange={v => set("pc_role", v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="standalone">Standalone</SelectItem>
            <SelectItem value="producer">Producer</SelectItem>
            <SelectItem value="consumer">Consumer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <Label className="text-xs font-bold mb-2 block">Producers</Label>
        <div className="space-y-2">
          {state.pc_producers.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex items-center gap-3 py-3 px-4 bg-accent/20 rounded-btn">
              <div className="flex-1">
                <div className="text-xs font-bold text-foreground">{p.name}</div>
                <div className="text-2xs text-muted-foreground font-mono-data">{p.url}</div>
              </div>
              <Badge className={`text-2xs ${p.status === "Connected" ? "bg-ft-green/15 text-ft-green" : "bg-ft-red/15 text-ft-red"}`}>
                {p.status}
              </Badge>
              <button className="text-2xs text-ft-red/70 hover:text-ft-red" onClick={() => removeProducer(i)}>✕</button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="text-xs mt-2" onClick={addProducer}>+ Add Producer</Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-2xs text-muted-foreground">API Server Port</Label>
          <Input value={state.pc_api_port} onChange={e => set("pc_api_port", e.target.value)} className="mt-1 font-mono-data" />
        </div>
        <div>
          <Label className="text-2xs text-muted-foreground">WS Token</Label>
          <Input type="password" value={state.pc_ws_token} onChange={e => set("pc_ws_token", e.target.value)} placeholder="Enter token" className="mt-1 font-mono-data" />
        </div>
      </div>
    </div>
  );
}

/* ── Tab 7: Advanced ── */
function AdvancedTab({ state, setState }: { state: typeof DEFAULTS; setState: (s: typeof DEFAULTS) => void }) {
  const set = (key: string, val: string) => setState({ ...state, [key]: val });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">trading_mode</Label>
          <Select value={state.trading_mode} onValueChange={v => set("trading_mode", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spot">Spot</SelectItem>
              <SelectItem value="futures">Futures</SelectItem>
              <SelectItem value="margin">Margin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">margin_mode</Label>
          <Select value={state.margin_mode} onValueChange={v => set("margin_mode", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="isolated">Isolated</SelectItem>
              <SelectItem value="cross">Cross</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-xs font-bold mb-2 block">Logging Level</Label>
        <Select value={state.log_level} onValueChange={v => set("log_level", v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="debug">DEBUG</SelectItem>
            <SelectItem value="info">INFO</SelectItem>
            <SelectItem value="warning">WARNING</SelectItem>
            <SelectItem value="error">ERROR</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-bold mb-2 block">Custom User Commands</Label>
        <Textarea value={state.custom_commands} onChange={e => set("custom_commands", e.target.value)} placeholder="Enter custom commands..." className="h-20 font-mono-data text-xs" />
      </div>
      <Separator />
      <div>
        <Label className="text-xs font-bold mb-2 block">Export Configuration</Label>
        <div className="flex gap-3">
          <Button variant="outline" className="text-xs" onClick={() => alert("Config JSON copied to clipboard (mock)")}>
            Export Config JSON
          </Button>
          <Button variant="outline" className="text-xs" onClick={() => alert("Strategy template exported (mock)")}>
            Export Strategy Template
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE
   ══════════════════════════════════════ */
export default function SettingsPage() {
  const [state, setState] = useState({ ...DEFAULTS });
  const [activeTab, setActiveTab] = useState("general");

  const handleReset = useCallback(() => {
    if (window.confirm("Reset all settings to default values? This cannot be undone.")) {
      setState({ ...DEFAULTS });
      alert("All settings have been reset to defaults.");
    }
  }, []);

  const handleSave = useCallback(() => {
    const changes: string[] = [];
    if (state.bot_name !== DEFAULTS.bot_name) changes.push(`bot_name: ${state.bot_name}`);
    if (state.dry_run !== DEFAULTS.dry_run) changes.push(`dry_run: ${state.dry_run}`);
    if (state.exchange !== DEFAULTS.exchange) changes.push(`exchange: ${state.exchange}`);
    if (state.trading_mode !== DEFAULTS.trading_mode) changes.push(`trading_mode: ${state.trading_mode}`);
    if (state.tg_enabled !== DEFAULTS.tg_enabled) changes.push(`telegram.enabled: ${state.tg_enabled}`);
    if (state.wh_enabled !== DEFAULTS.wh_enabled) changes.push(`webhooks.enabled: ${state.wh_enabled}`);
    if (state.pc_role !== DEFAULTS.pc_role) changes.push(`role: ${state.pc_role}`);
    if (state.log_level !== DEFAULTS.log_level) changes.push(`log_level: ${state.log_level}`);
    if (state.pairlist_handlers.length !== DEFAULTS.pairlist_handlers.length) changes.push(`pairlist_handlers: ${state.pairlist_handlers.length} handlers`);

    const summary = changes.length > 0
      ? `Configuration saved!\n\nChanged fields:\n${changes.join("\n")}`
      : "Configuration saved! (no fields changed from defaults)";
    alert(summary);
  }, [state]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground mt-1">FreqTrade bot configuration — 7 sections</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs" onClick={handleReset}>Reset to Defaults</Button>
          <Button className="text-xs" onClick={handleSave}>Save Configuration</Button>
        </div>
      </div>

      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="py-0 px-0">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 overflow-x-auto">
              {[
                { val: "general", icon: "⚙️", label: "General" },
                { val: "pairlists", icon: "💹", label: "Pairlists" },
                { val: "exchange", icon: "💱", label: "Exchange" },
                { val: "telegram", icon: "📱", label: "Telegram" },
                { val: "webhooks", icon: "🔗", label: "Webhooks" },
                { val: "producer", icon: "📡", label: "Prod/Consumer" },
                { val: "advanced", icon: "🔧", label: "Advanced" },
              ].map(t => (
                <TabsTrigger key={t.val} value={t.val} className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-3 whitespace-nowrap">
                  {t.icon} {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>
          <CardContent className="p-5">
            <TabsContent value="general" className="mt-0"><GeneralTab state={state} setState={setState} /></TabsContent>
            <TabsContent value="pairlists" className="mt-0"><PairlistsTab state={state} setState={setState} /></TabsContent>
            <TabsContent value="exchange" className="mt-0"><ExchangeTab state={state} setState={setState} /></TabsContent>
            <TabsContent value="telegram" className="mt-0"><TelegramTab state={state} setState={setState} /></TabsContent>
            <TabsContent value="webhooks" className="mt-0"><WebhooksTab state={state} setState={setState} /></TabsContent>
            <TabsContent value="producer" className="mt-0"><ProducerConsumerTab state={state} setState={setState} /></TabsContent>
            <TabsContent value="advanced" className="mt-0"><AdvancedTab state={state} setState={setState} /></TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </>
  );
}
