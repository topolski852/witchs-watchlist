import { v4 as uuid } from 'uuid'
import type { CustomList, Episode, ListEntry, Show } from '../types/schema'
import { bestTitle, hasSequelRelation, pickBestMatch, searchAniList, type AniListMedia } from './anilist'
import { deriveWatchStatus } from './statusRules'
import type { ParsedTvTimeData, RawFavoriteRef } from './tvtimeParse'

export interface ImportProgress {
  phase: 'shows' | 'lists'
  current: number
  total: number
  currentTitle: string
}

export interface ImportPlan {
  shows: Show[]
  customLists: CustomList[]
  matchedCount: number
  unmatchedCount: number
}

function buildEpisodes(totalEpisodes: number | null, episodesSeen: number): Episode[] {
  const count = totalEpisodes ?? episodesSeen
  const episodes: Episode[] = []
  for (let n = 1; n <= count; n++) {
    episodes.push({
      number: n,
      seasonNumber: null,
      watched: n <= episodesSeen,
      watchedAt: null,
      rewatchCount: 0,
      rewatchDates: [],
    })
  }
  return episodes
}

async function matchOne(title: string): Promise<AniListMedia | null> {
  try {
    const candidates = await searchAniList(title)
    return pickBestMatch(title, candidates) ?? candidates[0] ?? null
  } catch {
    return null
  }
}

/**
 * Builds a full import plan from parsed TV Time CSV data: matches every show and
 * favorite-list entry to AniList, applies the status/rewatch heuristics, and
 * returns Show/CustomList records ready for review — nothing is written to the
 * DB here, that happens only after the user confirms on the Review screen.
 */
export async function buildImportPlan(
  data: ParsedTvTimeData,
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportPlan> {
  const now = new Date().toISOString()
  const shows: Show[] = []
  let matchedCount = 0
  let unmatchedCount = 0

  // AniList search results, keyed by normalized title, so favorite-list entries
  // that reference a show we already imported don't trigger a second lookup.
  const matchCache = new Map<string, AniListMedia | null>()

  for (let i = 0; i < data.shows.length; i++) {
    const raw = data.shows[i]
    onProgress?.({ phase: 'shows', current: i + 1, total: data.shows.length, currentTitle: raw.name })

    const matched = await matchOne(raw.name)
    matchCache.set(raw.name, matched)

    const rewatchEpisodes = data.rewatchByShowName.get(raw.name) ?? []
    const episodes = buildEpisodes(matched?.episodes ?? null, raw.episodesSeen)
    let showRewatchCount = 0
    for (const rw of rewatchEpisodes) {
      const ep = episodes.find((e) => e.number === rw.episodeNumber)
      if (ep) {
        ep.rewatchCount = rw.count
        ep.rewatchDates = [rw.updatedAt]
        showRewatchCount = Math.max(showRewatchCount, rw.count)
      }
    }

    const notes: string[] = []
    if (!matched) {
      unmatchedCount++
      notes.push('No confident AniList match found — search and link manually.')
    } else {
      matchedCount++
    }
    if (raw.hadCustomImage) {
      notes.push('Had a custom cover image in TV Time — re-set it here if you want it back.')
    }
    if (rewatchEpisodes.length > 0) {
      notes.push('Rewatch counts estimated from TV Time episode-level data — please verify.')
    }
    if (matched && episodes.length === 0) {
      notes.push('AniList has no episode count for this title yet — episode list left empty.')
    }

    const hasSequel = matched ? hasSequelRelation(matched) : false
    const status = deriveWatchStatus(episodes, hasSequel, raw.archived ? 'stopped' : 'watching')

    shows.push({
      id: uuid(),
      anilistId: matched?.id ?? null,
      title: matched ? bestTitle(matched) : raw.name,
      coverUrl: matched?.coverImage.large ?? null,
      bannerUrl: matched?.bannerImage ?? null,
      customCoverUrl: null,
      format: matched?.format ?? null,
      totalEpisodes: matched?.episodes ?? null,
      episodeDurationMin: matched?.duration ?? null,
      hasSequel,
      status,
      rewatchCount: showRewatchCount,
      episodes,
      needsReview: !matched || rewatchEpisodes.length > 0,
      reviewNote: notes.length > 0 ? notes.join(' ') : null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  const showByTitle = new Map(shows.map((s) => [s.title, s]))

  async function resolveFavoriteEntries(
    refs: RawFavoriteRef[],
    nameOf: (ref: RawFavoriteRef) => string | undefined,
    type: 'anime' | 'movie',
  ): Promise<ListEntry[]> {
    const entries: ListEntry[] = []
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]
      const name = nameOf(ref)
      if (!name) continue
      onProgress?.({ phase: 'lists', current: i + 1, total: refs.length, currentTitle: name })

      const linked = showByTitle.get(name)
      if (linked) {
        entries.push({
          id: uuid(),
          title: linked.title,
          coverUrl: linked.coverUrl,
          anilistId: linked.anilistId,
          type: linked.anilistId ? 'anime' : 'other',
          linkedShowId: linked.id,
          createdAt: now,
        })
        continue
      }

      let matched = matchCache.get(name)
      if (matched === undefined) {
        matched = await matchOne(name)
        matchCache.set(name, matched)
      }
      entries.push({
        id: uuid(),
        title: matched ? bestTitle(matched) : name,
        coverUrl: matched?.coverImage.large ?? null,
        anilistId: matched?.id ?? null,
        type: matched ? type : 'other',
        linkedShowId: null,
        createdAt: now,
      })
    }
    return entries
  }

  const favoriteShowsEntries = await resolveFavoriteEntries(
    data.favoriteSeriesRefs,
    (ref) => (ref.tvdbId ? data.seriesNameByTvdbId.get(ref.tvdbId) : undefined),
    'anime',
  )
  const favoriteMoviesEntries = await resolveFavoriteEntries(
    data.favoriteMovieRefs,
    (ref) => (ref.uuid ? data.movieNameByUuid.get(ref.uuid) : undefined),
    'movie',
  )

  const customLists: CustomList[] = [
    {
      id: uuid(),
      name: 'Favorite Shows',
      entries: favoriteShowsEntries,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      name: 'Favorite Movies',
      entries: favoriteMoviesEntries,
      createdAt: now,
      updatedAt: now,
    },
  ]

  return { shows, customLists, matchedCount, unmatchedCount }
}
