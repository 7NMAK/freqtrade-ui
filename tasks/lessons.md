# Lessons Learned — FreqTrade UI Project

> Updated after every correction. Read at session start.
> Format: **Pattern** → **Rule** → **Why**

---

## TypeScript & Type Safety

### L1: Never use `as Record<string, unknown>` to access nested properties
- **Pattern:** When FT API returns nested objects (exchange, telegram, freqai), casting parent to `Record<string, unknown>` to access child fields.
- **Rule:** Create proper interfaces for every nested config section. Add them as optional typed fields on the parent interface. Use TypeScript's structural narrowing (`typeof`, discriminated unions) instead of casts.
- **Why:** `as Record<string, unknown>` hides real type errors and makes refactoring impossible. User explicitly forbade this: *"da sve unknown moraju da se rese systematski i po kod standradu a ne da se koristi hack (zabranjeno)"*.

### L2: `Promise.allSettled` preserves tuple types — don't cast `.value`
- **Pattern:** After `Promise.allSettled([typedCall1(), typedCall2()])`, casting `results[0].value as SomeType`.
- **Rule:** TypeScript 4.5+ preserves tuple types through `Promise.allSettled`. After narrowing with `results[n].status === "fulfilled"`, `.value` is already correctly typed. Casts are redundant.
- **Why:** Redundant casts mask bugs when API return types change.

### L3: Filter + map doesn't narrow — use type guard filter
- **Pattern:** `array.filter(x => x.field != null).map(x => x.field as number)` — TypeScript doesn't narrow through `.filter()`.
- **Rule:** Use type guard syntax: `.map(x => x.field).filter((v): v is number => v != null)` or inline predicate.
- **Why:** Proper narrowing eliminates the need for casts entirely.

### L4: Discriminated union narrowing requires checking the raw variable
- **Pattern:** `FTProtection` is a union discriminated on `method`. Checking `prot.method === "MaxDrawdown"` after spreading into new object doesn't narrow — the spread broke the union.
- **Rule:** Always narrow on the original union variable before spreading or transforming. `rawProt.method === "MaxDrawdown"` narrows `rawProt` but `derivedObject.method === "MaxDrawdown"` doesn't narrow `rawProt`.
- **Why:** TypeScript only narrows the variable that was tested, not aliases or transformations of it.

### L5: `JSON.parse` returns `any` — define a complete interface once
- **Pattern:** `JSON.parse(rawState)` followed by 50+ individual `as string`, `as number` casts on each field.
- **Rule:** Define a single `BuilderState` interface with all union types matching the actual state, then `const bs: BuilderState = JSON.parse(rawState)`. One annotation replaces 50+ casts.
- **Why:** Maintains type safety at the boundary while being DRY.

### L6: `as const` and `satisfies` are standard TypeScript — not hacks
- **Pattern:** Confusion about whether `as const`, `satisfies`, `as HTMLSelectElement`, `as never` (for dynamic key patterns) are "hacks".
- **Rule:** These are standard TypeScript patterns. The ban is on `as Record<string, unknown>` and `as SomeType` to paper over missing interfaces. Legitimate narrowing and literal assertions are fine.
- **Why:** Don't over-correct — standard patterns exist for a reason.

### L7: Dynamic filter params — create a unified params interface
- **Pattern:** Pairlist filters have `params: Record<string, unknown>`, requiring `f.params.min_days_listed as number` everywhere.
- **Rule:** Create `PairlistFilterParams` interface covering all known filter param fields as optional typed properties. One interface covers all filter types.
- **Why:** FT has a finite, documented set of filter parameters (§7). They're all known — no reason for `unknown`.

---

## FreqTrade Specifics

### L8: Always use FT field names — never invent your own
- **Pattern:** Using `entry_price` instead of `open_rate`, `exit_price` instead of `close_rate`.
- **Rule:** Maintain the field name table from CLAUDE.md. Every UI field must map to an exact FT API field.
- **Why:** The whole point of the project — we're a display layer for FT, not a custom system.

### L9: Check FT-UI-MAP.html before building ANY page element
- **Pattern:** Building UI features that "seem useful" but aren't in FT.
- **Rule:** Every input → config.json parameter. Every column → FT trade field. Every button → FT API endpoint. If it's not in the map, it doesn't get built.
- **Why:** Anti-hallucination protocol. FT is the brain, we are the face.

