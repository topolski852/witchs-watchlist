const ANILIST_ENDPOINT = 'https://graphql.anilist.co'

export interface AniListMedia {
  id: number
  idMal: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { large: string | null; extraLarge: string | null }
  bannerImage: string | null
  format: string | null
  status: string | null
  episodes: number | null
  duration: number | null
  synonyms: string[]
  relations: { edges: { relationType: string; node: { id: number; type: string; format: string | null } | null }[] } | null
}

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { large extraLarge }
  bannerImage
  format
  status
  episodes
  duration
  synonyms
  relations {
    edges {
      relationType
      node { id type format }
    }
  }
`

const SEARCH_QUERY = `
query ($search: String, $page: Int) {
  Page(page: $page, perPage: 8) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      ${MEDIA_FIELDS}
    }
  }
}`

const BY_ID_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    ${MEDIA_FIELDS}
  }
}`

export interface AniListDetails {
  description: string | null
  genres: string[]
  averageScore: number | null
  season: string | null
  seasonYear: number | null
  source: string | null
  studios: string[]
  startDate: { year: number | null; month: number | null; day: number | null } | null
  endDate: { year: number | null; month: number | null; day: number | null } | null
}

const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    description(asHtml: false)
    genres
    averageScore
    season
    seasonYear
    source
    studios(isMain: true) { nodes { name } }
    startDate { year month day }
    endDate { year month day }
  }
}`

// AniList's public API is rate-limited, and has been running in a "degraded"
// mode (unofficially ~30 req/min) for a long time. Getting rate-limited hard
// enough trips Cloudflare in front of it, which then blocks *every* request
// for a while with an opaque CORS failure (no 429, no retry-after header —
// fetch() just throws). A fixed delay isn't enough to recover from that once
// it happens, so the gap between requests adapts: it grows on any failure
// (rate-limited or CORS-blocked) and slowly relaxes back down on success.
let queueTail: Promise<unknown> = Promise.resolve()
const MIN_GAP_MS = 2200
const MAX_GAP_MS = 60_000
let currentGapMs = MIN_GAP_MS

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    await new Promise((r) => setTimeout(r, currentGapMs))
    return fn()
  })
  // Swallow so one failed request doesn't wedge the queue for the next caller.
  queueTail = run.catch(() => undefined)
  return run
}

const MAX_ATTEMPTS = 6

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(ANILIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      })
      if (res.status === 429 || res.status === 403 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after') ?? '0')
        currentGapMs = Math.min(MAX_GAP_MS, Math.max(currentGapMs * 2, retryAfter * 1000))
        await new Promise((r) => setTimeout(r, currentGapMs))
        continue
      }
      if (!res.ok) {
        throw new Error(`AniList request failed: ${res.status}`)
      }
      const json = await res.json()
      if (json.errors) {
        throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '))
      }
      // success — let the gap relax back toward the floor over time
      currentGapMs = Math.max(MIN_GAP_MS, Math.round(currentGapMs * 0.85))
      return json.data
    } catch (err) {
      lastError = err
      // fetch() throws a plain TypeError for CORS/opaque blocks (Cloudflare
      // challenge pages omit CORS headers) — treat that the same as a 429.
      currentGapMs = Math.min(MAX_GAP_MS, currentGapMs * 2)
      await new Promise((r) => setTimeout(r, currentGapMs))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AniList request failed after retries')
}

export function searchAniList(search: string): Promise<AniListMedia[]> {
  return enqueue(async () => {
    const data = await graphql<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, {
      search,
      page: 1,
    })
    return data.Page.media
  })
}

export function getAniListById(id: number): Promise<AniListMedia | null> {
  return enqueue(async () => {
    const data = await graphql<{ Media: AniListMedia | null }>(BY_ID_QUERY, { id })
    return data.Media
  })
}

interface RawDetails {
  description: string | null
  genres: string[]
  averageScore: number | null
  season: string | null
  seasonYear: number | null
  source: string | null
  studios: { nodes: { name: string }[] }
  startDate: AniListDetails['startDate']
  endDate: AniListDetails['endDate']
}

/**
 * Fetched lazily (only when a show's About panel is opened) rather than
 * stored on every Show record — descriptions/tags are the heaviest fields
 * AniList returns, and most of the 482 shows in a library will never have
 * this panel opened, so keeping it out of the main schema keeps storage tiny.
 */
export function getAniListDetails(id: number): Promise<AniListDetails | null> {
  return enqueue(async () => {
    const data = await graphql<{ Media: RawDetails | null }>(DETAILS_QUERY, { id })
    if (!data.Media) return null
    return { ...data.Media, studios: data.Media.studios.nodes.map((n) => n.name) }
  })
}

export interface StreamingEpisode {
  title: string | null
  thumbnail: string | null
}

const STREAMING_EPISODES_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    streamingEpisodes { title thumbnail }
  }
}`

