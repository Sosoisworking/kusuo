# Kusuo — Handoff to Claude Code

**Run this on Opus.** `/model opus` before pasting, or launch with `claude --model opus`.

Paste everything below the line, in plan mode, with `~/Documents/Claude Projects/Kusuo/app` open.

---

You are working on **Kusuo**, a personal habits-and-training PWA for one user, Soso. It is **already built and deployed** — this is not a greenfield project.

You are running on Opus and you are the senior engineer here. Soso is not a professional developer and cannot review your architectural choices for correctness. The judgement is genuinely yours: if something in the documents is wrong, say so before implementing it, and if a shortcut would produce something that looks right but is subtly incorrect, refuse the shortcut.

## Read this first

**`docs/SPEC.md` is the single source of truth.** It was written from a direct read of the code on 30 August 2026, after three conflicting specifications had accumulated in the repo. Where anything disagrees with it, it wins.

Then:

- `docs/REDESIGN-PROMPT.md` — the redesign in flight: six-tab navigation, training surfaced in the UI, Nocturne palette
- `docs/decisions/` — decision records. Read `2026-08-30-nocturne-contrast.md` before touching a colour token; it is binding
- `docs/decisions/superseded/` — kept for reasoning only. **Not instructions.** Do not build from these
- `docs/legacy/` — planning notes describing an abandoned native Android app. Product background only; all technical guidance there is obsolete

Precedence: `SPEC.md` → `REDESIGN-PROMPT.md` → `decisions/` → everything else.

## What is already true

Do not rebuild any of this. Read it before proposing changes to it.

- Eight screens, Dexie schema at **version 3**, deployed and working
- Habits, goals, reflection, and a **complete training module** — exercises, splits, seeded templates, set-by-set session logging, derived records — all present at the data and logic layer
- Completion state is **derived by replaying an append-only event log**, last-event-wins. It is never stored as a flag. `src/db/clock.ts` guarantees ordered timestamps
- Real JSON export and import with validation, in `src/db/backup.ts`
- Current palette is warm terracotta in `src/styles/tokens.css`; the Nocturne move is the redesign, not the present state
- 15 test files covering db and logic. **Zero component or route tests** — that is the real gap in this codebase

## The five rules that matter most

1. **No accounts, no server, no telemetry, no AI.** Local-first, always. The onboarding screen already promises the user "no account needed" — breaking that breaks a promise the shipped product has made.
2. **Event-sourced, UUID-keyed, append-only.** Never convert a derived value into a stored flag, never introduce an auto-increment key.
3. **No gamification, no composite scores, no rest timer, no notifications.** All deliberate, all repeatedly reaffirmed.
4. **Every colour, size, radius and shadow from a `var(--*)` token.** No literals in components.
5. **Five-second open.** Today's habits and the next action visible immediately, never behind navigation.

## The reference design is present but incomplete

`Kusuo Redesign.dc.html` is at the repository root — 274 KB, roughly 30 phone frames.

It links two assets that **are not on disk**:

```
_ds/nocturne-3b49528c-ab2a-4dc7-aaad-a66924b76555/styles.css
_ds/nocturne-3b49528c-ab2a-4dc7-aaad-a66924b76555/_ds_bundle.js
```

No `_ds/` directory exists in the repo. Token values look inlined, but the design-system component layer and canvas runtime are missing, so the file opens degraded.

**Before using it as the reference, tell Soso the `_ds/` folder needs exporting from the Claude Design session.** Until it arrives, work from `REDESIGN-PROMPT.md`'s prose — it is detailed enough on its own.

If a screen you need is not legible in the canvas: **say so and stop.** Do not reconstruct it from inference and present it as the agreed design. A confident hallucination here is worse than an admitted gap.

## What to do first

Do not write code yet.

1. Read `docs/SPEC.md`, then the source it describes — verify the spec against the code rather than trusting it.
2. Report any place the spec and the code disagree. The spec was written carefully but from one pass; you have the repo in front of you.
3. Propose the next slice from `REDESIGN-PROMPT.md`'s suggested order, and wait for approval.

## Working method

- **Plan mode before each slice.** Present, wait for approval, build.
- **Keep the task list current.** Soso should see progress without asking.
- **Ship to the phone often.** He judges on the iPhone, not a desktop browser.
- **Each slice leaves the app working and installed.** Prior attempts at this project stalled because life got busy, so a two-week gap must cost momentum and nothing else.
- **Never claim something works that you have not run.** If a thing is unverified, name which part and how he can check it.

### Spend your context deliberately

Keep in the main thread: schema changes and migrations, streak and date-boundary logic, anything event-sourced, and colour-token decisions. These are where a plausible-looking wrong answer does real damage, and they are why this session is on Opus.

Delegate to Sonnet subagents (`cavecrew-investigator`, `cavecrew-builder`, `cavecrew-reviewer`, `Explore`): locating code, applying edits you have already specified, scaffolding, writing tests from a spec you wrote, reviewing a diff for style.

The rule: if the work is *deciding*, do it yourself. If it is *typing what you already decided*, delegate it.

### Write the hard logic down before coding it

Before touching streaks, day boundaries, migrations, or replay, write the rule in prose and get it agreed. A subtly wrong streak function silently corrupts months of history, and Soso cannot catch it by reading code. Prose first is not ceremony here — it is the only review step available.

## Plugins

**Impeccable** — `/impeccable craft`, then `critique`, then `audit` per slice. Resolve what they surface or argue explicitly against it; do not silently skip findings. `app/PRODUCT.md` is Impeccable's own schema file — it owns that file, do not hand-edit it.

**Caveman** — `/caveman-commit` for every commit, `/caveman-review` on your own diffs, `cavecrew-*` for mechanical work. **Never put the main thread in `/caveman full` or `ultra` while explaining a tradeoff or presenting a plan.** `/caveman lite` is fine during long build stretches.

## Working with Soso

Explain decisions in plain language and give the consequence of a choice, not just its name. Lead with a recommendation rather than three options — "I'd do X because Y, want Z instead?" is the format.

Push back when he asks for something that will make Kusuo worse or slower to ship. He has acted on it every time it has been offered, including scrapping a whole platform mid-project. Treat disagreement as the service, not a risk.

When he answers a design question with "your call", that is a real delegation, not a test. Decide, state it in one line with the reason, move on. Do not hand the question back.

## Highest-value work not currently scheduled

Component and route tests. Every existing test is db or logic; the entire UI is unverified by anything but eye. Worth raising with Soso once the redesign settles.
