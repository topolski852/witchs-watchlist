import { Link } from 'react-router-dom'
import type { Show } from '../types/schema'
import { CoverImage } from './CoverImage'
import { StatusBadge } from './StatusBadge'
import { FlagIcon } from './icons'

export function ShowRow({ show }: { show: Show }) {
  const watchedCount = show.episodes.filter((e) => e.watched).length
  const total = show.totalEpisodes ?? show.episodes.length
  const pct = total > 0 ? Math.round((watchedCount / total) * 100) : 0

  return (
    <Link
      to={`/show/${show.id}`}
      className="group relative flex h-24 overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent-soft sm:h-28"
    >
      {show.bannerUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity group-hover:opacity-40"
          style={{ backgroundImage: `url(${show.bannerUrl})` }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-surface/40" aria-hidden />

      <div className="relative z-10 flex w-full items-center gap-3 p-2.5">
        <CoverImage
          src={show.customCoverUrl || show.coverUrl}
          alt={show.title}
          className="h-full w-14 shrink-0 rounded-lg border border-border shadow sm:w-16"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-tight text-text">{show.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={show.status} />
            {show.rewatchCount > 0 && <span className="text-[11px] text-accent">×{show.rewatchCount + 1}</span>}
            {show.needsReview && (
              <span title="Needs review">
                <FlagIcon className="h-3 w-3 text-status-stopped" />
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 max-w-32 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-[11px] text-text-faint">
              {watchedCount}/{total || '?'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
