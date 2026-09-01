import { beforeEach, describe, expect, it } from 'vitest'
import { completeOnboarding, createSettings, getSettings, updateSettings } from './settings'
import { resetDatabase } from '../test/setup'

beforeEach(async () => {
  await resetDatabase()
})

describe('settings CRUD', () => {
  it('createSettings writes a row keyed by deviceId, defaults theme and onboarding state', async () => {
    const settings = await createSettings({ deviceId: 'd1', deviceRole: 'writer', userName: 'Soso' })
    expect(settings.theme).toBe('system')
    expect(settings.onboardingComplete).toBe(false)

    const read = await getSettings('d1')
    expect(read?.userName).toBe('Soso')
    expect(read?.deviceRole).toBe('writer')
  })

  it('updateSettings patches fields without touching deviceId', async () => {
    await createSettings({ deviceId: 'd1', deviceRole: 'writer' })
    await updateSettings('d1', { userName: 'Soso' })
    const read = await getSettings('d1')
    expect(read?.userName).toBe('Soso')
    expect(read?.deviceId).toBe('d1')
  })

  it('completeOnboarding flips onboardingComplete to true', async () => {
    await createSettings({ deviceId: 'd1', deviceRole: 'reader' })
    await completeOnboarding('d1')
    const read = await getSettings('d1')
    expect(read?.onboardingComplete).toBe(true)
  })
})
