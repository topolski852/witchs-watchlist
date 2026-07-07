import { useMemo } from 'react'
import { useData } from '../store/useData'
import { ShelfRow, type ShelfItem } from '../components/ShelfRow'
import { formatDurationParts, totalWatchTime } from '../lib/watchTime'

function lastWatchedAt(show: { episodes: { watchDates: string[] }[] }): string | null {
  let latest: string | null = null
  for (const ep of show.episodes) {
    const epLatest = ep.watchDates[ep.watchDates.length - 1]
    if (epLatest && (!latest || epLatest > latest)) latest = epLatest
  }
  return latest
}

export function HomePage() {
  const { shows, customLists, loading } = useData()

  const time = useMemo(() => totalWatchTime(shows), [shows])
  const duration = useMemo(() => formatDurationParts(time.totalMinutes), [time])
  const episodesWatched = useMemo(
    () => shows.reduce((sum, s) => sum + s.episodes.filter((e) => e.watchCount > 0).length, 0),
    [shows],
  )

  const recentShelf: ShelfItem[] = useMemo(() => {
    return shows
      .map((s) => ({ show: s, last: lastWatchedAt(s) }))
      .filter((s): s is { show: typeof shows[number]; last: string } => s.last !== null)
      .sort((a, b) => (a.last < b.last ? 1 : -1))
      .map(({ show }) => ({
        id: show.id,
        title: show.title,
        coverUrl: show.customCoverUrl || show.coverUrl,
        linkedShowId: show.id,
      }))
  }, [shows])

  const hasAnything = shows.length > 0 || customLists.length > 0

  return (
    <div className="space-y-6 pb-6">
      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Loading…</p>
      ) : !hasAnything ? (
        <p className="py-8 text-center text-sm text-text-faint">
          Nothing here yet — add a show from the Shows tab, or import your TV Time data from the Data tab.
        </p>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1">
            <div className="shrink-0 rounded-lg border border-border bg-surface px-4 py-3">
              <p className="text-center text-xs text-text-faint">Total Time</p>
              <div className="mt-1.5 flex gap-4">
                {(['months', 'days', 'hours'] as const).map((unit) => (
                  <div key={unit} className="text-center">
                    <p className="font-display text-xl text-text">{duration[unit]}</p>
                    <p className="text-[11px] capitalize text-text-faint">{unit}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-border bg-surface px-4 py-3">
              <p className="text-center text-xs text-text-faint">Episodes Watched</p>
              <p className="mt-1.5 text-center font-display text-xl text-text">{episodesWatched}</p>
            </div>
          </div>

          <ShelfRow title="Shows" count={recentShelf.length} to="/shows" items={recentShelf} />

          {customLists.map((list) => (
            <ShelfRow
              key={list.id}
              title={list.name}
              count={list.entries.length}
              to="/lists"
              items={list.entries.map((e) => ({
                id: e.id,
                title: e.title,
                coverUrl: e.coverUrl,
                linkedShowId: e.linkedShowId,
              }))}
            />
          ))}
        </>
      )}
    </div>
  )
}
