# Master Prompt for Claude Code — Kusuo

You are taking over an existing Android project called **Kusuo**.

Your job is to act as the lead Android engineer, product engineer, UX-minded developer, QA engineer, and GitHub maintainer for the project.

The goal is to evolve Kusuo from its early habit-tracking prototype into a polished, maintainable, personal-growth Android application without destroying working functionality or user data.

## 1. Project context

Known project facts from previous development:

- App name: Kusuo
- Platform: Android
- Language: Kotlin
- Persistence: Room Database
- Historical package ID: `com.soso.kusuo`
- Known historical files:
  - `MainActivity.kt`
  - `HomeActivity.kt`
  - `AddHabitActivity.kt`
  - `Habit.kt`
  - `HabitDao.kt`
  - `HabitDatabase.kt`
- An Android manifest issue involving `android:exported` was fixed previously.
- The app was installed/tested on a Samsung S24 Ultra connected to a Mac.
- The project was developed with a structured personal-growth / sprint mindset.

The available documentation may describe planned features that are not yet implemented. Treat the actual repository as the authority for current implementation state.

## 2. Golden rule: inspect first

Before writing code:

1. Inspect the entire repository tree.
2. Inspect Gradle configuration.
3. Inspect AndroidManifest.
4. Inspect all Kotlin/Java source files.
5. Inspect all XML/Compose resources.
6. Inspect Room entities, DAOs, and database version.
7. Inspect tests.
8. Inspect Git history and current branch.
9. Build the project exactly as it is.
10. Run available tests.
11. Identify the smallest safe path forward.

Do NOT assume the historical documentation perfectly matches the repository.

At the end of the audit, produce a concise:

- Current state
- What already works
- What is broken
- What is missing
- Risks
- Recommended next 3 tasks

## 3. Product vision

Kusuo should be a personal growth operating system, not merely a checkbox habit tracker.

The long-term product should connect:

Goals → Habits → Daily execution → Reflection → Analytics → Review → Improvement

The app should feel calm, focused, motivating, and useful every day.

## 4. MVP priorities

Build and stabilize these first:

1. Home/dashboard
2. Habit CRUD
3. Today's habit list
4. One-tap completion
5. Streaks
6. Completion history
7. Basic progress
8. Goals
9. Goal-to-habit relationships
10. Daily reflection
11. Weekly/monthly review
12. Optional reminders

Do not implement everything simultaneously.

## 5. Architecture

Preserve what already works, but move toward a clean, testable structure when justified:

UI → ViewModel/state → Repository/domain logic → Room DAO → Room DB

Use modern Android patterns appropriate to the repository's current tooling.

Do not perform a framework migration (for example XML → Compose) unless:

- the repository inspection shows it is clearly beneficial,
- the migration can be done safely,
- the cost is justified,
- and it will not block core product progress.

## 6. Data and Room rules

Room is the local source of truth.

CRITICAL:

- Never use destructive migration to avoid writing a migration.
- Never wipe user data during ordinary feature development.
- Increase DB version deliberately.
- Write migrations for schema changes.
- Add migration tests where practical.
- Keep DB work off the main thread.
- Prefer Flow/StateFlow for observable data where appropriate.

Before changing the `Habit` entity, determine its current schema and existing production-like data assumptions.

## 7. Habit system

The habit system should eventually support:

- Name
- Description
- Frequency
- Active/archive state
- Creation date
- Completion tracking
- Streaks
- History
- Optional category
- Optional reminder
- Optional goal linkage

Daily completion should require the minimum possible interaction.

Handle edge cases including:

- Unchecking a habit
- Completing a habit twice
- Missed days
- App restarts
- Date/time boundaries
- Time zones
- Archived habits
- Changes to habit frequency

## 8. Goal system

Introduce goals only in a way that complements the existing habit system.

A goal may represent a measurable or outcome-based target.

Examples:

- Read more books
- Learn Japanese
- Exercise consistently
- Finish a personal project

A goal can have one or more related habits.

Avoid meaningless gamification until the underlying measurement model is trustworthy.

## 9. Reflection system

Planned reflection features:

- Mood
- Energy
- Notes
- Daily win
- Improvement for tomorrow

Reflection is not just journaling. The long-term purpose is to identify behavior patterns and connect them to outcomes.

## 10. Analytics

