import { useState } from 'react'
import type { Show } from '../types/schema'
import { buildCustomShow } from '../lib/customShow'
import { CloseIcon } from './icons'

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-text placeholder:text-text-faint'

export function AddCustomShowForm({ onAdd }: { onAdd: (show: Show) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [format, setFormat] = useState('')
  const [duration, setDuration] = useState('')
  const [seasons, setSeasons] = useState<number[]>([12])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-text-faint hover:border-accent-soft hover:text-text-muted"
      >
        Can't find it on AniList? Add a custom show
      </button>
    )
  }

  function updateSeason(index: number, value: number) {
    setSeasons((prev) => prev.map((c, i) => (i === index ? Math.max(1, value) : c)))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || seasons.some((c) => c < 1)) return
    onAdd(
      buildCustomShow({
        title: title.trim(),
        coverUrl: coverUrl.trim() || null,
        format: format.trim() || null,
        episodeDurationMin: duration.trim() ? Number(duration) : null,
        seasons: seasons.map((episodeCount) => ({ episodeCount })),
      }),
    )
    setTitle('')
    setCoverUrl('')
    setFormat('')
    setDuration('')
    setSeasons([12])
    setOpen(false)
  }

  const wikiUrl = title.trim()
    ? `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(title.trim())}`
    : null

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Add a custom show</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-text-faint hover:text-text">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <label className="block text-xs text-text-faint">
        Title
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. RWBY"
          className={`mt-1 ${inputClass}`}
        />
        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-accent underline"
          >
            🔍 Look up episode/season counts on Wikipedia
          </a>
        )}
      </label>

      <label className="block text-xs text-text-faint">
        Cover image URL (optional)
        <input
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
          className={`mt-1 ${inputClass}`}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-text-faint">
          Format (optional)
          <input
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            placeholder="e.g. Web Series"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block text-xs text-text-faint">
          Minutes per episode
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 24"
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      <div>
        <p className="text-xs text-text-faint">Seasons</p>
        <div className="mt-1 space-y-1.5">
          {seasons.map((count, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-text-muted">Season {i + 1}</span>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) => updateSeason(i, Number(e.target.value))}
                className="w-20 rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text"
              />
              <span className="text-xs text-text-faint">episodes</span>
              {seasons.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSeasons((prev) => prev.filter((_, idx) => idx !== i))}
                  className="ml-auto text-text-faint hover:text-status-stopped"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSeasons((prev) => [...prev, 12])}
          className="mt-2 text-xs text-accent underline"
        >
          + Add season
        </button>
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Add Show
      </button>
    </form>
  )
}
