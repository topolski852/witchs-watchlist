import { useEffect, useState } from 'react'
import type { Episode } from '../types/schema'
import { getStreamingEpisodes, type StreamingEpisode } from '../lib/anilist'
import { CoverImage } from './CoverImage'
import { CloseIcon } from './icons'

type ViewMode = 'list' | 'grid'

function episodeTitle(ep: Episode, streaming: StreamingEpisode | undefined): string {
  const raw = streaming?.title?.trim()
  if (!raw) return `Episode ${ep.number}`
  // Streaming titles often come as "Episode 3 - Actual Title" — keep just the
  // part after the dash when it's there, since we already show the number.
  const dashSplit = raw.match(/^Episode\s+\d+\s*[-–]\s*(.+)$/i)
  return dashSplit ? dashSplit[1] : raw
}

/** Groups by seasonNumber, preserving first-seen order. Only meaningful for
 * custom shows, which are the only ones that ever set it — AniList-backed
 * shows always have seasonNumber null and end up as one untitled group. */
function groupBySeasons(episodes: Episode[]): { season: number | null; episodes: Episode[] }[] {
  const groups: { season: number | null; episodes: Episode[] }[] = []
  const bySeasonNumber = new Map<number | null, Episode[]>()
  for (const ep of episodes) {
    let list = bySeasonNumber.get(ep.seasonNumber)
    if (!list) {
      list = []
      bySeasonNumber.set(ep.seasonNumber, list)
      groups.push({ season: ep.seasonNumber, episodes: list })
    }
    list.push(ep)
  }
  return groups
}

/** A single running count per episode: 0 = unwatched, 1 = watched, 2+ = rewatched. */
function WatchStepper({ ep, onBump }: { ep: Episode; onBump: (delta: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
      <button type="button" onClick={() => onBump(-1)} className="rounded border border-border px-1.5 hover:text-text">
        −
      </button>
      <span className="w-3 text-center text-text">{ep.watchCount}</span>
      <button type="button" onClick={() => onBump(1)} className="rounded border border-border px-1.5 hover:text-text">
        +
      </button>
    </div>
  )
}

function SeasonHeader({ season, episodes }: { season: number | null; episodes: Episode[] }) {
  if (season == null) return null
  const watched = episodes.filter((e) => e.watchCount > 0).length
  return (
    <p className="mb-1.5 mt-3 text-xs font-semibold text-text-muted first:mt-0">
      Season {season} <span className="font-normal text-text-faint">({watched}/{episodes.length})</span>
    </p>
  )
}

export function EpisodeList({
  anilistId,
  episodes,
  onBumpWatch,
  onMarkThrough,
}: {
  anilistId: number | null
  episodes: Episode[]
  onBumpWatch: (ep: Episode, delta: number) => void
  onMarkThrough: (number: number) => void
}) {
  const [view, setView] = useState<ViewMode>('list')
  const [streaming, setStreaming] = useState<StreamingEpisode[] | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    if (!anilistId) return
    getStreamingEpisodes(anilistId)
      .then(setStreaming)
      .catch(() => setStreaming([]))
  }, [anilistId])

  const watchedCount = episodes.filter((e) => e.watchCount > 0).length
  const selectedEp = episodes.find((e) => e.number === selected) ?? null
  const seasonGroups = groupBySeasons(episodes)

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">
          Episodes <span className="text-text-faint">({watchedCount}/{episodes.length})</span>
        </h3>
        <div className="flex overflow-hidden rounded-lg border border-border text-xs">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-2 py-1 ${view === 'list' ? 'bg-accent-muted text-text' : 'text-text-faint'}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`px-2 py-1 ${view === 'grid' ? 'bg-accent-muted text-text' : 'text-text-faint'}`}
          >
            Grid
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div>
          {seasonGroups.map((group) => (
            <div key={group.season ?? 'all'}>
              <SeasonHeader season={group.season} episodes={group.episodes} />
              <div className="space-y-1.5">
                {group.episodes.map((ep) => {
                  const stream = streaming?.[ep.number - 1]
                  return (
                    <div
                      key={ep.number}
                      className={`flex items-center gap-2.5 rounded-lg border p-1.5 ${
                        ep.watchCount > 0 ? 'border-accent-soft/50 bg-accent-muted/30' : 'border-border'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onBumpWatch(ep, 1)}
                        className="shrink-0"
                        aria-label="Add a watch"
                      >
                        {stream?.thumbnail ? (
                          <CoverImage src={stream.thumbnail} alt="" className="h-11 w-20 rounded-md" />
                        ) : (
                          <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md border border-border text-xs text-text-faint">
                            {ep.number}
                          </div>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text">
                          {ep.number}. {episodeTitle(ep, stream)}
                        </p>
                        <p className="text-[11px] text-text-faint">
                          {ep.watchCount === 0 ? 'Not watched' : `Watched ${ep.watchCount}×`}
                        </p>
                      </div>
                      <WatchStepper ep={ep} onBump={(d) => onBumpWatch(ep, d)} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {seasonGroups.map((group) => (
            <div key={group.season ?? 'all'}>
              <SeasonHeader season={group.season} episodes={group.episodes} />
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 md:grid-cols-12">
                {group.episodes.map((ep) => (
                  <button
                    key={ep.number}
                    type="button"
                    onClick={() => setSelected(ep.number)}
                    className={`relative aspect-square rounded-md border text-[11px] font-medium transition-colors ${
                      ep.watchCount > 0
                        ? 'border-accent bg-accent-muted text-text'
                        : 'border-border text-text-faint hover:border-accent-soft'
                    } ${selected === ep.number ? 'ring-2 ring-accent' : ''}`}
                  >
                    {ep.number}
                    {ep.watchCount > 1 && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-accent px-1 text-[9px] text-white">
                        {ep.watchCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {selectedEp && (
            <div className="mt-3 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text">Episode {selectedEp.number}</p>
                <button type="button" onClick={() => setSelected(null)} className="text-text-faint hover:text-text">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
                Watch count
                <WatchStepper ep={selectedEp} onBump={(d) => onBumpWatch(selectedEp, d)} />
              </div>
              {selectedEp.watchCount === 0 && selectedEp.number > 1 && (
                <button
                  type="button"
                  onClick={() => onMarkThrough(selectedEp.number)}
                  className="mt-2 block text-xs text-accent underline"
                >
                  Mark episodes 1–{selectedEp.number} watched
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