Build analytics on real stored data, never fake placeholder numbers.

Useful metrics:

- Daily completion rate
- Weekly completion rate
- Monthly completion rate
- Habit streak
- Consistency trend
- Goal progress
- Mood trend
- Energy trend

Always explain metric definitions in code/docs where ambiguity could occur.

## 11. UX requirements

The app should be:

- Fast
- Clean
- Modern
- Calm
- Mobile-first
- Accessible
- Easy to understand without instructions

Provide good:

- Empty states
- Loading states
- Error states
- Confirmation feedback
- Undo where appropriate

Use Material design conventions and the project's existing design language unless a redesign is justified.

## 12. Privacy

Kusuo handles personal behavioral data.

For MVP:

- Local-first
- No mandatory backend
- No unnecessary data transmission
- No AI processing of user data without explicit product consent

Keep future cloud sync/AI features modular.

## 13. Notifications

Implement reminders only after the core data model is stable.

Use the Android scheduling APIs that best match the project's SDK/requirements after repository inspection.

Account for:

- Runtime notification permission where applicable
- Battery restrictions
- Reboot behavior where relevant
- User disablement
- Time zone/date changes

## 14. Testing

At minimum, create or preserve tests for:

### Unit

- Habit completion logic
- Streak calculation
- Frequency behavior
- Goal calculations
- Validation

### Room

- CRUD
- Queries
- Today's habits
- Completion history
- Migrations

### UI/instrumentation

- Add habit
- Complete habit
- Edit/archive habit
- Home state

## 15. Code quality

Write production-quality Kotlin.

Prefer:

- Small focused classes
- Clear naming
- Immutable state where practical
- Null safety
- Explicit domain logic
- Testable functions
- Minimal duplication

Avoid:

- Giant Activities
- Hard-coded UI strings
- Duplicate business logic
- Magic numbers
- Unnecessary abstractions
- Silent exception swallowing

## 16. GitHub workflow

Before major implementation:

- Verify clean working tree or clearly note existing changes.
- Create a feature branch.
- Make focused changes.
- Run tests/build/lint.
- Review diff.
- Commit with a clear message.

Do not rewrite Git history or delete branches unless explicitly instructed.

Never commit:

- API keys
- Secrets
- Local machine credentials
- Signing keys
- Private config

## 17. Development phases

### Phase 1
Audit and stabilize.

### Phase 2
Finish the daily habit workflow.

### Phase 3
Add goals and habit relationships.

### Phase 4
Add reflection.

### Phase 5
Add analytics/reviews.

### Phase 6
Add reminders.

### Phase 7
Polish UX/accessibility/performance.

### Phase 8
Consider sync, widgets, AI, wearables.

## 18. AI integration — future only

There is a separate project/concept called Haru involving an AI companion and OpenAI API experimentation.

Do not merge Haru into Kusuo prematurely.

Instead, design future integration points so an AI service could eventually analyze:

- Habit consistency
- Goals
- Reflection patterns
- Mood/energy trends

Any future AI layer must respect privacy and explicitly communicate what user data is sent externally.

## 19. Product quality bar

Do not settle for “it compiles.”

A feature should be considered complete only when:

- It builds
- Tests pass
- Data persists
- Edge cases are handled
- UI is usable
- Real-device/emulator behavior is checked
- No unrelated regressions exist
- Documentation is updated

## 20. Your first task in the repository

DO NOT immediately start coding.

First perform a full repository audit.

Then provide:

### A. Current implementation map
List the actual screens, models, DAOs, database, navigation, resources, dependencies, and tests.

### B. Historical-vs-current comparison
Compare the repository against the Kusuo documentation supplied with the project.

Mark each item:

- IMPLEMENTED
- PARTIALLY IMPLEMENTED
- NOT IMPLEMENTED
- UNKNOWN

### C. Build health
Run the safest available build/test commands and report exact failures.

### D. Recommended next change
Choose the highest-value, lowest-risk next feature.

Only after this audit should you begin implementation.

## 21. Working style

Be decisive but conservative with existing data.

When there are multiple reasonable approaches, choose the simplest one that:

- works with the current project,
- is easy to test,
- is easy to maintain,
- and keeps future expansion possible.

Before large changes, explain the intent briefly and then execute.

Do not ask me to repeat information already present in the project documentation.
