'use client';

import { useState, useCallback } from 'react';
import { SELECT, LABEL, SECTION_CARD, SECTION_TITLE, BTN_PRIMARY, BTN_SECONDARY, LAYOUT_2COL } from '@/lib/design';
import { useToast } from '@/components/ui/Toast';
import {
  AI_MODELS,
  VERDICT_THRESHOLDS,
  type AiVerdict,
} from '@/lib/experiments';

// ── Types ─────────────────────────────────────────────────────────────

interface AiScoreCard {
  label: string;
  score: number; // 0-100
  details: string;
  concerns: string[];
}

interface AiAnalysisResult {
  verdict: AiVerdict;
  overfitting: AiScoreCard;
  consistency: AiScoreCard;
  risk: AiScoreCard;
  robustness: AiScoreCard;
  verdictReason: string;
  topConcerns: Array<{ severity: 'critical' | 'warning' | 'info'; metric: string; value: string; threshold: string; message: string }>;
  bestHyperopt: string | null;
  bestFreqAI: string | null;
  recommendation: string;
  model: string;
  cost: number;
  timestamp: string;
  rawResponse: string;
}

interface AiReviewTabProps {
  strategy: string;
  botId?: number;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

// ── Score color helper ────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-rose-400';
}

function scoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-rose-500/10 border-rose-500/20';
}

