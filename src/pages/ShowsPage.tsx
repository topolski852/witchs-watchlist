import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useData } from '../store/useData'
import { ShowRow } from '../components/ShowRow'
import { SearchAniListModal } from '../components/SearchAniListModal'
import { WATCH_STATUSES, type Episode, type Show, type WatchStatus } from '../types/schema'
import type { AniListMedia } from '../lib/anilist'
import { bestTitle, hasSequelRelation } from '../lib/anilist'
import { ChevronIcon } from '../components/icons'

// Home-feed order: active shows first, "done with it" statuses last.
const SECTION_ORDER: WatchStatus[] = ['watching', 'caught_up', 'plan_to_watch', 'completed', 'stopped']
const SECTION_LABELS = Object.fromEntries(WATCH_STATUSES.map((s) => [s.value, s.label])) as Record<
  WatchStatus,
  string
>
// A ~480-show library mostly ends up here over time — start these two folded
// so the feed reads as "what's active" rather than a wall of finished shows.
const DEFAULT_COLLAPSED: WatchStatus[] = ['completed', 'stopped']

export function ShowsPage() {
  const { shows, saveShow, loading } = useData()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<WatchStatus>>(new Set(DEFAULT_COLLAPSED))

  const sections = useMemo(() => {
    const query = search.toLowerCase()
    return SECTION_ORDER.map((status) => ({
      status,
      shows: shows
        .filter((s) => s.status === status)
        .filter((s) => s.title.toLowerCase().includes(query))
        .sort((a, b) => a.title.localeCompare(b.title)),
    }))
  }, [shows, search])

  function toggleSection(status: WatchStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

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
      bannerUrl: media.bannerImage,
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
      skipMarkThroughPrompt: false,
      createdAt: now,
      updatedAt: now,
    }
    await saveShow(show)
    setModalOpen(false)
  }

  const totalMatching = sections.reduce((sum, s) => sum + s.shows.length, 0)

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

      {loading ? (
        <p className="py-8 text-center text-sm text-text-faint">Loading your watchlist…</p>
      ) : shows.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-faint">
          Nothing here yet — add a show, or import your TV Time data from the Data tab.
        </p>
      ) : totalMatching === 0 ? (
        <p className="py-8 text-center text-sm text-text-faint">No shows match "{search}".</p>
      ) : (
        <div className="space-y-4 pb-4">
          {sections
            .filter((section) => section.shows.length > 0)
            .map((section) => (
              <div key={section.status}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.status)}
                  className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-text"
                >
                  <span>
                    {SECTION_LABELS[section.status]}{' '}
                    <span className="font-normal text-text-faint">({section.shows.length})</span>
                  </span>
                  <ChevronIcon
                    direction={collapsed.has(section.status) ? 'down' : 'up'}
                    className="h-4 w-4 text-text-faint"
                  />
                </button>
                {!collapsed.has(section.status) && (
                  <div className="space-y-2">
                    {section.shows.map((show) => (
                      <ShowRow key={show.id} show={show} />
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      <SearchAniListModal open={modalOpen} onClose={() => setModalOpen(false)} onPick={handlePick} />
    </div>
  )
}
