# Kusuo — Product & Technical Implementation Specification

## 1. Product vision

Build Kusuo into a polished Android personal-growth companion that makes improvement visible, measurable, and sustainable.

The product should feel like a personal operating system rather than a basic checkbox habit tracker.

Core principles:

- Simple enough to use every day
- Fast daily interactions
- Local-first and reliable
- Progress should be visually obvious
- Reflection should lead to action
- Goals should connect to daily habits
- Data should remain understandable to the user
- Architecture should be maintainable and testable

## 2. MVP capability map

### Dashboard / Home

Display:

- Today's date
- Today's habits
- Completion progress
- Streak / consistency summary
- Quick-add habit
- Quick view of current goals
- Optional mood/energy check-in
- Daily focus or priority

### Habits

A habit should support, at minimum:

- Name
- Description/notes
- Frequency
- Active/inactive state
- Creation date
- Completion tracking
- Streak calculation
- Optional category

Potential later attributes:

- Target count
- Time of day
- Reminder
- Color/icon
- Difficulty
- Goal linkage

### Habit completion

The core interaction should be extremely fast:

1. Open app
2. See today's habits
3. Tap complete
4. Receive clear visual confirmation
5. Progress updates immediately

### Progress

The app should support:

- Daily completion rate
- Weekly completion rate
- Monthly completion rate
- Streaks
- Consistency trends
- Habit-level history

Future visualization:

- Calendar heatmap
- Weekly bars
- Completion trend line
- Habit breakdown

### Goals

Allow users to define longer-term outcomes, for example:

- Read 12 books
- Learn Japanese
- Exercise 4x/week
- Finish a personal project

Goals should be able to connect to one or more habits.

### Reflection

Potential daily reflection:

- Mood score
- Energy score
- Notes
- What went well?
- What should improve tomorrow?

### Weekly review

Generate a summary:

- Habit completion
- Best-performing habit
- Weakest habit
- Streak changes
- Mood/energy trend
- Goals progressed
- Reflection prompt

### Monthly review

Provide:

- Completion overview
- Major wins
- Missed patterns
- Goal progress
- Month-over-month comparison
- Next-month priorities

## 3. Personal growth system mapping

The app should map high-level goals to repeatable behaviors.

Example:

Goal: Become more disciplined

Habits:
- Wake up on time
- Read 20 minutes
- Workout
- Journal

Progress:
- 78% weekly habit completion
- 9-day reading streak
- 3/4 weekly workouts

Reflection:
- Energy was highest on days with earlier sleep

This turns the app from a list of tasks into a feedback system.

## 4. Suggested data model

Treat the following as a starting design only; inspect the existing schema before applying changes.

### Habit

Possible fields:

- id: Long
- name: String
- description: String?
- category: String?
- frequencyType: enum/string
- frequencyValue: String?
- isActive: Boolean
- createdAt: Long
- archivedAt: Long?

### HabitCompletion

- id: Long
- habitId: Long
- completedDate: LocalDate/String
- completedAt: Long
- note: String?

### Goal

- id: Long
- title: String
- description: String?
- targetValue: Double?
- currentValue: Double?
- unit: String?
- startDate: LocalDate/String
- targetDate: LocalDate/String?
- status: enum/string

### GoalHabitCrossRef

Associates goals with habits.

### DailyReflection

- id: Long
- date: LocalDate/String
- mood: Int?
- energy: Int?
- notes: String?
- win: String?
- improvement: String?

## 5. Persistence rules

Room should remain the source of truth for local data.

Rules:

- Never destroy user data during ordinary upgrades.
- Use Room migrations when schema changes.
- Add tests for migrations where practical.
- Keep database access off the main thread.
- Prefer Flow/StateFlow for observable data where appropriate.

## 6. UX rules

### Daily use

A user should be able to complete all daily habits in seconds.

### Empty states

Do not leave blank screens. Explain what to do next.

### Error states

Give actionable messages instead of generic failures.

### Accessibility

Support:

- Adequate touch targets
- Content descriptions
- Readable typography
- Sufficient contrast
- Scalable text

## 7. Notifications / reminders

Planned capability:

- Optional habit reminders
- User-defined times
- Notifications can be disabled per habit
- No aggressive notification behavior

Android scheduling implementation must be compatible with the project's target SDK and current Android behavior. Claude should verify the repository's SDK settings before choosing AlarmManager vs WorkManager or other APIs.

## 8. Offline-first

Kusuo should remain useful with no internet connection.

The first release should not require a backend.

Future sync options may include:

- Google account/cloud backup
- Export/import
- Encrypted backup

These should not be prerequisites for MVP.

## 9. Privacy

The app contains personal behavioral data. Default design should therefore be privacy-conscious:

- Store data locally unless the user explicitly enables sync.
- Do not transmit habit/reflection data to a third party in MVP.
- If AI features are later added, make data-sharing explicit.

## 10. Testing strategy

Minimum tests:

### Unit tests

- Habit validation
- Completion logic
- Streak calculation
- Frequency logic
- Goal progress calculations

### Room tests

- Insert/read/update/delete
- Query today's habits
- Query completion history
- Migration tests

### UI/instrumentation

- Add habit flow
- Complete habit flow
- Home screen state
- Empty state

## 11. Definition of done

A feature is done only when:

- It builds successfully.
- It does not break existing functionality.
- Data persists correctly.
- Relevant edge cases are handled.
- UI works on a real Android device/emulator.
- Tests are added/updated when appropriate.
- README/documentation is updated when architecture or setup changes.
- The Git history clearly describes the change.
