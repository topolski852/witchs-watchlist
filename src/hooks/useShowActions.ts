import { useState } from 'react'
import type { Episode, SeasonMeta, Show } from '../types/schema'
import { deriveWatchStatus } from '../lib/statusRules'

/**
 * All the show-detail mutation logic in one place, so the standard
 * ShowDetailPage and the bespoke RwbyShowPage share identical watch-tracking
 * behavior instead of RWBY's page forking its own copy.
 */
export function useShowActions(show: Show, saveShow: (show: Show) => void) {
  const [pendingMarkThrough, setPendingMarkThrough] = useState<number | null>(null)

  function update(patch: Partial<Show>) {
    saveShow({ ...show, ...patch, updatedAt: new Date().toISOString() })
  }

  // Every episode edit routes through here so watch status stays derived from
  // actual progress: none watched → Plan to Watch, all watched → Completed/Caught
  // Up, otherwise Watching. "Stopped" is manual-only and never auto-overridden.
  function applyEpisodes(episodes: Episode[]) {
    const status = deriveWatchStatus(episodes, show.hasSequel, show.status)
    update({ episodes, status })
  }

  // extraPatch lets "Never" set skipMarkThroughPrompt in the same update as
  // the episode change — two separate update() calls back to back would both
  // close over the same stale `show`, so the second would clobber the first.
  function bumpWatch(ep: Episode, delta: number, extraPatch: Partial<Show> = {}) {
    const now = new Date().toISOString()
    const episodes = show.episodes.map((e) => {
      if (e.number !== ep.number) return e
      const watchCount = Math.max(0, e.watchCount + delta)
      const watchDates = delta > 0 ? [...e.watchDates, now] : delta < 0 ? e.watchDates.slice(0, -1) : e.watchDates
      return { ...e, watchCount, watchDates }
    })
    const status = deriveWatchStatus(episodes, show.hasSequel, show.status)
    update({ episodes, status, ...extraPatch })
  }

  // Only a genuine 0->1 "first watch" with an earlier gap prompts — rewatch
  // bumps (1->2+) and un-watching (any decrement) never do.
  function handleBumpWatch(ep: Episode, delta: number) {
    if (delta > 0 && ep.watchCount === 0) {
      const hasEarlierGap = show.episodes.some((e) => e.number < ep.number && e.watchCount === 0)
      if (hasEarlierGap && !show.skipMarkThroughPrompt) {
        setPendingMarkThrough(ep.number)
        return
      }
    }
    bumpWatch(ep, delta)
  }

  function markThrough(number: number) {
    const now = new Date().toISOString()
    applyEpisodes(
      show.episodes.map((e) =>
        e.number <= number && e.watchCount === 0 ? { ...e, watchCount: 1, watchDates: [...e.watchDates, now] } : e,
      ),
    )
  }

  // The show-level counter is a deliberate bulk action, not a computed
  // aggregate: bumping it applies the same delta to every episode at once
  // (e.g. "+" = I rewatched the whole thing).
  function bumpShowWatch(delta: number) {
    const now = new Date().toISOString()
    const episodes = show.episodes.map((e) => {
      const watchCount = Math.max(0, e.watchCount + delta)
      const watchDates = delta > 0 ? [...e.watchDates, now] : delta < 0 ? e.watchDates.slice(0, -1) : e.watchDates
      return { ...e, watchCount, watchDates }
    })
    const status = deriveWatchStatus(episodes, show.hasSequel, show.status)
    update({ watchCount: Math.max(0, show.watchCount + delta), episodes, status })
  }

  // Same bulk-set idea as the show-level stepper, scoped to one season —
  // doesn't touch show.watchCount, since a partial (single-season) rewatch
  // isn't "the whole show watched again."
  function setSeasonWatchCount(season: number, count: number) {
    const now = new Date().toISOString()
    const episodes = show.episodes.map((e) => {
      if (e.seasonNumber !== season) return e
      const watchCount = Math.max(0, count)
      const watchDates = Array.from({ length: watchCount }, (_, i) => e.watchDates[i] ?? now)
      return { ...e, watchCount, watchDates }
    })
    const status = deriveWatchStatus(episodes, show.hasSequel, show.status)
    update({ episodes, status })
  }

  // Lets shows with uneven episode lengths (RWBY's short early volumes vs.
  // later normal-length ones) set duration per season instead of one value
  // for the whole show. Doesn't touch status/watch time totals directly —
  // showWatchTime already reads durationMin per episode with a fallback.
  function setSeasonDuration(season: number, minutes: number) {
    const episodes = show.episodes.map((e) => (e.seasonNumber === season ? { ...e, durationMin: minutes } : e))
    update({ episodes })
  }

  function setSeasonMeta(season: number, patch: Partial<Pick<SeasonMeta, 'name' | 'bannerUrl'>>) {
    const seasons = (show.seasons ?? []).map((s) => (s.number === season ? { ...s, ...patch } : s))
    update({ seasons })
  }

  function setEpisodeMeta(number: number, patch: Partial<Pick<Episode, 'title' | 'description' | 'artUrl'>>) {
    const episodes = show.episodes.map((e) => (e.number === number ? { ...e, ...patch } : e))
    update({ episodes })
  }

  return {
    update,
    applyEpisodes,
    bumpWatch,
    handleBumpWatch,
    markThrough,
    bumpShowWatch,
    setSeasonWatchCount,
    setSeasonDuration,
    setSeasonMeta,
    setEpisodeMeta,
    pendingMarkThrough,
    setPendingMarkThrough,
  }
}
