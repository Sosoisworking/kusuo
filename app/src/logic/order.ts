/**
 * The one ordering every replay uses: later timestamp wins, and on a tie the
 * larger deviceId wins.
 *
 * Replay used to break ties two ways — some sites kept the first event seen
 * (`>`), others the last (`>=`) — and "first seen" over a Dexie collection keyed
 * by UUID means arbitrary order. One device never ties, because its clock is
 * strictly monotonic, so nobody noticed. Two devices can, and then two copies of
 * the same events would derive different state. This rule gives every device
 * the same answer from the same events, whatever order they arrive in.
 *
 * It makes the outcome deterministic, not necessarily the one a person would
 * pick: two devices with skewed clocks still decide by their clocks.
 */
export interface Ordered {
  timestamp: number
  deviceId: string
}

/** True when `a` replaces `b` as the latest. */
export function isLater(a: Ordered, b: Ordered): boolean {
  return a.timestamp > b.timestamp || (a.timestamp === b.timestamp && a.deviceId > b.deviceId)
}
