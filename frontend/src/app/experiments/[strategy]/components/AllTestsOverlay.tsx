"use client";

import { useState, useMemo } from "react";

interface AllTestsOverlayProps {
  onClose: () => void;
  strategy: string;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
  onOpenOverlay?: (overlay: string) => void;
}

type TestType = "All Types" | "BT" | "HO" | "FAI";
type TestStatus = "All Status" | "Completed" | "Running" | "Failed";
type SortKey = "id" | "type" | "name" | "date" | "profit" | "sharpe" | "trades" | "status";
type SortDir = "asc" | "desc";

interface TestRow {
  id: number;
  type: "BT" | "HO" | "FAI";
  name: string;
  date: string;
  profit: number;
  sharpe: number;
  trades: number;
  status: "completed" | "running" | "failed";
  promote: boolean;
}

const MOCK_TESTS: TestRow[] = [
  { id: 1, type: "BT", name: "AlphaTrend_V5_base", date: "2026-03-28 14:22", profit: 42.12, sharpe: 3.92, trades: 142, status: "completed", promote: true },
  { id: 147, type: "HO", name: "Sharpe_TPE_200ep", date: "2026-03-27 09:15", profit: 52.4, sharpe: 4.12, trades: 156, status: "completed", promote: true },
  { id: 148, type: "FAI", name: "LightGBM-R_v2", date: "2026-03-26 18:40", profit: 38.7, sharpe: 3.45, trades: 128, status: "completed", promote: true },
  { id: 149, type: "BT", name: "AlphaTrend_V5_tight", date: "2026-03-25 11:05", profit: 22.8, sharpe: 2.81, trades: 98, status: "completed", promote: false },
  { id: 150, type: "HO", name: "Calmar_CMA_100ep", date: "2026-03-24 16:33", profit: -3.2, sharpe: -0.42, trades: 210, status: "completed", promote: false },
  { id: 151, type: "FAI", name: "XGBoost-C_exp1", date: "2026-03-23 08:12", profit: 15.6, sharpe: 1.92, trades: 74, status: "completed", promote: false },
  { id: 152, type: "BT", name: "AlphaTrend_V5_wide", date: "2026-03-22 20:48", profit: 8.3, sharpe: 1.14, trades: 186, status: "failed", promote: false },
  { id: 153, type: "HO", name: "SortinoHyperLoss_TPE", date: "2026-03-21 13:55", profit: 31.2, sharpe: 3.18, trades: 134, status: "completed", promote: false },
  { id: 154, type: "FAI", name: "LightGBM-R_v1", date: "2026-03-20 07:30", profit: 12.4, sharpe: 1.55, trades: 112, status: "completed", promote: false },
  { id: 155, type: "BT", name: "AlphaTrend_V4_legacy", date: "2026-03-19 22:10", profit: -7.8, sharpe: -1.02, trades: 64, status: "completed", promote: false },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AllTestsOverlay({ onClose, strategy, experimentId, onNavigateToTab, onOpenOverlay }: AllTestsOverlayProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<TestType>("All Types");
  const [filterStatus, setFilterStatus] = useState<TestStatus>("All Status");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";

  const filtered = useMemo(() => {
    let rows = [...MOCK_TESTS];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          String(r.id).includes(q)
      );
    }

    if (filterType !== "All Types") {
      rows = rows.filter((r) => r.type === filterType);
    }

    if (filterStatus !== "All Status") {
      const statusMap: Record<string, string> = {
        Completed: "completed",
        Running: "running",
        Failed: "failed",
      };
      rows = rows.filter((r) => r.status === statusMap[filterStatus]);
    }

    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "id": cmp = a.id - b.id; break;
        case "type": cmp = a.type.localeCompare(b.type); break;
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "profit": cmp = a.profit - b.profit; break;
        case "sharpe": cmp = a.sharpe - b.sharpe; break;
        case "trades": cmp = a.trades - b.trades; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [search, filterType, filterStatus, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 20));

  return (
    <div className="flex-1 flex flex-col">
      {/* Filter bar */}
      <div className="flex gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Search tests..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1a1a] l-bd px-3 py-2 text-white outline-none rounded text-[12px] font-mono w-[240px]"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TestType)}
          className="bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
        >
          <option>All Types</option>
          <option>BT</option>
          <option>HO</option>
          <option>FAI</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TestStatus)}
          className="bg-[#1a1a1a] l-bd px-3 py-2 text-white/80 appearance-none rounded text-[12px] font-mono"
        >
          <option>All Status</option>
          <option>Completed</option>
          <option>Running</option>
          <option>Failed</option>
        </select>
        <span className="flex-1" />
        <span className="text-[10px] text-white/30 font-mono">
          {filtered.length} total &middot; Page 1/{totalPages}
        </span>
      </div>

      {/* Table */}
      <div className="bg-surface l-bd rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse whitespace-nowrap text-[13px] font-mono">
          <thead>
            <tr className="bg-surface l-b text-[11px] uppercase tracking-widest text-muted">
              <th className="px-4 py-2.5 cursor-pointer select-none sortable" onClick={() => handleSort("id")}>
                #{sortIndicator("id")}
              </th>
              <th className="px-4 py-2.5 cursor-pointer select-none sortable filterable" onClick={() => handleSort("type")}>
                Type{sortIndicator("type")}
              </th>
              <th className="px-4 py-2.5 cursor-pointer select-none sortable" onClick={() => handleSort("name")}>
                Name{sortIndicator("name")}
              </th>
              <th className="px-4 py-2.5 cursor-pointer select-none sortable" onClick={() => handleSort("date")}>
                Date{sortIndicator("date")}
              </th>
              <th className="px-4 py-2.5 text-right cursor-pointer select-none sortable" onClick={() => handleSort("profit")}>
                Profit%{sortIndicator("profit")}
              </th>
              <th className="px-4 py-2.5 text-right cursor-pointer select-none sortable" onClick={() => handleSort("sharpe")}>
                Sharpe{sortIndicator("sharpe")}
              </th>
              <th className="px-4 py-2.5 text-right cursor-pointer select-none sortable" onClick={() => handleSort("trades")}>
                Trades{sortIndicator("trades")}
              </th>
              <th className="px-4 py-2.5 text-center cursor-pointer select-none sortable filterable" onClick={() => handleSort("status")}>
                Status{sortIndicator("status")}
              </th>
              <th className="px-4 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-white/70">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-2 text-muted">{row.id}</td>
                <td className="px-4 py-2">
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-white/5 border border-white/10 text-white/50">
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-white/80">{row.name}</td>
                <td className="px-4 py-2 text-white/40">{row.date}</td>
                <td className={`px-4 py-2 text-right ${row.profit >= 0 ? "text-up font-bold" : "text-down font-bold"}`}>
                  {row.profit >= 0 ? "+" : ""}{row.profit.toFixed(2)}%
                </td>
                <td className="px-4 py-2 text-right">{row.sharpe.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">{row.trades}</td>
                <td className="px-4 py-2 text-center">
                  {row.status === "completed" && (
                    <span className="text-[8px] text-up font-bold">{"\u2713"}</span>
                  )}
                  {row.status === "running" && (
                    <span className="text-[8px] text-yellow-400 font-bold animate-pulse">{"\u25CF"}</span>
                  )}
                  {row.status === "failed" && (
                    <span className="text-[8px] text-down font-bold">{"\u2717"}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {row.promote ? (
                    <button className="text-[9px] px-2 py-0.5 bg-up/10 border border-up/20 text-up rounded hover:bg-up/20 transition-colors">
                      Promote
                    </button>
                  ) : (
                    <button className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 text-white/50 rounded hover:bg-white/10 transition-colors">
                      Load
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
