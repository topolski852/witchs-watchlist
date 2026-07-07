import { useState } from 'react'
import { bestTitle, searchAniList, type AniListMedia } from '../lib/anilist'
import { CoverImage } from './CoverImage'

export function SearchAniListModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (media: AniListMedia) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AniListMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const media = await searchAniList(query.trim())
      setResults(media)
    } catch {
      setError('AniList search failed — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16" role="dialog" aria-modal>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-border bg-surface-raised p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Add from AniList</h2>
          <button type="button" onClick={onClose} className="text-text-faint hover:text-text">
            ✕
          </button>
        </div>
        <form onSubmit={runSearch} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anime title…"
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? '…' : 'Search'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-status-stopped">{error}</p>}
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {results.map((media) => (
            <button
              key={media.id}
              type="button"
              onClick={() => onPick(media)}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left hover:border-accent-soft"
            >
              <CoverImage src={media.coverImage.large} alt="" className="h-16 w-11 shrink-0 rounded" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{bestTitle(media)}</p>
                <p className="text-xs text-text-faint">
                  {media.format ?? 'Unknown format'} · {media.episodes ?? '?'} ep
                </p>
              </div>
            </button>
          ))}
          {!loading && results.length === 0 && query && !error && (
            <p className="text-sm text-text-faint">No results yet — try a search.</p>
          )}
        </div>
      </div>
    </div>
  )
}
