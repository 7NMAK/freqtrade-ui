/**
 * API client for the Orchestrator.
 * ALL trade data comes from FT via orchestrator passthrough.
 * We NEVER duplicate trade data — never invent endpoints.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ── Token management ──────────────────────────────────────────────────────

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("orch_token", token);
      document.cookie = `orch_token=${token}; path=/; SameSite=Strict; max-age=${60 * 60 * 24}`;
    } else {
      localStorage.removeItem("orch_token");
      document.cookie = "orch_token=; path=/; max-age=0";
    }
  }
}

export function getToken(): string | null {
  if (_token) return _token;
  if (typeof window !== "undefined") {
    _token = localStorage.getItem("orch_token");
  }
  return _token;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Check if JWT token is expired or about to expire (within 5 min) */
export function isTokenExpiringSoon(): boolean {
  const token = getToken();
  if (!token) return true;
  try {
    const payload: { exp?: number } = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp;
    if (!exp) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return exp - nowSec < 300; // less than 5 min remaining
  } catch { /* non-blocking */
    return false;
  }
}

// ── API Error ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  public diagnosis: string | null;
  constructor(
    public status: number,
    message: string,
    diagnosis?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.diagnosis = diagnosis ?? null;
  }
}

// ── Base request ──────────────────────────────────────────────────────────

interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

async function request<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers ?? {}) },
  });

  if (res.status === 401 || res.status === 403) {
    setToken(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return undefined as T; // suppress error — redirect handles it
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    let message = text;
    let diagnosis: string | null = null;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.detail === "object" && parsed.detail !== null) {
        message = parsed.detail.error ?? JSON.stringify(parsed.detail);
        diagnosis = parsed.detail.diagnosis ?? null;
      } else {
        message = parsed.detail ?? parsed.message ?? text;
      }
    } catch { /* non-blocking */
      // use raw text
    }
    throw new ApiError(res.status, diagnosis ? `${message}\n\nDiagnosis: ${diagnosis}` : message, diagnosis);
  }

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return undefined as T;
  }
  return res.json();
}

// Multipart form request (for file uploads)
async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401 || res.status === 403) {
    setToken(null);
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(res.status, "Authentication required");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    let message = text;
    let diagnosis: string | null = null;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.detail === "object" && parsed.detail !== null) {
        message = parsed.detail.error ?? JSON.stringify(parsed.detail);
        diagnosis = parsed.detail.diagnosis ?? null;
      } else {
        message = parsed.detail ?? parsed.message ?? text;
      }
    } catch { /* non-blocking */
      // use raw text
    }
    throw new ApiError(res.status, diagnosis ? `${message}\n\nDiagnosis: ${diagnosis}` : message, diagnosis);
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new ApiError(res.status, data.detail || "Login failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data.access_token;
}

