import { db, type DeviceRole, type Settings } from './schema'

const DEVICE_ID_KEY = 'kusuo-device-id'

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
  const settings: Settings = {
    deviceId: input.deviceId,
    deviceRole: input.deviceRole,
    userName: input.userName,
    theme: 'system',
    units: 'kg',
    weekStart: 'monday',
    schemaVersion: 1,
    onboardingComplete: false,
  }
  await db.settings.put(settings)
  return settings
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
