"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type ToastType = "error" | "warning" | "info" | "success" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Optional action button label + handler */
  action?: { label: string; onClick: () => void };
  /** Duration in ms. 0 = no auto-dismiss. */
  duration: number;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    error: (msg: string, opts?: Partial<Toast>) => string;
    warning: (msg: string, opts?: Partial<Toast>) => string;
    info: (msg: string, opts?: Partial<Toast>) => string;
    success: (msg: string, opts?: Partial<Toast>) => string;
    loading: (msg: string, opts?: Partial<Toast>) => string;
    dismiss: (id: string) => void;
    update: (id: string, patch: Partial<Toast>) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Durations per ERROR_HANDLING.md ───────────────────────────────────────

const DURATIONS: Record<ToastType, number> = {
  error: 10000,
  warning: 6000,
  info: 3000,
  success: 3000,
  loading: 0, // no auto-dismiss
};

// ── Icons ─────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  error: "✕",
  warning: "!",
  info: "ℹ",
  success: "✓",
  loading: "⟳",
};

const STYLES: Record<ToastType, string> = {
  error: "bg-rose-500/10 border-rose-500/30 text-rose-500",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-500",
  info: "bg-muted/50 border-border text-muted-foreground",
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500",
  loading: "bg-muted/50 border-border text-muted-foreground",
};

const ICON_STYLES: Record<ToastType, string> = {
  error: "bg-red text-white",
  warning: "bg-amber text-black",
  info: "bg-primary text-white",
  success: "bg-green text-white",
  loading: "bg-muted text-muted-foreground",
};

// ── Provider ──────────────────────────────────────────────────────────────

let _idCounter = 0;
function generateId() {
  _idCounter += 1;
  return `t${Date.now().toString(36)}-${_idCounter}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, opts: Partial<Toast> = {}): string => {
      const id = opts.id ?? generateId();
      const duration = opts.duration ?? DURATIONS[type];
      const toast: Toast = {
        id,
        type,
        message,
        duration,
        createdAt: Date.now(),
        ...opts,
      };

      setToasts((prev) => {
        // If same id exists, update it
        const existing = prev.findIndex((t) => t.id === id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = toast;
          return next;
        }
        // Max 5 toasts
        const trimmed = prev.length >= 5 ? prev.slice(1) : prev;
        return [...trimmed, toast];
      });

      if (duration > 0) {
        const existing = timersRef.current.get(id);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const update = useCallback((id: string, patch: Partial<Toast>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const contextValue: ToastContextValue = {
    toasts,
    toast: {
      error: (msg, opts) => add("error", msg, opts),
      warning: (msg, opts) => add("warning", msg, opts),
      info: (msg, opts) => add("info", msg, opts),
      success: (msg, opts) => add("success", msg, opts),
      loading: (msg, opts) => add("loading", msg, opts),
      dismiss,
      update,
    },
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}

// ── Toast Container ───────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 w-[360px] max-w-[calc(100vw-40px)]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Single Toast ─────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const { duration } = toast;

  useEffect(() => {
    if (!duration) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div
      className={`relative flex items-start gap-3 p-3.5 rounded-card border shadow-xl overflow-hidden
        animate-[slideInRight_0.2s_ease-out] ${STYLES[toast.type]}`}
      style={{ animation: "slideInRight 0.2s ease-out" }}
    >
      {/* Icon */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5
          ${ICON_STYLES[toast.type]} ${toast.type === "loading" ? "animate-spin" : ""}`}
      >
        {ICONS[toast.type]}
      </div>

      {/* Message + action */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground leading-snug break-words">{toast.message}</div>
        {toast.action && (
          <button
            type="button"
            onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
            className="text-xs font-semibold mt-1.5 underline cursor-pointer hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close */}
      {toast.type !== "loading" && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="text-muted-foreground hover:text-muted-foreground transition-colors text-xs shrink-0 mt-0.5 cursor-pointer"
        >
          ✕
        </button>
      )}

      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/10">
          <div
            className="h-full bg-current opacity-40 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
