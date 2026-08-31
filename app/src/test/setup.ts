import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'

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
