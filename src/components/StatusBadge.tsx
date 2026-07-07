import type { WatchStatus } from '../types/schema'
import { WATCH_STATUSES } from '../types/schema'

const colorVar: Record<WatchStatus, string> = {
  watching: 'var(--color-status-watching)',
  caught_up: 'var(--color-status-caught-up)',
  completed: 'var(--color-status-completed)',
  stopped: 'var(--color-status-stopped)',
  plan_to_watch: 'var(--color-status-plan)',
}

export function StatusBadge({ status }: { status: WatchStatus }) {
  const label = WATCH_STATUSES.find((s) => s.value === status)?.label ?? status
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ borderColor: colorVar[status], color: colorVar[status] }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorVar[status] }} />
      {label}
    </span>
  )
}
