'use client';

import { useState } from 'react';
import Tooltip from '@/components/ui/Tooltip';

// Design system constants
const INPUT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 placeholder-text-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";
const SELECT = "w-full h-[34px] py-0 px-3 bg-bg-3 border border-border rounded-btn text-[12px] text-text-0 focus:outline-none focus:border-accent cursor-pointer appearance-none transition-all";
const LABEL = "block text-[10px] font-semibold text-text-3 uppercase tracking-[0.5px] mb-[4px]";

// Mock data for source experiments
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

// Verification metrics with pass verdict
const verificationMetrics = [
  { name: 'Trades', training: '156', new: '142', diff: '-14 (-9.0%)', badge: 'pass' },
  { name: 'Win Rate', training: '64.1%', new: '59.8%', diff: '-4.3pp', badge: 'pass', badge_text: '✓ <15pp' },
  { name: 'Profit%', training: '15.2%', new: '11.3%', diff: '-25.7% drop', badge: 'pass', badge_text: '✓ <50%' },
  { name: 'Max DD', training: '-8.4%', new: '-9.8%', diff: '+16.7% increase', badge: 'pass', badge_text: '✓ <30%' },
  { name: 'Sharpe Ratio', training: '1.52', new: '1.28', diff: '-0.24', badge: 'pass' },
  { name: 'Sortino Ratio', training: '2.14', new: '1.76', diff: '-0.38', badge: 'pass' },
  { name: 'Avg Duration', training: '2d 4h', new: '2d 8h', diff: '+4h', badge: 'info' },
];

// Lookahead signal types
const lookaheadSignals = [
  { name: 'enter_long', status: 'PASS', details: 'Uses close[0], rsi[0], bb_bands[0] only' },
  { name: 'enter_short', status: 'PASS', details: 'Uses close[0], macd[0] only' },
  { name: 'exit_long', status: 'PASS', details: 'Uses current stoploss + roi levels' },
  { name: 'exit_short', status: 'PASS', details: 'No lookahead detected' },
];

// Recursive analysis indicators
const recursiveIndicators = [
  { name: 'RSI(14)', depends: 'close only', status: 'PASS' },
  { name: 'BB(20, 2)', depends: 'close only', status: 'PASS' },
  { name: 'MACD(12, 26, 9)', depends: 'close only', status: 'PASS' },
  { name: 'EMA(50)', depends: 'close only', status: 'PASS' },
];

