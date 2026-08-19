# Kusuo — Architecture & Product Decisions

## Confirmed decisions

### Android + Kotlin

Kusuo is an Android application built with Kotlin.

### Room for storage

Local structured persistence is handled with Room.

### Package ID

Previously used:

`com.soso.kusuo`

### Local-first direction

Core functionality should work without an internet connection.

## Decisions Claude Code should make only after inspecting the repository

### XML vs Jetpack Compose

Do not blindly migrate to Compose. First determine whether the current project is XML-based, how much UI exists, and whether a migration provides real value.

### Single-Activity architecture vs multiple activities

The historical project used at least `MainActivity`, `HomeActivity`, and `AddHabitActivity`. Claude should evaluate whether to preserve this structure or incrementally migrate to a single Activity with Navigation.

### MVVM / Clean architecture depth

Use an appropriately simple architecture. This is a personal project, so avoid adding layers that do not solve a real problem.

### Backend

Do not introduce a backend for MVP.

### AI

Do not add AI dependencies until the core habit/goal/reflection system is stable.

## Data safety decision

Never replace the existing database destructively simply to make schema changes easier.

Use migrations and preserve user data.
