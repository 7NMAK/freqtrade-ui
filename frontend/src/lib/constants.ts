/** Refresh intervals (ms) — centralized for easy tuning */
export const REFRESH_INTERVALS = {
  /** Dashboard data refresh — reads cached snapshot (~100ms), safe to run often */
  DASHBOARD: 30_000,
  /** Header bot status + heartbeat check */
  HEADER_BOTS: 120_000,
  /** Header notifications refresh */
  HEADER_NOTIFICATIONS: 30_000,
  /** Sidebar badge counts */
  SIDEBAR: 30_000,
  /** AI Insights data refresh */
  AI_INSIGHTS: 30_000,
  /** Risk page data refresh */
  RISK: 15_000,
  /** Backtest polling interval */
  BACKTEST_POLL: 3_000,
} as const;
