import { useEffect, useState } from 'react'
import type { Episode, SeasonMeta } from '../types/schema'
import { getStreamingEpisodes, streamingEpisodeTitle, type StreamingEpisode } from '../lib/anilist'
import { CoverImage } from './CoverImage'
import { CloseIcon, PencilIcon } from './icons'

type ViewMode = 'list' | 'grid'
type EpisodeMetaPatch = Partial<Pick<Episode, 'title' | 'description' | 'artUrl'>>

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

/** The season's watch count is however many passes *every* episode in it has
 * had at least — selecting a new value in the dropdown bulk-sets all of
 * them, same idea as the show-level bulk stepper but scoped to one season. */
function seasonWatchCount(episodes: Episode[]): number {
  return episodes.length ? Math.min(...episodes.map((e) => e.watchCount)) : 0
}

/** Null when episodes in the season have mixed/unset durations. */
function seasonDuration(episodes: Episode[]): number | null {
  const first = episodes[0]?.durationMin ?? null
  return episodes.every((e) => (e.durationMin ?? null) === first) ? first : null
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

/** Inline Title/Description/Art URL editor, shared between the List view's
 * per-row toggle and the Grid view's selected-episode inspector. */
function EpisodeMetaEditor({
  ep,
  onSetEpisodeMeta,
}: {
  ep: Episode
  onSetEpisodeMeta: (number: number, patch: EpisodeMetaPatch) => void
}) {
  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-border bg-bg p-2 text-xs">
      <label className="block">
        <span className="text-text-faint">Title</span>
        <input
          key={`title-${ep.number}`}
          type="text"
          defaultValue={ep.title ?? ''}
          onBlur={(e) => onSetEpisodeMeta(ep.number, { title: e.target.value.trim() || null })}
          className="mt-0.5 w-full rounded border border-border bg-surface px-1.5 py-1 text-text"
        />
      </label>
      <label className="block">
        <span className="text-text-faint">Description</span>
        <textarea
          key={`desc-${ep.number}`}
          defaultValue={ep.description ?? ''}
          onBlur={(e) => onSetEpisodeMeta(ep.number, { description: e.target.value.trim() || null })}
          rows={2}
          className="mt-0.5 w-full rounded border border-border bg-surface px-1.5 py-1 text-text"
        />
      </label>
      <label className="block">
        <span className="text-text-faint">Art URL</span>
        <input
          key={`art-${ep.number}`}
          type="text"
          defaultValue={ep.artUrl ?? ''}
          onBlur={(e) => onSetEpisodeMeta(ep.number, { artUrl: e.target.value.trim() || null })}
          className="mt-0.5 w-full rounded border border-border bg-surface px-1.5 py-1 text-text"
        />
      </label>
    </div>
  )
}

