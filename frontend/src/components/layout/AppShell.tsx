"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AuthGuard from "@/lib/AuthGuard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed_v2";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
}

export default function AppShell({ title, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(true);

  // DS v1.4: sidebar defaults to collapsed (56px). Only restore expanded state if user explicitly expanded.
  // On first ever load, there's no key → stays collapsed.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      // Only expand if explicitly saved as "false" (user clicked expand)
      if (saved === "false") {
        setCollapsed(false);
      }
      // If no saved value exists, ensure default collapsed is persisted
      if (saved === null) {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
      }
    }
  }, []);

  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  }

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={handleToggle} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title={title} />
          <main className="flex-1 overflow-y-auto p-0 bg-background">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
