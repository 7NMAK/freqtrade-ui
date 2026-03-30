'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import {
  AI_MODELS,
  fmtDateTime,
  AiVerdict,
} from '@/lib/experiments';

interface ScoreCardProps {
  title: string;
  score: number;
  description: string;
  tooltip: string;
  details: {
    label: string;
    value: string | number;
    color?: 'green' | 'amber' | 'text-1';
  }[];
}

interface Concern {
  severity: 'critical' | 'warning' | 'info';
  problem: string;
  measured: string;
  shouldBe: string;
  meaning: string;
}

interface AnalysisResult {
  verdict: AiVerdict;
  scores: {
    overfitting: number;
    consistency: number;
    risk: number;
    robustness: number;
  };
  concerns: Concern[];
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
    overfitting: 82,
    consistency: 75,
    risk: 71,
    robustness: 78,
  },
  concerns: [
    {
      severity: 'critical',
      problem: 'Large drawdown',
      measured: '8.4%',
      shouldBe: 'below 7%',
      meaning: 'Portfolio dropped 8.4% at worst — borderline',
    },
    {
      severity: 'warning',
      problem: 'Inconsistent win rate',
      measured: '±3.2pp',
      shouldBe: 'below 2pp',
      meaning: 'Win rate varies between tests — not fully stable',
    },
    {
      severity: 'info',
      problem: 'Low trade count',
      measured: '156',
      shouldBe: 'above 200',
      meaning: 'Not enough trades for fully reliable statistics',
    },
  ],
  recommendation: {
    hyperoptWinner: 'CmaEs · SortinoDaily · Signals Only',
    freqaiWinner: 'LightGBMRegressor · DI · PCA On',
    why: 'CmaEs sampler with SortinoDaily loss gives the best risk-adjusted returns',
  },
  timestamp: '2026-03-30T14:22:00Z',
};

