export type WatchStatus =
  | 'watching'
  | 'caught_up'
  | 'completed'
  | 'stopped'
  | 'plan_to_watch'

export const WATCH_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'caught_up', label: 'Caught Up' },
  { value: 'completed', label: 'Completed' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'plan_to_watch', label: 'Plan to Watch' },
]

export interface Episode {
  number: number
  seasonNumber: number | null
  watched: boolean
  watchedAt: string | null
  rewatchCount: number
  rewatchDates: string[]
}

export interface Show {
  id: string
  anilistId: number | null
  title: string
  coverUrl: string | null
  customCoverUrl: string | null
  format: string | null
  totalEpisodes: number | null
  episodeDurationMin: number | null
  /** AniList's airing status (e.g. RELEASING, FINISHED) — used to decide whether
   * finishing all known episodes means "Completed" or just "Caught Up". */
  airingStatus: string | null
  status: WatchStatus
  rewatchCount: number
  episodes: Episode[]
  needsReview: boolean
  reviewNote: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type ListEntryType = 'anime' | 'movie' | 'other'

export interface ListEntry {
  id: string
  title: string
  coverUrl: string | null
  anilistId: number | null
  type: ListEntryType
  linkedShowId: string | null
  createdAt: string
}

export interface CustomList {
  id: string
  name: string
  entries: ListEntry[]
  createdAt: string
  updatedAt: string
}

export interface Meta {
  id: 'meta'
  lastBackupAt: string | null
  lastImportAt: string | null
}

export const SCHEMA_VERSION = 1

export interface DataExport {
  schemaVersion: number
  exportedAt: string
  data: {
    shows: Show[]
    customLists: CustomList[]
    meta: Meta
  }
}
