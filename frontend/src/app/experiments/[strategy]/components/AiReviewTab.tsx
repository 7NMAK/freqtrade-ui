'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import {
  AI_MODELS,
  AiVerdict,
} from '@/lib/experiments';

interface AnalysisResult {
  verdict: AiVerdict;
  scores: {
    overfitting: number;
    consistency: number;
    risk: number;
    robustness: number;
  };
  concerns: Array<{
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    value: string;
    threshold: string;
    message: string;
  }>;
  recommendation: {
    hyperoptWinner: string;
    freqaiWinner: string;
    why: string;
  };
  timestamp: string;
}

const mockAnalysisResult: AnalysisResult = {
  verdict: 'READY',
  scores: {
    overfitting: 18,
    consistency: 85,
    risk: 42,
    robustness: 79,
  },
  concerns: [
    {
      severity: 'warning',
      metric: 'Max Drawdown',
      value: '18.5%',
      threshold: '< 15%',
      message: 'DD exceeds target — consider reducing leverage',
    },
    {
      severity: 'info',
      metric: 'Sortino Ratio',
      value: '1.89',
      threshold: '> 2.0',
      message: 'Just below optimal — small sample effect',
    },
    {
      severity: 'info',
      metric: 'Win Rate Variance',
      value: '47-54% across splits',
      threshold: '±2%',
      message: 'Slight variance in win rate — monitor in live',
    },
  ],
  recommendation: {
    hyperoptWinner: 'CmaEs · SortinoDaily · +15.2% (Epochs: 500, Best Profit: 15.2%, Max DD: 16.2%)',
    freqaiWinner: 'LightGBMClassifier · DI · PCA ON · Noise ON (Trades: 312, Win Rate: 52.6%, Sharpe: 2.03)',
    why: 'Use Hyperopt results (CmaEs). Production-level performance with proven Out-of-Sample consistency. FreqAI adds marginal value (+0.8%) but adds complexity.',
  },
  timestamp: '2026-03-30T14:22:00Z',
};

