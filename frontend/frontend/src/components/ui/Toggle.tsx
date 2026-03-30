"use client";

/**
 * Shared Toggle switch component.
 * Used across all experiment tabs (Backtest, Hyperopt, FreqAI, Validation).
 */
export default function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <label className="relative w-[36px] h-[20px] cursor-pointer inline-block flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="hidden"
        />
        <span
          className={`absolute inset-0 rounded-[10px] border transition-all ${
            checked
              ? "bg-[rgba(34,197,94,0.08)] border-emerald-500"
              : "bg-muted border-border"
          }`}
        />
        <span
          className={`absolute w-[14px] h-[14px] bg-white rounded-full top-[3px] transition-all ${
            checked ? "left-[19px]" : "left-[3px]"
          }`}
        />
      </label>
    </div>
  );
}