function verdictConfig(verdict: AiVerdict) {
  const map: Record<AiVerdict, { icon: string; color: string; bg: string; label: string }> = {
    READY: { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20', label: 'Ready for Paper Trading' },
    NEEDS_WORK: { icon: '⚠️', color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20', label: 'Needs Work' },
    HIGH_RISK: { icon: '🔴', color: 'text-rose-400', bg: 'bg-rose-500/8 border-rose-500/20', label: 'High Risk' },
    INSUFFICIENT_DATA: { icon: '📊', color: 'text-muted-foreground', bg: 'bg-muted/50 border-border', label: 'Insufficient Data' },
  };
  return map[verdict];
}

// ── System prompt for AI analysis ─────────────────────────────────────

function buildSystemPrompt(strategy: string): string {
  return `You are a quantitative trading strategy analyst. Analyze the provided FreqTrade backtest/hyperopt/FreqAI results for strategy "${strategy}".

Return your analysis as a JSON object with this exact structure:
{
  "verdict": "READY" | "NEEDS_WORK" | "HIGH_RISK" | "INSUFFICIENT_DATA",
  "overfitting": {
    "score": <0-100>,
    "details": "<explanation>",
    "concerns": ["<concern1>", "<concern2>"]
  },
  "consistency": {
    "score": <0-100>,
    "details": "<explanation>",
    "concerns": ["<concern1>"]
  },
  "risk": {
    "score": <0-100>,
    "details": "<explanation>",
    "concerns": ["<concern1>"]
  },
  "robustness": {
    "score": <0-100>,
    "details": "<explanation>",
    "concerns": ["<concern1>"]
  },
  "verdict_reason": "<max 15 words why>",
  "top_concerns": [
    {"severity": "critical|warning|info", "metric": "<metric name>", "value": "<measured value>", "threshold": "<expected threshold>", "message": "<max 15 words explanation>"}
  ],
  "best_hyperopt": "<description or null>",
  "best_freqai": "<description or null>",
  "recommendation": "<overall recommendation text>"
}

Rules for verdict assignment (HARDCODED — you MUST follow these):
- READY: All 4 scores ≥ 70 AND no critical problems
- NEEDS_WORK: Any score 40-69 OR one critical problem
- HIGH_RISK: Any score < 40 OR two+ critical problems
- INSUFFICIENT_DATA: Less than 10 tests total

Be specific with concerns. Reference actual metrics from the data.
Return ONLY valid JSON, no markdown wrapping.`;
}

export default function AiReviewTab({ strategy, botId = 2, experimentId, onNavigateToTab }: AiReviewTabProps) {
  const toast = useToast();

  const [scope, setScope] = useState<'all' | 'selected' | 'backtest' | 'hyperopt' | 'freqai'>('all');
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS[0].value);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [history, setHistory] = useState<AiAnalysisResult[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Get model cost
  const currentModel = AI_MODELS.find(m => m.value === selectedModel);
  const estimatedCost = currentModel?.cost ?? '~$0.03';

  // ── Run AI Analysis (real OpenRouter call) ──────────────────────
  const handleRunAnalysis = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    toast.info(`Running AI analysis with ${currentModel?.label}...`);

    try {
      // Gather experiment data from the backend
      let contextData = '';

      if (experimentId) {
        // Fetch experiment runs to provide as context
        const { getExperimentRuns } = await import('@/lib/api');
        const runs = await getExperimentRuns(experimentId);
        if (Array.isArray(runs) && runs.length > 0) {
          // Filter by scope
          let filteredRuns = runs;
          if (scope === 'backtest') filteredRuns = runs.filter(r => r.run_type === 'backtest');
          else if (scope === 'hyperopt') filteredRuns = runs.filter(r => r.run_type === 'hyperopt');
          else if (scope === 'freqai') filteredRuns = runs.filter(r => r.run_type === 'freqai');

          contextData = JSON.stringify(filteredRuns.map(r => ({
            id: r.id,
            run_type: r.run_type,
            status: r.status,
            sampler: r.sampler,
            loss_function: r.loss_function,
            total_trades: r.total_trades,
            win_rate: r.win_rate,
            profit_pct: r.profit_pct,
            profit_abs: r.profit_abs,
            max_drawdown: r.max_drawdown,
            sharpe_ratio: r.sharpe_ratio,
            sortino_ratio: r.sortino_ratio,
            calmar_ratio: r.calmar_ratio,
            avg_duration: r.avg_duration,
            epochs: r.epochs,
            spaces: r.spaces,
          })), null, 2);
        }
      }

      if (!contextData || contextData === '[]') {
        // Fallback: try to get backtest results directly
        const { botBacktestResults } = await import('@/lib/api');
        try {
          const btRes = await botBacktestResults(botId);
          if (btRes?.backtest_result?.strategy) {
            contextData = JSON.stringify(btRes.backtest_result.strategy, null, 2);
          }
        } catch { /* no backtest data available */ }
      }

      if (!contextData) {
        toast.error('No test data available. Run some tests first.');
        setIsRunning(false);
        return;
      }

      // Call the AI analysis endpoint via our backend proxy
      // The backend should proxy to OpenRouter with the configured API key
      const { default: apiRequest } = await import('@/lib/api').then(m => {
        // Use the base request mechanism
        return { default: async (prompt: string, model: string) => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/ai/strategy-review`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${m.getToken()}`,
            },
            body: JSON.stringify({
              strategy,
              model,
              system_prompt: buildSystemPrompt(strategy),
              user_prompt: `Here are the test results for strategy "${strategy}":\n\n${prompt}`,
              scope,
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `AI request failed: ${res.status}`);
          }
          return res.json();
        }};
      });

      const aiResponse = await apiRequest(contextData, selectedModel);

      // Parse the response — expect JSON with our structure
      let parsed: Record<string, unknown>;
      if (typeof aiResponse === 'string') {
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI response did not contain valid JSON');
        parsed = JSON.parse(jsonMatch[0]);
      } else if (aiResponse.analysis) {
        parsed = typeof aiResponse.analysis === 'string' ? JSON.parse(aiResponse.analysis) : aiResponse.analysis;
      } else {
        parsed = aiResponse;
      }

      // Apply hardcoded verdict thresholds (never trust AI's verdict directly)
      const scores = {
        overfitting: (parsed.overfitting as { score?: number })?.score ?? 0,
        consistency: (parsed.consistency as { score?: number })?.score ?? 0,
        risk: (parsed.risk as { score?: number })?.score ?? 0,
        robustness: (parsed.robustness as { score?: number })?.score ?? 0,
      };

      const allScores = [scores.overfitting, scores.consistency, scores.risk, scores.robustness];
      const topConcerns = (parsed.top_concerns as Array<Record<string, string>>) ?? [];
      const criticalCount = topConcerns.filter(c => c.severity === 'critical').length;

      let computedVerdict: AiVerdict;
      if (allScores.some(s => s < 40) || criticalCount >= 2) {
        computedVerdict = 'HIGH_RISK';
      } else if (allScores.some(s => s < 70) || criticalCount >= 1) {
        computedVerdict = 'NEEDS_WORK';
      } else {
        computedVerdict = 'READY';
      }

      const buildCard = (key: string): AiScoreCard => {
        const data = parsed[key] as { score?: number; details?: string; concerns?: string[] } | undefined;
        return {
          label: key.charAt(0).toUpperCase() + key.slice(1),
          score: data?.score ?? 0,
          details: data?.details ?? '',
          concerns: data?.concerns ?? [],
        };
      };

      const analysisResult: AiAnalysisResult = {
        verdict: computedVerdict,
        overfitting: buildCard('overfitting'),
        consistency: buildCard('consistency'),
        risk: buildCard('risk'),
        robustness: buildCard('robustness'),
        verdictReason: (parsed.verdict_reason as string) ?? '',
        topConcerns: topConcerns.map(c => ({
          severity: (c.severity as 'critical' | 'warning' | 'info') ?? 'info',
          metric: c.metric ?? '',
          value: c.value ?? '',
          threshold: c.threshold ?? '',
          message: c.message ?? c.concern ?? '',
        })),
        bestHyperopt: (parsed.best_hyperopt as string) ?? null,
        bestFreqAI: (parsed.best_freqai as string) ?? null,
        recommendation: (parsed.recommendation as string) ?? '',
        model: selectedModel,
        cost: aiResponse.cost_usd ?? 0,
        timestamp: new Date().toISOString(),
        rawResponse: typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse, null, 2),
      };

      setResult(analysisResult);
      setHistory(prev => [analysisResult, ...prev]);
      toast.success(`AI Analysis complete: ${computedVerdict}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`AI Analysis failed: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  }, [strategy, botId, experimentId, scope, selectedModel, currentModel, toast]);

  return (
    <div className={LAYOUT_2COL}>
      {/* LEFT PANEL: FORM (380px) */}
      <div className="space-y-4">
        <div className={SECTION_CARD}>
          <div className={SECTION_TITLE}>AI Strategy Analyst</div>

          <div className="space-y-4">
            {/* Scope */}
            <div>
              <label className={LABEL}>Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className={SELECT}>
                <option value="all">All tests</option>
                <option value="backtest">Backtest results only</option>
                <option value="hyperopt">Hyperopt results only</option>
                <option value="freqai">FreqAI results only</option>
              </select>
            </div>

            {/* AI Model */}
            <div>
              <label className={LABEL}>AI Model</label>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className={SELECT}>
                {AI_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label} ({model.cost})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Estimated cost: <strong>{estimatedCost}</strong>
              </p>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className={`w-full ${BTN_PRIMARY}`}
            >
              {isRunning ? (
                <>
                  <div className="animate-spin text-sm">⟳</div>
                  Running Analysis...
                </>
              ) : (
                <>▶ Run AI Analysis</>
              )}
            </button>
          </div>
        </div>

        {/* Verdict Thresholds Reference */}
        <div className={SECTION_CARD}>
          <div className={SECTION_TITLE}>Verdict Rules (Hardcoded)</div>
          <div className="space-y-2">
            {(Object.entries(VERDICT_THRESHOLDS) as [AiVerdict, typeof VERDICT_THRESHOLDS[AiVerdict]][]).map(([key, val]) => {
              const cfg = verdictConfig(key);
              return (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-sm shrink-0">{cfg.icon}</span>
                  <div>
                    <div className={`text-[10px] font-bold ${cfg.color}`}>{key}</div>
                    <div className="text-[10px] text-muted-foreground">{val.rule}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Analysis History */}
        {history.length > 0 && (
          <div className={SECTION_CARD}>
            <div className={SECTION_TITLE}>History ({history.length})</div>
            <div className="space-y-1.5">
              {history.map((h, i) => {
                const cfg = verdictConfig(h.verdict);
                return (
                  <button
                    key={i}
                    onClick={() => setResult(h)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-btn bg-muted/30 border border-border hover:bg-muted/60 transition-all text-left"
                  >
                    <span className="text-xs">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-muted-foreground truncate">
                        {new Date(h.timestamp).toLocaleString()} · {h.model}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold ${cfg.color}`}>{h.verdict}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: RESULTS */}
      <div className="flex-1 min-w-0">
        {!result ? (
          <div className={`${SECTION_CARD} flex flex-col items-center justify-center min-h-[400px]`}>
            <div className="text-[32px] mb-3 opacity-30">AI</div>
            <div className="text-sm font-semibold text-muted-foreground mb-1">No AI analysis yet</div>
            <div className="text-xs text-muted-foreground text-center max-w-[280px]">
              Run tests first, then click &quot;Run AI Analysis&quot; to get a strategy review.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Verdict Banner */}
            {(() => {
              const cfg = verdictConfig(result.verdict);
              return (
                <div className={`rounded-card p-5 border ${cfg.bg}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{cfg.icon}</span>
                    <div>
                      <div className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</div>
                      {result.verdictReason && (
                        <div className="text-xs text-foreground/80 mt-0.5">{result.verdictReason}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {result.model} · {new Date(result.timestamp).toLocaleString()} · Cost: ${result.cost.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Four Score Cards */}
            <div className="grid grid-cols-2 gap-3">
              {[result.overfitting, result.consistency, result.risk, result.robustness].map((card) => {
                const isExpanded = expandedCard === card.label;
                return (
                  <button
                    key={card.label}
                    onClick={() => setExpandedCard(isExpanded ? null : card.label)}
                    className={`text-left p-4 rounded-card border transition-all ${scoreBg(card.score)} hover:brightness-110`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</span>
                      <span className={`text-lg font-bold tabular-nums ${scoreColor(card.score)}`}>{card.score}</span>
                    </div>
                    {/* Score bar */}
                    <div className="w-full bg-muted/50 rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          card.score >= 70 ? 'bg-emerald-500' : card.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${card.score}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{card.details}</p>
                    {isExpanded && card.concerns.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                        {card.concerns.map((c, i) => (
                          <div key={i} className="text-[10px] text-muted-foreground flex gap-1.5">
                            <span className="text-amber-400 shrink-0">•</span> {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Top Concerns */}
            {result.topConcerns.length > 0 && (
              <div className={SECTION_CARD}>
                <div className={SECTION_TITLE}>Top Concerns</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="text-left px-2 py-1.5 font-semibold"></th>
                        <th className="text-left px-2 py-1.5 font-semibold">Problem</th>
                        <th className="text-right px-2 py-1.5 font-semibold">Measured</th>
                        <th className="text-right px-2 py-1.5 font-semibold">Threshold</th>
                        <th className="text-left px-2 py-1.5 font-semibold">Explanation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.topConcerns.map((c, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              c.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' :
                              c.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-blue-500/10 text-blue-400'
                            }`}>{c.severity === 'critical' ? '🔴' : c.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                          </td>
                          <td className="px-2 py-1.5 font-medium text-foreground">{c.metric}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-rose-400">{c.value}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{c.threshold}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{c.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {(result.bestHyperopt || result.bestFreqAI || result.recommendation) && (
              <div className={SECTION_CARD}>
                <div className={SECTION_TITLE}>Recommendation</div>
                {result.recommendation && (
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{result.recommendation}</p>
                )}
                {result.bestHyperopt && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-muted-foreground">Best Hyperopt:</span>
                    <span className="text-xs text-primary font-medium">{result.bestHyperopt}</span>
                  </div>
                )}
                {result.bestFreqAI && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Best FreqAI:</span>
                    <span className="text-xs text-primary font-medium">{result.bestFreqAI}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons (§927-929) */}
            <div className="flex gap-2">
              <button
                onClick={() => onNavigateToTab?.(5)}
                className={`flex-1 ${BTN_PRIMARY}`}
              >
                Use this recommendation →
              </button>
              <button
                onClick={() => onNavigateToTab?.(2)}
                className={`flex-1 ${BTN_SECONDARY}`}
              >
                Choose myself
              </button>
            </div>

            {/* Raw Response (expandable) */}
            <details className="text-xs">
              <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Raw AI Response</summary>
              <pre className="mt-2 p-3 bg-muted/30 border border-border rounded-lg overflow-auto text-[10px] max-h-[400px] text-muted-foreground whitespace-pre-wrap">
                {result.rawResponse}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
