import { useState } from 'react'
import { ChevronIcon } from './icons'
import { AniListDetailsPanel } from './AniListDetailsPanel'

export function AboutSection({ anilistId, hasSequel }: { anilistId: number | null; hasSequel: boolean }) {
  const [open, setOpen] = useState(false)

  if (!anilistId) return null

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text"
      >
        About
        <ChevronIcon direction={open ? 'up' : 'down'} className="h-4 w-4 text-text-faint" />
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-surface p-3">
          <AniListDetailsPanel anilistId={anilistId} hasSequel={hasSequel} />
        </div>
      )}
    </div>
  )
}
