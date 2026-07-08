import { v4 as uuid } from 'uuid'
import type { Episode, SeasonMeta, Show } from '../types/schema'

export interface CustomShowSeason {
  episodeCount: number
}

export interface CustomShowInput {
  title: string
  coverUrl: string | null
  format: string | null
  episodeDurationMin: number | null
  seasons: CustomShowSeason[]
}

/**
 * Builds a Show record for a title that isn't on AniList — same shape as
 * buildShowFromMedia (src/lib/newShow.ts), just with anilistId: null and
 * episode metadata entered by hand instead of pulled from a search result.
 * Episode `number` stays globally sequential across all seasons (same
 * indexing every other part of the app relies on); `seasonNumber` tags which
 * season each one belongs to, for EpisodeList's season grouping.
 */
export function buildCustomShow(input: CustomShowInput): Show {
  const now = new Date().toISOString()
  const episodes: Episode[] = []
  const seasons: SeasonMeta[] = []
  let number = 1
  input.seasons.forEach((season, seasonIndex) => {
    seasons.push({ number: seasonIndex + 1, name: null, bannerUrl: null, anilistId: null })
    for (let i = 0; i < season.episodeCount; i++) {
      episodes.push({
        number: number++,
        seasonNumber: seasonIndex + 1,
        watchCount: 0,
        watchDates: [],
        durationMin: null,
        title: null,
        description: null,
        artUrl: null,
      })
    }
  })

  return {
    id: uuid(),
    anilistId: null,
    title: input.title.trim(),
    coverUrl: input.coverUrl,
    bannerUrl: null,
    customCoverUrl: null,
    format: input.format,
    totalEpisodes: episodes.length,
    episodeDurationMin: input.episodeDurationMin,
    hasSequel: false,
    status: 'plan_to_watch',
    watchCount: 0,
    episodes,
    seasons,
    needsReview: false,
    reviewNote: null,
    notes: null,
    skipMarkThroughPrompt: false,
    createdAt: now,
    updatedAt: now,
  }
}
