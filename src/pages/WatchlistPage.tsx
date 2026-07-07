import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useData } from '../store/useData'
import { ShowCard } from '../components/ShowCard'
import { SearchAniListModal } from '../components/SearchAniListModal'
import { WATCH_STATUSES, type Episode, type Show, type WatchStatus } from '../types/schema'
import type { AniListMedia } from '../lib/anilist'
import { bestTitle, hasSequelRelation } from '../lib/anilist'

const FILTERS: { value: WatchStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...WATCH_STATUSES,
]

export function WatchlistPage() {
  const { shows, saveShow, loading } = useData()
  const [filter, setFilter] = useState<WatchStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    return shows
      .filter((s) => filter === 'all' || s.status === filter)
      .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [shows, filter, search])

  async function handlePick(media: AniListMedia) {
    const now = new Date().toISOString()
    const episodes: Episode[] = Array.from({ length: media.episodes ?? 0 }, (_, i) => ({
      number: i + 1,
      seasonNumber: null,
      watched: false,
      watchedAt: null,
      rewatchCount: 0,
      rewatchDates: [],
    }))
    const show: Show = {
      id: uuid(),
      anilistId: media.id,
      title: bestTitle(media),
      coverUrl: media.coverImage.large,
      customCoverUrl: null,
      format: media.format,
      totalEpisodes: media.episodes,
      episodeDurationMin: media.duration,
      hasSequel: hasSequelRelation(media),
      status: 'plan_to_watch',
      rewatchCount: 0,
      episodes,
      needsReview: false,
      reviewNote: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    }
    await saveShow(show)
    setModalOpen(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter your list…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Add
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.value
                ? 'border-accent bg-accent-muted text-text'
                : 'border-border text-text-faint hover:text-text-muted'
            }`}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1 text-text-faint">
                {shows.filter((s) => s.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Loading your watchlist…</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-faint">
          {shows.length === 0
            ? 'Nothing here yet — add a show, or import your TV Time data from the Data tab.'
            : 'No shows match this filter.'}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {filtered.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      )}

      <SearchAniListModal open={modalOpen} onClose={() => setModalOpen(false)} onPick={handlePick} />
    </div>
  )
}
