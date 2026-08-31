# Decision — the couples direction is deferred

**Date:** 30 August 2026
**Status:** Deferred, not rejected on the merits
**Supersedes:** the two-user framing in `superseded/PRODUCT.md`, `superseded/DESIGN.md`, `superseded/PLAN.md`

## What was decided earlier that day

Kusuo would become a two-person app. Soso and his partner would each keep their own record; habits could be shared for viewing, opt-in one at a time, default off. Near-live partner view via Supabase, with Row Level Security enforcing the privacy model in the database. Reflections never shareable. Two writers in the system but never on the same record, so no merge logic.

That design was run through a five-advisor council, survived peer review, and was written up in full. The reasoning is sound and the documents are kept for it.

## Why it is parked

Reading the repository afterwards showed the decision was made against a picture of the project that was already out of date:

1. **The app was not unbuilt.** The plan assumed zero application code. In fact fifteen commits existed — eight screens, a v3 schema, working export/import, and a complete training module at the data and logic layer. The couples plan proposed an architecture for an app that already had one.

2. **Every session since went a different way.** The active work is the six-tab redesign and the Nocturne palette, specified in `REDESIGN-PROMPT.md`. That document says "no accounts, no server" and does not mention a partner anywhere. Revealed preference across several working sessions points away from couples, not toward it.

3. **The built app has already promised otherwise.** The onboarding screen reads "Just your name — nothing else, no account needed." Adding auth would break a promise the shipped product already makes to its user.

4. **The council's own strongest objection stands.** The First Principles advisor's point — that one-writer, no-merge, no-auth, no-server are the architectural expression of "one person, one phone", not incidental constraints — is now confirmed by the code. The whole data layer is built on it.

5. **It was Soso's idea, not his partner's.** She was willing rather than asking. The council flagged this as the decisive unknown, and it remains the weakest joint in the case.

## What it would take to revive it

Not a rewrite. The groundwork is genuinely there:

- The event log is append-only and UUID-keyed, so merging two people's histories is still a set union.
- `settings.deviceRole` already distinguishes writer from reader.
- Export/import already round-trips a whole database.

Reviving it means adding a sharing layer, not restructuring anything. The sensible trigger is Soso using the app daily for a month and his partner asking to see it — real signal that a planning document cannot manufacture.

## What was kept from it

Several things outlived the decision and are now in `SPEC.md`:

- The privacy stance: nothing shared by default, ever.
- The refusal of composite scores, couple scores, and comparison of any kind.
- The rule that the app never editorialises about a record — absence renders as absence.
- The insight that choosing *view* over *co-logging* is what preserves the no-merge property, if sharing is ever built.
