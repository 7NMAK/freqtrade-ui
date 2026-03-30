"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { REFRESH_INTERVALS } from "@/lib/constants";
import { getBots, getStrategies } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_STATIC = [
  // MAIN
  { label: "MAIN", items: [
    { name: "Dashboard", href: "/dashboard", icon: "📊", dotKey: "anyRunning" },
    { name: "Strategies", href: "/strategies", icon: "📋", badgeKey: "liveFmt" },
    { name: "Strategy Builder", href: "/builder", icon: "🔧", dotKey: "anyRunning" },
  ]},
  // MONITOR
  { label: "MONITOR", items: [
    { name: "Backtesting", href: "/backtesting", icon: "⚡" },
    { name: "Experiments", href: "/experiments", icon: "🧪" },
    { name: "Analytics", href: "/analytics", icon: "📈", dotKey: "anyRunning" },
    { name: "AI Insights", href: "/ai-insights", icon: "🤖", dotKey: "anyRunning" },
    { name: "Risk", href: "/risk", icon: "🛡️", dotKey: "anyRunning" },
    { name: "FreqAI", href: "/freqai", icon: "🧠", dotKey: "anyRunning" },
  ]},
  // SYSTEM
  { label: "SYSTEM", items: [
    { name: "Data", href: "/data", icon: "💾" },
    { name: "Settings", href: "/settings", icon: "⚙️" },
    { name: "Docs", href: "/docs", icon: "📖" },
  ]},
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const toast = useToast();
  const [botCount, setBotCount] = useState<number>(0);
  const [anyRunning, setAnyRunning] = useState(false);
  const [liveFmt, setLiveFmt] = useState("0 live");

  // S-2, S-3: Load bot + strategy counts for badges and footer
  useEffect(() => {
    async function loadSidebarData() {
      try {
        const [bots, strategies] = await Promise.all([
          getBots().catch((): import("@/types").Bot[] => []),
          getStrategies().catch((): import("@/types").Strategy[] => []),
        ]);
        const running = bots.some((b) => b.status === "running");
        setAnyRunning(running);
        setBotCount(bots.length);
        const liveCount = strategies.filter((s) => s.lifecycle === "live").length;
        setLiveFmt(`${liveCount} live`);
      } catch { /* non-blocking */
        // Non-critical — sidebar still renders with static defaults
      }
    }
    loadSidebarData();
    // 30s refresh is acceptable for sidebar badges — bot/strategy counts
    // change infrequently. Shorter intervals would add unnecessary API load.
    const interval = setInterval(loadSidebarData, REFRESH_INTERVALS.SIDEBAR);
    return () => clearInterval(interval);
  }, [toast]);

  return (
    <aside
      className={clsx(
        "bg-bg-1 border-r border-border flex flex-col shrink-0 overflow-y-auto transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-sidebar"
      )}
    >
      {/* S-1: Logo + Collapse Toggle */}
      <div className="flex items-center border-b border-border">
        <Link
          href="/dashboard"
          className={clsx(
            "flex items-center gap-2.5 hover:bg-bg-2 transition-colors flex-1",
            collapsed ? "px-3 py-[18px] justify-center" : "px-5 py-[18px]"
          )}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-purple rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0">
            FT
          </div>
          {!collapsed && (
            <div>
              <div className="text-md font-bold text-text-0 tracking-tight">FreqTrade</div>
              <div className="text-2xs text-text-3 font-medium">Trading Platform</div>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className={clsx(
            "text-text-3 hover:text-text-1 hover:bg-bg-2 transition-all cursor-pointer shrink-0",
            collapsed ? "absolute top-[18px] left-[60px] z-10 bg-bg-1 border border-border rounded-r-md px-1 py-1.5 text-[10px]" : "px-2 py-3 text-xs"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* S-2: Navigation */}
      <nav className={clsx("flex-1", collapsed ? "p-1.5" : "p-3")}>
        {NAV_STATIC.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <div className="text-2xs font-semibold text-text-3 uppercase tracking-wider px-3 py-1.5 mb-0.5">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname?.startsWith(item.href + "/");

              // Resolve dynamic badge / dot
              const badge: string | undefined =
                !collapsed && "badgeKey" in item && item.badgeKey === "liveFmt"
                  ? liveFmt
                  : !collapsed && "badge" in item && typeof item.badge === "string"
                  ? item.badge
                  : undefined;

              const showDot: boolean =
                "dotKey" in item && item.dotKey === "anyRunning"
                  ? anyRunning
                  : false;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={clsx(
                    "flex items-center rounded-btn text-sm font-medium transition-all duration-150 relative",
                    collapsed ? "justify-center px-0 py-2.5 my-0.5" : "gap-2.5 px-3 py-2",
                    active
                      ? "bg-accent-glow text-accent"
                      : "text-text-2 hover:bg-bg-3 hover:text-text-1"
                  )}
                >
                  <span className={clsx("text-center text-md shrink-0", collapsed ? "w-full" : "w-[18px]")}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="flex-1">{item.name}</span>}
                  {!collapsed && badge && (
                    <span
                      className={clsx(
                        "text-2xs font-semibold px-1.5 py-px rounded-full",
                        active ? "bg-accent-glow text-accent" : "bg-bg-3 text-text-2"
                      )}
                    >
                      {badge}
                    </span>
                  )}
                  {showDot && (
                    <span
                      className={clsx(
                        "w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_6px_var(--color-green)] flex-shrink-0",
                        collapsed && "absolute top-1 right-1"
                      )}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* S-3: Footer Status */}
      <div className={clsx(
        "border-t border-border text-xs text-text-3",
        collapsed ? "px-2 py-3 text-center" : "px-4 py-3.5"
      )}>
        {collapsed ? (
          <div
            className={clsx(
              "w-[7px] h-[7px] rounded-full mx-auto",
              anyRunning
                ? "bg-green shadow-[0_0_6px_var(--color-green)]"
                : "bg-red-dim"
            )}
            title={`${botCount} bot${botCount !== 1 ? "s" : ""}`}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <div
              className={clsx(
                "w-[7px] h-[7px] rounded-full shrink-0",
                anyRunning
                  ? "bg-green shadow-[0_0_6px_var(--color-green)]"
                  : "bg-red-dim"
              )}
            />
            FreqTrade 2026.2 —{" "}
            {botCount > 0 ? `${botCount} bot${botCount !== 1 ? "s" : ""}` : "no bots"}
          </div>
        )}
      </div>
    </aside>
  );
}
