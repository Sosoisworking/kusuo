# Kusuo

A personal growth app — habits, progress, reflection — built as an installable Progressive Web App.

Kusuo is local-first. All data lives on the device in IndexedDB. There is no server, no account, and no network dependency; the app works fully offline.

## Status

Not yet built. This repository currently contains the design brief only.

## Getting started

The build has not started. To begin:

1. Open this folder in Claude Code.
2. Enter plan mode (Shift+Tab twice).
3. Paste the contents of `docs/DESIGN_PROMPT.md`.

The agent runs a design interview first, then produces a plan for approval. No code is written before that plan is approved.

## Documentation

- `docs/DESIGN_PROMPT.md` — the build brief. Platform decision, data architecture, design workflow, quality bar. Start here.
- `docs/legacy/` — product planning from earlier sessions. Valid as **product and data-model specification**. Its technical guidance is **obsolete**: it describes a native Android/Kotlin/Room app that was never carried forward. Read "Room" as "local database" and "Activity" as "screen"; ignore all Gradle, Kotlin, and APK instructions.

## Key decisions

- **Platform** — installable PWA on GitHub Pages, added to the iPhone home screen. Not a native app.
- **Data** — local-only, in IndexedDB. No backend, no account, no telemetry.
- **Devices** — the iPhone is the only device where data is entered. The Mac is read-only, for review. This means there is no sync merge and no conflict resolution anywhere in the codebase.
- **Backup** — JSON export/import is a v1 requirement, not a later addition. Browser storage on iOS can be evicted, so an export is the only durable copy of the data.

## Data ownership

Everything entered stays on the device. Nothing is transmitted anywhere. Export produces a plain JSON file the user controls; that file is the backup and the only route onto another device.
