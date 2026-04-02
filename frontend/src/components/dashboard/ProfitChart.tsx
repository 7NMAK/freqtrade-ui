"use client";

import React, { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { fmt, fmtMoney } from "@/lib/format";
import type { FTDailyItem, FTWeeklyResponse, FTMonthlyResponse } from "@/types";

type TimePeriod = "days" | "weeks" | "months";
type ValueMode = "abs" | "rel";

interface ProfitChartProps {
  dailyData: FTDailyItem[];
  weeklyData: FTWeeklyResponse | null;
  monthlyData: FTMonthlyResponse | null;
  maxDrawdownAbs: number | null;
  maxDrawdownRel: number | null;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  loading: boolean;
}

export default function ProfitChart({
  dailyData,
  weeklyData,
  monthlyData,
  maxDrawdownAbs,
  maxDrawdownRel,
  onToggleSidebar,
  sidebarOpen,
  loading,
}: ProfitChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("days");
  const [valueMode, setValueMode] = useState<ValueMode>("abs");

  const chartData = useMemo(() => {
    let rawData: Array<{ date: string; abs_profit: number; rel_profit?: number; trade_count: number }> = [];

    if (timePeriod === "days") {
      rawData = dailyData.map((d) => ({
        date: d.date,
        abs_profit: d.abs_profit,
        rel_profit: d.rel_profit,
        trade_count: d.trade_count,
      }));
    } else if (timePeriod === "weeks" && weeklyData) {
      rawData = weeklyData.data.map((w) => ({
        date: w.date,
        abs_profit: w.abs_profit,
        rel_profit: w.rel_profit,
        trade_count: w.trade_count,
      }));
    } else if (timePeriod === "months" && monthlyData) {
      rawData = monthlyData.data.map((m) => ({
        date: m.date,
        abs_profit: m.abs_profit,
        rel_profit: m.rel_profit,
        trade_count: m.trade_count,
      }));
    }

    // Build cumulative P&L
    let cum = 0;
    return rawData.map((d) => {
      const profitVal = valueMode === "abs" ? d.abs_profit : (d.rel_profit ?? d.abs_profit);
      cum += profitVal;
      return {
        date: d.date.slice(5), // "MM-DD" or "MM"
        profit: cum,
        dailyProfit: profitVal,
        tradeCount: d.trade_count,
      };
    });
  }, [dailyData, weeklyData, monthlyData, timePeriod, valueMode]);

  // Distribution histogram from daily P&L data
  const distribution = useMemo(() => {
    if (dailyData.length === 0) return [];
    const profits = dailyData.map((d) => d.abs_profit);
    const min = Math.min(...profits);
    const max = Math.max(...profits);
    const range = max - min || 1;
    const bins = 11;
    const binSize = range / bins;
    const counts = new Array(bins).fill(0) as number[];
    for (const p of profits) {
      const idx = Math.min(Math.floor((p - min) / binSize), bins - 1);
      counts[idx]++;
    }
    const maxCount = Math.max(...counts, 1);
    const midBin = Math.floor(bins / 2);
    return counts.map((c, i) => ({
      height: (c / maxCount) * 100,
      isNeg: i < midBin,
      isMid: i === midBin,
    }));
  }, [dailyData]);

  if (loading) {
    return (
      <div className="h-[280px] bg-[#0C0C0C] border border-white/[0.10] rounded-md flex shadow-xl shrink-0 overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-[#9CA3AF] text-sm animate-pulse">
          Loading chart data...
        </div>
      </div>
    );
  }

  return (
    <div className="h-[280px] bg-[#0C0C0C] border border-white/[0.10] rounded-md flex shadow-xl shrink-0 overflow-hidden relative">
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "24px 24px", opacity: 0.2 }} />
      {/* Left: Profit Over Time */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="flex items-center justify-between px-5 py-3 shrink-0 gap-3">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/50 whitespace-nowrap">Profit Over Time</h3>
          <div className="flex gap-0 shrink-0">
            {/* Time period toggle */}
            {(["days", "weeks", "months"] as const).map((p, i) => (
              <button
                key={p}
                onClick={() => setTimePeriod(p)}
                className={`px-3 py-1 text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                  timePeriod === p
                    ? "bg-white/10 text-white"
                    : "text-[#9CA3AF] hover:text-white border border-white/[0.10]"
                } ${i === 0 ? "rounded-l" : ""} ${i === 2 ? "rounded-r" : ""} ${i > 0 ? "border-l-0" : ""}`}
              >
                {p === "days" ? "Days" : p === "weeks" ? "Weeks" : "Months"}
              </button>
            ))}
            <div className="w-3" />
            {/* Abs/Rel toggle */}
            <button
              onClick={() => setValueMode("abs")}
              className={`px-3 py-1 text-[10px] font-bold uppercase rounded-l cursor-pointer transition-colors ${
                valueMode === "abs"
                  ? "bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/25"
                  : "text-[#9CA3AF] border border-white/[0.10] hover:text-white"
              }`}
            >
              Abs $
            </button>
            <button
              onClick={() => setValueMode("rel")}
              className={`px-3 py-1 text-[10px] font-bold uppercase rounded-r cursor-pointer transition-colors ${
                valueMode === "rel"
                  ? "bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/25 border-l-0"
                  : "text-[#9CA3AF] border border-white/[0.10] border-l-0 hover:text-white"
              }`}
            >
              Rel %
            </button>
            <div className="w-2" />
            {/* Sidebar toggle */}
            <button
              onClick={onToggleSidebar}
              className="px-2 py-1 rounded text-[#9CA3AF] hover:text-white hover:bg-white/[0.08] transition-all opacity-40 hover:opacity-100 cursor-pointer"
              title="Toggle right sidebar"
            >
              {sidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex-1 px-5 pb-4 relative min-w-0">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#9CA3AF] text-sm">
              No data available
            </div>
          ) : (
            <>
              <div className="absolute top-0 right-2 flex items-center gap-4 text-[9px] font-mono text-white/40 z-10">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-[2px] bg-[#22c55e] rounded inline-block" />Profit
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2.5 bg-white/15 rounded-sm inline-block" />Trade Count
                </span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="profit"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    valueMode === "abs"
                      ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}`
                      : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
                  }
                />
                <YAxis
                  yAxisId="trades"
                  orientation="right"
                  tick={false}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0C0C0C",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  formatter={(v, name) => {
                    const n = typeof v === "number" ? v : Number(v);
                    if (name === "tradeCount") return [n, "Trades"];
                    return [
                      valueMode === "abs" ? fmtMoney(n) : `${n >= 0 ? "+" : ""}${fmt(n, 2)}%`,
                      "Cum. P&L",
                    ];
                  }}
                />
                <ReferenceLine yAxisId="profit" y={0} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="3 3" />
                <Bar
                  yAxisId="trades"
                  dataKey="tradeCount"
                  fill="rgba(255,255,255,0.10)"
                  radius={[1, 1, 0, 0]}
                  barSize={6}
                />
                <Line
                  yAxisId="profit"
                  type="monotone"
                  dataKey="profit"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: "#22c55e", stroke: "none" }}
                  activeDot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            </>
          )}
        </div>
      </div>

      {/* Right: Profit Distribution */}
      <div className="w-[300px] flex flex-col relative bg-black/20 shrink-0 border-l border-white/[0.10]">
        <div className="px-5 py-3 shrink-0">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/50">Profit Distribution</h3>
        </div>
        <div className="flex-1 px-5 pb-4 flex items-end gap-[3px]">
          {distribution.length > 0 ? (
            distribution.map((bin, i) => {
              // Graduated opacity: larger bars = more opaque (20% to 80%)
              const opacityPct = Math.round(20 + (bin.height / 100) * 60);
              const bgColor = bin.isNeg
                ? `rgba(239,68,68,${opacityPct / 100})`
                : bin.isMid
                  ? "rgba(255,255,255,0.08)"
                  : `rgba(34,197,94,${opacityPct / 100})`;
              return (
                <div
                  key={`dist-${i}`}
                  className="flex-1 rounded-t"
                  style={{ height: `${Math.max(2, bin.height)}%`, backgroundColor: bgColor }}
                />
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#9CA3AF] text-xs">
              No distribution data
            </div>
          )}
        </div>
        {distribution.length > 0 && (
          <div className="flex justify-between text-[9px] font-mono text-white/25 px-5 pb-2">
            <span>{dailyData.length > 0 ? fmt(Math.min(...dailyData.map((d) => d.abs_profit)), 2) : "-0.02"}</span>
            <span>0</span>
            <span>+{dailyData.length > 0 ? fmt(Math.max(...dailyData.map((d) => d.abs_profit)), 2) : "0.01"}</span>
          </div>
        )}
        <div className="px-5 pb-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-[#6B7280] uppercase tracking-[0.08em] font-medium mb-1">Absolute DD</div>
            <div className="text-base font-bold font-mono text-[#ef4444]">
              {maxDrawdownAbs != null ? fmtMoney(-Math.abs(maxDrawdownAbs)) : "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6B7280] uppercase tracking-[0.08em] font-medium mb-1">Relative DD</div>
            <div className="text-base font-bold font-mono text-[#ef4444]">
              {maxDrawdownRel != null ? `${fmt(-Math.abs(maxDrawdownRel), 2)}%` : "\u2014"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
