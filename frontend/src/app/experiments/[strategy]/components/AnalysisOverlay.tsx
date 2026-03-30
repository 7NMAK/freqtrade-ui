'use client';

import React, { useState } from 'react';
import { Download, Search } from 'lucide-react';
import { fmtPct, profitColor } from '@/lib/experiments';

type TabType = 'enterTags' | 'exitReasons' | 'tradingList' | 'rejectedSignals' | 'indicatorAnalysis' | 'signalAnalysis';

interface EnterTagStat {
  tag: string;
  trades: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
  avgDuration: number;
  maxDD: number;
}

interface ExitReasonStat {
  reason: string;
  count: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
  avgDuration: number;
}

interface Trade {
  id: number;
  pair: string;
  isShort: boolean;
  stakeAmount: number;
  openRate: number;
  closeRate: number;
  feeOpen: number;
  feeClose: number;
  closeProfitAbs: number;
  enterTag: string;
  exitReason: string;
}

interface RejectedSignal {
  date: string;
  pair: string;
  signal: string;
  enterTag: string;
  reason: string;
}

const mockEnterTags: EnterTagStat[] = [
  {
    tag: 'BB_UP',
    trades: 89,
    winRate: 68.5,
    avgProfit: 0.12,
    totalProfit: 10.68,
    avgDuration: 1.8,
    maxDD: 4.2,
  },
  {
    tag: 'BB_DOWN',
    trades: 67,
    winRate: 58.2,
    avgProfit: 0.06,
    totalProfit: 4.02,
    avgDuration: 2.4,
    maxDD: 6.1,
  },
  {
    tag: 'RSI_OVERSOLD',
    trades: 34,
    winRate: 70.6,
    avgProfit: 0.11,
    totalProfit: 3.74,
    avgDuration: 1.5,
    maxDD: 3.8,
  },
];

const mockExitReasons: ExitReasonStat[] = [
  { reason: 'roi', count: 78, winRate: 100, avgProfit: 2.1, totalProfit: 163.8, avgDuration: 1.2 },
  { reason: 'trailing_stop_loss', count: 34, winRate: 82.4, avgProfit: 1.4, totalProfit: 47.6, avgDuration: 3.1 },
  { reason: 'stop_loss', count: 28, winRate: 0, avgProfit: -3.2, totalProfit: -89.6, avgDuration: 0.8 },
  { reason: 'exit_signal', count: 12, winRate: 58.3, avgProfit: 0.3, totalProfit: 3.6, avgDuration: 2.6 },
  { reason: 'force_exit', count: 4, winRate: 25, avgProfit: -1.1, totalProfit: -4.4, avgDuration: 4.2 },
];

const mockTrades: Trade[] = [
  { id: 1, pair: 'BTC/USDT', isShort: false, stakeAmount: 100, openRate: 45200, closeRate: 45850, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 62.5, enterTag: 'BB_UP', exitReason: 'roi' },
  { id: 2, pair: 'ETH/USDT', isShort: false, stakeAmount: 100, openRate: 2650, closeRate: 2710, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 58.2, enterTag: 'BB_UP', exitReason: 'roi' },
  { id: 3, pair: 'BTC/USDT', isShort: true, stakeAmount: 100, openRate: 45800, closeRate: 45200, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 55.8, enterTag: 'RSI_OVERSOLD', exitReason: 'trailing_stop_loss' },
  { id: 4, pair: 'SOL/USDT', isShort: false, stakeAmount: 100, openRate: 195, closeRate: 189, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: -62.2, enterTag: 'BB_DOWN', exitReason: 'stop_loss' },
  { id: 5, pair: 'ETH/USDT', isShort: false, stakeAmount: 100, openRate: 2700, closeRate: 2745, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 42.1, enterTag: 'BB_UP', exitReason: 'exit_signal' },
  { id: 6, pair: 'BTC/USDT', isShort: false, stakeAmount: 100, openRate: 45300, closeRate: 46200, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 88.9, enterTag: 'BB_UP', exitReason: 'roi' },
  { id: 7, pair: 'XRP/USDT', isShort: true, stakeAmount: 100, openRate: 2.85, closeRate: 2.78, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 71.5, enterTag: 'RSI_OVERSOLD', exitReason: 'trailing_stop_loss' },
  { id: 8, pair: 'ADA/USDT', isShort: false, stakeAmount: 100, openRate: 0.98, closeRate: 1.02, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 35.2, enterTag: 'BB_DOWN', exitReason: 'roi' },
  { id: 9, pair: 'BTC/USDT', isShort: false, stakeAmount: 100, openRate: 46000, closeRate: 45500, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: -52.5, enterTag: 'BB_DOWN', exitReason: 'stop_loss' },
  { id: 10, pair: 'ETH/USDT', isShort: false, stakeAmount: 100, openRate: 2600, closeRate: 2680, feeOpen: 0.1, feeClose: 0.1, closeProfitAbs: 76.8, enterTag: 'BB_UP', exitReason: 'roi' },
];

