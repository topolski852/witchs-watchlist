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

/**
 * AniList splits long-running/seasonal anime into multiple separate media
 * entries (e.g. "My Hero Academia" Season 1 is its own entry with 13
 * episodes, entirely separate from Season 2+), while TV Time counted
 * episodes continuously across every season under one followed show. If the
 * matched AniList entry's episode count is smaller than what TV Time
 * recorded as seen, using it as the cap would silently truncate the episode
 * list and throw away real watch history/time — so the *larger* of the two
 * numbers always wins here. The show still only links to one AniList entry
 * (this data model doesn't support multi-season splits), so the extra
 * episodes beyond the matched entry's own count are unlabeled placeholders;
 * `needsReview` flags this in buildImportPlan so it's visible, not silent.
 */
function buildEpisodes(totalEpisodes: number | null, episodesSeen: number): Episode[] {
  const count = Math.max(totalEpisodes ?? 0, episodesSeen)
  const episodes: Episode[] = []
  for (let n = 1; n <= count; n++) {
    episodes.push({
      number: n,
      seasonNumber: null,
      watchCount: n <= episodesSeen ? 1 : 0,
      watchDates: [],
      durationMin: null,
      title: null,
      description: null,
      artUrl: null,
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
 *
 * `existingShows`/`existingLists` let re-running an import (e.g. after a bug
 * fix, or a fresh TV Time export) update shows/lists already in the watchlist
 * in place instead of creating duplicates: a match reuses the existing
 * show/list's id (and the show's createdAt/notes/customCoverUrl/
 * skipMarkThroughPrompt, so manual edits since the last import survive),
 * while episode/watch data is rebuilt fresh from this import. Anything not
 * matched here (custom shows, unrelated lists) is left completely alone —
 * this function only ever returns shows/lists to upsert, never a deletion.
 */
export async function buildImportPlan(
  data: ParsedTvTimeData,
  onProgress?: (p: ImportProgress) => void,
  existingShows: Show[] = [],
  existingLists: CustomList[] = [],
): Promise<ImportPlan> {
  const now = new Date().toISOString()
  const shows: Show[] = []
  let matchedCount = 0
  let unmatchedCount = 0

  // Reconciling by AniList id only (never by title) is deliberate: a custom,
  // hand-built show (e.g. one with no AniList match, given its own seasons/
  // episode art) also has anilistId: null, and could easily share a title
  // with an unmatched TV Time row — matching on title risks silently
  // overwriting real hand-entered data with a fresh import. Matching only on
  // a non-null AniList id can never hit a custom show.
  const existingByAnilistId = new Map(
    existingShows.filter((s): s is Show & { anilistId: number } => s.anilistId != null).map((s) => [s.anilistId, s]),
  )

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
    let showWatchCount = 0
    for (const rw of rewatchEpisodes) {
      const ep = episodes.find((e) => e.number === rw.episodeNumber)
      if (ep) {
        // rw.count is TV Time's rewatch tally (repeat views beyond the first) —
        // the running count is that plus the first watch itself.
        ep.watchCount = Math.max(1, ep.watchCount) + rw.count
        ep.watchDates = [rw.updatedAt]
        showWatchCount = Math.max(showWatchCount, rw.count)
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
    // The AniList season-split case buildEpisodes compensates for — flag it
    // so it's visible rather than a silently-inflated episode count.
    const seasonSplit = matched?.episodes != null && matched.episodes < raw.episodesSeen
    if (seasonSplit) {
      notes.push(
        `TV Time recorded ${raw.episodesSeen} episodes seen, but the matched AniList entry only lists ${matched!.episodes} — it likely only covers one season of this show. Episode count was kept at ${raw.episodesSeen} to preserve your watch history; verify the episode list and consider re-linking to a different AniList entry if one covers the full series.`,
      )
    }

    const hasSequel = matched ? hasSequelRelation(matched) : false
    const status = deriveWatchStatus(episodes, hasSequel, raw.archived ? 'stopped' : 'watching')

    const title = matched ? bestTitle(matched) : raw.name
    const existing = matched ? existingByAnilistId.get(matched.id) : undefined

    shows.push({
      id: existing?.id ?? uuid(),
      anilistId: matched?.id ?? null,
      title,
      coverUrl: matched?.coverImage.large ?? null,
      bannerUrl: matched?.bannerImage ?? null,
      customCoverUrl: existing?.customCoverUrl ?? null,
      format: matched?.format ?? null,
      totalEpisodes: episodes.length,
      episodeDurationMin: matched?.duration ?? null,
      hasSequel,
      status,
      watchCount: showWatchCount,
      episodes,
      seasons: existing?.seasons ?? null,
      needsReview: !matched || rewatchEpisodes.length > 0 || seasonSplit,
      reviewNote: notes.length > 0 ? notes.join(' ') : null,
      notes: existing?.notes ?? null,
      skipMarkThroughPrompt: existing?.skipMarkThroughPrompt ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  }

  const showByTitle = new Map(shows.map((s) => [s.title, s]))
  // TV Time's raw title ("Frieren") often doesn't match AniList's resolved
  // title ("Frieren: Beyond Journey's End") as a plain string, so the title
  // lookup above misses even when the show is already in the list — anilistId
  // is the reliable key once a fresh search below re-resolves the same entry.
  const showByAnilistId = new Map(
    shows.filter((s): s is Show & { anilistId: number } => s.anilistId != null).map((s) => [s.anilistId, s]),
  )

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

      const linkedByAnilistId = matched ? showByAnilistId.get(matched.id) : undefined
      if (linkedByAnilistId) {
        entries.push({
          id: uuid(),
          title: linkedByAnilistId.title,
          coverUrl: linkedByAnilistId.coverUrl,
          anilistId: linkedByAnilistId.anilistId,
          type: 'anime',
          linkedShowId: linkedByAnilistId.id,
          createdAt: now,
        })
        continue
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

  const existingListByName = new Map(existingLists.map((l) => [l.name, l]))
  const existingFavoriteShows = existingListByName.get('Favorite Shows')
  const existingFavoriteMovies = existingListByName.get('Favorite Movies')

  const customLists: CustomList[] = [
    {
      id: existingFavoriteShows?.id ?? uuid(),
      name: 'Favorite Shows',
      entries: favoriteShowsEntries,
      createdAt: existingFavoriteShows?.createdAt ?? now,
      updatedAt: now,
    },
    {
      id: existingFavoriteMovies?.id ?? uuid(),
      name: 'Favorite Movies',
      entries: favoriteMoviesEntries,
      createdAt: existingFavoriteMovies?.createdAt ?? now,
      updatedAt: now,
    },
  ]

  return { shows, customLists, matchedCount, unmatchedCount }
}
