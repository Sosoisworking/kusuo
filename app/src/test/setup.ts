import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Every test runs on Monday 5 January 2026.
 *
 * The split is a weekly schedule, so "today's session" depends on the weekday —
 * which meant the suite passed on a Monday and failed on a Tuesday. Pinning the
 * clock makes the day-of-week a property of the test rather than of when it
 * happens to run. A test that needs a different day sets its own time.
 */
export const PINNED_NOW = new Date(2026, 0, 5, 9, 0, 0)

beforeEach(() => {
  // Only Date is faked. Faking the timers as well deadlocks userEvent and
  // waitFor, which schedule real work between keystrokes.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(PINNED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

// jsdom 30 no longer ships localStorage, and Kusuo keeps its deviceId there —
// deliberately outside IndexedDB so it survives a wholesale import replace. An
// in-memory Storage keeps that path testable.
class MemoryStorage implements Storage {
  private entries = new Map<string, string>()

  get length(): number {
    return this.entries.size
  }
  clear(): void {
    this.entries.clear()
  }
  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.entries.delete(key)
  }
  setItem(key: string, value: string): void {
    this.entries.set(key, String(value))
  }
}

// Node exposes a `localStorage` global that is undefined unless started with
// --localstorage-file, so test for a usable value rather than for the key.
function hasUsableStorage(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    return Boolean((globalThis as Record<string, unknown>)[name])
  } catch {
    return false
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!hasUsableStorage(name)) {
    Object.defineProperty(globalThis, name, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    })
  }
}

/**
 * Empties every table between tests. Each test file used to keep its own list,
 * so a table added to the schema leaked between cases until nine files were
 * remembered. This asks Dexie instead.
 */
export async function resetDatabase(): Promise<void> {
  const { clearEverything } = await import('../db/tables')
  await clearEverything()
}
