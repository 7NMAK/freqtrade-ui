# Rebuild Experiments Section — Orchestrator Kickoff

Ti si **glavni agent — orchestrator**. Ne pišeš kod. Čitaš specifikaciju, formiraš tim agenata, delegiraš, reviewuješ, i routiraš fixeve dok sve ne bude čisto.

## Tvoj task

Potpuni rebuild `frontend/src/app/experiments/` — svih 10 fajlova se pišu ispočetka po pixel-perfect specifikaciji.

## Odmah pročitaj ove fajlove:

1. **`TASK-EXPERIMENTS.md`** — 1030 linija, element-by-element pixel-perfect spec. OVO JE JEDINI IZVOR ISTINE. Sadrži sve CSS klase, value colors, title atribute, form defaults, edge case-ove.
2. **`CLAUDE.md`** — pravila projekta, FT field names, multi-agent workflow, safety rules.
3. **`prototypes/DESIGN-LINEAR-EDGE-FULL.html`** linije 2011–2901 — vizuelni reference (HTML source).

## Formiraj tim agenata:

| Agent | Definicija | Radi | Ne radi |
|-------|-----------|------|---------|
| **Frontend Coder** | `agents/frontend-coder.md` | Piše SVE component fajlove | Ne reviewuje sam sebe |
| **Code Reviewer** | `agents/code-reviewer.md` | Čita kod, poredi sa spec-om | NE PIŠE KOD. Nikad. |
| **QA** | `agents/qa.md` | Runnuje tsc + lint + build | NE PIŠE KOD. Nikad. |

Backend coder NIJE potreban — ovo je čist frontend task.

## Workflow (prati tačno):

```
1. Pročitaj TASK-EXPERIMENTS.md (svih 1030 linija)
2. Delegiraj Frontend Coderu — on mora da pročita TASK-EXPERIMENTS.md PRE koda
3. Kad završi → Code Reviewer proverava SVE (~100+ widgets, pixel perfect, value colors)
4. Ako NEEDS_CHANGES → Frontend Coder fixuje TAČNE probleme iz review-a
5. Review ponovo (CELI fajlovi, ne samo fixeve)
6. Kad APPROVED → QA: npx tsc --noEmit && npx next lint && npm run build
7. Ako QA FAIL → Frontend Coder fixuje, pa Review + QA ponovo
8. Max 3 loop-a. Posle 3 — STOP i reportuj SVE preostale greške.
```

## Ključne napomene koje MORAŠ proslediti Frontend Coderu:

### Git bracket issue (KRITIČNO)
`[strategy]` direktorijum sa zagradama pravi probleme sa gitom. Posle SVAKOG `git pull`:
```bash
git checkout HEAD -- "frontend/src/app/experiments"
```

### Pixel perfect — najčešće greške agenata:
- `builder-input` height = **36px** (ne 34px), border = **rgba(0.22)** (ne 0.10)
- `kpi-label` color = **#6B7280** (ne white/30), weight = **500** (ne 700)
- `section-title` size = **12px** (ne 11px)
- `builder-toggle.on` bg = **rgba(34,197,94,0.12)** — suptilna, NE solid green
- Backtest tab bar ima `border-b-2 border-transparent`, Hyperopt NEMA
- Recursive Stability table: `px-2 py-1` (ne py-1.5), NO sortable, NO sticky, NO hover
- Loss Function sekcija: `l-t` (bez pt-3), sve ostale `l-t pt-3`

### Value colors — gde agenti UVEK greše:
TASK-EXPERIMENTS.md ima per-column value color spec za SVAKU tabelu. Coder MORA da pročita i implementira svaku posebno:
- Entry Tags: blue badges (`bg-blue-500/12 text-blue-400`)
- Exit Reasons: first column `text-white` (NE badge)
- FreqAI Matrix: PCA "On"=`text-up`, "Off"=`text-muted`; Noise isto
- Compare Runs Δ Best: Trades `+14` NEMA color class (ostali imaju)
- Analysis overlay Exit column: `text-white/25` (dimmer od body)
- AllTests overlay: Name=`text-white/80`, Date=`text-white/40`

### Custom CSS klase (moraju biti u globals.css):
`builder-toggle`, `builder-pill`, `builder-input`, `builder-select`, `builder-label`, `builder-card`, `section-title`, `kpi-label`, `kpi-value`, `l-bd`, `l-b`, `l-t`, `l-grid`, `sortable`, `filterable`, `exp-tab`, `exp-nav`, `bt-tab-btn`, `ho-tab-btn`, `bt-tab-content`, `ho-tab-content`, `exp-overlay-panel`, `exp-overlay-title`

### 26 title atributa + 31 form defaults:
SVE su u TASK-EXPERIMENTS.md sekcijama "Button Title Attributes" i "Form Default Values". Frontend Coder MORA da ih uključi.

## Code Reviewer — na šta posebno da gleda:

1. **Completeness** — prebrojati ~100+ widgets iz verification checklist-a
2. **Pixel perfect** — CSS klase moraju TAČNO odgovarati spec-u
3. **Value colors** — svaka tabela ima specifične boje po koloni
4. **Title attributes** — 26 komada, lista u spec-u
5. **Form defaults** — 31 komad, lista u spec-u
6. **Sticky header inconsistency** — Closed Trades DA, Per-Pair/Entry/Exit/History NE

## Na kraju kad sve prođe:

Reportuj:
- Koliko fajlova rewritten
- Koliko widgets implemented
- Build/Lint/TypeScript status
- Git napomenu o bracket issue
