'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { fmtPct } from '@/lib/experiments';

interface ComparisonMetric {
  label: string;
  testA: string | number;
  testB: string | number;
  unit?: string;
  tooltip?: string;
}

const mockTests = [
  { id: 'test-2', name: 'CmaEs SortinoDaily Signals', type: 'Hyperopt', profit: 15.2 },
  { id: 'test-3', name: 'LightGBMReg DI PCA', type: 'FreqAI', profit: 13.8 },
  { id: 'test-7', name: 'Population-based CmaEs', type: 'Hyperopt', profit: 14.8 },
  { id: 'test-11', name: 'Ensemble LightGBM + XGBoost', type: 'FreqAI', profit: 14.2 },
];

const metricsData = {
  'test-2': {
    totalTrades: 163,
    winRate: 64.1,
    avgProfit: 0.08,
    totalProfit: 15.2,
    maxDD: 8.4,
    sharpe: 1.52,
    sortino: 2.14,
    calmar: 1.81,
    avgDuration: 2.1,
    profitFactor: 1.94,
  },
  'test-3': {
    totalTrades: 142,
    winRate: 61.8,
    avgProfit: 0.09,
    totalProfit: 13.8,
    maxDD: 8.2,
    sharpe: 1.41,
    sortino: 1.76,
    calmar: 1.68,
    avgDuration: 2.4,
    profitFactor: 1.82,
  },
  'test-7': {
    totalTrades: 171,
    winRate: 65.5,
    avgProfit: 0.087,
    totalProfit: 14.8,
    maxDD: 8.9,
    sharpe: 1.48,
    sortino: 2.08,
    calmar: 1.66,
    avgDuration: 1.9,
    profitFactor: 1.89,
  },
  'test-11': {
    totalTrades: 167,
    winRate: 64.7,
    avgProfit: 0.085,
    totalProfit: 14.2,
    maxDD: 7.9,
    sharpe: 1.58,
    sortino: 2.24,
    calmar: 1.80,
    avgDuration: 2.2,
    profitFactor: 1.91,
  },
};

