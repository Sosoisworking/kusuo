// Dexie primary keys here are UUIDs, so query results are not guaranteed to
// come back in insertion order — replay's "last event wins" relies entirely on
// `timestamp`. Date.now() alone can tie within the same millisecond on rapid
// successive writes (tapping through a set table does exactly that), so this
// device's clock is forced strictly monotonic on append. One counter is shared
// across every append-only table, which keeps ordering coherent between a
// session's sets and the habit tick it emits.
let lastTimestamp = 0

export function nextTimestamp(): number {
  const now = Date.now()
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1
  return lastTimestamp
}
