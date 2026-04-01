/**
 * Shared design system constants for experiment forms.
 * Used across all experiment tabs to ensure consistency.
 * RULE: Every UI element in experiments must use these tokens.
 */

// ── Form Controls ───────────────────────────────────────────────────

export const INPUT =
  "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground placeholder-text-3 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all";

export const SELECT =
  "w-full h-[34px] py-0 px-3 bg-muted border border-border rounded-btn text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer appearance-none transition-all";

export const LABEL =
  "block text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-[4px]";

// ── Section Cards ───────────────────────────────────────────────────

/** Standard section card — use for every config/result panel */
export const SECTION_CARD = "bg-card border border-border rounded-card p-4";

/** Section title — first child inside SECTION_CARD */
export const SECTION_TITLE = "text-xs font-semibold text-foreground mb-3";

/** Metric card — small stat boxes inside result panels */
export const METRIC_CARD = "bg-muted/50 border border-border rounded-lg p-2.5";

// ── Buttons ─────────────────────────────────────────────────────────

/** Primary action button (Run, Start, Submit) */
export const BTN_PRIMARY =
  "h-[34px] inline-flex items-center justify-center gap-[6px] px-[14px] rounded-btn text-xs font-medium border bg-primary border-primary text-white hover:bg-[#5558e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

/** Secondary/outline button (Cancel, Compare, Export) */
export const BTN_SECONDARY =
  "h-[34px] inline-flex items-center justify-center gap-[6px] px-[14px] rounded-btn text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors";

/** Tiny action button (in tables, expanded rows) */
export const BTN_ACTION =
  "px-2.5 py-1 rounded-btn text-[10px] font-semibold border transition-all";

/** Selection chip / toggle pill (for multi-select groups) */
export const CHIP = (active: boolean) =>
  `inline-flex items-center gap-[4px] py-[4px] px-[10px] rounded-btn text-xs cursor-pointer border transition-all select-none ${
    active
      ? "bg-[rgba(99,102,241,0.12)] border-[rgba(99,102,241,0.3)] text-primary"
      : "bg-muted/50 border-border text-muted-foreground hover:border-[rgba(46,46,72,1)]"
  }`;

// ── Layouts ─────────────────────────────────────────────────────────

/** Two-panel layout: 380px sidebar + flexible main */
export const LAYOUT_2COL = "grid grid-cols-[380px_minmax(0,1fr)] gap-5";

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
