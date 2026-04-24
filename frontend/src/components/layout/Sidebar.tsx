"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Layers,
  Code2,
  FlaskConical,
  BarChart3,
  Shield,
  Brain,
  Database,
  Settings,
  BookOpen,
  Sparkles,
  ChevronsLeft,
} from "lucide-react";
import { REFRESH_INTERVALS } from "@/lib/constants";
import { getBots, getStrategies } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  dotKey?: string;
  badgeKey?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_STATIC: NavSection[] = [
  { label: "MAIN", items: [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, dotKey: "anyRunning" },
    { name: "Strategies", href: "/strategies", icon: Layers, badgeKey: "liveFmt" },
    { name: "Strategy Builder", href: "/builder", icon: Code2, dotKey: "anyRunning" },
  ]},
  { label: "MONITOR", items: [
    { name: "Experiments", href: "/experiments", icon: FlaskConical },
    { name: "Analytics", href: "/analytics", icon: BarChart3, dotKey: "anyRunning" },
    { name: "AI Insights", href: "/ai-insights", icon: Sparkles, dotKey: "anyRunning" },
    { name: "Risk", href: "/risk", icon: Shield, dotKey: "anyRunning" },
    { name: "FreqAI", href: "/freqai", icon: Brain, dotKey: "anyRunning" },
  ]},
  { label: "SYSTEM", items: [
    { name: "Data", href: "/data", icon: Database },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Docs", href: "/docs", icon: BookOpen },
  ]},
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const toast = useToast();
  const [botCount, setBotCount] = useState<number>(0);
  const [anyRunning, setAnyRunning] = useState<boolean | null>(false);
  const [liveFmt, setLiveFmt] = useState("0 live");

  const [sidebarError, setSidebarError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSidebarData() {
      try {
        const [bots, strategies] = await Promise.all([
          getBots(),
          getStrategies(),
        ]);
        if (!isMounted) return;
        const running = bots.some((b) => b.status === "running");
        setAnyRunning(running);
        setBotCount(bots.length);
        const liveCount = strategies.filter((s) => s.lifecycle === "live").length;
        setLiveFmt(`${liveCount} live`);
        setSidebarError(null);
      } catch (err) {
        if (!isMounted) return;
        // Do NOT fall back to [] — "0 bots" would be visually identical to
        // "no bots registered" and mislead the operator. Surface the error.
        setSidebarError(err instanceof Error ? err.message : "Load failed");
        setAnyRunning(null);
      }
    }
    loadSidebarData();
    const interval = setInterval(loadSidebarData, REFRESH_INTERVALS.SIDEBAR);
    return () => { isMounted = false; clearInterval(interval); };
  }, [toast]);

  return (
    <aside
      className={clsx(
        "bg-black border-r border-white/[0.10] flex flex-col shrink-0 overflow-y-auto overflow-x-hidden transition-[width] duration-250 ease-in-out",
        collapsed ? "w-[56px]" : "w-[240px]"
      )}
    >
      {/* Logo + Collapse Toggle */}
      <div className={clsx(
        "flex items-center border-b border-white/[0.10] h-14 shrink-0",
        collapsed ? "justify-center px-0" : "px-5 justify-between"
      )}>
        <Link
          href="/dashboard"
          className={clsx(
            "flex items-center gap-2.5 hover:opacity-80 transition-opacity",
            collapsed && "justify-center"
          )}
        >
          <div className="w-6 h-6 bg-white rounded-[3px] shrink-0" />
          {!collapsed && (
            <span className="text-[13px] uppercase tracking-widest text-white font-semibold">
              Orchestrator V4
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="text-[#9CA3AF] hover:text-white transition-colors cursor-pointer shrink-0"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft
            className="w-4 h-4"
            style={{ transition: "transform 0.25s ease", transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className={clsx("flex-1", collapsed ? "px-1 py-2" : "px-3 py-3")}>
        {NAV_STATIC.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-1.5 mb-1">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                pathname?.startsWith(item.href + "/");

              const badge: string | undefined =
                !collapsed && item.badgeKey === "liveFmt"
                  ? liveFmt
                  : undefined;

              const showDot: boolean =
                item.dotKey === "anyRunning" ? anyRunning === true : false;

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={clsx(
                    "flex items-center rounded-md text-[13px] font-medium transition-all duration-150 relative",
                    collapsed ? "justify-center px-0 py-2.5 my-0.5" : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-white/10 text-white font-semibold"
                      : "text-[#9CA3AF] hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  <Icon className={clsx("w-[18px] h-[18px] shrink-0", active ? "text-white" : "text-[#9CA3AF]")} />
                  {!collapsed && <span className="flex-1">{item.name}</span>}
                  {!collapsed && badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-white/10 text-[#9CA3AF]">
                      {badge}
                    </span>
                  )}
                  {showDot && (
                    <span
                      className={clsx(
                        "w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e] flex-shrink-0",
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

      {/* Footer Status */}
      <div className={clsx(
        "border-t border-white/[0.10] text-xs text-[#9CA3AF]",
        collapsed ? "px-2 py-3 text-center" : "px-4 py-3.5"
      )}>
        {collapsed ? (
          <div
            className={clsx(
              "w-[7px] h-[7px] rounded-full mx-auto",
              anyRunning
                ? "bg-[#22c55e] shadow-[0_0_6px_#22c55e]"
                : "bg-[#ef4444]"
            )}
            title={`${botCount} bot${botCount !== 1 ? "s" : ""}`}
          />
        ) : (
          <div className="flex items-center gap-1.5 font-mono text-[11px]" title={sidebarError ?? undefined}>
            <div
              className={clsx(
                "w-[7px] h-[7px] rounded-full shrink-0",
                sidebarError
                  ? "bg-amber-500 shadow-[0_0_6px_#f59e0b]"
                  : anyRunning
                    ? "bg-[#22c55e] shadow-[0_0_6px_#22c55e]"
                    : "bg-[#ef4444]"
              )}
            />
            FreqTrade 2026.2 —{" "}
            {sidebarError
              ? <span className="text-amber-400">load error</span>
              : botCount > 0
                ? `${botCount} bot${botCount !== 1 ? "s" : ""}`
                : "no bots"}
          </div>
        )}
      </div>
    </aside>
  );
}
