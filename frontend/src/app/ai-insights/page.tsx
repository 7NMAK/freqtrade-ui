"use client";

/**
 * AI Insights Page -- AI Validation Layer dashboard
 *
 * Widgets:
 *   AI-1  Overview stat cards (total validations, agreement rate, avg confidence, cost)
 *   AI-2  Recent Validations table (expandable rows with reasoning)
 *   AI-3  Accuracy History chart (rolling per-advisor, Recharts line)
 *   AI-4  Agreement Rate breakdown (horizontal bar)
 *   AI-5  Cost Tracker (daily cost, remaining budget, per-advisor)
 *   AI-6  Config panel (enable/disable toggle, max cost)
 *   AI-7  Manual trigger button
 *   AI-8  Strong Disagree Alerts
 *   AI-9  Hyperopt Analyses table
 */

import React, { useEffect, useState, useCallback } from "react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import AppShell from "@/components/layout/AppShell";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { SkeletonStat, SkeletonTable, SkeletonChart } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  fetchAIValidations,
  fetchAIAccuracy,
  fetchAIAccuracyHistory,
  fetchAIAgreementRate,
  fetchAICost,
  fetchAIConfig,
  updateAIConfig,
  triggerAIValidation,
  fetchHyperoptAnalyses,
  fetchHyperoptAnalysis,
  fetchHyperoptComparisonStats,
  getBots,
  ApiError,
} from "@/lib/api";
import type {
  AIValidation,
  AIAccuracyStats,
  AIAccuracyHistory,
  AIAgreementRate,
  AICost,
  AIConfig,
  AIHyperoptAnalysis,
  AIHyperoptComparisonStats,
  Bot,
} from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// -- Helpers -------------------------------------------------------------------

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function pctDirect(value: number): string {
  return `${value.toFixed(1)}%`;
}

function directionBadge(dir: string) {
  if (dir === "long")
    return <span className="text-emerald-500 font-semibold">LONG</span>;
  if (dir === "short")
    return <span className="text-rose-500 font-semibold">SHORT</span>;
  return <span className="text-muted-foreground font-semibold">NEUTRAL</span>;
}

function agreeBadge(allAgree: boolean, strongDisagree: boolean) {
  if (strongDisagree)
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red/10 text-rose-500 border border-rose-500/20 uppercase">
        Disagree
      </span>
    );
  if (allAgree)
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green/10 text-emerald-500 border border-emerald-500/20 uppercase">
        All Agree
      </span>
    );
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber/10 text-amber-500 border border-amber-500-500/20 uppercase">
      Partial
    </span>
  );
}

// -- Accuracy history chart data transform ------------------------------------

function buildAccuracyChartData(history: AIAccuracyHistory | null) {
  if (!history?.history) return [];
  return Object.entries(history.history)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, advisors]) => ({
      day: day.slice(5), // MM-DD
      freqai: advisors.freqai ?? null,
      claude: advisors.claude ?? null,
      grok: advisors.grok ?? null,
    }));
}

// -- Page component -----------------------------------------------------------