### L10: FT API responses have specific shapes — type them from the docs
- **Pattern:** Leaving API response types as generic `Record<string, unknown>` because "we don't know the exact shape".
- **Rule:** FT REST API (§8) and trade object (§16) are fully documented. All 34 sections of FREQTRADE_REFERENCE.md exist for this purpose. Type everything from the reference.
- **Why:** If you can't point to a section number (§1-§34), the feature doesn't exist.

---

## Build & Infrastructure

### L11: VM filesystem race conditions are not code errors
- **Pattern:** Build fails with `ENOENT: no such file or directory, .next/cache/webpack/...pack_` or `.next/static/.../_ssgManifest.js`.
- **Rule:** These are VM-specific filesystem timing issues. The build compiled and typed successfully — the failure is in the post-build file write. Retry the build. If persistent, delete `.next` cache first.
- **Why:** Don't waste time debugging code when the compiler already passed.

### L12: `@parcel/watcher-linux-arm64-glibc` may be missing on ARM VMs
- **Pattern:** Build crashes with "No prebuild or local build found" for parcel watcher.
- **Rule:** Run `npm install @parcel/watcher-linux-arm64-glibc` on ARM-based Linux VMs.
- **Why:** Optional native dependency not included by default for all platforms.

### L13: Map iteration requires `--downlevelIteration` or `Array.from()`
- **Pattern:** `for (const [key, val] of map)` fails with "can only be iterated through when using '--downlevelIteration'".
- **Rule:** Use `Array.from(map.entries()).forEach(([key, val]) => { ... })` instead of `for...of` on Maps.
- **Why:** tsconfig targets modern ES but Map iteration requires the flag or the Array.from workaround.

---

## Work Methodology

### L14: Don't push through when something goes sideways — re-plan
- **Pattern:** Continuing to apply fixes when the approach is fundamentally wrong (e.g., adding more `as Record` casts when the real fix is proper interfaces).
- **Rule:** If you've applied 3+ fixes of the same pattern and it still feels wrong, STOP. Re-plan from scratch with the knowledge you now have.
- **Why:** The first approach is often wrong. The cost of re-planning is lower than the cost of a bad foundation.

### L15: User corrections are absolute — don't argue, adapt
- **Pattern:** User says "zabranjeno" (forbidden) about a pattern. Don't justify it, don't explain why it's "technically OK".
- **Rule:** When the user gives a directive about code standards, implement it fully and systematically. Update lessons.md to prevent repeating.
- **Why:** *"samo radi sta ti kazem i nista drugo"* — standing rule.

### L16: Verify with a build, not with "I think it's correct"
- **Pattern:** Marking type fixes as complete without running `npm run build`.
- **Rule:** Every type-safety change must be verified with a full build that includes `tsc` + ESLint. "Would a staff engineer approve this?" means "did you prove it works?"
- **Why:** TypeScript errors only surface at build time. Editing without building is guessing.

### L17: ESLint unused-var errors are real blockers
- **Pattern:** Fixing type issues introduces ESLint failures (`'x' is assigned a value but never used`). These block the build.
- **Rule:** After any refactor, check for unused variables. Either use them, prefix with `_`, or add `// eslint-disable-next-line` with a TODO comment explaining intent.
- **Why:** Next.js build treats ESLint errors as fatal in production builds.

---

## Security & Auth

### L18: SSH tunnel = HTTPS equivalent for closed servers
- **Pattern:** Flagging "no HTTPS" as a critical security issue.
- **Rule:** If all ports are bound to `127.0.0.1` and access is only via SSH tunnel, HTTPS is unnecessary. SSH provides AES-256 encryption in transit. Let's Encrypt requires public port 80 + domain — not applicable for tunnel-only setups.
- **Why:** Don't create false security requirements that don't match the deployment model.

### L19: Token expiry must be handled proactively
- **Pattern:** JWT stored in localStorage with no TTL check. Token expires server-side → silent 401 → jarring redirect.
- **Rule:** Check token expiry on page load and periodically (e.g., every 60s). Redirect to login with `?expired=1` message before the API call fails.
- **Why:** Better UX than random failures mid-workflow. (Implemented in AuthGuard update.)

---

*Last updated: 2026-03-29*
*Review this file at the start of every session.*