const ScoreCard: React.FC<ScoreCardProps & { expanded: boolean; onToggle: () => void }> = ({
  title,
  score,
  description,
  tooltip,
  details,
  expanded,
  onToggle,
}) => {
  const scoreColor = score >= 80 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="bg-bg-2 border border-[#1e1e30] rounded-lg p-4 cursor-pointer hover:bg-bg-3 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <Tooltip content={tooltip}>
            <h3 className="text-sm font-semibold text-text-0 mb-1">{title}</h3>
          </Tooltip>
          <p className="text-2xs text-text-2">{description}</p>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="text-right">
            <div
              className="text-2xl font-bold"
              style={{ color: scoreColor }}
            >
              {score}
            </div>
            <div className="text-2xs text-text-3">/100</div>
          </div>
          <div className="text-text-2">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#1e1e30] space-y-3">
          {details.map((detail, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-2xs text-text-2">{detail.label}</span>
              <span
                className="text-2xs font-semibold"
                style={{
                  color:
                    detail.color === 'green'
                      ? '#22c55e'
                      : detail.color === 'amber'
                        ? '#f59e0b'
                        : 'inherit',
                }}
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

const ConcernsTable: React.FC<{ concerns: Concern[] }> = ({ concerns }) => {
  const severityIcon = {
    critical: '🔴',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className="bg-bg-2 border border-[#1e1e30] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-2xs">
          <thead className="bg-bg-3 border-b border-[#1e1e30]">
            <tr>
              <th className="px-4 py-2 text-left text-text-2 font-semibold">Severity</th>
              <th className="px-4 py-2 text-left text-text-2 font-semibold">Problem</th>
              <th className="px-4 py-2 text-left text-text-2 font-semibold">Measured</th>
              <th className="px-4 py-2 text-left text-text-2 font-semibold">Should be</th>
              <th className="px-4 py-2 text-left text-text-2 font-semibold">What it means</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e30]">
            {concerns.map((concern, idx) => (
              <tr key={idx} className="hover:bg-bg-3 transition-colors">
                <td className="px-4 py-3 text-center">{severityIcon[concern.severity]}</td>
                <td className="px-4 py-3 text-text-0">{concern.problem}</td>
                <td className="px-4 py-3 text-accent font-semibold">{concern.measured}</td>
                <td className="px-4 py-3 text-text-1">{concern.shouldBe}</td>
                <td className="px-4 py-3 text-text-2 max-w-xs">{concern.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const VerdictBanner: React.FC<{ verdict: AiVerdict; avgScore: number }> = ({
  verdict,
  avgScore,
}) => {
  const verdictConfig = {
    READY: {
      icon: '🟢',
      text: 'READY',
      description: 'Strategy is ready for Paper Trading',
      bgColor: 'bg-[#062b1b]',
      borderColor: 'border-[#22c55e]/30',
      textColor: 'text-[#22c55e]',
    },
    NEEDS_WORK: {
      icon: '🟡',
      text: 'NEEDS_WORK',
      description: 'Strategy works but has some risks',
      bgColor: 'bg-[#2b2006]',
      borderColor: 'border-[#f59e0b]/30',
      textColor: 'text-[#f59e0b]',
    },
    HIGH_RISK: {
      icon: '🔴',
      text: 'HIGH_RISK',
      description: 'Strategy needs improvement',
      bgColor: 'bg-[#2b0606]',
      borderColor: 'border-[#ef4444]/30',
      textColor: 'text-[#ef4444]',
    },
    INSUFFICIENT_DATA: {
      icon: '⚫',
      text: 'INSUFFICIENT_DATA',
      description: 'Not enough data to make a verdict',
      bgColor: 'bg-[#1a1a2e]',
      borderColor: 'border-[#6b7280]/30',
      textColor: 'text-[#6b7280]',
    },
  };

  const config = verdictConfig[verdict];

  return (
    <div
      className={`${config.bgColor} border ${config.borderColor} rounded-lg p-6 mb-6`}
    >
      <div className="flex items-center gap-4">
        <div className="text-4xl">{config.icon}</div>
        <div className="flex-1">
          <div className={`text-lg font-bold ${config.textColor}`}>
            {config.text}
          </div>
          <div className="text-sm text-text-1 mt-1">{config.description}</div>
        </div>
        <div className="text-right">
          <div
            className="text-3xl font-bold"
            style={{ color: config.textColor.replace('text-', '') }}
          >
            {avgScore}
          </div>
          <div className="text-2xs text-text-2">/100</div>
        </div>
      </div>
    </div>
  );
};

const HistoryItem: React.FC<{
  date: string;
  model: string;
  verdict: AiVerdict;
  scores: Record<string, number>;
}> = ({ date, model, verdict, scores }) => {
  const avgScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);

  const verdictColors = {
    READY: 'text-[#22c55e]',
    NEEDS_WORK: 'text-[#f59e0b]',
    HIGH_RISK: 'text-[#ef4444]',
    INSUFFICIENT_DATA: 'text-[#6b7280]',
  };

  return (
    <div className="bg-bg-3 border border-[#1e1e30] rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-2xs text-text-2">{fmtDateTime(date)}</div>
          <div className="text-xs text-text-1 mt-1">{model}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`font-semibold text-sm ${verdictColors[verdict]}`}>
            {verdict}
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-text-0">{avgScore}/100</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AiReviewTab({ strategy: _strategy }: { strategy: string }) {
  const [scope, setScope] = useState<'all' | 'hyperopt' | 'freqai' | 'specific'>('all');
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].value);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(true); // Set true to show mock results

  const selectedModelObj = AI_MODELS.find((m) => m.value === selectedModel)!;

  const handleRunAnalysis = () => {
    setIsRunning(true);
    // Placeholder pending backend integration
    setIsRunning(false);
    setHasRun(true);
  };

  const avgScore = Math.round(
    (mockAnalysisResult.scores.overfitting +
      mockAnalysisResult.scores.consistency +
      mockAnalysisResult.scores.risk +
      mockAnalysisResult.scores.robustness) /
      4
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Form Section */}
      <div className="bg-bg-2 border border-[#1e1e30] rounded-lg p-6">
        <h3 className="text-sm font-semibold text-text-0 mb-6">AI Analysis Settings</h3>

        <div className="space-y-5">
          {/* Scope Select */}
          <div>
            <label className="block text-2xs font-semibold text-text-1 mb-2">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              className="w-full px-3 py-2 bg-bg-3 border border-[#1e1e30] rounded-md text-2xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent transition-colors"
            >
              <option value="all">All tests (Hyperopt + FreqAI)</option>
              <option value="hyperopt">Hyperopt only</option>
              <option value="freqai">FreqAI only</option>
              <option value="specific">Specific test</option>
            </select>
          </div>

          {/* AI Model Select */}
          <div>
            <label className="block text-2xs font-semibold text-text-1 mb-2">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 bg-bg-3 border border-[#1e1e30] rounded-md text-2xs text-text-0 placeholder-text-3 focus:outline-none focus:border-accent transition-colors"
            >
              {AI_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label} — {model.cost} estimated cost
                </option>
              ))}
            </select>
            <p className="text-2xs text-text-3 mt-2">
              Using {selectedModelObj.label} • {selectedModelObj.cost} estimated cost
            </p>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunAnalysis}
            disabled={isRunning}
            className="w-full px-4 py-3 bg-accent hover:bg-[#5558e3] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <div className="animate-spin">
                  <Zap size={14} />
                </div>
                Running AI Analysis...
              </>
            ) : (
              <>
                <Zap size={14} />
                Run AI Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {hasRun && (
        <>
          {/* Verdict Banner */}
          <VerdictBanner verdict={mockAnalysisResult.verdict} avgScore={avgScore} />

          {/* Score Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScoreCard
              title="Is it overfitted? (Overfitting)"
              score={mockAnalysisResult.scores.overfitting}
              description="Compares how strategy performs on training data vs new unseen data"
              tooltip="If strategy works great on old data but poorly on new — it's overfitted. Like a student who memorizes answers but doesn't understand the material."
              details={[
                { label: 'Training profit', value: '+15.2%' },
                { label: 'New data profit', value: '+11.3%' },
                { label: 'Difference', value: '-25.7%', color: 'green' },
                { label: 'Max DD increase', value: '+18.5%', color: 'green' },
                { label: 'Win rate drop', value: '-4.2pp', color: 'green' },
              ]}
              expanded={expandedCard === 0}
              onToggle={() => setExpandedCard(expandedCard === 0 ? null : 0)}
            />

            <ScoreCard
              title="Is it consistent? (Consistency)"
              score={mockAnalysisResult.scores.consistency}
              description="Checks if strategy gives similar results regardless of testing method"
              tooltip="If strategy only works with one setting but fails with all others — it's not reliable. Good strategy works well with most settings."
              details={[
                { label: 'Profitable samplers', value: '5/6' },
                { label: 'Profitable loss functions', value: '10/12' },
                { label: 'Best-worst profit gap', value: '12.1%' },
                { label: 'Win rate std', value: '±3.2pp' },
              ]}
              expanded={expandedCard === 1}
              onToggle={() => setExpandedCard(expandedCard === 1 ? null : 1)}
            />

            <ScoreCard
              title="How risky? (Risk)"
              score={mockAnalysisResult.scores.risk}
              description="Measures worst-case losses — max drawdown, worst trade, loss streaks"
              tooltip="Even a profitable strategy can be dangerous if it has big drawdowns."
              details={[
                { label: 'Max Drawdown', value: '-8.4%' },
                { label: 'Worst single trade', value: '-4.2%' },
                { label: 'Max consecutive losses', value: '5' },
                { label: 'Risk/Reward ratio', value: '1.8:1' },
              ]}
              expanded={expandedCard === 2}
              onToggle={() => setExpandedCard(expandedCard === 2 ? null : 2)}
            />

            <ScoreCard
              title="How robust? (Robustness)"
              score={mockAnalysisResult.scores.robustness}
              description="Checks if strategy profits with MOST settings, not just one lucky combination"
              tooltip="If only 10 of 288 Hyperopt tests profit — strategy depends on luck. If 250 of 288 profit — strategy is robust."
              details={[
                { label: 'Profitable Hyperopt tests', value: '231/288 (80%)' },
                { label: 'Profitable FreqAI tests', value: '98/128 (77%)' },
                { label: 'Profitable samplers', value: '5/6' },
                { label: 'Profitable ML models', value: '7/8' },
              ]}
              expanded={expandedCard === 3}
              onToggle={() => setExpandedCard(expandedCard === 3 ? null : 3)}
            />
          </div>

          {/* Concerns Table */}
          <div>
            <h3 className="text-sm font-semibold text-text-0 mb-3">Top 3 Concerns</h3>
            <ConcernsTable concerns={mockAnalysisResult.concerns} />
          </div>

          {/* Recommendation Section */}
          <div className="bg-bg-3 border border-[#1e1e30] rounded-lg p-6">
            <h3 className="text-sm font-semibold text-text-0 mb-4">
              Recommendation
            </h3>

            <p className="text-2xs text-text-2 mb-4">
              Based on all tests, the best combination is:
            </p>

            <div className="space-y-3 mb-6">
              <div className="bg-bg-2 border border-[#1e1e30] rounded-lg p-4">
                <div className="text-2xs text-text-2 mb-1">Hyperopt winner</div>
                <button className="text-sm font-semibold text-accent hover:text-[#5558e3] transition-colors">
                  {mockAnalysisResult.recommendation.hyperoptWinner}
                </button>
              </div>

              <div className="bg-bg-2 border border-[#1e1e30] rounded-lg p-4">
                <div className="text-2xs text-text-2 mb-1">FreqAI winner</div>
                <button className="text-sm font-semibold text-accent hover:text-[#5558e3] transition-colors">
                  {mockAnalysisResult.recommendation.freqaiWinner}
                </button>
              </div>
            </div>

            <div className="bg-bg-2 border border-[#1e1e30] rounded-lg p-4 mb-6">
              <p className="text-2xs text-text-2">
                <span className="text-text-1 font-semibold">Why:</span> {mockAnalysisResult.recommendation.why}
              </p>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 bg-accent hover:bg-[#5558e3] text-white font-semibold text-xs rounded-lg transition-colors">
                Use this recommendation →
              </button>
              <button className="flex-1 px-4 py-3 bg-3 border border-[#1e1e30] hover:bg-bg-2 text-text-0 font-semibold text-xs rounded-lg transition-colors">
                I disagree, I&apos;ll choose myself
              </button>
            </div>
          </div>

          {/* Verdict Thresholds Info */}
          <div className="bg-bg-2 border border-[#1e1e30] rounded-lg p-4">
            <h4 className="text-2xs font-semibold text-text-1 mb-3">Verdict Thresholds</h4>
            <div className="space-y-2 text-2xs text-text-2">
              <div className="flex justify-between">
                <span>READY (≥ 75 avg score)</span>
                <span className="text-[#22c55e] font-semibold">Overfitting &lt; 50%, Consistency ≥ 70%</span>
              </div>
              <div className="flex justify-between">
                <span>CAUTION (60-74 avg score)</span>
                <span className="text-[#f59e0b] font-semibold">Overfitting 50-75%, Consistency 50-70%</span>
              </div>
              <div className="flex justify-between">
                <span>REJECTED (&lt; 60 avg score)</span>
                <span className="text-[#ef4444] font-semibold">Any critical issue or low robustness</span>
              </div>
            </div>
          </div>

          {/* History Section */}
          <div>
            <h3 className="text-sm font-semibold text-text-0 mb-3">Analysis History</h3>
            <div className="space-y-2">
              <HistoryItem
                date="2026-03-30T14:22:00Z"
                model="Claude 3.5 Sonnet"
                verdict="READY"
                scores={{
                  overfitting: 82,
                  consistency: 75,
                  risk: 71,
                  robustness: 78,
                }}
              />
              <HistoryItem
                date="2026-03-29T09:15:00Z"
                model="GPT-4o"
                verdict="NEEDS_WORK"
                scores={{
                  overfitting: 72,
                  consistency: 68,
                  risk: 64,
                  robustness: 71,
                }}
              />
              <HistoryItem
                date="2026-03-27T16:45:00Z"
                model="Llama 3.1 405B"
                verdict="HIGH_RISK"
                scores={{
                  overfitting: 55,
                  consistency: 58,
                  risk: 52,
                  robustness: 60,
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
