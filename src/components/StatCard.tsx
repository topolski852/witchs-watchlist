/** TV Time-style stat card: a title, then a row of big numbers each with a
 * small label underneath — shared by HomePage and StatsPage so both read the
 * same way. `font-display` (Cinzel) renders lining/tabular figures, so digits
 * like "0" no longer look shorter than the rest. */
export function StatCard({ title, stats }: { title: string; stats: { value: string | number; label?: string }[] }) {
  return (
    <div className="shrink-0 rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-center text-xs text-text-faint">{title}</p>
      <div className="mt-1.5 flex justify-center gap-4">
        {stats.map((s, i) => (
          <div key={i} className="text-center">
            <p className="font-display text-xl text-text">{s.value}</p>
            {s.label && <p className="text-[11px] capitalize text-text-faint">{s.label}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
