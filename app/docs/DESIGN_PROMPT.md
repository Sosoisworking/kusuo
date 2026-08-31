# Kusuo — Master Design & Build Prompt (for Claude Code, on Opus)

> ## ⚠️ PARTIALLY SUPERSEDED — read this first
>
> This file was written before the design interview and before Kusuo became a **two-person app**. It is still the authority on working method, quality bar, iOS PWA constraints, deployment, and plugin usage.
>
> It is **no longer the authority on product or data architecture**. Where this file and `PRODUCT.md` / `DESIGN.md` / `PLAN.md` disagree, **those three win**.
>
> Specifically superseded:
>
> - **§2A** — the "iPhone writes, Mac reads, no backend, no accounts" model. Kusuo now has a second human user and a Supabase layer for near-live partner view. Your own data is still local-first in IndexedDB; only explicitly shared habits reach a server. See `PLAN.md`.
> - **§3** — the interview. It has been run. The answers are in `PRODUCT.md`. Do not re-run it.
> - **§12** — "no backend, no account" is now wrong for the sharing layer. Everything else in that section stands, especially: no AI, no notifications in v1, no composite scores ever.
>
> Everything else in this file is current.

## How to use this file — setup steps for Soso

Folder structure is already built. The repo root is `~/Documents/Claude Projects/Kusuo/app`, this file lives at `docs/DESIGN_PROMPT.md`, and the legacy planning docs are in `docs/legacy/`. The GitHub repo exists at `https://github.com/Sosoisworking/kusuo` but has nothing pushed to it yet.

Everything in this section is for you to run yourself, in Terminal. It is not part of the prompt you paste.

### Step 1 — connect the folder to GitHub

Open Terminal and paste this whole block:

```bash
cd ~/Documents/Claude\ Projects/Kusuo/app

git init
git branch -M main
git add .
git commit -m "docs: add design brief and legacy planning docs"
git remote add origin https://github.com/Sosoisworking/kusuo.git
git push -u origin main
```

If GitHub asks for a password it will reject your account password — it wants a personal access token. The simplest fix is the GitHub CLI:

```bash
brew install gh
gh auth login
```

Choose HTTPS, authenticate in the browser, then run `git push -u origin main` again.

### Step 2 — turn on GitHub Pages

In the repo on github.com: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

Nothing deploys yet, but leaving this on the default causes a confusing failure later when the deploy workflow is added.

### Step 3 — verify

Refresh `https://github.com/Sosoisworking/kusuo`. You should see `README.md` and a `docs/` folder. If you don't, the push didn't land — fix that before continuing.

### Step 4 — start Claude Code

```bash
cd ~/Documents/Claude\ Projects/Kusuo/app
claude
```

Press **Shift+Tab twice**. Plan mode is indicated at the bottom of the terminal. Then paste everything below the line.

Plan mode matters: it stops the agent from writing files until you have approved a plan. Do not skip it.

### What to expect

Claude reads the docs, tells you what it understands Kusuo to be, and asks the first batch of interview questions. Have two or three **anti-references** ready — apps whose look you dislike. That is the single most useful answer you can give, and the hardest to produce on the spot.

---

---

## ROLE

You are the lead product designer *and* front-end engineer for **Kusuo**, a personal-growth app built for one user: **Soso** (iPhone, macOS, GitHub-hosted).

You own product thinking, visual design, information architecture, code, accessibility, and deployment. You are not a code generator taking dictation — you are expected to have opinions, defend them briefly, and say when I'm asking for something that will make the app worse.

Two plugins are installed and you are expected to use them. Details in §7 and §8.

---

## 1. READ BEFORE YOU DO ANYTHING

Read every file in `docs/legacy/` in full. They are the product brief for this app, written across earlier planning sessions. Specifically:

- `PROJECT_CONTEXT.md` — what Kusuo is and the personal-growth system behind it
- `IMPLEMENTATION_SPEC.md` — capability map, data model, UX rules, definition of done
- `ROADMAP.md` — phase ordering
- `BACKLOG.md` — P0→P3 priorities and product experiments
- `DECISIONS.md` — architecture decisions and data-safety rules
- `HISTORICAL_NOTES.md` — the confirmed history

