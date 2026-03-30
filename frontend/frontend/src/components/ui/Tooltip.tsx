"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";

interface TooltipProps {
  /** Tooltip description text */
  content: string;
  /** Optional FT config key shown at bottom in monospace */
  configKey?: string;
  children: ReactNode;
  /** Preferred position (auto-adjusts if clipped) */
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({
  content,
  configKey,
  children,
  position = "top",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [actualPos, setActualPos] = useState(position);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 200);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tipRef.current) return;

    const tr = triggerRef.current.getBoundingClientRect();
    const tp = tipRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;
    let pos = position;

    // Calculate preferred position
    const calc = (p: string) => {
      switch (p) {
        case "top":
          top = tr.top - tp.height - gap;
          left = tr.left + tr.width / 2 - tp.width / 2;
          break;
        case "bottom":
          top = tr.bottom + gap;
          left = tr.left + tr.width / 2 - tp.width / 2;
          break;
        case "left":
          top = tr.top + tr.height / 2 - tp.height / 2;
          left = tr.left - tp.width - gap;
          break;
        case "right":
          top = tr.top + tr.height / 2 - tp.height / 2;
          left = tr.right + gap;
          break;
      }
    };

    calc(position);

    // Flip if clipped
    if (top < 4) {
      pos = "bottom";
      calc("bottom");
    } else if (top + tp.height > window.innerHeight - 4) {
      pos = "top";
      calc("top");
    }

    // Clamp horizontal
    if (left < 4) left = 4;
    if (left + tp.width > window.innerWidth - 4) left = window.innerWidth - tp.width - 4;

    setCoords({ top, left });
    setActualPos(pos);
  }, [visible, position]);

  // Hide on scroll to prevent stale positioning
  useEffect(() => {
    if (!visible) return;
    const onScroll = () => setVisible(false);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [visible]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <span
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex items-center gap-1 cursor-help"
    >
      {children}
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        className="text-muted-foreground flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <text
          x="8"
          y="12"
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="currentColor"
        >
          ?
        </text>
      </svg>

      {visible && (
        <div
          ref={tipRef}
          role="tooltip"
          style={{ top: coords.top, left: coords.left }}
          className={[
            "fixed z-[9999] max-w-[280px] px-3 py-2.5 rounded-lg",
            "bg-muted border border-border shadow-lg shadow-black/40",
            "text-xs leading-relaxed text-muted-foreground",
            "animate-in fade-in duration-150",
            "pointer-events-none",
          ].join(" ")}
          data-position={actualPos}
        >
          <p className="m-0">{content}</p>
          {configKey && (
            <p className="m-0 mt-1.5 pt-1.5 border-t border-border/50 font-mono text-[9.5px] text-purple opacity-70">
              Config: {configKey}
            </p>
          )}
        </div>
      )}
    </span>
  );
}
