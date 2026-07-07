import type { Episode, WatchStatus } from '../types/schema'

/**
 * Derives watch status purely from episode progress:
 *   0 watched            -> Plan to Watch ("Haven't Started")
 *   some watched          -> Watching
 *   all watched + sequel  -> Caught Up (more of the story is coming)
 *   all watched, no sequel -> Completed ("Watched")
 * "Stopped" is the one manual escape hatch — it's never auto-overridden,
 * since dropping a show partway through isn't derivable from episode counts.
 *
 * hasSequel defaults to false when unknown (unmatched shows, or AniList
 * simply hasn't listed a sequel yet) — per spec, no data means Completed,
 * not Caught Up.
 */
export function deriveWatchStatus(
  episodes: Episode[],
  hasSequel: boolean,
  currentStatus: WatchStatus,
): WatchStatus {
  if (currentStatus === 'stopped') return 'stopped'
  const total = episodes.length
  if (total === 0) return currentStatus
  const watchedCount = episodes.filter((e) => e.watchCount > 0).length
  if (watchedCount === 0) return 'plan_to_watch'
  if (watchedCount === total) return hasSequel ? 'caught_up' : 'completed'
  return 'watching'
}
