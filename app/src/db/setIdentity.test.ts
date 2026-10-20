import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../test/setup'
import { liveSets } from '../logic/sessions'
import { InvalidBackupError, buildBackup, parseBackup } from './backup'
import { db, type SessionEvent } from './schema'
import { logSet, voidSet } from './sessions'

const AT = { localDate: '2026-01-05', splitDayId: 'day-push', exerciseId: 'ex-bench' }

beforeEach(async () => {
  await resetDatabase()
})

describe('every set has an id', () => {
  it('gives each new set its own id', async () => {
    const a = await logSet({ ...AT, setIndex: 0 }, { weightKg: 80, reps: 6 }, 'phone')
    const b = await logSet({ ...AT, setIndex: 1 }, { weightKg: 80, reps: 5 }, 'phone')
    expect(a.setId).toBeTruthy()
    expect(b.setId).toBeTruthy()
    expect(a.setId).not.toBe(b.setId)
  })

  it('treats logging over a set as correcting it, not adding another', async () => {
    const first = await logSet({ ...AT, setIndex: 0 }, { weightKg: 80, reps: 6 }, 'phone')
    const fixed = await logSet({ ...AT, setIndex: 0 }, { weightKg: 82.5, reps: 6 }, 'phone')
    expect(fixed.setId).toBe(first.setId)

    const sets = liveSets(await db.sessionEvents.toArray())
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(82.5)
  })

  it('takes a set back out and puts it back as the same set', async () => {
    const set = await logSet({ ...AT, setIndex: 0 }, { weightKg: 80, reps: 6 }, 'phone')
    const voided = await voidSet({ ...AT, setIndex: 0 }, { weightKg: 80, reps: 6 }, 'phone')
    expect(voided.setId).toBe(set.setId)
    expect(liveSets(await db.sessionEvents.toArray())).toHaveLength(0)

    const restored = await logSet({ ...AT, setIndex: 0 }, { weightKg: 80, reps: 6 }, 'phone')
    expect(restored.setId).toBe(set.setId)
    expect(liveSets(await db.sessionEvents.toArray())).toHaveLength(1)
  })
})

describe('sets logged before ids existed', () => {
  function legacy(overrides: Partial<SessionEvent>): SessionEvent {
    return {
      id: crypto.randomUUID(),
      ...AT,
      setIndex: 0,
      weightKg: 80,
      reps: 6,
      action: 'log',
      timestamp: 1000,
      deviceId: 'phone',
      ...overrides,
    }
  }

  it('replay exactly as they always did', () => {
    const events = [
      legacy({ setIndex: 0, timestamp: 1000 }),
      legacy({ setIndex: 1, timestamp: 1001 }),
      legacy({ setIndex: 0, weightKg: 85, timestamp: 1002 }), // a correction, old style
    ]
    const sets = liveSets(events)
    expect(sets).toHaveLength(2)
    expect(sets.find((s) => s.setIndex === 0)?.weightKg).toBe(85)
  })

  it('can still be corrected, and the correction meets the old set', async () => {
    await db.sessionEvents.add(legacy({ setIndex: 0, timestamp: 1000 }))
    await logSet({ ...AT, setIndex: 0 }, { weightKg: 90, reps: 3 }, 'phone')

    const sets = liveSets(await db.sessionEvents.toArray())
    expect(sets).toHaveLength(1)
    expect(sets[0].weightKg).toBe(90)
  })
})

describe('two devices that have not seen each other', () => {
  it('keeps every set when an offline phone and the Mac both log the same movement', () => {
    // Morning, no signal: the phone logs three bench sets. Evening: the Mac,
    // which never saw them, logs two more. Both start at index 0.
    const phone = [0, 1, 2].map((i) => ({
      id: crypto.randomUUID(),
      ...AT,
      setIndex: i,
      setId: crypto.randomUUID(),
      weightKg: 80,
      reps: 6,
      action: 'log' as const,
      timestamp: 1000 + i,
      deviceId: 'phone',
    }))
    const mac = [0, 1].map((i) => ({
      id: crypto.randomUUID(),
      ...AT,
      setIndex: i,
      setId: crypto.randomUUID(),
      weightKg: 60,
      reps: 12,
      action: 'log' as const,
      timestamp: 5000 + i,
      deviceId: 'mac',
    }))

    // A slot key would have kept only two of these five.
    expect(liveSets([...phone, ...mac])).toHaveLength(5)
  })
})

describe('backups carry set ids', () => {
  it('round-trips them', async () => {
    const set = await logSet({ ...AT, setIndex: 0 }, { weightKg: 80, reps: 6 }, 'phone')
    const parsed = parseBackup(JSON.stringify(await buildBackup()))
    expect(parsed.sessionEvents[0].setId).toBe(set.setId)
  })

  it('refuses a set id that is not a string', async () => {
    await logSet({ ...AT, setIndex: 0 }, { weightKg: 80, reps: 6 }, 'phone')
    const payload = await buildBackup()
    const broken = {
      ...payload,
      sessionEvents: payload.sessionEvents.map((e) => ({ ...e, setId: 42 })),
    }
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(InvalidBackupError)
  })
})
