"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Tooltip from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { TOOLTIPS } from "@/lib/tooltips";
import {
  getBots,
  botFtStrategies,
  botTrades,
  botDownloadData,
  botDownloadDataStatus,
  botConvertData,
  botConvertTradeData,
  botTradesToOhlcv,
  botHyperoptList,
  botHyperoptShow,
  botListData,
  botAvailablePairs,
} from "@/lib/api";
import type { Bot, FTTrade } from "@/types";

// ── Static reference data (acceptable for dropdowns) ──────

const PAIRS = [
  "BTC/USDT:USDT", "ETH/USDT:USDT", "BNB/USDT:USDT", "SOL/USDT:USDT",
  "XRP/USDT:USDT", "ADA/USDT:USDT", "DOGE/USDT:USDT", "AVAX/USDT:USDT",
  "DOT/USDT:USDT", "LINK/USDT:USDT", "MATIC/USDT:USDT", "UNI/USDT:USDT",
  "ATOM/USDT:USDT", "LTC/USDT:USDT", "FIL/USDT:USDT", "APT/USDT:USDT",
  "ARB/USDT:USDT", "OP/USDT:USDT", "NEAR/USDT:USDT", "AAVE/USDT:USDT",
];

const EXCHANGES = ["binance", "bybit", "okx", "gate", "kraken", "bitget", "htx", "kucoin"];
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"];
const CANDLE_TYPES = ["spot", "futures", "mark", "index", "premiumIndex", "funding_rate"];
const DATA_FORMATS = ["json", "jsongz", "feather", "parquet"];

const exchangeList = [
  { name: "binance", spot: true, margin: true, futures: true, status: "supported" },
  { name: "bybit", spot: true, margin: false, futures: true, status: "supported" },
  { name: "okx", spot: true, margin: false, futures: true, status: "supported" },
  { name: "gate", spot: true, margin: false, futures: true, status: "supported" },
  { name: "kraken", spot: true, margin: true, futures: true, status: "supported" },
  { name: "bitget", spot: true, margin: false, futures: true, status: "supported" },
  { name: "htx", spot: true, margin: false, futures: true, status: "supported" },
  { name: "kucoin", spot: true, margin: false, futures: true, status: "supported" },
  { name: "bitvavo", spot: true, margin: false, futures: false, status: "spot only" },
  { name: "bingx", spot: true, margin: false, futures: true, status: "supported" },
];

const timeframeList = [
  { exchange: "binance", timeframes: "1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M" },
  { exchange: "bybit", timeframes: "1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 1w, 1M" },
  { exchange: "okx", timeframes: "1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 1w, 1M" },
  { exchange: "kraken", timeframes: "1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w" },
  { exchange: "gate", timeframes: "10s, 1m, 5m, 15m, 30m, 1h, 4h, 8h, 1d, 7d, 30d" },
  { exchange: "bitget", timeframes: "1m, 5m, 15m, 30m, 1h, 4h, 6h, 12h, 1d, 1w" },
];

const hyperoptLosses = [
  "ShortTradeDurHyperOptLoss", "OnlyProfitHyperOptLoss", "SharpeHyperOptLoss",
  "SharpeHyperOptLossDaily", "SortinoHyperOptLoss", "SortinoHyperOptLossDaily",
  "MaxDrawDownHyperOptLoss", "MaxDrawDownRelativeHyperOptLoss", "CalmarHyperOptLoss",
  "ProfitDrawDownHyperOptLoss", "MultiMetricHyperOptLoss", "WinRatioHyperOptLoss",
];

const freqaiModels = [
  { name: "LightGBMRegressor", type: "Regression" },
  { name: "LightGBMClassifier", type: "Classification" },
  { name: "XGBoostRegressor", type: "Regression" },
  { name: "XGBoostClassifier", type: "Classification" },
  { name: "XGBoostRFRegressor", type: "Regression" },
  { name: "XGBoostRFClassifier", type: "Classification" },
  { name: "CatboostRegressor", type: "Regression" },
  { name: "CatboostClassifier", type: "Classification" },
  { name: "PyTorchMLPRegressor", type: "Regression (DL)" },
  { name: "PyTorchMLPClassifier", type: "Classification (DL)" },
  { name: "PyTorchTransformerRegressor", type: "Regression (DL)" },
  { name: "ReinforcementLearner", type: "RL (PPO)" },
  { name: "ReinforcementLearner_multiproc", type: "RL (PPO multi)" },
  { name: "SKLearnRandomForestRegressor", type: "Regression" },
];

// ── Reusable sub-components ────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const ok = status === "ok" || status === "active" || status === "supported";
  return (
    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
      ok ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500-500/20"
    }`}>
      {status}
    </span>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
      <span className="text-[15px]">{icon}</span>
      {children}
    </h2>
  );
}

function SectionRef({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground font-medium mb-5">{children}</p>;
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-6 ${className ?? ""}`}>
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      {message}
    </div>
  );
}

// ── Log line types ─────────────────────────────────────────

type LogLine = { type: "info" | "ok" | "warn" | "err"; text: string };

