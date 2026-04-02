"use client";

import { useState, useEffect, useCallback } from "react";
import {
  strategyReview,
  fetchHyperoptAnalyses,
  type StrategyReviewResult,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ── Types ────────────────────────────────────────────────────────
interface AnalysisHistoryRow {
  date: string;
  source: string;
  model: string;
  score: number;
  cost: string;
  id: number;
}

interface Scores {
  robustness: number;
  risk: number;
  execution: number;
  overfitting: number;
  overall: number;
}

function scoreLabel(s: number): string {
  if (s >= 80) return "Excellent";
  if (s >= 70) return "Good";
  if (s >= 60) return "Moderate";
  if (s >= 50) return "Fair";
  return "Poor";
}

function scoreColor(s: number): string {
  if (s >= 75) return "text-up";
  if (s >= 60) return "text-white";
  return "text-down";
}

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
interface AiReviewTabProps {
  strategy?: string;
  experimentId?: number;
  onNavigateToTab?: (tab: number) => void;
}

export default function AiReviewTab({ strategy: propStrategy, experimentId, onNavigateToTab }: AiReviewTabProps) {
  const toast = useToast();
  const [model, setModel] = useState<"claude" | "grok">("claude");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Results
  const [scores, setScores] = useState<Scores | null>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState("");
  const [analysisResult, setAnalysisResult] = useState<StrategyReviewResult | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryRow[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<AnalysisHistoryRow | null>(null);

  // ── Fetch analysis history ────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const analyses = await fetchHyperoptAnalyses({ limit: 20 });
      const rows: AnalysisHistoryRow[] = (analyses || []).map((a) => {
        // Derive model from analysis_type or confidence fields
        const modelName = a.claude_confidence != null ? "Claude" : a.grok_confidence != null ? "Grok" : a.analysis_type || "—";
        // Derive score from overfitting_scores avg risk_score
        const avgScore = a.overfitting_scores?.length
          ? Math.round(a.overfitting_scores.reduce((sum, s) => sum + (s.risk_score ?? 0), 0) / a.overfitting_scores.length)
          : 0;
        return {
          date: a.created_at ? new Date(a.created_at).toLocaleString() : "—",
          source: a.strategy_name || propStrategy || "—",
          model: modelName,
          score: avgScore,
          cost: a.total_cost_usd != null ? `$${a.total_cost_usd.toFixed(2)}` : "—",
          id: a.id,
        };
      });
      setHistory(rows);
    } catch { /* not critical */ }
  }, [propStrategy]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Parse analysis result into structured data ────────────────────
  const parseAnalysis = useCallback((result: StrategyReviewResult) => {
    const a = result.analysis || {};
    // Extract scores
    const robustness = Number(a.robustness_score ?? a.robustness ?? 0);
    const risk = Number(a.risk_score ?? a.risk ?? 0);
    const execution = Number(a.execution_score ?? a.execution ?? 0);
    const overfitting = Number(a.overfitting_score ?? a.overfitting ?? 0);
    const overall = Number(a.overall_score ?? a.overall ?? 0) || Math.round((robustness + risk + execution + overfitting) / 4);
    setScores({ robustness, risk, execution, overfitting, overall });

    // Extract strengths
    const s = a.strengths as string[] | string | undefined;
    if (Array.isArray(s)) setStrengths(s);
    else if (typeof s === "string") setStrengths(s.split("\n").filter(Boolean));
    else setStrengths([]);

    // Extract concerns
    const c = a.concerns as string[] | string | undefined;
    if (Array.isArray(c)) setConcerns(c);
    else if (typeof c === "string") setConcerns(c.split("\n").filter(Boolean));
    else setConcerns([]);

    // Recommendation
    const rec = a.recommendation as string | undefined;
    setRecommendation(rec || a.summary as string || "");
  }, []);

  // ── Run Analysis ──────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing || !propStrategy) return;
    setIsAnalyzing(true);

    try {
      const result = await strategyReview({
        strategy: propStrategy,
        model: model,
        system_prompt: "You are an expert quantitative trading strategy reviewer. Analyze the strategy and provide: robustness_score (0-100), risk_score (0-100), execution_score (0-100), overfitting_score (0-100), overall_score (0-100), strengths (list), concerns (list), recommendation (text).",
        user_prompt: `Review strategy ${propStrategy} based on its backtest results. Provide structured JSON with scores, strengths, concerns, and recommendation.`,
        scope: "full_review",
      });

      setAnalysisResult(result);
      parseAnalysis(result);
      toast.success(`Analysis complete — cost: $${result.cost_usd?.toFixed(3) ?? "?"}`);
      fetchHistory();
    } catch (err) {
      toast.error(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, propStrategy, model, toast, parseAnalysis, fetchHistory]);

  // ── View history entry ────────────────────────────────────────────
  const handleViewHistory = useCallback((row: AnalysisHistoryRow) => {
    setSelectedHistory(row);
    toast.success(`Viewing analysis #${row.id} from ${row.date}`);
  }, [toast]);

  // Suppress unused
  void experimentId; void onNavigateToTab; void selectedHistory; void analysisResult;

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto">
      {/* ── 1. Header Bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="section-title">AI Review</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="bg-surface l-bd rounded px-2.5 py-1.5 text-[11px] font-mono">
            <span className="text-muted">Scope:</span> <span className="text-white">{propStrategy || "—"}</span>
          </span>
          <select
            className="builder-select text-[11px] font-mono"
            value={model}
            onChange={(e) => setModel(e.target.value as "claude" | "grok")}
          >
            <option value="claude">Claude</option>
            <option value="grok">Grok</option>
          </select>
          <span className="bg-surface l-bd rounded px-2.5 py-1.5 text-[11px] font-mono">
            <span className="text-muted">Cost:</span>{" "}
            <span className="text-muted">{analysisResult ? `$${analysisResult.cost_usd?.toFixed(3)}` : "~$0.03"}</span>
          </span>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-white text-black rounded hover:bg-white/85 transition-colors disabled:opacity-40"
          >
            {isAnalyzing ? "⏳ Analyzing..." : "▶ Analyze"}
          </button>
        </div>
      </div>

      {/* ── 2. Score Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Robustness</div>
          <div className={`kpi-value text-xl ${scoreColor(scores?.robustness ?? 0)}`}>{scores?.robustness ?? "—"}</div>
          <div className={`text-[10px] ${scoreColor(scores?.robustness ?? 0)} font-mono`}>{scores ? scoreLabel(scores.robustness) : "—"}</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Risk</div>
          <div className={`kpi-value text-xl ${scoreColor(scores?.risk ?? 0)}`}>{scores?.risk ?? "—"}</div>
          <div className={`text-[10px] ${scoreColor(scores?.risk ?? 0)} font-mono`}>{scores ? scoreLabel(scores.risk) : "—"}</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Execution</div>
          <div className={`kpi-value text-xl ${scoreColor(scores?.execution ?? 0)}`}>{scores?.execution ?? "—"}</div>
          <div className={`text-[10px] ${scoreColor(scores?.execution ?? 0)} font-mono`}>{scores ? scoreLabel(scores.execution) : "—"}</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded">
          <div className="kpi-label">Overfitting</div>
          <div className={`kpi-value text-xl ${scoreColor(scores?.overfitting ?? 0)}`}>{scores?.overfitting ?? "—"}</div>
          <div className={`text-[10px] ${scoreColor(scores?.overfitting ?? 0)} font-mono`}>{scores ? scoreLabel(scores.overfitting) : "—"}</div>
        </div>
        <div className="bg-surface p-3 l-bd rounded border-l-2 border-l-up">
          <div className="kpi-label">Overall</div>
          <div className={`kpi-value text-white text-xl`}>{scores?.overall ?? "—"}</div>
          <div className={`text-[10px] ${scoreColor(scores?.overall ?? 0)} font-mono`}>{scores ? scoreLabel(scores.overall) : "—"}</div>
        </div>
      </div>

      {/* ── 3. Analysis Content ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-surface l-bd rounded p-3 text-[11px] font-mono space-y-2">
          <div className="text-up font-bold text-[10px] uppercase tracking-wider">✓ Strengths</div>
          <div className="text-muted leading-relaxed">
            {strengths.length > 0 ? (
              strengths.map((s, i) => <div key={i}>• {s}</div>)
            ) : (
              <span className="text-white/20">Run analysis to see strengths</span>
            )}
          </div>
        </div>
        <div className="bg-surface l-bd rounded p-3 text-[11px] font-mono space-y-2">
          <div className="text-down font-bold text-[10px] uppercase tracking-wider">⚠ Concerns</div>
          <div className="text-muted leading-relaxed">
            {concerns.length > 0 ? (
              concerns.map((c, i) => <div key={i}>• {c}</div>)
            ) : (
              <span className="text-white/20">Run analysis to see concerns</span>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Recommendation ──────────────────────────────────────── */}
      <div className="bg-surface l-bd rounded p-3 text-[11px] font-mono border-l-2 border-l-white/30">
        <div className="text-white font-bold text-[10px] uppercase tracking-wider mb-2">→ Recommendation</div>
        <div className="text-muted leading-relaxed">
          {recommendation || <span className="text-white/20">Run analysis to see recommendation</span>}
        </div>
      </div>

      {/* ── 5. Analysis History ─────────────────────────────────────── */}
      <h3 className="section-title">Analysis History</h3>
      {history.length === 0 ? (
        <div className="text-[11px] text-white/20 py-4 text-center">No analysis history — run your first review above</div>
      ) : (
      <table className="w-full text-[13px] font-mono whitespace-nowrap">
        <thead>
          <tr className="text-muted text-[11px] uppercase tracking-widest">
            <th className="px-2 py-1.5 text-left">Date</th>
            <th className="px-2 py-1.5 text-left">Source</th>
            <th className="px-2 py-1.5 text-left">Model</th>
            <th className="px-2 py-1.5 text-right">Score</th>
            <th className="px-2 py-1.5 text-right">Cost</th>
            <th className="px-2 py-1.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {history.map((row, i) => (
            <tr key={i} className="hover:bg-white/[0.04]">
              <td className="px-2 py-1.5 text-muted">{row.date}</td>
              <td className="px-2 py-1.5 text-white">{row.source}</td>
              <td className="px-2 py-1.5 text-muted">{row.model}</td>
              <td className="px-2 py-1.5 text-right text-white">{row.score}</td>
              <td className="px-2 py-1.5 text-right text-muted">{row.cost}</td>
              <td className="px-2 py-1.5 text-right">
                <button
                  onClick={() => handleViewHistory(row)}
                  className="px-2 py-0.5 l-bd rounded text-[9px] text-muted hover:text-white hover:bg-white/5 transition-colors"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