function SeasonHeader({
  season,
  episodes,
  seasonMeta,
  defaultDuration,
  onSetWatchCount,
  onSetDuration,
  onSetSeasonMeta,
}: {
  season: number | null
  episodes: Episode[]
  seasonMeta: SeasonMeta | undefined
  defaultDuration: number | null
  onSetWatchCount: (season: number, count: number) => void
  onSetDuration: (season: number, minutes: number) => void
  onSetSeasonMeta: (season: number, patch: Partial<Pick<SeasonMeta, 'name' | 'bannerUrl'>>) => void
}) {
  const [editing, setEditing] = useState(false)
  if (season == null) return null
  const watched = episodes.filter((e) => e.watchCount > 0).length
  const watchCount = seasonWatchCount(episodes)
  const duration = seasonDuration(episodes)

  return (
    <div className="mb-1.5 mt-4 first:mt-0">
      {seasonMeta?.bannerUrl && (
        <CoverImage src={seasonMeta.bannerUrl} alt="" className="mb-1.5 h-20 w-full rounded-lg object-cover" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
          {seasonMeta?.name ?? `Season ${season}`}{' '}
          <span className="font-normal text-text-faint">({watched}/{episodes.length})</span>
          <button
            type="button"
            aria-label="Edit season details"
            onClick={() => setEditing((v) => !v)}
            className="text-text-faint hover:text-text"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
        </p>
        <div className="flex items-center gap-3 text-[11px] text-text-faint">
          <label className="flex items-center gap-1">
            Watches
            <select
              value={watchCount}
              onChange={(e) => onSetWatchCount(season, Number(e.target.value))}
              className="rounded border border-border bg-bg px-1 py-0.5 text-text"
            >
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Min/ep
            <input
              key={`${season}-${duration ?? 'mixed'}`}
              type="number"
              min={1}
              step="any"
              defaultValue={duration ?? undefined}
              placeholder={defaultDuration != null ? String(defaultDuration) : '—'}
              onBlur={(e) => {
                const value = Number(e.target.value)
                if (value > 0) onSetDuration(season, value)
              }}
              className="w-14 rounded border border-border bg-bg px-1 py-0.5 text-text"
            />
          </label>
        </div>
      </div>
      {editing && (
        <div className="mt-1.5 space-y-1.5 rounded-md border border-border bg-bg p-2 text-xs">
          <label className="block">
            <span className="text-text-faint">Season name</span>
            <input
              key={`name-${season}`}
              type="text"
              defaultValue={seasonMeta?.name ?? ''}
              onBlur={(e) => onSetSeasonMeta(season, { name: e.target.value.trim() || null })}
              className="mt-0.5 w-full rounded border border-border bg-surface px-1.5 py-1 text-text"
            />
          </label>
          <label className="block">
            <span className="text-text-faint">Banner URL</span>
            <input
              key={`banner-${season}`}
              type="text"
              defaultValue={seasonMeta?.bannerUrl ?? ''}
              onBlur={(e) => onSetSeasonMeta(season, { bannerUrl: e.target.value.trim() || null })}
              className="mt-0.5 w-full rounded border border-border bg-surface px-1.5 py-1 text-text"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export function EpisodeList({
  anilistId,
  episodes,
  seasons,
  defaultDuration,
  onBumpWatch,
  onMarkThrough,
  onSetSeasonWatchCount,
  onSetSeasonDuration,
  onSetSeasonMeta,
  onSetEpisodeMeta,
}: {
  anilistId: number | null
  episodes: Episode[]
  seasons: SeasonMeta[] | null
  defaultDuration: number | null
  onBumpWatch: (ep: Episode, delta: number) => void
  onMarkThrough: (number: number) => void
  onSetSeasonWatchCount: (season: number, count: number) => void
  onSetSeasonDuration: (season: number, minutes: number) => void
  onSetSeasonMeta: (season: number, patch: Partial<Pick<SeasonMeta, 'name' | 'bannerUrl'>>) => void
  onSetEpisodeMeta: (number: number, patch: EpisodeMetaPatch) => void
}) {
  const [view, setView] = useState<ViewMode>('list')
  const [streamingBySeason, setStreamingBySeason] = useState<Map<number | null, StreamingEpisode[]>>(new Map())
  const [selected, setSelected] = useState<number | null>(null)
  const [editingNumber, setEditingNumber] = useState<number | null>(null)

  const seasonMetaByNumber = new Map((seasons ?? []).map((s) => [s.number, s]))

  // A show chained together from multiple AniList seasons needs each
  // season's *own* streaming episode list — S2's episode 1 titles/thumbnails
  // live under S2's AniList id, not S1's. Keyed by strings (not the
  // episodes/seasons objects themselves) so bumping a watch count elsewhere
  // doesn't re-trigger a refetch — only an actual change in which
  // seasons/AniList ids exist does.
  // `Array.join` turns `null` into an empty string, indistinguishable from
  // other entries — map it to the literal string 'null' first so splitting
  // back out is unambiguous.
  const seasonNumbersKey = Array.from(new Set(episodes.map((e) => (e.seasonNumber == null ? 'null' : String(e.seasonNumber))))).join(
    ',',
  )
  const seasonAnilistKey = (seasons ?? []).map((s) => `${s.number}:${s.anilistId ?? ''}`).join(',')

  useEffect(() => {
    let cancelled = false
    const seasonNumbers = seasonNumbersKey === '' ? [] : seasonNumbersKey.split(',').map((s) => (s === 'null' ? null : Number(s)))
    const jobs: { season: number | null; id: number }[] = []
    for (const sn of seasonNumbers) {
      const id = sn != null ? (seasonMetaByNumber.get(sn)?.anilistId ?? null) : anilistId
      if (id != null) jobs.push({ season: sn, id })
    }
    if (jobs.length === 0) {
      setStreamingBySeason(new Map())
      return
    }
    Promise.all(
      jobs.map(
        async (j) => [j.season, await getStreamingEpisodes(j.id).catch(() => [])] as [number | null, StreamingEpisode[]],
      ),
    ).then((results) => {
      if (cancelled) return
      // Confirmed against real data (Overlord's 4 AniList season entries all
      // return an identical, verbatim-Season-1 episode list) that AniList's
      // streamingEpisodes can be duplicated across a franchise's separate
      // season ids — not a per-show fetch bug, but bad upstream data. Showing
      // that duplicated list as if it were each season's own real episodes
      // would be worse than the honest "Episode N" fallback, so once a
      // season's list has been seen for an earlier season in this same show,
      // later seasons with the exact same first title are treated as having
      // no usable data.
      const seenFirstTitles = new Set<string>()
      const deduped: [number | null, StreamingEpisode[]][] = results.map(([season, episodes]) => {
        const firstTitle = episodes[0]?.title
        if (firstTitle != null) {
          if (seenFirstTitles.has(firstTitle)) return [season, []]
          seenFirstTitles.add(firstTitle)
        }
        return [season, episodes]
      })
      setStreamingBySeason(new Map(deduped))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anilistId, seasonNumbersKey, seasonAnilistKey])

  const watchedCount = episodes.filter((e) => e.watchCount > 0).length
  const selectedEp = episodes.find((e) => e.number === selected) ?? null
  const seasonGroups = groupBySeasons(episodes)
  const selectedGroup = selectedEp ? seasonGroups.find((g) => g.season === selectedEp.seasonNumber) : undefined
  const selectedStream = selectedGroup
    ? streamingBySeason.get(selectedGroup.season)?.[selectedGroup.episodes.indexOf(selectedEp!)]
    : undefined

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
              <SeasonHeader
                season={group.season}
                episodes={group.episodes}
                seasonMeta={group.season != null ? seasonMetaByNumber.get(group.season) : undefined}
                defaultDuration={defaultDuration}
                onSetWatchCount={onSetSeasonWatchCount}
                onSetDuration={onSetSeasonDuration}
                onSetSeasonMeta={onSetSeasonMeta}
              />
              <div className="space-y-1.5">
                {group.episodes.map((ep, epIdx) => {
                  const stream = streamingBySeason.get(group.season)?.[epIdx]
                  return (
                    <div
                      key={ep.number}
                      className={`rounded-lg border p-1.5 ${
                        ep.watchCount > 0 ? 'border-accent-soft/50 bg-accent-muted/30' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => onBumpWatch(ep, 1)}
                          className="shrink-0"
                          aria-label="Add a watch"
                        >
                          {ep.artUrl || stream?.thumbnail ? (
                            <CoverImage src={ep.artUrl ?? stream?.thumbnail ?? null} alt="" className="h-11 w-20 rounded-md" />
                          ) : (
                            <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md border border-border text-xs text-text-faint">
                              {ep.number}
                            </div>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-text">
                            {ep.number}. {ep.title ?? streamingEpisodeTitle(ep.number, stream)}
                          </p>
                          <p className="text-[11px] text-text-faint">
                            {ep.watchCount === 0 ? 'Not watched' : `Watched ${ep.watchCount}×`}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Edit episode details"
                          onClick={() => setEditingNumber(editingNumber === ep.number ? null : ep.number)}
                          className="shrink-0 text-text-faint hover:text-text"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <WatchStepper ep={ep} onBump={(d) => onBumpWatch(ep, d)} />
                      </div>
                      {editingNumber === ep.number && <EpisodeMetaEditor ep={ep} onSetEpisodeMeta={onSetEpisodeMeta} />}
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
              <SeasonHeader
                season={group.season}
                episodes={group.episodes}
                seasonMeta={group.season != null ? seasonMetaByNumber.get(group.season) : undefined}
                defaultDuration={defaultDuration}
                onSetWatchCount={onSetSeasonWatchCount}
                onSetDuration={onSetSeasonDuration}
                onSetSeasonMeta={onSetSeasonMeta}
              />
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 md:grid-cols-12">
                {group.episodes.map((ep, epIdx) => {
                  const stream = streamingBySeason.get(group.season)?.[epIdx]
                  const thumb = ep.artUrl ?? stream?.thumbnail ?? null
                  return (
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
                      {thumb && (
                        <div className="absolute inset-0 overflow-hidden rounded-md">
                          <CoverImage src={thumb} alt="" className="h-full w-full" />
                        </div>
                      )}
                      <span className={thumb ? 'relative rounded bg-bg/80 px-1 text-[10px]' : undefined}>{ep.number}</span>
                      {ep.watchCount > 1 && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-accent px-1 text-[9px] text-white">
                          {ep.watchCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {selectedEp && (
            <div className="mt-3 rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  {(selectedEp.artUrl || selectedStream?.thumbnail) && (
                    <CoverImage
                      src={selectedEp.artUrl ?? selectedStream?.thumbnail ?? null}
                      alt=""
                      className="h-11 w-20 shrink-0 rounded-md"
                    />
                  )}
                  <p className="text-sm font-medium text-text">
                    Episode {selectedEp.number}
                    <span className="text-text-muted"> — {selectedEp.title ?? streamingEpisodeTitle(selectedEp.number, selectedStream)}</span>
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="shrink-0 text-text-faint hover:text-text">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              {selectedEp.description && <p className="mt-1.5 text-xs text-text-muted">{selectedEp.description}</p>}
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
              <button
                type="button"
                onClick={() => setEditingNumber(editingNumber === selectedEp.number ? null : selectedEp.number)}
                className="mt-2 flex items-center gap-1 text-xs text-text-faint hover:text-text"
              >
                <PencilIcon className="h-3 w-3" /> Edit details
              </button>
              {editingNumber === selectedEp.number && (
                <EpisodeMetaEditor ep={selectedEp} onSetEpisodeMeta={onSetEpisodeMeta} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
