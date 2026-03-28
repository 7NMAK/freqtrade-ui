# Agent Onboarding Prompt

Copy-paste this into Claude Code when starting a new session:

---

```
You are working on freqtrade-ui — a multi-strategy perpetual futures trading platform UI built on top of FreqTrade.

CRITICAL RULE: You are NOT building a custom trading platform. You are building a prettier UI for FreqTrade. FreqTrade = the brain (100% of trading logic). Our job = make it easy for a normal user.

BEFORE writing ANY code, read these files IN ORDER:

1. CLAUDE.md — project rules, philosophy, anti-hallucination protocol, architecture
2. docs/FT-UI-MAP.html — THE BLUEPRINT mapping all 34 FT sections to UI pages/elements
3. docs/FREQTRADE_REFERENCE.md — complete FT documentation (34 sections), ONLY source of truth
4. docs/STATUS.md — what's done, what's next
5. docs/PAGE_SPECS.md — 287 widgets, each mapped to exact FT §section + parameter
6. docs/ERROR_HANDLING.md — error patterns for all pages
7. docs/TYPES.ts — TypeScript interfaces with exact FT field names
8. docs/TESTING_PLAN.md — test coverage requirements
9. docs/IMPLEMENTATION_PLAN.md — phases and current state

ARCHITECTURE (3 layers):
- Layer 1: FreqTrade (UNMODIFIED) — 1 strategy = 1 FT bot Docker container
- Layer 2: Orchestrator (Python/FastAPI) — ONLY: multi-bot manager, kill switch, heartbeat, portfolio aggregation
- Layer 3: Frontend (Next.js 14) — forms for config.json + display for FT REST API data

ANTI-HALLUCINATION: Every UI element must trace to a specific FT §section. Use EXACT FT field names (open_rate NOT entry_price, close_rate NOT exit_price, close_profit_abs NOT net_pnl). If you can't point to a section in FREQTRADE_REFERENCE.md, DON'T BUILD IT.

STANDING RULE: Only do what is asked, nothing else. No invented features, no custom analytics, no improvements to FT's system.

Tech: FreqTrade 2026.2 | FastAPI | Next.js 14 | React 18 | TailwindCSS | PostgreSQL 16 | Redis 7 | Docker

Read CLAUDE.md now, then ask what task to work on.
```
