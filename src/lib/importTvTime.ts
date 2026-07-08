import { v4 as uuid } from 'uuid'
import type { CustomList, Episode, ListEntry, SeasonMeta, Show } from '../types/schema'
import { bestTitle, buildSeasonChain, hasSequelRelation, pickBestMatch, searchAniList, type AniListMedia } from './anilist'
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

interface BuiltEpisodes {
  episodes: Episode[]
  seasons: SeasonMeta[] | null
  /** How many episodes AniList's season chain actually accounts for — used
   * to detect when TV Time recorded more than every known season combined. */
  knownTotal: number
}

/** Flat single-"season" fallback for shows with no AniList match at all —
 * there's no season structure to build without AniList's data behind it. */
function buildFlatEpisodes(episodesSeen: number): BuiltEpisodes {
  const episodes: Episode[] = []
  for (let n = 1; n <= episodesSeen; n++) {
    episodes.push({
      number: n,
      seasonNumber: null,
      watchCount: 1,
      watchDates: [],
      durationMin: null,
      title: null,
      description: null,
      artUrl: null,
    })
  }
  return { episodes, seasons: null, knownTotal: episodes.length }
}

/**
 * Builds one show's full episode/season list from its AniList season chain
 * (see buildSeasonChain in lib/anilist.ts) — TV Time's continuous
 * `episodesSeen` count is distributed across the chain in watch order (season
 * 1 fills first, then season 2, etc.), so a show that's actually 8 AniList
 * seasons gets one correctly-ordered episode list instead of being capped at
 * whichever single season search happened to match. If episodesSeen exceeds
 * every known season combined, the remainder is appended as unlabeled
 * episodes onto the last season — surfaced via a review note, never
 * silently dropped or silently fabricated as fake season data.
 */
function buildEpisodesFromChain(chain: AniListMedia[], episodesSeen: number): BuiltEpisodes {
  const episodes: Episode[] = []
  const seasons: SeasonMeta[] = []
  let remaining = episodesSeen
  let globalNumber = 0

  chain.forEach((media, idx) => {
    const seasonNumber = idx + 1
    const isLast = idx === chain.length - 1
    // An unknown episode count (e.g. a still-airing final season) absorbs
    // whatever's left rather than being treated as a 0-episode season.
    const count = media.episodes ?? (isLast ? remaining : 0)
    seasons.push({ number: seasonNumber, name: bestTitle(media), bannerUrl: media.bannerImage, anilistId: media.id })
    for (let n = 1; n <= count; n++) {
      globalNumber++
      const watched = remaining > 0
      episodes.push({
        number: globalNumber,
        seasonNumber,
        watchCount: watched ? 1 : 0,
        watchDates: [],
        durationMin: media.duration,
        title: null,
        description: null,
        artUrl: null,
      })
      if (watched) remaining--
    }
  })

  const knownTotal = globalNumber
  if (remaining > 0) {
    const lastSeason = seasons[seasons.length - 1]?.number ?? 1
    for (let i = 0; i < remaining; i++) {
      globalNumber++
      episodes.push({
        number: globalNumber,
        seasonNumber: lastSeason,
        watchCount: 1,
        watchDates: [],
        durationMin: null,
        title: null,
        description: null,
        artUrl: null,
      })
    }
  }

  return { episodes, seasons, knownTotal }
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

  // Season chains, keyed by *every* media id that appears in them, so a
  // favorite-list entry matching a different season of a show already in the
  // main list still resolves to the same chain/root instead of re-walking it
  // (or worse, treating it as a different show).
  const chainCache = new Map<number, AniListMedia[]>()
  async function resolveChain(media: AniListMedia): Promise<AniListMedia[]> {
    const cached = chainCache.get(media.id)
    if (cached) return cached
    const chain = await buildSeasonChain(media, undefined, explicitlyTrackedIds)
    for (const m of chain) chainCache.set(m.id, chain)
    return chain
  }

  // Pass 2: build each show's episodes/seasons from its (now stop-id-aware) chain.
  for (let i = 0; i < data.shows.length; i++) {
    const raw = data.shows[i]
    onProgress?.({ phase: 'shows', current: i + 1, total: data.shows.length, currentTitle: raw.name })

    const matched = matchedByIndex[i]
    const chain = matched ? await resolveChain(matched) : null
    const root = chain?.[0] ?? null
    const chainEnd = chain ? chain[chain.length - 1] : null
    const built = chain ? buildEpisodesFromChain(chain, raw.episodesSeen) : buildFlatEpisodes(raw.episodesSeen)
    const { episodes, seasons, knownTotal } = built

    const rewatchEpisodes = data.rewatchByShowName.get(raw.name) ?? []
    let showWatchCount = 0
    for (const rw of rewatchEpisodes) {
      // TV Time numbers episodes per-season (episode_number resets each
      // season), not continuously — so a chain-built show has to match on
      // (season, in-season position), not the show's global sequential number.
      const ep = seasons
        ? episodes.filter((e) => e.seasonNumber === rw.seasonNumber)[rw.episodeNumber - 1]
        : episodes.find((e) => e.number === rw.episodeNumber)
      if (ep) {
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
    if (chain && chain.length > 1) {
      notes.push(
        `Matched across ${chain.length} AniList seasons (${chain.map((m) => bestTitle(m)).join(' → ')}) — double-check the season breakdown looks right.`,
      )
    }
    const seasonSplit = matched != null && knownTotal < raw.episodesSeen
    if (seasonSplit) {
      notes.push(
        `TV Time recorded ${raw.episodesSeen} episodes seen, but AniList only accounts for ${knownTotal} across ${chain?.length ?? 1} known season(s) — the extra ${raw.episodesSeen - knownTotal} were kept as unlabeled episodes on the last season so your watch history isn't lost. This can happen when TV Time's count includes rewatches, or a season AniList doesn't have linked yet.`,
      )
    }

    const hasSequel = chainEnd ? hasSequelRelation(chainEnd) : false
    const status = deriveWatchStatus(episodes, hasSequel, raw.archived ? 'stopped' : 'watching')

    const title = root ? bestTitle(root) : raw.name
    const existing = root ? existingByAnilistId.get(root.id) : undefined

    shows.push({
      id: existing?.id ?? uuid(),
      anilistId: root?.id ?? null,
      title,
      coverUrl: root?.coverImage.large ?? null,
      bannerUrl: root?.bannerImage ?? null,
      customCoverUrl: existing?.customCoverUrl ?? null,
      format: root?.format ?? null,
      totalEpisodes: episodes.length,
      episodeDurationMin: root?.duration ?? null,
      hasSequel,
      status,
      watchCount: showWatchCount,
      episodes,
      seasons,
      needsReview: !matched || rewatchEpisodes.length > 0 || seasonSplit || (chain?.length ?? 0) > 1,
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

      // Resolve to the same chain root the main show list would have used,
      // so a favorite matching e.g. a final-season entry still links to the
      // show that's keyed by its season-1 AniList id.
      const root = matched ? (await resolveChain(matched))[0] : null
      const linkedByAnilistId = root ? showByAnilistId.get(root.id) : undefined
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
        title: root ? bestTitle(root) : name,
        coverUrl: root?.coverImage.large ?? null,
        anilistId: root?.id ?? null,
        type: root ? type : 'other',
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
