'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';

interface ExperimentSource {
  id: string;
  name: string;
  description: string;
  profit: number;
}

interface VerificationResult {
  status: 'PASSED' | 'FAILED' | 'WARNING';
  metrics: {
    name: string;
    trainingValue: string | number;
    newDataValue: string | number;
    difference: string;
    grade: 'pass' | 'warning' | 'fail';
  }[];
}

interface LookaheadResult {
  status: 'PASS' | 'FAIL';
  checks: {
    name: string;
    result: 'YES' | 'NO';
    explanation: string;
  }[];
}

interface RecursiveResult {
  status: 'PASS' | 'FAIL';
  message: string;
}

const mockExperiments: ExperimentSource[] = [
  {
    id: 'exp-001',
    name: 'CmaEs SortinoDaily — Signals Only',
    description: 'Best hyperparameter combination',
    profit: 15.2,
  },
  {
    id: 'exp-002',
    name: 'TPE Sharpe',
    description: 'Alternative with good consistency',
    profit: 12.1,
  },
  {
    id: 'exp-003',
    name: 'LightGBMReg DI PCA',
    description: 'Machine learning model variant',
    profit: 13.8,
  },
];

const mockVerificationResult: VerificationResult = {
  status: 'PASSED',
  metrics: [
    { name: 'Total Trades', trainingValue: 156, newDataValue: 142, difference: '-9.0%', grade: 'pass' },
    { name: 'Win Rate', trainingValue: '64.1%', newDataValue: '61.8%', difference: '-2.3pp', grade: 'pass' },
    { name: 'Profit%', trainingValue: '15.2%', newDataValue: '11.3%', difference: '-25.7%', grade: 'pass' },
    { name: 'Max Drawdown', trainingValue: '8.4%', newDataValue: '9.8%', difference: '+16.7%', grade: 'pass' },
    { name: 'Sharpe', trainingValue: '1.52', newDataValue: '1.28', difference: '-15.8%', grade: 'pass' },
    { name: 'Sortino', trainingValue: '2.14', newDataValue: '1.76', difference: '-17.8%', grade: 'pass' },
    { name: 'Avg Duration', trainingValue: '2.1d', newDataValue: '2.4d', difference: '+14.3%', grade: 'warning' },
  ],
};

const mockLookaheadResult: LookaheadResult = {
  status: 'PASS',
  checks: [
    {
      name: 'Looks ahead?',
      result: 'NO',
      explanation: 'Strategy does not use future data',
    },
    {
      name: 'Problem entry signals',
      result: 'NO',
      explanation: 'No entry signals use future data',
    },
    {
      name: 'Problem exit signals',
      result: 'NO',
      explanation: 'No exit signals use future data',
    },
    {
      name: 'Problem indicators',
      result: 'NO',
      explanation: 'No indicators use future data',
    },
  ],
};

const mockRecursiveResult: RecursiveResult = {
  status: 'PASS',
  message: 'No recursive dependencies — indicators are independent',
};

const VerdictBanner: React.FC<{ status: 'PASSED' | 'FAILED' | 'WARNING' }> = ({ status }) => {
  const config = {
    PASSED: {
      icon: '✅',
      text: 'PASSED',
      description: 'Strategy performs well on new data — ready for Paper Trading',
      bgColor: 'bg-[#062b1b]',
      borderColor: 'border-[#22c55e]/30',
      textColor: 'text-[#22c55e]',
    },
    FAILED: {
      icon: '❌',
      text: 'FAILED',
      description: 'Strategy performance degraded significantly on new data',
      bgColor: 'bg-[#2b0606]',
      borderColor: 'border-[#ef4444]/30',
      textColor: 'text-[#ef4444]',
    },
    WARNING: {
      icon: '⚠️',
      text: 'WARNING',
      description: 'Strategy passed but with some concerns',
      bgColor: 'bg-[#2b2006]',
      borderColor: 'border-[#f59e0b]/30',
      textColor: 'text-[#f59e0b]',
    },
  };

  const cfg = config[status];

  return (
    <div className={`${cfg.bgColor} border ${cfg.borderColor} rounded-lg p-6 mb-6`}>
      <div className="flex items-center gap-4">
        <div className="text-4xl">{cfg.icon}</div>
        <div className="flex-1">
          <div className={`text-lg font-bold ${cfg.textColor}`}>{cfg.text}</div>
          <div className="text-sm text-text-1 mt-1">{cfg.description}</div>
        </div>
      </div>
    </div>
  );
};

