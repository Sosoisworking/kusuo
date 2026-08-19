# Kusuo — Known Existing Code Structure

The following structure reflects the files confirmed by earlier development notes. The exact paths and package declarations should be verified in the repository.

```text
Kusuo/
├── app/
│   └── src/
│       └── main/
│           ├── java/com/soso/kusuo/
│           │   ├── MainActivity.kt
│           │   ├── HomeActivity.kt
│           │   ├── AddHabitActivity.kt
│           │   ├── Habit.kt
│           │   ├── HabitDao.kt
│           │   └── HabitDatabase.kt
│           ├── res/
│           │   ├── layout/
│           │   ├── drawable/
│           │   ├── mipmap/
│           │   └── values/
│           └── AndroidManifest.xml
├── build.gradle / build.gradle.kts
├── settings.gradle / settings.gradle.kts
└── gradle/
```

## Responsibilities inferred from names

### `MainActivity.kt`

Likely launch/entry activity. Claude should inspect whether this is still necessary or whether it should redirect into a navigation host/home screen.

### `HomeActivity.kt`

Main dashboard/home experience. Should become the central overview of today's habits, progress, and quick actions.

### `AddHabitActivity.kt`

Form/workflow for creating habits. Claude should preserve existing functionality while improving validation, UX, and persistence.

### `Habit.kt`

Room entity/model representing a habit. Do not change schema casually. Use migrations when modifying persisted data.

### `HabitDao.kt`

Room DAO for querying/inserting/updating/deleting habits. Future functionality should be added here only when justified by actual UI/domain needs.

### `HabitDatabase.kt`

Room database singleton/configuration. Verify versioning, callbacks, migration strategy, and thread behavior.

## Recommended future architecture

Do not rewrite the entire app blindly. Evolve it incrementally toward:

```text
UI Layer
  ↓
ViewModel / State
  ↓
Repository / Domain Logic
  ↓
Room DAO
  ↓
Room Database
```

Use a layered structure only where it improves maintainability. Avoid needless enterprise-level abstraction for a personal project.

A future target could be:

```text
com.soso.kusuo
├── data
│   ├── local
│   │   ├── db
│   │   ├── dao
│   │   └── entity
│   └── repository
├── domain
│   ├── model
│   └── usecase
├── ui
│   ├── home
│   ├── habits
│   ├── goals
│   ├── reflections
│   ├── progress
│   └── settings
└── util
```

This is a **target architecture**, not evidence that these packages already exist.