const ScoreCard: React.FC<{
  label: string;
  score: number;
  description: string;
  tooltip: string;
  scoreColor: string;
  expanded: boolean;
  onToggle: () => void;
  details: { label: string; value: string; color?: string }[];
}> = ({
  label,
  score,
  description,
  tooltip,
  scoreColor,
  expanded,
  onToggle,
  details,
}) => {
  const barWidth = `${score}%`;

  return (
    <div
      className="bg-bg-2 border border-border rounded-card p-4 cursor-pointer hover:bg-bg-3 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Tooltip content={tooltip}>
            <div className="text-[12px] font-semibold text-text-0 mb-1">{label}</div>
          </Tooltip>
          <div className="text-[11px] text-text-1">{description}</div>
        </div>
        <div className="ml-3 text-right flex-shrink-0">
          <div className="text-[20px] font-bold" style={{ color: scoreColor }}>
            {score}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3 h-1.5 bg-bg-3 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: barWidth, backgroundColor: scoreColor }}
        />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {details.map((detail, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-[11px] text-text-1">{detail.label}</span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: detail.color || '#c0c0d0' }}
              >
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VerdictBanner: React.FC<{ verdict: AiVerdict; avgScore: number }> = ({
  verdict,
}) => {
  const config = {
    READY: {
      emoji: '🟢',
      text: 'READY',
      desc: 'Strategy meets all quality thresholds — can proceed to Paper Trading',
      bg: 'rgba(34, 197, 94, 0.08)',
      border: 'rgba(34, 197, 94, 0.25)',
      color: '#22c55e',
    },
    NEEDS_WORK: {
      emoji: '🟡',
      text: 'NEEDS_WORK',
      desc: 'Strategy works but has some risks',
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.25)',
      color: '#f59e0b',
    },
    HIGH_RISK: {
      emoji: '🔴',
      text: 'HIGH_RISK',
      desc: 'Strategy needs improvement',
      bg: 'rgba(239, 68, 68, 0.08)',
      border: 'rgba(239, 68, 68, 0.25)',
      color: '#ef4444',
    },
    INSUFFICIENT_DATA: {
      emoji: '⚫',
      text: 'INSUFFICIENT_DATA',
      desc: 'Not enough data to make a verdict',
      bg: 'rgba(107, 114, 128, 0.08)',
      border: 'rgba(107, 114, 128, 0.25)',
      color: '#6b7280',
    },
  };

  const cfg = config[verdict];

  return (
    <div
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
      className="rounded-card p-4 mb-6"
    >
      <div className="flex items-center gap-3">
        <span className="text-[24px]">{cfg.emoji}</span>
        <div className="flex-1">
          <div style={{ color: cfg.color }} className="font-semibold text-[13px]">
            {cfg.text}
          </div>
          <div className="text-[11px] text-text-1 mt-0.5">{cfg.desc}</div>
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AiReviewTab({ strategy: _strategy }: { strategy: string }) {
  const [scope, setScope] = useState<'all' | 'selected' | 'backtest' | 'hyperopt' | 'freqai'>('all');
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].value);
  const [expandedScore, setExpandedScore] = useState<number | null>(0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(true);

  const handleRunAnalysis = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasRun(true);
    }, 2000);
  };

  const avgScore = Math.round(
    (mockAnalysisResult.scores.overfitting +
      mockAnalysisResult.scores.consistency +
      mockAnalysisResult.scores.risk +
      mockAnalysisResult.scores.robustness) /
      4
  );

  const getScoreColor = (score: number): string => {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="flex gap-6 pb-12">
      {/* LEFT PANEL: FORM (380px) */}
      <div className="w-[380px] flex-shrink-0">
        <div className="bg-bg-1 border border-border rounded-card p-4">
          <h3 className="text-[13px] font-semibold text-text-0 mb-4">AI Strategy Analyst</h3>

          <div className="space-y-4">
            {/* Scope */}
            <div>
              <label className="form-label">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              >
                <option value="all">All tests (Svi testovi)</option>
                <option value="selected">Selected test</option>
                <option value="backtest">Backtest results only</option>
                <option value="hyperopt">Hyperopt results only</option>
                <option value="freqai">FreqAI results only</option>
              </select>
            </div>

            {/* AI Model */}
            <div>
              <label className="form-label">AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full py-2 px-3 bg-bg-3 border border-border rounded-btn text-[12.5px] text-text-0 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              >
                {AI_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label} ({model.cost})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-text-3 mt-2 font-medium">
                Estimated cost: <strong>~$0.03</strong>
              </p>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className="w-full inline-flex items-center justify-center gap-[6px] py-[8px] px-[14px] rounded-btn text-[12px] font-medium border bg-accent border-accent text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <>
                  <div className="animate-spin">
                    <Zap size={14} />
                  </div>
                  Running Analysis...
                </>
              ) : (
                <>
                  <span>▶</span>
                  Run AI Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: RESULTS (flex) */}
      <div className="flex-1 space-y-6 min-w-0">
        {hasRun && (
          <>
            {/* Verdict Banner */}
            <VerdictBanner verdict={mockAnalysisResult.verdict} avgScore={avgScore} />

            {/* Score Cards Grid (2x2) */}
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard
                label="Overfitting Risk"
                score={mockAnalysisResult.scores.overfitting}
                description="Is the strategy learning noise instead of signal? Lower is better."
                tooltip="Is the strategy learning noise instead of signal? Lower is better."
                scoreColor={getScoreColor(100 - mockAnalysisResult.scores.overfitting)}
                expanded={expandedScore === 0}
                onToggle={() => setExpandedScore(expandedScore === 0 ? null : 0)}
                details={[
                  { label: 'Training Sharpe', value: '2.14' },
                  { label: 'Testing Sharpe', value: '2.11' },
                  { label: 'Divergence', value: '1.4% (excellent)' },
                  { label: '✓ Max DD stable across periods', value: '' },
                  { label: '✓ Win rate consistent (±2.1%)', value: '' },
                ]}
              />

              <ScoreCard
                label="Consistency"
                score={mockAnalysisResult.scores.consistency}
                description="Does it perform similarly across different market conditions?"
                tooltip="Does it perform similarly across different market conditions?"
                scoreColor={getScoreColor(mockAnalysisResult.scores.consistency)}
                expanded={expandedScore === 1}
                onToggle={() => setExpandedScore(expandedScore === 1 ? null : 1)}
                details={[
                  { label: 'Bull market Sharpe', value: '2.18' },
                  { label: 'Bear market Sharpe', value: '1.98' },
                  { label: 'Sideways Sharpe', value: '2.06' },
                  { label: '✓ Profit factor stable', value: '' },
                  { label: '✓ Risk metrics aligned', value: '' },
                ]}
              />

              <ScoreCard
                label="Risk Level"
                score={mockAnalysisResult.scores.risk}
                description="What's the worst-case loss scenario?"
                tooltip="What's the worst-case loss scenario?"
                scoreColor={getScoreColor(100 - mockAnalysisResult.scores.risk)}
                expanded={expandedScore === 2}
                onToggle={() => setExpandedScore(expandedScore === 2 ? null : 2)}
                details={[
                  { label: 'Max Drawdown', value: '18.5%' },
                  { label: 'Avg Loss', value: '-0.32%' },
                  { label: 'Max Consecutive Losses', value: '5 trades' },
                  { label: 'Risk/Reward Ratio', value: '1:3.2' },
                  { label: '⚠️ Recommend 2% risk per trade max', value: '' },
                ]}
              />

              <ScoreCard
                label="Robustness"
                score={mockAnalysisResult.scores.robustness}
                description="Will it work with slight parameter changes?"
                tooltip="Will it work with slight parameter changes?"
                scoreColor={getScoreColor(mockAnalysisResult.scores.robustness)}
                expanded={expandedScore === 3}
                onToggle={() => setExpandedScore(expandedScore === 3 ? null : 3)}
                details={[
                  { label: 'Best variant', value: '+15.2%' },
                  { label: 'Worst variant', value: '+8.7%' },
                  { label: 'Median', value: '+11.4%' },
                  { label: '✓ Works across timeframes', value: '' },
                  { label: '✓ Parameter sensitivity low', value: '' },
                ]}
              />
            </div>

            {/* Top 3 Concerns */}
            <div className="bg-bg-1 border border-border rounded-card overflow-hidden">
              <div className="bg-bg-1 border-b border-border px-4 py-2">
                <div className="text-[13px] font-semibold text-text-0">Top 3 Concerns</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Severity
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Metric
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Value
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Threshold
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockAnalysisResult.concerns.map((concern, idx) => {
                      const severityStyles = {
                        critical: { emoji: '🔴', bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
                        warning: { emoji: '⚠️', bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
                        info: { emoji: 'ℹ️', bg: 'rgba(100, 150, 255, 0.2)', color: '#6b9aff' },
                      };
                      const style = severityStyles[concern.severity];
                      return (
                        <tr key={idx} className="border-b border-border/50 hover:bg-bg-2 transition-colors">
                          <td className="py-2 px-3">
                            <span
                              style={{
                                background: style.bg,
                                color: style.color,
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '10px',
                              }}
                            >
                              {style.emoji}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-text-1">{concern.metric}</td>
                          <td className="py-2 px-3 font-semibold" style={{ color: style.color }}>
                            {concern.value}
                          </td>
                          <td className="py-2 px-3 text-text-1">{concern.threshold}</td>
                          <td className="py-2 px-3 text-text-1 max-w-xs">{concern.message}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Recommendation */}
            <div
              className="bg-bg-1 border rounded-card p-4"
              style={{
                background: 'rgba(34, 197, 94, 0.05)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
              }}
            >
              <div className="text-[13px] font-semibold text-text-0 mb-3">AI Recommendation</div>
              <div className="space-y-3 text-[11px] text-text-1">
                <div>
                  <strong>Best Hyperopt Run:</strong> {mockAnalysisResult.recommendation.hyperoptWinner}
                </div>
                <div>
                  <strong>Best FreqAI Run:</strong> {mockAnalysisResult.recommendation.freqaiWinner}
                </div>
                <div className="bg-bg-1 border border-border rounded-btn p-3 text-[10.5px]">
                  {mockAnalysisResult.recommendation.why}
                </div>
                <div className="flex gap-2 pt-2">
                  <button className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 rounded-btn text-[12px] font-medium bg-green-600 hover:bg-green-700 text-white border border-green-600 transition-colors">
                    → Use This Recommendation
                  </button>
                  <button className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 rounded-btn text-[12px] font-medium bg-transparent border border-border text-text-0 hover:bg-bg-2 transition-colors">
                    No, I&apos;ll choose myself
                  </button>
                </div>
              </div>
            </div>

            {/* Analysis History */}
            <div className="bg-bg-1 border border-border rounded-card overflow-hidden">
              <div className="bg-bg-1 border-b border-border px-4 py-2">
                <div className="text-[13px] font-semibold text-text-0">Analysis History</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Date
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Verdict
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Scope
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Overfitting
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Consistency
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Risk
                      </th>
                      <th className="py-2 px-3 text-left text-[10px] uppercase tracking-[0.5px] text-text-3 font-semibold">
                        Robustness
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50 hover:bg-bg-2">
                      <td className="py-2 px-3 text-text-1">2026-03-30 15:42</td>
                      <td className="py-2 px-3">
                        <span style={{ color: '#22c55e' }}>🟢 READY</span>
                      </td>
                      <td className="py-2 px-3 text-text-1">All tests</td>
                      <td className="py-2 px-3 text-text-1">18</td>
                      <td className="py-2 px-3 text-text-1">85</td>
                      <td className="py-2 px-3 text-text-1">42</td>
                      <td className="py-2 px-3 text-text-1">79</td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-bg-2">
                      <td className="py-2 px-3 text-text-1">2026-03-29 12:15</td>
                      <td className="py-2 px-3">
                        <span style={{ color: '#f59e0b' }}>🟡 NEEDS_WORK</span>
                      </td>
                      <td className="py-2 px-3 text-text-1">Backtest only</td>
                      <td className="py-2 px-3 text-text-1">22</td>
                      <td className="py-2 px-3 text-text-1">71</td>
                      <td className="py-2 px-3 text-text-1">55</td>
                      <td className="py-2 px-3 text-text-1">68</td>
                    </tr>
                    <tr className="hover:bg-bg-2">
                      <td className="py-2 px-3 text-text-1">2026-03-28 09:30</td>
                      <td className="py-2 px-3">
                        <span style={{ color: '#ef4444' }}>🔴 HIGH_RISK</span>
                      </td>
                      <td className="py-2 px-3 text-text-1">Hyperopt only</td>
                      <td className="py-2 px-3 text-text-1">38</td>
                      <td className="py-2 px-3 text-text-1">45</td>
                      <td className="py-2 px-3 text-text-1">68</td>
                      <td className="py-2 px-3 text-text-1">52</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
