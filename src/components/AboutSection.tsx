import { useEffect, useState } from 'react'
import { getAniListDetails, type AniListDetails } from '../lib/anilist'

function formatDate(d: AniListDetails['startDate']): string | null {
  if (!d?.year) return null
  if (!d.month) return String(d.year)
  const month = String(d.month).padStart(2, '0')
  return d.day ? `${d.year}-${month}-${String(d.day).padStart(2, '0')}` : `${d.year}-${month}`
}

const SOURCE_LABELS: Record<string, string> = {
  ORIGINAL: 'Original',
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light Novel',
  VISUAL_NOVEL: 'Visual Novel',
  VIDEO_GAME: 'Video Game',
  NOVEL: 'Novel',
  WEB_NOVEL: 'Web Novel',
  ANIME: 'Anime',
  DOUJINSHI: 'Doujinshi',
  COMIC: 'Comic',
  GAME: 'Game',
  MULTIMEDIA_PROJECT: 'Multimedia Project',
}

export function AboutSection({ anilistId, hasSequel }: { anilistId: number | null; hasSequel: boolean }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState<AniListDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || details || loading || !anilistId) return
    setLoading(true)
    setError(null)
    getAniListDetails(anilistId)
      .then((d) => setDetails(d))
      .catch(() => setError('Could not load details from AniList.'))
      .finally(() => setLoading(false))
  }, [open, details, loading, anilistId])

  if (!anilistId) return null

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text"
      >
        About
        <span aria-hidden className="text-text-faint">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-surface p-3">
          {loading && <p className="text-sm text-text-faint">Loading…</p>}
          {error && <p className="text-sm text-status-stopped">{error}</p>}
          {details && (
            <div className="space-y-3">
              {hasSequel && (
                <p className="rounded-md border border-accent-soft/50 bg-accent-muted/40 px-2 py-1.5 text-xs text-text">
                  AniList lists a sequel/continuation for this show — that's why it goes to Caught Up instead of
                  Completed once every episode here is watched.
                </p>
              )}

              {details.description && (
                <p className="text-sm leading-relaxed text-text-muted">
                  {details.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}
                </p>
              )}

              {details.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {details.genres.map((g) => (
                    <span key={g} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {details.studios.length > 0 && (
                  <div>
                    <dt className="text-text-faint">Studio</dt>
                    <dd className="text-text-muted">{details.studios.join(', ')}</dd>
                  </div>
                )}
                {details.source && (
                  <div>
                    <dt className="text-text-faint">Source</dt>
                    <dd className="text-text-muted">{SOURCE_LABELS[details.source] ?? details.source}</dd>
                  </div>
                )}
                {details.season && details.seasonYear && (
                  <div>
                    <dt className="text-text-faint">Season</dt>
                    <dd className="text-text-muted">
                      {details.season[0] + details.season.slice(1).toLowerCase()} {details.seasonYear}
                    </dd>
                  </div>
                )}
                {details.averageScore != null && (
                  <div>
                    <dt className="text-text-faint">AniList score</dt>
                    <dd className="text-text-muted">{details.averageScore}/100</dd>
                  </div>
                )}
                {formatDate(details.startDate) && (
                  <div>
                    <dt className="text-text-faint">Aired</dt>
                    <dd className="text-text-muted">
                      {formatDate(details.startDate)} – {formatDate(details.endDate) ?? 'present'}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
