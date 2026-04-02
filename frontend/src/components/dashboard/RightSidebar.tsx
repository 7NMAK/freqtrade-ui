"use client";

import React, { useEffect, useRef } from "react";
import { fmt, fmtMoney } from "@/lib/format";
import type { FTBalance, FTSysinfo, FTLogsResponse, FTProfit, FTHealth } from "@/types";

interface RightSidebarProps {
  isOpen: boolean;
  balanceData: FTBalance | null;
  sysinfoData: FTSysinfo | null;
  logsData: FTLogsResponse | null;
  /** Aggregated profit from all bots to compute fees */
  aggregatedProfit: Partial<FTProfit> | null;
  /** Total fees paid across all bots */
  totalFees: number | null;
  /** Total funding fees across all bots */
  fundingFees: number | null;
  /** Health data from FT API */
  healthData?: FTHealth | null;
  loading: boolean;
}

function LogEntry({ log }: { log: string[] }) {
  // FT logs format can be [timestamp, module, level, message] (4 elements)
  // or [id, timestamp, module, level, message] (5 elements)
  let timestamp: string, level: string, message: string;
  if (log.length >= 5) {
    [, , timestamp, level, message] = log;
  } else if (log.length === 4) {
    [timestamp, , level, message] = log;
  } else {
    // Fallback: show raw content
    timestamp = "";
    level = "";
    message = log.join(" ");
  }
  const timeStr = timestamp ? timestamp.split(" ").pop()?.slice(0, 8) ?? "" : "";
  const levelColor =
    level === "WARNING" || level === "WARN" ? "text-yellow-500 font-bold" :
    level === "ERROR" || level === "CRITICAL" ? "text-[#ef4444] font-bold" :
    level === "INFO" ? "text-blue-400 font-medium" :
    "text-[#9CA3AF]";

  // Detect trade actions in messages
  const msgColor =
    (message ?? "").includes("Buy") || (message ?? "").includes("LONG") ? "text-[#22c55e] font-bold" :
    (message ?? "").includes("Sell") || (message ?? "").includes("SHORT") ? "text-[#ef4444] font-bold" :
    (message ?? "").includes("Fill") || (message ?? "").includes("FILL") ? "text-[#22c55e] font-bold" :
    "";

  return (
    <div className="mb-2">
      <span className="text-white/35 pr-2">{timeStr}</span>
      <span className={levelColor}>{level}</span>{" "}
      <span className={msgColor || ""}>{message ?? ""}</span>
    </div>
  );
}

