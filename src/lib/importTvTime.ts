import { v4 as uuid } from 'uuid'
import type { CustomList, Episode, ListEntry, Show } from '../types/schema'
import { bestTitle, buildSeasonChain, hasSequelRelation, pickBestMatch, searchAniList, type AniListMedia } from './anilist'
import { deriveWatchStatus } from './statusRules'
import type { ParsedTvTimeData, RawFavoriteRef, RawRewatchEpisode } from './tvtimeParse'

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

/** Flat episode list for shows with no AniList match at all — there's no
 * season structure to build without AniList's data behind it. */
function buildFlatEpisodes(episodesSeen: number, watchDate: string): Episode[] {
  const episodes: Episode[] = []
  for (let n = 1; n <= episodesSeen; n++) {
    episodes.push({
      number: n,
      seasonNumber: null,
      watchCount: 1,
      watchDates: [watchDate],
      durationMin: null,
      title: null,
      description: null,
      artUrl: null,
    })
  }
  return episodes
}

interface ChainSeasonBuild {
  media: AniListMedia
  episodes: Episode[]
}

/**
 * Builds one independent episode array per AniList season in the chain (see
 * buildSeasonChain in lib/anilist.ts) — each season becomes its own Show, so
 * unlike the show-level continuous numbering this app briefly used, episode
 * numbers restart at 1 per season. TV Time's continuous `episodesSeen` count
 * is still distributed across the chain in watch order (season 1 fills
 * first, then season 2, etc.). If episodesSeen exceeds every known season
 * combined, the remainder is appended as unlabeled episodes onto the last
 * season — surfaced via a review note, never silently dropped or fabricated
 * as fake season data.
 */
