'use client';

import React, { useState } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import { profitColor } from '@/lib/experiments';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

type AnalysisTab = 'enterTags' | 'exitReasons' | 'tradingList' | 'rejectedSignals' | 'indicatorAnalysis' | 'signalAnalysis';

interface EnterTagData {
  tag: string;
  trades: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
  avgDuration: string;
  maxDD: number;
}

interface ExitReasonData {
  reason: string;
  trades: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
  avgDuration: string;
}

// §30 Group 0: Enter/Exit Tag Performance
const mockEnterTags: EnterTagData[] = [
  { tag: 'rsi_cross', trades: 45, winRate: 71.1, avgProfit: 0.82, totalProfit: 369, avgDuration: '2d 6h', maxDD: 7.2 },
  { tag: 'bb_squeeze', trades: 38, winRate: 63.2, avgProfit: 0.54, totalProfit: 205, avgDuration: '2d 2h', maxDD: 8.9 },
  { tag: 'volume_spike', trades: 28, winRate: 60.7, avgProfit: 0.38, totalProfit: 107, avgDuration: '2d 1h', maxDD: 6.4 },
  { tag: 'ema_cross', trades: 25, winRate: 56.0, avgProfit: 0.21, totalProfit: 53, avgDuration: '1d 22h', maxDD: 5.8 },
  { tag: 'macd_signal', trades: 20, winRate: 50.0, avgProfit: -0.12, totalProfit: -24, avgDuration: '2d 4h', maxDD: 9.6 },
];

