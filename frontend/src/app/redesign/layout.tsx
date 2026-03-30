"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
// TooltipProvider removed — using custom Tooltip component
import { ScrollArea } from "@/components/ui/scroll-area";

/* ── Navigation structure ── */
const NAV = [
  {
    label: "TRADE",
    items: [
      { href: "/redesign/dashboard", icon: "📊", name: "Dashboard", live: true },
      { href: "/redesign/strategies", icon: "🎯", name: "Strategies", badge: "3 live" },
      { href: "/redesign/risk", icon: "🛡️", name: "Risk", live: true },
    ],
  },
  {
    label: "BUILD",
    items: [
      { href: "/redesign/builder", icon: "✏️", name: "Strategy Builder" },
      { href: "/redesign/backtesting", icon: "🧪", name: "Backtesting", badge: "2 runs" },
      { href: "/redesign/freqai", icon: "🤖", name: "FreqAI" },
    ],
  },
  {
    label: "ANALYZE",
    items: [
      { href: "/redesign/analytics", icon: "📈", name: "Analytics" },
      { href: "#", icon: "📒", name: "Journal", badge: "847" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/redesign/data", icon: "💾", name: "Data" },
      { href: "/redesign/settings", icon: "⚙️", name: "Settings" },
    ],
  },
];

const MOCK_NOTIFICATIONS = [
  { id: 1, text: "Bot bot-trend-01 opened LONG BTC/USDT at 68,432.10", time: "2m ago", type: "trade" },
  { id: 2, text: "Backtesting job completed: RSI-BB-Trend strategy", time: "15m ago", type: "system" },
  { id: 3, text: "Kill switch triggered on bot-scalp-03 (heartbeat timeout)", time: "1h ago", type: "alert" },
  { id: 4, text: "FreqAI training complete: LightGBMRegressor (87.3% acc)", time: "3h ago", type: "system" },
];

function Sidebar() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNav = NAV.map(group => ({
    ...group,
    items: group.items.filter(item =>
      searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(group => group.items.length > 0);

  return (
    <aside className="w-sidebar flex-shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary to-ft-purple flex items-center justify-center text-sm font-extrabold text-white">
            FT
          </div>
          <div>
            <div className="text-[15px] font-bold text-white tracking-tight">FreqTrade</div>
            <div className="text-2xs text-sidebar-foreground/50">Trading Platform</div>
          </div>
        </div>
      </div>

      {/* Search in sidebar */}
      <div className="px-3 pt-3">
        <input
          type="text"
          placeholder="Filter navigation..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full h-8 px-3 rounded-[8px] bg-sidebar-accent/50 border border-sidebar-border text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/30 outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        {filteredNav.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="text-2xs font-semibold text-sidebar-foreground/30 uppercase tracking-[1.2px] px-3 mb-2">
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-colors mb-0.5 ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <span className="w-5 text-center text-[15px]">{item.icon}</span>
                  {item.name}
                  {"live" in item && (item as { live?: boolean }).live && (
                    <span className="ml-auto w-[7px] h-[7px] rounded-full bg-ft-green animate-pulse-green" />
                  )}
                  {item.badge && (
                    <span className="ml-auto text-2xs font-semibold px-2 py-0.5 rounded-full bg-sidebar-accent text-sidebar-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </ScrollArea>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-sidebar-border flex items-center gap-2 text-xs text-sidebar-foreground/60">
        <span className="w-2 h-2 rounded-full bg-ft-green animate-pulse-green" />
        FreqTrade 2026.2 · 5 bots
      </div>
    </aside>
  );
}

function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleKillSwitch = () => {
    if (window.confirm("KILL SWITCH: This will stop all bots and force-exit all positions. Are you sure?")) {
      alert("Kill switch activated (mock). All bots stopped, positions force-exited.");
    }
  };

  return (
    <header className="h-header flex-shrink-0 bg-card border-b border-border flex items-center px-7 gap-5">
      <div className="flex-1">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          Good afternoon, Novak
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Saturday, March 29, 2026 · All systems online
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-sm">⌕</span>
          <input
            type="text"
            placeholder="Search strategies, pairs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-[220px] h-9 pl-8 pr-3 rounded-btn bg-accent/50 border border-border text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground/40 border border-border rounded px-1">⌘K</kbd>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            className="relative w-9 h-9 rounded-btn bg-accent/50 border border-border flex items-center justify-center text-sm text-muted-foreground hover:bg-accent transition-colors"
            onClick={() => { setNotifOpen(!notifOpen); setAvatarMenuOpen(false); }}
          >
            🔔
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-ft-red text-white text-[10px] font-bold flex items-center justify-center px-1">
                {notifications.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Notifications</span>
                {notifications.length > 0 && (
                  <button className="text-2xs text-muted-foreground hover:text-foreground" onClick={() => setNotifications([])}>
                    Clear all
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="px-4 py-3 border-b border-border/50 hover:bg-accent/20 transition-colors flex gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-foreground leading-relaxed">{n.text}</div>
                      <div className="text-2xs text-muted-foreground mt-0.5">{n.time}</div>
                    </div>
                    <button
                      className="text-muted-foreground/50 hover:text-foreground text-xs self-start"
                      onClick={() => dismissNotification(n.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Kill switch */}
        <button
          className="h-9 px-4 rounded-btn bg-ft-red/8 border border-ft-red/20 text-ft-red text-xs font-bold tracking-wide hover:bg-ft-red/15 hover:border-ft-red/40 transition-colors flex items-center gap-2"
          onClick={handleKillSwitch}
        >
          KILL
        </button>

        {/* Avatar */}
        <div className="relative" ref={avatarRef}>
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-ft-purple flex items-center justify-center text-xs font-bold text-white cursor-pointer ml-1"
            onClick={() => { setAvatarMenuOpen(!avatarMenuOpen); setNotifOpen(false); }}
          >
            N
          </div>
          {avatarMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden py-1">
              {[
                { label: "Profile", action: () => alert("Profile page (mock)") },
                { label: "Settings", action: () => { window.location.href = "/redesign/settings"; } },
                { label: "Logout", action: () => { if (window.confirm("Log out?")) alert("Logged out (mock)"); } },
              ].map(item => (
                <button
                  key={item.label}
                  className="w-full text-left px-4 py-2 text-xs text-foreground hover:bg-accent/30 transition-colors"
                  onClick={() => { item.action(); setAvatarMenuOpen(false); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function RedesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <ScrollArea className="flex-1">
          <div className="p-7 pb-12">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
