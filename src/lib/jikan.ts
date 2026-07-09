const JIKAN_ENDPOINT = 'https://api.jikan.moe/v4'

export interface MalEpisode {
  number: number
  title: string | null
}

// Jikan (MyAnimeList's unofficial API) is a separate service from AniList,
// with much more generous documented limits (~3 req/sec, 60/min) — its own
// lightweight queue rather than sharing AniList's slow adaptive one.
let queueTail: Promise<unknown> = Promise.resolve()
const GAP_MS = 500

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    await new Promise((r) => setTimeout(r, GAP_MS))
    return fn()
  })
  queueTail = run.catch(() => undefined)
  return run
}

interface JikanEpisodesResponse {
  data: { mal_id: number; title: string | null }[]
  pagination?: { has_next_page: boolean }
}

const malEpisodesCache = new Map<number, Promise<MalEpisode[]>>()

/**
 * Real per-episode titles from MyAnimeList, used as a fallback when AniList's
 * own streamingEpisodes data is missing or duplicated across a franchise's
 * seasons (see anilist.ts's getStreamingEpisodes) — MAL's per-entry episode
 * lists are properly scoped to that specific season.
 *
 * Confirmed against real data that Jikan's episodes endpoint isn't reliable
 * for every title, even though the base /anime/{id} endpoint responds fine —
 * some ids reliably 504 ("Jikan failed to connect to MyAnimeList") on every
 * attempt while well-known titles come back cleanly, most likely a cache-miss/
 * live-scrape issue on Jikan's side for less-frequently-requested entries.
 * Treated as fully best-effort: a single attempt, no retries — any failure
 * resolves to [] rather than blocking or repeatedly hammering a dead lookup.
 */
export function getMalEpisodes(malId: number): Promise<MalEpisode[]> {
  const cached = malEpisodesCache.get(malId)
  if (cached) return cached
  const promise = enqueue(async () => {
    try {
      const episodes: MalEpisode[] = []
      let page = 1
      for (;;) {
        const res = await fetch(`${JIKAN_ENDPOINT}/anime/${malId}/episodes?page=${page}`)
        if (!res.ok) break
        const json: JikanEpisodesResponse = await res.json()
        for (const e of json.data ?? []) {
          episodes.push({ number: e.mal_id, title: e.title ?? null })
        }
        if (!json.pagination?.has_next_page) break
        page++
      }
      return episodes
    } catch {
      return []
    }
  })
  promise.catch(() => malEpisodesCache.delete(malId))
  malEpisodesCache.set(malId, promise)
  return promise
}
