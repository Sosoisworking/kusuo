---
target: src/pages/HabitForm.tsx
total_score: 25
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
timestamp: 2026-08-23T21-43-43Z
slug: src-pages-habitform-tsx
---
# Critique: src/pages/HabitForm.tsx (slice 5 — Add/Edit/Archive habit)

Method: dual-agent (Assessment A — design review; Assessment B — detector + code-evidence verification)

Detector: clean (`[]`) on HabitForm.tsx, Today.tsx, App.tsx.

## Heuristics (Nielsen's 10, /4 each; #10 n/a)

| # | Heuristic | Score |
|---|---|---|
| 1 | Visibility of system status | 2/4 |
| 2 | Match between system and real world | 4/4 |
| 3 | User control and freedom | 3/4 |
| 4 | Consistency and standards | 3/4 |
| 5 | Error prevention | 3/4 |
| 6 | Recognition rather than recall | 2/4 |
| 7 | Flexibility and efficiency of use | 3/4 |
| 8 | Aesthetic and minimalist design | 4/4 |
| 9 | Help recognize/diagnose/recover from errors | 1/4 |
| 10 | Help and documentation | n/a |

**Total: 25/36**

## P1 — Major
1. **No error handling on save/archive.** `save()`/`confirmArchive()` have no try/catch (Today.tsx's `toggle()` does). A write failure leaves `saving` stuck true forever — Save button permanently disabled, zero feedback.
2. **Archive-confirm and Edit headings never name the habit.** "Archive this habit?" / "Edit habit" — no on-screen confirmation of which habit.

## P2 — Minor
3. Blank loading state (`return null`) — no skeleton, unlike Today.tsx.
4. "Saving…" state looks identical to the disabled/invalid state.
5. Archive link sets `underline-offset-2` but never `underline` — reads as static text, not tappable.
6. `PrimaryButton`/`SecondaryButton` duplicated verbatim in HabitForm.tsx and Onboarding.tsx.
7. `PrimaryButton`/`SecondaryButton` have no `focus-visible` ring — every other interactive element in both files does.
8. Create/edit heading has no supporting subhead paragraph, unlike every other step (including this file's own archive-confirm state).

## P3 — Polish
9. No max-length guard on habit name.
10. `aria-live` missing on the frequency stepper's numeric value.
11. Frequency-input pattern (free 1–7 stepper) diverges from Onboarding's fixed Daily/"3×/week" toggle for the same concept — flagging as a judgment call, not necessarily a defect.

## Explicitly not a defect
- No "unsaved changes" confirm on Cancel — correctly omitted; adding one would work against the calm-over-stimulating principle.
- Writer-only guard verified race-free (redirect resolves before form ever renders for a reader).
- Touch targets, ARIA labels, label associations, theming tokens all verified correct.
