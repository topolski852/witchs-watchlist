import type { CustomList, Show } from '../types/schema'

export interface RelinkResult {
  updatedLists: CustomList[]
  changedCount: number
}

/**
 * Finds Favorite/custom-list entries with no linkedShowId yet and links any
 * that match an existing show — by AniList id first (reliable), then by
 * normalized title as a fallback, since TV Time's raw title often doesn't
 * match AniList's resolved title as a plain string (e.g. "Frieren" vs
 * "Frieren: Beyond Journey's End"). Pure function — caller decides whether/
 * how to persist `updatedLists` (only the lists that actually changed).
 */
export function relinkFavorites(customLists: CustomList[], shows: Show[]): RelinkResult {
  const showByAnilistId = new Map(shows.filter((s) => s.anilistId != null).map((s) => [s.anilistId, s]))
  const showByTitle = new Map(shows.map((s) => [s.title.trim().toLowerCase(), s]))

  let changedCount = 0
  const updatedLists: CustomList[] = []
  for (const list of customLists) {
    let listChanged = false
    const entries = list.entries.map((entry) => {
      if (entry.linkedShowId) return entry
      const match =
        (entry.anilistId != null ? showByAnilistId.get(entry.anilistId) : undefined) ??
        showByTitle.get(entry.title.trim().toLowerCase())
      if (!match) return entry
      listChanged = true
      changedCount++
      return { ...entry, linkedShowId: match.id }
    })
    if (listChanged) {
      updatedLists.push({ ...list, entries, updatedAt: new Date().toISOString() })
    }
  }
  return { updatedLists, changedCount }
}