export default function AIInsightsPage() {
  const toast = useToast();

  // Data state
  const [validations, setValidations] = useState<AIValidation[]>([]);
  const [accuracy, setAccuracy] = useState<AIAccuracyStats | null>(null);
  const [accuracyHistory, setAccuracyHistory] = useState<AIAccuracyHistory | null>(null);
  const [agreement, setAgreement] = useState<AIAgreementRate | null>(null);
  const [cost, setCost] = useState<AICost | null>(null);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [hyperoptAnalyses, setHyperoptAnalyses] = useState<AIHyperoptAnalysis[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [hyperoptStats, setHyperoptStats] = useState<AIHyperoptComparisonStats | null>(null);
  const [hyperoptStatsLoading, setHyperoptStatsLoading] = useState(false);
  const [expandedAnalysisId, setExpandedAnalysisId] = useState<number | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<AIHyperoptAnalysis | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [showDisagreeOnly, setShowDisagreeOnly] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [configEnabled, setConfigEnabled] = useState(false);
  const [maxCost, setMaxCost] = useState("5.00");
  const [savingConfig, setSavingConfig] = useState(false);
  const [triggerBotId, setTriggerBotId] = useState<string>("");
  const [triggering, setTriggering] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [v, acc, accH, agr, co, cfg, ho, b] = await Promise.allSettled([
        fetchAIValidations({ limit: 50, strongDisagreeOnly: showDisagreeOnly }),
        fetchAIAccuracy(),
        fetchAIAccuracyHistory(30),
        fetchAIAgreementRate(30),
        fetchAICost(30),
        fetchAIConfig(),
        fetchHyperoptAnalyses({ limit: 20 }),
        getBots().catch((err) => { toast.error(err instanceof Error ? err.message : "Failed to load bots"); return []; }),
      ]);

      if (v.status === "fulfilled") setValidations(v.value);
      if (acc.status === "fulfilled") setAccuracy(acc.value);
      if (accH.status === "fulfilled") setAccuracyHistory(accH.value);
      if (agr.status === "fulfilled") setAgreement(agr.value);
      if (co.status === "fulfilled") setCost(co.value);
      if (cfg.status === "fulfilled") {
        const c = cfg.value;
        setConfig(c);
        setConfigEnabled(c.enabled);
        setMaxCost(String(c.max_daily_cost_usd));
      }
      if (ho.status === "fulfilled") setHyperoptAnalyses(ho.value);

      setHyperoptStatsLoading(true);
      fetchHyperoptComparisonStats()
        .then((d) => { setHyperoptStats(d); setHyperoptStatsLoading(false); })
        .catch(() => { setHyperoptStatsLoading(false); });

      if (b.status === "fulfilled") {
        const botList = b.value;
        setBots(botList);
        if (botList.length > 0 && !triggerBotId) setTriggerBotId(String(botList[0].id));
      }
    } catch { /* non-blocking */
      toast.error("Failed to load AI Insights data");
    } finally {
      setLoading(false);
    }
  }, [showDisagreeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadAll();
    const interval = setInterval(() => void loadAll(), REFRESH_INTERVALS.AI_INSIGHTS);
    return () => clearInterval(interval);
  }, [loadAll]);

  // -- Handlers ---------------------------------------------------------------

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await updateAIConfig({
        enabled: configEnabled,
        max_daily_cost_usd: parseFloat(maxCost) || 5.0,
      });
      toast.success("AI config saved");
      void loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save config");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTriggerValidation = async () => {
    if (!triggerBotId) return;
    setTriggering(true);
    try {
      const result = await triggerAIValidation(parseInt(triggerBotId, 10));
      toast.success(result.message || "Validation triggered");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Trigger failed");
    } finally {
      setTriggering(false);
    }
  };

  // -- Derived data -----------------------------------------------------------

  const disagreeCount = validations.filter((v) => v.strong_disagree).length;
  const displayed = showDisagreeOnly
    ? validations.filter((v) => v.strong_disagree)
    : validations;

  const avgConfidence = validations.length > 0
    ? validations.reduce((s, v) => s + v.combined_confidence, 0) / validations.length
    : 0;

  const chartData = buildAccuracyChartData(accuracyHistory);

  // -- Loading state ----------------------------------------------------------

  if (loading) {
    return (
      <AppShell title="AI Insights">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <SkeletonStat key={`skel-ai-${i}`} />)}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <SkeletonChart height={240} />
          <SkeletonChart height={240} />
        </div>
        <SkeletonTable rows={6} cols={10} />
      </AppShell>
    );
  }

  return (
    <AppShell title="AI Insights">
      {/* -- Status Banner --------------------------------------------------- */}
      <div className="flex gap-3 flex-wrap mb-6">
        <span
          className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
            config?.enabled
              ? "bg-green/10 text-emerald-500 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {config?.enabled ? "AI Validation Active" : "AI Validation Disabled"}
        </span>
        {!config?.api_key_configured && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber/10 text-amber-500 border border-amber-500-500/20">
            No OpenRouter API key configured
          </span>
        )}
        {disagreeCount > 0 && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red/10 text-rose-500 border border-rose-500/20">
            {disagreeCount} strong disagreement{disagreeCount > 1 ? "s" : ""} in last 50
          </span>
        )}
      </div>

      {/* -- AI-1: Overview Stat Cards --------------------------------------- */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody>
            <div className="text-xs text-muted-foreground uppercase tracking-[0.4px] mb-1">
              Total Validations (30d)
            </div>
            <div className="text-2xl font-bold text-foreground">
              {cost?.total_validations ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              ${(cost?.avg_cost_per_validation ?? 0).toFixed(4)} avg cost
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-xs text-muted-foreground uppercase tracking-[0.4px] mb-1">
              Agreement Rate
            </div>
            <div className="text-2xl font-bold text-emerald-500">
              {pctDirect(agreement?.all_agree_pct ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {agreement?.all_agree ?? 0} / {agreement?.total_validations ?? 0} all agree
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-xs text-muted-foreground uppercase tracking-[0.4px] mb-1">
              Avg Confidence
            </div>
            <div className="text-2xl font-bold text-primary">
              {pct(avgConfidence)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Combined score across advisors
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-xs text-muted-foreground uppercase tracking-[0.4px] mb-1">
              30d API Cost
            </div>
            <div className="text-2xl font-bold text-foreground">
              ${(cost?.total_cost_usd ?? 0).toFixed(4)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              ~${(cost?.projected_monthly_usd ?? 0).toFixed(2)}/mo projected
            </div>
          </CardBody>
        </Card>
      </div>

      {/* -- AI-3 + AI-4: Charts Row ---------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Accuracy History Line Chart */}
        <Card>
          <CardHeader
            title="Accuracy History"
            icon="&#128200;"
            action={
              <span className="text-xs text-muted-foreground">Rolling 30d per advisor</span>
            }
          />
          <CardBody className="p-4">
            {chartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No accuracy data yet. Close some trades with AI validations.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={{ stroke: "#1e293b" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`]}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="freqai"
                    name="FreqAI"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="claude"
                    name="Claude"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="grok"
                    name="Grok"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* Agreement Rate Breakdown + Accuracy Bars */}
        <Card>
          <CardHeader
            title="Advisor Accuracy & Agreement"
            icon="&#127919;"
            action={
              <span className="text-xs text-muted-foreground">
                {agreement?.total_validations ?? 0} validations
              </span>
            }
          />
          <CardBody className="space-y-5">
            {/* Per-advisor accuracy bars */}
            {(["freqai", "claude", "grok"] as const).map((advisor) => {
              const stats = accuracy?.[advisor];
              const p = stats?.pct ?? 0;
              const barColor =
                p >= 70 ? "bg-green" : p >= 55 ? "bg-amber" : "bg-red";
              const textColor =
                p >= 70 ? "text-emerald-500" : p >= 55 ? "text-amber-500" : "text-rose-500";
              const label = advisor === "freqai" ? "FreqAI" : advisor === "claude" ? "Claude" : "Grok";
              return (
                <div key={advisor}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-xs font-bold ${textColor}`}>
                      {p.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {stats?.correct ?? 0} / {stats?.total ?? 0} correct
                  </div>
                </div>
              );
            })}

            {/* Agreement breakdown */}
            <div className="border-t border-border pt-4 mt-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Agreement Breakdown (30d)
              </div>
              {[
                { label: "All Agree", count: agreement?.all_agree ?? 0, color: "bg-green", textColor: "text-emerald-500" },
                { label: "Partial", count: agreement?.partial_agree ?? 0, color: "bg-amber", textColor: "text-amber-500" },
                { label: "Strong Disagree", count: agreement?.strong_disagree ?? 0, color: "bg-red", textColor: "text-rose-500" },
              ].map((item) => {
                const total = agreement?.total_validations || 1;
                const widthPct = (item.count / total) * 100;
                return (
                  <div key={item.label} className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                    <span className="text-xs text-muted-foreground w-28">{item.label}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold min-w-[40px] text-right ${item.textColor}`}>
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* -- AI-8: Strong Disagree Alerts ------------------------------------ */}
      {disagreeCount > 0 && (
        <Card className="mb-6 border-rose-500/20">
          <CardHeader title="Strong Disagreements" icon="&#9888;" />
          <CardBody className="p-0">
            <div className="divide-y divide-border/40">
              {validations
                .filter((v) => v.strong_disagree)
                .slice(0, 10)
                .map((v) => (
                  <div
                    key={`alert-${v.id}`}
                    className="flex items-center gap-4 px-6 py-3 bg-red/[0.03] hover:bg-red/[0.06] transition-colors text-xs"
                  >
                    <span className="font-bold text-foreground min-w-[90px]">{v.pair}</span>
                    <span className="text-muted-foreground">
                      FreqAI: {directionBadge(v.freqai_direction)} {" / "}
                      Claude: {directionBadge(v.claude_direction)} {" / "}
                      Grok: {directionBadge(v.grok_direction)}
                    </span>
                    <span className="text-rose-500 font-semibold ml-auto">
                      Combined: {pct(v.combined_confidence)}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* -- AI-2: Recent Validations Table ---------------------------------- */}
      <Card className="mb-6">
        <CardHeader
          title="AI Signal Feed"
          icon="&#128225;"
          action={
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDisagreeOnly}
                onChange={(e) => setShowDisagreeOnly(e.target.checked)}
                className="accent-accent"
              />
              Disagreements only
            </label>
          }
        />
        {displayed.length === 0 ? (
          <CardBody>
            <div className="text-center py-8 text-muted-foreground text-xs">
              {showDisagreeOnly
                ? "No strong disagreements in recent validations."
                : "No AI validations yet. Enable AI Validation and open trades."}
            </div>
          </CardBody>
        ) : (
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Status", "Trade", "Pair", "FreqAI", "Claude", "Grok", "Combined", "Agreement", "Cost", "Time"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((v) => (
                  <tr
                    key={`row-${v.id}`}
                    className={`hover:bg-muted transition-colors cursor-pointer border-b border-border/40 ${
                      v.strong_disagree ? "bg-red/[0.04]" : v.all_agree ? "bg-green/[0.02]" : ""
                    }`}
                    onClick={() => setExpandedRow(expandedRow === v.id ? null : v.id)}
                  >
                    <td className="px-4 py-3 text-xs">
                      {agreeBadge(v.all_agree, v.strong_disagree)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-foreground">#{v.ft_trade_id}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">{v.pair}</td>
                    <td className="px-4 py-3 text-xs">
                      {directionBadge(v.freqai_direction)}{" "}
                      <span className="text-muted-foreground text-xs">{pct(v.freqai_confidence)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {directionBadge(v.claude_direction)}{" "}
                      <span className="text-muted-foreground text-xs">{pct(v.claude_confidence)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {directionBadge(v.grok_direction)}{" "}
                      <span className="text-muted-foreground text-xs">{pct(v.grok_confidence)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="relative bg-muted rounded h-[18px] w-[80px] overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-300"
                          style={{
                            width: `${v.combined_confidence * 100}%`,
                            background:
                              v.combined_confidence > 0.7
                                ? "#22c55e"
                                : v.combined_confidence > 0.5
                                ? "#f59e0b"
                                : "#ef4444",
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-sm">
                          {pct(v.combined_confidence)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {(v.agreement_pct * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      ${v.total_cost_usd.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(v.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Expanded reasoning rows */}
            {expandedRow !== null && (() => {
              const v = validations.find((val) => val.id === expandedRow);
              if (!v) return null;
              return (
                <div className="border-t border-border bg-primary/[0.03] px-6 py-4 space-y-2">
                  {v.claude_reasoning && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-bold text-foreground mr-2">Claude:</span>
                      {v.claude_reasoning}
                    </div>
                  )}
                  {v.grok_reasoning && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-bold text-foreground mr-2">Grok:</span>
                      {v.grok_reasoning}
                    </div>
                  )}
                  {v.claude_sentiment && (
                    <div className="text-xs text-muted-foreground">
                      Sentiment: Claude={v.claude_sentiment} / Grok={v.grok_sentiment ?? "n/a"}
                      {" | "}
                      Regime: Claude={v.claude_regime ?? "n/a"} / Grok={v.grok_regime ?? "n/a"}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardBody>
        )}
      </Card>

      {/* -- AI-5 + AI-6 + AI-7: Cost + Config + Trigger Row --------------- */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Cost Tracker */}
        <Card>
          <CardHeader title="Cost Tracker" icon="&#128176;" />
          <CardBody className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">30d Total</span>
              <span className="text-lg font-bold text-foreground">
                ${(cost?.total_cost_usd ?? 0).toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Projected Monthly</span>
              <span className="text-sm font-semibold text-amber-500">
                ~${(cost?.projected_monthly_usd ?? 0).toFixed(2)}
              </span>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Daily Budget</span>
              <span className="text-sm font-semibold text-foreground">
                ${(config?.max_daily_cost_usd ?? 5).toFixed(2)}
              </span>
            </div>
            <hr className="border-border" />
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Per-Advisor Tokens (30d)
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Claude</span>
              <span className="font-mono text-foreground">
                {((cost?.claude_tokens_used ?? 0) / 1000).toFixed(1)}k
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Grok</span>
              <span className="font-mono text-foreground">
                {((cost?.grok_tokens_used ?? 0) / 1000).toFixed(1)}k
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Config Panel */}
        <Card>
          <CardHeader title="AI Configuration" icon="&#9881;" />
          <CardBody className="space-y-3">
            {config ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Enabled</span>
                  <button
                    type="button"
                    onClick={() => setConfigEnabled(!configEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      configEnabled ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        configEnabled ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Max Daily Cost</span>
                  <input
                    type="number"
                    value={maxCost}
                    min="0.01"
                    step="0.50"
                    onChange={(e) => setMaxCost(e.target.value)}
                    className="w-24 py-1.5 px-2.5 rounded-btn border border-border bg-muted text-foreground text-xs outline-none focus:border-primary text-right"
                  />
                </div>

                <hr className="border-border" />

                <div className="space-y-1.5">
                  {[
                    { label: "Claude Model", value: config.claude_model },
                    { label: "Grok Model", value: config.grok_model },
                    {
                      label: "Weights",
                      value: `${(config.weight_freqai * 100).toFixed(0)}/${(config.weight_claude * 100).toFixed(0)}/${(config.weight_grok * 100).toFixed(0)}`,
                    },
                    { label: "Max/Hour", value: String(config.max_validations_per_hour) },
                    { label: "API Key", value: config.api_key_configured ? "Configured" : "Not set" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={`font-mono text-foreground ${row.label === "API Key" && !config.api_key_configured ? "text-rose-500" : ""}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handleSaveConfig()}
                  disabled={savingConfig}
                  className="w-full py-2 px-4 rounded-btn bg-primary text-white text-xs font-semibold cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingConfig ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-xs">
                Config unavailable
              </div>
            )}
          </CardBody>
        </Card>

        {/* Manual Trigger */}
        <Card>
          <CardHeader title="Manual Validation" icon="&#9889;" />
          <CardBody className="space-y-3">
            <div className="text-xs text-muted-foreground mb-2">
              Trigger AI validation for all open trades on a bot. Runs asynchronously.
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Select Bot
              </div>
              <select
                value={triggerBotId}
                onChange={(e) => setTriggerBotId(e.target.value)}
                className="w-full py-2.5 px-3.5 rounded-btn border border-border bg-muted text-foreground text-xs outline-none focus:border-primary cursor-pointer"
              >
                {bots.length === 0 && <option value="">No bots available</option>}
                {bots.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name} ({b.status})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void handleTriggerValidation()}
              disabled={triggering || !triggerBotId}
              className="w-full py-2.5 px-4 rounded-btn bg-amber text-black text-xs font-bold cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {triggering ? "Triggering..." : "Validate Now"}
            </button>
          </CardBody>
        </Card>
      </div>

      {/* -- AI-9: Hyperopt Analyses Table ----------------------------------- */}
      <Card className="mb-6">
        <CardHeader
          title="Hyperopt AI Analyses"
          icon="&#128300;"
          action={
            <span className="text-xs text-muted-foreground">
              Recent pre/post hyperopt AI advisory sessions
            </span>
          }
        />
        {hyperoptAnalyses.length === 0 ? (
          <CardBody>
            <div className="text-center py-8 text-muted-foreground text-xs">
              No hyperopt analyses yet. Use &quot;AI Suggest&quot; on the Backtesting page.
            </div>
          </CardBody>
        ) : (
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Type", "Strategy", "Pair", "TF", "Suggestion", "Claude", "Grok", "Cost", "Time"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hyperoptAnalyses.map((a) => (
                  <React.Fragment key={`ho-${a.id}`}>
                  <tr
                    className="hover:bg-muted transition-colors border-b border-border/40 cursor-pointer"
                    onClick={async () => {
                      if (expandedAnalysisId === a.id) { setExpandedAnalysisId(null); setExpandedAnalysis(null); return; }
                      setExpandedAnalysisId(a.id);
                      try { const detail = await fetchHyperoptAnalysis(a.id); setExpandedAnalysis(detail); }
                      catch { /* load failed — collapse row */ setExpandedAnalysis(null); }
                    }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          a.analysis_type === "pre_hyperopt"
                            ? "bg-primary/10 text-primary"
                            : "bg-amber/10 text-amber-500"
                        }`}
                      >
                        {a.analysis_type === "pre_hyperopt" ? "PRE" : "POST"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-foreground">
                      {a.strategy_name}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">
                      {a.pair}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.timeframe}</td>
                    <td className="px-4 py-3 text-xs font-mono text-foreground">
                      {a.analysis_type === "pre_hyperopt"
                        ? a.suggested_loss_function ?? "\u2014"
                        : `Result #${(a.recommended_result_index ?? 0) + 1}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {a.claude_confidence != null ? pct(a.claude_confidence) : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {a.grok_confidence != null ? pct(a.grok_confidence) : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      ${a.total_cost_usd.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                  </tr>
                  {expandedAnalysisId === a.id && expandedAnalysis && (
                    <tr><td colSpan={9} className="bg-card border-b border-border px-4 py-3">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div><span className="text-muted-foreground block text-2xs uppercase mb-0.5">Suggested Loss</span><span className="font-mono text-foreground">{expandedAnalysis.suggested_loss_function ?? "\u2014"}</span></div>
                        <div><span className="text-muted-foreground block text-2xs uppercase mb-0.5">Suggested Sampler</span><span className="font-mono text-foreground">{expandedAnalysis.suggested_sampler ?? "\u2014"}</span></div>
                        <div><span className="text-muted-foreground block text-2xs uppercase mb-0.5">Suggested Epochs</span><span className="font-mono text-foreground">{expandedAnalysis.suggested_epochs ?? "\u2014"}</span></div>
                      </div>
                      {expandedAnalysis.overfitting_scores.length > 0 && (
                        <div className="mt-2">
                          <span className="text-muted-foreground text-2xs uppercase">Overfitting Risk:</span>
                          <div className="flex gap-2 mt-1">
                            {expandedAnalysis.overfitting_scores.map((s, i) => (
                              <span key={`of-${i}-${s.verdict}`} className={`text-xs px-2 py-0.5 rounded border ${
                                s.verdict === "SAFE" ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" :
                                s.verdict === "CAUTION" ? "border-amber-500/30 text-amber-500 bg-amber-500/10" :
                                "border-rose-500/30 text-rose-500 bg-rose-500/10"
                              }`}>#{s.result_index ?? i}: {s.verdict} ({s.risk_score?.toFixed(2) ?? "?"})</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 text-2xs text-muted-foreground">Baseline: profit {expandedAnalysis.baseline_profit != null ? `${(expandedAnalysis.baseline_profit * 100).toFixed(2)}%` : "\u2014"} | Sharpe {expandedAnalysis.baseline_sharpe?.toFixed(2) ?? "\u2014"} | Max DD {expandedAnalysis.baseline_max_drawdown != null ? `${(expandedAnalysis.baseline_max_drawdown * 100).toFixed(1)}%` : "\u2014"}</div>
                    </td></tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </CardBody>
        )}
      </Card>

      {/* AI-10: Hyperopt AI Performance */}
      <Card className="mb-6">
        <CardHeader title="Hyperopt AI Performance" icon="&#128202;"
          action={<span className="text-xs text-muted-foreground">Followed vs ignored AI recommendations</span>} />
        <CardBody>
          {hyperoptStatsLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">Loading...</div>
          ) : hyperoptStats ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-emerald-500/20 rounded-lg p-4">
                <div className="text-2xs text-emerald-500 uppercase tracking-wide mb-2 font-semibold">Followed AI</div>
                <div className="text-lg font-bold text-foreground mb-1">{hyperoptStats.followed_ai.count} times</div>
                <div className="text-xs text-muted-foreground">Avg paper result: <span className={`font-bold ${hyperoptStats.followed_ai.avg_paper_result != null && hyperoptStats.followed_ai.avg_paper_result >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{hyperoptStats.followed_ai.avg_paper_result != null ? `${(hyperoptStats.followed_ai.avg_paper_result * 100).toFixed(1)}%` : "\u2014"}</span></div>
                <div className="text-xs text-muted-foreground">Avg live result: <span className={`font-bold ${hyperoptStats.followed_ai.avg_live_result != null && hyperoptStats.followed_ai.avg_live_result >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{hyperoptStats.followed_ai.avg_live_result != null ? `${(hyperoptStats.followed_ai.avg_live_result * 100).toFixed(1)}%` : "\u2014"}</span></div>
              </div>
              <div className="bg-card border border-rose-500/20 rounded-lg p-4">
                <div className="text-2xs text-rose-500 uppercase tracking-wide mb-2 font-semibold">Ignored AI</div>
                <div className="text-lg font-bold text-foreground mb-1">{hyperoptStats.ignored_ai.count} times</div>
                <div className="text-xs text-muted-foreground">Avg paper result: <span className={`font-bold ${hyperoptStats.ignored_ai.avg_paper_result != null && hyperoptStats.ignored_ai.avg_paper_result >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{hyperoptStats.ignored_ai.avg_paper_result != null ? `${(hyperoptStats.ignored_ai.avg_paper_result * 100).toFixed(1)}%` : "\u2014"}</span></div>
                <div className="text-xs text-muted-foreground">Avg live result: <span className={`font-bold ${hyperoptStats.ignored_ai.avg_live_result != null && hyperoptStats.ignored_ai.avg_live_result >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{hyperoptStats.ignored_ai.avg_live_result != null ? `${(hyperoptStats.ignored_ai.avg_live_result * 100).toFixed(1)}%` : "\u2014"}</span></div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">No hyperopt AI performance data yet</div>
          )}
        </CardBody>
      </Card>
    </AppShell>
  );
}
