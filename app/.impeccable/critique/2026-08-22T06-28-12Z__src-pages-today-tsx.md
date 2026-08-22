---
target: src/pages/Today.tsx
total_score: 31
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
timestamp: 2026-08-22T06-28-12Z
slug: src-pages-today-tsx
---
# Critique: src/pages/Today.tsx (slice 4 — Today core loop)

Method: dual-agent (Assessment A — design review; Assessment B — detector + code-evidence verification)

## Heuristics (Nielsen's 10, /4 each; #10 n/a — no help system expected for a trivial single-user local screen)

| # | Heuristic | Score |
|---|---|---|
| 1 | Visibility of system status | 3/4 |
| 2 | Match between system and real world | 4/4 |
| 3 | User control and freedom | 4/4 |
| 4 | Consistency and standards | 3/4 |
| 5 | Error prevention | 4/4 |
| 6 | Recognition rather than recall | 4/4 |
| 7 | Flexibility and efficiency of use | 4/4 |
| 8 | Aesthetic and minimalist design | 4/4 |
| 9 | Help recognize/diagnose/recover from errors | 1/4 |
| 10 | Help and documentation | n/a |

**Total: 31/36**

Detector: `detect.mjs --json src/pages/Today.tsx` → `[]`, clean, confirmed non-degraded (`.tsx` routes to the regex engine, unaffected by the missing HTML-engine modules).

## Design-specificity verdict
Reads as Kusuo-specific, not generic-habit-app boilerplate: streak text vanishes entirely at 0 rather than showing a loss/failure count, no flame/emoji/percentage-ring iconography, "complete" state uses a separate muted moss green distinct from the accent, reader-mode copy names the actual device model. Slips toward generic/placeholder only in the empty-state copy (see P1).

## Priority Issues

**P0 — none.**

**P1**
- Empty-state copy for writers ("No habits yet. Add one to get started.") points at an add-habit affordance that doesn't exist yet anywhere in the app (`App.tsx` only routes `/` and `/onboarding`) — a real dead end the first time habits hit zero outside onboarding.
- `toggle()` has no error handling around the write. A failed `appendHabitEvent` (plausible given the product's own acknowledged iOS storage-eviction risk) silently no-ops with zero feedback — a failed tap looks identical to a successful one still resolving, which undermines the "calm and immediate" core loop precisely for a half-awake user.

**P2**
- `today` is a module-level `const` computed once at import time (`Today.tsx:11`), not re-derived. If the tab/PWA stays open across local midnight, new completions keep writing against the stale prior date and streak/day-count math silently misaligns with the real calendar day until a full reload.
- No pressed/active visual state on the toggle button — feedback depends entirely on the write+refetch round-trip resolving.
- Reader and writer rows are visually identical apart from div-vs-button cursor behavior; the only static "view-only" cue is the header caption, no per-row treatment.

**P3 / Minor**
- "3 day streak" reads better hyphenated ("3-day streak").
- No loading skeleton during initial load (`if (loading) return null`) — imperceptible on local IndexedDB today, worth revisiting if load ever slows (e.g. post-eviction rehydration).
- `completedDatesForHabit` is computed twice per habit per render (once for `doneCount`, once in the row map) — redundant O(events) scans, not a correctness issue at this data scale.

## Persona red flags (Soso, half-awake, checking the phone)
Primary loop (open → see habits → tap → turns green) is low-friction and matches the five-second-open principle; nothing gamified or shame-inducing is visible. The two real risks are exactly the P1s: a silent failed tap, and an empty state that dead-ends with nowhere to go.

## Positive findings
- Read-only Mac path renders a structurally distinct, non-interactive `<div>` (not a disabled button) — avoids the "greyed-out but tempting" antipattern, and a redundant guard exists in `toggle()` itself.
- All colors/radii route through CSS custom properties; no hard-coded values.
- Native `<button>` with `aria-pressed` + `focus-visible` outline on the interactive row — keyboard accessible for free.
- `today`/derive/streak function signatures all verified correct against their actual implementations (no data-logic bugs).