export function logout() {
  setToken(null);
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

// ── Health ────────────────────────────────────────────────────────────────

// UNUSED — available for future use
// export const health = () =>
//   request<{ status: string }>("/api/health");

// ── Bots ──────────────────────────────────────────────────────────────────

export const getBots = (includeUtility = false) =>
  request<import("@/types").Bot[]>(`/api/bots/${includeUtility ? "?include_utility=true" : ""}`);

// UNUSED — available for future use
// export const getBot = (id: number) =>
//   request<import("@/types").Bot>(`/api/bots/${id}`);

export const registerBot = (data: Record<string, unknown>) =>
  request<import("@/types").Bot>("/api/bots/", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateBot = (id: number, data: Record<string, unknown>) =>
  request<import("@/types").Bot>(`/api/bots/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteBot = (id: number) =>
  request<void>(`/api/bots/${id}`, { method: "DELETE" });

// ── Bot Control (FT passthrough) ──────────────────────────────────────────

export const startBot = (id: number) =>
  request(`/api/bots/${id}/start`, { method: "POST" });

export const stopBot = (id: number) =>
  request(`/api/bots/${id}/stop`, { method: "POST" });

export const reloadBotConfig = (id: number) =>
  request(`/api/bots/${id}/reload-config`, { method: "POST" });

export const botStopBuy = (id: number) =>
  request(`/api/bots/${id}/stopbuy`, { method: "POST" });

export const botPause = (id: number) =>
  request(`/api/bots/${id}/pause`, { method: "POST" });

// ── Bot Data (FT passthrough — read-only) ────────────────────────────────

export const botStatus = (id: number) =>
  request<import("@/types").FTTrade[]>(`/api/bots/${id}/status`);

export const botTrades = (id: number, limit = 50) =>
  request<{ trades: import("@/types").FTTrade[]; trades_count: number }>(
    `/api/bots/${id}/trades?limit=${limit}`
  );

export const botProfit = (id: number) =>
  request<import("@/types").FTProfit>(`/api/bots/${id}/profit`);

export const botBalance = (id: number) =>
  request<import("@/types").FTBalance>(`/api/bots/${id}/balance`);

export const botDaily = (id: number, days = 30) =>
  request<import("@/types").FTDailyResponse>(`/api/bots/${id}/daily?days=${days}`);

// ── Currently unused — available for Analytics & Dashboard expansion ──
export const botWeekly = (id: number, weeks = 12) =>
  request<import("@/types").FTWeeklyResponse>(`/api/bots/${id}/weekly?weeks=${weeks}`);

export const botMonthly = (id: number, months = 12) =>
  request<import("@/types").FTMonthlyResponse>(`/api/bots/${id}/monthly?months=${months}`);

export const botPerformance = (id: number) =>
  request<import("@/types").FTPerformance[]>(`/api/bots/${id}/performance`);

export const botConfig = (id: number) =>
  request<import("@/types").FTShowConfig>(`/api/bots/${id}/config`);

export const saveBotConfig = (id: number, config: Record<string, unknown>) =>
  request(`/api/bots/${id}/config`, {
    method: "PUT",
    body: JSON.stringify(config),
  });

export const applyBotConfig = (id: number) =>
  request(`/api/bots/${id}/apply-config`, { method: "POST" });

export const botLogs = (id: number, limit = 50) =>
  request<import("@/types").FTLogsResponse>(`/api/bots/${id}/logs?limit=${limit}`);

// ── Currently unused — available for Dashboard bot detail panel ──
// UNUSED — available for future use
// export const botCount = (id: number) =>
//   request<import("@/types").FTCount>(`/api/bots/${id}/count`);

// UNUSED — available for future use
// export const botVersion = (id: number) =>
//   request<import("@/types").FTVersion>(`/api/bots/${id}/version`);

export const botHealth = (id: number) =>
  request<import("@/types").FTHealth>(`/api/bots/${id}/health`);

export const botPing = (id: number) =>
  request<{ status: string }>(`/api/bots/${id}/ping`);

// ── Currently unused — available for Analytics trade analysis expansion ──
export const botEntries = (id: number) =>
  request<import("@/types").FTEntry[]>(`/api/bots/${id}/entries`);

export const botExits = (id: number) =>
  request<import("@/types").FTExit[]>(`/api/bots/${id}/exits`);

export const botMixTags = (id: number) =>
  request<import("@/types").FTMixTag[]>(`/api/bots/${id}/mix-tags`);

export const botStats = (id: number) =>
  request<import("@/types").FTStats>(`/api/bots/${id}/stats`);

export const botWhitelist = (id: number) =>
  request<import("@/types").FTWhitelist>(`/api/bots/${id}/whitelist`);

// ── Currently unused — available for Settings blacklist management ──
// UNUSED — available for future use
// export const botBlacklist = (id: number) =>
//   request<{ blacklist: string[]; blacklist_expanded: string[]; length: number }>(
//     `/api/bots/${id}/blacklist`
//   );

// ── Currently unused — available for Analytics chart overlay config ──
// UNUSED — available for future use
// export const botPlotConfig = (id: number) =>
//   request(`/api/bots/${id}/plot-config`);

export const botPairCandles = (
  id: number,
  pair: string,
  timeframe: string,
  limit = 500
) =>
  request<import("@/types").FTPairCandlesResponse>(
    `/api/bots/${id}/pair-candles?pair=${encodeURIComponent(pair)}&timeframe=${timeframe}&limit=${limit}`
  );

export const botFtStrategies = (id: number) =>
  request<import("@/types").FTStrategiesResponse>(`/api/bots/${id}/ft-strategies`);

export const botFtStrategy = (id: number, name: string) =>
  request<import("@/types").FTStrategy>(`/api/bots/${id}/ft-strategy/${name}`);

export const botForceEnter = (
  id: number,
  pair: string,
  side: "long" | "short" = "long",
  stake?: number
) =>
  request(`/api/bots/${id}/forceenter`, {
    method: "POST",
    body: JSON.stringify({ pair, side, stake_amount: stake }),
  });

export const botForceExit = (id: number, tradeId: string, ordertype = "market") =>
  request(`/api/bots/${id}/forceexit`, {
    method: "POST",
    body: JSON.stringify({ trade_id: tradeId, ordertype }),
  });

export const botLocks = (id: number) =>
  request<import("@/types").FTLocksResponse>(`/api/bots/${id}/locks`);

export const botDeleteLock = (id: number, lockId: number) =>
  request(`/api/bots/${id}/locks/${lockId}`, { method: "DELETE" });

export const botLockAdd = (id: number, data: { pair: string; until: string; reason: string }) =>
  request<import("@/types").FTLock>(`/api/bots/${id}/locks`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const botDeleteTrade = (id: number, tradeId: number) =>
  request(`/api/bots/${id}/trades/${tradeId}`, { method: "DELETE" });

export const botReloadTrade = (id: number, tradeId: number) =>
  request(`/api/bots/${id}/trades/${tradeId}/reload`, { method: "POST" });

export const botCancelOpenOrder = (id: number, tradeId: number) =>
  request(`/api/bots/${id}/trades/${tradeId}/open-order`, { method: "DELETE" });

export const botSysinfo = (id: number) =>
  request<import("@/types").FTSysinfo>(`/api/bots/${id}/sysinfo`);

// ── Backtest / Hyperopt (via orchestrator → FT CLI or API) ───────────────

export const botBacktestStart = (id: number, params: Record<string, unknown>) =>
  request<{ job_id: string }>(`/api/bots/${id}/backtest`, {
    method: "POST",
    body: JSON.stringify(params),
  });

export const botBacktestResults = (id: number) =>
  request<import("@/types").FTBacktestResult>(`/api/bots/${id}/backtest`, { method: "GET" });

export const botBacktestDelete = (id: number) =>
  request(`/api/bots/${id}/backtest`, { method: "DELETE" });

export const botHyperoptStart = (id: number, params: Record<string, unknown>) =>
  request<{ job_id: string }>(`/api/bots/${id}/hyperopt`, {
    method: "POST",
    body: JSON.stringify(params),
  });

export const botHyperoptStatus = (botId: number, jobId: string) =>
  request<{
    job_id: string;
    status: string;
    exit_code: number | null;
    output: string;
    cmd: string;
    sampler: string;
    original_strategy: string;
    parsed: Record<string, unknown> | null;
    saved_to_db: boolean;
  }>(`/api/bots/${botId}/hyperopt/status/${jobId}`);

export const botLookaheadAnalysis = (id: number, params: Record<string, unknown>) =>
  request(`/api/bots/${id}/lookahead-analysis`, {
    method: "POST",
    body: JSON.stringify(params),
  });

export const botRecursiveAnalysis = (id: number, params: Record<string, unknown>) =>
  request(`/api/bots/${id}/recursive-analysis`, {
    method: "POST",
    body: JSON.stringify(params),
  });

// ── Data Management (FT CLI passthrough) ─────────────────────────────────

export const botDownloadData = (id: number, params: {
  pairs: string[];
  timeframes: string[];
  exchange: string;
  trading_mode: string;
  timerange?: string;
  days?: number;
  new_pairs_days?: number;
  include_inactive_pairs?: boolean;
  dl_trades?: boolean;
  convert?: boolean;
  candle_types?: string[];
  data_format_ohlcv?: string;
  no_parallel_download?: boolean;
  erase?: boolean;
  prepend?: boolean;
}) =>
  request<{ job_id: string; status: string; message: string }>(`/api/bots/${id}/download-data`, {
    method: "POST",
    body: JSON.stringify(params),
  });

export const botDownloadDataStatus = (botId: number, jobId: string) =>
  request<{ job_id: string; status: string; exit_code: number | null; output: string }>(`/api/bots/${botId}/download-data/status/${jobId}`);

export const botConvertData = (id: number, params: {
  format_from: string;
  format_to: string;
  pairs?: string[];
}) =>
  request<{ status: string; message: string }>(`/api/bots/${id}/convert-data`, {
    method: "POST",
    body: JSON.stringify(params),
  });

export const botConvertTradeData = (id: number, params: {
  format_from: string;
  format_to: string;
  pairs?: string[];
}) =>
  request<{ status: string; message: string }>(`/api/bots/${id}/convert-trade-data`, {
    method: "POST",
    body: JSON.stringify(params),
  });

export const botTradesToOhlcv = (id: number, params: {
  pairs?: string[];
  timeframes?: string[];
}) =>
  request<{ status: string; message: string }>(`/api/bots/${id}/trades-to-ohlcv`, {
    method: "POST",
    body: JSON.stringify(params),
  });

export const botHyperoptList = (id: number, params?: {
  profitable?: boolean;
  min_trades?: number;
  no_details?: boolean;
}) =>
  request<{ results: Array<import("@/types").FTHyperoptResult> }>(`/api/bots/${id}/hyperopt-list`, {
    method: "POST",
    body: JSON.stringify(params ?? {}),
  });

export const botHyperoptShow = (id: number, epoch: number) =>
  request<Record<string, unknown>>(`/api/bots/${id}/hyperopt-show?epoch=${epoch}`);

export const botHyperoptRuns = (id: number) =>
  request<{ runs: Array<{ filename: string; strategy: string; created_at: string; mtime: number; size_bytes: number; epochs: number }> }>(
    `/api/bots/${id}/hyperopt-runs`
  );

export const botHyperoptHistoryDelete = (id: number, filename: string) =>
  request<{ status: string }>(`/api/bots/${id}/hyperopt/history/${encodeURIComponent(filename)}`, { method: "DELETE" });

export const botBacktestHistoryDelete = (id: number, filename: string, strategy: string) =>
  request<{ status: string }>(`/api/bots/${id}/backtest/history/result?filename=${encodeURIComponent(filename)}&strategy=${encodeURIComponent(strategy)}`, { method: "DELETE" });

export const botBacktestHistory = async (id: number) => {
  const raw = await request<
    | Array<{ filename: string; strategy: string; run_id: string; backtest_start_time: number; notes?: string; timeframe?: string; timeframe_detail?: string }>
    | { results: Array<{ filename: string; strategy: string; run_id: string; backtest_start_time: number; notes?: string; timeframe?: string; timeframe_detail?: string }> }
  >(`/api/bots/${id}/backtest/history`);
  // FT returns a bare array; normalise to {results: [...]}
  return { results: Array.isArray(raw) ? raw : (raw.results ?? []) };
};

export const botBacktestHistoryResult = (id: number, filename: string, strategy: string) =>
  request<Record<string, unknown>>(`/api/bots/${id}/backtest/history/result?filename=${encodeURIComponent(filename)}&strategy=${encodeURIComponent(strategy)}`);

export const botListData = (id: number) =>
  request<{ data: Array<{ pair: string; timeframe: string; candle_type?: string; start: string; end: string; candle_count: number; format?: string }>; output?: string }>(
    `/api/bots/${id}/list-data`
  );

export const botAvailablePairs = (id: number, timeframe?: string) =>
  request<{ pairs: string[] }>(
    `/api/bots/${id}/available-pairs${timeframe ? `?timeframe=${timeframe}` : ""}`
  );

// ── Kill Switch ───────────────────────────────────────────────────────────

export const softKill = (botId: number, reason = "") =>
  request(`/api/kill-switch/soft/${botId}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const hardKill = (botId: number, reason = "") =>
  request(`/api/kill-switch/hard/${botId}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const softKillAll = (reason = "") =>
  request("/api/kill-switch/soft-all", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const hardKillAll = (reason = "") =>
  request("/api/kill-switch/hard-all", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const getRiskEvents = () =>
  request<import("@/types").RiskEvent[]>("/api/kill-switch/events");

// ── Portfolio ─────────────────────────────────────────────────────────────

export const portfolioBalance = () =>
  request<import("@/types").PortfolioBalance>("/api/portfolio/balance");

export const portfolioProfit = () =>
  request<import("@/types").PortfolioProfit>("/api/portfolio/profit");

export const portfolioTrades = () =>
  request<import("@/types").PortfolioTrades>("/api/portfolio/trades");

export const portfolioDaily = () =>
  request<import("@/types").FTDailyResponse>("/api/portfolio/daily");



// ── Strategies (Orchestrator DB) ──────────────────────────────────────────

export const getStrategies = async (): Promise<import("@/types").Strategy[]> => {
  const res = await request<{ total: number; items: import("@/types").Strategy[] } | import("@/types").Strategy[]>("/api/strategies/");
  if (Array.isArray(res)) return res;
  return res.items;
};

export const getStrategy = (id: number) =>
  request<import("@/types").Strategy>(`/api/strategies/${id}`);

export const createStrategy = (data: Record<string, unknown>) =>
  request<import("@/types").Strategy>("/api/strategies/", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateStrategy = (id: number, data: Record<string, unknown>) =>
  request<import("@/types").Strategy>(`/api/strategies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteStrategy = (strategyId: number) =>
  request(`/api/strategies/${strategyId}`, { method: "DELETE" });

// importStrategy routes via bot
export const importStrategy = (botId: number, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return requestMultipart<{ message: string }>(
    `/api/bots/${botId}/strategy/import`,
    formData
  );
};

// ── AI Validation Layer ────────────────────────────────────────────────────

export const fetchAIValidations = (params?: {
  botId?: number;
  limit?: number;
  offset?: number;
  strongDisagreeOnly?: boolean;
}) => {
  const qs = new URLSearchParams();
  if (params?.botId) qs.set("bot_id", String(params.botId));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.strongDisagreeOnly) qs.set("strong_disagree_only", "true");
  return request<import("@/types").AIValidation[]>(`/api/ai/validations?${qs}`);
};

export const fetchAIValidationByTrade = (ftTradeId: number) =>
  request<import("@/types").AIValidation>(`/api/ai/validations/${ftTradeId}`);

export const fetchAIAccuracy = () =>
  request<import("@/types").AIAccuracyStats>("/api/ai/accuracy");

export const fetchAIAccuracyHistory = (days = 30) =>
  request<import("@/types").AIAccuracyHistory>(`/api/ai/accuracy/history?days=${days}`);

export const fetchAIAgreementRate = (days = 30) =>
  request<import("@/types").AIAgreementRate>(`/api/ai/agreement-rate?days=${days}`);

export const fetchAICost = (days = 30) =>
  request<import("@/types").AICost>(`/api/ai/cost?days=${days}`);

export const triggerAIValidation = (botId: number) =>
  request<{ status: string; bot_id: number; message: string }>(
    `/api/ai/validate-now/${botId}`,
    { method: "POST" }
  );

export const fetchAIConfig = () =>
  request<import("@/types").AIConfig>("/api/ai/config");

export const updateAIConfig = (data: Record<string, unknown>) =>
  request<{ status: string; patched: string[] }>("/api/ai/config", {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// ── AI Hyperopt ─────────────────────────────────────────────────────────────

export const submitHyperoptPreAnalyze = (data: {
  bot_id: number;
  strategy_name: string;
  pair: string;
  timeframe: string;
}) =>
  request<import("@/types").AIHyperoptAnalysis>("/api/ai/hyperopt/pre-analyze", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const submitHyperoptPostAnalyze = (data: {
  bot_id: number;
  strategy_name: string;
  pair: string;
  timeframe: string;
  results: Record<string, unknown>[];
  epochs_run: number;
  loss_function_used: string;
  timerange: string;
  baseline_profit?: number;
  baseline_trades?: number;
  baseline_sharpe?: number;
  baseline_max_drawdown?: number;
}) =>
  request<import("@/types").AIHyperoptAnalysis>("/api/ai/hyperopt/post-analyze", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchHyperoptAnalyses = (params?: {
  botId?: number;
  analysisType?: "pre_hyperopt" | "post_hyperopt";
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.botId) qs.set("bot_id", String(params.botId));
  if (params?.analysisType) qs.set("analysis_type", params.analysisType);
  if (params?.limit) qs.set("limit", String(params.limit));
  return request<import("@/types").AIHyperoptAnalysis[]>(`/api/ai/hyperopt/analyses?${qs}`);
};

export const fetchHyperoptAnalysis = (id: number) =>
  request<import("@/types").AIHyperoptAnalysis>(`/api/ai/hyperopt/analyses/${id}`);

export const submitHyperoptOutcome = (data: {
  analysis_id: number;
  used_ai_suggestion: boolean;
  final_params?: Record<string, unknown>;
  paper_trade_result?: number;
  user_feedback?: "helpful" | "neutral" | "wrong";
}) =>
  request<{ status: string; outcome_id: number }>("/api/ai/hyperopt/outcome", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchHyperoptComparison = (analysisId: number) =>
  request<import("@/types").AIHyperoptComparison>(
    `/api/ai/hyperopt/comparison/${analysisId}`
  );

export const fetchHyperoptComparisonHistory = (params?: {
  botId?: number;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.botId) qs.set("bot_id", String(params.botId));
  if (params?.limit) qs.set("limit", String(params.limit));
  return request<{ total: number; comparisons: Array<{
    id: number; strategy_name: string; pair: string; timeframe: string;
    recommended_result_index: number | null; claude_confidence: number | null;
    grok_confidence: number | null; created_at: string | null;
  }> }>(
    `/api/ai/hyperopt/comparison/history?${qs}`
  );
};

export const fetchHyperoptComparisonStats = () =>
  request<import("@/types").AIHyperoptComparisonStats>("/api/ai/hyperopt/comparison/stats");

// ── Activity Logs (Orchestrator audit_log) ─────────────────────────────────

export const getSystemLogs = (params?: {
  level?: string;
  bot_id?: number;
  action?: string;
  limit?: number;
  offset?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.level) qs.set("level", params.level);
  if (params?.bot_id) qs.set("bot_id", String(params.bot_id));
  if (params?.action) qs.set("action", params.action);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return request<import("@/types").ActivityLogResponse>(`/api/logs/?${qs}`);
};

export const getBotActivityLogs = (botId: number, params?: {
  level?: string;
  limit?: number;
  offset?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.level) qs.set("level", params.level);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return request<import("@/types").BotLogResponse>(`/api/logs/bot/${botId}?${qs}`);
};

export const getErrorLogs = (params?: {
  bot_id?: number;
  limit?: number;
  offset?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.bot_id) qs.set("bot_id", String(params.bot_id));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  return request<import("@/types").ActivityLogResponse>(`/api/logs/errors?${qs}`);
};

// ── Strategy Versions (Architecture V2) ───────────────────────────────────

export const createStrategyVersion = (strategyId: number, data: {
  code: string;
  builder_state?: Record<string, unknown>;
  risk_config?: Record<string, unknown>;
  callbacks?: Record<string, unknown>;
  freqai_config?: Record<string, unknown>;
  changelog?: string;
}) =>
  request<import("@/types").StrategyVersion>(`/api/strategies/${strategyId}/versions`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getStrategyVersions = (strategyId: number) =>
  request<import("@/types").StrategyVersion[]>(`/api/strategies/${strategyId}/versions`);

export const getStrategyVersion = (strategyId: number, versionNumber: number) =>
  request<import("@/types").StrategyVersion>(`/api/strategies/${strategyId}/versions/${versionNumber}`);

export const getStrategyVersionDiff = (strategyId: number, v1: number, v2: number) =>
  request<{
    v1: import("@/types").StrategyVersion;
    v2: import("@/types").StrategyVersion;
    code_changed: boolean;
    risk_changed: boolean;
    callbacks_changed: boolean;
    risk_diff: Record<string, unknown> | null;
  }>(`/api/strategies/${strategyId}/versions-diff?v1=${v1}&v2=${v2}`);

// ── Strategy Import ──────────────────────────────────────────────────────

export const getAvailableStrategies = () =>
  request<string[]>("/api/strategies/available");

export const importStrategyFromSource = (data: {
  source: string;
  filename?: string;
  code?: string;
}) =>
  request<import("@/types").Strategy>("/api/strategies/import", {
    method: "POST",
    body: JSON.stringify(data),
  });

// ── Exchange Profiles ────────────────────────────────────────────────────

export const getExchangeProfiles = () =>
  request<import("@/types").ExchangeProfileListResponse>("/api/exchange-profiles/");

export const createExchangeProfile = (data: {
  name: string;
  exchange_name: string;
  api_key?: string;
  api_secret?: string;
  api_password?: string;
  uid?: string;
  subaccount?: string;
}) =>
  request<import("@/types").ExchangeProfile>("/api/exchange-profiles/", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateExchangeProfile = (id: number, data: Record<string, unknown>) =>
  request<import("@/types").ExchangeProfile>(`/api/exchange-profiles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteExchangeProfile = (id: number) =>
  request<void>(`/api/exchange-profiles/${id}`, { method: "DELETE" });

// ── Backtest Results ─────────────────────────────────────────────────────

export const getBacktestResults = (strategyId?: number) =>
  request<import("@/types").BacktestResult[]>(
    strategyId ? `/api/backtest-results/by-strategy/${strategyId}` : "/api/backtest-results/"
  );

export const getBacktestResultsByVersion = (versionId: number) =>
  request<import("@/types").BacktestResult[]>(`/api/backtest-results/by-version/${versionId}`);

export const compareBacktestResults = (ids: number[]) =>
  request<{
    results: import("@/types").BacktestResult[];
    best_profit: number;
    best_drawdown: number;
    best_sharpe: number;
  }>(`/api/backtest-results/compare?ids=${ids.join(",")}`);

// ── Bot V2 Extended ──────────────────────────────────────────────────────

export const generateBotConfig = (botId: number) =>
  request<Record<string, unknown>>(`/api/bots/${botId}/generate-config`, {
    method: "POST",
  });

export const drainBot = (botId: number) =>
  request<{ status: string; open_trades: number }>(`/api/bots/${botId}/drain`, {
    method: "POST",
  });

export const importBot = (data: {
  api_url: string;
  api_port: number;
  api_username: string;
  api_password: string;
}) =>
  request<import("@/types").Bot>("/api/bots/import", {
    method: "POST",
    body: JSON.stringify(data),
  });


// ── Experiments ──────────────────────────────────────────────────────

export interface ExperimentRun {
  id: number;
  experiment_id: number;
  parent_run_id: number | null;
  run_type: string;
  status: string;
  backtest_result_id: number | null;
  strategy_version_id: number | null;
  ai_analysis_id: number | null;
  sampler: string | null;
  loss_function: string | null;
  epochs: number | null;
  spaces: string[] | null;
  hyperopt_duration_seconds: number | null;
  total_trades: number | null;
  win_rate: number | null;
  profit_abs: number | null;
  profit_pct: number | null;
  profit_mean: number | null;
  profit_factor: number | null;
  max_drawdown: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  calmar_ratio: number | null;
  avg_duration: string | null;
  raw_output: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Experiment {
  id: number;
  strategy_id: number;
  strategy_name: string | null;
  name: string;
  pair: string;
  timeframe: string;
  timerange_start: string | null;
  timerange_end: string | null;
  baseline_backtest_id: number | null;
  best_version_id: number | null;
  notes: string | null;
  run_count: number;
  created_at: string;
}

export interface ExperimentDetail extends Experiment {
  runs: ExperimentRun[];
}

export interface ExperimentListResponse {
  total: number;
  items: Experiment[];
}

export const getExperiments = (filters?: {
  strategy_id?: number;
  pair?: string;
  skip?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.strategy_id) params.set("strategy_id", String(filters.strategy_id));
  if (filters?.pair) params.set("pair", filters.pair);
  if (filters?.skip) params.set("skip", String(filters.skip));
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return request<ExperimentListResponse>(`/api/experiments/${qs ? `?${qs}` : ""}`);
};

export const getExperiment = (id: number) =>
  request<ExperimentDetail>(`/api/experiments/${id}`);

export const deleteExperiment = (id: number) =>
  request<void>(`/api/experiments/${id}`, { method: "DELETE" });

export const getExperimentRuns = (experimentId: number, filters?: {
  run_type?: string;
  status?: string;
}) => {
  const params = new URLSearchParams();
  if (filters?.run_type) params.set("run_type", filters.run_type);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();
  return request<ExperimentRun[]>(`/api/experiments/${experimentId}/runs${qs ? `?${qs}` : ""}`);
};

export const deleteExperimentRun = (runId: number) =>
  request<void>(`/api/experiments/runs/${runId}`, { method: "DELETE" });

// getStrategyVersions already defined above (line 763)

export const activateStrategyVersion = (strategyId: number, versionId: number) =>
  request<{ message: string; version_id: number; version_number: number }>(
    `/api/experiments/strategies/${strategyId}/versions/${versionId}/activate`,
    { method: "POST" }
  );