function LogArea({ lines, className }: { lines: LogLine[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  const color = { info: "text-cyan", ok: "text-emerald-500", warn: "text-amber-500", err: "text-rose-500" };
  return (
    <div
      ref={ref}
      className={`bg-background border border-border rounded-btn p-3 font-mono text-xs leading-relaxed text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-wrap ${className ?? ""}`}
    >
      {lines.map((l, i) => (
        <div key={`log-${i}-${l.type}-${l.text.slice(0, 20)}`}>
          <span className={color[l.type]}>[{l.type}]</span> {l.text}
        </div>
      ))}
    </div>
  );
}

// ── Utility card wrapper ───────────────────────────────────

function UtilCard({
  icon,
  title,
  cmd,
  onRun,
  runLabel = "\u25B6 Run",
  span2 = false,
  loading = false,
  children,
}: {
  icon: string;
  title: string;
  cmd: string;
  onRun?: () => void;
  runLabel?: string;
  span2?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-muted/50 border border-border rounded-card overflow-hidden hover:border-border-border hover:border-ring transition-colors ${span2 ? "col-span-full lg:col-span-2" : ""}`}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <span className="text-xs font-semibold text-foreground flex items-center gap-2">
          <span className="text-sm">{icon}</span> {title}
        </span>
        {onRun && (
          <button
            type="button"
            onClick={onRun}
            disabled={loading}
            className="text-xs font-semibold px-3 py-1 rounded-btn bg-muted text-muted-foreground border border-border hover:border-border-border hover:border-ring hover:bg-card transition-all disabled:opacity-50"
          >
            {loading ? "Loading..." : runLabel}
          </button>
        )}
      </div>
      <div className="px-4 py-1.5 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{cmd}</span>
      </div>
      <div className="p-4 max-h-72 overflow-y-auto">{children}</div>
    </div>
  );
}

// ── Data list item type ────────────────────────────────────

interface DataEntry {
  pair: string;
  timeframe: string;
  start: string;
  end: string;
  candle_count: number;
  candle_type?: string;
  format?: string;
}

// ── Main page component ────────────────────────────────────

export default function DataManagementPage() {
  const toast = useToast();

  // Bot selection
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");

  // Download config state
  const [selectedPairs, setSelectedPairs] = useState<string[]>(["BTC/USDT:USDT", "ETH/USDT:USDT"]);
  const [exchange, setExchange] = useState("binance");
  const [tradingMode, setTradingMode] = useState("futures");
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(["1h", "1d"]);
  const [dateStart, setDateStart] = useState("2022-01-01");
  const [dateEnd, setDateEnd] = useState(new Date().toISOString().slice(0, 10));
  const [eraseEnabled, setEraseEnabled] = useState(false);
  const [prependEnabled, setPrependEnabled] = useState(true);

  // New download args
  const [dlDays, setDlDays] = useState("");
  const [dlNewPairsDays, setDlNewPairsDays] = useState("");
  const [dlIncludeInactivePairs, setDlIncludeInactivePairs] = useState(false);
  const [dlTrades, setDlTrades] = useState(false);
  const [dlConvert, setDlConvert] = useState(false);
  const [dlCandleTypes, setDlCandleTypes] = useState<string[]>([]);
  const [dlDataFormatOhlcv, setDlDataFormatOhlcv] = useState("");
  const [dlNoParallelDownload, setDlNoParallelDownload] = useState(false);

  // Utility card states
  const [convertTradeFrom, setConvertTradeFrom] = useState("json");
  const [convertTradeTo, setConvertTradeTo] = useState("feather");
  const [convertTradeLoading, setConvertTradeLoading] = useState(false);
  const [convertTradeLog, setConvertTradeLog] = useState<LogLine[]>([
    { type: "info", text: "Convert trade data between formats" },
  ]);
  const [tradesToOhlcvLoading, setTradesToOhlcvLoading] = useState(false);
  const [tradesToOhlcvLog, setTradesToOhlcvLog] = useState<LogLine[]>([
    { type: "info", text: "Generate OHLCV candles from downloaded trades" },
  ]);
  const [hyperoptListLoading, setHyperoptListLoading] = useState(false);
  const [hyperoptListResults, setHyperoptListResults] = useState<Array<Record<string, unknown>>>([]);
  const [hyperoptShowEpoch, setHyperoptShowEpoch] = useState("");
  const [hyperoptShowLoading, setHyperoptShowLoading] = useState(false);
  const [hyperoptShowResult, setHyperoptShowResult] = useState<Record<string, unknown> | null>(null);

  // Download progress state
  const [downloading, setDownloading] = useState(false);
  const [dlLog, setDlLog] = useState<LogLine[]>([
    { type: "info", text: "Configure download parameters and click \"Download Data\"" },
  ]);

  // Convert data state
  const [convertFrom, setConvertFrom] = useState("feather");
  const [convertTo, setConvertTo] = useState("parquet");
  const [converting, setConverting] = useState(false);
  const [convertLog, setConvertLog] = useState<LogLine[]>([
    { type: "info", text: "Select source and target format, then click Convert" },
  ]);

  // Pair filter state
  const [pairFilter, setPairFilter] = useState("");

  // API-loaded data
  const [strategiesList, setStrategiesList] = useState<string[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [tradesList, setTradesList] = useState<FTTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [dataEntries, setDataEntries] = useState<DataEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [availablePairsList, setAvailablePairsList] = useState<string[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [pairlistResult, setPairlistResult] = useState<string[]>([]);
  const [pairlistLoading, setPairlistLoading] = useState(false);

  // Utility card visibility toggles
  const [visibleCards, setVisibleCards] = useState<Record<string, boolean>>({
    strat: true, exch: true, tf: true, pairs: true,
    data: true, convert: true, pairlist: true, trades: true,
    hyp: true, fai: true,
  });

  const toggleCard = useCallback((id: string) => {
    setVisibleCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const botId = selectedBotId ? parseInt(selectedBotId, 10) : null;

  // Load bots on mount
  useEffect(() => {
    getBots(true)
      .then((list) => {
        setBots(list);
        if (list.length > 0) setSelectedBotId(String(list[0].id));
      })
      .catch(() => {
        toast.error("Failed to load bots");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle timeframe selection
  const toggleTimeframe = useCallback((tf: string) => {
    setSelectedTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf]
    );
  }, []);

  // Build CLI command string
  const buildCommand = useCallback(() => {
    let cmd = `freqtrade download-data --exchange ${exchange}`;
    cmd += ` --pairs ${selectedPairs.join(" ")}`;
    cmd += ` --timeframes ${selectedTimeframes.join(" ")}`;
    if (dlDays) {
      cmd += ` --days ${dlDays}`;
    } else {
      const ds = dateStart.replace(/-/g, "");
      const de = dateEnd.replace(/-/g, "");
      cmd += ` --timerange ${ds}-${de}`;
    }
    cmd += ` --trading-mode ${tradingMode}`;
    if (eraseEnabled) cmd += " --erase";
    if (prependEnabled) cmd += " --prepend";
    if (dlNewPairsDays) cmd += ` --new-pairs-days ${dlNewPairsDays}`;
    if (dlIncludeInactivePairs) cmd += " --include-inactive-pairs";
    if (dlTrades) cmd += " --dl-trades";
    if (dlConvert) cmd += " --convert";
    if (dlCandleTypes.length > 0) cmd += ` --candle-types ${dlCandleTypes.join(" ")}`;
    if (dlDataFormatOhlcv) cmd += ` --data-format-ohlcv ${dlDataFormatOhlcv}`;
    if (dlNoParallelDownload) cmd += " --no-parallel-download";
    return cmd;
  }, [selectedPairs, exchange, tradingMode, selectedTimeframes, dateStart, dateEnd, eraseEnabled, prependEnabled, dlDays, dlNewPairsDays, dlIncludeInactivePairs, dlTrades, dlConvert, dlCandleTypes, dlDataFormatOhlcv, dlNoParallelDownload]);

  // Show CLI command
  const showCommand = useCallback(() => {
    setDlLog((prev) => [...prev, { type: "info", text: buildCommand() }]);
  }, [buildCommand]);

  // Real download via API
  const startDownload = useCallback(async () => {
    if (downloading) return;
    const total = selectedPairs.length * selectedTimeframes.length;
    if (total === 0) return;

    const cmd = buildCommand();
    setDownloading(true);
    setDlLog((prev) => [
      ...prev,
      { type: "info", text: cmd },
      { type: "warn", text: `Starting download for ${total} datasets...` },
    ]);

    if (!botId) {
      setDlLog((prev) => [
        ...prev,
        { type: "err", text: "No bot selected. Select a bot to send the download command." },
        { type: "info", text: "Manual command: " + cmd },
      ]);
      setDownloading(false);
      toast.error("No bot selected");
      return;
    }

    const ds = dateStart.replace(/-/g, "");
    const de = dateEnd.replace(/-/g, "");

    try {
      const params: Parameters<typeof botDownloadData>[1] = {
        pairs: selectedPairs,
        timeframes: selectedTimeframes,
        exchange,
        trading_mode: tradingMode,
        erase: eraseEnabled,
        prepend: prependEnabled,
      };
      if (dlDays) {
        params.days = parseInt(dlDays, 10);
      } else {
        params.timerange = `${ds}-${de}`;
      }
      if (dlNewPairsDays) params.new_pairs_days = parseInt(dlNewPairsDays, 10);
      if (dlIncludeInactivePairs) params.include_inactive_pairs = true;
      if (dlTrades) params.dl_trades = true;
      if (dlConvert) params.convert = true;
      if (dlCandleTypes.length > 0) params.candle_types = dlCandleTypes;
      if (dlDataFormatOhlcv) params.data_format_ohlcv = dlDataFormatOhlcv;
      if (dlNoParallelDownload) params.no_parallel_download = true;
      const startResult = await botDownloadData(botId, params);
      const jobId = startResult.job_id;
      if (!jobId) {
        // Fallback: old sync response (no job_id means it completed inline)
        setDlLog((prev) => [...prev, { type: "ok", text: startResult.message || `Download completed for ${total} datasets` }]);
        toast.success("Download completed");
        loadDataList();
        setDownloading(false);
        return;
      }
      setDlLog((prev) => [...prev, { type: "info", text: `Download job started (${jobId}). Polling for completion...` }]);

      // Poll for completion
      const pollInterval = 3000;
      const maxPolls = 600; // 30 minutes max
      let polls = 0;
      const poll = async (): Promise<void> => {
        polls++;
        try {
          const status = await botDownloadDataStatus(botId, jobId);
          if (status.status === "running") {
            if (polls % 10 === 0) {
              setDlLog((prev) => [...prev, { type: "info", text: `Still downloading... (${Math.round(polls * pollInterval / 1000)}s elapsed)` }]);
            }
            if (polls < maxPolls) {
              await new Promise<void>((r) => { setTimeout(r, pollInterval); });
              return poll();
            }
            setDlLog((prev) => [...prev, { type: "err", text: "Download timed out after 30 minutes." }]);
            toast.error("Download timed out");
            return;
          }
          // Completed or error
          const outputLines = (status.output || "").split("\n").filter(Boolean).slice(-20);
          for (const line of outputLines) {
            const isErr = status.status === "error" || line.toLowerCase().includes("error");
            setDlLog((prev) => [...prev, { type: isErr ? "err" : "ok", text: line }]);
          }
          if (status.status === "completed") {
            setDlLog((prev) => [...prev, { type: "ok", text: `Download completed for ${total} datasets` }]);
            toast.success("Download completed");
            loadDataList();
          } else {
            setDlLog((prev) => [...prev, { type: "err", text: `Download failed (exit code: ${status.exit_code})` }]);
            toast.error("Download failed — check log for details");
          }
        } catch (pollErr) {
          setDlLog((prev) => [...prev, { type: "err", text: `Poll error: ${pollErr instanceof Error ? pollErr.message : "Unknown"}` }]);
          toast.error("Failed to check download status");
        }
      };
      await poll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDlLog((prev) => [
        ...prev,
        { type: "err", text: `Download failed: ${msg}` },
        { type: "info", text: "You can run this command manually on the server:" },
        { type: "info", text: cmd },
      ]);
      toast.error(`Download failed: ${msg}`);
    } finally {
      setDownloading(false);
    }
  }, [downloading, buildCommand, selectedPairs, selectedTimeframes, botId, exchange, tradingMode, dateStart, dateEnd, eraseEnabled, prependEnabled, dlDays, dlNewPairsDays, dlIncludeInactivePairs, dlTrades, dlConvert, dlCandleTypes, dlDataFormatOhlcv, dlNoParallelDownload, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real convert via API
  const runConvert = useCallback(async () => {
    if (convertFrom === convertTo) {
      setConvertLog([{ type: "err", text: "Source and target format are the same" }]);
      return;
    }
    if (!botId) {
      const cmd = `freqtrade convert-data --format-from ${convertFrom} --format-to ${convertTo}`;
      setConvertLog([
        { type: "err", text: "No bot selected. Select a bot to run convert." },
        { type: "info", text: "Manual command: " + cmd },
      ]);
      toast.error("No bot selected");
      return;
    }
    setConverting(true);
    setConvertLog([{ type: "warn", text: `Converting all data from ${convertFrom} to ${convertTo}...` }]);

    try {
      const result = await botConvertData(botId, {
        format_from: convertFrom,
        format_to: convertTo,
      });
      setConvertLog((prev) => [
        ...prev,
        { type: "ok", text: result.message || `Converted data from ${convertFrom} to ${convertTo}` },
      ]);
      toast.success("Conversion completed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const cmd = `freqtrade convert-data --format-from ${convertFrom} --format-to ${convertTo}`;
      setConvertLog((prev) => [
        ...prev,
        { type: "err", text: `Conversion failed: ${msg}` },
        { type: "info", text: "Manual command: " + cmd },
      ]);
      toast.error(`Conversion failed: ${msg}`);
    } finally {
      setConverting(false);
    }
  }, [convertFrom, convertTo, botId, toast]);

  // Load strategies from FT API
  const loadStrategies = useCallback(async () => {
    if (!botId) return;
    setStrategiesLoading(true);
    try {
      const res = await botFtStrategies(botId);
      setStrategiesList(res.strategies);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load strategies: ${msg}`);
    } finally {
      setStrategiesLoading(false);
    }
  }, [botId, toast]);

  // Load trades from FT API
  const loadTrades = useCallback(async () => {
    if (!botId) return;
    setTradesLoading(true);
    try {
      const res = await botTrades(botId, 50);
      setTradesList(res.trades);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load trades: ${msg}`);
    } finally {
      setTradesLoading(false);
    }
  }, [botId, toast]);

  // Load data listing from FT API
  const loadDataList = useCallback(async () => {
    if (!botId) return;
    setDataLoading(true);
    try {
      const res = await botListData(botId);
      setDataEntries(res.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load data listing: ${msg}`);
      setDataEntries([]);
    } finally {
      setDataLoading(false);
    }
  }, [botId, toast]);

  // Load available pairs from FT API
  const loadAvailablePairs = useCallback(async () => {
    if (!botId) return;
    setPairsLoading(true);
    try {
      const res = await botAvailablePairs(botId);
      setAvailablePairsList(res.pairs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to load pairs: ${msg}`);
      setAvailablePairsList([]);
    } finally {
      setPairsLoading(false);
    }
  }, [botId, toast]);

  // Load pairlist test results (uses whitelist as proxy)
  const loadPairlist = useCallback(async () => {
    if (!botId) return;
    setPairlistLoading(true);
    try {
      // botWhitelist returns the active pairlist result
      const { botWhitelist } = await import("@/lib/api");
      const res = await botWhitelist(botId);
      setPairlistResult(res.whitelist);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to test pairlist: ${msg}`);
      setPairlistResult([]);
    } finally {
      setPairlistLoading(false);
    }
  }, [botId, toast]);

  // Handle multi-select for pairs
  const handlePairSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedPairs(opts);
  };

  // Filtered pairs for list-pairs card
  const displayPairs = availablePairsList.length > 0 ? availablePairsList : PAIRS;
  const filteredPairs = displayPairs.filter((p) => p.toLowerCase().includes(pairFilter.toLowerCase()));

  // Format numbers for display
  const fmtNum = (n: number | null | undefined) => {
    if (n == null) return "-";
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "-";
    return d.replace("T", " ").slice(0, 16);
  };

  return (
    <AppShell title="Data Management">

      {/* ── Bot Selector ── */}
      <div className="mb-5 flex items-center gap-3">
        <Tooltip content={"Select the bot instance to manage data for"} configKey="bot_id">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bot</label>
        </Tooltip>
        <select
          className="bg-card border border-border rounded-btn py-2 px-3 text-xs text-muted-foreground outline-none focus:border-primary transition-colors appearance-none min-w-[200px]"
          value={selectedBotId}
          onChange={(e) => setSelectedBotId(e.target.value)}
        >
          {bots.length === 0 && <option value="">No bots available</option>}
          {bots.map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.name} (ID: {b.id})
            </option>
          ))}
        </select>
        {!botId && bots.length === 0 && (
          <span className="text-xs text-amber-500">Register a bot in Settings to use data management</span>
        )}
      </div>

      {/* ===============================================
          SECTION 1: DATA DOWNLOAD (S12)
          CLI: freqtrade download-data
          =============================================== */}

      <SectionTitle icon="📥">Data Download</SectionTitle>
      <SectionRef>
        &sect;12 -- freqtrade download-data -- Download OHLCV &amp; ticker data from exchanges
      </SectionRef>

      <Card className="mb-6">
        <CardHeader
          title="Download Configuration"
          icon="⚙️"
          action={<span className="text-xs text-muted-foreground">CLI: freqtrade download-data [args]</span>}
        />
        <CardBody>
          {/* Row 1: Pairs + Exchange */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div className="flex flex-col gap-1.5">
              <Tooltip content={TOOLTIPS.download_data_pairs?.description ?? "Pairs to download historical data for"} configKey="--pairs">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  --pairs <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">(multi-select)</span>
                </label>
              </Tooltip>
              <select
                className="bg-card border border-border rounded-btn p-2.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors min-h-[110px]"
                multiple
                value={selectedPairs}
                onChange={handlePairSelect}
              >
                {PAIRS.map((p) => (
                  <option key={p} value={p} className="bg-card text-muted-foreground py-1 px-2 rounded-sm">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Tooltip content={TOOLTIPS.download_data_exchange?.description ?? "Exchange to download data from"} configKey="--exchange">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">--exchange</label>
              </Tooltip>
              <select
                className="bg-card border border-border rounded-btn py-2.5 px-3.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors appearance-none"
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
              >
                {EXCHANGES.map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>

              <div className="mt-3">
                <Tooltip content={TOOLTIPS.download_data_trading_mode?.description ?? "Download data for spot or futures"} configKey="--trading-mode">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">--trading-mode</label>
                </Tooltip>
                <select
                  className="mt-1.5 w-full bg-card border border-border rounded-btn py-2.5 px-3.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors appearance-none"
                  value={tradingMode}
                  onChange={(e) => setTradingMode(e.target.value)}
                >
                  <option value="futures">futures</option>
                  <option value="spot">spot</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Timeframes */}
          <div className="mb-4">
            <Tooltip content={TOOLTIPS.download_data_timeframes?.description ?? "Timeframes to download data for"} configKey="--timeframes">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                --timeframes <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">(select one or more)</span>
              </label>
            </Tooltip>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  type="button"
                  key={tf}
                  onClick={() => toggleTimeframe(tf)}
                  className={`text-xs px-2.5 py-1 rounded-btn border transition-all cursor-pointer select-none ${
                    selectedTimeframes.includes(tf)
                      ? "border-primary bg-primary-glow text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-border-border hover:border-ring hover:text-muted-foreground"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Date range / Days */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
            <div className="flex flex-col gap-1.5">
              <Tooltip content={TOOLTIPS.download_data_timerange?.description ?? "Start date for data download range"} configKey="--timerange">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  --timerange <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">start</span>
                </label>
              </Tooltip>
              <input
                type="date"
                className="bg-card border border-border rounded-btn py-2.5 px-3.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors disabled:opacity-40"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                disabled={!!dlDays}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Tooltip content={TOOLTIPS.download_data_timerange?.description ?? "End date for data download range"} configKey="--timerange">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  --timerange <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">end</span>
                </label>
              </Tooltip>
              <input
                type="date"
                className="bg-card border border-border rounded-btn py-2.5 px-3.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors disabled:opacity-40"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                disabled={!!dlDays}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Tooltip content={"Number of days of data to download. Overrides --timerange when set."} configKey="--days">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  --days <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">(overrides timerange)</span>
                </label>
              </Tooltip>
              <input
                type="number"
                className="bg-card border border-border rounded-btn py-2.5 px-3.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors"
                value={dlDays}
                onChange={(e) => setDlDays(e.target.value)}
                placeholder="e.g. 30"
                min={1}
              />
            </div>
          </div>

          {/* Row 3b: New Pairs Days */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div className="flex flex-col gap-1.5">
              <Tooltip content={"Number of days to download for newly listed pairs. Only applies to pairs not yet in the data directory."} configKey="--new-pairs-days">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  --new-pairs-days <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">Days for newly listed pairs</span>
                </label>
              </Tooltip>
              <input
                type="number"
                className="bg-card border border-border rounded-btn py-2.5 px-3.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors"
                value={dlNewPairsDays}
                onChange={(e) => setDlNewPairsDays(e.target.value)}
                placeholder="e.g. 30"
                min={1}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Tooltip content={"Storage format for OHLCV data. Options: json, jsongz, feather, parquet. Feather and parquet are faster for large datasets."} configKey="--data-format-ohlcv">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  --data-format-ohlcv <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">Storage format</span>
                </label>
              </Tooltip>
              <select
                className="bg-card border border-border rounded-btn py-2.5 px-3.5 text-xs text-muted-foreground outline-none focus:border-primary transition-colors appearance-none"
                value={dlDataFormatOhlcv}
                onChange={(e) => setDlDataFormatOhlcv(e.target.value)}
              >
                <option value="">Default</option>
                {DATA_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3c: Candle Types multi-select */}
          <div className="mb-4">
            <Tooltip content={"Types of candle data to download: spot, futures, mark price, index price, premium index, or funding rate."} configKey="--candle-types">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                --candle-types <span className="font-normal normal-case tracking-normal text-muted-foreground text-xs">(select one or more)</span>
              </label>
            </Tooltip>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {CANDLE_TYPES.map((ct) => (
                <button
                  type="button"
                  key={ct}
                  onClick={() =>
                    setDlCandleTypes((prev) =>
                      prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct]
                    )
                  }
                  className={`text-xs px-2.5 py-1 rounded-btn border transition-all cursor-pointer select-none ${
                    dlCandleTypes.includes(ct)
                      ? "border-primary bg-primary-glow text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-border-border hover:border-ring hover:text-muted-foreground"
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Toggles */}
          <div className="flex gap-8 flex-wrap mb-2">
            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setEraseEnabled(!eraseEnabled)}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${eraseEnabled ? "bg-red" : "bg-muted"}`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform ${eraseEnabled ? "translate-x-4" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground">
                --erase <span className="text-rose-500 text-xs font-medium ml-1">Delete existing data first (destructive)</span>
              </span>
            </div>

            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setPrependEnabled(!prependEnabled)}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${prependEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform ${prependEnabled ? "translate-x-4" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground">
                --prepend <span className="text-muted-foreground text-xs ml-1">Add older data before existing</span>
              </span>
            </div>

            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setDlIncludeInactivePairs(!dlIncludeInactivePairs)}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${dlIncludeInactivePairs ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform ${dlIncludeInactivePairs ? "translate-x-4" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground">
                --include-inactive-pairs <span className="text-muted-foreground text-xs ml-1">Include delisted pairs</span>
              </span>
            </div>

            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setDlTrades(!dlTrades)}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${dlTrades ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform ${dlTrades ? "translate-x-4" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground">
                --dl-trades <span className="text-muted-foreground text-xs ml-1">Download trades instead of OHLCV</span>
              </span>
            </div>

            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setDlConvert(!dlConvert)}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${dlConvert ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform ${dlConvert ? "translate-x-4" : ""}`} />
              </button>
              <Tooltip
                content={TOOLTIPS.download_data_convert?.description || "Auto-convert after download"}
                configKey={TOOLTIPS.download_data_convert?.configKey}
              >
                <span className="text-xs text-muted-foreground">Auto-convert after download</span>
              </Tooltip>
            </div>

            <div className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => setDlNoParallelDownload(!dlNoParallelDownload)}
                className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${dlNoParallelDownload ? "bg-amber" : "bg-muted"}`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform ${dlNoParallelDownload ? "translate-x-4" : ""}`} />
              </button>
              <Tooltip
                content={TOOLTIPS.download_data_parallel?.description || "Sequential download (advanced)"}
                configKey={TOOLTIPS.download_data_parallel?.configKey}
              >
                <span className="text-xs text-muted-foreground">Sequential download (advanced)</span>
              </Tooltip>
            </div>
          </div>

          {/* Erase warning */}
          {eraseEnabled && (
            <div className="mb-3 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-btn text-xs text-rose-500">
              WARNING: --erase will permanently delete all existing data for the selected pairs and timeframes before downloading. This cannot be undone.
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={startDownload}
              disabled={downloading}
              className="px-4 py-2 rounded-btn text-xs font-semibold bg-primary text-white border border-primary hover:bg-primary-dim hover:shadow-[0_0_20px_var(--color-accent)] transition-all disabled:opacity-50"
            >
              {downloading ? "Downloading..." : "📥 Download Data"}
            </button>
            <button
              type="button"
              onClick={showCommand}
              className="px-4 py-2 rounded-btn text-xs font-semibold bg-muted text-muted-foreground border border-border hover:border-border-border hover:border-ring hover:bg-card transition-all"
            >
              📋 Show CLI Command
            </button>
            {downloading && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-amber-500 font-medium">Downloading...</span>
              </div>
            )}
          </div>

          {/* Log */}
          <div className="mt-3">
            <LogArea lines={dlLog} />
          </div>
        </CardBody>
      </Card>


      {/* ===============================================
          SECTION 2: UTILITY COMMANDS (S18)
          =============================================== */}

      <div className="mt-7">
        <SectionTitle icon="🔧">Utility Commands</SectionTitle>
        <SectionRef>
          &sect;18 -- FreqTrade utility sub-commands -- list-strategies, list-exchanges, list-pairs, list-data, convert-data, etc.
        </SectionRef>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* ── LIST STRATEGIES ── */}
        <UtilCard
          icon="🎯"
          title="List Strategies"
          cmd="freqtrade list-strategies --userdir user_data"
          onRun={loadStrategies}
          loading={strategiesLoading}
          runLabel={strategiesList.length > 0 ? "\u21BB Refresh" : "\u25B6 Run"}
        >
          {strategiesLoading ? (
            <Spinner />
          ) : strategiesList.length === 0 ? (
            <EmptyState message={botId ? "Click Run to load strategies from the bot" : "Select a bot first"} />
          ) : (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["#", "Strategy Name"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {strategiesList.map((name, i) => (
                    <tr key={name} className="hover:bg-muted transition-colors">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground pt-2">{strategiesList.length} strategies found</div>
            </>
          )}
        </UtilCard>

        {/* ── LIST EXCHANGES ── */}
        <UtilCard
          icon="🌐"
          title="List Exchanges"
          cmd="freqtrade list-exchanges"
          onRun={() => toggleCard("exch")}
        >
          {visibleCards.exch && (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Exchange", "Spot", "Margin", "Futures", "Status"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exchangeList.map((ex) => (
                  <tr key={ex.name} className="hover:bg-muted transition-colors">
                    <td className={`px-3 py-2 text-xs ${ex.name === "binance" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {ex.name}
                    </td>
                    <td className={`px-3 py-2 text-xs ${ex.spot ? "text-emerald-500" : "text-muted-foreground"}`}>{ex.spot ? "Yes" : "No"}</td>
                    <td className={`px-3 py-2 text-xs ${ex.margin ? "text-emerald-500" : "text-muted-foreground"}`}>{ex.margin ? "Yes" : "No"}</td>
                    <td className={`px-3 py-2 text-xs ${ex.futures ? "text-emerald-500" : "text-muted-foreground"}`}>{ex.futures ? "Yes" : "No"}</td>
                    <td className="px-3 py-2"><StatusBadge status={ex.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </UtilCard>

        {/* ── LIST TIMEFRAMES ── */}
        <UtilCard
          icon="⏱️"
          title="List Timeframes"
          cmd="freqtrade list-timeframes --exchange binance"
          onRun={() => toggleCard("tf")}
        >
          {visibleCards.tf && (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Exchange", "Available Timeframes"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeframeList.map((row) => (
                  <tr key={row.exchange} className="hover:bg-muted transition-colors">
                    <td className={`px-3 py-2 text-xs ${row.exchange === "binance" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {row.exchange}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{row.timeframes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </UtilCard>

        {/* ── LIST PAIRS ── */}
        <UtilCard
          icon="💱"
          title="List Pairs"
          cmd="freqtrade list-pairs --exchange binance --trading-mode futures"
          onRun={loadAvailablePairs}
          loading={pairsLoading}
          runLabel={availablePairsList.length > 0 ? "\u21BB Refresh" : "\u25B6 Run"}
        >
          {pairsLoading ? (
            <Spinner />
          ) : (
            <>
              <div className="flex gap-2 mb-2.5 flex-wrap items-center">
                <input
                  className="bg-card border border-border rounded-btn py-1 px-2.5 text-xs text-muted-foreground outline-none focus:border-primary w-40"
                  placeholder="Filter pairs..."
                  value={pairFilter}
                  onChange={(e) => setPairFilter(e.target.value)}
                />
                <select className="bg-card border border-border rounded-btn py-1 px-2.5 text-xs text-muted-foreground outline-none appearance-none pr-5">
                  <option>Quote: USDT</option>
                  <option>Quote: BUSD</option>
                  <option>Quote: All</option>
                </select>
                <select className="bg-card border border-border rounded-btn py-1 px-2.5 text-xs text-muted-foreground outline-none appearance-none pr-5">
                  <option>Mode: futures</option>
                  <option>Mode: spot</option>
                </select>
                <span className="text-xs text-muted-foreground ml-auto">
                  Showing {filteredPairs.length} of {displayPairs.length} pairs
                  {availablePairsList.length === 0 && " (static fallback)"}
                </span>
              </div>
              <div className="leading-loose">
                {filteredPairs.map((p) => (
                  <span
                    key={p}
                    className={`inline-block px-2 py-0.5 rounded-sm text-xs font-semibold m-0.5 ${
                      selectedPairs.includes(p)
                        ? "bg-primary-glow text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </>
          )}
        </UtilCard>

        {/* ── LIST DATA ── */}
        <UtilCard
          icon="📂"
          title="List Data"
          cmd="freqtrade list-data --userdir user_data"
          onRun={loadDataList}
          loading={dataLoading}
          runLabel={dataEntries.length > 0 ? "\u21BB Refresh" : "\u25B6 Run"}
          span2
        >
          {dataLoading ? (
            <Spinner />
          ) : dataEntries.length === 0 ? (
            <EmptyState message={botId ? "Click Run to load data listing from the bot" : "Select a bot first"} />
          ) : (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Pair", "Timeframe", "Start", "End", "Candles", "Format"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataEntries.map((d) => (
                    <tr key={`${d.pair}-${d.timeframe}`} className="hover:bg-muted transition-colors">
                      <td className={`px-3 py-2 text-xs ${["BTC/USDT:USDT", "ETH/USDT:USDT"].includes(d.pair) ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {d.pair}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.timeframe}</td>
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{d.start}</td>
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{d.end}</td>
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{d.candle_count.toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{d.candle_type || d.format || "futures"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground pt-2">
                Total: {dataEntries.length} datasets
              </div>
            </>
          )}
        </UtilCard>

        {/* ── CONVERT DATA ── */}
        <UtilCard
          icon="🔄"
          title="Convert Data"
          cmd="freqtrade convert-data --format-from json --format-to feather"
          onRun={runConvert}
          runLabel={converting ? "Converting..." : "\u25B6 Convert"}
          loading={converting}
        >
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="flex flex-col gap-1.5">
              <Tooltip content={"Source data format to convert from"} configKey="--format-from">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">--format-from</label>
              </Tooltip>
              <select
                className="bg-card border border-border rounded-btn py-2 px-3 text-xs text-muted-foreground outline-none focus:border-primary appearance-none"
                value={convertFrom}
                onChange={(e) => setConvertFrom(e.target.value)}
              >
                <option>json</option>
                <option>feather</option>
                <option>parquet</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Tooltip content={"Target data format to convert to"} configKey="--format-to">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">--format-to</label>
              </Tooltip>
              <select
                className="bg-card border border-border rounded-btn py-2 px-3 text-xs text-muted-foreground outline-none focus:border-primary appearance-none"
                value={convertTo}
                onChange={(e) => setConvertTo(e.target.value)}
              >
                <option>json</option>
                <option>feather</option>
                <option>parquet</option>
              </select>
            </div>
          </div>
          <LogArea lines={convertLog} className="max-h-20 !mt-0" />
        </UtilCard>

        {/* ── TEST PAIRLIST ── */}
        <UtilCard
          icon="🧪"
          title="Test Pairlist"
          cmd="freqtrade test-pairlist --config user_data/config.json"
          onRun={loadPairlist}
          loading={pairlistLoading}
          runLabel={pairlistResult.length > 0 ? "\u21BB Refresh" : "\u25B6 Run"}
        >
          {pairlistLoading ? (
            <Spinner />
          ) : pairlistResult.length === 0 ? (
            <EmptyState message={botId ? "Click Run to test the pairlist config" : "Select a bot first"} />
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                Pairlist result from config.json pairlist handlers:
              </div>
              <div className="leading-loose">
                {pairlistResult.map((p) => (
                  <span
                    key={p}
                    className="inline-block px-2 py-0.5 rounded-sm text-xs font-semibold m-0.5 bg-primary-glow text-primary border border-primary/20"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                {pairlistResult.length} pairs passed
              </div>
            </>
          )}
        </UtilCard>

        {/* ── SHOW TRADES ── */}
        <UtilCard
          icon="📄"
          title="Show Trades"
          cmd="freqtrade show-trades --db-url sqlite:///user_data/tradesv3.sqlite --print-json"
          onRun={loadTrades}
          loading={tradesLoading}
          runLabel={tradesList.length > 0 ? "\u21BB Refresh" : "\u25B6 Run"}
          span2
        >
          {tradesLoading ? (
            <Spinner />
          ) : tradesList.length === 0 ? (
            <EmptyState message={botId ? "Click Run to load trades from the bot" : "Select a bot first"} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["trade_id", "Pair", "is_short", "open_rate", "close_rate", "close_profit_abs", "stake_amount", "open_date", "close_date", "exit_reason"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tradesList.map((t) => {
                      const profitAbs = t.close_profit_abs;
                      const profitStr = profitAbs != null ? (profitAbs >= 0 ? `+${fmtNum(profitAbs)}` : fmtNum(profitAbs)) : "-";
                      const isNeg = profitAbs != null && profitAbs < 0;
                      return (
                        <tr key={t.trade_id} className="hover:bg-muted transition-colors">
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{t.trade_id}</td>
                          <td className={`px-3 py-2 text-xs ${["BTC/USDT:USDT", "ETH/USDT:USDT"].includes(t.pair) ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {t.pair}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{String(t.is_short)}</td>
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{fmtNum(t.open_rate)}</td>
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{fmtNum(t.close_rate)}</td>
                          <td className={`px-3 py-2 text-xs font-semibold ${isNeg ? "text-rose-500" : "text-emerald-500"}`}>
                            {profitStr}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{fmtNum(t.stake_amount)}</td>
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{fmtDate(t.open_date)}</td>
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{fmtDate(t.close_date)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{t.exit_reason ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                {tradesList.length} trades loaded from bot
              </div>
            </>
          )}
        </UtilCard>

        {/* ── LIST HYPEROPT LOSS ── */}
        <UtilCard
          icon="📉"
          title="List Hyperopt Loss"
          cmd="freqtrade list-hyperoptloss"
          onRun={() => toggleCard("hyp")}
        >
          {visibleCards.hyp && (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["#", "Loss Function"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hyperoptLosses.map((name, i) => (
                    <tr key={name} className="hover:bg-muted transition-colors">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground pt-2">12 loss functions available</div>
            </>
          )}
        </UtilCard>

        {/* ── LIST FREQAI MODELS ── */}
        <UtilCard
          icon="🤖"
          title="List FreqAI Models"
          cmd="freqtrade list-freqaimodels"
          onRun={() => toggleCard("fai")}
        >
          {visibleCards.fai && (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["#", "Model", "Type"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {freqaiModels.map((m, i) => (
                    <tr key={m.name} className="hover:bg-muted transition-colors">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{m.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{m.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground pt-2">
                14 FreqAI models available &middot; Installed: LightGBM 4.6.0, XGBoost 3.2.0, scikit-learn 1.8.0
              </div>
            </>
          )}
        </UtilCard>

        {/* ── CONVERT TRADE DATA ── */}
        <UtilCard
          icon="🔁"
          title="Convert Trade Data"
          cmd="freqtrade convert-trade-data --format-from json --format-to feather"
          onRun={async () => {
            if (!botId) { toast.error("No bot selected"); return; }
            if (convertTradeFrom === convertTradeTo) { setConvertTradeLog([{ type: "err", text: "Source and target format are the same" }]); return; }
            setConvertTradeLoading(true);
            setConvertTradeLog([{ type: "warn", text: `Converting trade data from ${convertTradeFrom} to ${convertTradeTo}...` }]);
            try {
              const result = await botConvertTradeData(botId, { format_from: convertTradeFrom, format_to: convertTradeTo });
              setConvertTradeLog((prev) => [...prev, { type: "ok", text: result.message || "Trade data converted" }]);
              toast.success("Trade data conversion completed");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              setConvertTradeLog((prev) => [...prev, { type: "err", text: `Conversion failed: ${msg}` }]);
              toast.error(`Conversion failed: ${msg}`);
            } finally {
              setConvertTradeLoading(false);
            }
          }}
          runLabel={convertTradeLoading ? "Converting..." : "\u25B6 Convert"}
          loading={convertTradeLoading}
        >
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="flex flex-col gap-1.5">
              <Tooltip content={"Source trade data format to convert from"} configKey="--format-from">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">--format-from</label>
              </Tooltip>
              <select
                className="bg-card border border-border rounded-btn py-2 px-3 text-xs text-muted-foreground outline-none focus:border-primary appearance-none"
                value={convertTradeFrom}
                onChange={(e) => setConvertTradeFrom(e.target.value)}
              >
                <option>json</option><option>feather</option><option>parquet</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Tooltip content={"Target trade data format to convert to"} configKey="--format-to">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">--format-to</label>
              </Tooltip>
              <select
                className="bg-card border border-border rounded-btn py-2 px-3 text-xs text-muted-foreground outline-none focus:border-primary appearance-none"
                value={convertTradeTo}
                onChange={(e) => setConvertTradeTo(e.target.value)}
              >
                <option>json</option><option>feather</option><option>parquet</option>
              </select>
            </div>
          </div>
          <LogArea lines={convertTradeLog} className="max-h-20 !mt-0" />
        </UtilCard>

        {/* ── TRADES TO OHLCV ── */}
        <UtilCard
          icon="📊"
          title="Trades to OHLCV"
          cmd="freqtrade trades-to-ohlcv --pairs BTC/USDT:USDT --timeframes 1h"
          onRun={async () => {
            if (!botId) { toast.error("No bot selected"); return; }
            setTradesToOhlcvLoading(true);
            setTradesToOhlcvLog([{ type: "warn", text: "Generating OHLCV from downloaded trades..." }]);
            try {
              const result = await botTradesToOhlcv(botId, { pairs: selectedPairs, timeframes: selectedTimeframes });
              setTradesToOhlcvLog((prev) => [...prev, { type: "ok", text: result.message || "OHLCV generated from trades" }]);
              toast.success("Trades-to-OHLCV completed");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              setTradesToOhlcvLog((prev) => [...prev, { type: "err", text: `Failed: ${msg}` }]);
              toast.error(`Failed: ${msg}`);
            } finally {
              setTradesToOhlcvLoading(false);
            }
          }}
          runLabel={tradesToOhlcvLoading ? "Generating..." : "\u25B6 Generate"}
          loading={tradesToOhlcvLoading}
        >
          <div className="text-xs text-muted-foreground mb-2">
            Generate OHLCV candle data from previously downloaded raw trades.
            Uses the pairs and timeframes selected in the download form above.
          </div>
          <LogArea lines={tradesToOhlcvLog} className="max-h-20 !mt-0" />
        </UtilCard>

        {/* ── HYPEROPT LIST ── */}
        <UtilCard
          icon="📋"
          title="Hyperopt List"
          cmd="freqtrade hyperopt-list --userdir user_data"
          onRun={async () => {
            if (!botId) { toast.error("No bot selected"); return; }
            setHyperoptListLoading(true);
            try {
              const result = await botHyperoptList(botId);
              setHyperoptListResults(result.results);
              if (result.results.length === 0) toast.info("No hyperopt results found");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              toast.error(`Failed to load hyperopt results: ${msg}`);
              setHyperoptListResults([]);
            } finally {
              setHyperoptListLoading(false);
            }
          }}
          loading={hyperoptListLoading}
          runLabel={hyperoptListResults.length > 0 ? "\u21BB Refresh" : "\u25B6 Run"}
          span2
        >
          {hyperoptListLoading ? (
            <Spinner />
          ) : hyperoptListResults.length === 0 ? (
            <EmptyState message={botId ? "Click Run to browse hyperopt results" : "Select a bot first"} />
          ) : (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Epoch", "Trades", "Avg Profit", "Total Profit", "Loss"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hyperoptListResults.slice(0, 50).map((r, i) => (
                    <tr key={`ho-${i}`} className="hover:bg-muted transition-colors cursor-pointer" onClick={() => setHyperoptShowEpoch(String(r.epoch ?? i + 1))}>
                      <td className="px-3 py-2 text-xs font-mono text-primary">{String(r.epoch ?? i + 1)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{String(r.trades ?? r.total_trades ?? "-")}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{typeof r.avg_profit === "number" ? r.avg_profit.toFixed(4) : String(r.avg_profit ?? "-")}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{typeof r.total_profit === "number" ? r.total_profit.toFixed(4) : String(r.total_profit ?? "-")}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{typeof r.loss === "number" ? r.loss.toFixed(6) : String(r.loss ?? "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-muted-foreground pt-2">{hyperoptListResults.length} epochs found (click row to view details)</div>
            </>
          )}
        </UtilCard>

        {/* ── HYPEROPT SHOW ── */}
        <UtilCard
          icon="🔎"
          title="Hyperopt Show"
          cmd={`freqtrade hyperopt-show --best-n ${hyperoptShowEpoch || "1"}`}
          onRun={async () => {
            if (!botId) { toast.error("No bot selected"); return; }
            const epoch = parseInt(hyperoptShowEpoch, 10);
            if (!epoch || epoch < 1) { toast.error("Enter a valid epoch number"); return; }
            setHyperoptShowLoading(true);
            try {
              const result = await botHyperoptShow(botId, epoch);
              setHyperoptShowResult(result);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              toast.error(`Failed to load epoch detail: ${msg}`);
              setHyperoptShowResult(null);
            } finally {
              setHyperoptShowLoading(false);
            }
          }}
          loading={hyperoptShowLoading}
          runLabel="\u25B6 Show"
        >
          <div className="mb-3">
            <Tooltip content={"Hyperopt epoch number to view detailed results for"} configKey="--hyperopt-show">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Epoch #</label>
            </Tooltip>
            <input
              type="number"
              className="mt-1 bg-card border border-border rounded-btn py-2 px-3 text-xs text-muted-foreground outline-none focus:border-primary w-24"
              value={hyperoptShowEpoch}
              onChange={(e) => setHyperoptShowEpoch(e.target.value)}
              placeholder="e.g. 1"
              min={1}
            />
          </div>
          {hyperoptShowLoading ? (
            <Spinner />
          ) : !hyperoptShowResult ? (
            <EmptyState message="Enter an epoch number and click Show" />
          ) : (
            <div className="bg-background border border-border rounded-btn p-3 font-mono text-xs leading-relaxed text-muted-foreground max-h-52 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(hyperoptShowResult, null, 2)}
            </div>
          )}
        </UtilCard>
      </div>
    </AppShell>
  );
}
