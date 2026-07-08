import { useState } from 'react'
import { CoverImage } from '../components/CoverImage'
import { StatusBadge } from '../components/StatusBadge'
import { SearchAniListModal } from '../components/SearchAniListModal'
import { bestTitle, type AniListMedia } from '../lib/anilist'
import { WATCH_STATUSES, type Show, type WatchStatus } from '../types/schema'
import type { ImportPlan as Plan } from '../lib/importTvTime'

export function ImportReview({
  plan,
  onChange,
  onConfirm,
  onCancel,
  importing,
}: {
  plan: Plan
  onChange: (plan: Plan) => void
  onConfirm: () => void
  onCancel: () => void
  importing: boolean
}) {
  const [onlyFlagged, setOnlyFlagged] = useState(true)
  const [relinkTarget, setRelinkTarget] = useState<Show | null>(null)

  const visibleShows = onlyFlagged ? plan.shows.filter((s) => s.needsReview) : plan.shows

  function updateShow(id: string, patch: Partial<Show>) {
    onChange({ ...plan, shows: plan.shows.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  }

  function dropShow(id: string) {
    onChange({ ...plan, shows: plan.shows.filter((s) => s.id !== id) })
  }

  function relink(media: AniListMedia) {
    if (!relinkTarget) return
    updateShow(relinkTarget.id, {
      anilistId: media.id,
      title: bestTitle(media),
      coverUrl: media.coverImage.large,
      format: media.format,
      totalEpisodes: media.episodes,
      episodeDurationMin: media.duration,
      needsReview: false,
      reviewNote: null,
      seasons: null,
      episodes: relinkTarget.episodes.map((e) => ({ ...e, seasonNumber: null })),
    })
    setRelinkTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3 text-sm">
        <p className="text-text">
          <strong>{plan.matchedCount}</strong> shows matched to AniList automatically,{' '}
          <strong>{plan.unmatchedCount}</strong> need a manual look.
        </p>
        <p className="mt-1 text-text-faint">
          Favorite Shows: {plan.customLists[0]?.entries.length ?? 0} · Favorite Movies:{' '}
          {plan.customLists[1]?.entries.length ?? 0}
        </p>
        <p className="mt-1 text-text-faint">Nothing is saved until you confirm below.</p>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={onlyFlagged}
          onChange={(e) => setOnlyFlagged(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Only show flagged shows ({plan.shows.filter((s) => s.needsReview).length})
      </label>

      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {visibleShows.map((show) => (
          <div key={show.id} className="flex gap-3 rounded-lg border border-border bg-surface p-2">
            <CoverImage src={show.coverUrl} alt={show.title} className="h-16 w-11 shrink-0 rounded" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{show.title}</p>
              {show.reviewNote && <p className="mt-0.5 text-[11px] text-status-stopped">{show.reviewNote}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <select
                  value={show.status}
                  onChange={(e) => updateShow(show.id, { status: e.target.value as WatchStatus })}
                  className="rounded border border-border bg-bg px-1.5 py-0.5 text-xs text-text"
                >
                  {WATCH_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <StatusBadge status={show.status} />
                <button
                  type="button"
                  onClick={() => setRelinkTarget(show)}
                  className="rounded border border-border px-1.5 py-0.5 text-[11px] text-text-muted hover:bg-surface-raised"
                >
                  {show.anilistId ? 'Re-link' : 'Search AniList'}
                </button>
                <button
                  type="button"
                  onClick={() => dropShow(show.id)}
                  className="rounded border border-border px-1.5 py-0.5 text-[11px] text-status-stopped hover:bg-status-stopped/10"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        ))}
        {visibleShows.length === 0 && (
          <p className="py-4 text-center text-sm text-text-faint">Nothing flagged — looks good.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={importing}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={importing}
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {importing ? 'Importing…' : `Import ${plan.shows.length} shows`}
        </button>
      </div>

      <SearchAniListModal open={!!relinkTarget} onClose={() => setRelinkTarget(null)} onPick={relink} />
    </div>
  )
}
