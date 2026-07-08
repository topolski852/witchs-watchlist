import { useMemo } from 'react'
import { useData } from '../store/useData'
import { StatCard } from '../components/StatCard'
import { formatDurationParts, formatMinutes, showWatchTime, totalWatchTime } from '../lib/watchTime'
import { WATCH_STATUSES } from '../types/schema'

// Same Months/Days/Hours breakdown the Home page's "Total Time" card uses,
// so First Watch/Rewatch/Total all read the same way instead of the old
// single "130d 9h"-style compact string.
function durationStats(minutes: number) {
  const d = formatDurationParts(minutes)
  return [
    { value: d.months, label: 'Months' },
    { value: d.days, label: 'Days' },
    { value: d.hours, label: 'Hours' },
  ]
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
        <div className="flex gap-3 overflow-x-auto pb-1">
          <StatCard title="First Watch" stats={durationStats(time.newMinutes)} />
          <StatCard title="Rewatch" stats={durationStats(time.rewatchMinutes)} />
          <StatCard title="Total" stats={durationStats(time.totalMinutes)} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text">Overview</h2>
        <StatCard
          title="Shows & Episodes"
          stats={[
            { value: shows.length, label: 'Shows Tracked' },
            { value: episodesWatched, label: 'Episodes Watched' },
          ]}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text">By status</h2>
        <div className="space-y-1.5">
          {byStatus.map((s) => (
            <div key={s.value} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <span className="text-text-muted">{s.label}</span>
              <span className="font-display text-text">{s.count}</span>
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
                <span className="shrink-0 font-display text-text">{formatMinutes(showWatchTime(s).rewatchMinutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
