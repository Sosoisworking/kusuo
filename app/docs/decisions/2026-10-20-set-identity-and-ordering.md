# Decision — every set has an id, and every replay orders the same way

**Date:** 20 October 2026
**Status:** Adopted and built (S0).

## Set identity

**Before:** a set was identified by its slot — date, day, movement, position — and the latest
event for a slot won.

**Why that had to change:** it is right on one device and wrong on two. A phone with no signal
at the gym logs sets 1–3; the Mac, which never saw them, logs sets 1–2 that evening. Merged,
the Mac's two silently replace two of the phone's. Nothing warns; a record can vanish.

**Now:** each `SessionEvent` carries a `setId`. A new set gets a UUID. Logging over a set,
voiding it, or restoring it reuses that set's id, so a correction still meets the set it
corrects. `setIndex` is display order only.

**Old events** have no `setId`. Replay identifies them by the slot they always had, and a
correction to one carries that slot key as its id — history replays exactly as before.

**The trade-off, chosen deliberately:** if two devices log the same physical set, it appears
twice and can be voided. A visible duplicate is recoverable; a silent loss is not.

**Not yet done:** the session screen still addresses sets by position, which is sound while one
device writes. When the Mac becomes a writer (S9), sets are addressed by id instead.

## Ordering

**Ties.** Replay used to break ties two ways — some sites kept the first event seen, others the
last — and "first seen" over a UUID-keyed collection is arbitrary. `logic/order.ts`'s
`isLater` now decides at all nine sites: later timestamp, then larger `deviceId`. The same events
give the same answer on every device, in any order.

**The clock.** `nextTimestamp()` is a hybrid logical clock: wall time when it is ahead, the last
value plus one when it isn't. It is persisted in localStorage beside the `deviceId`, so a clock
set back by travel or a correction can't stamp a new write below an older one, and it moves past
every stamp an import brings, so an edit after an import wins over the row it replaces. Every
row stamp — events, `createdAt`, `updatedAt`, `archivedAt`, a backup's `exportedAt` — uses it.
`lastBackupAt` stays on the wall clock: it is shown to a person, not used for ordering.

**What it doesn't fix:** two devices with skewed clocks still decide conflicts by their clocks.
The outcome is deterministic, not necessarily the one a person would pick.