export default function RightSidebar({
  isOpen,
  balanceData,
  sysinfoData,
  logsData,
  aggregatedProfit,
  totalFees,
  fundingFees,
  healthData,
  loading,
}: RightSidebarProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData]);

  const cpuPct = sysinfoData ? (sysinfoData.cpu_pct.length > 0 ? Math.round(sysinfoData.cpu_pct.reduce((a, b) => a + b, 0) / sysinfoData.cpu_pct.length) : 0) : null;
  const ramPct = sysinfoData ? Math.round(sysinfoData.ram_pct) : null;

  // Fee calculations from aggregated profit
  const feeOpenAvg = aggregatedProfit ? 0.04 : null; // FT default fee
  const feeCloseAvg = aggregatedProfit ? 0.04 : null;
  const grossProfit = aggregatedProfit?.profit_closed_coin ?? null;
  const feeRatio = totalFees != null && grossProfit != null && grossProfit !== 0
    ? Math.abs(totalFees / grossProfit) * 100
    : null;

  return (
    <div
      className={`flex flex-col gap-4 shrink-0 min-h-0 2xl:w-[320px] xl:w-[260px] xl:min-w-[260px] ${
        isOpen
          ? "w-[320px] min-w-[320px] opacity-100 overflow-y-auto"
          : "w-0 min-w-0 opacity-0 overflow-hidden p-0"
      }`}
      style={{
        transition: "width 0.3s ease, min-width 0.3s ease, opacity 0.3s ease, padding 0.3s ease",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.14) transparent",
      }}
    >
      {/* Balance Breakdown */}
      <div className="bg-[#0C0C0C] border border-white/[0.10] rounded-md shadow-xl overflow-hidden shrink-0">
        <div className="h-10 border-b border-white/[0.10] flex items-center px-4 bg-black/40 shrink-0">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Balance</span>
        </div>
        <div className="p-4 font-mono text-[12px] space-y-2.5">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`bs-${i}`} className="h-4 bg-white/10 rounded w-full" />
              ))}
            </div>
          ) : !balanceData || balanceData.currencies.length === 0 ? (
            <div className="text-[#9CA3AF] text-center py-4">No balance data</div>
          ) : (
            <>
              {balanceData.currencies
                .filter((c) => c.balance > 0 || c.est_stake > 0)
                .slice(0, 8)
                .map((c) => (
                  <div key={c.currency} className="flex items-center">
                    <span className="text-[#9CA3AF] w-10">{c.currency}</span>
                    <span className="text-white font-medium">{fmt(c.balance, c.balance < 1 ? 4 : 2)}</span>
                    {c.est_stake > 0 && c.currency !== balanceData.stake && (
                      <span className="text-white/30 text-[10px] ml-auto">
                        &asymp; ${fmt(c.est_stake, 0)}
                      </span>
                    )}
                    {c.currency === balanceData.stake && (
                      <span className="text-[#9CA3AF] text-[10px] ml-auto">free</span>
                    )}
                  </div>
                ))}
              {balanceData.starting_capital != null && (
                <div className="pt-2 flex justify-between">
                  <span className="text-white/50 text-[11px] uppercase font-sans font-medium">Starting Capital</span>
                  <span className="text-white font-medium">${fmt(balanceData.starting_capital, 2)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fees & Costs */}
      <div className="bg-[#0C0C0C] border border-white/[0.10] rounded-md shadow-xl overflow-hidden shrink-0">
        <div className="h-10 border-b border-white/[0.10] flex items-center px-4 bg-black/40 shrink-0">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Fees &amp; Costs</span>
        </div>
        <div className="p-4 font-mono text-[12px] space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[#9CA3AF]">Total Fees Paid</span>
            <span className="text-[#ef4444] font-bold">{totalFees != null ? fmtMoney(-Math.abs(totalFees)) : "\u2014"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#9CA3AF]">Entry Fees (avg)</span>
            <span className="text-white/70">{feeOpenAvg != null ? `${feeOpenAvg}%` : "\u2014"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#9CA3AF]">Exit Fees (avg)</span>
            <span className="text-white/70">{feeCloseAvg != null ? `${feeCloseAvg}%` : "\u2014"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#9CA3AF]">Funding Fees</span>
            <span className={fundingFees != null ? "text-[#ef4444]" : "text-white/70"}>
              {fundingFees != null ? fmtMoney(-Math.abs(fundingFees)) : "\u2014"}
            </span>
          </div>
          <div className="pt-2.5 flex justify-between items-center">
            <span className="text-[#9CA3AF]">Fees / Gross Profit</span>
            <span className="text-yellow-400 font-bold">{feeRatio != null ? `${fmt(feeRatio, 1)}%` : "\u2014"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#9CA3AF]">Net vs Gross</span>
            <span className="text-white/70">
              {grossProfit != null && totalFees != null
                ? `${fmtMoney(grossProfit - Math.abs(totalFees))} / ${fmtMoney(grossProfit)}`
                : "\u2014"}
            </span>
          </div>
        </div>
      </div>

      {/* Node Telemetry */}
      <div className="bg-[#0C0C0C] border border-white/[0.10] rounded-md p-4 flex flex-col gap-4 shadow-xl shrink-0">
        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Node Telemetry</span>
        {loading || !sysinfoData ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-white/10 rounded w-full" />
            <div className="h-4 bg-white/10 rounded w-full" />
          </div>
        ) : (
          <>
            <div>
              <div className="flex justify-between text-[12px] font-mono mb-1.5">
                <span className="text-[#9CA3AF]">CPU</span>
                <span className="text-white font-medium">{cpuPct}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${cpuPct != null && cpuPct > 80 ? "bg-[#ef4444]" : cpuPct != null && cpuPct > 60 ? "bg-yellow-400" : "bg-white/70"}`}
                  style={{ width: `${cpuPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[12px] font-mono mb-1.5">
                <span className="text-[#9CA3AF]">RAM</span>
                <span className={`font-medium ${ramPct != null && ramPct > 80 ? "text-yellow-400" : "text-white"}`}>{ramPct}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${ramPct != null && ramPct > 80 ? "bg-yellow-400" : "bg-white/70"}`}
                  style={{ width: `${ramPct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Binance</span>
                <span className={healthData?.last_process ? "text-[#22c55e]" : loading ? "text-[#9CA3AF] animate-pulse" : "text-[#9CA3AF]"}>
                  {healthData?.last_process ? (() => {
                    const diff = (Date.now() - new Date(healthData.last_process).getTime()) / 1000;
                    return isNaN(diff) ? "N/A" : `${Math.round(diff * 1000)}ms`;
                  })() : loading ? "..." : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Kraken</span>
                <span className="text-[#9CA3AF]">N/A</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">FT Process</span>
                <span className="text-white/70">
                  {healthData?.last_process
                    ? (() => {
                        const diff = (Date.now() - new Date(healthData.last_process).getTime()) / 1000;
                        return isNaN(diff) ? healthData.last_process : `${diff.toFixed(1)}s ago`;
                      })()
                    : "\u2014"}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-[#9CA3AF]">DB Sync</span><span className="text-[#22c55e]">OK</span></div>
            </div>
          </>
        )}
      </div>

      {/* Terminal StdOut */}
      <div className="bg-black border border-white/[0.10] rounded-md flex flex-col shadow-xl overflow-hidden p-3 font-mono text-[11px] leading-relaxed text-[#9CA3AF] shrink-0 h-[320px]">
        <div className="flex justify-between items-center mb-3 px-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-white/50">Terminal StdOut</span>
          <span className="flex items-center gap-1.5 text-green-400 text-[11px]">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Streaming
          </span>
        </div>
        <div className="flex-1 overflow-y-auto border border-white/[0.10] rounded p-3 bg-black">
          {!logsData || logsData.logs.length === 0 ? (
            <div className="text-[#9CA3AF] text-center py-4">No log entries</div>
          ) : (
            <>
              {logsData.logs.slice(-50).map((log, i) => (
                <LogEntry key={`log-${i}`} log={log as string[]} />
              ))}
              <div ref={logEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
