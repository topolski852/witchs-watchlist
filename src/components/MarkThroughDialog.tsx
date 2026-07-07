export function MarkThroughDialog({
  open,
  episodeNumber,
  onYes,
  onNo,
  onNever,
}: {
  open: boolean
  episodeNumber: number
  onYes: () => void
  onNo: () => void
  onNever: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface-raised p-5 shadow-xl">
        <h2 className="text-base font-semibold text-text">Mark earlier episodes watched too?</h2>
        <p className="mt-2 text-sm text-text-muted">
          Episode {episodeNumber} has unwatched episodes before it. Fill those in as watched as well?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onNever}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-surface"
            title="Stop asking for this show — useful if you skip filler episodes"
          >
            Never for this show
          </button>
          <button
            type="button"
            onClick={onNo}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-surface"
          >
            No
          </button>
          <button
            type="button"
            onClick={onYes}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}
