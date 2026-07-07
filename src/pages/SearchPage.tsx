import { useState } from 'react'
import { useData } from '../store/useData'
import { CoverImage } from '../components/CoverImage'
import { AddCustomShowForm } from '../components/AddCustomShowForm'
import { AniListDetailsPanel } from '../components/AniListDetailsPanel'
import { EpisodePreviewList } from '../components/EpisodePreviewList'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ChevronIcon } from '../components/icons'
import { bestTitle, hasSequelRelation, searchAniList, type AniListMedia } from '../lib/anilist'
import { buildShowFromMedia } from '../lib/newShow'
import { relinkFavorites } from '../lib/relinkFavorites'
import type { Show } from '../types/schema'

export function SearchPage() {
  const { shows, customLists, saveShow, saveCustomList, removeShow } = useData()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AniListMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [removing, setRemoving] = useState<Show | null>(null)

  const existingByAnilistId = new Map(shows.filter((s) => s.anilistId != null).map((s) => [s.anilistId, s]))

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResults(await searchAniList(query.trim()))
    } catch {
      setError('AniList search failed — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(media: AniListMedia) {
    await saveShow(buildShowFromMedia(media))
    setStatus(`Added "${bestTitle(media)}" to Plan to Watch.`)
  }

  // If a Favorite-list entry already exists with this exact title (e.g. RWBY,
  // added as a plain favorite before it had a trackable Show), link it up
  // immediately instead of making the user run the Data tab's Relink tool.
  async function handleAddCustomShow(show: Show) {
    await saveShow(show)
    const { updatedLists, changedCount } = relinkFavorites(customLists, [show])
    for (const list of updatedLists) {
      await saveCustomList(list)
    }
    setStatus(
      changedCount > 0
        ? `Added "${show.title}" and linked it to ${changedCount} matching favorite entr${changedCount === 1 ? 'y' : 'ies'}.`
        : `Added "${show.title}" to Plan to Watch.`,
    )
  }

  return (
    <div className="pb-6">
      {status && (
        <div className="mb-3 rounded-lg border border-status-completed/50 bg-status-completed/10 p-3 text-sm text-text">
          {status}
        </div>
      )}
      <p className="mb-3 text-xs text-text-faint">
        Search AniList, open a result to read its description and episode list, then add or remove it from your
        watchlist whenever you're ready — nothing changes just by browsing.
      </p>
      <form onSubmit={runSearch} className="flex gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anime title…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-status-stopped">{error}</p>}

      <div className="mt-3 space-y-2">
        {results.map((media) => {
          const existing = existingByAnilistId.get(media.id)
          const added = !!existing
          const isExpanded = expanded === media.id
          return (
            <div key={media.id} className="rounded-lg border border-border p-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : media.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <CoverImage src={media.coverImage.large} alt="" className="h-16 w-11 shrink-0 rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{bestTitle(media)}</p>
                    <p className="text-xs text-text-faint">
                      {media.format ?? 'Unknown format'} · {media.episodes ?? '?'} ep
                    </p>
                  </div>
                  <ChevronIcon direction={isExpanded ? 'up' : 'down'} className="h-4 w-4 shrink-0 text-text-faint" />
                </button>
                <button
                  type="button"
                  onClick={() => (added && existing ? setRemoving(existing) : handleAdd(media))}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    added
                      ? 'border border-status-stopped/50 text-status-stopped hover:bg-status-stopped/10'
                      : 'bg-accent text-white hover:bg-accent-hover'
                  }`}
                >
                  {added ? 'Remove' : '+ Add'}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-3 border-t border-border pt-3">
                  <AniListDetailsPanel anilistId={media.id} hasSequel={hasSequelRelation(media)} />
                  <h4 className="mb-1.5 mt-3 text-xs font-semibold text-text-muted">Episodes</h4>
                  <EpisodePreviewList anilistId={media.id} totalEpisodes={media.episodes} />
                </div>
              )}
            </div>
          )
        })}
        {!loading && results.length === 0 && query && !error && (
          <p className="text-sm text-text-faint">No results yet — try a search.</p>
        )}
      </div>

      <div className="mt-4">
        <AddCustomShowForm onAdd={handleAddCustomShow} />
      </div>

      <ConfirmDialog
        open={!!removing}
        title="Remove this show?"
        message={`"${removing?.title}" and all its episode/rewatch data will be deleted from this device. Export a backup first if you're not sure.`}
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeShow(removing.id)
          setRemoving(null)
        }}
      />
    </div>
  )
}
