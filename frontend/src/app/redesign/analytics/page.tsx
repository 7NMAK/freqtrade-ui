"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/* ══════════════════════════════════════
   ANALYTICS — Performance Analysis
   Audit lines 91-94:
   ✅ Static analytics display — charts placeholder
   ✅ Performance summary cards
   ✅ Monthly P&L grid
   ✅ Top/bottom performers
   ✅ Metrics table
   ══════════════════════════════════════ */

const PERF_CARDS = [
  { label: "Total Return", value: "+$6,271", sub: "+12.4% all-time", up: true },
  { label: "Avg Monthly", value: "+$1,045", sub: "6 months tracked", up: true },
  { label: "Best Month", value: "+$2,340", sub: "February 2026", up: true },
  { label: "Worst Month", value: "-$410", sub: "January 2026", up: false },
  { label: "Avg Win/Loss", value: "1.8:1", sub: "Risk-reward ratio", up: true },
  { label: "Profit Factor", value: "2.31", sub: "Gross P / Gross L", up: true },
];

const MONTHLY = [
  { month: "Oct 2025", pnl: "+$890", pnlNum: 890, trades: 42, tradesNum: 42, winRate: "67%", winRateNum: 67 },
  { month: "Nov 2025", pnl: "+$1,120", pnlNum: 1120, trades: 58, tradesNum: 58, winRate: "71%", winRateNum: 71 },
  { month: "Dec 2025", pnl: "+$680", pnlNum: 680, trades: 39, tradesNum: 39, winRate: "64%", winRateNum: 64 },
  { month: "Jan 2026", pnl: "-$410", pnlNum: -410, trades: 51, tradesNum: 51, winRate: "53%", winRateNum: 53 },
  { month: "Feb 2026", pnl: "+$2,340", pnlNum: 2340, trades: 64, tradesNum: 64, winRate: "73%", winRateNum: 73 },
  { month: "Mar 2026", pnl: "+$1,651", pnlNum: 1651, trades: 48, tradesNum: 48, winRate: "69%", winRateNum: 69 },
];

const PAIR_PERF = [
  { pair: "BTC/USDT", totalPnl: "+$3,890", totalPnlNum: 3890, trades: 186, winRate: "71.5%", winRateNum: 71.5, sharpe: "2.31", sharpeNum: 2.31, avgProfit: "+1.82%", avgProfitNum: 1.82, best: true },
  { pair: "ETH/USDT", totalPnl: "+$1,610", totalPnlNum: 1610, trades: 128, winRate: "68.2%", winRateNum: 68.2, sharpe: "1.89", sharpeNum: 1.89, avgProfit: "+1.12%", avgProfitNum: 1.12 },
  { pair: "SOL/USDT", totalPnl: "-$340", totalPnlNum: -340, trades: 89, winRate: "54.3%", winRateNum: 54.3, sharpe: "0.72", sharpeNum: 0.72, avgProfit: "-0.38%", avgProfitNum: -0.38, worst: true },
  { pair: "DOGE/USDT", totalPnl: "+$620", totalPnlNum: 620, trades: 52, winRate: "63.5%", winRateNum: 63.5, sharpe: "1.41", sharpeNum: 1.41, avgProfit: "+1.19%", avgProfitNum: 1.19 },
  { pair: "LINK/USDT", totalPnl: "+$491", totalPnlNum: 491, trades: 37, winRate: "67.5%", winRateNum: 67.5, sharpe: "1.55", sharpeNum: 1.55, avgProfit: "+1.33%", avgProfitNum: 1.33 },
];

const STRATEGY_PERF = [
  { strategy: "TrendFollowerV3", totalPnl: "+$3,120", totalPnlNum: 3120, trades: 142, winRate: "72.1%", winRateNum: 72.1, sharpe: "2.18", sharpeNum: 2.18, maxDd: "3.2%", maxDdNum: 3.2, bot: "bot-trend-01" },
  { strategy: "MeanReversionV2", totalPnl: "+$1,890", totalPnlNum: 1890, trades: 98, winRate: "69.4%", winRateNum: 69.4, sharpe: "1.95", sharpeNum: 1.95, maxDd: "2.8%", maxDdNum: 2.8, bot: "bot-mean-rev" },
  { strategy: "HLScalperV1", totalPnl: "-$280", totalPnlNum: -280, trades: 210, winRate: "55.2%", winRateNum: 55.2, sharpe: "0.65", sharpeNum: 0.65, maxDd: "5.1%", maxDdNum: 5.1, bot: "bot-scalp-hl" },
  { strategy: "BreakoutAI", totalPnl: "+$940", totalPnlNum: 940, trades: 64, winRate: "67.2%", winRateNum: 67.2, sharpe: "1.72", sharpeNum: 1.72, maxDd: "1.9%", maxDdNum: 1.9, bot: "bot-breakout-p" },
  { strategy: "FreqAI_LightGBM", totalPnl: "+$601", totalPnlNum: 601, trades: 38, winRate: "63.2%", winRateNum: 63.2, sharpe: "1.48", sharpeNum: 1.48, maxDd: "2.1%", maxDdNum: 2.1, bot: "bot-freqai-exp" },
];

