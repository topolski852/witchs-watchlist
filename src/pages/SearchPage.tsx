import { useState } from 'react'
import { useData } from '../store/useData'
import { CoverImage } from '../components/CoverImage'
import { bestTitle, searchAniList, type AniListMedia } from '../lib/anilist'
import { buildShowFromMedia } from '../lib/newShow'

export function SearchPage() {
  const { shows, saveShow } = useData()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AniListMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<Set<number>>(new Set())

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
    setJustAdded((prev) => new Set(prev).add(media.id))
  }

  return (
    <div className="pb-6">
      <p className="mb-3 text-xs text-text-faint">
        Search AniList and add anime to your Plan to Watch list — nothing is added just by browsing, only when you
        tap Add.
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
          const added = justAdded.has(media.id) || !!existing
          return (
            <div key={media.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
              <CoverImage src={media.coverImage.large} alt="" className="h-16 w-11 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{bestTitle(media)}</p>
                <p className="text-xs text-text-faint">
                  {media.format ?? 'Unknown format'} · {media.episodes ?? '?'} ep
                </p>
              </div>
              <button
                type="button"
                disabled={added}
                onClick={() => handleAdd(media)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  added
                    ? 'border border-border text-text-faint'
                    : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {added ? 'Added ✓' : '+ Add'}
              </button>
            </div>
          )
        })}
        {!loading && results.length === 0 && query && !error && (
          <p className="text-sm text-text-faint">No results yet — try a search.</p>
        )}
      </div>
    </div>
  )
}
