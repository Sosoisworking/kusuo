import { describe, expect, it } from 'vitest'
import { shouldAskForBackup } from './backupNotice'

const SINCE = 1_000_000

describe('asking for a backup before the migration', () => {
  it('asks the phone when it has never exported', () => {
    expect(shouldAskForBackup({ deviceRole: 'writer' }, SINCE)).toBe(true)
  })

  it('asks when the last export predates the notice', () => {
    expect(shouldAskForBackup({ deviceRole: 'writer', lastBackupAt: SINCE - 1 }, SINCE)).toBe(true)
  })

  it('stops asking once an export is recorded after the notice', () => {
    expect(shouldAskForBackup({ deviceRole: 'writer', lastBackupAt: SINCE }, SINCE)).toBe(false)
  })

  it('stops asking once dismissed, whatever the export says', () => {
    expect(
      shouldAskForBackup({ deviceRole: 'writer', backupNoticeDismissedAt: SINCE + 5 }, SINCE),
    ).toBe(false)
  })

  it('never asks the Mac, which holds no record of its own', () => {
    expect(shouldAskForBackup({ deviceRole: 'reader' }, SINCE)).toBe(false)
  })
})
