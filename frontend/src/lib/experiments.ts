/**
 * experiments.ts — Types, constants, and helpers for Testing & Experiments section.
 *
 * ANTI-HALLUCINATION: All FT field names come from types/index.ts.
 * All loss functions, samplers, models from FREQTRADE_REFERENCE.md §5, §6, §24.
 */

// ── Pipeline Steps ────────────────────────────────────────────────────────

export const PIPELINE_STEPS = [
  { key: "backtest", label: "Backtest" },
  { key: "hyperopt", label: "Hyperopt" },
  { key: "freqai", label: "FreqAI", optional: true },
  { key: "verify", label: "Verify" },
  { key: "ai_review", label: "AI Review", optional: true },
  { key: "paper", label: "Paper" },
  { key: "live", label: "Live" },
] as const;

export type PipelineStepKey = (typeof PIPELINE_STEPS)[number]["key"];

export type StepState = "completed" | "active" | "pending" | "skipped";

// ── Hyperopt Loss Functions (§6 — ALL 12, exact FT names) ─────────────────

export const LOSS_FUNCTIONS = [
  { value: "ShortTradeDurHyperOptLoss", label: "ShortTradeDur", tip: "Maximize profit while minimizing trade duration — favors fast profitable trades" },
  { value: "OnlyProfitHyperOptLoss", label: "OnlyProfit", tip: "Maximize absolute profit only — ignores risk, good for initial exploration" },
  { value: "SharpeHyperOptLoss", label: "Sharpe", tip: "Maximize Sharpe ratio — balances return vs volatility, standard risk-adjusted metric" },
  { value: "SharpeHyperOptLossDaily", label: "SharpeDaily", tip: "Sharpe ratio calculated on daily returns — less sensitive to intraday noise" },
  { value: "SortinoHyperOptLoss", label: "Sortino", tip: "Maximize Sortino ratio — like Sharpe but only penalizes downside volatility" },
  { value: "SortinoHyperOptLossDaily", label: "SortinoDaily", tip: "Sortino ratio on daily returns — best for strategies that should minimize daily losses" },
  { value: "CalmarHyperOptLoss", label: "Calmar", tip: "Maximize Calmar ratio — annual return divided by max drawdown, good for risk-averse" },
  { value: "MaxDrawDownHyperOptLoss", label: "MaxDrawDown", tip: "Minimize maximum drawdown — prioritizes capital preservation above all else" },
  { value: "MaxDrawDownRelativeHyperOptLoss", label: "MaxDrawDownRelative", tip: "Minimize relative drawdown — drawdown as percentage of peak equity" },
  { value: "MaxDrawDownPerPairHyperOptLoss", label: "MaxDrawDownPerPair", tip: "Minimize the worst drawdown of any single pair — prevents one pair from dragging portfolio" },
  { value: "ProfitDrawDownHyperOptLoss", label: "ProfitDrawDown", tip: "Balance between profit and drawdown — penalizes high-profit strategies with excessive drawdown" },
  { value: "MultiMetricHyperOptLoss", label: "MultiMetric", tip: "Combines multiple metrics (Sharpe, Sortino, profit, DD) into one weighted score — most comprehensive" },
] as const;

// ── Hyperopt Samplers (§6 — ALL 6, exact FT names) ───────────────────────

export const SAMPLERS = [
  { value: "TPESampler", label: "TPE", tip: "Tree-structured Parzen Estimator — bayesian optimization, good general-purpose sampler" },
  { value: "GPSampler", label: "GPS", tip: "Gaussian Process Sampler — models parameter space as Gaussian process, good for smooth spaces" },
  { value: "CmaEsSampler", label: "CmaEs", tip: "Covariance Matrix Adaptation Evolution Strategy — good for continuous parameter spaces" },
  { value: "NSGAIISampler", label: "NSGAII", tip: "Non-dominated Sorting Genetic Algorithm II — multi-objective optimization" },
  { value: "NSGAIIISampler", label: "NSGAIII", tip: "NSGA-III — improved multi-objective optimization with reference points" },
  { value: "QMCSampler", label: "QMC", tip: "Quasi-Monte Carlo — space-filling low-discrepancy sequences, great for exploration" },
] as const;

