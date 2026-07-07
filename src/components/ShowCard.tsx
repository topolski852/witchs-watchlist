import { Link } from 'react-router-dom'
import type { Show } from '../types/schema'
import { CoverImage } from './CoverImage'
import { StatusBadge } from './StatusBadge'

export function ShowCard({ show }: { show: Show }) {
  const watchedCount = show.episodes.filter((e) => e.watched).length
  const total = show.totalEpisodes ?? show.episodes.length

  return (
    <Link
      to={`/show/${show.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-accent-soft"
    >
      <div className="relative aspect-[2/3] w-full">
        <CoverImage
          src={show.customCoverUrl || show.coverUrl}
          alt={show.title}
          className="h-full w-full"
        />
        {show.needsReview && (
          <span
            className="absolute right-1.5 top-1.5 rounded-full bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold text-status-stopped"
            title="Needs review"
          >
            ⚑
          </span>
        )}
        {show.rewatchCount > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            ×{show.rewatchCount + 1}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <p className="line-clamp-2 text-xs font-medium leading-tight text-text">{show.title}</p>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          <StatusBadge status={show.status} />
          <span className="text-[11px] text-text-faint">
            {watchedCount}/{total || '?'}
          </span>
        </div>
      </div>
    </Link>
  )
}
