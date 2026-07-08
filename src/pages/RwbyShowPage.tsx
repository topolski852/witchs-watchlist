import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useData } from '../store/useData'
import { CoverImage } from '../components/CoverImage'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MarkThroughDialog } from '../components/MarkThroughDialog'
import { EpisodeList } from '../components/EpisodeList'
import { BeeIcon } from '../components/rwbyIcons'
import { WATCH_STATUSES, type WatchStatus } from '../types/schema'
import { showWatchTime, formatMinutes } from '../lib/watchTime'
import { useShowActions } from '../hooks/useShowActions'
import { applyRwbySeedData, rwbyNeedsSeed, RWBY_TEAM_EMBLEMS } from '../lib/rwbyData'

// Team colors, scoped locally to this one page — not part of the app's
// global theme tokens, so nothing outside RWBY's own page is affected.
const RUBY = '#e0344c'
const WEISS = '#eef1f5'
const BLAKE = '#8a5cf5'
const YANG = '#f2b90c'

const BEES = [
  { top: '8%', left: '6%', size: 28, rotate: -18 },
  { top: '62%', left: '88%', size: 22, rotate: 12 },
  { top: '20%', left: '82%', size: 18, rotate: 30 },
  { top: '72%', left: '14%', size: 20, rotate: -8 },
]

export function RwbyShowPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { shows, saveShow, removeShow } = useData()
  const show = shows.find((s) => s.id === id)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [customCoverDraft, setCustomCoverDraft] = useState(show?.customCoverUrl ?? '')

  const time = useMemo(() => (show ? showWatchTime(show) : null), [show])

  const actions = useShowActions(show ?? PLACEHOLDER_SHOW, saveShow)

  // Fills in the real season/episode titles+runtimes Kelly supplied, the one
  // time it hasn't happened yet — idempotent, so this is a no-op once done.
  useEffect(() => {
    if (show && rwbyNeedsSeed(show)) {
      saveShow(applyRwbySeedData(show))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  if (!show) {
    return (
      <div className="py-8 text-center text-sm text-text-faint">
        Show not found. <button className="text-accent underline" onClick={() => navigate('/')}>Back to watchlist</button>
      </div>
    )
  }

  const {
    update,
    bumpWatch,
    handleBumpWatch,
    markThrough,
    bumpShowWatch,
    setSeasonWatchCount,
    setSeasonDuration,
    setSeasonMeta,
    setEpisodeMeta,
    pendingMarkThrough,
    setPendingMarkThrough,
  } = actions

  return (
    <div className="pb-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-2 text-sm text-text-faint hover:text-text-muted"
      >
        ← Back
      </button>

      {/* Hero: the 4 team colors + symbols, with a few bees scattered around
          for Bumblebee (Blake x Yang, canon as of Volume 9). */}
      <div
        className="relative -mx-4 overflow-hidden px-4 py-6 sm:rounded-b-2xl"
        style={{
          background: `linear-gradient(120deg, ${RUBY}26 0%, ${WEISS}14 33%, ${BLAKE}26 66%, ${YANG}22 100%)`,
        }}
      >
        {BEES.map((b, i) => (
          <BeeIcon
            key={i}
            aria-hidden
            className="pointer-events-none absolute opacity-15"
            style={{
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              transform: `rotate(${b.rotate}deg)`,
              color: YANG,
            }}
          />
        ))}

        <div className="relative flex items-center gap-4">
          <CoverImage
            src={show.customCoverUrl || show.coverUrl}
            alt={show.title}
            className="h-32 w-24 shrink-0 rounded-lg border border-border shadow-lg sm:h-36 sm:w-28"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight text-text sm:text-2xl">{show.title}</h2>
            <p className="mt-1 text-xs text-text-muted">
              {show.format ?? 'Unknown format'} · {show.totalEpisodes ?? '?'} episodes
            </p>
            <div className="mt-2 flex items-center gap-2">
              {RWBY_TEAM_EMBLEMS.map(({ name, color, url }) => (
                <div
                  key={name}
                  title={name}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 p-1 shadow-sm"
                  style={{ boxShadow: `0 0 0 2px ${color}` }}
                >
                  <img src={url} alt={name} referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                </div>
              ))}
            </div>
            <div className="mt-2">
              <StatusBadge status={show.status} />
            </div>
          </div>
        </div>

        {time && (
          <p className="relative mt-3 text-xs text-text-muted">
            {formatMinutes(time.newMinutes)} watched
            {time.rewatchMinutes > 0 && <> · {formatMinutes(time.rewatchMinutes)} rewatched</>}
          </p>
        )}
      </div>

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
          Watch Count
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
            <button type="button" onClick={() => bumpShowWatch(-1)} className="text-text-muted hover:text-text">
              −
            </button>
            <span className="flex-1 text-center text-sm text-text">{show.watchCount}</span>
            <button type="button" onClick={() => bumpShowWatch(1)} className="text-text-muted hover:text-text">
              +
            </button>
          </div>
          <p className="mt-1 text-[11px] text-text-faint">+/- rewatches the whole show, episode by episode</p>
        </div>
      </div>

      <label className="mt-3 block text-xs text-text-faint">
        Custom cover URL
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
          seasons={show.seasons}
          defaultDuration={show.episodeDurationMin}
          onBumpWatch={handleBumpWatch}
          onMarkThrough={markThrough}
          onSetSeasonWatchCount={setSeasonWatchCount}
          onSetSeasonDuration={setSeasonDuration}
          onSetSeasonMeta={setSeasonMeta}
          onSetEpisodeMeta={setEpisodeMeta}
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

      <MarkThroughDialog
        open={pendingMarkThrough !== null}
        episodeNumber={pendingMarkThrough ?? 0}
        onYes={() => {
          if (pendingMarkThrough !== null) markThrough(pendingMarkThrough)
          setPendingMarkThrough(null)
        }}
        onNo={() => {
          const ep = show.episodes.find((e) => e.number === pendingMarkThrough)
          if (ep) bumpWatch(ep, 1)
          setPendingMarkThrough(null)
        }}
        onNever={() => {
          const ep = show.episodes.find((e) => e.number === pendingMarkThrough)
          if (ep) bumpWatch(ep, 1, { skipMarkThroughPrompt: true })
          setPendingMarkThrough(null)
        }}
      />
    </div>
  )
}

// Same rules-of-hooks workaround as ShowDetailPage: useShowActions can't be
// called conditionally, but `show` may briefly be undefined for an unknown id.
const PLACEHOLDER_SHOW = {
  id: '',
  anilistId: null,
  title: '',
  coverUrl: null,
  bannerUrl: null,
  customCoverUrl: null,
  format: null,
  totalEpisodes: null,
  episodeDurationMin: null,
  hasSequel: false,
  status: 'plan_to_watch' as const,
  watchCount: 0,
  episodes: [],
  seasons: null,
  needsReview: false,
  reviewNote: null,
  notes: null,
  skipMarkThroughPrompt: false,
  createdAt: '',
  updatedAt: '',
}
