"use client";

import React, { useCallback, useRef, useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation dialog — replaces all window.confirm() usages.
 * Supports danger (red), warning (amber), and default (neutral) variants.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when opening
  useEffect(() => {
    if (open) confirmBtnRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const btnColor =
    variant === "danger"
      ? "bg-red text-white hover:brightness-110"
      : variant === "warning"
        ? "bg-amber-600 text-white hover:brightness-110"
        : "bg-primary text-white hover:brightness-110";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-[#151515] border border-white/[0.12] rounded-lg p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-sm font-bold mb-2 ${variant === "danger" ? "text-rose-500" : variant === "warning" ? "text-amber-500" : "text-foreground"}`}>
          {title}
        </h3>
        <p className="text-xs text-[#9CA3AF] leading-relaxed mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 text-xs font-semibold rounded border border-white/[0.10] text-[#9CA3AF] hover:bg-white/[0.06] cursor-pointer transition-all"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2 text-xs font-semibold rounded cursor-pointer transition-all ${btnColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing confirm dialog state.
 * Returns [dialogProps, confirm] where confirm() returns a Promise<boolean>.
 */
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "default";
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    variant: "default",
    resolve: null,
  });

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      variant?: "danger" | "warning" | "default";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? "Confirm",
          variant: opts.variant ?? "default",
          resolve,
        });
      });
    },
    []
  );

  const onConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const onCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const dialogProps = {
    open: state.open,
    title: state.title,
    message: state.message,
    confirmLabel: state.confirmLabel,
    variant: state.variant,
    onConfirm,
    onCancel,
  };

  return [dialogProps, confirm] as const;
}
