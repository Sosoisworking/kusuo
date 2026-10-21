# Decision — the training module is rebuilt on openGym's feature set

**Date:** 20 October 2026
**Status:** Stopped after S1b on 20 October 2026. Development is finished — see
`2026-10-20-development-finished.md`. S0, S1a and S1b shipped; nothing after them was built, and
none of the rules in the table below was ended.

## What was decided

Kusuo keeps its habit features exactly as they are — habits, goals, reflections, streaks — and
replaces its training module with a rebuild of the feature set of openGym
(`github.com/DuarteSantos8/openGym`, forked as `Sosoisworking/openGym`): weekday or rotation
plans; supersets, warm-ups, drop sets, rest-pause, pyramids, back-off, timed holds, cardio and
per-side reps; progression rules with deloads; plate math; 1RM curves, a heatmap, a muscle map
and structural balance; history editing; importers. After that, a backend for passkey accounts,
encrypted sync, reminders and nudges, and an AI coach.

## How

- **Rebuilt, not copied.** openGym is AGPL-3.0. Its features are re-implemented in Kusuo's own
  TypeScript, using it as a reference; no openGym code, copy, or curated table (import aliases,
  the Hevy id map, nudge lines, effort lines, descriptions) is taken. Kusuo keeps its own licence.
- **Exercise text** comes from the MIT-licensed ExerciseDB set, taken from its upstream
  (`hasaneyldrm/exercises-dataset`), credited, after its provenance is checked — not from
  openGym's catalogue, whose copies carry openGym's AGPL corrections.
- **No exercise animations.** openGym's are licensed from Gym visual for use inside openGym only.
- **Local first.** openGym's core training needs no server, so the whole training rebuild ships
  before any backend exists. Each slice ships to the phone working.

## Which of Kusuo's rules this ends, and when

Each gets its own record in the slice that ends it; PRODUCT.md, SPEC.md and the README change
then, not before.

| Rule | Ends in | Becomes |
|---|---|---|
| "A split is a weekly schedule" | S3 | weekly plan or rotation |
| "No green, no red" | S4 | a scoped exception for effort colours only |
| "No backend, no accounts" | S8 | passkey accounts on a self-hosted server |
| "No notifications" | S10 | web-push reminders and nudges, opt-in |
| "No AI" | S11 | an AI coach (Claude), opt-in, with consent |

**Unchanged:** "nothing runs a clock" — there is no rest timer. The habit ↔ training contract —
finishing a session ticks the training habit, un-finishing never un-ticks it.

## Where Kusuo will live

Kusuo shares `sosoisworking.github.io` with Tadabbur, so any page there can read Kusuo's storage.
Harmless while Kusuo is local-only; not once it holds passkeys and encryption keys. Before the
backend (S8) it moves to its own domain, app and server on one origin.

## Reference

The full plan — data model, slices, sync rules, privacy, verification — was approved on 19
October 2026 and is summarised in `docs/SLICE-PLAN.md` under "Phase 3".