export default function CompareOverlay({ onClose }: { onClose: () => void; strategy?: string }) {
  const [testAId, setTestAId] = useState('test-2');
  const [testBId, setTestBId] = useState('test-3');

  const testA = mockTests.find((t) => t.id === testAId);
  const testB = mockTests.find((t) => t.id === testBId);
  const dataA = metricsData[testAId as keyof typeof metricsData];
  const dataB = metricsData[testBId as keyof typeof metricsData];

  const metrics: ComparisonMetric[] = [
    {
      label: 'Total Trades',
      testA: dataA.totalTrades,
      testB: dataB.totalTrades,
      tooltip: 'Number of trades executed in the backtest period',
    },
    {
      label: 'Win Rate',
      testA: dataA.winRate.toFixed(1) + '%',
      testB: dataB.winRate.toFixed(1) + '%',
      tooltip: 'Percentage of profitable trades',
    },
    {
      label: 'Avg Profit/Trade',
      testA: dataA.avgProfit.toFixed(3) + '%',
      testB: dataB.avgProfit.toFixed(3) + '%',
      tooltip: 'Average profit per trade',
    },
    {
      label: 'Total Profit',
      testA: fmtPct(dataA.totalProfit),
      testB: fmtPct(dataB.totalProfit),
      tooltip: 'Total profit over entire backtest period',
    },
    {
      label: 'Max Drawdown',
      testA: fmtPct(-dataA.maxDD),
      testB: fmtPct(-dataB.maxDD),
      tooltip: 'Maximum peak-to-trough decline',
    },
    {
      label: 'Sharpe Ratio',
      testA: dataA.sharpe.toFixed(2),
      testB: dataB.sharpe.toFixed(2),
      tooltip: 'Risk-adjusted return metric',
    },
    {
      label: 'Sortino Ratio',
      testA: dataA.sortino.toFixed(2),
      testB: dataB.sortino.toFixed(2),
      tooltip: 'Downside risk-adjusted return',
    },
    {
      label: 'Calmar Ratio',
      testA: dataA.calmar.toFixed(2),
      testB: dataB.calmar.toFixed(2),
      tooltip: 'Return to maximum drawdown ratio',
    },
    {
      label: 'Avg Duration',
      testA: dataA.avgDuration.toFixed(1) + 'd',
      testB: dataB.avgDuration.toFixed(1) + 'd',
      tooltip: 'Average time in trade',
    },
    {
      label: 'Profit Factor',
      testA: dataA.profitFactor.toFixed(2),
      testB: dataB.profitFactor.toFixed(2),
      tooltip: 'Gross profit / gross loss',
    },
  ];

  const calculateDiff = (metric: ComparisonMetric): { diff: string; better: 'A' | 'B' | '-' } => {
    const aVal = parseFloat(metric.testA.toString());
    const bVal = parseFloat(metric.testB.toString());
    const isNegativeBetter =
      metric.label.includes('Drawdown') || metric.label.includes('Duration');

    if (metric.label === 'Avg Duration') {
      const diff = Math.abs(aVal - bVal);
      return {
        diff: (aVal > bVal ? '+' : '-') + diff.toFixed(1) + 'd',
        better: '-',
      };
    }

    const diff = aVal - bVal;
    const diffStr = diff > 0 ? '+' : '';
    const isBetter = isNegativeBetter ? diff < 0 : diff > 0;

    return {
      diff: diffStr + Math.abs(diff).toFixed(diff === 0 ? 1 : diff > 1 ? 1 : 2),
      better: isBetter ? 'A' : diff === 0 ? '-' : 'B',
    };
  };

  const betterCount = metrics.filter((m) => calculateDiff(m).better === 'A').length;
  const totalMetrics = metrics.length;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#06060b] to-[#0c0c14] text-[#f0f0f5]">
      {/* Header */}
      <div className="border-b border-[#1e1e30] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Compare Tests</h2>
          <button
            onClick={onClose}
            className="text-[#808098] hover:text-[#f0f0f5] transition"
          >
            ✕
          </button>
        </div>

        {/* Test Selection */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#808098] mb-2">
              Test A
            </label>
            <select
              value={testAId}
              onChange={(e) => setTestAId(e.target.value)}
              className="w-full bg-[#12121c] border border-[#1e1e30] rounded px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#6366f1]"
            >
              {mockTests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name} {fmtPct(test.profit)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end justify-center">
            <div className="text-[#808098] font-semibold text-lg">↔</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#808098] mb-2">
              Test B
            </label>
            <select
              value={testBId}
              onChange={(e) => setTestBId(e.target.value)}
              className="w-full bg-[#12121c] border border-[#1e1e30] rounded px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#6366f1]"
            >
              {mockTests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name} {fmtPct(test.profit)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Comparison Table */}
          <div className="bg-[#1a1a28] border border-[#1e1e30] rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-[#12121c] border-b border-[#1e1e30]">
                <tr>
                  <th className="px-4 py-3 text-left text-[#808098] font-semibold">
                    Metric
                  </th>
                  <th className="px-4 py-3 text-right text-[#f0f0f5] font-semibold">
                    {testA?.name}
                  </th>
                  <th className="px-4 py-3 text-right text-[#f0f0f5] font-semibold">
                    {testB?.name}
                  </th>
                  <th className="px-4 py-3 text-right text-[#808098] font-semibold">
                    Difference
                  </th>
                  <th className="px-4 py-3 text-center text-[#808098] font-semibold">
                    Better
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e30]">
                {metrics.map((metric, idx) => {
                  const { diff, better } = calculateDiff(metric);
                  const isABetter = better === 'A';

                  return (
                    <tr key={idx} className="hover:bg-[#12121c] transition">
                      <td className="px-4 py-3 text-[#c0c0d0] font-medium">
                        <Tooltip content={metric.tooltip || ''}>
                          <span className="border-b border-dashed border-[#808098] cursor-help">
                            {metric.label}
                          </span>
                        </Tooltip>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          isABetter ? 'text-green-400' : 'text-[#c0c0d0]'
                        }`}
                      >
                        {metric.testA}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          better === 'B' ? 'text-green-400' : 'text-[#c0c0d0]'
                        }`}
                      >
                        {metric.testB}
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${
                          diff.startsWith('-') ? 'text-red-400' : 'text-[#c0c0d0]'
                        }`}
                      >
                        {diff}
                      </td>
                      <td className="px-4 py-3 text-center text-[#808098]">
                        {better === 'A' && (
                          <span className="text-green-400 font-bold">→</span>
                        )}
                        {better === 'B' && (
                          <span className="text-green-400 font-bold">←</span>
                        )}
                        {better === '-' && <span>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="bg-[#12121c] border border-[#1e1e30] rounded-lg p-4 mb-6">
            <p className="text-[#f0f0f5] text-sm">
              <span className="font-semibold">{testA?.name}</span> is better in{' '}
              <span className="font-semibold text-green-400">{betterCount} of {totalMetrics}</span> metrics.
              Largest difference is in{' '}
              <span className="font-semibold">
                Sortino
              </span>{' '}
              ({testA?.name} has{' '}
              <span className="text-green-400 font-semibold">21.6% higher</span> Sortino ratio).
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-semibold rounded transition">
              → Verify Better Test
            </button>
            <button className="px-4 py-2 bg-[#12121c] border border-[#1e1e30] hover:border-[#6366f1] text-[#c0c0d0] hover:text-[#f0f0f5] text-sm font-semibold rounded transition flex items-center gap-2">
              <Plus size={16} /> Add Another Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
