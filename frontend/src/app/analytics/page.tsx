"use client";

import { useState, Fragment, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Tooltip from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { TOOLTIPS } from "@/lib/tooltips";
import { getBots, botPairCandles, botPerformance, botDaily, botWhitelist } from "@/lib/api";
import type { Bot, FTPairCandlesResponse, FTPerformance, FTDailyResponse } from "@/types";

// ── Constants ──

const DEFAULT_PAIRS = ["BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT"];
const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

// ── Technical Analysis Helpers ──

/** Compute EMA for a series of values */
function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** Compute TEMA (Triple EMA) from close prices */
function computeTEMA(closes: number[], period = 20): number[] {
  if (closes.length < period) return [];
  const ema1 = ema(closes, period);
  const ema2 = ema(ema1, period);
  const ema3 = ema(ema2, period);
  return ema1.map((v, i) => 3 * v - 3 * ema2[i] + ema3[i]);
}

/** Compute RSI (Relative Strength Index) from close prices */
function computeRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const result: number[] = new Array(closes.length).fill(NaN);
  // Calculate initial gains and losses
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  // Initial average gain/loss (SMA)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs0);

  // Subsequent values using smoothed averages (Wilder's method)
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i + 1] = 100 - 100 / (1 + rs);
  }
  return result;
}

