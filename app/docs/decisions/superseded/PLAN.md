# Kusuo — Build Plan

Revised after the couples decision. Awaiting approval. No application code has been written.

Read `PRODUCT.md` and `DESIGN.md` first; this file is the how, those are the what and the look.

## The architecture, and what changed

The original plan was local-only with no server. Near-live partner view makes that impossible — two devices cannot see each other in seconds without something in the middle.

What survives, and it is most of it:

- **Your own data stays local and authoritative.** IndexedDB remains the source of truth for your record. The app works fully offline for everything except seeing your partner's day.
- **No merge, ever.** You write only your own events; your partner writes only hers. Two writers exist in the system but never on the same record. This was preserved by choosing near-live *view* over genuinely shared habits, and it is the single most expensive piece of complexity avoided.
- Append-only event log with UUIDs, unchanged.
- JSON export/import, unchanged and still required.

What is new: a thin sync layer that carries **only shared habits**.

### Backend

**Supabase.** Free tier, Postgres, built-in auth, realtime subscriptions, and — the deciding feature — Row Level Security, which enforces the privacy model in the database rather than in application code. A bug in the UI cannot leak a private habit if the database refuses to return it.

Alternative considered: Firebase. Rejected because its security rules are harder to reason about for exactly this kind of per-row, per-relationship visibility.

GitHub Pages continues to host the app itself. Supabase is contacted from the browser.

### The privacy model, enforced in the database

```
profiles      { id, displayName }
pairs         { id, createdAt }
pairMembers   { pairId, profileId }        -- exactly two rows per pair

sharedHabits  { id, ownerId, name, frequencyType, frequencyValue,
                isActive, updatedAt }
sharedEvents  { id, habitId, ownerId, localDate, action, timestamp }
```

Only habits the owner marks shared are mirrored to `sharedHabits` at all. Private habits never reach the server in any form — not the name, not the fact of their existence.

Row Level Security policies:

- A row is readable by its owner, and by the other member of the owner's pair.
- A row is writable **only** by its owner. There is no policy under which a partner can write.
- Unsharing deletes the rows from the server; local history is untouched.
- Unpairing removes the pair and every shared row belonging to it.

Reflections, goals, and private habits have no server table. They cannot leak because they do not exist there.

## Local schema

```ts
habits         { id, name, note?, frequencyType, frequencyValue, isActive,
                 isShared, createdAt, archivedAt?, updatedAt, sortOrder }

habitEvents    { id, habitId, localDate, action, timestamp, deviceId }

goals          { id, title, note?, kind, targetValue?, unit?,
                 startDate, targetDate?, status, updatedAt }

goalHabits     { id, goalId, habitId }
goalEntries    { id, goalId, value, localDate, timestamp }

reflections    { id, localDate, mood?, energy?, note?, win?,
                 improvement?, timestamp, updatedAt }

partnerCache   { habitId, ownerId, name, localDate, action, timestamp }
                 // read-only mirror of the partner's shared data, for offline display

meta           { key, value }
```

`isShared` defaults to **false** on every habit, including the first-run templates. Sharing is always an explicit act.

## Screens

| Screen | Job | Partner-related |
|---|---|---|
| **Today** | Your list, one tap to complete. Your history below. | Partner's day sits below your history, never above your list |
| **Habit detail** | History, frequency, streak, edit, archive, **share toggle** | Share toggle lives here, with a plain statement of what becomes visible |
| **Add / edit habit** | Name, frequency, optional goal link, share off by default | — |
| **Partner** | Their shared habits, their record, their history | The whole screen |
| **Progress** | Heatmap, completion trend, per-habit consistency | Yours only. No combined view, no comparison |
| **Goals** | Both kinds | Private in v1 |
| **Reflect** | Mood, energy, note, win, tomorrow | Never shared, no setting |
| **Review** | Weekly and monthly | Yours only |
| **Settings** | Export, import, pairing, storage, sign out | Pair and unpair live here |

**Navigation:** bottom tab bar — Today, Partner, Progress, Reflect. Goals and Review live inside Progress; Settings behind a header control.

## Logic to settle in prose before it is coded

1. **What "today" means** — local calendar day with a configurable rollover hour. Dates stored as `YYYY-MM-DD` local strings, never UTC instants. **Partners may be in different timezones; each person's day is their own and is never recomputed into the other's.**
2. **Streaks under each frequency type.** A 4×/week habit does not break on an off day.
3. **Un-completing** — appends an `uncomplete` event; derived state is the last event for that habit and date.
4. **Changing frequency** — past weeks keep their original target.
5. **Archiving** — leaves Today, keeps all events and history.
6. **Timezone travel** — events carry the local date at write time.
7. **Sharing a habit that already has history** — does the partner see the back-history or only from the moment of sharing? *Recommendation: only from the moment of sharing. Retroactive exposure is a nasty surprise.*
8. **Unsharing** — server rows deleted, partner's cached copy purged on next sync. Local history untouched.
9. **Offline partner view** — shows the last synced state with a plain timestamp of how stale it is. It never pretends to be current.

## Build order

Ten slices. Each one leaves the app working and installed, so a two-week gap costs nothing but momentum.

### Phase 1 — the app works alone (target: ~2 weeks)

**1 · Shell and pipeline.** Vite + React + TS, dark tokens, PWA manifest, service worker, GitHub Actions deploy. Verify it loads and installs on the iPhone. *Ships first specifically to prove the `/kusuo/` base path.*

**2 · Habits and Today.** CRUD, today's list, one-tap complete and uncomplete, persistence across a hard reload.

**3 · Frequency and streaks.** All three frequency types, streak calculation, per-habit history, habit detail.

**4 · Export and import.** JSON export, validated import, persistent-storage request, last-backup indicator. *From here, data loss is recoverable.*

**5 · Progress.** Heatmap, completion trend, per-habit consistency.

Phase 1 is a complete, honest, useful solo app. **If the couples half never gets built, this still stands on its own** — which is the correct insurance given that a second user is a second person's enthusiasm to maintain.

### Phase 2 — the app works together (target: ~2 weeks)

**6 · Auth and pairing.** Supabase project, RLS policies written and tested *before* any UI, sign-in, invite code, pair, unpair.

**7 · Sharing and partner view.** Per-habit share toggle, push of shared events, realtime subscription, Partner screen, offline cache with staleness indicator.

**8 · Reflection.** Its own screen, its own history. Local only.

**9 · Goals and reviews.** Both goal kinds, habit linking, weekly and monthly summaries.

**10 · Harden and polish.** Long names, thirty habits, offline, accessibility, `prefers-reduced-motion`, empty and error states, Mac read-only mode.

## Testing

Unit tests for streaks under every frequency type, date rollover, timezone boundaries, un-complete, derived-state replay. Dexie migration tests from a previous-version fixture.

**Security tests are not optional.** Automated checks that a private habit is unreadable by the partner's session, that a partner cannot write to your rows, and that unsharing and unpairing actually remove server data. These run against the real RLS policies. A privacy bug here is not a UI glitch.

One Playwright path: add habit → complete → reload → still complete.

## Before Phase 2 begins

Interview the partner the way Soso was interviewed: her actual habits, what she'd want to see, what she'd never want shared, and whether she wants this at all once it is real rather than described. Building for an imagined second user is how the couples half dies.

## Not in v1

No notifications of any kind. No reactions, comments, or nudges between partners — see `PRODUCT.md`. No AI; Haru stays separate. No composite scores, no couple score, no comparison, ever.

## Open

- App icon direction.
- Whether the partner's day appears on Today at all, or only on the Partner tab.
