import { useEffect, useState } from 'react'
import { getAniListDetails, type AniListDetails } from '../lib/anilist'
import { AniListDetailsView } from './AniListDetailsView'

/** Fetches + renders AniList details for one id — mount-gated by the caller
 * (e.g. only rendered once expanded) rather than gating its own fetch, so it
 * can be reused both inside a manual collapsible (AboutSection) and inside
 * an externally-controlled expand toggle (the Search page's preview). */
export function AniListDetailsPanel({ anilistId, hasSequel }: { anilistId: number; hasSequel?: boolean }) {
  const [details, setDetails] = useState<AniListDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAniListDetails(anilistId)
      .then(setDetails)
      .catch(() => setError('Could not load details from AniList.'))
      .finally(() => setLoading(false))
  }, [anilistId])

  if (loading) return <p className="text-sm text-text-faint">Loading…</p>
  if (error) return <p className="text-sm text-status-stopped">{error}</p>
  if (!details) return null
  return <AniListDetailsView details={details} hasSequel={hasSequel} />
}
