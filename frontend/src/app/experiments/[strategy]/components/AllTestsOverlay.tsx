'use client';

import React, { useState, useMemo } from 'react';

const INPUT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground placeholder-text-3 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

type SortKey = 'date' | 'profit' | 'sharpe' | 'type';
type StatusFilter = 'All' | 'Running' | 'Done' | 'Failed';
type TestType = 'Backtest' | 'Hyperopt' | 'FreqAI' | 'Verification' | 'AI Review' | 'All Types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AllTestsOverlay({ onClose, strategy }: { onClose: () => void; strategy: string }) {
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [filterType, setFilterType] = useState<TestType>('All Types');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tests: any[] = [];

  const filtered = useMemo(() => {
    let result = tests;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return copy.reverse();
  }, [filtered, sortBy]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paged = sorted.slice(start, start + itemsPerPage);


  return (
    <div className="flex flex-col h-full bg-background text-foreground">
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
            className={`px-[12px] py-[4px] rounded-full text-xs font-semibold uppercase tracking-[0.5px] border transition ${
              filterType === 'All Types'
                ? 'bg-primary border-primary text-white'
                : 'bg-transparent border-border text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            All Types ({filtered.length})
          </button>
          {['Backtest', 'Hyperopt', 'FreqAI', 'Verification', 'AI Review'].map((type) => {
            return (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type as TestType);
                  setCurrentPage(1);
                }}
                className={`px-[12px] py-[4px] rounded-full text-xs font-semibold uppercase tracking-[0.5px] border transition ${
                  filterType === type
                    ? 'bg-primary border-primary text-white'
                    : 'bg-transparent border-border text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                {type} (0)
              </button>
            );
          })}
        </div>

        {/* Status filters */}
        <div className="flex gap-[8px]">
          {(['All', 'Running', 'Done', 'Failed'] as const).map((status) => {
            return (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status as StatusFilter);
                  setCurrentPage(1);
                }}
                className={`px-[12px] py-[4px] rounded-full text-xs font-semibold uppercase tracking-[0.5px] border transition ${
                  filterStatus === status
                    ? 'bg-primary border-primary text-white'
                    : 'bg-transparent border-border text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                {status === 'All' ? `All (0)` : `${status} (0)`}
              </button>
            );
          })}
        </div>

        {/* Count label */}
        <div className="text-xs text-muted-foreground font-semibold">
          {sorted.length} test{sorted.length !== 1 ? 's' : ''} for {strategy}
        </div>
      </div>

      {/* Empty state */}
      {paged.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-[16px] py-[40px]">
          <div className="text-sm font-semibold text-muted-foreground mb-[8px]">No tests found</div>
          <div className="text-xs text-muted-foreground max-w-xs text-center">
            Run a backtest, hyperopt, or FreqAI test first.
          </div>
        </div>
      )}

      {/* Table */}
      {paged.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="w-[30px] py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  ★
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-left">
                  Name
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Type
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Sampler
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Loss Fn
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Spaces
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Started
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">
                  Trades
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">
                  Win%
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">
                  Profit%
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">
                  Max DD
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">
                  Sharpe
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap text-right">
                  Sortino
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Status
                </th>
                <th className="py-[8px] px-[10px] text-xs uppercase tracking-[0.5px] text-muted-foreground font-semibold border-b border-border whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map(() => (
                <tr key={0} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {paged.length > 0 && (
        <div className="border-t border-border px-[16px] py-[12px] flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Showing {start + 1} to {Math.min(start + itemsPerPage, sorted.length)} of{' '}
            {sorted.length}
          </div>
          <div className="flex gap-[8px] items-center">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center h-[34px] px-[14px] rounded-btn text-xs font-medium border border-border bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
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
                    className={`inline-flex items-center justify-center h-[34px] w-[34px] rounded-btn text-xs font-medium border transition ${
                      page === currentPage
                        ? 'bg-primary border-primary text-white'
                        : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="text-xs text-muted-foreground">...</span>}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center h-[34px] px-[14px] rounded-btn text-xs font-medium border border-border bg-muted/50 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
