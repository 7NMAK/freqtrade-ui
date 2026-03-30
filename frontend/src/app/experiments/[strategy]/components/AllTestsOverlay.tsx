'use client';

import React, { useState, useMemo } from 'react';
import { fmtDateTime, fmtPct, profitColor } from '@/lib/experiments';

const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

interface Test {
  id: string;
  name: string;
  type: 'Backtest' | 'Hyperopt' | 'FreqAI' | 'Verification' | 'AI Review';
  sampler?: string;
  lossFn?: string;
  spaces?: string;
  date: Date;
  trades: number;
  profit: number;
  maxDD: number;
  sharpe: number;
  sortino: number;
  winRate: number;
  status: 'running' | 'completed' | 'failed';
  isPromoted?: boolean;
}

const mockTests: Test[] = [
  {
    id: 'test-1',
    name: 'CmaEs SortinoDaily Signals',
    type: 'Hyperopt',
    sampler: 'CmaEs',
    lossFn: 'SortinoDaily',
    spaces: 'buy, sell, roi, stoploss',
    date: new Date('2026-03-28T15:42:16'),
    trades: 156,
    profit: 15.2,
    maxDD: 8.4,
    sharpe: 1.52,
    sortino: 1.68,
    winRate: 64.1,
    status: 'completed',
    isPromoted: true,
  },
  {
    id: 'test-2',
    name: 'Base RSI Backtest',
    type: 'Backtest',
    date: new Date('2026-03-27T09:15:00'),
    trades: 124,
    profit: 8.9,
    maxDD: 12.3,
    sharpe: 0.94,
    sortino: 1.04,
    winRate: 58.3,
    status: 'completed',
  },
  {
    id: 'test-3',
    name: 'LightGBM+DI Strategy',
    type: 'FreqAI',
    sampler: 'LightGBM',
    lossFn: 'DI',
    spaces: 'features, outlier',
    date: new Date('2026-03-30T11:28:00'),
    trades: 178,
    profit: 13.8,
    maxDD: 9.2,
    sharpe: 1.41,
    sortino: 1.55,
    winRate: 61.8,
    status: 'running',
  },
  {
    id: 'test-4',
    name: 'TPE Sharpe Optimization',
    type: 'Hyperopt',
    sampler: 'TPE',
    lossFn: 'Sharpe',
    spaces: 'buy, sell',
    date: new Date('2026-03-29T22:41:00'),
    trades: 149,
    profit: 12.1,
    maxDD: 10.5,
    sharpe: 1.38,
    sortino: 1.48,
    winRate: 59.7,
    status: 'completed',
  },
  {
    id: 'test-5',
    name: 'OOS 2025 CmaEs Verify',
    type: 'Verification',
    sampler: 'CmaEs',
    lossFn: 'SortinoDaily',
    spaces: 'all',
    date: new Date('2026-03-28T14:32:00'),
    trades: 142,
    profit: 11.3,
    maxDD: 9.8,
    sharpe: 1.28,
    sortino: 1.42,
    winRate: 63.4,
    status: 'completed',
  },
  {
    id: 'test-6',
    name: 'PSO Calmar Test',
    type: 'Hyperopt',
    sampler: 'PSO',
    lossFn: 'Calmar',
    spaces: 'roi, stoploss, trailing',
    date: new Date('2026-03-27T18:15:00'),
    trades: 135,
    profit: 11.9,
    maxDD: 11.2,
    sharpe: 1.31,
    sortino: 1.44,
    winRate: 60.2,
    status: 'completed',
  },
  {
    id: 'test-7',
    name: 'SKOPT Profit Factor',
    type: 'Hyperopt',
    sampler: 'SKOPT',
    lossFn: 'OnlyProfit',
    spaces: 'buy, sell, roi',
    date: new Date('2026-03-26T12:08:00'),
    trades: 167,
    profit: 14.2,
    maxDD: 8.9,
    sharpe: 1.49,
    sortino: 1.63,
    winRate: 65.3,
    status: 'completed',
  },
  {
    id: 'test-8',
    name: 'BB Squeeze Manual Test',
    type: 'Backtest',
    date: new Date('2026-03-25T07:42:00'),
    trades: 98,
    profit: 6.4,
    maxDD: 15.3,
    sharpe: 0.81,
    sortino: 0.92,
    winRate: 54.1,
    status: 'completed',
  },
  {
    id: 'test-9',
    name: 'EMA Cross Test',
    type: 'Backtest',
    date: new Date('2026-03-24T21:19:00'),
    trades: 112,
    profit: 7.8,
    maxDD: 13.6,
    sharpe: 0.92,
    sortino: 1.03,
    winRate: 56.8,
    status: 'completed',
  },
  {
    id: 'test-10',
    name: 'CNN Features Analysis',
    type: 'FreqAI',
    sampler: 'CNN',
    lossFn: 'features',
    spaces: 'neural',
    date: new Date('2026-03-24T16:55:00'),
    trades: 191,
    profit: 9.7,
    maxDD: 11.1,
    sharpe: 1.15,
    sortino: 1.26,
    winRate: 57.9,
    status: 'completed',
  },
  {
    id: 'test-11',
    name: 'Ensemble LightGBM + XGBoost',
    type: 'FreqAI',
    sampler: 'Ensemble',
    lossFn: 'Weighted',
    spaces: 'features, ensemble',
    date: new Date('2026-03-23T14:22:00'),
    trades: 189,
    profit: 14.5,
    maxDD: 7.9,
    sharpe: 1.58,
    sortino: 1.72,
    winRate: 66.2,
    status: 'completed',
  },
  {
    id: 'test-12',
    name: 'XGBoost StandardScaler',
    type: 'FreqAI',
    sampler: 'XGBoost',
    lossFn: 'Regression',
    spaces: 'features',
    date: new Date('2026-03-22T10:11:00'),
    trades: 155,
    profit: 12.8,
    maxDD: 10.2,
    sharpe: 1.42,
    sortino: 1.56,
    winRate: 62.5,
    status: 'completed',
  },
  {
    id: 'test-13',
    name: 'Population-based CmaEs',
    type: 'Hyperopt',
    sampler: 'CmaEs',
    lossFn: 'MultiMetric',
    spaces: 'buy, sell, roi, stoploss, trailing',
    date: new Date('2026-03-21T08:45:00'),
    trades: 171,
    profit: 14.8,
    maxDD: 8.9,
    sharpe: 1.48,
    sortino: 1.61,
    winRate: 65.8,
    status: 'completed',
  },
  {
    id: 'test-14',
    name: 'RandomSearch Baseline',
    type: 'Hyperopt',
    sampler: 'Random',
    lossFn: 'SharpeDaily',
    spaces: 'buy, sell',
    date: new Date('2026-03-20T20:30:00'),
    trades: 159,
    profit: 6.4,
    maxDD: 11.2,
    sharpe: 0.76,
    sortino: 0.84,
    winRate: 51.3,
    status: 'completed',
  },
  {
    id: 'test-15',
    name: 'DI Feature Engineering',
    type: 'FreqAI',
    sampler: 'LightGBM',
    lossFn: 'DI+PCA',
    spaces: 'features, pca',
    date: new Date('2026-03-19T15:05:00'),
    trades: 154,
    profit: 12.1,
    maxDD: 8.7,
    sharpe: 1.32,
    sortino: 1.45,
    winRate: 60.9,
    status: 'completed',
  },
  {
    id: 'test-16',
    name: 'Running Hyperopt Session',
    type: 'Hyperopt',
    sampler: 'TPE',
    lossFn: 'Sortino',
    spaces: 'buy, sell, roi',
    date: new Date('2026-03-30T10:00:00'),
    trades: 0,
    profit: 0,
    maxDD: 0,
    sharpe: 0,
    sortino: 0,
    winRate: 0,
    status: 'running',
  },
  {
    id: 'test-17',
    name: 'NSGAII Multi-Objective',
    type: 'Hyperopt',
    sampler: 'NSGAII',
    lossFn: 'ProfitDrawDown',
    spaces: 'buy, sell, roi, stoploss',
    date: new Date('2026-03-18T12:30:00'),
    trades: 143,
    profit: 10.6,
    maxDD: 9.5,
    sharpe: 1.25,
    sortino: 1.38,
    winRate: 59.1,
    status: 'completed',
  },
  {
    id: 'test-18',
    name: 'QMC Exploration Run',
    type: 'Hyperopt',
    sampler: 'QMC',
    lossFn: 'Calmar',
    spaces: 'all',
    date: new Date('2026-03-17T09:15:00'),
    trades: 168,
    profit: 13.4,
    maxDD: 9.1,
    sharpe: 1.45,
    sortino: 1.59,
    winRate: 64.6,
    status: 'completed',
  },
  {
    id: 'test-19',
    name: 'Failed Backtest - Data Error',
    type: 'Backtest',
    date: new Date('2026-03-16T05:22:00'),
    trades: 0,
    profit: 0,
    maxDD: 0,
    sharpe: 0,
    sortino: 0,
    winRate: 0,
    status: 'failed',
  },
];