const mockExitReasons: ExitReasonData[] = [
  { reason: 'roi', trades: 78, winRate: 100, avgProfit: 2.1, totalProfit: 163.8, avgDuration: '1d 4h' },
  { reason: 'trailing_stop_loss', trades: 34, winRate: 82.4, avgProfit: 1.4, totalProfit: 47.6, avgDuration: '3d 1h' },
  { reason: 'stop_loss', trades: 28, winRate: 0, avgProfit: -3.2, totalProfit: -89.6, avgDuration: '0d 19h' },
  { reason: 'exit_signal', trades: 12, winRate: 58.3, avgProfit: 0.3, totalProfit: 3.6, avgDuration: '2d 14h' },
  { reason: 'force_exit', trades: 4, winRate: 25.0, avgProfit: -1.1, totalProfit: -4.4, avgDuration: '4d 5h' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AnalysisOverlay({ onClose, strategy: _strategy }: { onClose: () => void; strategy: string }) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('enterTags');

  const tabs: { id: AnalysisTab; label: string }[] = [
    { id: 'enterTags', label: 'Enter Tag Stats' },
    { id: 'exitReasons', label: 'Exit Reason Stats' },
    { id: 'tradingList', label: 'Trading List' },
    { id: 'rejectedSignals', label: 'Rejected Signals' },
    { id: 'indicatorAnalysis', label: 'Indicator Analysis' },
    { id: 'signalAnalysis', label: 'Signal Analysis' },
  ];

  return (
    <div className="flex h-full flex-col bg-bg-0">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-text-0 flex items-center gap-2">
            📊 Analysis — §30 Deep Dive
          </h2>
          <button
            onClick={onClose}
            className="text-text-2 hover:text-text-0 transition text-[16px]"
          >
            ✕
          </button>
        </div>

        {/* Test Selector */}
        <div className="space-y-2">
          <label className={LABEL}>Select Test</label>
          <select className={SELECT}>
            <option>CmaEs · SortinoDaily Signals · Hyperopt · 2026-03-28 15:42 · +15.2%</option>
            <option>TPE · Sharpe Optimization · Hyperopt · 2026-03-29 22:41 · +12.1%</option>
            <option>LightGBM+DI Strategy · FreqAI · 2026-03-30 11:28 · +13.8%</option>
            <option>Base RSI Backtest · Backtest · 2026-03-27 09:15 · +8.9%</option>
            <option>OOS 2025 CmaEs Verify · Verification · 2026-03-28 14:32 · +11.3%</option>
          </select>
        </div>
      </div>

      {/* Quick Filters & Button */}
      <div className="border-b border-border px-6 py-4 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {['All', 'Hyperopt', 'FreqAI', 'Backtest', 'Verification'].map((chip) => (
            <button
              key={chip}
              className="h-[30px] px-3 text-[11px] font-semibold text-text-1 bg-bg-2 border border-border rounded-btn hover:border-accent transition"
            >
              {chip}
            </button>
          ))}
        </div>

        <button className="w-full h-[34px] px-3 text-[12px] font-semibold bg-accent text-white rounded-btn border border-accent hover:opacity-90 transition">
          ⭐ Analyze Promoted Test
        </button>
      </div>

      {/* Signal Stats Grid (top of content) */}
      <div className="border-b border-border px-6 py-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-bg-1 border border-border rounded-card p-3">
            <div className="text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3 mb-2">
              Total Signals
            </div>
            <div className="text-[20px] font-bold text-text-0">312</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-3">
            <div className="text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3 mb-2">
              Executed
            </div>
            <div className="text-[20px] font-bold text-green">156</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-3">
            <div className="text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3 mb-2">
              Rejected
            </div>
            <div className="text-[20px] font-bold text-red">98</div>
          </div>
          <div className="bg-bg-1 border border-border rounded-card p-3">
            <div className="text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3 mb-2">
              No Action
            </div>
            <div className="text-[20px] font-bold text-text-2">58</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-border px-6 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-[12px] font-semibold whitespace-nowrap transition border-b-2 ${
              activeTab === tab.id
                ? 'text-accent border-accent'
                : 'text-text-2 border-transparent hover:text-text-1'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {/* Enter Tag Stats (§30 Group 0) */}
        {activeTab === 'enterTags' && (
          <div className="px-6 py-4 space-y-4">
            <div className="bg-bg-2 border border-[rgba(34,197,94,0.25)] rounded-card p-3">
              <p className="text-[12px] text-text-1">
                <span className="text-green font-semibold">rsi_cross</span> is the best performer with{' '}
                <span className="text-green font-semibold">71.1% win rate</span> and{' '}
                <span className="text-green font-semibold">+$369 total profit</span>. Consider removing{' '}
                <span className="text-red font-semibold">macd_signal</span> (50% win rate, -$24 loss).
              </p>
            </div>

            <div className="bg-bg-1 border border-border rounded-card overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-bg-2 border-b border-border">
                  <tr>
                    <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      <Tooltip content="Label assigned to each entry signal to identify the trigger">
                        Enter Tag
                      </Tooltip>
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Trades
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      <Tooltip content="Percentage of profitable trades for this signal type">
                        Win Rate
                      </Tooltip>
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      <Tooltip content="Average profit per trade using this signal">
                        Avg Profit%
                      </Tooltip>
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Total Profit
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      <Tooltip content="Average time the position is held">
                        Avg Duration
                      </Tooltip>
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      <Tooltip content="Maximum drawdown from peak for this signal group">
                        Max DD
                      </Tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {mockEnterTags.map((row, idx) => (
                    <tr key={idx} className="hover:bg-bg-2 transition">
                      <td className="py-2 px-[10px] text-text-0 font-semibold">{row.tag}</td>
                      <td className="py-2 px-[10px] text-right text-text-1">{row.trades}</td>
                      <td
                        className={`py-2 px-[10px] text-right font-semibold ${
                          row.winRate >= 60 ? 'text-green' : row.winRate >= 50 ? 'text-amber' : 'text-red'
                        }`}
                      >
                        {row.winRate.toFixed(1)}%
                      </td>
                      <td className={`py-2 px-[10px] text-right font-semibold ${profitColor(row.avgProfit)}`}>
                        {row.avgProfit > 0 ? '+' : ''}{row.avgProfit.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-[10px] text-right font-semibold ${profitColor(row.totalProfit)}`}>
                        {row.totalProfit > 0 ? '+' : ''}${row.totalProfit.toFixed(0)}
                      </td>
                      <td className="py-2 px-[10px] text-right text-text-1">{row.avgDuration}</td>
                      <td className="py-2 px-[10px] text-right text-red">-{row.maxDD.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Exit Reason Stats (§30 Group 1) */}
        {activeTab === 'exitReasons' && (
          <div className="px-6 py-4 space-y-4">
            <div className="bg-bg-1 border border-border rounded-card overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-bg-2 border-b border-border">
                  <tr>
                    <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Exit Reason
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Trades
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Win Rate
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Avg Profit%
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Total Profit
                    </th>
                    <th className="py-2 px-[10px] text-right text-[10px] uppercase tracking-[0.5px] font-semibold text-text-3">
                      Avg Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {mockExitReasons.map((row, idx) => (
                    <tr key={idx} className="hover:bg-bg-2 transition">
                      <td className="py-2 px-[10px] text-text-0 font-semibold">
                        {row.reason.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 px-[10px] text-right text-text-1">{row.trades}</td>
                      <td
                        className={`py-2 px-[10px] text-right font-semibold ${
                          row.winRate >= 80 ? 'text-green' : row.winRate >= 50 ? 'text-amber' : 'text-red'
                        }`}
                      >
                        {row.winRate.toFixed(1)}%
                      </td>
                      <td className={`py-2 px-[10px] text-right font-semibold ${profitColor(row.avgProfit)}`}>
                        {row.avgProfit > 0 ? '+' : ''}{row.avgProfit.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-[10px] text-right font-semibold ${profitColor(row.totalProfit)}`}>
                        {row.totalProfit > 0 ? '+' : ''}${row.totalProfit.toFixed(1)}
                      </td>
                      <td className="py-2 px-[10px] text-right text-text-1">{row.avgDuration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trading List (§30 Group 2: Pair Performance stub) */}
        {activeTab === 'tradingList' && (
          <div className="px-6 py-4 space-y-4">
            <div className="bg-bg-1 border border-border rounded-card p-3 text-center text-text-3 text-[12px]">
              Trading list showing all executed trades (§30 Group 2: Pair Performance breakdown).
            </div>
          </div>
        )}

        {/* Rejected Signals (§30 Group 3: Day of Week Performance stub) */}
        {activeTab === 'rejectedSignals' && (
          <div className="px-6 py-4 space-y-4">
            <div className="bg-bg-1 border border-border rounded-card p-3 text-center text-text-3 text-[12px]">
              Rejected signals and day-of-week analysis (§30 Group 3: Day of Week Performance).
            </div>
          </div>
        )}

        {/* Indicator Analysis (§30 Group 4: Month Performance stub) */}
        {activeTab === 'indicatorAnalysis' && (
          <div className="px-6 py-4 space-y-4">
            <div className="bg-bg-1 border border-border rounded-card p-3 text-center text-text-3 text-[12px]">
              Indicator value analysis at entry/exit (§30 Group 4: Month Performance breakdown).
            </div>
          </div>
        )}

        {/* Signal Analysis (§30 Group 5: Multi-pair Analysis stub) */}
        {activeTab === 'signalAnalysis' && (
          <div className="px-6 py-4 space-y-4">
            <div className="bg-bg-1 border border-border rounded-card p-3 text-center text-text-3 text-[12px]">
              Multi-pair correlation and cross-pair analysis (§30 Group 5: Multi-pair Analysis).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
