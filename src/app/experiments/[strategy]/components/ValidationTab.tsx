'use client';

import { useState } from 'react';
import Tooltip from '@/components/ui/Tooltip';

// Design system constants
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// Mock data for source experiments (kept for dropdown)
const mockExperiments = [
  {
    id: 'exp-001',
    name: 'CmaEs · SortinoDaily · +15.2%',
    sampler: 'CmaEs',
    lossFunction: 'SortinoDaily',
    entrySignals: 'Signals Only',
    exitType: 'Market Close',
  },
  {
    id: 'exp-002',
    name: 'TPE · Sharpe · +12.1%',
    sampler: 'TPE',
    lossFunction: 'Sharpe',
    entrySignals: 'Signals Only',
    exitType: 'Market Close',
  },
  {
    id: 'exp-003',
    name: 'LightGBM+DI · +13.8%',
    sampler: 'CmaEs',
    lossFunction: 'MultiMetric',
    entrySignals: 'Signals Only',
    exitType: 'Market Close',
  },
  {
    id: 'exp-004',
    name: 'PSO · Calmar · +11.9%',
    sampler: 'PSO',
    lossFunction: 'Calmar',
    entrySignals: 'Signals Only',
    exitType: 'Market Close',
  },
  {
    id: 'exp-005',
    name: 'SKOPT · Profit Factor · +14.2%',
    sampler: 'SKOPT',
    lossFunction: 'ProfitDrawDown',
    entrySignals: 'Signals Only',
    exitType: 'Market Close',
  },
];