**Important context correction.** Those documents describe Kusuo as a native **Android/Kotlin + Room** app with package `com.soso.kusuo`. That direction is retired. Soso now uses an **iPhone**, and there is **no source code to preserve** — you are starting from an empty repository. Treat the legacy docs as *product and data-model specification*, not as technical instructions. Where they say "Room", read "local database". Where they say "Activity", read "screen". Ignore all Gradle, Kotlin, AndroidManifest, and APK guidance.

Your first output is **not** code and **not** a file. It is the question round in §3.

---

## 2. THE PLATFORM DECISION (already made — confirm or challenge it)

Kusuo will be an **installable Progressive Web App (PWA)** hosted on **GitHub Pages**, added to the iPhone home screen where it launches full-screen with its own icon and no Safari chrome.

Why this and not native iOS:

- Native iOS means Xcode, Swift, a $99/yr Apple Developer account, and App Store review for every change. For a personal app used by one person, that cost buys nothing.
- GitHub Pages is free, HTTPS by default, and deploys on every push — which is exactly the "host it on GitHub and add it to my home page" workflow requested.
- The Impeccable design plugin is built for web UI. On a native Swift codebase most of its value is unavailable.
- A PWA runs on the iPhone, the Mac, and any browser, from one codebase.

**Recommended stack** (propose changes if you have a strong reason, but justify them):

| Layer | Choice | Why |
|---|---|---|
| Framework | React 19 + TypeScript | Best-supported target for design tooling and your own future edits |
| Build | Vite | Fast, first-class PWA plugin, trivial GitHub Pages config |
| Styling | Tailwind CSS v4 + CSS custom properties as design tokens | Tokens are the contract Impeccable audits against |
| Local data | IndexedDB via Dexie | Structured, indexable, async — the honest web equivalent of Room |
| State | TanStack Query or Zustand (pick one, not both) | Keep it small |
| Charts | Recharts or hand-rolled SVG | No heavyweight chart library for a habit app |
| PWA shell | `vite-plugin-pwa` (Workbox) | Service worker, manifest, offline caching |
| Routing | React Router | Standard |
| Tests | Vitest + React Testing Library + Playwright for the critical flow | See §11 |
| Deploy | GitHub Actions → GitHub Pages | See §10 |

Do **not** add: a backend, an auth system, analytics/telemetry SDKs, a component library that fights the design system (no Material UI, no Chakra), or any AI/LLM dependency. §12 covers the AI question.

---

## 2A. DATA OWNERSHIP, DURABILITY, AND CROSS-DEVICE ACCESS — READ BEFORE DESIGNING THE SCHEMA

This section is a hard requirement, not a preference. It shapes the data model, so it must be settled before any table is defined.

### The requirement

All user-entered data — habits, completions, mood, energy, reflections, goals, notes — is stored **locally on the user's own device**, in IndexedDB, with no server, no account, and no network dependency. The app must be fully functional in airplane mode.

**In addition, Soso must be able to access that same data on their Mac, not only on the iPhone.** Design for two devices from day one.

### One writer, one reader — this is decided, do not design around it

**The iPhone is the only device where data is ever entered. The Mac is read-only.**

Everything is logged on the phone. The Mac exists to *look* at the data — weekly review, monthly review, charts, reading back reflections on a bigger screen. It never creates, edits, completes, or deletes anything.

This single constraint removes the hardest problem in the app. With exactly one writer there is no divergence, so there is **no merge and no conflict resolution to write anywhere in this codebase**. Sync is one-directional: phone pushes, Mac pulls.

**The risk this creates, which you must design against.** If the Mac can write even by accident, the next push from the phone silently overwrites it. The user loses data with no error message and no way to tell it happened. Discipline is not a control. So:

- The app detects or is told which device it is on, and the Mac runs in an explicit **read-only mode**: no completion buttons, no add/edit/delete affordances, no reflection form. Not disabled-looking controls that fail on tap — the actions are simply absent.
- A quiet, permanent banner or badge on the Mac reads something like "Viewing only — log on your phone." The user should never have to remember which device is authoritative.
- Store the device role explicitly (a setting chosen on first run per device, plus the `deviceId`), so this survives a reinstall and is not guessed from screen width.
- Ask me before adding any escape hatch that lets the Mac write. If it ever needs to, that is a real design change, not a toggle.

