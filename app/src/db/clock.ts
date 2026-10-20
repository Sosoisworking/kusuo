// Dexie primary keys here are UUIDs, so query results are not guaranteed to
// come back in insertion order — replay's "last event wins" relies entirely on
// `timestamp`. Date.now() alone can tie within the same millisecond on rapid
// successive writes (tapping through a set table does exactly that), so this
// device's clock is forced strictly monotonic on append. One counter is shared
// across every append-only table, which keeps ordering coherent between a
// session's sets and the habit tick it emits.
//
// It is a hybrid logical clock: wall time when wall time is ahead, the last
// value plus one when it isn't. Two things make it hold across more than one
// running of the app:
//
// - It is persisted. Held only in memory it restarted at the wall clock on
//   every launch, so a clock set back by travel or a correction could stamp a
//   new write below one already in the record — and replay would believe the
//   older one.
// - It moves past timestamps that arrive from elsewhere (`observeTimestamp`):
//   an imported backup now, synced rows later. A write made after an import has
//   to sort after everything the import brought, or an edit to an imported row
//   loses to the row it was meant to replace.
//
// It is kept in localStorage beside the deviceId, for the same reason: it
// describes this device, and it must survive an import that replaces every
// table.
const CLOCK_KEY = 'kusuo.clock'

let lastTimestamp = readPersisted()

function readPersisted(): number {
  try {
    const value = Number(localStorage.getItem(CLOCK_KEY))
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    // Storage can be unavailable (some previews, blocked site data). The clock
    // still works for this run; it just can't remember.
    return 0
  }
}

function persist(value: number): void {
  try {
    localStorage.setItem(CLOCK_KEY, String(value))
  } catch {
    // As above: forgetting is the worst case, and it is no worse than before.
  }
}

export function nextTimestamp(): number {
  const now = Date.now()
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1
  persist(lastTimestamp)
  return lastTimestamp
}

/** Moves the clock past a timestamp that came from elsewhere, so the next local write sorts after it. */
export function observeTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp) || timestamp <= lastTimestamp) return
  lastTimestamp = timestamp
  persist(lastTimestamp)
}
