"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
// Separator not needed
import { Progress } from "@/components/ui/progress";

/* ══════════════════════════════════════
   DATA — Data Management & Utilities
   ══════════════════════════════════════ */

const UTILITIES = [
  { cmd: "list-strategies", icon: "S", label: "List Strategies", desc: "Show all available strategies",
    output: "Found 26 strategies:\n  - TrendFollowerV3\n  - MeanReversionV2\n  - HLScalperV1\n  - BreakoutAI\n  - BollingerBounce\n  - RSIHunter\n  - ... (20 more)" },
  { cmd: "list-exchanges", icon: "E", label: "List Exchanges", desc: "Show supported exchanges",
    output: "Supported exchanges:\n  - binance (futures: yes)\n  - bybit (futures: yes)\n  - okx (futures: yes)\n  - hyperliquid (futures: yes)\n  - bitget (futures: yes)\n  - kraken (futures: no)\n  - gate (futures: yes)" },
  { cmd: "list-timeframes", icon: "T", label: "List Timeframes", desc: "Show available timeframes for exchange",
    output: "Timeframes for binance:\n  1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M" },
  { cmd: "list-pairs", icon: "P", label: "List Pairs", desc: "Show trading pairs for exchange",
    output: "Available futures pairs (binance): 312 total\n  BTC/USDT, ETH/USDT, SOL/USDT, DOGE/USDT, LINK/USDT,\n  AVAX/USDT, ADA/USDT, DOT/USDT, MATIC/USDT, UNI/USDT,\n  ... (302 more)" },
  { cmd: "list-data", icon: "D", label: "List Data", desc: "Show downloaded data",
    output: "Downloaded data:\n  BTC/USDT  1h    2020-01-01 → 2026-03-29  54,120 candles\n  ETH/USDT  1h    2020-01-01 → 2026-03-29  54,120 candles\n  SOL/USDT  5m    2023-01-01 → 2026-03-29  340,416 candles\n  BTC/USDT  5m    2024-01-01 → 2026-03-29  236,160 candles" },
  { cmd: "convert-data", icon: "C", label: "Convert Data", desc: "Convert data format (JSON to Feather)",
    output: "Converting data...\n  BTC/USDT 1h: JSON → Feather ... done (12.4 MB → 8.1 MB)\n  ETH/USDT 1h: JSON → Feather ... done (12.1 MB → 7.9 MB)\nConversion complete. Saved 8.4 MB total." },
  { cmd: "test-pairlist", icon: "L", label: "Test Pairlist", desc: "Test pairlist configuration",
    output: "Testing pairlist configuration...\nPairlist handler: VolumePairList (number_assets=20)\nFilters: SpreadFilter (max_spread_ratio=0.005)\n\nResult: 18 pairs passed filters\n  BTC/USDT, ETH/USDT, SOL/USDT, DOGE/USDT, LINK/USDT,\n  AVAX/USDT, ADA/USDT, DOT/USDT, ... (10 more)" },
  { cmd: "show-trades", icon: "H", label: "Show Trades", desc: "Display trade history from DB",
    output: "Trade history (last 10):\n  #312  BTC/USDT  LONG   +2.41%  $24.10  3h 20m  (roi)\n  #311  ETH/USDT  SHORT  -0.82%  -$8.20  1h 45m  (stoploss)\n  #310  SOL/USDT  LONG   +1.15%  $11.50  2h 10m  (exit_signal)\n  #309  BTC/USDT  LONG   +0.67%  $6.70   4h 30m  (roi)\n  ... (306 more)" },
  { cmd: "hyperopt-loss", icon: "O", label: "Hyperopt Loss Fns", desc: "List available hyperopt loss functions",
    output: "Available loss functions:\n  - SharpeHyperOptLoss\n  - SortinohyperOptLoss\n  - OnlyProfitHyperOptLoss\n  - SharpeHyperOptLossDaily\n  - MaxDrawDownHyperOptLoss\n  - CalmarHyperOptLoss\n  - ProfitDrawDownHyperOptLoss\n  - MaxDrawDownRelativeHyperOptLoss" },
  { cmd: "freqai-models", icon: "M", label: "FreqAI Models", desc: "List available FreqAI models",
    output: "Available FreqAI models:\n  Regressors: LightGBMRegressor, XGBoostRegressor, CatboostRegressor\n  Classifiers: LightGBMClassifier, XGBoostClassifier, CatboostClassifier\n  RL: ReinforcementLearner, ReinforcementLearner_multiproc\n  PyTorch: PyTorchMLPRegressor, PyTorchTransformerRegressor" },
];