type Period = "7d" | "30d" | "90d" | "all";
type MonthlySort = { col: "month" | "pnl" | "trades" | "winRate"; dir: "asc" | "desc" };
type PairSort = { col: "pair" | "totalPnl" | "trades" | "winRate" | "sharpe" | "avgProfit"; dir: "asc" | "desc" };
type StrategySort = { col: "strategy" | "totalPnl" | "trades" | "winRate" | "sharpe" | "maxDd"; dir: "asc" | "desc" };

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "monthly" | "pairs" | "strategies">("overview");
  const [period, setPeriod] = useState<Period>("all");
  const [dateFrom, setDateFrom] = useState("2025-10-01");
  const [dateTo, setDateTo] = useState("2026-03-29");
  const [monthlySort, setMonthlySort] = useState<MonthlySort>({ col: "month", dir: "asc" });
  const [pairSort, setPairSort] = useState<PairSort>({ col: "totalPnl", dir: "desc" });
  const [strategySort, setStrategySort] = useState<StrategySort>({ col: "totalPnl", dir: "desc" });

  // Period filtering for monthly data
  const filteredMonthly = useMemo(() => {
    if (period === "all") return MONTHLY;
    const now = new Date(2026, 2, 29); // Mar 29, 2026
    const cutoff = new Date(now);
    if (period === "7d") cutoff.setDate(cutoff.getDate() - 7);
    else if (period === "30d") cutoff.setDate(cutoff.getDate() - 30);
    else if (period === "90d") cutoff.setDate(cutoff.getDate() - 90);
    // Simple filter: show months that fall within the period
    const monthMap: Record<string, Date> = {
      "Oct 2025": new Date(2025, 9, 1),
      "Nov 2025": new Date(2025, 10, 1),
      "Dec 2025": new Date(2025, 11, 1),
      "Jan 2026": new Date(2026, 0, 1),
      "Feb 2026": new Date(2026, 1, 1),
      "Mar 2026": new Date(2026, 2, 1),
    };
    return MONTHLY.filter((m) => {
      const d = monthMap[m.month];
      return d && d >= cutoff;
    });
  }, [period]);

  // Sorted monthly
  const sortedMonthly = useMemo(() => {
    const data = [...filteredMonthly];
    const { col, dir } = monthlySort;
    data.sort((a, b) => {
      let cmp = 0;
      if (col === "month") cmp = a.month.localeCompare(b.month);
      else if (col === "pnl") cmp = a.pnlNum - b.pnlNum;
      else if (col === "trades") cmp = a.tradesNum - b.tradesNum;
      else if (col === "winRate") cmp = a.winRateNum - b.winRateNum;
      return dir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [filteredMonthly, monthlySort]);

  // Sorted pairs
  const sortedPairs = useMemo(() => {
    const data = [...PAIR_PERF];
    const { col, dir } = pairSort;
    data.sort((a, b) => {
      let cmp = 0;
      if (col === "pair") cmp = a.pair.localeCompare(b.pair);
      else if (col === "totalPnl") cmp = a.totalPnlNum - b.totalPnlNum;
      else if (col === "trades") cmp = a.trades - b.trades;
      else if (col === "winRate") cmp = a.winRateNum - b.winRateNum;
      else if (col === "sharpe") cmp = a.sharpeNum - b.sharpeNum;
      else if (col === "avgProfit") cmp = a.avgProfitNum - b.avgProfitNum;
      return dir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [pairSort]);

  // Sorted strategies
  const sortedStrategies = useMemo(() => {
    const data = [...STRATEGY_PERF];
    const { col, dir } = strategySort;
    data.sort((a, b) => {
      let cmp = 0;
      if (col === "strategy") cmp = a.strategy.localeCompare(b.strategy);
      else if (col === "totalPnl") cmp = a.totalPnlNum - b.totalPnlNum;
      else if (col === "trades") cmp = a.trades - b.trades;
      else if (col === "winRate") cmp = a.winRateNum - b.winRateNum;
      else if (col === "sharpe") cmp = a.sharpeNum - b.sharpeNum;
      else if (col === "maxDd") cmp = a.maxDdNum - b.maxDdNum;
      return dir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [strategySort]);

  function toggleMonthlySort(col: MonthlySort["col"]) {
    setMonthlySort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  function togglePairSort(col: PairSort["col"]) {
    setPairSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  function toggleStrategySort(col: StrategySort["col"]) {
    setStrategySort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  function sortIndicator(active: boolean, dir: "asc" | "desc") {
    if (!active) return " ↕";
    return dir === "asc" ? " ↑" : " ↓";
  }

  const tabs = [
    { key: "overview" as const, label: "📊 Overview" },
    { key: "monthly" as const, label: "📅 Monthly" },
    { key: "pairs" as const, label: "💱 By Pair" },
    { key: "strategies" as const, label: "🎯 By Strategy" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Analytics</h2>
          <p className="text-xs text-muted-foreground mt-1">Performance analysis across all bots and strategies</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-2xs px-2 py-1 rounded border border-border bg-accent/20 text-foreground"
          />
          <span className="text-2xs text-muted-foreground">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-2xs px-2 py-1 rounded border border-border bg-accent/20 text-foreground"
          />
          <button
            onClick={() => console.info(`Exporting CSV...\nDate range: ${dateFrom} → ${dateTo}\nPeriod: ${period}\nTab: ${activeTab}`)}
            className="text-2xs font-semibold text-primary px-3 py-1 rounded border border-primary/20 hover:bg-primary/10 transition-colors"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-4">
        {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-accent/20 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            {p === "all" ? "All Time" : p}
          </button>
        ))}
      </div>

      {/* Performance cards */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {PERF_CARDS.map(c => (
          <Card key={c.label} className="hover:-translate-y-0.5 transition-all">
            <CardContent className="p-4">
              <div className="text-2xs text-muted-foreground uppercase tracking-wider mb-1">{c.label}</div>
              <div className={`text-lg font-extrabold font-mono-data ${c.up ? "text-ft-green" : "text-ft-red"}`}>{c.value}</div>
              <div className="text-2xs text-muted-foreground mt-0.5">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="mb-4 bg-accent/20 p-1 rounded-lg inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`text-xs px-4 py-2 rounded-md transition-colors font-semibold ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 gap-4">
          {/* Equity Chart placeholder */}
          <Card>
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-sm font-bold">📈 Equity Curve</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="h-[250px]">
                <svg viewBox="0 0 500 250" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="eqAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(210, 71%, 52%)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="hsl(210, 71%, 52%)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,220 L50,210 L100,195 L150,200 L200,180 L250,165 L300,145 L350,120 L400,90 L450,70 L500,50" fill="url(#eqAnalytics)" />
                  <path d="M0,220 L50,210 L100,195 L150,200 L200,180 L250,165 L300,145 L350,120 L400,90 L450,70 L500,50" fill="none" stroke="hsl(210,71%,52%)" strokeWidth="2.5" />
                </svg>
              </div>
            </CardContent>
          </Card>

          {/* Drawdown chart placeholder */}
          <Card>
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-sm font-bold">📉 Drawdown</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="h-[250px]">
                <svg viewBox="0 0 500 250" preserveAspectRatio="none" className="w-full h-full">
                  <path d="M0,10 L50,20 L100,35 L150,25 L200,45 L250,60 L300,40 L350,55 L400,30 L450,20 L500,15" fill="none" stroke="hsl(0,67%,60%)" strokeWidth="2" />
                  <path d="M0,10 L50,20 L100,35 L150,25 L200,45 L250,60 L300,40 L350,55 L400,30 L450,20 L500,15" fill="hsla(0,67%,60%,0.1)" />
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "monthly" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="bg-accent/20 hover:bg-accent/20">
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleMonthlySort("month")}>
                  Month{sortIndicator(monthlySort.col === "month", monthlySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleMonthlySort("pnl")}>
                  P&L{sortIndicator(monthlySort.col === "pnl", monthlySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleMonthlySort("trades")}>
                  Trades{sortIndicator(monthlySort.col === "trades", monthlySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleMonthlySort("winRate")}>
                  Win Rate{sortIndicator(monthlySort.col === "winRate", monthlySort.dir)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMonthly.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-muted-foreground text-center py-4">No data for selected period</TableCell>
                </TableRow>
              )}
              {sortedMonthly.map(m => (
                <TableRow key={m.month}>
                  <TableCell className="text-xs font-bold text-foreground">{m.month}</TableCell>
                  <TableCell className={`text-sm font-bold font-mono-data ${m.pnl.startsWith("+") ? "text-ft-green" : "text-ft-red"}`}>{m.pnl}</TableCell>
                  <TableCell className="text-xs font-mono-data">{m.trades}</TableCell>
                  <TableCell className="text-xs font-mono-data">{m.winRate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeTab === "pairs" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="bg-accent/20 hover:bg-accent/20">
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => togglePairSort("pair")}>
                  Pair{sortIndicator(pairSort.col === "pair", pairSort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => togglePairSort("totalPnl")}>
                  Total P&L{sortIndicator(pairSort.col === "totalPnl", pairSort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => togglePairSort("trades")}>
                  Trades{sortIndicator(pairSort.col === "trades", pairSort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => togglePairSort("winRate")}>
                  Win Rate{sortIndicator(pairSort.col === "winRate", pairSort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => togglePairSort("sharpe")}>
                  Sharpe{sortIndicator(pairSort.col === "sharpe", pairSort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => togglePairSort("avgProfit")}>
                  Avg Profit{sortIndicator(pairSort.col === "avgProfit", pairSort.dir)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPairs.map(p => (
                <TableRow key={p.pair}>
                  <TableCell className="text-xs font-bold text-foreground flex items-center gap-2">
                    {p.pair}
                    {p.best && <Badge className="bg-ft-green/15 text-ft-green text-2xs">Best</Badge>}
                    {p.worst && <Badge className="bg-ft-red/15 text-ft-red text-2xs">Worst</Badge>}
                  </TableCell>
                  <TableCell className={`text-sm font-bold font-mono-data ${p.totalPnl.startsWith("+") ? "text-ft-green" : "text-ft-red"}`}>{p.totalPnl}</TableCell>
                  <TableCell className="text-xs font-mono-data">{p.trades}</TableCell>
                  <TableCell className="text-xs font-mono-data">{p.winRate}</TableCell>
                  <TableCell className="text-xs font-mono-data">{p.sharpe}</TableCell>
                  <TableCell className={`text-xs font-mono-data ${p.avgProfit.startsWith("+") ? "text-ft-green" : "text-ft-red"}`}>{p.avgProfit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {activeTab === "strategies" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="bg-accent/20 hover:bg-accent/20">
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleStrategySort("strategy")}>
                  Strategy{sortIndicator(strategySort.col === "strategy", strategySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleStrategySort("totalPnl")}>
                  Total P&L{sortIndicator(strategySort.col === "totalPnl", strategySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleStrategySort("trades")}>
                  Trades{sortIndicator(strategySort.col === "trades", strategySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleStrategySort("winRate")}>
                  Win Rate{sortIndicator(strategySort.col === "winRate", strategySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleStrategySort("sharpe")}>
                  Sharpe{sortIndicator(strategySort.col === "sharpe", strategySort.dir)}
                </TableHead>
                <TableHead className="text-2xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleStrategySort("maxDd")}>
                  Max DD{sortIndicator(strategySort.col === "maxDd", strategySort.dir)}
                </TableHead>
                <TableHead className="text-2xs">Bot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStrategies.map(s => (
                <TableRow key={s.strategy}>
                  <TableCell className="text-xs font-bold text-foreground">{s.strategy}</TableCell>
                  <TableCell className={`text-sm font-bold font-mono-data ${s.totalPnl.startsWith("+") ? "text-ft-green" : "text-ft-red"}`}>{s.totalPnl}</TableCell>
                  <TableCell className="text-xs font-mono-data">{s.trades}</TableCell>
                  <TableCell className="text-xs font-mono-data">{s.winRate}</TableCell>
                  <TableCell className="text-xs font-mono-data">{s.sharpe}</TableCell>
                  <TableCell className="text-xs font-mono-data text-ft-red">{s.maxDd}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.bot}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
