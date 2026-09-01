import { beforeEach, describe, expect, it } from 'vitest'
import { allReflections, appendReflection } from './reflections'
import { resetDatabase } from '../test/setup'
import { db } from './schema'

beforeEach(async () => {
  await resetDatabase()
})

describe('appendReflection', () => {
  it('creates a row with correct fields', async () => {
    const entry = await appendReflection('2026-01-05', 'Good day', 'dev1')
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(entry.localDate).toBe('2026-01-05')
    expect(entry.text).toBe('Good day')
    expect(entry.deviceId).toBe('dev1')
    expect(entry.timestamp).toBeTypeOf('number')

    const stored = await db.reflections.get(entry.id)
    expect(stored).toEqual(entry)
  })

  it('forces strictly monotonic timestamps on rapid successive calls', async () => {
    const a = await appendReflection('2026-01-05', 'First', 'dev1')
    const b = await appendReflection('2026-01-05', 'Second', 'dev1')
    const c = await appendReflection('2026-01-05', 'Third', 'dev1')
    expect(b.timestamp).toBeGreaterThan(a.timestamp)
    expect(c.timestamp).toBeGreaterThan(b.timestamp)
  })
})

describe('allReflections', () => {
  it('returns everything appended, across dates', async () => {
    await appendReflection('2026-01-05', 'A', 'dev1')
    await appendReflection('2026-01-06', 'B', 'dev1')
    await appendReflection('2026-01-05', 'C', 'dev2')

    const all = await allReflections()
    expect(all).toHaveLength(3)
    expect(all.map((e) => e.text).sort()).toEqual(['A', 'B', 'C'])
  })

  it('returns an empty array when nothing has been appended', async () => {
    const all = await allReflections()
    expect(all).toEqual([])
  })
})