### Design the data model as an append-only event log

Because there is only one writer, this is no longer load-bearing for correctness — but do it anyway. It is cheap now, expensive to retrofit, and it buys honest history: un-completing a habit becomes a recorded fact rather than an erased one, which the analytics in `IMPLEMENTATION_SPEC.md` depend on to be truthful. It also leaves the door open if the Mac ever becomes a writer.

Do not model completions as mutable rows that get flipped true/false. Model them as an **append-only log of events**:

```ts
// Conceptual shape — refine it, but keep the append-only property.
interface HabitEvent {
  id: string;          // UUID generated on the device — never an auto-increment integer
  habitId: string;     // also UUID
  localDate: string;   // "2026-08-17" — the user's calendar day, not a UTC instant
  action: 'complete' | 'uncomplete';
  timestamp: number;   // epoch ms, for ordering within a day
  deviceId: string;    // which device wrote this
}
```

Current state is **derived** by replaying the log, not stored directly. Cache the derived state for speed if you must, but the log is the truth.

Why this shape:

- Un-completing a habit is a recorded fact, not an erased one, so streaks and completion-rate analytics can be honest about what actually happened rather than about the last state anyone left behind.
- Retrofitting an append-only log onto a mutable schema later means migrating real user history with no safety net. Doing it on day one costs almost nothing.
- **Use UUIDs, never auto-increment integers.** Two devices independently assigning `id: 5` to different records is exactly the trap that makes a future two-way sync impossible. UUIDs cost nothing today.
- If the Mac ever does become a writer, merging two logs is a set union — every event from both, deduped by `id`, replayed. Nothing else in the app would need to change.

Apply the same treatment to reflections and any other user-entered record. Habits and goals themselves are edited in place rather than logged, but still need UUIDs and an `updatedAt` timestamp.

### Cross-device access — phased

**Phase 1 (v1, ships immediately): manual export from phone, import on Mac.**

- One tap on the phone exports the entire database as a single JSON file, with a schema version field.
- The file goes to Files / iCloud Drive / email; on the Mac it is opened from the same place and imported.
- **Import on the Mac replaces the local database wholesale.** No merge — the Mac holds nothing unique, so replace is both correct and far simpler. Confirm before replacing, and state plainly what is about to happen.
- The importer must still validate: check the schema version, reject a malformed or truncated file, and refuse rather than half-import. A partial import that leaves the Mac showing wrong numbers is worse than a clear failure.
- Guard the reverse direction: importing a Mac-originated file back onto the phone should be blocked, or at minimum require a loud explicit confirmation. That is the path that destroys real data.
- This same export doubles as the **backup** mechanism, which is required regardless — see §9 on iOS storage eviction.

**Phase 2 (v1.5): one-directional sync through a private GitHub repository.**

- The phone writes a single JSON snapshot file to a **private** GitHub repo via the GitHub REST API, using a fine-grained personal access token scoped to that one repo with contents read/write.
- The Mac only ever **reads** that file. Give the Mac a read-only token if the API allows the split, so a bug cannot write from the wrong device.
- Phone: manual "Sync now" button first, then automatic on launch and on backgrounding once proven. Mac: pull on open.
- No server to run, no monthly cost, data lives in the user's own account, and git gives version history and rollback for free — which is a real safety net for a wholesale-replace model.
- The token is stored in IndexedDB on the device. Be explicit with me about that tradeoff, never commit it, never put it in the built bundle, and provide a clear way to revoke and replace it.
- **The token must not go into the public Pages repo.** The app source is public; the data repo is private and separate.

**Explicitly rejected approaches — do not propose these:**

- Writing directly to iCloud Drive from the PWA. The File System Access API is not available in iOS Safari; there is no shared file handle between iPhone Safari and a Mac browser.
- Firebase / Supabase / any hosted backend for v1. It works, but it requires an account and auth, and it breaks the local-first rule in `DECISIONS.md`. Only revisit if Phase 2 proves unworkable, and only after asking.
- `localStorage` as the primary store. It is synchronous, string-only, and small. IndexedDB is the correct tool.

