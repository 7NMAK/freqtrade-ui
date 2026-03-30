"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/useApi";
import { getBots } from "@/lib/api";

/* ══════════════════════════════════════════════════════════════════
   PROTOTYPE V3: MAXIMUM SIMPLICITY & UNIFORMITY (Atomic Design)
   
   Cilj: Pokazati kako izgleda kod kada se napravi jedna centralna 
   biblioteka komponenti ("Design System"), pa ceo dashboard postane
   samo uredno slaganje "LEGO kockica", bez ikakvog nabudženog css-a.
   ══════════════════════════════════════════════════════════════════ */

/* ==================================================================
   🏗️ 1. DESIGN SYSTEM KOMPONENTE (Koje idu u src/components/ui/)
   Ove komponente su striktno povezane na "tailwind.config.ts" i NIGDE
   u aplikaciji se ne koriste druge boje ili okviri.
   ================================================================== */

// 1.1 Najprostija Kartica (Kadrovi)
function BaseCard({ title, children, rightAction }: { title: string; children: React.ReactNode; rightAction?: React.ReactNode }) {
  return (
    <div className="bg-bg-1 border border-border rounded-card flex flex-col overflow-hidden mb-4 transition-all">
      <div className="px-5 py-3 border-b border-border bg-bg-2 flex justify-between items-center">
        <h3 className="text-[13px] font-bold text-text-0 tracking-tight">{title}</h3>
        {rightAction}
      </div>
      <div className="p-5 overflow-auto">
        {children}
      </div>
    </div>
  );
}

// 1.2 "Hero" Stat Blok (Brojevi)
function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-bg-1 border border-border rounded-card p-5 flex flex-col justify-center">
      <div className="text-[11px] text-text-2 uppercase tracking-wide font-medium mb-1">{label}</div>
      <div className="text-[20px] font-mono font-bold text-text-0">{value}</div>
      {sub && <div className="text-[12px] text-text-3 font-medium mt-1">{sub}</div>}
    </div>
  );
}