/** True for a title like "Episode 1 - ..." or exactly "Episode 1" — careful
 * not to also match "Episode 10", "Episode 12", etc. */
function isEpisodeOne(title: string | null | undefined): boolean {
  return /^Episode\s+1(?!\d)/i.test((title ?? '').trim())
}

/**
 * Per-episode title + thumbnail, sourced from streaming-site listings AniList
 * aggregates (Crunchyroll etc.) — coverage isn't guaranteed for every show,
 * and there's no explicit episode-number field, so array order is the best
 * available signal for which episode a given entry represents. Fetched
 * lazily (only when a show's episode list is opened), not persisted to the
 * schema, for the same storage-size reason as getAniListDetails.
 *
 * Confirmed against real data that this isn't always a clean, position-0,
 * episode-1-first list:
 * - Kill la Kill's list has two promo-video entries ("PV 1", "PV 2") before
 *   "Episode 1" — real, correctly-ordered episode data, just not starting
 *   at index 0. Sliced to start from wherever "Episode 1" actually is.
 * - One Piece's entry (still airing, 1000+ real episodes) only had a
 *   69-entry *recent* window cached, starting at "Episode 130", with no
 *   "Episode 1" anywhere in it — indexed by position, that would show
 *   episode 130's title as if it were episode 1. When no entry is actually
 *   "Episode 1", the whole list is unusable for position-based lookup and
 *   gets discarded — a real-looking but wrong title is worse than the
 *   honest "Episode N" fallback.
 */
// Keyed by AniList id so revisiting the same show's episode list (or two
// seasons that happen to share an id) reuses one in-flight/resolved request
// instead of re-queuing a duplicate on the shared, rate-limited queue — every
// remount of EpisodeList previously did exactly that. A failed request is
// evicted so it gets retried on next access rather than being cached forever.
const streamingEpisodesCache = new Map<number, Promise<StreamingEpisode[]>>()

export function getStreamingEpisodes(id: number): Promise<StreamingEpisode[]> {
  const cached = streamingEpisodesCache.get(id)
  if (cached) return cached
  const promise = enqueue(async () => {
    const data = await graphql<{ Media: { streamingEpisodes: StreamingEpisode[] } | null }>(
      STREAMING_EPISODES_QUERY,
      { id },
    )
    const episodes = data.Media?.streamingEpisodes ?? []
    const startIndex = episodes.findIndex((e) => isEpisodeOne(e.title))
    return startIndex === -1 ? [] : episodes.slice(startIndex)
  })
  promise.catch(() => streamingEpisodesCache.delete(id))
  streamingEpisodesCache.set(id, promise)
  return promise
}

/** "Episode 3 - Actual Title" -> "Actual Title", falling back to "Episode N"
 * when there's no streaming title for that slot. */
export function streamingEpisodeTitle(number: number, streaming: StreamingEpisode | undefined): string {
  const raw = streaming?.title?.trim()
  if (!raw) return `Episode ${number}`
  const dashSplit = raw.match(/^Episode\s+\d+\s*[-–]\s*(.+)$/i)
  return dashSplit ? dashSplit[1] : raw
}

/**
 * Whether AniList knows of a sequel (another season/part continuing the
 * story) for this entry — used to decide Caught Up (more is coming) vs.
 * Completed (as far as we know, this is the end) once every episode we have
 * is watched. Absence of a sequel relation isn't proof one will never be
 * announced, but it's the best signal available, and it matches the "default
 * to Completed when we don't know" preference.
 */