type SortKey = 'date' | 'profit' | 'sharpe' | 'type';
type StatusFilter = 'All' | 'Running' | 'Done' | 'Failed';
type TestType = Test['type'] | 'All Types';

export default function AllTestsOverlay({}: { onClose: () => void; strategy: string }) {
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [filterType, setFilterType] = useState<TestType>('All Types');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = useMemo(() => {
    let result = mockTests;

    if (filterType !== 'All Types') {
      result = result.filter((t) => t.type === filterType);
    }

    if (filterStatus !== 'All') {
      if (filterStatus === 'Running') {
        result = result.filter((t) => t.status === 'running');
      } else if (filterStatus === 'Done') {
        result = result.filter((t) => t.status === 'completed');
      } else if (filterStatus === 'Failed') {
        result = result.filter((t) => t.status === 'failed');
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }

    return result;
  }, [filterType, filterStatus, searchQuery]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let aVal: string | number | Date = a[sortBy];
      let bVal: string | number | Date = b[sortBy];

      if (sortBy === 'date') {
        aVal = a.date.getTime();
        bVal = b.date.getTime();
      }

      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
    // Most recent first
    return copy.reverse();
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paged = sorted.slice(start, start + itemsPerPage);

  const promotedTest = mockTests.find((t) => t.isPromoted);

  const typeClass = (type: Test['type']): string => {
    switch (type) {
      case 'Backtest':
        return 'bg-[rgba(59,130,246,0.08)] text-[#3b82f6] border-[rgba(59,130,246,0.25)]';
      case 'Hyperopt':
        return 'bg-[rgba(168,85,247,0.08)] text-[#a855f7] border-[rgba(168,85,247,0.25)]';
      case 'FreqAI':
        return 'bg-[rgba(34,211,238,0.08)] text-[#22d3ee] border-[rgba(34,211,238,0.25)]';
      case 'Verification':
        return 'bg-[rgba(34,197,94,0.08)] text-[#22c55e] border-[rgba(34,197,94,0.25)]';
      case 'AI Review':
        return 'bg-[rgba(245,158,11,0.08)] text-[#f59e0b] border-[rgba(245,158,11,0.25)]';
    }
  };

  const statusClass = (status: Test['status']): string => {
    switch (status) {
      case 'running':
        return 'bg-[rgba(99,102,241,0.12)] text-[#6366f1] border-[rgba(99,102,241,0.3)] animate-pulse';
      case 'completed':
        return 'bg-[rgba(34,197,94,0.08)] text-[#22c55e] border-[rgba(34,197,94,0.25)]';
      case 'failed':
        return 'bg-[rgba(239,68,68,0.08)] text-[#ef4444] border-[rgba(239,68,68,0.25)]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-0 text-text-0">
      {/* Filter bar */}
      <div className="border-b border-border px-[16px] py-[12px] space-y-[12px]">
        <div className="flex gap-[12px] items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className={LABEL}>Search</label>
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className={SELECT}
            >
              <option value="date">Date</option>
              <option value="profit">Profit</option>
              <option value="sharpe">Sharpe</option>
              <option value="type">Type</option>
            </select>
          </div>
        </div>

        {/* Type filters */}
        <div className="flex gap-[8px] flex-wrap">
          <button
            onClick={() => {
              setFilterType('All Types');
              setCurrentPage(1);
            }}
            className={`px-[12px] py-[4px] rounded-full text-[11px] font-semibold uppercase tracking-[0.5px] border transition ${
              filterType === 'All Types'
                ? 'bg-accent border-accent text-white'
                : 'bg-transparent border-border text-text-2 hover:text-text-1'
            }`}
          >
            All Types ({filtered.length})
          </button>
          {['Backtest', 'Hyperopt', 'FreqAI', 'Verification', 'AI Review'].map((type) => {
            const count = mockTests.filter((t) => t.type === type as Test['type']).length;
            return (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type as TestType);
                  setCurrentPage(1);
                }}
                className={`px-[12px] py-[4px] rounded-full text-[11px] font-semibold uppercase tracking-[0.5px] border transition ${
                  filterType === type
                    ? 'bg-accent border-accent text-white'
                    : 'bg-transparent border-border text-text-2 hover:text-text-1'
                }`}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>

        {/* Status filters */}
        <div className="flex gap-[8px]">
          {(['All', 'Running', 'Done', 'Failed'] as const).map((status) => {
            let count = mockTests.length;
            if (status === 'Running') count = mockTests.filter((t) => t.status === 'running').length;
            else if (status === 'Done') count = mockTests.filter((t) => t.status === 'completed').length;
            else if (status === 'Failed') count = mockTests.filter((t) => t.status === 'failed').length;

            return (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status as StatusFilter);
                  setCurrentPage(1);
                }}
                className={`px-[12px] py-[4px] rounded-full text-[11px] font-semibold uppercase tracking-[0.5px] border transition ${
                  filterStatus === status
                    ? 'bg-accent border-accent text-white'
                    : 'bg-transparent border-border text-text-2 hover:text-text-1'
                }`}
              >
                {status === 'All' ? `All (${count})` : `${status} (${count})`}
              </button>
            );
          })}
        </div>

        {/* Count label */}
        <div className="text-[11px] text-text-3 font-semibold">
          {sorted.length} test{sorted.length !== 1 ? 's' : ''} for BollingerBreak
        </div>
      </div>

      {/* Active version card */}
      {promotedTest && (
        <div className="border-b border-border px-[16px] py-[12px]">
          <div className="bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.25)] rounded-[6px] p-[12px]">
            <div className="text-[10px] uppercase tracking-[0.5px] text-accent font-semibold mb-[8px]">
              Active Version
            </div>
            <div className="text-[13px] font-semibold text-accent mb-[8px]">
              v1.0 · CmaEs SortinoDaily params
            </div>
            <div className="text-[10px] text-text-2 mb-[12px]">
              Promoted {fmtDateTime(promotedTest.date.toISOString())}
            </div>
            <div className="grid grid-cols-2 gap-[8px] text-[11px]">
              <div>
                <span className="text-text-3">Profit:</span>{' '}
                <span className="text-green">{fmtPct(promotedTest.profit)}</span>
              </div>
              <div>
                <span className="text-text-3">Sharpe:</span>{' '}
                <span className="text-accent">{promotedTest.sharpe.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-text-3">Win Rate:</span>{' '}
                <span className="text-green">{promotedTest.winRate.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-text-3">Max DD:</span>{' '}
                <span className="text-red">{fmtPct(-promotedTest.maxDD)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-bg-1">
            <tr>
              <th className="w-[30px] py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                ★
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap text-left">
                Name
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                Type
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                Sampler
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                Loss Fn
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                Spaces
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                Started
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap text-right">
                Trades
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap text-right">
                Win%
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap text-right">
                Profit%
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap text-right">
                Max DD
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap text-right">
                Sharpe
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap text-right">
                Sortino
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                Status
              </th>
              <th className="py-[8px] px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold border-b border-border whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((test) => (
              <tr key={test.id} className="border-b border-border/50 hover:bg-bg-2 transition">
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap text-center">
                  {test.isPromoted && <span className="text-green">⭐</span>}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap max-w-xs truncate font-semibold">
                  {test.name}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-[8px] py-[2px] rounded-full text-[10px] font-semibold uppercase tracking-[0.5px] border ${typeClass(
                      test.type
                    )}`}
                  >
                    {test.type}
                  </span>
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap">
                  {test.sampler || '—'}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap">
                  {test.lossFn || '—'}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-2 whitespace-nowrap text-xs">
                  {test.spaces ? test.spaces.split(',').slice(0, 2).join(', ') : '—'}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap font-mono text-[10px]">
                  {fmtDateTime(test.date.toISOString()).split(' ').join('\n')}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap text-right font-mono">
                  {test.trades}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap text-right font-mono">
                  {test.winRate > 0 ? `${test.winRate.toFixed(1)}%` : '—'}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] whitespace-nowrap text-right font-semibold">
                  <span className={profitColor(test.profit)}>
                    {fmtPct(test.profit)}
                  </span>
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-red whitespace-nowrap text-right font-mono">
                  {fmtPct(-test.maxDD)}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-accent whitespace-nowrap text-right font-mono">
                  {test.sharpe > 0 ? test.sharpe.toFixed(2) : '—'}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] text-text-1 whitespace-nowrap text-right font-mono">
                  {test.sortino > 0 ? test.sortino.toFixed(2) : '—'}
                </td>
                <td className="py-[8px] px-[10px] text-[11px] whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-[8px] py-[2px] rounded-full text-[10px] font-semibold uppercase tracking-[0.5px] border ${statusClass(
                      test.status
                    )}`}
                  >
                    {test.status === 'running' && (
                      <>
                        <span className="inline-block w-[6px] h-[6px] bg-accent rounded-full animate-pulse mr-[4px]" />
                        Running
                      </>
                    )}
                    {test.status === 'completed' && 'Completed'}
                    {test.status === 'failed' && 'Failed'}
                  </span>
                </td>
                <td className="py-[8px] px-[10px] text-[11px] whitespace-nowrap">
                  <button className="inline-flex items-center justify-center h-[30px] px-[12px] bg-accent hover:bg-[#5558e6] text-white rounded-btn text-[11px] font-medium border border-accent transition">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t border-border px-[16px] py-[12px] flex items-center justify-between">
        <div className="text-[11px] text-text-2">
          Showing {start + 1} to {Math.min(start + itemsPerPage, sorted.length)} of{' '}
          {sorted.length}
        </div>
        <div className="flex gap-[8px] items-center">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center justify-center h-[34px] px-[14px] rounded-btn text-[12px] font-medium border border-border bg-bg-2 text-text-1 hover:text-text-0 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ← Prev
          </button>
          <div className="flex gap-[4px] items-center">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`inline-flex items-center justify-center h-[34px] w-[34px] rounded-btn text-[12px] font-medium border transition ${
                    page === currentPage
                      ? 'bg-accent border-accent text-white'
                      : 'border-border bg-bg-2 text-text-1 hover:text-text-0'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            {totalPages > 5 && <span className="text-[12px] text-text-3">...</span>}
          </div>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center justify-center h-[34px] px-[14px] rounded-btn text-[12px] font-medium border border-border bg-bg-2 text-text-1 hover:text-text-0 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
