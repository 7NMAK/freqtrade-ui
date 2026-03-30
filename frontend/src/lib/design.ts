/**
 * Shared design system constants for experiment forms.
 * Used across all experiment tabs to ensure consistency.
 */

export const INPUT =
  "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground placeholder-text-3 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";

export const SELECT =
  "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";

export const LABEL =
  "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

/**
 * Format helpers — canonical formatters matching TESTING-ARCHITECTURE.md rules.
 * Rule: ALL dates must include time (YYYY-MM-DD HH:mm:ss).
 */

/** Format dollar values with sign: +$123.45 / -$123.45 */
export function fmt$(v: number, decimals = 2): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${Math.abs(v).toFixed(decimals)}`;
}

/** Format percent (0.15 → +15.00%) — input is RATIO, not percent */
export function fmtPctRatio(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

/** Format number with decimals */
export function fmtNum(v: number, d = 2): string {
  return v.toFixed(d);
}

/** Format unix timestamp → YYYY-MM-DD HH:mm:ss (architecture-mandated format) */
export function fmtTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Format ISO string → YYYY-MM-DD HH:mm:ss */
export function fmtISO(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