### Durability rules

- Call `navigator.storage.persist()` on first run to request protection from automatic eviction. Treat the result as a request that may be denied, never as a guarantee, and never as a substitute for export.
- Surface "last backup: N days ago" somewhere quiet but visible, and nudge when it goes stale.
- Every schema change ships with a Dexie migration and a test that loads a fixture exported from the previous version. Per `DECISIONS.md`: never wipe user data to make a schema change convenient.

---

## 3. ASK ME QUESTIONS FIRST — FULL DESIGN INTERVIEW

Before you plan, design, or write a single line, run a structured interview. Rules for how you ask:

- Use `AskUserQuestion` where available so I can click answers; otherwise number them plainly.
- **Batch them — 3 or 4 at a time, grouped by theme.** Do not fire twenty questions in one wall of text.
- For every question, offer a **recommended default** and say why. I should be able to answer "your call" and still get a good product.
- If an answer contradicts something in the legacy docs or something I said earlier, flag the contradiction rather than silently picking one.
- Show me visual or textual examples where words are ambiguous — "calm" means nothing until you show me two calms.

Cover these areas:

**A. Product scope**
- Which of the legacy features make **v1**? My instinct: habits + today view + streaks + basic progress. Goals, reflection, and reviews are v2 unless you argue otherwise.
- Which of the specific real habits from the docs — reading, Japanese, Quran, fitness, sleep, mood, energy — should ship as first-run templates rather than making me type them in?
- What is the single most important thing the app must do in under five seconds of opening it?
- Cross-device is already decided (§2A) and needs no further questions: local-first, **entry on the iPhone only, Mac read-only for review**. What I do want your opinion on is which screens are worth building a Mac-specific layout for — is it just the weekly/monthly review and the charts, or more?

**B. Feel and voice**
- Three adjectives for how the app should feel when opened at 6am. And three for how it should *not* feel.
- **Anti-references**: name apps whose look I dislike. This is more useful than references.
- References: apps whose interfaces I admire, and specifically *what* about each.
- Voice: does the app address me by name? Is it encouraging, neutral, or dry? What does it say when I miss a day — and what must it never say?

**C. Visual direction**
- Dark-first, light-first, or system-following?
- Colour: one accent or a palette per life-area? Any colour I actively dislike?
- Typography: system fonts (fast, native-feeling) or a chosen typeface (distinct, costs a download)?
- Density: airy and one-thing-at-a-time, or dense and information-rich?
- Data display: do I want the calendar heatmap, the streak number, the ring, the bar chart — or is that the wrong emphasis entirely?
- Motion: how much? Where does it earn its place?

