import { useEffect, useState } from 'react'
import { getStreamingEpisodes, streamingEpisodeTitle, type StreamingEpisode } from '../lib/anilist'
import { CoverImage } from './CoverImage'

/** Read-only episode list for previewing a search result before adding it —
 * no watch tracking here, since there's no Show record yet to track it on. */
export function EpisodePreviewList({ anilistId, totalEpisodes }: { anilistId: number; totalEpisodes: number | null }) {
  const [streaming, setStreaming] = useState<StreamingEpisode[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getStreamingEpisodes(anilistId)
      .then(setStreaming)
      .catch(() => setStreaming([]))
      .finally(() => setLoading(false))
  }, [anilistId])

  if (loading) return <p className="text-sm text-text-faint">Loading episodes…</p>

  const count = totalEpisodes ?? streaming?.length ?? 0
  if (count === 0) return <p className="text-sm text-text-faint">No episode data available yet.</p>

  return (
    <div className="max-h-72 space-y-1.5 overflow-y-auto">
      {Array.from({ length: count }, (_, i) => {
        const ep = streaming?.[i]
        return (
          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border p-1.5">
            {ep?.thumbnail ? (
              <CoverImage src={ep.thumbnail} alt="" className="h-9 w-16 shrink-0 rounded" />
            ) : (
              <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded border border-border text-[11px] text-text-faint">
                {i + 1}
              </div>
            )}
            <p className="truncate text-xs text-text-muted">
              {i + 1}. {streamingEpisodeTitle(i + 1, ep)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
