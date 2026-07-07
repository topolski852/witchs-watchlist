import { useMemo } from 'react'
import { useData } from '../store/useData'
import { formatMinutes, showWatchTime, totalWatchTime } from '../lib/watchTime'
import { WATCH_STATUSES } from '../types/schema'

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-text-faint">{label}</p>
      <p className="mt-1 font-display text-xl text-text">{value}</p>
    </div>
  )
}

export function StatsPage() {
  const { shows } = useData()

  const time = useMemo(() => totalWatchTime(shows), [shows])
  const episodesWatched = useMemo(
    () => shows.reduce((sum, s) => sum + s.episodes.filter((e) => e.watchCount > 0).length, 0),
    [shows],
  )
  const byStatus = useMemo(
    () =>
      WATCH_STATUSES.map((s) => ({
        ...s,
        count: shows.filter((show) => show.status === s.value).length,
      })),
    [shows],
  )
  const mostRewatched = useMemo(
    () =>
      [...shows]
        .filter((s) => s.watchCount > 1 || s.episodes.some((e) => e.watchCount > 1))
        .sort((a, b) => showWatchTime(b).rewatchMinutes - showWatchTime(a).rewatchMinutes)
        .slice(0, 5),
    [shows],
  )

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-text">Watch time</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="New" value={formatMinutes(time.newMinutes)} />
          <StatTile label="Rewatch" value={formatMinutes(time.rewatchMinutes)} />
          <StatTile label="Total" value={formatMinutes(time.totalMinutes)} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text">Overview</h2>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Shows tracked" value={String(shows.length)} />
          <StatTile label="Episodes watched" value={String(episodesWatched)} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text">By status</h2>
        <div className="space-y-1.5">
          {byStatus.map((s) => (
            <div key={s.value} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-text-muted">{s.label}</span>
              <span className="text-text">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {mostRewatched.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-text">Most rewatched</h2>
          <div className="space-y-1.5">
            {mostRewatched.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="truncate text-text-muted">{s.title}</span>
                <span className="shrink-0 text-text">{formatMinutes(showWatchTime(s).rewatchMinutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
