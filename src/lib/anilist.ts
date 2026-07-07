const ANILIST_ENDPOINT = 'https://graphql.anilist.co'

export interface AniListMedia {
  id: number
  title: { romaji: string | null; english: string | null; native: string | null }
  coverImage: { large: string | null; extraLarge: string | null }
  format: string | null
  status: string | null
  episodes: number | null
  duration: number | null
  synonyms: string[]
  relations: { edges: { relationType: string; node: { id: number; type: string } | null }[] } | null
}

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge }
  format
  status
  episodes
  duration
  synonyms
  relations {
    edges {
      relationType
      node { id type }
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