// 1.3 Uniformna Tabela (Headeri, Fontovi u piksel)
function DataTable({ columns, children }: { columns: string[], children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-bg-1">
            {columns.map(col => (
              <th key={col} className="py-2.5 px-3 text-[11px] font-medium text-text-2 uppercase tracking-wider border-b border-border">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {children}
        </tbody>
      </table>
    </div>
  );
}

// 1.4 Statusni Znakovi (Centralizovane logike boja)
function StatusBadge({ type, children }: { type: 'success' | 'danger' | 'warning' | 'neutral', children: React.ReactNode }) {
  const styles = {
    success: "bg-green-bg text-green border-green/20",
    danger: "bg-red-bg text-red border-red/20",
    warning: "bg-amber-bg text-amber border-amber/20",
    neutral: "bg-bg-2 text-text-1 border-border"
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[type]}`}>
      {children}
    </span>
  );
}

// 1.5 Dugme (Univerzalno)
function ActionButton({ label, type = "primary", onClick }: { label: string; type?: "primary" | "danger" | "outline", onClick?: () => void }) {
  const styles = {
    primary: "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20",
    danger: "bg-red-bg border-red/30 text-red hover:bg-red/20 outline outline-1 outline-red/10",
    outline: "bg-bg-2 border-border text-text-1 hover:border-hover hover:text-text-0"
  };
  return (
    <button onClick={onClick} className={`px-4 py-2 text-[12px] font-bold rounded-btn border transition-all ${styles[type]}`}>
      {label}
    </button>
  );
}


/* ==================================================================
   🖥️ 2. PREVIEW STRANICA (Samo slažemo "LEGO" komponente)
   Notice: Apsolutno nema kucanja custom paddinga (p-4), boja
   pozadine (bg-red-500), ili border-radius (rounded-lg) u Dashboard layeru.
   Ovo je čistota koda i uniformnost koju tražimo.
   ================================================================== */
export default function UltimateSimpleDashboardPreview() {
  const { data: botsList } = useApi(getBots, [], { refreshInterval: 15000 });
  
  // Dummy data (Same as before)
  const activeCount = 5;
  const mockTrades = [
    { p: "SOL/USDT", b: "TrendFollower", s: "LONG", v: "148.20", r: "+1.2%" },
    { p: "BTC/USDT", b: "MeanRev", s: "SHORT", v: "67100", r: "-0.5%" },
    { p: "ETH/USDT", b: "TrendFollower", s: "LONG", v: "3650", r: "+4.2%" },
  ];

  return (
    <div className="min-h-screen bg-bg-0 text-text-0 p-6 font-sans">
      
      {/* ── Page Header ── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-text-0">System Overview</h1>
          <p className="text-[13px] text-text-2">Clean, uniform architecture representation.</p>
        </div>
        <div className="flex gap-3">
          <ActionButton type="outline" label="New Strategy" />
          <ActionButton type="danger" label="🚨 KILL SWITCH" />
        </div>
      </div>

      {/* ── KPI Row (Paints the StatBlocks) ── */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatBlock label="Equity" value="$145,280.91" sub="Total Balance" />
        <StatBlock label="Unrealized" value="+$1,450.40" sub="7 Open Positions" />
        <StatBlock label="Realized (30d)" value="+$4,020.10" sub="77.5% Win Rate" />
        <StatBlock label="Peak Drawdown" value="-8.4%" sub="System Max" />
        <StatBlock label="Active Bots" value={`${activeCount} Running`} sub="All operational" />
      </div>

      {/* ── Dve kolone (Levo Trades, Desno Crtanje/Logovi) ── */}
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        
        {/* LEVA STRANA */}
        <div className="flex flex-col gap-4">
          <BaseCard 
            title="Open Positions (3)" 
            rightAction={<button className="text-[11px] text-accent font-semibold">View Detail →</button>}
          >
            <DataTable columns={["Pair", "Bot", "Side", "Current Rate", "P&L"]}>
              {mockTrades.map((t, i) => (
                <tr key={i} className="hover:bg-bg-2 transition-colors cursor-pointer group">
                  <td className="py-3 px-3">
                    <div className="text-[13px] font-bold text-text-0">{t.p}</div>
                  </td>
                  <td className="py-3 px-3 text-[12px] text-text-1">{t.b}</td>
                  <td className="py-3 px-3">
                    <StatusBadge type={t.s === "LONG" ? "success" : "danger"}>{t.s}</StatusBadge>
                  </td>
                  <td className="py-3 px-3 font-mono text-[13px] text-text-0">${t.v}</td>
                  <td className="py-3 px-3 font-mono text-[13px] font-bold text-text-0">{t.r}</td>
                </tr>
              ))}
            </DataTable>
          </BaseCard>

          <BaseCard title="Active Enclaves">
             <DataTable columns={["Bot Name", "Pair", "Status", "P&L"]}>
                {["TrendFollowerV3", "ScalperX", "MeanReversion"].map((b, i) => (
                  <tr key={i} className="hover:bg-bg-2 cursor-pointer">
                    <td className="py-3 px-3 font-bold text-[13px]">{b}</td>
                    <td className="py-3 px-3 text-[12px] text-text-2 text-text-1">Dynamic</td>
                    <td className="py-3 px-3"><StatusBadge type="success">LIVE</StatusBadge></td>
                    <td className="py-3 px-3 font-mono text-[13px] text-text-0">+$0.00</td>
                  </tr>
                ))}
            </DataTable>
          </BaseCard>
        </div>

        {/* DESNA STRANA */}
        <div className="flex flex-col gap-4">
          <BaseCard title="System Logs & Health" rightAction={<StatusBadge type="success">Connected</StatusBadge>}>
            <div className="space-y-4">
              {[
                { time: "14:22", msg: "Bot 'ScalperX' entered LONG." },
                { time: "14:15", msg: "Position ETH exited." },
                { time: "13:05", msg: "Heartbeat OK." }
              ].map((log, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <span className="text-[11px] font-mono text-text-3 w-10">{log.time}</span>
                  <span className="text-[13px] text-text-1">{log.msg}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <ActionButton type="outline" label="📄 Download System Data" />
            </div>
          </BaseCard>

          <BaseCard title="Quick Metrics">
             <div className="h-[120px] flex items-center justify-center text-[12px] text-text-3 bg-bg-2 border border-border rounded-btn border-dashed">
                [ Chart Render Area ]
             </div>
          </BaseCard>
        </div>

      </div>

    </div>
  );
}
