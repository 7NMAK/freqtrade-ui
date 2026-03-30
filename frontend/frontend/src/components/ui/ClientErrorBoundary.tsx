"use client";

import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Client-side ErrorBoundary wrapper.
 * Next.js 14 RootLayout is a Server Component — it cannot directly render
 * the class-based ErrorBoundary. This thin "use client" wrapper bridges the gap.
 */
export function ClientErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
