/**
 * Shared formatting helpers used across dashboard, backtesting, data, and analytics pages.
 * Centralised here to avoid duplication (N4).
 */

/** Format a number to fixed decimal places, returning a dash for null/undefined/NaN */
export function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || isNaN(n)) return "\u2014";
  return n.toFixed(digits);
}

/** Format a number with sign prefix (e.g. "+1.23" / "-4.56"), dash for null */
export function fmtNum(n: number | undefined | null, decimals = 2): string {
  if (n == null) return "\u2014";
  const s = n.toFixed(decimals);
  return n > 0 ? `+${s}` : s;
}

/**
 * Format a number as money with sign prefix.
 * Returns "$0.00" (no sign) when n === 0 (N5 fix).
 */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "\u2014";
  if (n === 0) return "$0.00";
  const abs = Math.abs(n);
  const prefix = n < 0 ? "-$" : "+$";
  return prefix + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Return a Tailwind text color class based on profit sign */
export function profitColor(n: number | null | undefined): string {
  if (n == null) return "text-muted-foreground";
  return n >= 0 ? "text-emerald-500" : "text-rose-500";
}
