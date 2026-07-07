import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CustomList, DataExport, Meta, Show } from '../types/schema'
import { SCHEMA_VERSION } from '../types/schema'
import { migrateShow } from '../lib/legacyMigration'

const DB_NAME = 'witchs-watchlist'
const DB_VERSION = 1
const MAX_BACKUPS = 3

interface BackupRecord {
  id: number
  createdAt: string
  reason: string
  snapshot: DataExport
}

interface WatchlistDB extends DBSchema {
  shows: { key: string; value: Show }
  customLists: { key: string; value: CustomList }
  meta: { key: string; value: Meta }
  backups: { key: number; value: BackupRecord }
}

let dbPromise: Promise<IDBPDatabase<WatchlistDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<WatchlistDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('shows')) {
          db.createObjectStore('shows', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('customLists')) {
          db.createObjectStore('customLists', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true })
        }
      },
    })
  }
  return dbPromise
}

export async function getMeta(): Promise<Meta> {
  const db = await getDb()
  const meta = await db.get('meta', 'meta')
  return meta ?? { id: 'meta', lastBackupAt: null, lastImportAt: null }
}

async function setMeta(patch: Partial<Meta>) {
  const db = await getDb()
  const current = await getMeta()
  await db.put('meta', { ...current, ...patch })
}

export async function getAllShows(): Promise<Show[]> {
  const db = await getDb()
  return db.getAll('shows')
}

export async function getShow(id: string): Promise<Show | undefined> {
  const db = await getDb()
  return db.get('shows', id)
}

export async function putShow(show: Show): Promise<void> {
  const db = await getDb()
  await db.put('shows', show)
}

export async function putShows(shows: Show[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('shows', 'readwrite')
  await Promise.all(shows.map((s) => tx.store.put(s)))
  await tx.done
}

export async function deleteShow(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('shows', id)
}

export async function getAllCustomLists(): Promise<CustomList[]> {
  const db = await getDb()
  return db.getAll('customLists')
}

export async function putCustomList(list: CustomList): Promise<void> {
  const db = await getDb()
  await db.put('customLists', list)
}

export async function putCustomLists(lists: CustomList[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('customLists', 'readwrite')
  await Promise.all(lists.map((l) => tx.store.put(l)))
  await tx.done
}

export async function deleteCustomList(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('customLists', id)
}

/** Full snapshot of everything, in the versioned export envelope. */
export async function buildExport(): Promise<DataExport> {
  const [shows, customLists, meta] = await Promise.all([
    getAllShows(),
    getAllCustomLists(),
    getMeta(),
  ])
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { shows, customLists, meta },
  }
}

/** Keeps only the last MAX_BACKUPS snapshots — the automatic local backup safety net. */
async function rotateBackups(snapshot: DataExport, reason: string) {
  const db = await getDb()
  await db.add('backups', { createdAt: new Date().toISOString(), reason, snapshot } as BackupRecord)
  const all = await db.getAll('backups')
  if (all.length > MAX_BACKUPS) {
    const sorted = all.sort((a, b) => a.id - b.id)
    const toRemove = sorted.slice(0, sorted.length - MAX_BACKUPS)
    const tx = db.transaction('backups', 'readwrite')
    await Promise.all(toRemove.map((b) => tx.store.delete(b.id)))
    await tx.done
  }
  await setMeta({ lastBackupAt: new Date().toISOString() })
}

export async function listBackups(): Promise<BackupRecord[]> {
  const db = await getDb()
  const all = await db.getAll('backups')
  return all.sort((a, b) => b.id - a.id)
}

export async function exportSnapshot(reason = 'manual export'): Promise<DataExport> {
  const snapshot = await buildExport()
  await rotateBackups(snapshot, reason)
  return snapshot
}

export function downloadExport(snapshot: DataExport) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = snapshot.exportedAt.slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `witchs-watchlist-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Migrates an older export forward. Add cases here as schemaVersion increases. */
function migrate(raw: DataExport): DataExport {
  if (raw.schemaVersion === SCHEMA_VERSION) return raw
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `This backup was made with a newer version of the app (schema v${raw.schemaVersion}). Update the app before importing it.`,
    )
  }
  if (raw.schemaVersion < 2) {
    // v1 -> v2: episodes/shows tracked watched + rewatchCount separately;
    // now it's a single running watchCount (see lib/legacyMigration.ts).
    return {
      ...raw,
      schemaVersion: SCHEMA_VERSION,
      data: { ...raw.data, shows: raw.data.shows.map(migrateShow) },
    }
  }
  return raw
}

export interface ImportResult {
  showCount: number
  listCount: number
}

/**
 * Replaces all local data with the contents of a full export. A backup snapshot of
 * whatever was in the DB *before* the import is taken first, so an accidental/bad
 * import is always recoverable from the Backups panel.
 */
export async function importFullSnapshot(raw: DataExport): Promise<ImportResult> {
  const migrated = migrate(raw)
  const db = await getDb()

  const existing = await buildExport()
  if (existing.data.shows.length > 0 || existing.data.customLists.length > 0) {
    await rotateBackups(existing, 'pre-import snapshot')
  }

  const tx = db.transaction(['shows', 'customLists', 'meta'], 'readwrite')
  await tx.objectStore('shows').clear()
  await tx.objectStore('customLists').clear()
  await Promise.all(migrated.data.shows.map((s) => tx.objectStore('shows').put(s)))
  await Promise.all(migrated.data.customLists.map((l) => tx.objectStore('customLists').put(l)))
  await tx.objectStore('meta').put({
    ...migrated.data.meta,
    id: 'meta',
    lastImportAt: new Date().toISOString(),
  })
  await tx.done

  return { showCount: migrated.data.shows.length, listCount: migrated.data.customLists.length }
}

/** Merge-imports (adds/updates) without wiping existing shows/lists — used by the TV Time importer. */
export async function mergeImport(shows: Show[], customLists: CustomList[]): Promise<void> {
  const existing = await buildExport()
  if (existing.data.shows.length > 0 || existing.data.customLists.length > 0) {
    await rotateBackups(existing, 'pre-merge-import snapshot')
  }
  await putShows(shows)
  await putCustomLists(customLists)
  await setMeta({ lastImportAt: new Date().toISOString() })
}

export async function readExportFile(file: File): Promise<DataExport> {
  const text = await file.text()
  const parsed = JSON.parse(text)
  if (typeof parsed?.schemaVersion !== 'number' || !parsed?.data) {
    throw new Error('This file does not look like a Witch\'s Watchlist export.')
  }
  return parsed as DataExport
}