const mockRejectedSignals: RejectedSignal[] = [
  { date: '2026-03-29 14:32', pair: 'BTC/USDT', signal: 'BB_UP', enterTag: 'bb_entry', reason: 'Position size exceeds limit' },
  { date: '2026-03-29 12:15', pair: 'ETH/USDT', signal: 'RSI_OVERSOLD', enterTag: 'rsi_entry', reason: 'Max open trades reached' },
  { date: '2026-03-29 08:45', pair: 'SOL/USDT', signal: 'BB_UP', enterTag: 'bb_entry', reason: 'Insufficient balance' },
  { date: '2026-03-28 22:10', pair: 'XRP/USDT', signal: 'BB_DOWN', enterTag: 'bb_entry', reason: 'Cooldown period active' },
  { date: '2026-03-28 19:30', pair: 'ADA/USDT', signal: 'EMA_CROSS', enterTag: 'ema_entry', reason: 'Risk exceeds max_stake' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AnalysisOverlay({ onClose, strategy: _strategy }: { onClose: () => void; strategy: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('enterTags');

  const tabs: { id: TabType; label: string }[] = [
    { id: 'enterTags', label: 'Enter Tag Stats' },
    { id: 'exitReasons', label: 'Exit Reason Stats' },
    { id: 'tradingList', label: 'Trading List' },
    { id: 'rejectedSignals', label: 'Rejected Signals' },
    { id: 'indicatorAnalysis', label: 'Indicator Analysis' },
    { id: 'signalAnalysis', label: 'Signal Analysis' },
  ];

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#06060b] to-[#0c0c14] text-[#f0f0f5]">
      {/* Header */}
      <div className="border-b border-[#1e1e30] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Deep Analysis</h2>
          <button
            onClick={onClose}
            className="text-[#808098] hover:text-[#f0f0f5] transition"
          >
            ✕
          </button>
        </div>

        {/* Test Selector */}
        <div className="flex gap-3 items-center">
          <label className="text-xs font-semibold text-[#808098]">Test:</label>
          <select className="bg-[#12121c] border border-[#1e1e30] rounded px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#6366f1] flex-1 max-w-sm">
            <option>CmaEs SortinoDaily Signals</option>
            <option>LightGBMReg DI PCA</option>
            <option>Population-based CmaEs</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#1e1e30] px-6 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition border-b-2 ${
              activeTab === tab.id
                ? 'text-[#6366f1] border-[#6366f1]'
                : 'text-[#808098] border-transparent hover:text-[#f0f0f5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Enter Tag Stats */}
        {activeTab === 'enterTags' && (
          <div className="space-y-4">
            {/* Insight Box */}
            <div className="bg-[#12121c] border border-green-500/30 rounded-lg p-4 mb-6">
              <p className="text-[#f0f0f5] text-sm">
                <span className="text-green-400 font-semibold">BB_UP</span> signals are more profitable (68.5% win rate vs 58.2% for BB_DOWN)
              </p>
            </div>

            {/* Table */}
            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#12121c] border-b border-[#1e1e30]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Enter Tag
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Trades
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Win Rate
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Avg Profit%
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Total Profit
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Avg Duration
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Max DD
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e30]">
                  {mockEnterTags.map((tag, idx) => (
                    <tr key={idx} className="hover:bg-[#12121c] transition">
                      <td className="px-4 py-3 text-[#f0f0f5] font-medium">{tag.tag}</td>
                      <td className="px-4 py-3 text-right text-[#c0c0d0]">{tag.trades}</td>
                      <td className="px-4 py-3 text-right text-green-400 font-semibold">
                        {tag.winRate.toFixed(1)}%
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${profitColor(tag.avgProfit)}`}>
                        {tag.avgProfit > 0 ? '+' : ''}{tag.avgProfit.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${profitColor(tag.totalProfit)}`}>
                        {tag.totalProfit > 0 ? '+' : ''}{fmtPct(tag.totalProfit)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#c0c0d0]">
                        {tag.avgDuration.toFixed(1)}d
                      </td>
                      <td className="px-4 py-3 text-right text-red-400">
                        {fmtPct(-tag.maxDD)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Exit Reason Stats */}
        {activeTab === 'exitReasons' && (
          <div className="space-y-4">
            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#12121c] border-b border-[#1e1e30]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Exit Reason
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Count
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Win Rate
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Avg Profit%
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Total Profit
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Avg Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e30]">
                  {mockExitReasons.map((reason, idx) => (
                    <tr key={idx} className="hover:bg-[#12121c] transition">
                      <td className="px-4 py-3 text-[#f0f0f5] font-medium">
                        {reason.reason.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-right text-[#c0c0d0]">{reason.count}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {reason.winRate > 0 ? (
                          <span className="text-green-400">{reason.winRate.toFixed(1)}%</span>
                        ) : (
                          <span className="text-red-400">0%</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${profitColor(reason.avgProfit)}`}>
                        {reason.avgProfit > 0 ? '+' : ''}{reason.avgProfit.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${profitColor(reason.totalProfit)}`}>
                        {reason.totalProfit > 0 ? '+' : ''}{fmtPct(reason.totalProfit)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#c0c0d0]">
                        {reason.avgDuration.toFixed(1)}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trading List */}
        {activeTab === 'tradingList' && (
          <div className="space-y-4">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-[#808098]" />
                <input
                  type="text"
                  placeholder="Search trades..."
                  className="w-full bg-[#12121c] border border-[#1e1e30] rounded pl-9 pr-3 py-2 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <button className="px-3 py-2 bg-[#12121c] border border-[#1e1e30] hover:border-[#6366f1] rounded text-[#c0c0d0] hover:text-[#f0f0f5] transition text-xs font-semibold flex items-center gap-2">
                <Download size={16} /> Export CSV
              </button>
            </div>

            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#12121c] border-b border-[#1e1e30]">
                  <tr>
                    <th className="px-3 py-3 text-left text-[#808098] font-semibold">ID</th>
                    <th className="px-3 py-3 text-left text-[#808098] font-semibold">Pair</th>
                    <th className="px-3 py-3 text-center text-[#808098] font-semibold">Type</th>
                    <th className="px-3 py-3 text-right text-[#808098] font-semibold">Stake</th>
                    <th className="px-3 py-3 text-right text-[#808098] font-semibold">Open Rate</th>
                    <th className="px-3 py-3 text-right text-[#808098] font-semibold">Close Rate</th>
                    <th className="px-3 py-3 text-right text-[#808098] font-semibold">Profit Abs</th>
                    <th className="px-3 py-3 text-left text-[#808098] font-semibold">Enter Tag</th>
                    <th className="px-3 py-3 text-left text-[#808098] font-semibold">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e30]">
                  {mockTrades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-[#12121c] transition">
                      <td className="px-3 py-2 text-[#c0c0d0]">{trade.id}</td>
                      <td className="px-3 py-2 text-[#f0f0f5] font-semibold">{trade.pair}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            trade.isShort
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {trade.isShort ? 'SHORT' : 'LONG'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[#c0c0d0]">${trade.stakeAmount}</td>
                      <td className="px-3 py-2 text-right text-[#c0c0d0]">
                        {trade.openRate.toFixed(4)}
                      </td>
                      <td className="px-3 py-2 text-right text-[#c0c0d0]">
                        {trade.closeRate.toFixed(4)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${profitColor(trade.closeProfitAbs)}`}>
                        {trade.closeProfitAbs > 0 ? '+' : ''}{fmtPct(trade.closeProfitAbs / 100)}
                      </td>
                      <td className="px-3 py-2 text-[#c0c0d0]">{trade.enterTag}</td>
                      <td className="px-3 py-2 text-[#c0c0d0]">
                        {trade.exitReason.replace(/_/g, ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-[#808098]">
              Showing 1-10 of 156 trades • <button className="text-[#6366f1] hover:text-[#7578f5]">Show more</button>
            </div>
          </div>
        )}

        {/* Rejected Signals */}
        {activeTab === 'rejectedSignals' && (
          <div className="space-y-4">
            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#12121c] border-b border-[#1e1e30]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Pair
                    </th>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Signal
                    </th>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Enter Tag
                    </th>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Rejection Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e30]">
                  {mockRejectedSignals.map((signal, idx) => (
                    <tr key={idx} className="hover:bg-[#12121c] transition">
                      <td className="px-4 py-3 text-[#c0c0d0]">{signal.date}</td>
                      <td className="px-4 py-3 text-[#f0f0f5] font-semibold">{signal.pair}</td>
                      <td className="px-4 py-3 text-[#c0c0d0]">{signal.signal}</td>
                      <td className="px-4 py-3 text-[#c0c0d0]">{signal.enterTag}</td>
                      <td className="px-4 py-3 text-amber-400 font-medium">
                        {signal.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Indicator Analysis */}
        {activeTab === 'indicatorAnalysis' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
              <h3 className="text-[#808098] text-xs font-semibold uppercase mb-3">
                RSI at Entry
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Average</span>
                  <span className="text-[#f0f0f5] font-semibold text-lg">32.4</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Min</span>
                  <span className="text-[#c0c0d0] font-medium">18</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Max</span>
                  <span className="text-[#c0c0d0] font-medium">48</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
              <h3 className="text-[#808098] text-xs font-semibold uppercase mb-3">
                BB Width at Entry
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Average</span>
                  <span className="text-[#f0f0f5] font-semibold text-lg">0.045</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Min</span>
                  <span className="text-[#c0c0d0] font-medium">0.012</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Max</span>
                  <span className="text-[#c0c0d0] font-medium">0.089</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
              <h3 className="text-[#808098] text-xs font-semibold uppercase mb-3">
                EMA Direction
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Bullish Entries</span>
                  <span className="text-green-400 font-semibold text-lg">78%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Bearish Entries</span>
                  <span className="text-red-400 font-semibold text-lg">22%</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
              <h3 className="text-[#808098] text-xs font-semibold uppercase mb-3">
                Volume Relative
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#c0c0d0] text-sm">Average Multiplier</span>
                  <span className="text-[#f0f0f5] font-semibold text-lg">1.4x</span>
                </div>
                <div className="text-[#808098] text-xs mt-3">
                  Indicating above-average volume at entries
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signal Analysis */}
        {activeTab === 'signalAnalysis' && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
                <div className="text-[#808098] text-xs mb-2">Total Signals</div>
                <div className="text-3xl font-bold text-[#f0f0f5]">342</div>
              </div>
              <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
                <div className="text-[#808098] text-xs mb-2">Executed</div>
                <div className="text-3xl font-bold text-green-400">156</div>
              </div>
              <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
                <div className="text-[#808098] text-xs mb-2">Rejected</div>
                <div className="text-3xl font-bold text-amber-400">142</div>
              </div>
              <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg p-4">
                <div className="text-[#808098] text-xs mb-2">No Action</div>
                <div className="text-3xl font-bold text-[#808098]">44</div>
              </div>
            </div>

            {/* Signal Breakdown Table */}
            <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#12121c] border-b border-[#1e1e30]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                      Signal Type
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Generated
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Executed
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Exec Rate
                    </th>
                    <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                      Avg Profit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e30]">
                  <tr className="hover:bg-[#12121c] transition">
                    <td className="px-4 py-3 text-[#f0f0f5] font-medium">enter_long</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">198</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">89</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">44.9%</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">
                      +0.12%
                    </td>
                  </tr>
                  <tr className="hover:bg-[#12121c] transition">
                    <td className="px-4 py-3 text-[#f0f0f5] font-medium">enter_short</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">144</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">67</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">46.5%</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">
                      +0.06%
                    </td>
                  </tr>
                  <tr className="hover:bg-[#12121c] transition">
                    <td className="px-4 py-3 text-[#f0f0f5] font-medium">exit_long</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">89</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">89</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">
                      100%
                    </td>
                    <td className="px-4 py-3 text-right text-[#808098]">—</td>
                  </tr>
                  <tr className="hover:bg-[#12121c] transition">
                    <td className="px-4 py-3 text-[#f0f0f5] font-medium">exit_short</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">67</td>
                    <td className="px-4 py-3 text-right text-[#c0c0d0]">67</td>
                    <td className="px-4 py-3 text-right text-green-400 font-semibold">
                      100%
                    </td>
                    <td className="px-4 py-3 text-right text-[#808098]">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