const MetricsTable: React.FC<{ metrics: VerificationResult['metrics'] }> = ({ metrics }) => {
  const gradeIcon = {
    pass: '✓',
    warning: '⚠',
    fail: '✗',
  };

  const gradeColor = {
    pass: 'text-[#22c55e]',
    warning: 'text-[#f59e0b]',
    fail: 'text-[#ef4444]',
  };

  return (
    <div className="bg-bg-2 border border-[#1e1e30] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead className="bg-bg-3 border-b border-[#1e1e30]">
            <tr>
              <th className="px-4 py-3 text-left text-text-2 font-semibold">Metric</th>
              <th className="px-4 py-3 text-center text-text-2 font-semibold">
                <Tooltip content="Data strategy was trained and optimized on">
                  <span>Training Data</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-center text-text-2 font-semibold">
                <Tooltip content="Data strategy has never seen — the real test">
                  <span>New Data</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-center text-text-2 font-semibold">Difference</th>
              <th className="px-4 py-3 text-center text-text-2 font-semibold">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e30]">
            {metrics.map((metric, idx) => (
              <tr key={idx} className="hover:bg-bg-3 transition-colors">
                <td className="px-4 py-3 text-text-0 font-semibold">{metric.name}</td>
                <td className="px-4 py-3 text-center text-text-1">{metric.trainingValue}</td>
                <td className="px-4 py-3 text-center text-accent font-semibold">{metric.newDataValue}</td>
                <td className="px-4 py-3 text-center text-text-2">{metric.difference}</td>
                <td className={`px-4 py-3 text-center font-bold ${gradeColor[metric.grade]}`}>
                  {gradeIcon[metric.grade]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const LookaheadTable: React.FC<{ checks: LookaheadResult['checks'] }> = ({ checks }) => {
  return (
    <div className="bg-bg-2 border border-[#1e1e30] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead className="bg-bg-3 border-b border-[#1e1e30]">
            <tr>
              <th className="px-4 py-3 text-left text-text-2 font-semibold">Check</th>
              <th className="px-4 py-3 text-left text-text-2 font-semibold">Result</th>
              <th className="px-4 py-3 text-left text-text-2 font-semibold">Explanation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e30]">
            {checks.map((check, idx) => (
              <tr key={idx} className="hover:bg-bg-3 transition-colors">
                <td className="px-4 py-3 text-text-0 font-semibold">{check.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-1 bg-[#062b1b] border border-[#22c55e]/30 rounded text-[#22c55e] font-semibold">
                    {check.result === 'NO' ? '✅ NO' : '❌ YES'}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-2">{check.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function ValidationTab({}: { strategy?: string }) {
  const [sourceExperiment, setSourceExperiment] = useState(mockExperiments[0].id);
  const [verificationName, setVerificationName] = useState('OOS 2025 verify CmaEs');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2024-01-01T00:00:00Z');
  const [endDate, setEndDate] = useState('2025-01-01T00:00:00Z');
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(true); // Set true to show mock results
  const [lookaheadRun, setLookaheadRun] = useState(true);
  const [recursiveRun, setRecursiveRun] = useState(true);

  const selectedExperiment = mockExperiments.find((e) => e.id === sourceExperiment)!;

  const handleRunVerification = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasRun(true);
    }, 2500);
  };

  const handleRunLookahead = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setLookaheadRun(true);
    }, 1500);
  };

  const handleRunRecursive = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setRecursiveRun(true);
    }, 1500);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* SECTION 1: Verification Backtest */}
      <section>
        <h2 className="text-base font-bold text-text-0 mb-6">Verification Backtest</h2>

        <div className="space-y-5 mb-6">
          {/* Source Experiment */}
          <div>
            <label className="block text-2xs font-semibold text-text-1 mb-2">Source Experiment</label>
            <select
              value={sourceExperiment}
              onChange={(e) => setSourceExperiment(e.target.value)}
              className="w-full px-3 py-2 bg-bg-3 border border-[#1e1e30] rounded-md text-2xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent transition-colors"
            >
              {mockExperiments.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.name} — {exp.profit > 0 ? '+' : ''}{exp.profit.toFixed(1)}% profit
                </option>
              ))}
            </select>
            <p className="text-2xs text-text-3 mt-2">{selectedExperiment.description}</p>
          </div>

          {/* Verification Name */}
          <div>
            <label className="block text-2xs font-semibold text-text-1 mb-2">Verification Name</label>
            <input
              type="text"
              value={verificationName}
              onChange={(e) => setVerificationName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-3 border border-[#1e1e30] rounded-md text-2xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g., OOS 2025 verify CmaEs"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-2xs font-semibold text-text-1 mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-bg-3 border border-[#1e1e30] rounded-md text-2xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent transition-colors resize-none"
              rows={2}
              placeholder="Add notes about this verification test"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-2xs font-semibold text-text-1 mb-2">Start Date</label>
              <input
                type="datetime-local"
                value={startDate.slice(0, 16)}
                onChange={(e) => setStartDate(e.target.value + 'Z')}
                className="w-full px-3 py-2 bg-bg-3 border border-[#1e1e30] rounded-md text-2xs text-text-0 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-text-1 mb-2">End Date</label>
              <input
                type="datetime-local"
                value={endDate.slice(0, 16)}
                onChange={(e) => setEndDate(e.target.value + 'Z')}
                className="w-full px-3 py-2 bg-bg-3 border border-[#1e1e30] rounded-md text-2xs text-text-0 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Warning Box */}
          <div className="bg-[#2b2006] border border-[#f59e0b]/30 rounded-lg p-4 flex gap-3">
            <AlertCircle size={18} className="text-[#f59e0b] flex-shrink-0 mt-0.5" />
            <div className="text-2xs text-text-2">
              <p className="font-semibold text-[#f59e0b] mb-1">Use a DIFFERENT time period from training!</p>
              <p>
                Training period for selected test: <span className="text-text-0 font-semibold">2022-01-01 → 2024-01-01</span>
              </p>
              <p className="mt-1">
                Recommended verification period:{' '}
                <span className="text-accent font-semibold">2024-01-01 → 2025-01-01</span>
              </p>
              <Tooltip content="If you test on the same data strategy was trained on, verification is meaningless — like asking a student answers to the same test they already solved">
                <button className="text-accent hover:text-[#5558e3] mt-2 text-2xs font-semibold">
                  Why does this matter?
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Readonly Optimized Parameters */}
          <div className="bg-bg-3 border border-[#1e1e30] rounded-lg p-4">
            <h4 className="text-2xs font-semibold text-text-1 mb-3">Optimized Parameters (from selected source)</h4>
            <div className="grid grid-cols-2 gap-4 text-2xs">
              <div className="bg-bg-2 border border-[#1e1e30] rounded p-3">
                <span className="text-text-2">Sampler:</span>
                <p className="text-text-0 font-semibold mt-1">CmaEs</p>
              </div>
              <div className="bg-bg-2 border border-[#1e1e30] rounded p-3">
                <span className="text-text-2">Loss Function:</span>
                <p className="text-text-0 font-semibold mt-1">SortinoDaily</p>
              </div>
              <div className="bg-bg-2 border border-[#1e1e30] rounded p-3">
                <span className="text-text-2">Entry Signals:</span>
                <p className="text-text-0 font-semibold mt-1">Signals Only</p>
              </div>
              <div className="bg-bg-2 border border-[#1e1e30] rounded p-3">
                <span className="text-text-2">Exit Type:</span>
                <p className="text-text-0 font-semibold mt-1">Market Close</p>
              </div>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunVerification}
            disabled={isRunning}
            className="w-full px-4 py-3 bg-accent hover:bg-[#5558e3] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <div className="animate-spin">
                  <Zap size={14} />
                </div>
                Running Verification Backtest...
              </>
            ) : (
              <>
                <Zap size={14} />
                Run Verification Backtest
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {hasRun && (
          <div className="space-y-6">
            <VerdictBanner status={mockVerificationResult.status} />

            <div>
              <h4 className="text-sm font-semibold text-text-0 mb-3">Comparison: Training vs New Data</h4>
              <MetricsTable metrics={mockVerificationResult.metrics} />
            </div>

            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 bg-accent hover:bg-[#5558e3] text-white font-semibold text-xs rounded-lg transition-colors">
                Promote to Version ★
              </button>
              <button className="flex-1 px-4 py-3 bg-[#22c55e] hover:bg-[#16a34a] text-[#0c0c14] font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2">
                <CheckCircle size={14} />
                → Paper Trading
              </button>
            </div>

            <div className="bg-[#062b1b] border border-[#22c55e]/20 rounded-lg p-4 text-2xs text-text-2">
              <p className="text-[#22c55e] font-semibold mb-1">Note on Paper Trading</p>
              <p>
                The <span className="text-[#22c55e] font-semibold">→ Paper Trading</span> button appears ONLY here, after PASS verdict. This is the only path to Paper Trading in the entire application.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: Lookahead Analysis */}
      <section className="border-t border-[#1e1e30] pt-8">
        <h2 className="text-base font-bold text-text-0 mb-3">Lookahead Analysis (§21)</h2>
        <p className="text-2xs text-text-2 mb-6">
          <span className="text-text-1 font-semibold">Checks if strategy &apos;cheats&apos;:</span> Does it accidentally use future data for decisions? E.g., does it use tomorrow&apos;s price to decide what to buy today — which is impossible in real trading.
        </p>

        <button
          onClick={handleRunLookahead}
          disabled={isRunning}
          className="w-full px-4 py-3 bg-bg-3 border border-[#1e1e30] hover:bg-bg-2 text-text-0 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 mb-6"
        >
          {isRunning ? (
            <>
              <div className="animate-spin">
                <Zap size={14} />
              </div>
              Running Lookahead Analysis...
            </>
          ) : (
            <>
              <Zap size={14} />
              Run Lookahead Analysis
            </>
          )}
        </button>

        {lookaheadRun && (
          <div className="space-y-4">
            <div className="bg-[#062b1b] border border-[#22c55e]/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="text-sm font-bold text-[#22c55e]">PASS</div>
                  <div className="text-2xs text-text-2">Strategy does not use future data — all clear</div>
                </div>
              </div>
            </div>

            <LookaheadTable checks={mockLookaheadResult.checks} />
          </div>
        )}
      </section>

      {/* SECTION 3: Recursive Analysis */}
      <section className="border-t border-[#1e1e30] pt-8">
        <h2 className="text-base font-bold text-text-0 mb-3">Recursive Analysis (§22)</h2>
        <p className="text-2xs text-text-2 mb-6">
          <span className="text-text-1 font-semibold">Checks for circular dependencies:</span> Do indicators depend on each other in a loop — which can create unstable signals?
        </p>

        <button
          onClick={handleRunRecursive}
          disabled={isRunning}
          className="w-full px-4 py-3 bg-bg-3 border border-[#1e1e30] hover:bg-bg-2 text-text-0 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 mb-6"
        >
          {isRunning ? (
            <>
              <div className="animate-spin">
                <Zap size={14} />
              </div>
              Running Recursive Analysis...
            </>
          ) : (
            <>
              <Zap size={14} />
              Run Recursive Analysis
            </>
          )}
        </button>

        {recursiveRun && (
          <div className="bg-[#062b1b] border border-[#22c55e]/30 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <span className="text-3xl">✅</span>
              <div className="flex-1">
                <div className="text-sm font-bold text-[#22c55e] mb-1">PASS</div>
                <div className="text-2xs text-text-2">{mockRecursiveResult.message}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Recommended Order Note */}
      <div className="border-t border-[#1e1e30] pt-8 bg-bg-3 border border-[#1e1e30] rounded-lg p-4">
        <h4 className="text-2xs font-semibold text-text-1 mb-2">Recommended Order</h4>
        <p className="text-2xs text-text-2">
          <span className="text-text-0 font-semibold">1)</span> Lookahead Analysis (fast) →{' '}
          <span className="text-text-0 font-semibold">2)</span> Recursive Analysis (fast) →{' '}
          <span className="text-text-0 font-semibold">3)</span> Verification Backtest (slower)
        </p>
      </div>
    </div>
  );
}
