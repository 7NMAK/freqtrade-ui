"use client";

import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    // Store component stack for display
    this.setState((prev) => ({ ...prev, componentStack: info.componentStack ?? "" }));
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-sm font-semibold text-foreground mb-2">Something went wrong</div>
          <div className="text-xs text-muted-foreground mb-3 max-w-sm font-mono">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </div>
          {this.state.error?.stack && (
            <pre className="text-[9px] text-left text-muted-foreground mb-3 max-w-lg font-mono overflow-auto max-h-40 bg-black/50 p-2 rounded">
              {this.state.error.stack}
            </pre>
          )}
          {this.state.componentStack && (
            <pre className="text-[9px] text-left text-red-400/70 mb-5 max-w-lg font-mono overflow-auto max-h-40 bg-black/50 p-2 rounded">
              {this.state.componentStack}
            </pre>
          )}
          <button
            type="button"
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-btn hover:bg-primary-dim transition-colors cursor-pointer"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
