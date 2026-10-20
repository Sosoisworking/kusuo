import type { Settings } from '../db/schema'

/**
 * When this notice first shipped: local midnight, 20 October 2026. An export
 * from before then predates the warning, so it doesn't count.
 *
 * The next training release migrates every split and logged set into a new
 * shape. The migration is tested against real data, but this phone holds the
 * only copy of the record, so the release before it asks for a fresh export.
 */
export const BACKUP_NOTICE_SINCE = new Date(2026, 9, 20).getTime()

/**
 * Whether Today should ask for an export before the migration.
 *
 * It goes away by itself once an export is recorded after the notice shipped.
 * It can also be dismissed, because in the installed app an export opens iOS's
 * preview and is never recorded: someone who saved the file by hand would
 * otherwise be asked forever. Dismissing records only that the notice was
 * dismissed, never that a backup exists.
 */
export function shouldAskForBackup(
  settings: Pick<Settings, 'deviceRole' | 'lastBackupAt' | 'backupNoticeDismissedAt'>,
  since: number = BACKUP_NOTICE_SINCE,
): boolean {
  if (settings.deviceRole !== 'writer') return false
  if (settings.backupNoticeDismissedAt !== undefined) return false
  return settings.lastBackupAt === undefined || settings.lastBackupAt < since
}