function buildEpisodesPerSeason(
  chain: AniListMedia[],
  episodesSeen: number,
  watchDate: string,
): { seasons: ChainSeasonBuild[]; knownTotal: number } {
  const seasons: ChainSeasonBuild[] = []
  let remaining = episodesSeen
  let knownTotal = 0

  chain.forEach((media, idx) => {
    const isLast = idx === chain.length - 1
    // An unknown episode count (e.g. a still-airing final season) absorbs
    // whatever's left rather than being treated as a 0-episode season.
    const count = media.episodes ?? (isLast ? remaining : 0)
    const episodes: Episode[] = []
    for (let n = 1; n <= count; n++) {
      knownTotal++
      const watched = remaining > 0
      episodes.push({
        number: n,
        seasonNumber: null,
        watchCount: watched ? 1 : 0,
        watchDates: watched ? [watchDate] : [],
        durationMin: media.duration,
        title: null,
        description: null,
        artUrl: null,
      })
      if (watched) remaining--
    }
    seasons.push({ media, episodes })
  })

  if (remaining > 0 && seasons.length > 0) {
    const last = seasons[seasons.length - 1]
    let n = last.episodes.length
    for (let i = 0; i < remaining; i++) {
      n++
      last.episodes.push({
        number: n,
        seasonNumber: null,
        watchCount: 1,
        watchDates: [watchDate],
        durationMin: null,
        title: null,
        description: null,
        artUrl: null,
      })
    }
  }

  return { seasons, knownTotal }
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

  // Pass 1: resolve every row's AniList match *before* any season-chain
  // walking. explicitlyTrackedIds is every id TV Time follows as its own row
  // — passed as buildSeasonChain's stopIds so a franchise TV Time already
  // tracks as separate shows (e.g. "Naruto" and "Naruto: Shippuden" are two
  // rows, each with its own episode-seen count, even though AniList links
  // them PREQUEL/SEQUEL) never gets merged into one.
  const matchedByIndex: (AniListMedia | null)[] = []
  for (let i = 0; i < data.shows.length; i++) {
    const raw = data.shows[i]
    onProgress?.({ phase: 'shows', current: i + 1, total: data.shows.length, currentTitle: raw.name })
    const matched = await matchOne(raw.name)
    matchCache.set(raw.name, matched)
    matchedByIndex.push(matched)
  }
  const explicitlyTrackedIds = new Set(matchedByIndex.filter((m): m is AniListMedia => m != null).map((m) => m.id))

  // Season chains, keyed by *every* media id that appears in them, so two
  // TV Time rows that resolve into the same underlying franchise (e.g. one
  // row matching a middle season directly) don't each re-walk the chain.
  const chainCache = new Map<number, AniListMedia[]>()
  async function resolveChain(media: AniListMedia): Promise<AniListMedia[]> {
    const cached = chainCache.get(media.id)
    if (cached) return cached
    const chain = await buildSeasonChain(media, undefined, explicitlyTrackedIds)
    for (const m of chain) chainCache.set(m.id, chain)
    return chain
  }

  // Pass 2: build each show's episodes from its (now stop-id-aware) chain.
  // Each AniList season in the chain becomes its own independent Show — a
  // franchise TV Time tracks as one row with one cumulative episode count
  // (e.g. "Overlord", 52 seen) produces one Show per season (Overlord,
  // Overlord II, III, IV), each with its own episodes/status/AniList id,
  // rather than one merged show with a season breakdown. This was a
  // deliberate simplification after discovering (via direct AniList API
  // queries) that AniList's own streamingEpisodes data can be duplicated
  // across a franchise's separate season ids — splitting lets each season's
  // data be verified independently instead of trusting a merged view.
  for (let i = 0; i < data.shows.length; i++) {
    const raw = data.shows[i]
    onProgress?.({ phase: 'shows', current: i + 1, total: data.shows.length, currentTitle: raw.name })

    const matched = matchedByIndex[i]
    const chain = matched ? await resolveChain(matched) : null
    // TV Time's export has no per-episode watch date, only a per-show
    // "last seen" timestamp — used as every watched episode's date so the
    // Home page's recency shelf (which reads watchDates) actually includes
    // the show, instead of it silently vanishing for having none at all.
    const watchDate = raw.lastSeenAt ?? now
    const rewatchEpisodes = data.rewatchByShowName.get(raw.name) ?? []

    if (!matched || !chain || chain.length === 0) {
      unmatchedCount++
      const episodes = buildFlatEpisodes(raw.episodesSeen, watchDate)
      let showWatchCount = 0
      for (const rw of rewatchEpisodes) {
        const ep = episodes.find((e) => e.number === rw.episodeNumber)
        if (ep) {
          ep.watchCount = Math.max(1, ep.watchCount) + rw.count
          ep.watchDates = [rw.updatedAt]
          showWatchCount = Math.max(showWatchCount, rw.count)
        }
      }
      const notes: string[] = ['No confident AniList match found — search and link manually.']
      if (raw.hadCustomImage) {
        notes.push('Had a custom cover image in TV Time — re-set it here if you want it back.')
      }
      if (rewatchEpisodes.length > 0) {
        notes.push('Rewatch counts estimated from TV Time episode-level data — please verify.')
      }
      shows.push({
        id: uuid(),
        anilistId: null,
        title: raw.name,
        coverUrl: null,
        bannerUrl: null,
        customCoverUrl: null,
        format: null,
        totalEpisodes: episodes.length,
        episodeDurationMin: null,
        hasSequel: false,
        status: deriveWatchStatus(episodes, false, raw.archived ? 'stopped' : 'watching'),
        watchCount: showWatchCount,
        episodes,
        seasons: null,
        needsReview: true,
        reviewNote: notes.join(' '),
        notes: null,
        skipMarkThroughPrompt: false,
        createdAt: now,
        updatedAt: now,
      })
      continue
    }

    matchedCount++
    // TV Time numbers rewatch episodes per-season (episode_number resets
    // each season) — bucket by chain index so each season's own rewatch
    // rows only ever apply to that season's own Show.
    const rewatchByChainIndex = new Map<number, RawRewatchEpisode[]>()
    for (const rw of rewatchEpisodes) {
      const idx = rw.seasonNumber - 1
      const list = rewatchByChainIndex.get(idx) ?? []
      list.push(rw)
      rewatchByChainIndex.set(idx, list)
    }

    const { seasons: builtSeasons, knownTotal } = buildEpisodesPerSeason(chain, raw.episodesSeen, watchDate)
    const seasonSplit = knownTotal < raw.episodesSeen
    const isMultiSeason = chain.length > 1

    builtSeasons.forEach(({ media, episodes }, idx) => {
      const isLast = idx === builtSeasons.length - 1
      const rewatchesForSeason = rewatchByChainIndex.get(idx) ?? []
      let showWatchCount = 0
      for (const rw of rewatchesForSeason) {
        const ep = episodes[rw.episodeNumber - 1]
        if (ep) {
          ep.watchCount = Math.max(1, ep.watchCount) + rw.count
          ep.watchDates = [rw.updatedAt]
          showWatchCount = Math.max(showWatchCount, rw.count)
        }
      }

      const notes: string[] = []
      // TV Time only records one custom-image flag for the whole franchise
      // row, with no way to know which season it applied to — attach it to
      // season 1 as a best-effort guess rather than repeating it everywhere.
      if (idx === 0 && raw.hadCustomImage) {
        notes.push('Had a custom cover image in TV Time — re-set it here if you want it back.')
      }
      if (rewatchesForSeason.length > 0) {
        notes.push('Rewatch counts estimated from TV Time episode-level data — please verify.')
      }
      if (episodes.length === 0) {
        notes.push('AniList has no episode count for this title yet — episode list left empty.')
      }
      if (isMultiSeason) {
        notes.push(
          `Season ${idx + 1} of ${chain.length} in a TV Time entry split across AniList seasons (${chain.map((m) => bestTitle(m)).join(' → ')}) — double-check this season's episode count and progress.`,
        )
      }
      if (isLast && seasonSplit) {
        notes.push(
          `TV Time recorded ${raw.episodesSeen} episodes seen, but AniList only accounts for ${knownTotal} across ${chain.length} known season(s) — the extra ${raw.episodesSeen - knownTotal} were kept as unlabeled episodes on this last season so your watch history isn't lost. This can happen when TV Time's count includes rewatches, or a season AniList doesn't have linked yet.`,
        )
      }

      const hasSequel = hasSequelRelation(media)
      const status = deriveWatchStatus(episodes, hasSequel, raw.archived ? 'stopped' : 'watching')
      const title = bestTitle(media)
      const existing = existingByAnilistId.get(media.id)

      shows.push({
        id: existing?.id ?? uuid(),
        anilistId: media.id,
        title,
        coverUrl: media.coverImage.large,
        bannerUrl: media.bannerImage,
        customCoverUrl: existing?.customCoverUrl ?? null,
        format: media.format,
        totalEpisodes: episodes.length,
        episodeDurationMin: media.duration,
        hasSequel,
        status,
        watchCount: showWatchCount,
        episodes,
        seasons: null,
        needsReview: rewatchesForSeason.length > 0 || (isLast && seasonSplit) || isMultiSeason,
        reviewNote: notes.length > 0 ? notes.join(' ') : null,
        notes: existing?.notes ?? null,
        skipMarkThroughPrompt: existing?.skipMarkThroughPrompt ?? false,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
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

      // Each season is now its own Show keyed by its own AniList id, so a
      // favorite links directly to whichever specific season AniList's
      // search resolved — no chain-root indirection needed.
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
