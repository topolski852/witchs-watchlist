import type { Episode, WatchStatus } from '../types/schema'

/**
 * Derives watch status purely from episode progress: none watched → Plan to
 * Watch, all watched → Completed (or Caught Up if AniList says it's still
 * airing), some watched → Watching. "Stopped" is the one manual escape hatch —
 * it's never auto-overridden, since dropping a show partway through isn't
 * something episode counts alone can express.
 *
 * totalEpisodes must be AniList's confirmed count, not just episodes.length —
 * for an unmatched show, episodes.length is fabricated from "however many
 * we've logged," and treating that as "the whole series" would wrongly
 * mark it Completed the moment every logged episode is checked off.
 */
export function deriveWatchStatus(
  episodes: Episode[],
  totalEpisodes: number | null,
  airingStatus: string | null,
  currentStatus: WatchStatus,
): WatchStatus {
  if (currentStatus === 'stopped') return 'stopped'
  const watchedCount = episodes.filter((e) => e.watched).length
  if (watchedCount === 0) return 'plan_to_watch'
  if (totalEpisodes != null && watchedCount === totalEpisodes) {
    return airingStatus === 'RELEASING' ? 'caught_up' : 'completed'
  }
  return 'watching'
}
