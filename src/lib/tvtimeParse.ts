import Papa from 'papaparse'

async function parseCsv(file: File): Promise<Record<string, string>[]> {
  const text = await file.text()
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  return result.data
}

function findFile(files: File[], name: string): File | undefined {
  return files.find((f) => f.name.toLowerCase() === name.toLowerCase())
}

/**
 * TV Time's CSV export serializes some columns as Go's default `%v` map/array
 * printing (e.g. `map[key:val key2:val2]`), not JSON. This is only safe to parse
 * with a flat regex because none of the values we read out of it (ids, uuids,
 * unix timestamps, the literal words "series"/"movie") ever contain spaces or
 * brackets themselves — that's true for the `objects` column on the two
 * favorite-* list rows this app reads, which is the only place this parser is used.
 */
function parseGoMapList(raw: string | undefined): Record<string, string>[] {
  if (!raw) return []
  const maps: Record<string, string>[] = []
  const mapRegex = /map\[([^[\]]*)\]/g
  let m: RegExpExecArray | null
  while ((m = mapRegex.exec(raw))) {
    const entry: Record<string, string> = {}
    for (const token of m[1].split(' ')) {
      const idx = token.indexOf(':')
      if (idx === -1) continue
      entry[token.slice(0, idx)] = token.slice(idx + 1)
    }
    maps.push(entry)
  }
  return maps
}

export interface RawShow {
  tvShowId: string
  name: string
  episodesSeen: number
  archived: boolean
  lastSeenAt: string | null
  hadCustomImage: boolean
}

export interface RawRewatchEpisode {
  episodeNumber: number
  seasonNumber: number
  count: number
  updatedAt: string
}

export interface RawFavoriteRef {
  tvdbId?: string
  uuid?: string
}

export interface ParsedTvTimeData {
  shows: RawShow[]
  rewatchByShowName: Map<string, RawRewatchEpisode[]>
  favoriteSeriesRefs: RawFavoriteRef[]
  favoriteMovieRefs: RawFavoriteRef[]
  seriesNameByTvdbId: Map<string, string>
  movieNameByUuid: Map<string, string>
}

const REQUIRED_FILES = [
  'user_tv_show_data.csv',
  'followed_tv_show.csv',
  'show_seen_episode_latest.csv',
  'rewatched_episode.csv',
  'user_custom_show_image.csv',
  'lists-prod-lists.csv',
  'users-customization-prod-data.csv',
]

export function missingRequiredFiles(files: File[]): string[] {
  return REQUIRED_FILES.filter((name) => !findFile(files, name))
}

export async function parseTvTimeFiles(files: File[]): Promise<ParsedTvTimeData> {
  const [userShowData, followedShow, seenLatest, rewatched, customImage, lists, customization] =
    await Promise.all(
      REQUIRED_FILES.map((name) => {
        const f = findFile(files, name)
        if (!f) throw new Error(`Missing required TV Time export file: ${name}`)
        return parseCsv(f)
      }),
    )

  const archivedById = new Map<string, boolean>()
  for (const row of followedShow) {
    archivedById.set(row.tv_show_id, row.archived === '1')
  }

  const lastSeenById = new Map<string, string>()
  for (const row of seenLatest) {
    lastSeenById.set(row.tv_show_id, row.updated_at)
  }

  const customImageIds = new Set(customImage.map((row) => row.tv_show_id))

  const rewatchByShowName = new Map<string, RawRewatchEpisode[]>()
  for (const row of rewatched) {
    const list = rewatchByShowName.get(row.tv_show_name) ?? []
    list.push({
      episodeNumber: Number(row.episode_number),
      seasonNumber: Number(row.episode_season_number),
      count: Number(row.cpt),
      updatedAt: row.updated_at,
    })
    rewatchByShowName.set(row.tv_show_name, list)
  }

  const shows: RawShow[] = userShowData.map((row) => ({
    tvShowId: row.tv_show_id,
    name: row.tv_show_name,
    episodesSeen: Number(row.nb_episodes_seen) || 0,
    archived: archivedById.get(row.tv_show_id) ?? false,
    lastSeenAt: lastSeenById.get(row.tv_show_id) ?? null,
    hadCustomImage: customImageIds.has(row.tv_show_id),
  }))

  const seriesNameByTvdbId = new Map<string, string>()
  const movieNameByUuid = new Map<string, string>()
  for (const row of customization) {
    if (row.entity_type === 'series' && row.series_name) {
      seriesNameByTvdbId.set(row.entity_id, row.series_name)
    }
    if (row.entity_type === 'movie' && row.movie_name) {
      movieNameByUuid.set(row.entity_uuid, row.movie_name)
    }
  }

  let favoriteSeriesRefs: RawFavoriteRef[] = []
  let favoriteMovieRefs: RawFavoriteRef[] = []
  for (const row of lists) {
    if (row.s_key === 'favorite-series') {
      favoriteSeriesRefs = parseGoMapList(row.objects).map((m) => ({ tvdbId: m.id, uuid: m.uuid }))
    }
    if (row.s_key === 'favorite-movies') {
      favoriteMovieRefs = parseGoMapList(row.objects).map((m) => ({ uuid: m.uuid }))
    }
  }

  return {
    shows,
    rewatchByShowName,
    favoriteSeriesRefs,
    favoriteMovieRefs,
    seriesNameByTvdbId,
    movieNameByUuid,
  }
}
