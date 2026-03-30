// Skeleton loading placeholders — animate-pulse via Tailwind

export function SkeletonStat() {
  return (
    <div className="bg-muted/50 border border-border rounded-card p-5 animate-pulse">
      <div className="h-2.5 w-24 bg-muted rounded mb-3" />
      <div className="h-6 w-32 bg-muted rounded mb-2" />
      <div className="h-2 w-20 bg-muted rounded" />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-muted/50 border border-border rounded-card p-5 animate-pulse">
      <div className="h-3 w-32 bg-muted rounded mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={`skeleton-${i}`} className="h-2.5 bg-muted rounded mb-2" style={{ width: `${80 - i * 10}%` }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`skeleton-col-${i}`} className="h-2 bg-muted rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`skeleton-row-${i}`} className="flex gap-4 px-4 py-3.5 border-b border-border/40">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={`skeleton-cell-${i}-${j}`} className="h-2.5 bg-muted rounded flex-1" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 200 }: { height?: number }) {
  return (
    <div className="animate-pulse px-4 py-3" style={{ height }}>
      <div className="w-full h-full bg-muted rounded-lg" />
    </div>
  );
}

export function SkeletonBotCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-4 w-12 bg-muted rounded-full" />
      </div>
      <div className="h-2 w-32 bg-muted rounded mb-4" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="h-2 w-12 bg-muted rounded mb-1.5" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div>
          <div className="h-2 w-12 bg-muted rounded mb-1.5" />
          <div className="h-4 w-8 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
