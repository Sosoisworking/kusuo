# Kusuo — Claude Code Project Package

This package consolidates the Kusuo work and planning available from our previous conversations into a single Claude Code–ready handoff.

## Important scope note

This is a reconstruction from the project information available in the conversation history/context. The original Android source files were not attached in this chat, so this package does **not** claim to contain the exact historical source code. Instead, it records the confirmed technical decisions, known files, completed setup/debugging work, intended product direction, and a detailed implementation plan that Claude Code can use as the source of truth for continuing the project.

## Confirmed project facts

- Project name: **Kusuo**
- Product type: Personal growth / habit-building mobile app
- Platform: Android
- Primary language: Kotlin
- Local persistence: Room Database
- Package/application ID previously used: `com.soso.kusuo`
- Development approach: sprint-oriented and inspired by a Notion-style personal growth tracker
- Known screens/files created during earlier work:
  - `MainActivity.kt`
  - `HomeActivity.kt`
  - `AddHabitActivity.kt`
  - `Habit.kt`
  - `HabitDao.kt`
  - `HabitDatabase.kt`
- A manifest issue involving `android:exported` was resolved during development.
- The app was successfully installed on a Samsung S24 Ultra connected to a Mac during earlier development.

## Product direction established previously

Kusuo is intended to help a user build a more structured and intentional life through habits, progress tracking, reflection, and personal development. The broader personal-growth system discussed alongside the app included:

- Weekly growth tracking
- Mood / energy tracking
- Monthly goal/checklist tracking
- Habit consistency
- Reading habit development
- Language-learning goals (including Japanese)
- Fitness / health routines
- Personal reflection and accountability
- A future relationship with an AI companion/coaching concept (the separate Haru project)

## Suggested next step

Give `CLAUDE_CODE_MASTER_PROMPT.md` to Claude Code after cloning/creating the GitHub repository. Claude should first inspect the repository and preserve working functionality before making architectural changes.
