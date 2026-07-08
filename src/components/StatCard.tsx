/** TV Time-style stat card: a title, then a row of big numbers each with a
 * small label underneath — shared by HomePage and StatsPage so both read the
 * same way. `font-display` (Cinzel) renders lining/tabular figures, so digits
 * like "0" no longer look shorter than the rest. `className` lets callers
 * decide sizing: HomePage's horizontal shelf wants `shrink-0` (content-sized,
 * scrolls), StatsPage's fixed 3-card row wants none (grid stretches it full
 * width instead). */
export function StatCard({
  title,
  stats,
  className = '',
}: {
  title: string
  stats: { value: string | number; label?: string }[]
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-border bg-surface px-3 py-3 ${className}`}>
      <p className="text-center text-xs text-text-faint">{title}</p>
      <div className="mt-1.5 flex justify-center gap-2 sm:gap-4">
        {stats.map((s, i) => (
          <div key={i} className="text-center">
            <p className="font-display text-lg text-text sm:text-xl">{s.value}</p>
            {s.label && <p className="text-[10px] capitalize text-text-faint sm:text-[11px]">{s.label}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
