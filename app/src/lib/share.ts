import type { Exercise, SplitDay, Units } from '../db/schema'
import type { LoggedSet } from '../logic/sessions'
import { formatLongDate } from './format'
import { formatWeight, weightValue } from './units'

/**
 * A workout someone else can read, and — if they also run Kusuo — import.
 *
 * Movements travel by **name**, not by id. The other device has its own ids and
 * may not have your custom movements at all, so a name is the only thing both
 * sides can agree on. Import matches by name and creates what it does not have.
 */
export interface SharedWorkout {
  v: 2
  label: string
  entries: { name: string; sets: number; repsMin: number; repsMax: number }[]
}

const PREFIX = 'KUS2:'

/** Base64 of the JSON, prefixed so it can be found inside a longer message. */
export function encodeWorkout(workout: SharedWorkout): string {
  const json = JSON.stringify(workout)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return PREFIX + btoa(binary)
}

/**
 * Pulls the code out of whatever was pasted — a bare code, or a whole message
 * with the code somewhere in it. Returns undefined rather than throwing when
 * there is nothing to find, because "no code in this message" is an ordinary
 * outcome, not an error.
 */
export function findWorkoutCode(text: string): string | undefined {
  const match = text.match(/KUS2:[A-Za-z0-9+/=]+/)
  return match?.[0]
}

export class InvalidWorkoutCodeError extends Error {}

export function decodeWorkout(code: string): SharedWorkout {
  const body = code.startsWith(PREFIX) ? code.slice(PREFIX.length) : code
  let parsed: unknown
  try {
    const binary = atob(body)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new InvalidWorkoutCodeError("That code didn't decode — it may have been cut short.")
  }
  if (!isSharedWorkout(parsed)) {
    throw new InvalidWorkoutCodeError("That code isn't a Kusuo workout.")
  }
  return parsed
}

function isSharedWorkout(x: unknown): x is SharedWorkout {
  if (typeof x !== 'object' || x === null) return false
  const w = x as Record<string, unknown>
  return (
    w.v === 2 &&
    typeof w.label === 'string' &&
    Array.isArray(w.entries) &&
    w.entries.every((e) => {
      if (typeof e !== 'object' || e === null) return false
      const entry = e as Record<string, unknown>
      return (
        typeof entry.name === 'string' &&
        typeof entry.sets === 'number' &&
        typeof entry.repsMin === 'number' &&
        typeof entry.repsMax === 'number'
      )
    })
  )
}

/** A split day as something to share: names and targets, no personal loads. */
export function workoutFromDay(day: SplitDay, byId: Map<string, Exercise>): SharedWorkout {
  return {
    v: 2,
    label: day.label,
    entries: day.entries.map((entry) => ({
      name: byId.get(entry.exerciseId)?.name ?? 'Unknown movement',
      sets: entry.sets,
      repsMin: entry.repsMin,
      repsMax: entry.repsMax,
    })),
  }
}

/**
 * One session as plain text — readable in any message app by someone who has
 * never heard of Kusuo. Weights are in the sender's units and say so, because a
 * bare "80" means two different lifts depending on who is reading.
 */
export function formatSessionText(
  localDate: string,
  label: string,
  rows: { exerciseId: string; sets: LoggedSet[]; volumeKg: number }[],
  byId: Map<string, Exercise>,
  units: Units,
): string {
  const lines = [`${label} · ${formatLongDate(localDate)}`, '']
  for (const row of rows) {
    const name = byId.get(row.exerciseId)?.name ?? 'Unknown movement'
    const sets = row.sets
      .map((s) =>
        s.durationSec
          ? `${Math.round(s.durationSec / 60)} min`
          : `${weightValue(s.weightKg, units)}×${s.reps}`,
      )
      .join(', ')
    lines.push(`${name}  ${sets}`)
  }
  const totalVolume = rows.reduce((sum, r) => sum + r.volumeKg, 0)
  const totalSets = rows.reduce((sum, r) => sum + r.sets.length, 0)
  if (totalSets > 0) {
    lines.push('', `${totalSets} sets · ${formatWeight(totalVolume, units)}`)
  }
  return lines.join('\n')
}
