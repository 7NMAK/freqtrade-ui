"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { TOOLTIPS } from "@/lib/tooltips";

// ---------------------------------------------------------------------------
// Category mapping: FT reference section -> category name + UI page
// ---------------------------------------------------------------------------

interface CategoryDef {
  label: string;
  page: string;       // Next.js route
  pageLabel: string;   // Human-readable page name
}

const SECTION_TO_CATEGORY: Record<string, CategoryDef> = {
  "§1":  { label: "Settings",           page: "/settings",    pageLabel: "Settings" },
  "§2":  { label: "Strategy Builder",   page: "/builder",     pageLabel: "Strategy Builder" },
  "§5":  { label: "Backtesting",        page: "/backtesting", pageLabel: "Backtesting" },
  "§6":  { label: "Hyperopt",           page: "/backtesting", pageLabel: "Backtesting" },
  "§7":  { label: "Pairlists & Protections", page: "/settings", pageLabel: "Settings" },
  "§10": { label: "Leverage / Futures", page: "/builder",     pageLabel: "Strategy Builder" },
  "§11": { label: "Telegram",           page: "/settings",    pageLabel: "Settings" },
  "§12": { label: "Data Management",    page: "/data",        pageLabel: "Data" },
  "§13": { label: "Webhooks",           page: "/settings",    pageLabel: "Settings" },
  "§17": { label: "Producer / Consumer", page: "/settings",   pageLabel: "Settings" },
  "§21": { label: "Lookahead Analysis", page: "/backtesting", pageLabel: "Backtesting" },
  "§22": { label: "Recursive Analysis", page: "/backtesting", pageLabel: "Backtesting" },
  "§24": { label: "FreqAI Core",        page: "/freqai",      pageLabel: "FreqAI" },
  "§25": { label: "Reinforcement Learning", page: "/freqai",  pageLabel: "FreqAI" },
  "§26": { label: "Feature Processing", page: "/freqai",      pageLabel: "FreqAI" },
  "§28": { label: "Multi-Instance & Logging", page: "/settings", pageLabel: "Settings" },
  "§29": { label: "Orderflow",          page: "/analytics",   pageLabel: "Analytics" },
};

// ---------------------------------------------------------------------------
// Build the knowledge base entries from TOOLTIPS
// ---------------------------------------------------------------------------

interface KBEntry {
  key: string;
  description: string;
  configKey: string;
  section: string;
  category: string;
  page: string;
  pageLabel: string;
}

function buildEntries(): KBEntry[] {
  const entries: KBEntry[] = [];
  for (const [key, tip] of Object.entries(TOOLTIPS)) {
    const section = tip.section ?? "§1";
    const cat = SECTION_TO_CATEGORY[section] ?? SECTION_TO_CATEGORY["§1"];
    entries.push({
      key,
      description: tip.description,
      configKey: tip.configKey ?? key,
      section,
      category: cat.label,
      page: cat.page,
      pageLabel: cat.pageLabel,
    });
  }
  return entries;
}

const ALL_ENTRIES = buildEntries();

// Stable category ordering
const CATEGORY_ORDER = [
  "Settings",
  "Strategy Builder",
  "Leverage / Futures",
  "Backtesting",
  "Hyperopt",
  "Pairlists & Protections",
  "Telegram",
  "Webhooks",
  "Producer / Consumer",
  "Multi-Instance & Logging",
  "Data Management",
  "Lookahead Analysis",
  "Recursive Analysis",
  "FreqAI Core",
  "Reinforcement Learning",
  "Feature Processing",
  "Orderflow",
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lowerText.indexOf(lowerQuery, cursor);
  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={`match-${idx}`} className="bg-primary/25 text-primary rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    cursor = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length > 0 ? <>{parts}</> : text;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_ENTRIES;
    const q = search.toLowerCase();
    return ALL_ENTRIES.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.configKey.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }, [search]);

  // Group by category preserving order
  const grouped = useMemo(() => {
    const map = new Map<string, KBEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    // Sort by CATEGORY_ORDER
    const sorted: { category: string; entries: KBEntry[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const entries = map.get(cat);
      if (entries && entries.length > 0) {
        sorted.push({ category: cat, entries });
      }
    }
    // Any remaining categories not in the order list
    Array.from(map.entries()).forEach(([cat, entries]) => {
      if (!CATEGORY_ORDER.includes(cat)) {
        sorted.push({ category: cat, entries });
      }
    });
    return sorted;
  }, [filtered]);

  const toggle = (cat: string) =>
    setOpenSections((prev) => ({ ...prev, [cat]: !prev[cat] }));

  // When searching, auto-expand all sections
  const isOpen = (cat: string) =>
    search.trim() ? true : openSections[cat] ?? false;

  return (
    <AppShell title="Knowledge Base">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            FreqTrade Parameter Reference
          </h1>
          <p className="text-sm text-muted-foreground">
            {ALL_ENTRIES.length} parameters across {CATEGORY_ORDER.length} categories.
            Every entry maps to a real FreqTrade config key or strategy property.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parameters, config keys, or descriptions..."
            className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results count when searching */}
        {search.trim() && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
          </p>
        )}

        {/* Category sections */}
        {grouped.length === 0 && (
          <div className="bg-muted/50 border border-border rounded-[10px] p-8 text-center text-muted-foreground text-sm">
            No parameters match your search.
          </div>
        )}

        {grouped.map(({ category, entries }) => {
          const open = isOpen(category);
          const samplePage = entries[0]?.page ?? "/settings";
          const samplePageLabel = entries[0]?.pageLabel ?? "Settings";
          const section = entries[0]?.section ?? "";

          return (
            <div
              key={category}
              className="bg-muted/50 border border-border rounded-[10px] overflow-hidden"
            >
              {/* Section header */}
              <button
                onClick={() => toggle(category)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ChevronIcon open={open} />
                  <span className="font-semibold text-foreground text-sm">
                    {category}
                  </span>
                  <span className="text-2xs text-muted-foreground bg-card px-2 py-0.5 rounded-full">
                    {entries.length} param{entries.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {section}
                  </span>
                </div>
                <Link
                  href={samplePage}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-primary hover:underline"
                >
                  Go to {samplePageLabel}
                </Link>
              </button>

              {/* Entries */}
              {open && (
                <div className="border-t border-border divide-y divide-border">
                  {entries.map((entry) => (
                    <div
                      key={entry.key}
                      className="px-5 py-3 hover:bg-card/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {/* Parameter name */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-sm font-mono font-semibold text-primary">
                              {highlight(entry.key, search)}
                            </code>
                            {entry.configKey !== entry.key && (
                              <span className="text-2xs text-muted-foreground bg-card px-1.5 py-0.5 rounded font-mono">
                                {highlight(entry.configKey, search)}
                              </span>
                            )}
                          </div>
                          {/* Description */}
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                            {highlight(entry.description, search)}
                          </p>
                        </div>
                        {/* Page link */}
                        <Link
                          href={entry.page}
                          className="text-2xs text-primary hover:underline whitespace-nowrap shrink-0 mt-0.5"
                        >
                          {entry.pageLabel}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