// ── Hyperopt Space Presets ────────────────────────────────────────────────

export const SPACE_PRESETS = [
  { key: "signals", label: "Signals Only", spaces: ["buy", "sell"], epochs: 100, desc: "buy, sell" },
  { key: "signals_risk", label: "Signals + Risk", spaces: ["buy", "sell", "roi", "stoploss"], epochs: 200, desc: "buy, sell, roi, stoploss" },
  { key: "signals_trailing", label: "Signals + Trailing", spaces: ["buy", "sell", "trailing"], epochs: 150, desc: "buy, sell, trailing" },
  { key: "full", label: "Full", spaces: ["buy", "sell", "roi", "stoploss", "trailing", "protection", "trades"], epochs: 500, desc: "all spaces" },
] as const;

export const ALL_SPACES = [
  { value: "buy", label: "buy", tip: "Entry signal parameters" },
  { value: "sell", label: "sell", tip: "Exit signal parameters" },
  { value: "roi", label: "roi", tip: "Return on investment table" },
  { value: "stoploss", label: "stoploss", tip: "Stop loss value" },
  { value: "trailing", label: "trailing", tip: "Trailing stop parameters" },
  { value: "protection", label: "protection", tip: "Protection parameters" },
  { value: "trades", label: "trades", tip: "Trade count filters" },
  { value: "default", label: "default", tip: "All spaces at once" },
] as const;

// ── FreqAI Models (§24 — ALL 8, exact FT names) ──────────────────────────

export const FREQAI_MODELS = [
  { value: "LightGBMRegressor", label: "LightGBMRegressor", type: "Regression", speed: "Fast", tip: "Gradient boosting for regression — fast, efficient on tabular data, default choice" },
  { value: "LightGBMClassifier", label: "LightGBMClassifier", type: "Classification", speed: "Fast", tip: "Gradient boosting for classification — predicts direction (up/down) instead of exact value" },
  { value: "XGBoostRegressor", label: "XGBoostRegressor", type: "Regression", speed: "Medium", tip: "Extreme Gradient Boosting regression — alternative to LightGBM, sometimes better on smaller datasets" },
  { value: "XGBoostClassifier", label: "XGBoostClassifier", type: "Classification", speed: "Medium", tip: "XGBoost classification — predicts direction with different algorithm from LightGBM" },
  { value: "CatboostRegressor", label: "CatboostRegressor", type: "Regression", speed: "Medium", tip: "Yandex Catboost — especially good with categorical data, robust on default parameters" },
  { value: "PyTorchMLPRegressor", label: "PyTorchMLPRegressor", type: "Neural Net", speed: "Slow", tip: "Multi-layer perceptron (deep learning) regression — needs more data, can capture complex nonlinear patterns" },
  { value: "PyTorchMLPClassifier", label: "PyTorchMLPClassifier", type: "Neural Net", speed: "Slow", tip: "Multi-layer perceptron classification — deep learning for direction prediction" },
  { value: "ReinforcementLearner", label: "ReinforcementLearner", type: "RL Agent", speed: "Slow", tip: "Reinforcement learning agent — completely different approach, learns optimal behavior through rewards/penalties" },
] as const;

// ── FreqAI Outlier Detection (§24) ────────────────────────────────────────

export const OUTLIER_METHODS = [
  { value: "none", label: "Baseline", configKey: "", tip: "No outlier filtering — trains on all data. Use as control group to compare against DI/SVM/DBSCAN results" },
  { value: "di", label: "DI", configKey: "feature_parameters.DI_threshold", tip: "Dissimilarity Index — measures how different new data is from training data. DI > threshold = outlier" },
  { value: "svm", label: "SVM", configKey: "feature_parameters.use_SVM_to_remove_outliers", tip: "Support Vector Machine draws boundary around 'normal' data — anything outside is outlier" },
  { value: "dbscan", label: "DBSCAN", configKey: "feature_parameters.use_DBSCAN_to_remove_outliers", tip: "Density-Based Spatial Clustering — finds groups of similar data, isolated points are outliers" },
] as const;

