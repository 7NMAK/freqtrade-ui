'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { fmtPct } from '@/lib/experiments';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

interface ComparisonMetric {
  label: string;
  testA: string | number;
  testB: string | number;
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
    totalTrades: 156,
    winRate: 64.1,
    avgProfit: 0.098,
    totalProfit: 15.2,
    maxDD: 8.4,
    sharpe: 1.52,
    sortino: 2.14,
    calmar: 1.81,
    avgDuration: '2d 4h',
    profitFactor: 2.43,
  },
  'test-3': {
    totalTrades: 178,
    winRate: 59.6,
    avgProfit: 0.077,
    totalProfit: 13.8,
    maxDD: 9.2,
    sharpe: 1.41,
    sortino: 1.89,
    calmar: 1.50,
    avgDuration: '2d 1h',
    profitFactor: 2.18,
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
    avgDuration: '1d 22h',
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
    avgDuration: '2d 2h',
    profitFactor: 1.91,
  },
};

export default function CompareOverlay({ onClose }: { onClose: () => void; strategy?: string }) {
  const [testAId, setTestAId] = useState('test-2');
  const [testBId, setTestBId] = useState('test-3');

  const testA = mockTests.find((t) => t.id === testAId);
  const dataA = metricsData[testAId as keyof typeof metricsData];
  const dataB = metricsData[testBId as keyof typeof metricsData];

  const metrics: ComparisonMetric[] = [
    {
      label: 'Trades',
      testA: dataA.totalTrades,
      testB: dataB.totalTrades,
      tooltip: 'Total number of completed trades',
    },
    {
      label: 'Win Rate',
      testA: dataA.winRate.toFixed(1) + '%',
      testB: dataB.winRate.toFixed(1) + '%',
      tooltip: 'Percentage of trades that were profitable',
    },
    {
      label: 'Avg Profit/Trade',
      testA: '+' + dataA.avgProfit.toFixed(3) + '%',
      testB: '+' + dataB.avgProfit.toFixed(3) + '%',
      tooltip: 'Average profit per trade',
    },
    {
      label: 'Total Profit%',
      testA: fmtPct(dataA.totalProfit),
      testB: fmtPct(dataB.totalProfit),
      tooltip: 'Total return on initial capital',
    },
    {
      label: 'Max Drawdown',
      testA: fmtPct(-dataA.maxDD),
      testB: fmtPct(-dataB.maxDD),
      tooltip: 'Largest peak-to-trough decline in equity',
    },
    {
      label: 'Sharpe Ratio',
      testA: dataA.sharpe.toFixed(2),
      testB: dataB.sharpe.toFixed(2),
      tooltip: 'Return per unit of volatility (higher = better)',
    },
    {
      label: 'Sortino Ratio',
      testA: dataA.sortino.toFixed(2),
      testB: dataB.sortino.toFixed(2),
      tooltip: 'Return per unit of downside volatility (better for traders)',
    },
    {
      label: 'Calmar Ratio',
      testA: dataA.calmar.toFixed(2),
      testB: dataB.calmar.toFixed(2),
      tooltip: 'Return divided by max drawdown (higher = better)',
    },
    {
      label: 'Avg Trade Duration',
      testA: dataA.avgDuration,
      testB: dataB.avgDuration,
      tooltip: 'How long trades stay open on average',
    },
    {
      label: 'Profit Factor',
      testA: dataA.profitFactor.toFixed(2),
      testB: dataB.profitFactor.toFixed(2),
      tooltip: 'Gross profit divided by gross loss (higher = better, >2 is excellent)',
    },
  ];

  const calculateDiff = (metric: ComparisonMetric): { diff: string; better: 'A' | 'B' | '-' } => {
    const aVal = parseFloat(metric.testA.toString());
    const bVal = parseFloat(metric.testB.toString());

    // Special handling for duration
    if (metric.label === 'Avg Trade Duration') {
      const aParts = dataA.avgDuration.split(' ');
      const bParts = dataB.avgDuration.split(' ');
      const aHours = parseInt(aParts[0]) * 24 + parseInt(bParts[1]);
      const bHours = parseInt(bParts[0]) * 24 + parseInt(bParts[1]);
      const diff = Math.abs(aHours - bHours);
      const h = diff % 24;
      const d = Math.floor(diff / 24);
      const faster = aHours < bHours ? 'A' : 'B';
      return {
        diff: d > 0 ? `-${d}d ${h}h ${faster === 'A' ? 'faster' : 'slower'}` : `-${h}h ${faster === 'A' ? 'faster' : 'slower'}`,
        better: faster,
      };
    }

    const isNegativeBetter = metric.label.includes('Drawdown');
    const diff = aVal - bVal;

    if (metric.label === 'Trades') {
      return {
        diff: (diff > 0 ? '+' : '') + diff.toFixed(0),
        better: diff > 0 ? 'A' : diff < 0 ? 'B' : '-',
      };
    }

    if (metric.label === 'Win Rate') {
      const pp = Math.abs(diff).toFixed(1);
      return {
        diff: (diff > 0 ? '+' : '') + pp + 'pp',
        better: diff > 0 ? 'A' : diff < 0 ? 'B' : '-',
      };
    }

    const isBetter = isNegativeBetter ? diff < 0 : diff > 0;
    const diffStr = diff > 0 ? '+' : diff < 0 ? '' : '+';
    const decimals = Math.abs(diff) > 1 ? 1 : 2;

    return {
      diff: diffStr + Math.abs(diff).toFixed(decimals) + (metric.label.includes('Ratio') ? '' : 'pp'),
      better: isBetter ? 'A' : diff === 0 ? '-' : 'B',
    };
  };

  const betterCount = metrics.filter((m) => calculateDiff(m).better === 'A').length;

  return (
    <div className="flex h-full w-full flex-col bg-bg-0 text-text-0">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold">⚖️ Compare Tests</h2>
          <button
            onClick={onClose}
            className="text-text-2 hover:text-text-0 transition text-lg"
          >
            ✕
          </button>
        </div>

        {/* Test Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Test A (Baseline)</label>
            <select
              value={testAId}
              onChange={(e) => setTestAId(e.target.value)}
              className={SELECT}
            >
              {mockTests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name} · {fmtPct(test.profit)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>Test B (Comparison)</label>
            <select
              value={testBId}
              onChange={(e) => setTestBId(e.target.value)}
              className={SELECT}
            >
              {mockTests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name} · {fmtPct(test.profit)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Run Comparison Button */}
        <button className="w-full mt-4 h-[34px] px-4 bg-accent hover:bg-[#5558e3] text-white text-[12px] font-semibold rounded-btn transition">
          ⚖️ Run Comparison
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Summary Card */}
          <div className="bg-bg-1 border border-border rounded-card p-4">
            <p className="text-[12px] text-text-1">
              <strong>{testA?.name}</strong> is better in{' '}
              <span className="text-green font-semibold">{betterCount} of {metrics.length}</span> metrics<br />
              <span className="text-[11px] text-text-2">
                Largest difference:{' '}
                <Tooltip content="Return per unit of volatility (higher = better)">
                  <span className="border-b border-dashed border-text-2 cursor-help">Sharpe ratio</span>
                </Tooltip>{' '}
                (Test A: 1.52 vs Test B: 1.41 — gap of +0.11)
              </span>
            </p>
          </div>

          {/* Comparison Table */}
          <div className="border border-border rounded-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-bg-2 border-b border-border">
                  <tr>
                    <th className="py-2 px-[10px] text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                      Metric
                    </th>
                    <th className="py-2 px-[10px] text-center text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                      Test A
                    </th>
                    <th className="py-2 px-[10px] text-center text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                      Test B
                    </th>
                    <th className="py-2 px-[10px] text-center text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                      Difference
                    </th>
                    <th className="py-2 px-[10px] text-center text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                      Winner
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric, idx) => {
                    const { diff, better } = calculateDiff(metric);
                    const isABetter = better === 'A';
                    const isBBetter = better === 'B';

                    return (
                      <tr key={idx} className="border-b border-border/50 hover:bg-bg-2/50 transition">
                        <td className="py-2 px-[10px] text-text-1">
                          <Tooltip content={metric.tooltip || ''}>
                            <span className="border-b border-dashed border-text-2 cursor-help">
                              {metric.label}
                            </span>
                          </Tooltip>
                        </td>
                        <td
                          className={`py-2 px-[10px] text-center font-semibold ${
                            isABetter ? 'text-green' : isBBetter ? 'text-text-1' : 'text-text-1'
                          }`}
                        >
                          {metric.testA}
                        </td>
                        <td
                          className={`py-2 px-[10px] text-center font-semibold ${
                            isBBetter ? 'text-green' : isABetter ? 'text-text-1' : 'text-text-1'
                          }`}
                        >
                          {metric.testB}
                        </td>
                        <td
                          className={`py-2 px-[10px] text-center ${
                            diff.includes('-') && !diff.includes('faster') ? 'text-red' : 'text-green'
                          }`}
                        >
                          {diff}
                        </td>
                        <td className="py-2 px-[10px] text-center text-[12px]">
                          {better === 'A' && <span className="text-green font-bold">→ A</span>}
                          {better === 'B' && <span className="text-green font-bold">→ B</span>}
                          {better === '-' && <span className="text-text-2">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button className="flex-1 h-[34px] px-4 bg-accent hover:bg-[#5558e3] text-white text-[12px] font-semibold rounded-btn transition flex items-center justify-center gap-2">
              → Verify Winner (Test A)
            </button>
            <button className="flex-1 h-[34px] px-4 bg-bg-2 border border-border hover:border-accent text-text-0 text-[12px] font-semibold rounded-btn transition flex items-center justify-center gap-2">
              <Plus size={14} /> Add Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
