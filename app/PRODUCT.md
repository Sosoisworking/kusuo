# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + TypeScript + Vite 8 + Tailwind CSS v4, Dexie (IndexedDB), Zustand, React Router. Deployed as a PWA to GitHub Pages (`base`/`basename` = `/kusuo/`). Established by the existing scaffold (slice 0), not asked as a greenfield stack question.

## Users

Single named user, Soso. No multi-user, no accounts. Two physical contexts: iPhone (the only device that ever writes data — morning and evening, roughly equal use) and Mac (read-only companion, used to review progress). The product has exactly one person to design for; there is no "typical user" abstraction.

## Product Purpose

A personal-growth habit tracker that helps Soso build a small set of real daily habits (first-run templates: Reading, Japanese, Fitness) and see honest progress without being punished, gamified, or nagged into it. Success is Soso opening the app, seeing today's habits within 5 seconds, tapping through them, and coming back tomorrow — not streak-maximizing or feature completeness.

## Positioning

Not a general habit-tracking product. It is calm, local-first, and personally owned: no backend, no account, no AI, no telemetry, no gamification (explicitly rejecting the Duolingo-style pattern as an anti-reference). Data lives only on Soso's own devices as an append-only event log, which is what makes safe future multi-device sync possible without a server. A competing consumer habit app could not truthfully copy this because they are built around engagement/retention mechanics and backend accounts, which this product deliberately has none of.

## Operating Context

- iPhone: installed to the home screen via Safari "Add to Home Screen" (manual install, no install prompt available on iOS). Sole write device. Used both morning and evening.
- Mac: browser-only, strictly read-only — no write UI anywhere, not even disabled controls. Used to review progress/history.
- No connectivity assumed or required; fully local-first via IndexedDB.
- Cross-device transfer/backup in v1 is manual JSON export/import (wholesale replace with validation and a reverse-import guard), not automatic sync.
- iOS PWA constraints apply throughout: no background sync/fetch, storage eviction risk, `100dvh`/safe-area-aware layout, 44×44pt minimum tap targets, and a deliberate reload path for sticky service-worker updates.

## Capabilities and Constraints

- v1 scope: habits only (add/edit/archive, daily check-off, streak/progress viewing, history). Goals and Reflection are explicit stretch slices (10–11), attempted only if the habits-only core (slices 0–9) ships solid with time remaining — not a committed v1 feature.
- No backend, no authentication, no AI features, no telemetry/analytics, no gamification (no XP, levels, achievements, badges).
- No reminders or notifications in v1 (confirmed explicitly).
- Data model is an append-only event log: habit completions (and any future reflections) are immutable events with UUIDs, never mutable boolean flags and never auto-increment integer IDs — this is what keeps a future multi-writer merge (set union by id) trivial and is treated as a hard architectural rule, not a style preference.
- JSON export/import is in v1 scope (not deferred); it is both the backup mechanism and the only cross-device transfer mechanism for now.
- Terminology: "habit" (a tracked recurring behavior), "completion" (an event marking a habit done on a date), "streak" (derived from completions by replay, never stored as state).

## Brand Commitments

- Name: **Kusuo**, displayed with a letter-mark icon (no illustrated mascot/logo direction).
- Voice: warm and encouraging, never punitive. A bad week must read as actively reassuring, not guilt-inducing.
- Visual feel: calm, quiet, steady — explicitly not hectic, gamified, or shouty. Dark-first (system-following light mode also supported), one accent colour (not a multi-colour palette), system font, airy density.
- Anti-reference: Duolingo-style gamification and streak-shaming mechanics are explicitly rejected as a direction.

## Evidence on Hand

None. This is a personal app with no testimonials, case studies, press, or third-party proof to draw on, and none should be fabricated. The only "evidence" is Soso's own stated history of prior habit-tracking attempts failing because they "just didn't take off" — informing the emphasis on low-friction daily use over feature richness.

## Product Principles

1. Calm over stimulating — no urgency-manufacturing patterns (streak-loss shaming, red badges, punitive copy).
2. Local-first and single-writer — the iPhone owns truth; the Mac only ever observes it.
3. Small and honest — ship the habits-only core well before considering goals/reflection; do not pad v1 with product experiments from the legacy Android spec (daily/growth score, XP, achievements) without asking first.
4. Data safety over convenience — event-sourced, UUID-keyed, exportable; never a shape that makes future multi-device merge or migration destructive.
5. Five-second open — today's habits must be visible and tappable almost immediately; nothing gates the core loop behind navigation.

## Accessibility & Inclusion

No accessibility requirement beyond platform standard was raised by the user. iOS Human Interface Guidelines tap-target sizing (44×44pt minimum) applies as a functional constraint on the phone surface (see Operating Context), not as a separate accessibility ask.
