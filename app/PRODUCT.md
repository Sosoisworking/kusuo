# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + TypeScript + Vite 8 + Tailwind CSS v4, Dexie (IndexedDB), Zustand, React Router. Deployed as a PWA to GitHub Pages (`base`/`basename` = `/kusuo/`). Established by the existing scaffold (slice 0), not asked as a greenfield stack question.

## Users

Single named user, Soso. No multi-user, no accounts. Two physical contexts: iPhone (the only device that ever writes data — morning and evening, roughly equal use) and Mac (read-only companion, used to review progress). The product has exactly one person to design for; there is no "typical user" abstraction.

## Product Purpose

A personal-growth app holding two halves of the same practice: a small set of daily habits, and a proper training log for the days Soso lifts. Success is opening it, seeing today's habits and today's session within 5 seconds, and coming back tomorrow — not streak-maximizing or feature completeness.

Six tabs: Today, Train, Splits, Calendar, Records, Settings. Reflect and Goals are reached from cards on Today and from the profile menu; they lost their tabs deliberately when the training module arrived.

## Positioning

Not a general habit-tracking product. It is calm, local-first, and personally owned: no backend, no account, no AI, no telemetry, no gamification (explicitly rejecting the Duolingo-style pattern as an anti-reference). Data lives only on Soso's own devices as an append-only event log, which is what makes safe future multi-device sync possible without a server. A competing consumer habit app could not truthfully copy this because they are built around engagement/retention mechanics and backend accounts, which this product deliberately has none of.

## Operating Context

- iPhone: installed to the home screen via Safari "Add to Home Screen" (manual install, no install prompt available on iOS). Sole write device. Used both morning and evening.
- Mac: browser-only, strictly read-only — no write UI anywhere, not even disabled controls. Used to review progress/history.
- No connectivity assumed or required; fully local-first via IndexedDB.
- Cross-device transfer/backup in v1 is manual JSON export/import (wholesale replace with validation and a reverse-import guard), not automatic sync.
- iOS PWA constraints apply throughout: no background sync/fetch, storage eviction risk, `100dvh`/safe-area-aware layout, 44×44pt minimum tap targets, and a deliberate reload path for sticky service-worker updates.
- **The installed home-screen app has storage of its own, separate from Safari.** iOS partitions it, so the two are two records that never meet. Nothing in the web platform can join them; export-then-import is the bridge, and the app says so on first run and in Your data rather than opening empty and unexplained.
- **iOS does not apply Dynamic Type to web content**, in Safari or installed. Page Zoom is the only lever a reader has, and it scales layout as well as text. The type scale is therefore fixed by design rather than responsive to a setting the platform never sends.

## Capabilities and Constraints

- Shipped: habits (add/edit/archive, daily check-off, streaks, history), a full training module (exercises, splits, set-by-set session logging, derived records, kettlebell circuits), goals with completion, structured reflections, a calendar, a records screen, and JSON export/import.
- **A split is a weekly schedule, not a cycle.** Its first day falls on the first day of the week and today's date decides today's session; a missed session is missed, not carried forward. Rest days are days in the schedule.
- Rep targets are ranges (`3 × 6-8`). Weight is always stored in kilograms and converted for display. Cardio and circuits are logged by time, not load.
- No backend, no authentication, no AI features, no telemetry/analytics, no gamification (no XP, levels, achievements, badges).
- No reminders or notifications. Confirmed four times, most recently 1 September 2026 after being told the technical position: an iOS PWA has no scheduled local notifications, and a real 11pm push would need a server, which the product refuses.
- Data model is an append-only event log: habit completions (and any future reflections) are immutable events with UUIDs, never mutable boolean flags and never auto-increment integer IDs — this is what keeps a future multi-writer merge (set union by id) trivial and is treated as a hard architectural rule, not a style preference.
- JSON export/import is in v1 scope (not deferred); it is both the backup mechanism and the only cross-device transfer mechanism for now. A backup carries the record **and** the preferences that belong to it — name, units, week start, default sets, training habit — but never this device's identity or role. Onboarding can import one before a record exists, so a fresh install can be a restore rather than a fresh start.
- **Logging out is not resetting.** Log out makes this device forget its role, name and preferences and ask the first-run questions again; every habit, session, goal and reflection stays. Erasing the record is Your data › Reset all data, behind a typed RESET.
- A suggested value and a recorded one must never look alike. The set table offers what a set would most likely take as a placeholder behind an empty field; only what you type or tick is written. A guess that reads like a fact eventually gets logged as one.
- Terminology: "habit" (a tracked recurring behavior), "completion" (an event marking a habit done on a date), "streak" (derived from completions by replay, never stored as state), "split" (a weekly training programme), "split day" (one day of it), "circuit" (a named round of movements logged by time), "record" (a fact derived by replaying the session log, never stored).
- Sharing is one-way and inert: a session can be exported as plain text with an optional `KUS2` code. An imported workout arrives as a **new** split day and overwrites nothing.

## Brand Commitments

- Name: **Kusuo**, displayed with a letter-mark icon (no illustrated mascot/logo direction).
- Voice: **factual and unsentimental**. It states what is true and stops. No exclamation marks anywhere in the interface. A bad week reads plainly — never punitive, and never falsely encouraging. (This replaces an earlier "warm and encouraging" direction.)
- Visual: the **Nocturne** design system. Deep indigo ground `#161826`, blurple accent `#9184d9`, neutral and accent ramps. One accent carries meaning — the present moment, the interactive thing, and the completed thing. **No green and no red**: completion is the accent arriving, and absence is a neutral hairline, because a missed day is not an error. Light theme is derived from the same OKLCH ramps. Lists are separated by hairline rules; a card is reserved for something you act on.
- Anti-reference: Duolingo-style gamification and streak-shaming mechanics are explicitly rejected as a direction.

## Evidence on Hand

None. This is a personal app with no testimonials, case studies, press, or third-party proof to draw on, and none should be fabricated. The only "evidence" is Soso's own stated history of prior habit-tracking attempts failing because they "just didn't take off" — informing the emphasis on low-friction daily use over feature richness.

## Product Principles

1. Calm over stimulating — no urgency-manufacturing patterns (streak-loss shaming, red badges, punitive copy).
2. Local-first and single-writer — the iPhone owns truth; the Mac only ever observes it.
3. Small and honest — no daily/growth score, no XP, no achievements, no composite anything. Records are facts stated plainly.
4. Data safety over convenience — event-sourced, UUID-keyed, exportable; never a shape that makes future multi-device merge or migration destructive.
5. Five-second open — today's habits must be visible and tappable almost immediately; nothing gates the core loop behind navigation.
6. Nothing runs a clock — no rest timer, no countdown, no elapsed-session number. A running number on a training screen is a rest timer wearing a hat.

## Accessibility & Inclusion

No accessibility requirement beyond platform standard was raised by the user. iOS Human Interface Guidelines tap-target sizing (44×44pt minimum) applies as a functional constraint on the phone surface (see Operating Context), not as a separate accessibility ask.