export default function ValidationTab({}: { strategy?: string }) {
  const [sourceExperiment, setSourceExperiment] = useState('exp-001');
  const [verificationName, setVerificationName] = useState('OOS 2025 verify CmaEs');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2026-01-01');
  const [isRunning, setIsRunning] = useState(false);
  const [hasVerificationRun, setHasVerificationRun] = useState(false);
  const [hasLookaheadRun, setHasLookaheadRun] = useState(false);
  const [hasRecursiveRun, setHasRecursiveRun] = useState(false);

  const selectedExp = mockExperiments.find((e) => e.id === sourceExperiment);

  const handleRunVerification = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasVerificationRun(true);
    }, 500);
  };

  const handleRunLookahead = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasLookaheadRun(true);
    }, 500);
  };

  const handleRunRecursive = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasRecursiveRun(true);
    }, 500);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* ===== SECTION 1: VERIFICATION BACKTEST ===== */}
      <div className="bg-bg-1 border border-border rounded-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[12px] font-semibold text-text-0">1. Verification Backtest</span>
        </div>

        <div className="space-y-3 mb-4">
          {/* Source Test */}
          <div>
            <label className={LABEL}>Source Test</label>
            <select
              value={sourceExperiment}
              onChange={(e) => setSourceExperiment(e.target.value)}
              className={SELECT}
            >
              {mockExperiments.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Name */}
          <div>
            <label className={LABEL}>Verification Name</label>
            <input
              type="text"
              value={verificationName}
              onChange={(e) => setVerificationName(e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL}>Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this verification..."
              className={INPUT}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Warning Box */}
          <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] rounded-btn px-3 py-2">
            <div className="flex gap-2">
              <span className="text-amber mt-0.5">⚠</span>
              <div className="text-[11px] text-text-2 leading-relaxed">
                <strong className="text-amber">Use a DIFFERENT time period from training!</strong>
                <br />
                <Tooltip content="Out-of-sample validation tests performance on data the strategy never saw during optimization. Must use a different date range.">
                  <span className="hover:underline cursor-help">Training period</span>
                </Tooltip>
                {' for selected test: '}
                <span className="font-mono text-text-0">2022-01-01 to 2024-01-01</span>
                <br />
                Recommended verification period:{' '}
                <span className="font-mono text-green">2024-01-01 to 2025-01-01</span>
              </div>
            </div>
          </div>

          {/* Optimized Parameters (Readonly) */}
          <div className="bg-bg-2 border border-border rounded-btn p-3">
            <div className={`${LABEL} mb-2`}>
              Optimized Parameters (Readonly)
            </div>
            {selectedExp && (
              <table className="w-full text-[11px]">
                <tbody>
                  <tr>
                    <td className="py-1 px-2">sampler</td>
                    <td className="py-1 px-2 text-right text-accent">{selectedExp.sampler}</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2">loss_function</td>
                    <td className="py-1 px-2 text-right text-accent">{selectedExp.lossFunction}</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2">entry_signals</td>
                    <td className="py-1 px-2 text-right text-accent">{selectedExp.entrySignals}</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2">exit_type</td>
                    <td className="py-1 px-2 text-right text-accent">{selectedExp.exitType}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunVerification}
            disabled={isRunning}
            className="w-full h-[34px] inline-flex items-center justify-center gap-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-accent border-accent text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <div className="animate-spin text-sm">⟳</div>
                Running Verification Backtest...
              </>
            ) : (
              <>
                ▶ Run Verification Backtest
              </>
            )}
          </button>
        </div>

        {/* ===== VERIFICATION RESULTS ===== */}
        {!hasVerificationRun ? (
          <div className="border-t border-border pt-4 mt-4">
            <div className="bg-bg-1 border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[300px]">
              <div className="text-[32px] mb-3 opacity-30">✓</div>
              <div className="text-[13px] font-semibold text-text-2 mb-1">No verification yet</div>
              <div className="text-[11px] text-text-3 text-center max-w-[280px]">
                Click &quot;Run Verification Backtest&quot; to test strategy performance on new data.
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-border pt-4 mt-4 space-y-4">
            <p className="text-[12px] text-text-2">Verification results will appear here once complete.</p>
          </div>
        )}
      </div>

      {/* ===== SECTION 2: LOOKAHEAD ANALYSIS ===== */}
      <div className="bg-bg-1 border border-border rounded-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] font-semibold text-text-0">
            2. Lookahead Analysis{' '}
            <Tooltip content="§21: Lookahead Bias Detection">
              <span className="text-text-3 text-[10px] cursor-help">(§21)</span>
            </Tooltip>
          </span>
        </div>

        <p className="text-[12px] text-text-2 mb-3 leading-relaxed">
          Checks if strategy &apos;cheats&apos; by using future data for decisions. Example: using tomorrow&apos;s price to decide what to buy today. This analysis scans all entry and exit signals to ensure they only use data available AT the moment of the signal.
        </p>

        <button
          onClick={handleRunLookahead}
          disabled={isRunning}
          className="h-[34px] inline-flex items-center gap-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-accent border-accent text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          {isRunning ? (
            <>
              <div className="animate-spin text-sm">⟳</div>
              Running Lookahead Analysis...
            </>
          ) : (
            <>▶ Run Lookahead Analysis</>
          )}
        </button>

        {!hasLookaheadRun ? (
          <div className="bg-bg-1 border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[250px]">
            <div className="text-[32px] mb-3 opacity-30">⚡</div>
            <div className="text-[13px] font-semibold text-text-2 mb-1">No lookahead analysis yet</div>
            <div className="text-[11px] text-text-3 text-center max-w-[280px]">
              Click &quot;Run Lookahead Analysis&quot; to check for future data leakage.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-text-2">Lookahead analysis results will appear here once complete.</p>
          </div>
        )}
      </div>

      {/* ===== SECTION 3: RECURSIVE ANALYSIS ===== */}
      <div className="bg-bg-1 border border-border rounded-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] font-semibold text-text-0">
            3. Recursive Analysis{' '}
            <Tooltip content="§22: Recursive Indicator Dependencies">
              <span className="text-text-3 text-[10px] cursor-help">(§22)</span>
            </Tooltip>
          </span>
        </div>

        <p className="text-[12px] text-text-2 mb-3 leading-relaxed">
          Checks if indicators depend on each other in a loop — which creates unstable signals. Example: if indicator A depends on B and B depends on A, that&apos;s a cycle. This creates feedback loops that can break in live trading.
        </p>

        <button
          onClick={handleRunRecursive}
          disabled={isRunning}
          className="h-[34px] inline-flex items-center gap-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-accent border-accent text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          {isRunning ? (
            <>
              <div className="animate-spin text-sm">⟳</div>
              Running Recursive Analysis...
            </>
          ) : (
            <>▶ Run Recursive Analysis</>
          )}
        </button>

        {!hasRecursiveRun ? (
          <div className="bg-bg-1 border border-border rounded-[10px] p-4 flex flex-col items-center justify-center min-h-[250px]">
            <div className="text-[32px] mb-3 opacity-30">🔄</div>
            <div className="text-[13px] font-semibold text-text-2 mb-1">No recursive analysis yet</div>
            <div className="text-[11px] text-text-3 text-center max-w-[280px]">
              Click &quot;Run Recursive Analysis&quot; to check for circular indicator dependencies.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-text-2">Recursive analysis results will appear here once complete.</p>
          </div>
        )}
      </div>
    </div>
  );
}