// ── FreqAI PCA Options (§24) ──────────────────────────────────────────────

export const PCA_OPTIONS = [
  { value: false, label: "Off", configKey: "feature_parameters.principal_component_analysis: false", tip: "Use all original features without reduction — more info but slower training" },
  { value: true, label: "On", configKey: "feature_parameters.principal_component_analysis: true", tip: "Principal Component Analysis — reduces features keeping 99.9% variance. Faster training, less overfitting" },
] as const;

// ── FreqAI Noise Options (§24) ────────────────────────────────────────────

export const NOISE_OPTIONS = [
  { value: false, label: "Off", configKey: "feature_parameters.noise_standard_deviation: 0", tip: "No noise — model trains on clean data" },
  { value: true, label: "On", configKey: "feature_parameters.noise_standard_deviation: 0.1", tip: "Adds Gaussian noise to training data — anti-overfitting technique, model learns to be robust" },
] as const;

// ── Full Matrix Calculation ───────────────────────────────────────────────

/** 4 space presets × 12 loss functions × 6 samplers = 288 Hyperopt runs */
export const HYPEROPT_TOTAL = SPACE_PRESETS.length * LOSS_FUNCTIONS.length * SAMPLERS.length; // 288

/** 8 models × 4 outlier × 2 PCA × 2 noise = 128 FreqAI runs */
export const FREQAI_TOTAL = FREQAI_MODELS.length * OUTLIER_METHODS.length * PCA_OPTIONS.length * NOISE_OPTIONS.length; // 128

/** Total per strategy */
export const TOTAL_TESTS = HYPEROPT_TOTAL + FREQAI_TOTAL; // 416

// ── Naš AI Verdict Thresholds (hardcoded, not AI-decided) ─────────────────

export const VERDICT_THRESHOLDS = {
  READY: { rule: "All 4 scores ≥ 70 AND no critical problems", color: "green" },
  NEEDS_WORK: { rule: "Any score 40-69 OR one critical problem", color: "amber" },
  HIGH_RISK: { rule: "Any score < 40 OR two+ critical problems", color: "red" },
  INSUFFICIENT_DATA: { rule: "Less than 10 tests total", color: "text-3" },
} as const;

export type AiVerdict = keyof typeof VERDICT_THRESHOLDS;

// ── AI Models for OpenRouter ──────────────────────────────────────────────

export const AI_MODELS = [
  { value: "claude", label: "Claude Sonnet 4.5", cost: "~$0.02-0.05", desc: "Best for detailed analysis" },
  { value: "grok", label: "Grok 4.1 Fast", cost: "~$0.01-0.02", desc: "Fast second opinion" },
] as const;

// ── Verification Pass/Fail Criteria ───────────────────────────────────────

export const VERIFICATION_CRITERIA = {
  profit_drop_max: 50,     // Profit can drop max 50%
  dd_increase_max: 30,     // Drawdown can increase max 30%
  winrate_drop_max: 15,    // Win rate can drop max 15pp
} as const;

// ── Run Type / Status Types ───────────────────────────────────────────────

export type RunType = "backtest" | "hyperopt" | "freqai" | "verification" | "ai_review";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "promoted";

// ── Experiment Strategy Status ────────────────────────────────────────────

export type StrategyTestStatus = "Draft" | "Backtested" | "Optimized" | "Paper" | "Live" | "Retired";

// ── Date formatting (YYYY-MM-DD HH:mm:ss per architecture) ───────────────

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Number formatting ─────────────────────────────────────────────────────

export function fmtPct(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

export function fmtUsd(val: number | null | undefined): string {
  if (val == null) return "—";
  const sign = val >= 0 ? "+" : "";
  return `${sign}$${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "—";
  return val.toFixed(decimals);
}

// ── Color helpers ─────────────────────────────────────────────────────────

export function profitColor(val: number | null | undefined): string {
  if (val == null) return "text-muted-foreground";
  return val >= 0 ? "text-emerald-500" : "text-rose-500";
}

export function ddColor(val: number | null | undefined): string {
  if (val == null) return "text-muted-foreground";
  return "text-rose-500";
}