// Toggle component
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-text-1">{label}</span>
      <label className="relative w-[36px] h-[20px] cursor-pointer inline-block flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`absolute inset-0 rounded-[10px] border transition-all ${checked ? "bg-[rgba(34,197,94,0.08)] border-green" : "bg-bg-3 border-border"}`} />
        <span className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${checked ? "left-[19px]" : "left-[3px]"}`} />
      </label>
    </div>
  );
}

export default function ValidationTab({}: { strategy?: string }) {
  const [sourceExperiment, setSourceExperiment] = useState('exp-001');
  const [verificationName, setVerificationName] = useState('OOS 2025 verify CmaEs');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2026-01-01');
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(true);
  const [lookaheadRun, setLookaheadRun] = useState(true);
  const [recursiveRun, setRecursiveRun] = useState(true);

  const selectedExp = mockExperiments.find((e) => e.id === sourceExperiment);

  const handleRunVerification = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasRun(true);
    }, 500);
  };

  const handleRunLookahead = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setLookaheadRun(true);
    }, 500);
  };

  const handleRunRecursive = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setRecursiveRun(true);
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
        {hasRun && (
          <div className="border-t border-border pt-4 mt-4 space-y-4">
            {/* PASS Verdict */}
            <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] rounded-card p-4">
              <div className="flex items-start gap-3">
                <span className="text-[24px]">✅</span>
                <div>
                  <strong className="text-green text-[14px]">PROŠLA</strong>
                  <div className="text-[11px] text-text-2 mt-1">
                    Strategija radi dobro i na novim podacima — spremna za Paper Trading
                  </div>
                </div>
              </div>
            </div>

            {/* PASS Criteria Box */}
            <div className="bg-bg-2 border border-border rounded-btn p-3">
              <div className="text-[12px] font-semibold mb-2">PASS Criteria:</div>
              <div className="text-[12px] text-text-2 space-y-1">
                <div>
                  ✓ Win Rate drop &lt; 15%{' '}
                  <Tooltip content="Strategy must maintain at least 85% of training win rate">
                    <span className="cursor-help hover:text-text-1">(baseline 64.1% → new 59.8% = -4.3pp)</span>
                  </Tooltip>
                </div>
                <div>
                  ✓ Profit drop &lt; 50%{' '}
                  <Tooltip content="Total profit can decline but must stay above 50% of training">
                    <span className="cursor-help hover:text-text-1">(baseline 15.2% → new 11.3% = -25.7%)</span>
                  </Tooltip>
                </div>
                <div>
                  ✓ Max Drawdown increase &lt; 30%{' '}
                  <Tooltip content="Risk can increase slightly but not double">
                    <span className="cursor-help hover:text-text-1">(baseline -8.4% → new -9.8% = +16.7%)</span>
                  </Tooltip>
                </div>
                <div>
                  ✓ Sharpe &amp; Sortino decline acceptable{' '}
                  <Tooltip content="Risk-adjusted returns should degrade gracefully">
                    <span className="cursor-help hover:text-text-1">(Sharpe: 1.52 → 1.28 = -0.24)</span>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Metrics Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="border-b border-border">
                  <tr>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">
                      Metric
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-center">
                      <Tooltip content="Performance on the training/optimization period (2022-01-01 to 2024-01-01)">
                        <span className="cursor-help">Training Data</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-center">
                      <Tooltip content="Performance on the verification period (unseen by optimizer, 2025-01-01 to 2026-01-01)">
                        <span className="cursor-help">New Data</span>
                      </Tooltip>
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-center">
                      Difference
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-center">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {verificationMetrics.map((metric, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border/50 hover:bg-bg-2/50 transition-colors"
                    >
                      <td className="py-2 px-[10px] text-text-1">{metric.name}</td>
                      <td className="py-2 px-[10px] text-text-1 text-center">{metric.training}</td>
                      <td className="py-2 px-[10px] text-text-1 text-center">{metric.new}</td>
                      <td className="py-2 px-[10px] text-text-2 text-center text-[12px]">{metric.diff}</td>
                      <td className="py-2 px-[10px] text-center">
                        {metric.badge === 'pass' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-[50px] text-[10px] font-semibold bg-[rgba(34,197,94,0.08)] text-green border border-[rgba(34,197,94,0.25)]">
                            {metric.badge_text || '✓'}
                          </span>
                        )}
                        {metric.badge === 'info' && <span className="text-[12px]">ℹ</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button className="flex-1 h-[34px] inline-flex items-center justify-center gap-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.25)] text-green hover:bg-[rgba(34,197,94,0.15)]">
                ⭐ Promote to Version ★
              </button>
              <button className="flex-1 h-[34px] inline-flex items-center justify-center gap-[6px] px-[14px] rounded-btn text-[12px] font-medium border bg-accent border-accent text-white hover:bg-[#5558e6]">
                → Paper Trading
              </button>
            </div>

            {/* Info Box */}
            <div className="bg-bg-2 border border-border rounded-btn px-3 py-2 text-[11px] text-text-2">
              <strong>→ Paper Trading button appears ONLY here</strong>
              <br />
              This is the only gateway to Paper Trading. It can only be reached after a successful (PASS) Verification Backtest.
            </div>
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

        {lookaheadRun && (
          <div className="space-y-3">
            {/* PASS Verdict */}
            <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] rounded-card p-4">
              <div className="flex items-center gap-3">
                <span className="text-[24px]">✅</span>
                <div className="text-[11px] text-text-2">Strategy does not use future data — all clear</div>
              </div>
            </div>

            {/* Lookahead Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="border-b border-border">
                  <tr>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">
                      Signal Type
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">
                      Status
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lookaheadSignals.map((signal, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-bg-2/50">
                      <td className="py-2 px-[10px] text-text-1">
                        <Tooltip content={`${signal.name} signals`}>
                          <span className="cursor-help font-mono">{signal.name}</span>
                        </Tooltip>
                      </td>
                      <td className="py-2 px-[10px] text-left">
                        <span className="inline-flex items-center px-2 py-1 rounded-[50px] text-[10px] font-semibold bg-[rgba(34,197,94,0.08)] text-green border border-[rgba(34,197,94,0.25)]">
                          ✓ {signal.status}
                        </span>
                      </td>
                      <td className="py-2 px-[10px] text-text-2 text-[12px]">{signal.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

        {recursiveRun && (
          <div className="space-y-3">
            {/* PASS Verdict */}
            <div className="bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] rounded-card p-4">
              <div className="flex items-center gap-3">
                <span className="text-[24px]">✅</span>
                <div className="text-[11px] text-text-2">
                  No recursive dependencies — indicators are independent
                </div>
              </div>
            </div>

            {/* Recursive Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="border-b border-border">
                  <tr>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">
                      Indicator
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">
                      Depends On
                    </th>
                    <th className="py-2 px-[10px] text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold text-left">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recursiveIndicators.map((indicator, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-bg-2/50">
                      <td className="py-2 px-[10px] text-text-1">
                        <Tooltip content={indicator.name}>
                          <span className="cursor-help font-mono">{indicator.name}</span>
                        </Tooltip>
                      </td>
                      <td className="py-2 px-[10px] text-text-2">{indicator.depends}</td>
                      <td className="py-2 px-[10px]">
                        <span className="inline-flex items-center px-2 py-1 rounded-[50px] text-[10px] font-semibold bg-[rgba(34,197,94,0.08)] text-green border border-[rgba(34,197,94,0.25)]">
                          ✓ {indicator.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Info Box */}
            <div className="bg-bg-2 border border-border rounded-btn px-3 py-2 text-[12px] text-text-2">
              <strong>Recommended order:</strong>
              <br />
              1) Lookahead Analysis (fast, checks code) → 2) Recursive Analysis (fast, checks code) → 3)
              Verification Backtest (slower, checks performance)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