**D. Daily reality**
- When and where do I actually use this — morning, evening, both? One-handed on a phone in bed?
- What killed my previous habit-tracking attempts (Notion included)? Design against that specific failure.
- Do I want notifications? (Read §9 first — the iOS answer is more constrained than you'd expect.)
- What does a *bad week* look like, and how should the app respond to it? Most habit apps punish; decide deliberately what Kusuo does.

**E. Practical**
- App name shown under the home-screen icon — "Kusuo", or something shorter?
- Icon direction: a letter mark, a symbol, or something else? It sits on my home screen next to real apps, so it should not look like a placeholder.
- How much time do I have this week? Scope to that, not to the roadmap.

After the interview, **summarise my answers back to me in a short brief and ask me to correct it** before you proceed. Misheard requirements are cheapest to fix here.

---

## 4. THEN: CAPTURE THE BRIEF WITH IMPECCABLE

Once I've confirmed the brief, run:

```
/impeccable init
```

This writes `PRODUCT.md` and offers `DESIGN.md` — audience, brand lane, voice, anti-references, colour, type, components. Fill them from my interview answers, **not** from your own defaults. These two files become the contract every later command checks against, so a lazy `init` poisons everything downstream. Show me both files and let me edit them.

Then:

```
/impeccable shape <the v1 app>
```

to plan the UX/UI before any code exists.

---

## 5. THEN: PLAN, IN PLAN MODE, WITH A TASK LIST

Still writing no product code, produce a plan for my approval containing:

1. **Screen inventory** — every screen, its job, its states (empty / loading / error / populated / offline), and how I get to it. Mark which screens exist on the Mac read-only build and what they lose there (per §2A).
2. **Navigation model** — tab bar, stack, or single scroll. Decide, don't hedge. Justify against one-handed phone use.
3. **Design tokens** — colour ramps (light + dark), type scale, spacing scale, radii, shadows, motion durations and easings, as CSS custom properties. This file lands before any component.
4. **Data model** — port the legacy schema (`Habit`, `HabitCompletion`, `Goal`, `GoalHabitCrossRef`, `DailyReflection`) to Dexie tables with a **versioned migration path from v1**, applying the append-only-log and UUID rules in §2A. Read the persistence rules in `DECISIONS.md` and `IMPLEMENTATION_SPEC.md` and honour them: never destructively wipe data to make a schema change convenient. Include the export/import merge logic in this plan — it is v1 scope, not a later add-on.
5. **The hard logic, specified in prose before it's code** — streaks across missed days and timezone boundaries, un-completing a habit, frequency rules ("4x/week" is not "every day"), what "today" means at 1am, what happens to history when a habit is archived or its frequency changes. The legacy `CLAUDE_CODE_MASTER_PROMPT.md` lists these edge cases; they are the part every habit app gets wrong.
6. **Build order** — vertical slices that are each independently shippable and visible on my phone. Not "all the data layer, then all the UI".
7. **What v1 deliberately excludes**, and why.

Use the task list (`TodoWrite` / task tools) to track this and keep it updated as you go — I want to see progress without asking.

Use subagents for parallel research and for verification, not for the design work itself. Design decisions stay in the main thread where I can see and interrupt them.

**Wait for my approval. Then exit plan mode and build.**

---

## 6. BUILD LOOP

Per vertical slice:

1. `/impeccable craft <slice>` — shape-then-build with visual iteration.
2. Build it against the tokens. No hard-coded hex values, no magic spacing numbers, no inline one-off styles that bypass the system.
3. `/impeccable critique <slice>` — hierarchy, clarity, emotional resonance.
4. `/impeccable audit <slice>` — accessibility, performance, responsive behaviour. Impeccable ships ~59 deterministic detector rules and installs a Claude Code hook that runs them automatically on UI file edits; **do not ignore what the hook surfaces**.
5. Fix what those two surface. Re-run.
6. Show me the result — a screenshot, or better, a deployed preview I can open on my phone. **I judge on the phone, not in a desktop browser.**
7. Commit with `/caveman-commit`.

Specialist passes, used with judgement rather than sprayed at everything:

- `/impeccable onboard` — first-run and empty states. **This app has no data on day one; the empty state *is* the first impression.** Do not defer it.
- `/impeccable typeset`, `/impeccable layout`, `/impeccable colorize` — targeted fixes when type, rhythm, or colour is the specific problem.
- `/impeccable animate`, `/impeccable delight` — only after the app is correct and calm. Motion on a broken layout is lipstick.
- `/impeccable clarify` — every string in the app. Habit-app copy is where warmth or nagging lives.
- `/impeccable harden` — error handling, text overflow, long habit names, 50-item lists, edge cases.
- `/impeccable adapt` — iPhone first, then Mac/desktop widths.
- `/impeccable distill` / `quieter` / `bolder` — dial adjustments when I say "too much" or "too flat".
- `/impeccable polish` then `/impeccable optimize` — before each deploy to Pages.
- `/impeccable live` — when I want to see variants of one element side by side in the browser.
- `/impeccable extract` — once patterns repeat, pull them into the shared design system.
- `/impeccable document` — keep `DESIGN.md` true to the code as it evolves.

Pin the ones we use constantly (`/impeccable pin audit`, `/impeccable pin critique`) so they're one word.

---

## 7. IMPECCABLE — RULES OF ENGAGEMENT

Impeccable exists because AI-generated design has recognisable tells: overused fonts, gray text on coloured backgrounds, cards nested in cards, purple-blue gradients everywhere, 2019-era animation. Its detectors catch those.

- Run `init` **before** designing, not after.
- Treat `critique` and `audit` output as findings to resolve, not suggestions to acknowledge. If you disagree with a finding, say so explicitly and explain — don't silently skip it.
- Never let a slice reach me without at least one `audit` pass.
- `DESIGN.md` is the source of truth for visual decisions. When it and the code disagree, one of them is a bug — resolve it, don't route around it.

---

## 8. CAVEMAN — RULES OF ENGAGEMENT

Caveman compresses output to save tokens. Used wrongly on a *design* project it destroys the thing I need most: your reasoning about tradeoffs. So:

**Use it here:**
- `/caveman-commit` — every commit. Terse Conventional Commits are strictly better than verbose ones.
- `/caveman-review` — reviewing your own diffs before I see them. One line per finding: location, problem, fix.
- `cavecrew-investigator` / `cavecrew-builder` / `cavecrew-reviewer` subagents — for mechanical work (find where X lives, apply a known 1–2 file edit, review a diff). Their compressed output keeps the main context alive across a long session.
- `/caveman-compress docs/legacy/*.md` — the legacy docs are verbose and re-read constantly. Compressing them cuts input tokens on every turn. Originals are backed up as `FILE.original.md`; **keep those backups and don't commit the compressed versions over them destructively.**
- `/caveman-stats` — when I ask what this is costing.

**Do not use it here:**
- Never put the main thread in `/caveman full` or `ultra` while we are making design decisions or when you're explaining a tradeoff to me. I need full sentences to make a judgement call.
- `/caveman lite` is acceptable during long mechanical build stretches. Turn it `off` before any design discussion, plan presentation, or interview round.
- Be honest that the skill adds ~1–1.5k input tokens per turn and can be net-negative on already-terse work. Don't perform savings.

---

## 9. iOS PWA REALITY — DESIGN AROUND THESE, DON'T DISCOVER THEM LATER

I am on an iPhone. Verify current behaviour rather than trusting any single source, but design defensively for all of it:

- **Installation is manual.** Safari → Share → Add to Home Screen. There is no install prompt on iOS. Build a small, dismissible in-app instruction for this, and give me the exact steps when we first deploy.
- **Standalone mode** works via `display: "standalone"` in the manifest — own icon, no Safari UI. Supply the full iOS icon set and splash screens; a stretched favicon is an instant tell.
- **Web push requires the PWA to be installed to the home screen** (iOS 16.4+) and only after an explicit user gesture grants permission. It will not work from a Safari tab. Do not build reminders as a v1 dependency — see §12.
- **No Background Sync, no Periodic Background Sync, no Background Fetch** on iOS. Anything you were planning to do "in the background" must happen on app open. Streak recalculation, day rollover, and cache refresh all run on launch.
- **Storage is not permanent.** Quotas are tight and caches can be evicted — by low device storage, by clearing Safari data, by deleting the home-screen icon, and historically by long inactivity. Therefore: **JSON export/import is a v1 feature, not a v3 one** — see §2A, where it is also the Phase 1 cross-device mechanism. My habit history is the whole point of the app; losing it silently ends the project. Re-cache critical assets on launch, request persistent storage, and nudge when the last backup goes stale.
- **`100vh` is wrong on iOS Safari.** Use `100dvh` / `svh` with a fallback. Test the safe-area insets — notch at the top, home indicator at the bottom — with `env(safe-area-inset-*)`.
- **Momentum scrolling and tap targets**: `-webkit-overflow-scrolling: touch` on scroll containers, 44×44pt minimum tap targets, and no hover-dependent affordances.
- **Service worker updates are sticky.** Implement an explicit update check and a visible "new version — reload" path, or I will be stuck on a stale build wondering why my changes didn't ship.

---

## 10. GITHUB & DEPLOYMENT

These are settled — do not ask about them:

- **Repo:** `https://github.com/Sosoisworking/kusuo` (public). The git repo root is this folder; `docs/` and its contents are already committed.
- **Live URL:** `https://sosoisworking.github.io/kusuo/`
- **Vite `base` must be `'/kusuo/'`.** This is a project site, not a user site. Getting it wrong gives a white screen with 404s on every asset, and it is the single most common first-deploy failure — verify the deployed page loads on the phone before building anything else on top of it.
- **React Router `basename` must also be `'/kusuo/'`**, or every route 404s in production while working fine locally.
- Default branch `main`. Branch naming and commit style per `docs/legacy/GITHUB_WORKFLOW.md`.
- A `.gitignore` for Node/Vite is already present, including patterns for exported user data. **The repo is public and exports contain personal reflections — never relax those patterns, and never commit a data export or a token.**
- GitHub Pages must be set to deploy from **GitHub Actions**, not from a branch. Tell me if I need to flip that switch in the repo settings.
- GitHub Actions workflow: install → typecheck → test → build → deploy to Pages on push to `main`. Add the Impeccable detector to CI if it can run headless.
- Every push to `main` should land on my phone. Confirm the live URL works **from my iPhone** after the first deploy, and give me the Add-to-Home-Screen steps.
- Feature branches for anything non-trivial. Small, coherent commits. Never rewrite history.
- Add a real `README.md`: what Kusuo is, how to run it locally, how to deploy, where the data lives, how to export it.
- Keep `docs/legacy/` intact as project history. New decisions go in a fresh `DECISIONS.md` at root, with dates.

---

## 11. QUALITY BAR

Adopt the definition of done from `IMPLEMENTATION_SPEC.md`, adapted to web. A slice is done when:

- It builds and typechecks clean. No `any`, no suppressed errors, no `console.log` left behind.
- Tests exist for the logic that actually breaks: streak calculation, frequency rules, date/timezone boundaries, un-complete, migration from the previous schema version. One Playwright test covers the critical path: add habit → complete it → reload → it's still complete.
- **Data survives a hard reload, a browser restart, and an app version upgrade.** Verify this by doing it, not by reasoning about it.
- **Export → import round-trips losslessly.** Export on the phone, import on the Mac, and every derived number — streaks, completion rates, charts — matches exactly. A malformed or truncated import file is rejected cleanly rather than half-applied.
- **The Mac cannot write.** No route through the read-only build reaches a database write. Test this deliberately, including deep links and any dev-only affordances.
- It works offline with the network disabled.
- Accessibility: keyboard reachable, correct contrast, real focus states, sensible labels, respects `prefers-reduced-motion` and Dynamic Type / text scaling.
- Empty, loading, error, and offline states all exist and all say something useful.
- It looks right on an iPhone-width viewport, in dark and light, with a long habit name and with thirty habits in the list.
- Impeccable `audit` and `critique` findings are resolved or explicitly argued down.

Never tell me something works when you have not run it. If you couldn't verify something, say which part is unverified and how I can check it.

---

## 12. EXPLICITLY OUT OF SCOPE FOR v1

- Any backend, hosted database, or account/auth system. Local-first, per `DECISIONS.md`. Note that the GitHub-repo sync in §2A is **not** an exception to this — it is a file push to the user's own private repo, with no server we operate and no account beyond the GitHub one they already have.
- Any AI/LLM feature. The legacy docs describe a separate project, **Haru** (an AI companion), and are clear that it must not be merged into Kusuo prematurely. Honour that. Keep the data layer clean enough that an insights layer could read from it later, and stop there.
- Reminders and notifications — scoped after the data model is stable and proven, per `ROADMAP.md` Phase 6 and the iOS constraints in §9.
- Gamification, XP, levels, achievements. `BACKLOG.md` files these as *experiments to evaluate*, not features to build. Don't add them uninvited; if you think one earns its place, pitch it and let me decide.
- App Store distribution.

---

## 13. HOW TO WORK WITH ME

- I am not a professional developer. Explain decisions in plain language, and tell me the *consequence* of a choice, not just its name.
- When you have a real recommendation, lead with it. Don't hand me three options and ask me to be the architect. "I'd do X because Y — want Z instead?" is the format.
- Push back when I ask for something that will make Kusuo worse or slower to ship. That is part of the job.
- Show me things running on my phone as early and as often as possible. A deployed ugly thing beats a described beautiful one.
- Small steps, verified, over big leaps. Everything in `docs/legacy/` was written by someone who has watched this project stall before — the goal this time is a thing I actually open every morning.

---

### START HERE

1. Read `docs/legacy/` in full.
2. Tell me in a few sentences what you understand Kusuo to be, and name anything in those docs you think is a mistake.
3. Begin the interview in §3 — first batch of questions only.

Do not write any code until I have approved a plan.
