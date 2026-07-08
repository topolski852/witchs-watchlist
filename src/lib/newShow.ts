import { v4 as uuid } from 'uuid'
import type { Episode, Show } from '../types/schema'
import { bestTitle, hasSequelRelation, type AniListMedia } from './anilist'

/** Builds a fresh Show record for a newly-added AniList entry — always
 * starts at Plan to Watch/untouched, regardless of where "Add" was tapped. */
export function buildShowFromMedia(media: AniListMedia): Show {
  const now = new Date().toISOString()
  const episodes: Episode[] = Array.from({ length: media.episodes ?? 0 }, (_, i) => ({
    number: i + 1,
    seasonNumber: null,
    watchCount: 0,
    watchDates: [],
    durationMin: null,
    title: null,
    description: null,
    artUrl: null,
  }))
  return {
    id: uuid(),
    anilistId: media.id,
    title: bestTitle(media),
    coverUrl: media.coverImage.large,
    bannerUrl: media.bannerImage,
    customCoverUrl: null,
    format: media.format,
    totalEpisodes: media.episodes,
    episodeDurationMin: media.duration,
    hasSequel: hasSequelRelation(media),
    status: 'plan_to_watch',
    watchCount: 0,
    episodes,
    seasons: null,
    needsReview: false,
    reviewNote: null,
    notes: null,
    skipMarkThroughPrompt: false,
    createdAt: now,
    updatedAt: now,
  }
}
