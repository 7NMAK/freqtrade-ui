"use client";

import { useState, Fragment, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Tooltip from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { TOOLTIPS } from "@/lib/tooltips";
import { getBots, botPairCandles, botPerformance, botDaily } from "@/lib/api";
import type { Bot, FTPairCandlesResponse, FTPerformance, FTDailyResponse } from "@/types";

// ── Constants ──

const pairs = ["BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT", "BNB/USDT:USDT", "XRP/USDT:USDT"];
const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

// ── Helpers ──

function heatmapCellStyle(val: string) {
  const n = parseFloat(val);
  if (n === 0 || isNaN(n)) return { bg: "", text: "text-text-3" };
  if (n > 2) return { bg: "bg-green/[.15]", text: "text-green" };
  if (n > 0) return { bg: "bg-green/[.08]", text: "text-green" };
  if (n < -1.5) return { bg: "bg-red/[.15]", text: "text-red" };
  return { bg: "bg-red/[.08]", text: "text-red" };
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

/** Export arbitrary data as JSON blob download */
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
  const [selectedPair, setSelectedPair] = useState("BTC/USDT:USDT");
  const [selectedTf, setSelectedTf] = useState("1h");
  const [activeSubchart, setActiveSubchart] = useState<"RSI" | "MACD" | "Volume">("RSI");
  const [showTema, setShowTema] = useState(true);
  const [showSar, setShowSar] = useState(true);
  const [usePublicTrades, setUsePublicTrades] = useState(true);
  const [ofScale, setOfScale] = useState("0.5");
  const [ofImbalanceVol, setOfImbalanceVol] = useState("100");
  const [ofImbalanceRatio, setOfImbalanceRatio] = useState("3.0");
  const [ofStackedRange, setOfStackedRange] = useState("3");
  const [ofCacheSize, setOfCacheSize] = useState("1500");
  const [ofMaxCandles, setOfMaxCandles] = useState("1500");

  useEffect(() => {
    getBots().then((list) => {
      setBots(list);
      if (list.length > 0) setSelectedBotId(String(list[0].id));
    }).catch((err) => { toast.error(err instanceof Error ? err.message : "Failed to load bots."); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch { /* non-blocking */
      // daily data is optional for heatmap
    }
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

  // Derive analysis stats from real data — using close_profit_abs per CLAUDE.md
  const analysisStatsLive: AnalysisStat[] = perfData.length > 0
    ? [
        { label: "Pairs Analyzed", value: String(perfData.length), sub: "All active pairs", subClass: "text-text-3" },
        { label: "Best Pair", value: perfData[0]?.pair ?? "\u2014", valueClass: "!text-base text-green", sub: `+${(perfData[0]?.close_profit_abs ?? perfData[0]?.profit_abs)?.toFixed(2) ?? "0"} USDT`, subClass: "text-green" },
        { label: "Worst Pair", value: perfData[perfData.length - 1]?.pair ?? "\u2014", valueClass: "!text-base text-red", sub: `${(perfData[perfData.length - 1]?.close_profit_abs ?? perfData[perfData.length - 1]?.profit_abs)?.toFixed(2) ?? "0"} USDT`, subClass: "text-red" },
        { label: "Total Trades", value: String(perfData.reduce((s, p) => s + p.count, 0)), sub: "All pairs combined", subClass: "text-text-3" },
      ]
    : [
        { label: "Pairs Analyzed", value: "\u2014", sub: "No bot selected", subClass: "text-text-3" },
        { label: "Best Pair", value: "\u2014", valueClass: "!text-base text-text-3", sub: "No data", subClass: "text-text-3" },
        { label: "Worst Pair", value: "\u2014", valueClass: "!text-base text-text-3", sub: "No data", subClass: "text-text-3" },
        { label: "Total Trades", value: "\u2014", sub: "No data", subClass: "text-text-3" },
      ];

  // Derive heatmap rows from daily data if available
  const heatmapRows = useMemo(() => {
    if (!dailyData || !dailyData.data || dailyData.data.length === 0) return [];
    // dailyData.data is array of { date, abs_profit, fiat_value, trade_count }
    // We show a single-row heatmap with daily profit percentages
    return [{
      pair: "All Pairs",
      days: dailyData.data.slice(0, 7).map((d: { rel_profit: number }) => {
        const pct = d.rel_profit * 100;
        return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
      }),
    }];
  }, [dailyData]);

  // Export handler for Cumulative Profit
  const handleExportData = useCallback(() => {
    if (perfData.length > 0) {
      exportAsJson(perfData, `analytics_performance_${new Date().toISOString().slice(0, 10)}.json`);
    } else if (candlesData) {
      exportAsJson(candlesData, `analytics_candles_${selectedPair.replace(/\//g, "-")}_${selectedTf}.json`);
    } else {
      toast.error("No data available to export.");
    }
  }, [perfData, candlesData, selectedPair, selectedTf, toast]);

  return (
    <AppShell title="Analytics">
      {/* No bots empty state */}
      {bots.length === 0 && !loadingCandles && (
        <div className="py-16 text-center text-sm text-text-3">No bots registered. Register a bot on the Dashboard to view analytics.</div>
      )}

      {/* Bot selector bar */}
      {bots.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 px-4 bg-bg-2 border border-border rounded-card text-xs">
          <span className="text-text-3 uppercase tracking-wide font-semibold shrink-0">Bot</span>
          <select
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
            className="bg-bg-1 border border-border rounded-btn px-3 py-1.5 text-[11px] text-text-1 outline-none focus:border-accent cursor-pointer min-w-[200px]"
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadCandles}
            className="text-[11px] px-3 py-1.5 rounded-btn border border-border bg-bg-3 text-text-1 hover:border-border-hover transition-colors cursor-pointer"
          >
            Refresh Candles
          </button>
        </div>
      )}
      {/* ════════════════════════════════════════════ */}
      {/* SECTION: PLOTTING & VISUALIZATION (ss19)    */}
      {/* ════════════════════════════════════════════ */}
      <div className="flex items-center gap-3.5 mb-5 pb-2.5 border-b border-border">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest bg-accent/[.12] text-accent">
          &sect;19
        </span>
        <span className="text-[15px] font-bold text-text-0">Plotting &amp; Visualization</span>
      </div>

      {/* Candlestick Chart Card */}
      <Card className="mb-6">
        <CardHeader
          title="Candlestick Chart"
          icon={"\uD83D\uDCC9"}
          action={
            <div className="flex items-center gap-2.5">
              <select
                value={selectedPair}
                onChange={(e) => setSelectedPair(e.target.value)}
                className="bg-bg-1 border border-border rounded-md px-3 py-1.5 text-xs text-text-1 outline-none focus:border-accent cursor-pointer"
              >
                {pairs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <div className="flex gap-0.5 bg-bg-1 border border-border rounded-md p-0.5">
                {timeframes.map((tf) => (
                  <button
                    type="button"
                    key={tf}
                    onClick={() => setSelectedTf(tf)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-all ${
                      selectedTf === tf
                        ? "bg-accent text-white"
                        : "text-text-3 hover:text-text-1"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        {/* Candlestick Area */}
        <div className="h-[280px] relative flex items-end pl-[40px] pr-[10px] pt-[30px] pb-[24px] overflow-hidden">
          {loadingCandles && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-1/60 backdrop-blur-sm">
              <span className="text-[11px] text-accent animate-pulse">Loading candles...</span>
            </div>
          )}
          {!loadingCandles && candleShapes.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <span className="text-[11px] text-text-3">No candle data. Select a bot and pair to load.</span>
            </div>
          )}
          {candlesData && candleShapes.length > 0 && (
            <div className="absolute top-2 right-3 text-[9px] text-green font-mono">
              {candlesData.pair} &middot; {candlesData.timeframe} &middot; {candlesData.data?.length ?? 0} candles (live)
            </div>
          )}
          {/* Grid lines */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 55px, var(--color-border) 55px, var(--color-border) 56px)" }} />

          {/* Y-axis */}
          <div className="absolute left-0 top-[30px] bottom-[24px] w-[38px] flex flex-col justify-between px-1">
            {yAxisLabels.map((l, i) => (
              <span key={`y-${i}-${l}`} className="text-[9px] text-text-3 text-right leading-none">{l}</span>
            ))}
          </div>

          {/* Crosshair — only show when data present */}
          {candleShapes.length > 0 && (
            <div className="absolute left-[40px] right-[10px] h-px bg-accent/25 pointer-events-none" style={{ top: "45%" }}>
              <span className="absolute right-0 -top-[7px] text-[9px] text-accent bg-bg-2 px-1 rounded-sm">
                {candleRows.length > 0 ? candleRows[Math.floor(candleRows.length / 2)]?.close?.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""}
              </span>
            </div>
          )}

          {/* TEMA overlay */}
          {showTema && candleShapes.length > 0 && (
            <div
              className="absolute left-[40px] right-[10px] h-0.5 pointer-events-none opacity-80"
              style={{
                top: "38%",
                background: "repeating-linear-gradient(90deg, var(--color-amber) 0px, var(--color-amber) 6px, transparent 6px, transparent 12px)",
              }}
            />
          )}

          {/* SAR dots */}
          {showSar && candleShapes.length > 0 && (
            <div
              className="absolute left-[40px] right-[10px] h-1 pointer-events-none opacity-60"
              style={{
                top: "55%",
                background: "radial-gradient(circle 2px, var(--color-cyan) 99%, transparent 100%)",
                backgroundSize: "18px 4px",
              }}
            />
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
              <span key={`x-${i}-${d}`} className="text-[9px] text-text-3">{d}</span>
            ))}
          </div>
        </div>

        {/* Indicator overlay controls: plot_config.main_plot */}
        <div className="px-[18px] py-2.5 border-t border-border flex items-center justify-between">
          <Tooltip
            content={TOOLTIPS.plot_config_main_plot?.description || "Indicators displayed on the main chart"}
            configKey={TOOLTIPS.plot_config_main_plot?.configKey}
          >
            <span className="text-[10px] text-text-3 font-semibold uppercase tracking-wider">Overlays</span>
          </Tooltip>
          <div className="flex items-center gap-3.5">
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-2">
              <input type="checkbox" checked={showTema} onChange={() => setShowTema(!showTema)} className="accent-accent w-[13px] h-[13px] cursor-pointer" />
              <span className="inline-block w-2.5 h-[3px] rounded-sm bg-amber" /> tema
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-text-2">
              <input type="checkbox" checked={showSar} onChange={() => setShowSar(!showSar)} className="accent-accent w-[13px] h-[13px] cursor-pointer" />
              <span className="inline-block w-2.5 h-[3px] rounded-sm bg-cyan" /> sar
            </label>
          </div>
        </div>

        {/* Subchart tabs: plot_config.subplots */}
        <div className="flex gap-0 border-b border-border items-center">
          <Tooltip
            content={TOOLTIPS.plot_config_subplots?.description || "Additional subcharts below the main chart"}
            configKey={TOOLTIPS.plot_config_subplots?.configKey}
          >
            <span className="px-[18px] py-2.5 text-[10px] text-text-3 font-semibold uppercase tracking-wider">Subcharts</span>
          </Tooltip>
          <div className="flex gap-0 flex-1">
            {(["RSI", "MACD", "Volume"] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveSubchart(tab)}
                className={`px-[18px] py-2.5 text-[11px] font-semibold cursor-pointer border-b-2 transition-all ${
                  activeSubchart === tab
                    ? "text-accent border-accent"
                    : "text-text-3 border-transparent hover:text-text-1"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Subchart area */}
        <div className="h-[120px] relative pl-[40px] pr-[10px] pt-3 pb-2 flex items-end gap-0.5">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 29px, var(--color-border) 29px, var(--color-border) 30px)" }} />

          {activeSubchart === "RSI" && (
            <>
              {/* RSI zone lines */}
              <div className="absolute left-[40px] right-[10px] border-t border-dashed border-red/30 pointer-events-none" style={{ top: "22%" }}>
                <span className="absolute right-0.5 -top-2.5 text-[8px] text-red">70</span>
              </div>
              <div className="absolute left-[40px] right-[10px] border-t border-dashed border-green/30 pointer-events-none" style={{ top: "78%" }}>
                <span className="absolute right-0.5 -top-2.5 text-[8px] text-green">30</span>
              </div>
              {candleShapes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[11px] text-text-3">
                  RSI data requires loaded candles
                </div>
              ) : (
                /* Placeholder bars from candle close data as pseudo-RSI visualization */
                (() => {
                  const allCloses = candleRows.map((r) => r.close);
                  const minC = Math.min(...allCloses);
                  const maxC = Math.max(...allCloses);
                  const rng = maxC - minC || 1;
                  return candleRows.map((row, i) => {
                  const normalized = ((row.close - minC) / rng) * 80 + 10;
                  const color = normalized > 70 ? "bg-red" : normalized < 30 ? "bg-green" : "bg-accent";
                  return (
                    <div
                      key={`rsi-${i}`}
                      className={`flex-1 rounded-[1px_1px_0_0] min-h-[2px] ${color} opacity-50`}
                      style={{ height: `${normalized}%` }}
                    />
                  );
                });
                })()
              )}
            </>
          )}

          {activeSubchart === "MACD" && (
            <>
              <div className="absolute left-[40px] right-[10px] top-1/2 h-px bg-border" />
              {candleShapes.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-[11px] text-text-3">
                  MACD data requires loaded candles
                </div>
              ) : (
                /* Derive pseudo-MACD from price momentum */
                (() => {
                  const maxAbs = Math.max(...candleRows.map((r) => Math.abs(r.close - r.open))) || 1;
                  return candleRows.map((row, i) => {
                  const val = row.close - row.open;
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
                <div className="flex-1 flex items-center justify-center text-[11px] text-text-3">
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

        {/* Trade Markers Legend */}
        <div className="flex items-center gap-[18px] px-[18px] py-2.5 border-t border-border bg-bg-1">
          <div className="flex items-center gap-1.5 text-[11px] text-text-2">
            <span className="text-[13px] text-green">{"\u25B3"}</span> Buy (enter_long)
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-2">
            <span className="text-[13px] text-red">{"\u25BD"}</span> Sell (exit_long)
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-2">
            <span className="text-[13px] text-red">{"\u25B3"}</span> Short (enter_short)
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-2">
            <span className="text-[13px] text-green">{"\u25BD"}</span> Cover (exit_short)
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent mr-0.5" /> enter_tag marker
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-2">
            <span className="inline-block w-2 h-2 rounded-full border-2 border-amber mr-0.5" /> exit_reason marker
          </div>
        </div>
      </Card>

      {/* Cumulative Profit Chart */}
      <Card className="mb-6">
        <CardHeader
          title="Cumulative Profit"
          icon={"\uD83D\uDCB0"}
          action={
            <span
              className="text-xs text-accent cursor-pointer font-medium hover:text-accent hover:underline"
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
            <div className="flex items-center justify-center h-full text-[11px] text-text-3">No performance data available</div>
          ) : (() => {
            const cumulative = perfData.reduce<number[]>((acc, p, i) => {
              acc.push((acc[i - 1] ?? 0) + (p.close_profit_abs ?? p.profit_abs));
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
                    <span key={`yt-${i}-${v}`} className={`text-[9px] text-right leading-none ${v > 0 ? "text-green" : v < 0 ? "text-red" : "text-text-3"}`}>{fmtY(v)}</span>
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
                    <span key={d} className="text-[9px] text-text-3">{d}</span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </Card>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION: ORDERFLOW (ss29)                   */}
      {/* ════════════════════════════════════════════ */}
      <div className="flex items-center gap-3.5 mb-5 pb-2.5 border-b border-border mt-2.5">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest bg-purple/[.12] text-purple">
          &sect;29
        </span>
        <span className="text-[15px] font-bold text-text-0">Orderflow (Beta)</span>
      </div>

      {/* Orderflow Configuration */}
      <Card className="mb-6">
        <CardHeader title="Orderflow Configuration" icon={"\uD83C\uDF0A"} />
        <CardBody>
          {/* use_public_trades toggle */}
          <div className="flex items-center gap-2.5 mb-4">
            <button
              type="button"
              onClick={() => setUsePublicTrades(!usePublicTrades)}
              className={`w-9 h-5 rounded-full border relative cursor-pointer transition-all ${
                usePublicTrades ? "bg-accent/[.12] border-accent" : "bg-bg-3 border-border"
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all ${
                  usePublicTrades ? "left-[18px] bg-accent" : "left-0.5 bg-text-3"
                }`}
              />
            </button>
            <Tooltip
              content={TOOLTIPS.use_public_trades?.description || "Fetch real-time public trade data from exchange"}
              configKey={TOOLTIPS.use_public_trades?.configKey}
            >
              <span className="text-xs text-text-1 font-medium">Orderflow Data</span>
            </Tooltip>
          </div>

          {/* Orderflow params */}
          <div className="text-[10px] text-text-3 font-semibold uppercase tracking-wider mb-1.5 mt-4">Orderflow Parameters</div>
          <div className="grid grid-cols-4 gap-3.5">
            {[
              { key: "orderflow_scale", label: "Scale", value: ofScale, set: setOfScale },
              { key: "orderflow_imbalance_volume", label: "Imbalance Volume", value: ofImbalanceVol, set: setOfImbalanceVol },
              { key: "orderflow_imbalance_ratio", label: "Imbalance Ratio", value: ofImbalanceRatio, set: setOfImbalanceRatio },
              { key: "orderflow_stacked_imbalance_range", label: "Stacked Range", value: ofStackedRange, set: setOfStackedRange },
              { key: "orderflow_cache_size", label: "Cache Size", value: ofCacheSize, set: setOfCacheSize },
              { key: "orderflow_max_candles", label: "Max Candles", value: ofMaxCandles, set: setOfMaxCandles },
            ].map((p) => (
              <div key={p.key} className="flex flex-col gap-1">
                <Tooltip
                  content={TOOLTIPS[p.key]?.description || p.label}
                  configKey={TOOLTIPS[p.key]?.configKey}
                >
                  <label className="text-[10px] text-text-3 font-medium uppercase tracking-wider">{p.label}</label>
                </Tooltip>
                <input
                  type="number"
                  value={p.value}
                  onChange={(e) => p.set(e.target.value)}
                  className="bg-bg-1 border border-border rounded-md px-2.5 py-[7px] text-xs text-text-0 outline-none focus:border-accent w-full font-inherit"
                />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Footprint + Delta grid — requires live orderflow connection */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Footprint Chart */}
        <Card>
          <CardHeader
            title="Footprint Chart"
            icon={"\uD83E\uDDF1"}
            action={<span className="text-xs text-text-3">{selectedPair} &middot; {selectedTf}</span>}
          />
          <CardBody className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-[11px] text-text-3 mb-1">Orderflow data requires live connection</div>
              <div className="text-[10px] text-text-3">Enable use_public_trades and connect to a running bot</div>
            </div>
          </CardBody>
        </Card>

        {/* Delta Chart + Imbalances */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Delta Chart (Ask - Bid)" icon={"\uD83D\uDCCA"} />
            <CardBody className="flex items-center justify-center py-8">
              <div className="text-[11px] text-text-3">Orderflow data requires live connection</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Imbalance Highlights"
              icon={"\u26A1"}
              action={<span className="text-xs text-text-3">0 detected</span>}
            />
            <CardBody className="flex items-center justify-center py-8">
              <div className="text-[11px] text-text-3">Orderflow data requires live connection</div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* SECTION: DATA ANALYSIS (ss20)               */}
      {/* ════════════════════════════════════════════ */}
      <div className="flex items-center gap-3.5 mb-5 pb-2.5 border-b border-border mt-2.5">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest bg-cyan/[.12] text-cyan">
          &sect;20
        </span>
        <span className="text-[15px] font-bold text-text-0">Data Analysis</span>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        {analysisStatsLive.map((s) => (
          <div key={s.label} className="bg-bg-1 border border-border rounded-lg p-3.5 px-4">
            <div className="text-[10px] text-text-3 font-medium uppercase tracking-wider mb-1.5">{s.label}</div>
            <div className={`text-lg font-bold text-text-0 tracking-tight ${s.valueClass ?? ""}`}>{s.value}</div>
            <div className={`text-[11px] mt-0.5 font-medium ${s.subClass}`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Heatmap + Notebooks */}
      <div className="grid grid-cols-[2fr_1fr] gap-5 mb-6">
        {/* Performance Heatmap */}
        <Card>
          <CardHeader
            title="Performance Heatmap (Pair x Day)"
            icon={"\uD83D\uDD25"}
            action={<span className="text-xs text-text-3">Last 7 days</span>}
          />
          <CardBody className="p-0 overflow-x-auto">
            {heatmapRows.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <span className="text-[11px] text-text-3">No daily data available. Select a bot to load.</span>
              </div>
            ) : (
              <div className="grid gap-px bg-border border border-border rounded-md overflow-hidden min-w-[500px]" style={{ gridTemplateColumns: "90px repeat(7, 1fr)" }}>
                {/* Header */}
                <div className="bg-bg-3 text-text-3 text-[9px] font-semibold uppercase tracking-wider text-center px-1.5 py-2" />
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="bg-bg-3 text-text-3 text-[9px] font-semibold uppercase tracking-wider text-center px-1.5 py-2">{d}</div>
                ))}
                {/* Data rows */}
                {heatmapRows.map((row) => (
                  <Fragment key={row.pair}>
                    <div className="bg-bg-3 text-text-1 text-[11px] font-semibold text-left px-2.5 py-2.5">{row.pair}</div>
                    {row.days.map((val, di) => {
                      const style = heatmapCellStyle(val);
                      return (
                        <div key={`${row.pair}-${di}`} className={`${style.bg} ${style.text} bg-bg-1 text-[10px] font-medium text-center px-1.5 py-2.5`}>
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

        {/* Jupyter Notebooks */}
        <Card>
          <CardHeader title="Jupyter Notebooks" icon={"\uD83D\uDCD3"} />
          <CardBody>
            <div className="flex items-center justify-center py-6">
              <span className="text-[11px] text-text-3">No notebooks found on this bot</span>
            </div>
            <div className="mt-3.5 p-2.5 px-3 bg-bg-3 rounded-md text-[11px] text-text-3 leading-relaxed">
              Notebooks run on the FreqTrade server at<br />
              <span className="text-text-2 font-mono text-[10px]">/freqtrade/user_data/notebooks/</span><br />
              Access via Jupyter on port 8888
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
