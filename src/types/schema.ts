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
  /** Running total times watched: 0 = never watched, 1 = watched once, 2 = watched twice, etc. */
  watchCount: number
  /** One entry per watch, in order — watchDates.length === watchCount. */
  watchDates: string[]
}

export interface Show {
  id: string
  anilistId: number | null
  title: string
  coverUrl: string | null
  bannerUrl: string | null
  customCoverUrl: string | null
  format: string | null
  totalEpisodes: number | null
  episodeDurationMin: number | null
  /** Does AniList know of a sequel/next season? Decides whether finishing every
   * known episode means "Completed" or "Caught Up" (more is coming). */
  hasSequel: boolean
  status: WatchStatus
  /** Running total times the whole show has been watched (0 = never fully watched). */
  watchCount: number
  episodes: Episode[]
  needsReview: boolean
  reviewNote: string | null
  notes: string | null
  /** "Never" from the mark-through prompt — stops asking to backfill earlier
   * unwatched episodes for shows where that's deliberate (e.g. skipped filler). */
  skipMarkThroughPrompt: boolean
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

export const SCHEMA_VERSION = 2

export interface DataExport {
  schemaVersion: number
  exportedAt: string
  data: {
    shows: Show[]
    customLists: CustomList[]
    meta: Meta
  }
}
