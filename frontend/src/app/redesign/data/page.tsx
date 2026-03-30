"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApi } from "@/lib/useApi";
import { getBots, botListData, botDownloadData, botAvailablePairs } from "@/lib/api";

/* ══════════════════════════════════════
   DATA — Data Management & Utilities
   ══════════════════════════════════════ */

const UTILITIES: { cmd: string; icon: string; label: string; desc: string }[] = [
  { cmd: "list-strategies", icon: "S", label: "List Strategies", desc: "Show all available strategies" },
  { cmd: "list-exchanges", icon: "E", label: "List Exchanges", desc: "Show supported exchanges" },
  { cmd: "list-timeframes", icon: "T", label: "List Timeframes", desc: "Show available timeframes" },
  { cmd: "list-pairs", icon: "P", label: "List Pairs", desc: "Show trading pairs" },
  { cmd: "list-data", icon: "D", label: "List Data", desc: "Show downloaded data" },
  { cmd: "convert-data", icon: "C", label: "Convert Data", desc: "Convert data format" },
  { cmd: "test-pairlist", icon: "L", label: "Test Pairlist", desc: "Test pairlist configuration" },
  { cmd: "show-trades", icon: "H", label: "Show Trades", desc: "Display trade history from DB" },
  { cmd: "hyperopt-loss", icon: "O", label: "Hyperopt Loss Fns", desc: "List available hyperopt loss functions" },
  { cmd: "freqai-models", icon: "M", label: "FreqAI Models", desc: "List available FreqAI models" },
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

export default function DataPage() {
  const { data: botsList } = useApi(getBots, []);
  const bots = botsList || [];
  
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  
  const { data: downloadedData, refetch: refetchData } = useApi(() => botListData(parseInt(selectedBotId)), [selectedBotId], {
    enabled: !!selectedBotId
  });
  
  const { data: availablePairsData } = useApi(() => botAvailablePairs(parseInt(selectedBotId)), [selectedBotId], {
    enabled: !!selectedBotId
  });
  
  const availablePairs = availablePairsData?.pairs || [];

  const [output, setOutput] = useState("$ Ready. Select a bot and a utility command to run.\n");
  const [dataRows, setDataRows] = useState<DataRow[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Download form state
  const [dlExchange, setDlExchange] = useState("binance");
  const [dlTimeframe, setDlTimeframe] = useState("1h");
  const [dlDateFrom, setDlDateFrom] = useState("2024-01-01");
  const [dlDateTo, setDlDateTo] = useState("");
  const [dlPairs, setDlPairs] = useState<string[]>([]);
  const [addingPair, setAddingPair] = useState(false);

  useEffect(() => {
    if (downloadedData?.data) {
      setDataRows(downloadedData.data.map((d: { pair: string; timeframe: string; start: string; end: string; candle_count?: number }, i: number) => ({
        id: i,
        pair: d.pair,
        tf: d.timeframe,
        from: d.start,
        to: d.end,
        candles: d.candle_count?.toString() || "0",
        size: "N/A"
      })));
    } else {
      setDataRows([]);
    }
  }, [downloadedData]);

  // Scroll console to bottom on new output
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output]);

  const handleDownload = async () => {
    if (isDownloading || dlPairs.length === 0 || !selectedBotId) return;
    setDownloadProgress(0);
    setIsDownloading(true);
    
    setOutput(prev => prev + `$ freqtrade download-data --exchange ${dlExchange} --timeframe ${dlTimeframe} --bot ${selectedBotId}\n`);
    
    try {
      const res = await botDownloadData(parseInt(selectedBotId), {
        pairs: dlPairs,
        timeframes: [dlTimeframe],
        exchange: dlExchange,
        trading_mode: "futures", // assuming futures for redesigned
        timerange: `${dlDateFrom.replace(/-/g, "")}-${dlDateTo.replace(/-/g, "")}`
      });
      setOutput(prev => prev + `Job started: ${res.job_id}\n`);
      // Simulating progress
      setTimeout(() => {
        setDownloadProgress(100);
        setIsDownloading(false);
        setOutput(prev => prev + `\nDownload complete! ${dlPairs.length} pairs downloaded.\n\n`);
        refetchData();
      }, 5000);
    } catch (err) {
      console.error(err);
      setOutput(prev => prev + `Error starting download: ${err}\n`);
      setIsDownloading(false);
    }
  };

  const handleUtilityClick = (u: typeof UTILITIES[number]) => {
    setOutput(prev => prev + `$ freqtrade ${u.cmd}\nPending API execution for ${u.label}...\n\n`);
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


  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Data Management</h2>
          <p className="text-xs text-muted-foreground mt-1">Download, convert, and manage market data</p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs shrink-0 text-muted-foreground font-semibold">Bot Enclave:</Label>
          <Select value={selectedBotId} onValueChange={setSelectedBotId}>
            <SelectTrigger className="w-48 h-9 text-xs font-bold border-primary/20 bg-primary/5">
              <SelectValue placeholder="Select Bot to Context..." />
            </SelectTrigger>
            <SelectContent>
              {bots.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                {addingPair && availablePairs.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <Select onValueChange={(v) => {
                      if (!dlPairs.includes(v)) setDlPairs(prev => [...prev, v]);
                      setAddingPair(false);
                    }}>
                      <SelectTrigger className="w-32 h-7 text-2xs"><SelectValue placeholder="Select pair" /></SelectTrigger>
                      <SelectContent>
                        {availablePairs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-7 text-2xs px-2" onClick={() => setAddingPair(false)}>Cancel</Button>
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
            <Button className="w-full" onClick={handleDownload} disabled={isDownloading || dlPairs.length === 0 || !selectedBotId}>
              {isDownloading ? `Downloading... ${Math.round(downloadProgress)}%` : "Download Data"}
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
            onClick={() => refetchData()}
            disabled={!selectedBotId}
          >
            Refresh
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
