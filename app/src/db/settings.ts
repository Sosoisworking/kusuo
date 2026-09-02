import { db, type DeviceRole, type Settings, type Units, type WeekStart } from './schema'

const DEVICE_ID_KEY = 'kusuo-device-id'
const RESTORED_PREFERENCES_KEY = 'kusuo-restored-preferences'

/**
 * The half of `Settings` that belongs to the record rather than to the phone,
 * and therefore travels in a backup.
 *
 * `deviceId` and `deviceRole` are deliberately not here: they say which piece
 * of hardware this is and what it is allowed to do, and carrying them would let
 * a file imported onto the Mac claim to be the iPhone. `theme` stays behind for
 * the same reason — it is a property of the screen you are reading on.
 * Everything else describes the history: `trainingHabitId` in particular, whose
 * absence after a restore is why a restored device silently stopped ticking its
 * training habit.
 */
export interface RecordPreferences {
  userName?: string
  units: Units
  weekStart: WeekStart
  trainingHabitId?: string
  defaultSets: number
}

export function recordPreferences(settings: Settings): RecordPreferences {
  return {
    userName: settings.userName,
    units: settings.units,
    weekStart: settings.weekStart,
    trainingHabitId: settings.trainingHabitId,
    defaultSets: settings.defaultSets,
  }
}

/** Device identity lives outside IndexedDB so it survives a wholesale import replace. */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getSettings(deviceId: string): Promise<Settings | undefined> {
  return db.settings.get(deviceId)
}

export interface CreateSettingsInput {
  deviceId: string
  deviceRole: DeviceRole
  userName?: string
}

export async function createSettings(input: CreateSettingsInput): Promise<Settings> {
  // A restore lands before this device has decided what it is — onboarding
  // imports the file and asks the role question afterwards — so the
  // preferences that came with the record are taken up here rather than lost
  // to a settings row that did not exist when they arrived.
  const restored = takeRestoredPreferences()
  const settings: Settings = {
    deviceId: input.deviceId,
    deviceRole: input.deviceRole,
    userName: input.userName ?? restored?.userName,
    theme: 'system',
    units: restored?.units ?? 'kg',
    weekStart: restored?.weekStart ?? 'monday',
    trainingHabitId: restored?.trainingHabitId,
    defaultSets: restored?.defaultSets ?? 3,
    schemaVersion: 1,
    onboardingComplete: false,
  }
  await db.settings.put(settings)
  return settings
}

/**
 * Puts preferences from an imported backup on this device.
 *
 * When the device has no settings row yet they are parked in localStorage
 * beside the deviceId — the same place, and for the same reason: it is the one
 * store an import does not replace. `createSettings` takes them from there.
 */
export async function applyRecordPreferences(prefs: RecordPreferences): Promise<void> {
  const deviceId = getOrCreateDeviceId()
  const existing = await db.settings.get(deviceId)
  if (!existing) {
    localStorage.setItem(RESTORED_PREFERENCES_KEY, JSON.stringify(prefs))
    return
  }
  await db.settings.update(deviceId, { ...prefs })
  forgetRestoredPreferences()
}

function takeRestoredPreferences(): RecordPreferences | undefined {
  const raw = localStorage.getItem(RESTORED_PREFERENCES_KEY)
  if (!raw) return undefined
  forgetRestoredPreferences()
  try {
    return JSON.parse(raw) as RecordPreferences
  } catch {
    // Unreadable is the same as absent: the defaults apply, and nothing here
    // is worth failing a first run over.
    return undefined
  }
}

/** Drops preferences parked by an import this device never finished taking up. */
export function forgetRestoredPreferences(): void {
  localStorage.removeItem(RESTORED_PREFERENCES_KEY)
}

export async function updateSettings(
  deviceId: string,
  changes: Partial<Omit<Settings, 'deviceId'>>,
): Promise<void> {
  await db.settings.update(deviceId, changes)
}

export async function completeOnboarding(deviceId: string): Promise<void> {
  await updateSettings(deviceId, { onboardingComplete: true })
}

/**
 * Signs this device out: its role, name and preferences are forgotten, so the
 * next launch asks the first-run questions again.
 *
 * This is not a reset. Nothing in the record is read or written here — habits,
 * sessions, goals and reflections are the history, not the sign-in, and they
 * survive untouched. The deviceId in localStorage is kept for the same reason
 * reset keeps it: it identifies the hardware rather than the record, and
 * reusing it keeps the authorship on every event already logged consistent.
 */
export async function signOutDevice(deviceId: string): Promise<void> {
  await db.settings.delete(deviceId)
}
