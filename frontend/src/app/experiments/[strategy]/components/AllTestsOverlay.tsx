'use client';

import React, { useState, useMemo } from 'react';
import { Star, Search, ArrowUpDown } from 'lucide-react';
import { fmtDateTime, fmtPct, profitColor } from '@/lib/experiments';

interface Test {
  id: string;
  name: string;
  type: 'Backtest' | 'Hyperopt' | 'FreqAI' | 'Verification' | 'AI Review';
  date: Date;
  timerange: string;
  trades: number;
  profit: number;
  maxDD: number;
  sharpe: number;
  status: 'running' | 'completed' | 'promoted' | 'failed';
  isPromoted?: boolean;
}

const mockTests: Test[] = [
  {
    id: 'test-1',
    name: 'BollingerBreak Base BTC/USDT 2022-2024',
    type: 'Backtest',
    date: new Date('2026-03-28'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 156,
    profit: 5.2,
    maxDD: 9.8,
    sharpe: 0.98,
    status: 'completed',
  },
  {
    id: 'test-2',
    name: 'CmaEs SortinoDaily Signals',
    type: 'Hyperopt',
    date: new Date('2026-03-27'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 163,
    profit: 15.2,
    maxDD: 8.4,
    sharpe: 1.52,
    status: 'completed',
    isPromoted: true,
  },
  {
    id: 'test-3',
    name: 'LightGBMReg DI PCA',
    type: 'FreqAI',
    date: new Date('2026-03-26'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 142,
    profit: 13.8,
    maxDD: 8.2,
    sharpe: 1.41,
    status: 'completed',
  },
  {
    id: 'test-4',
    name: 'XGBoost StandardScaler',
    type: 'FreqAI',
    date: new Date('2026-03-25'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 148,
    profit: 12.4,
    maxDD: 9.1,
    sharpe: 1.28,
    status: 'completed',
  },
  {
    id: 'test-5',
    name: 'Out-of-Sample Verification 2024-2025',
    type: 'Verification',
    date: new Date('2026-03-24'),
    timerange: '2024-01-01 - 2025-12-31',
    trades: 98,
    profit: 11.3,
    maxDD: 7.6,
    sharpe: 1.35,
    status: 'completed',
  },
  {
    id: 'test-6',
    name: 'AI Review Score 78/100',
    type: 'AI Review',
    date: new Date('2026-03-23'),
    timerange: 'All tests',
    trades: 0,
    profit: 0,
    maxDD: 0,
    sharpe: 0,
    status: 'completed',
  },
  {
    id: 'test-7',
    name: 'Population-based CmaEs',
    type: 'Hyperopt',
    date: new Date('2026-03-22'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 171,
    profit: 14.8,
    maxDD: 8.9,
    sharpe: 1.48,
    status: 'completed',
  },
  {
    id: 'test-8',
    name: 'RandomSearch Baseline',
    type: 'Hyperopt',
    date: new Date('2026-03-21'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 159,
    profit: 6.4,
    maxDD: 11.2,
    sharpe: 0.76,
    status: 'completed',
  },
  {
    id: 'test-9',
    name: 'DI Feature Engineering',
    type: 'FreqAI',
    date: new Date('2026-03-20'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 154,
    profit: 12.1,
    maxDD: 8.7,
    sharpe: 1.32,
    status: 'completed',
  },
  {
    id: 'test-10',
    name: 'Running Hyperopt Session',
    type: 'Hyperopt',
    date: new Date('2026-03-29T14:32:00'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 0,
    profit: 0,
    maxDD: 0,
    sharpe: 0,
    status: 'running',
  },
  {
    id: 'test-11',
    name: 'Ensemble LightGBM + XGBoost',
    type: 'FreqAI',
    date: new Date('2026-03-19'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 167,
    profit: 14.2,
    maxDD: 7.9,
    sharpe: 1.58,
    status: 'completed',
  },
  {
    id: 'test-12',
    name: 'Failed Backtest - Data Error',
    type: 'Backtest',
    date: new Date('2026-03-18'),
    timerange: '2022-01-01 - 2024-12-31',
    trades: 0,
    profit: 0,
    maxDD: 0,
    sharpe: 0,
    status: 'failed',
  },
];

type SortKey = 'date' | 'profit' | 'sharpe' | 'type';
type TestType = Test['type'] | 'All';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AllTestsOverlay({ onClose, strategy: _strategy }: { onClose: () => void; strategy: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterType, setFilterType] = useState<TestType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = useMemo(() => {
    let result = mockTests;

    if (filterType !== 'All') {
      result = result.filter((t) => t.type === filterType);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }

    return result;
  }, [filterType, searchQuery]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let aVal: string | number | Date = a[sortBy];
      let bVal: string | number | Date = b[sortBy];

      if (sortBy === 'date') {
        aVal = a.date.getTime();
        bVal = b.date.getTime();
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortBy, sortAsc]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paged = sorted.slice(start, start + itemsPerPage);

  const promotedTest = mockTests.find((t) => t.isPromoted);

  const typeColor = (type: Test['type']): string => {
    switch (type) {
      case 'Backtest':
        return 'bg-blue-500/20 text-blue-400';
      case 'Hyperopt':
        return 'bg-purple-500/20 text-purple-400';
      case 'FreqAI':
        return 'bg-cyan-500/20 text-cyan-400';
      case 'Verification':
        return 'bg-green-500/20 text-green-400';
      case 'AI Review':
        return 'bg-amber-500/20 text-amber-400';
    }
  };

  const statusColor = (status: Test['status']): string => {
    switch (status) {
      case 'running':
        return 'bg-blue-500/20 text-blue-400';
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'promoted':
        return 'bg-amber-500/20 text-amber-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
    }
  };

  return (
    <div className="flex h-full gap-4 bg-gradient-to-b from-[#06060b] to-[#0c0c14] text-[#f0f0f5]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-[#1e1e30] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">All Tests</h2>
            <button
              onClick={onClose}
              className="text-[#808098] hover:text-[#f0f0f5] transition"
            >
              ✕
            </button>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-3 gap-3">
            {/* Sort */}
            <div>
              <label className="block text-xs font-semibold text-[#808098] mb-2">
                Sort
              </label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="flex-1 bg-[#12121c] border border-[#1e1e30] rounded px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#6366f1]"
                >
                  <option value="date">Date</option>
                  <option value="profit">Profit</option>
                  <option value="sharpe">Sharpe</option>
                  <option value="type">Type</option>
                </select>
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="bg-[#12121c] border border-[#1e1e30] rounded px-3 py-2 text-[#808098] hover:text-[#f0f0f5] transition"
                >
                  <ArrowUpDown size={16} />
                </button>
              </div>
            </div>

            {/* Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#808098] mb-2">
                Filter
              </label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as TestType);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#12121c] border border-[#1e1e30] rounded px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#6366f1]"
              >
                <option value="All">All Types</option>
                <option value="Backtest">Backtest</option>
                <option value="Hyperopt">Hyperopt</option>
                <option value="FreqAI">FreqAI</option>
                <option value="Verification">Verification</option>
                <option value="AI Review">AI Review</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-[#808098] mb-2">
                Search
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-2.5 text-[#808098]"
                />
                <input
                  type="text"
                  placeholder="Test name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-[#12121c] border border-[#1e1e30] rounded pl-9 pr-3 py-2 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
            </div>
          </div>

          {/* Results count */}
          <div className="text-xs text-[#808098] mt-3">
            {sorted.length} test{sorted.length !== 1 ? 's' : ''} •{' '}
            {paged.length === 0 ? 'No results' : `Page ${currentPage} of ${totalPages}`}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-[#0c0c14] border-b border-[#1e1e30]">
              <tr>
                <th className="w-8 px-4 py-3 text-left text-[#808098] font-semibold">
                  ★
                </th>
                <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                  Timerange
                </th>
                <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                  Trades
                </th>
                <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                  Profit%
                </th>
                <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                  Max DD
                </th>
                <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                  Sharpe
                </th>
                <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((test) => (
                <React.Fragment key={test.id}>
                  <tr
                    className="border-b border-[#1e1e30] hover:bg-[#12121c] cursor-pointer transition"
                    onClick={() =>
                      setExpandedId(
                        expandedId === test.id ? null : test.id
                      )
                    }
                  >
                    <td className="w-8 px-4 py-3">
                      {test.isPromoted && (
                        <Star size={16} className="text-amber-400 fill-amber-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#f0f0f5] font-medium truncate max-w-xs">
                      {test.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${typeColor(
                          test.type
                        )}`}
                      >
                        {test.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#c0c0d0]">
                      {fmtDateTime(test.date.toISOString())}
                    </td>
                    <td className="px-4 py-3 text-[#c0c0d0]">
                      {test.timerange}
                    </td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">
                      {test.trades}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold`}>
                      <span className={profitColor(test.profit)}>
                        {fmtPct(test.profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-red-400">
                      {fmtPct(-test.maxDD)}
                    </td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">
                      {test.sharpe.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusColor(
                          test.status
                        )}`}
                      >
                        {test.status === 'running' && (
                          <>
                            <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-1" />
                            Running
                          </>
                        )}
                        {test.status === 'completed' && 'Completed'}
                        {test.status === 'promoted' && 'Promoted'}
                        {test.status === 'failed' && 'Failed'}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {expandedId === test.id && (
                    <tr className="border-b border-[#1e1e30] bg-[#1a1a28]">
                      <td colSpan={10} className="px-4 py-4">
                        <div className="flex gap-3">
                          <button className="px-3 py-1.5 bg-[#6366f1] hover:bg-[#5558e3] text-white text-xs font-semibold rounded transition">
                            → Verify
                          </button>
                          <button className="px-3 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-semibold rounded transition">
                            Promote ★
                          </button>
                          <button className="px-3 py-1.5 bg-[#12121c] border border-[#1e1e30] hover:border-[#6366f1] text-[#c0c0d0] hover:text-[#f0f0f5] text-xs font-semibold rounded transition">
                            Compare
                          </button>
                          <button className="px-3 py-1.5 bg-[#12121c] border border-[#1e1e30] hover:border-[#6366f1] text-[#c0c0d0] hover:text-[#f0f0f5] text-xs font-semibold rounded transition">
                            → Analysis
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-[#1e1e30] px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-[#808098]">
            Showing {start + 1} to {Math.min(start + itemsPerPage, sorted.length)} of{' '}
            {sorted.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-[#12121c] border border-[#1e1e30] rounded text-[#c0c0d0] hover:text-[#f0f0f5] disabled:opacity-50 disabled:cursor-not-allowed transition text-xs font-semibold"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1.5 rounded text-xs font-semibold transition ${
                      page === currentPage
                        ? 'bg-[#6366f1] text-white'
                        : 'bg-[#12121c] border border-[#1e1e30] text-[#c0c0d0] hover:text-[#f0f0f5]'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <span className="text-[#808098]">...</span>
              )}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-[#12121c] border border-[#1e1e30] rounded text-[#c0c0d0] hover:text-[#f0f0f5] disabled:opacity-50 disabled:cursor-not-allowed transition text-xs font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Active Version Panel */}
      <div className="w-72 border-l border-[#1e1e30] bg-gradient-to-b from-[#12121c] to-[#0c0c14] p-6 overflow-auto flex flex-col gap-6">
        <div>
          <h3 className="text-xs font-semibold text-[#808098] uppercase tracking-wide mb-4">
            Active Version
          </h3>
          {promotedTest ? (
            <div className="space-y-4">
              {/* Version Info */}
              <div className="bg-[#1a1a28] border border-[#1e1e30] rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span className="text-sm font-semibold text-[#f0f0f5]">
                    v1.0
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#808098]">Promoted</span>
                    <span className="text-[#c0c0d0] font-medium">
                      {fmtDateTime(promotedTest.date.toISOString())}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#808098]">Source</span>
                    <span className="text-[#c0c0d0] font-medium">
                      {promotedTest.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="space-y-3">
                <div className="bg-[#1a1a28] border border-[#1e1e30] rounded p-3">
                  <div className="text-[#808098] text-xs mb-1">Total Profit</div>
                  <div className={`text-lg font-bold ${profitColor(promotedTest.profit)}`}>
                    {fmtPct(promotedTest.profit)}
                  </div>
                </div>

                <div className="bg-[#1a1a28] border border-[#1e1e30] rounded p-3">
                  <div className="text-[#808098] text-xs mb-1">Win Rate</div>
                  <div className="text-lg font-bold text-green-400">64.1%</div>
                </div>

                <div className="bg-[#1a1a28] border border-[#1e1e30] rounded p-3">
                  <div className="text-[#808098] text-xs mb-1">Max Drawdown</div>
                  <div className="text-lg font-bold text-red-400">
                    {fmtPct(-promotedTest.maxDD)}
                  </div>
                </div>

                <div className="bg-[#1a1a28] border border-[#1e1e30] rounded p-3">
                  <div className="text-[#808098] text-xs mb-1">Sharpe Ratio</div>
                  <div className="text-lg font-bold text-[#6366f1]">
                    {promotedTest.sharpe.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="bg-[#1a1a28] border border-green-500/30 rounded p-3">
                <div className="text-xs text-green-400 font-semibold">
                  ✓ Paper Trading · Day 12/30
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[#808098] text-sm">No promoted version</div>
          )}
        </div>

        {/* Pipeline Status */}
        <div>
          <h3 className="text-xs font-semibold text-[#808098] uppercase tracking-wide mb-4">
            Pipeline Status
          </h3>
          <div className="space-y-3 text-xs">
            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded p-3">
              <div className="font-semibold text-[#f0f0f5] mb-2">
                BollingerBreak
              </div>
              <div className="space-y-2 text-[#c0c0d0]">
                <div>
                  ├── <span className="text-green-400">Backtest:</span> 5.2% profit
                </div>
                <div>
                  ├── <span className="text-purple-400">Hyperopt:</span> Best 15.2%
                </div>
                <div>
                  ├── <span className="text-cyan-400">FreqAI:</span> Best 13.8%
                </div>
                <div>
                  ├── <span className="text-amber-400">AI Review:</span> 78/100
                </div>
                <div>
                  ├── <span className="text-green-400">Verification:</span> PASS ✓
                </div>
                <div>
                  └── <span className="text-amber-400">ACTIVE:</span> v1.0
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Version History Toggle */}
        <button className="w-full px-4 py-2 bg-[#12121c] border border-[#1e1e30] hover:border-[#6366f1] rounded text-sm font-semibold text-[#c0c0d0] hover:text-[#f0f0f5] transition">
          Version History
        </button>
      </div>
    </div>
  );
}
