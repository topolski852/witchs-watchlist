import type { Episode, SeasonMeta, Show } from '../types/schema'

// Pre-v2 shape: episodes tracked `watched`/`rewatchCount` separately, and a
// show's `rewatchCount` meant "extra rewatches beyond the first," not an
// absolute count. These functions take `unknown` (rather than Show) because
// the whole point is handling data read from IndexedDB or an old export file
// that predates the current type and won't actually match it at runtime.
interface LegacyEpisode {
  number: number
  seasonNumber: number | null
  watched?: boolean
  watchedAt?: string | null
  rewatchCount?: number
  rewatchDates?: string[]
  watchCount?: number
  watchDates?: string[]
  durationMin?: number | null
  title?: string | null
  description?: string | null
  artUrl?: string | null
}

interface LegacyShow {
  rewatchCount?: number
  watchCount?: number
  episodes: LegacyEpisode[]
  seasons?: SeasonMeta[] | null
  [key: string]: unknown
}

function migrateEpisode(ep: LegacyEpisode): Episode {
  if (typeof ep.watchCount === 'number') {
    return {
      number: ep.number,
      seasonNumber: ep.seasonNumber,
      watchCount: ep.watchCount,
      watchDates: ep.watchDates ?? [],
      durationMin: ep.durationMin ?? null,
      title: ep.title ?? null,
      description: ep.description ?? null,
      artUrl: ep.artUrl ?? null,
    }
  }
  const watchCount = (ep.watched ? 1 : 0) + (ep.rewatchCount ?? 0)
  const watchDates = ep.watchedAt ? [ep.watchedAt, ...(ep.rewatchDates ?? [])] : (ep.rewatchDates ?? [])
  return {
    number: ep.number,
    seasonNumber: ep.seasonNumber,
    watchCount,
    watchDates,
    durationMin: null,
    title: null,
    description: null,
    artUrl: null,
  }
}

/** True if this show still uses the pre-v2 watched/rewatchCount shape. */
export function isLegacyShow(raw: unknown): boolean {
  const show = raw as LegacyShow
  return typeof show.watchCount !== 'number'
}

/** Idempotent — already-migrated shows pass through unchanged. */
export function migrateShow(raw: unknown): Show {
  const show = raw as LegacyShow
  const watchCount = typeof show.watchCount === 'number' ? show.watchCount : (show.rewatchCount ?? 0)
  return {
    ...show,
    watchCount,
    episodes: show.episodes.map(migrateEpisode),
    seasons: show.seasons ?? null,
  } as Show
}
