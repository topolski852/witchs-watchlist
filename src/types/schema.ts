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
  /** Per-episode override in minutes — null means "use the show's
   * episodeDurationMin". Lets custom shows with uneven episode lengths
   * (e.g. RWBY's short early volumes vs. later normal-length ones) be set
   * per season instead of forcing one duration across the whole show. */
  durationMin: number | null
  /** Custom-show-only episode title override — null falls back to the
   * AniList streaming-title lookup (or "Episode N") used elsewhere. */
  title: string | null
  description: string | null
  artUrl: string | null
}

export interface SeasonMeta {
  number: number
  name: string | null
  bannerUrl: string | null
  /** Set when this season came from a specific entry in an AniList "season
   * chain" (e.g. My Hero Academia Season 2) — lets episode lookups (titles,
   * thumbnails) use that season's own AniList data instead of the show's
   * top-level anilistId. Null for custom shows and single-entry AniList shows. */
  anilistId: number | null
  /** That same AniList entry's MyAnimeList id, if AniList knows it — used as
   * a fallback episode-title source (see lib/jikan.ts) when AniList's own
   * per-season data is missing or comes back duplicated across seasons. */
  malId: number | null
}

export interface Show {
  id: string
  anilistId: number | null
  /** That same AniList entry's MyAnimeList id, if AniList knows it — same
   * fallback purpose as SeasonMeta.malId, for shows with no season split. */
  malId: number | null
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
  /** Per-season name/banner/AniList-id metadata — set for custom shows with
   * a season split, and for AniList-backed shows chained across multiple
   * AniList seasons (see lib/anilist.ts's buildSeasonChain). Null otherwise. */
  seasons: SeasonMeta[] | null
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
