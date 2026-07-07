import { Link } from 'react-router-dom'
import { CoverImage } from './CoverImage'

export interface ShelfItem {
  id: string
  title: string
  coverUrl: string | null
  linkedShowId: string | null
}

export function ShelfRow({ title, count, to, items }: { title: string; count: number; to: string; items: ShelfItem[] }) {
  if (items.length === 0) return null

  return (
    <div>
      <Link to={to} className="mb-2 flex items-center justify-between text-sm font-semibold text-text">
        <span>
          {title} <span className="font-normal text-text-faint">({count})</span>
        </span>
        <span aria-hidden className="text-text-faint">
          ›
        </span>
      </Link>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {items.map((item) => {
          const poster = (
            <CoverImage
              src={item.coverUrl}
              alt={item.title}
              className="aspect-[2/3] w-20 shrink-0 rounded-lg border border-border sm:w-24"
            />
          )
          return item.linkedShowId ? (
            <Link key={item.id} to={`/show/${item.linkedShowId}`} className="shrink-0">
              {poster}
            </Link>
          ) : (
            <div key={item.id} className="shrink-0">
              {poster}
            </div>
          )
        })}
      </div>
    </div>
  )
}