/** Compute MACD (12, 26, 9) from close prices */
function computeMACD(closes: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  if (closes.length < 26) return { macd: [], signal: [], histogram: [] };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

// ── Chart Helpers ──

function heatmapCellStyle(val: string) {
  const n = parseFloat(val);
  if (n === 0 || isNaN(n)) return { bg: "", text: "text-muted-foreground" };
  if (n > 2) return { bg: "bg-green/[.15]", text: "text-emerald-500" };
  if (n > 0) return { bg: "bg-green/[.08]", text: "text-emerald-500" };
  if (n < -1.5) return { bg: "bg-red/[.15]", text: "text-rose-500" };
  return { bg: "bg-red/[.08]", text: "text-rose-500" };
}

/** Parse FT pair-candles columnar data into row objects */
function parseCandlesRows(data: FTPairCandlesResponse) {
  const cols = data.columns;
  const dateIdx = cols.indexOf("date");
  const openIdx = cols.indexOf("open");
  const highIdx = cols.indexOf("high");
  const lowIdx = cols.indexOf("low");
  const closeIdx = cols.indexOf("close");
  const volIdx = cols.indexOf("volume");
  return (data.data ?? []).map((row) => ({
    date: Number(row[dateIdx]),
    open: Number(row[openIdx]),
    high: Number(row[highIdx]),
    low: Number(row[lowIdx]),
    close: Number(row[closeIdx]),
    volume: Number(row[volIdx]),
  }));
}

/** Convert candle rows to CSS-renderable candle shapes */
function candleRowsToShapes(rows: ReturnType<typeof parseCandlesRows>) {
  if (rows.length === 0) return [];
  const allLow = Math.min(...rows.map((r) => r.low));
  const allHigh = Math.max(...rows.map((r) => r.high));
  const range = allHigh - allLow || 1;
  return rows.map((r) => {
    const bull = r.close >= r.open;
    const wickBottom = ((r.low - allLow) / range) * 80 + 5;
    const wickHeight = ((r.high - r.low) / range) * 80;
    const bodyBottom = (((bull ? r.open : r.close) - allLow) / range) * 80 + 5;
    const bodyHeight = (Math.abs(r.close - r.open) / range) * 80 || 0.5;
    return {
      wick: { bottom: wickBottom, height: wickHeight, bull },
      body: { bottom: bodyBottom, height: bodyHeight, bull },
    };
  });
}

/** Derive volume bars from candle data */
function deriveVolumeBars(rows: ReturnType<typeof parseCandlesRows>) {
  if (rows.length === 0) return [];
  const maxVol = Math.max(...rows.map((r) => r.volume)) || 1;
  return rows.map((r) => ({
    h: (r.volume / maxVol) * 80 + 5,
    up: r.close >= r.open,
  }));
}

/** Export data as JSON blob download */
function exportAsJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Types ──

interface AnalysisStat {
  label: string;
  value: string;
  valueClass?: string;
  sub: string;
  subClass: string;
}

// ── Page ──

export default function AnalyticsPage() {
  const toast = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [candlesData, setCandlesData] = useState<FTPairCandlesResponse | null>(null);
  const [perfData, setPerfData] = useState<FTPerformance[]>([]);
  const [dailyData, setDailyData] = useState<FTDailyResponse | null>(null);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [loadingBots, setLoadingBots] = useState(true);
  const [selectedPair, setSelectedPair] = useState("BTC/USDT:USDT");
  const [selectedTf, setSelectedTf] = useState("1h");
  const [activeSubchart, setActiveSubchart] = useState<"RSI" | "MACD" | "Volume">("RSI");
  const [showTema, setShowTema] = useState(true);
  // Dynamic pairs from bot whitelist (ISSUE 8 fix)
  const [availablePairs, setAvailablePairs] = useState<string[]>(DEFAULT_PAIRS);

  // ISSUE 12 fix: proper error + retry state
  const loadBots = useCallback(() => {
    setLoadingBots(true);
    getBots().then((list) => {
      setBots(list);
      if (list.length > 0) setSelectedBotId(String(list[0].id));
      setLoadingBots(false);
    }).catch((err) => {
      setLoadingBots(false);
      toast.error(err instanceof Error ? err.message : "Failed to load bots.", {
        action: { label: "RETRY", onClick: () => loadBots() },
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBots(); }, [loadBots]);

  // ISSUE 8 fix: Load pairs from bot whitelist
  useEffect(() => {
    if (!selectedBotId) return;
    const botId = parseInt(selectedBotId, 10);
    botWhitelist(botId).then((wl) => {
      if (wl.whitelist && wl.whitelist.length > 0) {
        setAvailablePairs(wl.whitelist);
        // If current selection not in the new whitelist, select first
        if (!wl.whitelist.includes(selectedPair)) {
          setSelectedPair(wl.whitelist[0]);
        }
      }
    }).catch(() => {
      // Fallback to defaults if whitelist fails
      setAvailablePairs(DEFAULT_PAIRS);
    });
  }, [selectedBotId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCandles = useCallback(async () => {
    if (!selectedBotId) return;
    const botId = parseInt(selectedBotId, 10);
    setLoadingCandles(true);
    try {
      const res = await botPairCandles(botId, selectedPair, selectedTf, 100);
      setCandlesData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load candles.");
    } finally {
      setLoadingCandles(false);
    }
  }, [selectedBotId, selectedPair, selectedTf, toast]);

  const loadPerformance = useCallback(async (botId: number) => {
    try {
      const res = await botPerformance(botId);
      setPerfData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load performance data.");
    }
  }, [toast]);

  const loadDaily = useCallback(async (botId: number) => {
    try {
      const res = await botDaily(botId, 7);
      setDailyData(res);
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    if (selectedBotId) loadCandles();
  }, [selectedBotId, selectedPair, selectedTf]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedBotId) {
      const id = parseInt(selectedBotId, 10);
      loadPerformance(id);
      loadDaily(id);
    }
  }, [selectedBotId, loadPerformance, loadDaily]);

  // Parse candle data for rendering
  const candleRows = useMemo(() => (candlesData ? parseCandlesRows(candlesData) : []), [candlesData]);
  const candleShapes = useMemo(() => candleRowsToShapes(candleRows), [candleRows]);
  const volumeBarsLive = useMemo(() => deriveVolumeBars(candleRows), [candleRows]);

  // ISSUE 1 fix: Real TEMA computed from candle closes
  const temaData = useMemo(() => {
    if (candleRows.length === 0) return [];
    const closes = candleRows.map((r) => r.close);
    const temaValues = computeTEMA(closes, 20);
    if (temaValues.length === 0) return [];
    const allLow = Math.min(...candleRows.map((r) => r.low));
    const allHigh = Math.max(...candleRows.map((r) => r.high));
    const range = allHigh - allLow || 1;
    return temaValues.map((v) => ((v - allLow) / range) * 80 + 5);
  }, [candleRows]);

  // ISSUE 3 fix: Real RSI computed from candle closes
  const rsiData = useMemo(() => {
    if (candleRows.length === 0) return [];
    const closes = candleRows.map((r) => r.close);
    return computeRSI(closes, 14);
  }, [candleRows]);

  // ISSUE 4 fix: Real MACD computed from candle closes
  const macdData = useMemo(() => {
    if (candleRows.length === 0) return { macd: [] as number[], signal: [] as number[], histogram: [] as number[] };
    const closes = candleRows.map((r) => r.close);
    return computeMACD(closes);
  }, [candleRows]);

  // Derive Y-axis labels from candle data
  const yAxisLabels = useMemo(() => {
    if (candleRows.length === 0) return ["—", "—", "—", "—", "—"];
    const allLow = Math.min(...candleRows.map((r) => r.low));
    const allHigh = Math.max(...candleRows.map((r) => r.high));
    const step = (allHigh - allLow) / 4;
    return [allHigh, allHigh - step, allHigh - 2 * step, allHigh - 3 * step, allLow].map((v) =>
      v.toLocaleString(undefined, { maximumFractionDigits: 2 })
    );
  }, [candleRows]);

  // Derive X-axis labels from candle data
  const xAxisLabels = useMemo(() => {
    if (candleRows.length === 0) return [];
    const step = Math.max(1, Math.floor(candleRows.length / 8));
    const labels: string[] = [];
    for (let i = 0; i < candleRows.length; i += step) {
      const d = new Date(candleRows[i].date);
      labels.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`);
    }
    return labels;
  }, [candleRows]);

  // ISSUE 9 + 10 fix: Use profit_abs and trades (not close_profit_abs / count)
  const analysisStatsLive: AnalysisStat[] = perfData.length > 0
    ? (() => {
        // Sort by profit_abs to find best/worst
        const sorted = [...perfData].sort((a, b) => b.profit_abs - a.profit_abs);
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        const totalTrades = perfData.reduce((s, p) => s + p.trades, 0);
        return [
          { label: "Pairs Analyzed", value: String(perfData.length), sub: "All active pairs", subClass: "text-muted-foreground" },
          { label: "Best Pair", value: best?.pair ?? "\u2014", valueClass: "!text-base text-emerald-500", sub: `+${best?.profit_abs?.toFixed(2) ?? "0"} USDT`, subClass: "text-emerald-500" },
          { label: "Worst Pair", value: worst?.pair ?? "\u2014", valueClass: "!text-base text-rose-500", sub: `${worst?.profit_abs?.toFixed(2) ?? "0"} USDT`, subClass: "text-rose-500" },
          { label: "Total Trades", value: String(totalTrades), sub: "All pairs combined", subClass: "text-muted-foreground" },
        ];
      })()
    : [
        { label: "Pairs Analyzed", value: "\u2014", sub: "No bot selected", subClass: "text-muted-foreground" },
        { label: "Best Pair", value: "\u2014", valueClass: "!text-base text-muted-foreground", sub: "No data", subClass: "text-muted-foreground" },
        { label: "Worst Pair", value: "\u2014", valueClass: "!text-base text-muted-foreground", sub: "No data", subClass: "text-muted-foreground" },
        { label: "Total Trades", value: "\u2014", sub: "No data", subClass: "text-muted-foreground" },
      ];

  // ISSUE 7 fix: Rename to "Daily Portfolio P&L" — honest about single-row aggregate
  const heatmapRows = useMemo(() => {
    if (!dailyData || !dailyData.data || dailyData.data.length === 0) return [];
    return [{
      pair: "Portfolio",
      days: dailyData.data.slice(0, 7).map((d: { rel_profit: number }) => {
        const pct = d.rel_profit * 100;
        return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
      }),
    }];
  }, [dailyData]);

  // ISSUE 14 fix: Export cumulative computed values, not raw perfData
  const handleExportData = useCallback(() => {
    if (perfData.length > 0) {
      // Build cumulative data for export
      const cumulative = perfData.reduce<Array<{ pair: string; trades: number; profit_abs: number; cumulative_profit: number }>>((acc, p, i) => {
        const prevCum = i > 0 ? acc[i - 1].cumulative_profit : 0;
        acc.push({
          pair: p.pair,
          trades: p.trades,
          profit_abs: p.profit_abs,
          cumulative_profit: prevCum + p.profit_abs,
        });
        return acc;
      }, []);
      exportAsJson(cumulative, `analytics_cumulative_profit_${new Date().toISOString().slice(0, 10)}.json`);
    } else if (candlesData) {
      exportAsJson(candlesData, `analytics_candles_${selectedPair.replace(/\//g, "-")}_${selectedTf}.json`);
    } else {
      toast.error("No data available to export.");
    }
  }, [perfData, candlesData, selectedPair, selectedTf, toast]);

  return (
    <AppShell title="Analytics">
      <div className="p-5">
      {/* ISSUE 12 fix: Empty state with retry */}
      {!loadingBots && bots.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-sm text-muted-foreground mb-3">No bots registered. Register a bot on the Dashboard to view analytics.</div>
          <button
            type="button"
            onClick={loadBots}
            className="px-4 py-2 text-xs rounded-btn bg-primary text-white hover:bg-primary/80 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {loadingBots && (
        <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">Loading bots...</div>
      )}

      {bots.length > 0 && (
      <div className="grid grid-cols-[380px_1fr] gap-5 items-start">
        {/* LEFT: Controls */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Chart Controls" icon="📊" />
            <CardBody className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bot</label>
                <select value={selectedBotId} onChange={(e) => setSelectedBotId(e.target.value)} className="w-full bg-card border border-border rounded-btn px-3 py-2 text-xs text-muted-foreground outline-none focus:border-primary cursor-pointer">
                  {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button type="button" onClick={loadCandles} className="mt-2 w-full text-xs px-3 py-1.5 rounded-btn border border-border bg-muted text-muted-foreground hover:border-ring transition-colors cursor-pointer">Refresh Candles</button>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Pair</label>
                <select value={selectedPair} onChange={(e) => setSelectedPair(e.target.value)} className="w-full bg-card border border-border rounded-btn px-3 py-2 text-xs text-muted-foreground outline-none focus:border-primary cursor-pointer">
                  {availablePairs.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Timeframe</label>
                <div className="flex flex-wrap gap-1">
                  {timeframes.map((tf) => (
                    <button type="button" key={tf} onClick={() => setSelectedTf(tf)} className={`px-2.5 py-1 text-xs font-medium rounded-btn cursor-pointer border transition-all ${selectedTf === tf ? "bg-primary text-white border-primary" : "text-muted-foreground border-border hover:border-ring"}`}>{tf}</button>
                  ))}
                </div>
              </div>
              <div>
                <Tooltip content={TOOLTIPS.plot_config_main_plot?.description || "Indicators displayed on the main chart"} configKey={TOOLTIPS.plot_config_main_plot?.configKey}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Overlays</label>
                </Tooltip>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                  <input type="checkbox" checked={showTema} onChange={() => setShowTema(!showTema)} className="accent-accent w-[13px] h-[13px] cursor-pointer" />
                  <span className="inline-block w-2.5 h-[3px] rounded-sm bg-amber" /> TEMA(20)
                </label>
              </div>
              <div>
                <Tooltip content={TOOLTIPS.plot_config_subplots?.description || "Additional subcharts below the main chart"} configKey={TOOLTIPS.plot_config_subplots?.configKey}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Subchart</label>
                </Tooltip>
                <div className="flex gap-1">
                  {(["RSI", "MACD", "Volume"] as const).map((tab) => (
                    <button type="button" key={tab} onClick={() => setActiveSubchart(tab)} className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-btn cursor-pointer border transition-all ${activeSubchart === tab ? "bg-primary/[.12] text-primary border-primary/30" : "text-muted-foreground border-border hover:border-ring"}`}>{tab}</button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Portfolio Stats" icon="📈" />
            <CardBody>
              <div className="grid grid-cols-2 gap-3">
                {analysisStatsLive.map((s) => (
                  <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
                    <div className={`text-[13px] font-bold font-mono leading-none ${s.valueClass ?? "text-foreground"}`}>{s.value}</div>
                    {s.sub && <div className={`text-[9px] mt-0.5 ${s.subClass}`}>{s.sub}</div>}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* RIGHT: Charts */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5 pb-2.5 border-b border-border">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest bg-primary/[.12] text-primary">&sect;19</span>
            <span className="text-[15px] font-bold text-foreground">Plotting &amp; Visualization</span>
          </div>

      {/* Candlestick Chart Card */}
      <Card className="mb-0">
        <CardHeader
          title="Candlestick Chart"
          icon={"\uD83D\uDCC9"}
        />

        {/* Candlestick Area */}
        <div className="h-[280px] relative flex items-end pl-[40px] pr-[10px] pt-[30px] pb-[24px] overflow-hidden">
          {loadingCandles && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm">
              <span className="text-xs text-primary animate-pulse">Loading candles...</span>
            </div>
          )}
          {!loadingCandles && candleShapes.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No candle data. Select a bot and pair to load.</span>
            </div>
          )}
          {candlesData && candleShapes.length > 0 && (
            <div className="absolute top-2 right-3 text-[9px] text-emerald-500 font-mono">
              {candlesData.pair} &middot; {candlesData.timeframe} &middot; {candlesData.data?.length ?? 0} candles (live)
            </div>
          )}
          {/* Grid lines */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 55px, var(--color-border) 55px, var(--color-border) 56px)" }} />

          {/* Y-axis */}
          <div className="absolute left-0 top-[30px] bottom-[24px] w-[38px] flex flex-col justify-between px-1">
            {yAxisLabels.map((l, i) => (
              <span key={`y-${i}-${l}`} className="text-[9px] text-muted-foreground text-right leading-none">{l}</span>
            ))}
          </div>

          {/* ISSUE 1 fix: Real TEMA overlay rendered as SVG polyline */}
          {showTema && temaData.length > 0 && candleShapes.length > 0 && (
            <svg
              className="absolute left-[40px] right-[10px] top-[30px] bottom-[24px] pointer-events-none"
              viewBox={`0 0 ${candleShapes.length} 100`}
              preserveAspectRatio="none"
              style={{ width: "calc(100% - 50px)", height: "calc(100% - 54px)" }}
            >
              <polyline
                points={temaData.map((y, i) => `${i},${100 - y}`).join(" ")}
                fill="none"
                stroke="var(--color-amber, #f59e0b)"
                strokeWidth="0.8"
                opacity="0.8"
              />
            </svg>
          )}

          {/* Candles — rendered from live candlesData */}
          {candleShapes.map((c, i) => (
            <div key={`candle-${i}`} className="flex-1 flex flex-col items-center relative h-full">
              <div
                className={`absolute w-px left-1/2 -translate-x-1/2 ${c.wick.bull ? "bg-green" : "bg-red"}`}
                style={{ bottom: `${c.wick.bottom}%`, height: `${c.wick.height}%` }}
              />
              <div
                className={`absolute w-[60%] rounded-[1px] ${c.body.bull ? "bg-green" : "bg-red"}`}
                style={{ bottom: `${c.body.bottom}%`, height: `${c.body.height}%` }}
              />
            </div>
          ))}

          {/* X-axis */}
          <div className="absolute bottom-0 left-[40px] right-[10px] flex justify-between pt-1.5">
            {xAxisLabels.map((d, i) => (
              <span key={`x-${i}-${d}`} className="text-[9px] text-muted-foreground">{d}</span>
            ))}
          </div>
        </div>


        {/* Subchart area */}
        <div className="h-[120px] relative pl-[40px] pr-[10px] pt-3 pb-2 flex items-end gap-0.5">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 29px, var(--color-border) 29px, var(--color-border) 30px)" }} />

          {/* ISSUE 3 fix: Real RSI subchart */}
          {activeSubchart === "RSI" && (
            <>
              {/* RSI zone lines */}
              <div className="absolute left-[40px] right-[10px] border-t border-dashed border-rose-500/30 pointer-events-none" style={{ top: "22%" }}>
                <span className="absolute right-0.5 -top-2.5 text-[8px] text-rose-500">70</span>
              </div>
              <div className="absolute left-[40px] right-[10px] border-t border-dashed border-emerald-500/30 pointer-events-none" style={{ top: "78%" }}>
                <span className="absolute right-0.5 -top-2.5 text-[8px] text-emerald-500">30</span>
              </div>
              {candleRows.length === 0 || rsiData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                  RSI requires at least 15 candles
                </div>
              ) : (
                rsiData.map((val, i) => {
                  if (isNaN(val)) return <div key={`rsi-${i}`} className="flex-1" />;
                  const height = val; // RSI is 0-100, maps directly to percentage
                  const color = val > 70 ? "bg-red" : val < 30 ? "bg-green" : "bg-primary";
                  return (
                    <div
                      key={`rsi-${i}`}
                      className={`flex-1 rounded-[1px_1px_0_0] min-h-[2px] ${color} opacity-50`}
                      style={{ height: `${Math.max(2, height)}%` }}
                    />
                  );
                })
              )}
            </>
          )}

          {/* ISSUE 4 fix: Real MACD subchart */}
          {activeSubchart === "MACD" && (
            <>
              <div className="absolute left-[40px] right-[10px] top-1/2 h-px bg-border" />
              {candleRows.length === 0 || macdData.histogram.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                  MACD requires at least 26 candles
                </div>
              ) : (
                (() => {
                  const maxAbs = Math.max(...macdData.histogram.map((v) => Math.abs(v))) || 1;
                  return macdData.histogram.map((val, i) => {
                    const pct = (val / maxAbs) * 45;
                    return (
                      <div
                        key={`macd-${i}`}
                        className={`flex-1 rounded-[1px] min-h-[1px] ${val >= 0 ? "bg-green" : "bg-red"} opacity-60`}
                        style={{
                          height: `${Math.abs(pct)}%`,
                          alignSelf: val >= 0 ? "flex-end" : "flex-start",
                          ...(val >= 0 ? { marginBottom: "50%" } : { marginTop: "50%" }),
                        }}
                      />
                    );
                  });
                })()
              )}
            </>
          )}

          {activeSubchart === "Volume" && (
            <>
              {volumeBarsLive.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                  Volume data requires loaded candles
                </div>
              ) : (
                volumeBarsLive.map((bar, i) => (
                  <div
                    key={`vol-${i}`}
                    className={`flex-1 rounded-[1px_1px_0_0] min-h-[2px] opacity-50 ${bar.up ? "bg-green" : "bg-red"}`}
                    style={{ height: `${bar.h}%` }}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* ISSUE 13 fix: Removed phantom trade markers legend — no trade markers exist on chart */}
      </Card>

      {/* Cumulative Profit Chart */}
      <Card className="mb-6">
        <CardHeader
          title="Cumulative Profit"
          icon={"\uD83D\uDCB0"}
          action={
            <span
              className="text-xs text-primary cursor-pointer font-medium hover:text-primary hover:underline"
              onClick={handleExportData}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleExportData(); }}
            >
              Export Data
            </span>
          }
        />
        <div className="h-[160px] relative px-[10px] pt-[10px] pb-5 pl-[40px]">
          {perfData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No performance data available</div>
          ) : (() => {
            // ISSUE 9 fix: Use profit_abs directly
            const cumulative = perfData.reduce<number[]>((acc, p, i) => {
              acc.push((acc[i - 1] ?? 0) + p.profit_abs);
              return acc;
            }, []);
            const maxVal = Math.max(...cumulative, 0);
            const minVal = Math.min(...cumulative, 0);
            const range = maxVal - minVal || 1;
            const yTicks = [maxVal, maxVal * 0.75 + minVal * 0.25, maxVal * 0.5 + minVal * 0.5, maxVal * 0.25 + minVal * 0.75, minVal];
            const fmtY = (v: number) => `${v >= 0 ? "+" : ""}$${Math.round(v).toLocaleString()}`;
            const points = cumulative.map((v, i) => {
              const x = cumulative.length === 1 ? 200 : (i / (cumulative.length - 1)) * 400;
              const y = 108 - ((v - minVal) / range) * 106;
              return `${x.toFixed(0)},${y.toFixed(0)}`;
            }).join(" ");
            const clipPoints = cumulative.map((v, i) => {
              const xPct = cumulative.length === 1 ? 50 : (i / (cumulative.length - 1)) * 100;
              const yPct = 100 - ((v - minVal) / range) * 100;
              return `${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`;
            });
            const clipPath = `polygon(${clipPoints.join(",")},100% 100%,0% 100%)`;
            const pairLabels = perfData.map((p) => p.pair.split("/")[0]);
            const labelStep = Math.max(1, Math.floor(pairLabels.length / 5));
            const xLabels = pairLabels.filter((_, i) => i % labelStep === 0 || i === pairLabels.length - 1);
            return (
              <>
                <div className="absolute left-0 top-[10px] bottom-5 w-[38px] flex flex-col justify-between px-1">
                  {yTicks.map((v, i) => (
                    <span key={`yt-${i}-${v}`} className={`text-[9px] text-right leading-none ${v > 0 ? "text-emerald-500" : v < 0 ? "text-rose-500" : "text-muted-foreground"}`}>{fmtY(v)}</span>
                  ))}
                </div>
                <div
                  className="absolute left-[40px] right-[10px] bottom-5 h-[110px]"
                  style={{
                    background: `linear-gradient(180deg, color-mix(in srgb, var(--color-green) 18%, transparent) 0%, color-mix(in srgb, var(--color-green) 2%, transparent) 100%)`,
                    clipPath,
                  }}
                />
                <div className="absolute left-[40px] right-[10px] bottom-5 h-[110px] overflow-visible">
                  <svg viewBox="0 0 400 110" preserveAspectRatio="none" className="w-full h-full">
                    <polyline
                      points={points}
                      fill="none"
                      stroke="var(--color-green)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="absolute bottom-0 left-[40px] right-[10px] flex justify-between">
                  {xLabels.map((d) => (
                    <span key={d} className="text-[9px] text-muted-foreground">{d}</span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </Card>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION: DATA ANALYSIS (ss20)               */}
      {/* ════════════════════════════════════════════ */}
      <div className="flex items-center gap-3.5 mb-5 pb-2.5 border-b border-border mt-2.5">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest bg-cyan/[.12] text-cyan">
          &sect;20
        </span>
        <span className="text-[15px] font-bold text-foreground">Data Analysis</span>
      </div>


      {/* ISSUE 7 fix: Renamed to "Daily Portfolio P&L" — honest labeling */}
      <Card className="mb-6">
        <CardHeader
          title="Daily Portfolio P&L"
          icon={"\uD83D\uDD25"}
          action={<span className="text-xs text-muted-foreground">Last 7 days</span>}
        />
        <CardBody className="p-0 overflow-x-auto">
          {heatmapRows.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <span className="text-xs text-muted-foreground">No daily data available. Select a bot to load.</span>
            </div>
          ) : (
            <div className="grid gap-px bg-border border border-border rounded-md overflow-hidden min-w-[500px]" style={{ gridTemplateColumns: "90px repeat(7, 1fr)" }}>
              {/* Header */}
              <div className="bg-muted text-muted-foreground text-[9px] font-semibold uppercase tracking-wider text-center px-1.5 py-2" />
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="bg-muted text-muted-foreground text-[9px] font-semibold uppercase tracking-wider text-center px-1.5 py-2">{d}</div>
              ))}
              {/* Data rows */}
              {heatmapRows.map((row) => (
                <Fragment key={row.pair}>
                  <div className="bg-muted text-muted-foreground text-xs font-semibold text-left px-2.5 py-2.5">{row.pair}</div>
                  {row.days.map((val, di) => {
                    const style = heatmapCellStyle(val);
                    return (
                      <div key={`${row.pair}-${di}`} className={`${style.bg} ${style.text} bg-card text-xs font-medium text-center px-1.5 py-2.5`}>
                        {val}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ISSUE 5 + 6 fix: Orderflow and Notebooks sections removed — they were 100% stubs */}
      {/* Orderflow requires real exchange WebSocket integration (use_public_trades) */}
      {/* Notebooks require a Jupyter listing API that doesn't exist */}

        </div>{/* end RIGHT column */}
      </div>)}{/* end grid / bots > 0 */}

      </div>
    </AppShell>
  );
}