export function hasSequelRelation(media: AniListMedia): boolean {
  return media.relations?.edges.some((e) => e.relationType === 'SEQUEL' && e.node?.type === 'ANIME') ?? false
}

// Only follow relation edges into another numbered TV season of the same
// story. Confirmed against real data that AniList occasionally tags a
// one-off ONA/OVA/special as PREQUEL/SEQUEL too (e.g. "One Piece" has a
// PREQUEL edge to an unrelated one-episode ONA short) — TV-only avoids
// wandering into those.
const CHAIN_FORMATS = new Set(['TV'])
const MAX_CHAIN_HOPS = 20

function chainEdge(media: AniListMedia, type: 'PREQUEL' | 'SEQUEL', stopIds: Set<number>) {
  return media.relations?.edges.find(
    (e) =>
      e.relationType === type &&
      e.node?.type === 'ANIME' &&
      e.node.format != null &&
      CHAIN_FORMATS.has(e.node.format) &&
      !stopIds.has(e.node.id),
  )
}

/**
 * TV Time (and most trackers) count episodes continuously across a whole
 * franchise, but AniList gives each season its own separate media entry
 * (e.g. "My Hero Academia" Season 1 is a distinct 13-episode entry from
 * Season 2). Starting from *any* entry in the franchise — even if search
 * matched a middle or final season — this walks AniList's PREQUEL relations
 * back to the true first season, then SEQUEL relations forward, returning
 * every season in watch order. `fetchById` is injected so this stays
 * testable/reusable without hardcoding the rate-limited network call.
 *
 * `stopIds` are AniList ids the walk must never cross into — confirmed
 * against real data that TV Time sometimes tracks what AniList considers
 * sequel seasons as entirely separate followed shows with their own
 * independent progress (e.g. "Naruto" and "Naruto: Shippuden" are two rows
 * in a TV Time export, each with its own episode-seen count, even though
 * AniList links them PREQUEL/SEQUEL). Without this, importing either row
 * would silently absorb the other's episodes into one merged show and
 * overwrite whichever was imported second. Callers pass every AniList id
 * that has its own explicit TV Time row (other than the one being walked).
 */
export async function buildSeasonChain(
  start: AniListMedia,
  fetchById: (id: number) => Promise<AniListMedia | null> = getAniListById,
  stopIds: Set<number> = new Set(),
): Promise<AniListMedia[]> {
  const visited = new Map<number, AniListMedia>([[start.id, start]])
  async function fetchNode(id: number): Promise<AniListMedia | null> {
    const existing = visited.get(id)
    if (existing) return existing
    const media = await fetchById(id)
    if (media) visited.set(id, media)
    return media
  }

  let root = start
  for (let i = 0; i < MAX_CHAIN_HOPS; i++) {
    const edge = chainEdge(root, 'PREQUEL', stopIds)
    if (!edge?.node) break
    const prev = await fetchNode(edge.node.id)
    if (!prev || prev.id === root.id) break
    root = prev
  }

  const chain: AniListMedia[] = [root]
  let cur = root
  for (let i = 0; i < MAX_CHAIN_HOPS; i++) {
    const edge = chainEdge(cur, 'SEQUEL', stopIds)
    if (!edge?.node) break
    const next = await fetchNode(edge.node.id)
    if (!next || chain.some((m) => m.id === next.id)) break
    chain.push(next)
    cur = next
  }
  return chain
}

export function bestTitle(media: AniListMedia): string {
  return media.title.english ?? media.title.romaji ?? media.title.native ?? `AniList #${media.id}`
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Picks the best AniList match for a TV Time show title, or null if nothing is
 * confident enough. Confident = exact (normalized) match on English/romaji title
 * or a listed synonym.
 */
export function pickBestMatch(query: string, candidates: AniListMedia[]): AniListMedia | null {
  const target = normalizeTitle(query)
  for (const media of candidates) {
    const names = [media.title.english, media.title.romaji, media.title.native, ...media.synonyms]
      .filter((n): n is string => Boolean(n))
      .map(normalizeTitle)
    if (names.includes(target)) return media
  }
  return null
}
