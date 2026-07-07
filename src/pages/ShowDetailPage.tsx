import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../store/useData'
import { CoverImage } from '../components/CoverImage'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AboutSection } from '../components/AboutSection'
import { EpisodeList } from '../components/EpisodeList'
import { WATCH_STATUSES, type Episode, type WatchStatus } from '../types/schema'
import { showWatchTime, formatMinutes } from '../lib/watchTime'
import { deriveWatchStatus } from '../lib/statusRules'

export function ShowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { shows, saveShow, removeShow } = useData()
  const show = shows.find((s) => s.id === id)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [customCoverDraft, setCustomCoverDraft] = useState(show?.customCoverUrl ?? '')

  const time = useMemo(() => (show ? showWatchTime(show) : null), [show])

  if (!show) {
    return (
      <div className="py-8 text-center text-sm text-text-faint">
        Show not found. <button className="text-accent underline" onClick={() => navigate('/')}>Back to watchlist</button>
      </div>
    )
  }

  function update(patch: Partial<typeof show>) {
    if (!show) return
    saveShow({ ...show, ...patch, updatedAt: new Date().toISOString() })
  }

  // Every episode edit routes through here so watch status stays derived from
  // actual progress: none watched → Plan to Watch, all watched → Completed/Caught
  // Up, otherwise Watching. "Stopped" is manual-only and never auto-overridden.
  function applyEpisodes(episodes: Episode[]) {
    if (!show) return
    const status = deriveWatchStatus(episodes, show.hasSequel, show.status)
    update({ episodes, status })
  }

  function updateEpisode(number: number, patch: Partial<Episode>) {
    if (!show) return
    applyEpisodes(show.episodes.map((e) => (e.number === number ? { ...e, ...patch } : e)))
  }

  function toggleWatched(ep: Episode) {
    updateEpisode(ep.number, {
      watched: !ep.watched,
      watchedAt: !ep.watched ? new Date().toISOString() : ep.watchedAt,
    })
  }

  function markThrough(number: number) {
    if (!show) return
    applyEpisodes(
      show.episodes.map((e) =>
        e.number <= number && !e.watched
          ? { ...e, watched: true, watchedAt: new Date().toISOString() }
          : e,
      ),
    )
  }

  function bumpEpisodeRewatch(ep: Episode, delta: number) {
    const next = Math.max(0, ep.rewatchCount + delta)
    updateEpisode(ep.number, {
      rewatchCount: next,
      rewatchDates: delta > 0 ? [...ep.rewatchDates, new Date().toISOString()] : ep.rewatchDates,
    })
  }

  return (
    <div className="pb-6">
      {show.bannerUrl ? (
        <div className="relative -mx-4 mb-3 h-44 overflow-hidden sm:h-56 sm:rounded-b-xl">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${show.bannerUrl})` }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/10" aria-hidden />
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] rounded-full bg-bg/70 px-2.5 py-1 text-sm text-text backdrop-blur hover:bg-bg/90"
          >
            ← Back
          </button>
          <div className="absolute inset-x-4 bottom-3 flex items-end gap-4">
            <CoverImage
              src={show.customCoverUrl || show.coverUrl}
              alt={show.title}
              className="h-32 w-24 shrink-0 rounded-lg border border-border shadow-lg sm:h-36 sm:w-28"
            />
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="font-display text-lg leading-tight text-text drop-shadow-sm sm:text-xl">
                {show.title}
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                {show.format ?? 'Unknown format'} · {show.totalEpisodes ?? '?'} episodes ·{' '}
                {show.episodeDurationMin ?? '?'} min/ep
              </p>
              <div className="mt-2">
                <StatusBadge status={show.status} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-2 text-sm text-text-faint hover:text-text-muted"
        >
          ← Back
        </button>
      )}

      <div className={show.bannerUrl ? '' : 'flex gap-4'}>
        {!show.bannerUrl && (
          <CoverImage
            src={show.customCoverUrl || show.coverUrl}
            alt={show.title}
            className="h-40 w-28 shrink-0 rounded-lg border border-border"
          />
        )}
        <div className="min-w-0 flex-1">
          {!show.bannerUrl && (
            <>
              <h2 className="font-display text-lg leading-tight text-text">{show.title}</h2>
              <p className="mt-1 text-xs text-text-faint">
                {show.format ?? 'Unknown format'} · {show.totalEpisodes ?? '?'} episodes ·{' '}
                {show.episodeDurationMin ?? '?'} min/ep
              </p>
              <div className="mt-2">
                <StatusBadge status={show.status} />
              </div>
            </>
          )}
          {time && (
            <p className="mt-2 text-xs text-text-muted">
              {formatMinutes(time.newMinutes)} watched
              {time.rewatchMinutes > 0 && <> · {formatMinutes(time.rewatchMinutes)} rewatched</>}
            </p>
          )}
        </div>
      </div>

      <AboutSection anilistId={show.anilistId} hasSequel={show.hasSequel} />

      {show.needsReview && (
        <div className="mt-4 rounded-lg border border-status-stopped/50 bg-status-stopped/10 p-3 text-sm text-text">
          <p className="font-medium text-status-stopped">⚑ Needs review</p>
          {show.reviewNote && <p className="mt-1 text-text-muted">{show.reviewNote}</p>}
          <button
            type="button"
            onClick={() => update({ needsReview: false })}
            className="mt-2 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface"
          >
            Mark as reviewed
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-text-faint">
          Status
          <select
            value={show.status}
            onChange={(e) => update({ status: e.target.value as WatchStatus })}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text"
          >
            {WATCH_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs text-text-faint">
          Full rewatches
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
            <button
              type="button"
              onClick={() => update({ rewatchCount: Math.max(0, show.rewatchCount - 1) })}
              className="text-text-muted hover:text-text"
            >
              −
            </button>
            <span className="flex-1 text-center text-sm text-text">{show.rewatchCount}</span>
            <button
              type="button"
              onClick={() => update({ rewatchCount: show.rewatchCount + 1 })}
              className="text-text-muted hover:text-text"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <label className="mt-3 block text-xs text-text-faint">
        Custom cover URL (overrides AniList art)
        <div className="mt-1 flex gap-2">
          <input
            value={customCoverDraft}
            onChange={(e) => setCustomCoverDraft(e.target.value)}
            placeholder="https://…"
            className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text placeholder:text-text-faint"
          />
          <button
            type="button"
            onClick={() => update({ customCoverUrl: customCoverDraft.trim() || null })}
            className="rounded-lg border border-border px-2 py-1.5 text-xs text-text-muted hover:bg-surface"
          >
            Save
          </button>
        </div>
      </label>

      {show.episodes.length > 0 && (
        <EpisodeList
          anilistId={show.anilistId}
          episodes={show.episodes}
          onToggleWatched={toggleWatched}
          onMarkThrough={markThrough}
          onBumpRewatch={bumpEpisodeRewatch}
        />
      )}

      <textarea
        value={show.notes ?? ''}
        onChange={(e) => update({ notes: e.target.value || null })}
        placeholder="Notes…"
        rows={2}
        className="mt-5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint"
      />

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="mt-5 rounded-lg border border-status-stopped/50 px-3 py-1.5 text-sm text-status-stopped hover:bg-status-stopped/10"
      >
        Remove from watchlist
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this show?"
        message={`"${show.title}" and all its episode/rewatch data will be deleted from this device. Export a backup first if you're not sure.`}
        confirmLabel="Remove"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await removeShow(show.id)
          navigate('/')
        }}
      />
    </div>
  )
}