interface DataRow {
  id: number;
  pair: string;
  tf: string;
  from: string;
  to: string;
  candles: string;
  size: string;
}

const INITIAL_DATA: DataRow[] = [
  { id: 1, pair: "BTC/USDT", tf: "1h", from: "2020-01-01", to: "2026-03-29", candles: "54,120", size: "48.2 MB" },
  { id: 2, pair: "ETH/USDT", tf: "1h", from: "2020-01-01", to: "2026-03-29", candles: "54,120", size: "47.8 MB" },
  { id: 3, pair: "SOL/USDT", tf: "5m", from: "2023-01-01", to: "2026-03-29", candles: "340,416", size: "285 MB" },
  { id: 4, pair: "BTC/USDT", tf: "5m", from: "2024-01-01", to: "2026-03-29", candles: "236,160", size: "198 MB" },
];

export default function DataPage() {
  const [output, setOutput] = useState("$ Ready. Select a utility command to run.\n");
  const [dataRows, setDataRows] = useState<DataRow[]>(INITIAL_DATA);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Download form state
  const [dlExchange, setDlExchange] = useState("binance");
  const [dlTimeframe, setDlTimeframe] = useState("1h");
  const [dlDateFrom, setDlDateFrom] = useState("2024-01-01");
  const [dlDateTo, setDlDateTo] = useState("2026-03-29");
  const [dlPairs, setDlPairs] = useState(["BTC/USDT", "ETH/USDT", "SOL/USDT"]);
  const [addingPair, setAddingPair] = useState(false);
  const [newPairInput, setNewPairInput] = useState("");

  // Scroll console to bottom on new output
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output]);

  // Download progress
  useEffect(() => {
    if (!isDownloading) return;
    const lines = [
      `Downloading ${dlPairs.join(", ")} (${dlTimeframe}) from ${dlExchange}...`,
      `Date range: ${dlDateFrom} to ${dlDateTo}`,
      "",
    ];
    let lineIdx = 0;
    let progress = 0;

    // Add initial lines
    setOutput(prev => prev + `$ freqtrade download-data --exchange ${dlExchange} --timeframe ${dlTimeframe}\n`);

    const timer = setInterval(() => {
      progress += 5;
      setDownloadProgress(progress);

      if (lineIdx < lines.length) {
        setOutput(prev => prev + lines[lineIdx] + "\n");
        lineIdx++;
      } else if (progress < 100) {
        const pairIdx = Math.floor((progress / 100) * dlPairs.length);
        const pair = dlPairs[Math.min(pairIdx, dlPairs.length - 1)];
        setOutput(prev => prev + `  ${pair}: downloading... ${progress}%\n`);
      }

      if (progress >= 100) {
        clearInterval(timer);
        setIsDownloading(false);
        setOutput(prev => prev + `\nDownload complete! ${dlPairs.length} pairs downloaded.\n\n`);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [isDownloading, dlPairs, dlTimeframe, dlExchange, dlDateFrom, dlDateTo]);

  const handleDownload = () => {
    if (isDownloading || dlPairs.length === 0) return;
    setDownloadProgress(0);
    setIsDownloading(true);
  };

  const handleUtilityClick = (u: typeof UTILITIES[number]) => {
    setOutput(prev => prev + `$ freqtrade ${u.cmd}\n${u.output}\n\n`);
  };

  const handleClearConsole = () => {
    setOutput("$ Ready.\n");
  };

  const handleDeleteRow = (id: number) => {
    const row = dataRows.find(r => r.id === id);
    if (row && confirm(`Delete ${row.pair} ${row.tf} data (${row.size})?`)) {
      setDataRows(prev => prev.filter(r => r.id !== id));
      setOutput(prev => prev + `$ Deleted ${row.pair} ${row.tf} data.\n\n`);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setOutput(prev => prev + "$ Refreshing data list...\n");
    setTimeout(() => {
      setIsRefreshing(false);
      setOutput(prev => prev + "Data list refreshed.\n\n");
    }, 800);
  };

  const addPair = () => {
    const pair = newPairInput.trim().toUpperCase();
    if (pair && !dlPairs.includes(pair)) {
      setDlPairs(prev => [...prev, pair]);
    }
    setNewPairInput("");
    setAddingPair(false);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Data Management</h2>
          <p className="text-xs text-muted-foreground mt-1">Download, convert, and manage market data</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4 mb-6">
        {/* Download Form */}
        <Card>
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span>Download Data</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Exchange</Label>
                <Select value={dlExchange} onValueChange={setDlExchange}>
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
                <Select value={dlTimeframe} onValueChange={setDlTimeframe}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["5m", "15m", "1h", "4h", "1d"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={dlDateFrom} onChange={(e) => setDlDateFrom(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={dlDateTo} onChange={(e) => setDlDateTo(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Pairs</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {dlPairs.map(p => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="text-2xs cursor-pointer hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => setDlPairs(prev => prev.filter(x => x !== p))}
                  >
                    {p} ✕
                  </Badge>
                ))}
                {addingPair ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newPairInput}
                      onChange={(e) => setNewPairInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addPair();
                        if (e.key === "Escape") { setAddingPair(false); setNewPairInput(""); }
                      }}
                      placeholder="e.g. DOGE/USDT"
                      className="w-28 h-7 text-2xs"
                      autoFocus
                    />
                    <Button variant="outline" size="sm" className="h-7 text-2xs px-2" onClick={addPair}>Add</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingPair(true)}
                    className="text-2xs text-primary font-semibold hover:text-primary/80"
                  >
                    + Add pair
                  </button>
                )}
              </div>
            </div>
            {isDownloading && <Progress value={downloadProgress} className="h-2" />}
            <Button className="w-full" onClick={handleDownload} disabled={isDownloading || dlPairs.length === 0}>
              {isDownloading ? `Downloading... ${downloadProgress}%` : "Download Data"}
            </Button>
          </CardContent>
        </Card>

        {/* Output Console */}
        <Card>
          <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span>Output</span>
            </CardTitle>
            <button className="text-2xs text-primary font-semibold" onClick={handleClearConsole}>Clear</button>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div
              ref={consoleRef}
              className="bg-[hsl(60,3%,8%)] rounded-lg p-4 h-[260px] overflow-y-auto font-mono text-xs text-ft-green/80 whitespace-pre leading-relaxed"
            >
              {output}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Utility Commands */}
      <Card className="mb-6">
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span>Utility Commands</span> <span className="text-2xs font-normal text-muted-foreground">(10 available)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="grid grid-cols-5 gap-3">
            {UTILITIES.map(u => (
              <button
                key={u.cmd}
                onClick={() => handleUtilityClick(u)}
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-lg border border-border bg-accent/20 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all text-center"
              >
                <span className="text-xl w-8 h-8 flex items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-sm">{u.icon}</span>
                <span className="text-2xs font-bold text-foreground">{u.label}</span>
                <span className="text-2xs text-muted-foreground leading-tight">{u.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Summary */}
      <Card>
        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span>Downloaded Data</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="text-2xs h-7"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          {dataRows.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">No downloaded data. Use the download form above to get started.</div>
          ) : (
            <div className="space-y-2">
              {dataRows.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5 px-4 bg-accent/20 rounded-btn">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-foreground">{d.pair}</span>
                    <Badge variant="outline" className="text-2xs">{d.tf}</Badge>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground">
                    <span>{d.from} &rarr; {d.to}</span>
                    <span className="font-mono-data">{d.candles} candles</span>
                    <span className="font-mono-data font-semibold text-foreground">{d.size}</span>
                    <button
                      onClick={() => handleDeleteRow(d.id)}
                      className="text-2xs text-ft-red/70 hover:text-ft-red font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
